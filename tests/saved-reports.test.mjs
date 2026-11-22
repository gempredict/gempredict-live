import { authorizeDiagnosticOwner } from '../lib/scanDiagnosticsAuth.mjs';
import { compactRegions } from '../lib/compactPhotoObservations.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createSavedSnapshot, readSavedSnapshot } from '../lib/savedReportSnapshot.mjs';
import { createSavedReportsHandler, libraryConfiguration, saveCompletedLibraryReport } from '../lib/savedReportsServer.mjs';
import { runScan } from './helpers/reconciliationPipeline.mjs';
import { renderLibraryMobile, renderReports } from './helpers/renderReports.mjs';

const owner='aaaaaaaa-0000-4000-8000-000000000001';
const other='bbbbbbbb-0000-4000-8000-000000000001';
const scan='cccccccc-0000-4000-8000-000000000001';
const reportId='dddddddd-0000-4000-8000-000000000001';
const access='Bearer token-for-owner';
const env={
  VERCEL:'1',VERCEL_ENV:'preview',GEMPREDICT_LIBRARY_ENABLED:'true',
  VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),
  GEMPREDICT_LIBRARY_PREVIEW_SUPABASE_URL:'https://library-test.supabase.co',
  GEMPREDICT_LIBRARY_PREVIEW_PUBLISHABLE_KEY:'sb_publishable_test',
  GEMPREDICT_LIBRARY_PREVIEW_SERVICE_ROLE_KEY:'synthetic_service_credential',
};
function complete() {
  return {success:true,prediction:{cardTitle:'Synthetic Collector Card',verdict:'withheld'},
    canonicalCard:{subject:'Synthetic Collector',cardNumber:'8B-11'},
    financialDecision:{allowed:false,status:'withheld'},
    imageAnalysis:{inspectedSides:['front','back'],conditionAssessments:{corners:{state:'model_observations_available',observations:[]}},
      compactPhotoObservations:[{attribute:'corners',side:'back',region:'corner_top_left',status:'possible',text:'Corner whitening.'}]},
  };
}
function storage({ failWrite=false, rows=[] }={}) {
  const calls=[];
  const byScan=new Map();
  function makeClient(_url,key,options) {
    if(key===env.GEMPREDICT_LIBRARY_PREVIEW_SERVICE_ROLE_KEY) return {
      async rpc(name,body) {
        calls.push(['rpc',name,body]);
        if(failWrite) return {error:{message:'private storage message'}};
        const id=body.report_owner+'/'+body.report_scan;
        if(!byScan.has(id))byScan.set(id,structuredClone(body));
        return {data:null,error:null};
      },
    };
    assert.equal(key,env.GEMPREDICT_LIBRARY_PREVIEW_PUBLISHABLE_KEY);
    const authenticated=options.global.headers.Authorization===access?owner:
      options.global.headers.Authorization==='Bearer token-for-other'?other:null;
    return {
      auth:{async getUser(token) {
        assert.equal(options.global.headers.Authorization,'Bearer '+token);
        return {data:{user:authenticated?{id:authenticated}:null}};
      }},
      from(name) {
        assert.equal(name,'saved_reports');
        let selected=null, remove=false;
        const filters={};
        const query={
          select(value){selected=value;return this;},
          delete(){remove=true;return this;},
          eq(key,value){filters[key]=value;return this;},
          ilike(key,value){calls.push(['search',key,value]);return this;},
          order(){return this;},
          async maybeSingle(){
            assert.equal(filters.owner_id,authenticated);
            const index=rows.findIndex(row=>row.owner_id===authenticated&&row.id===filters.id);
            if(index<0)return {data:null,error:null};
            return {data:remove?rows.splice(index,1)[0]:rows[index],error:null};
          },
          async range(){
            assert.equal(filters.owner_id,authenticated);
            assert.ok(!selected.includes('payload'));
            return {data:rows.filter(row=>row.owner_id===authenticated).map(({payload, ...metadata})=>metadata),error:null};
          },
        };
        return query;
      },
    };
  }
  return { makeClient,calls,byScan };
}
async function request(handler,method,query={},authorization=access) {
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method,query,headers:{authorization}},res);
  return res;
}

test('completed authenticated photographic analysis saves once and storage failure preserves the completed report',async()=>{
 for(const failWrite of [false,true]){
  const db=storage({failWrite});
  const result=await runScan({env,headers:{authorization:access},libraryClient:db.makeClient});
  assert.equal(result.status,200);
  assert.equal(result.metrics.vision,1);
  assert.equal(result.payload.imageAnalysis.estimatedGrade,null);
  assert.equal(result.payload.librarySave.status,failWrite?'unavailable':'saved');
  assert.deepEqual(db.calls[0].slice(0,2),['rpc','store_completed_saved_report']);
  assert.equal(db.calls[0][2].report_owner,owner);
  assert.equal(db.calls[0][2].report_model,'claude-sonnet-4-6');
  assert.equal(db.calls[0][2].report_revision,'a'.repeat(40));
 }
});

test('failed, incomplete, anonymous and text-only scans do not save',async()=>{
 const db=storage();
 for(const params of [
  {headers:{authorization:access},textOnly:true},
  {headers:{authorization:access},visionError:{status:400}},
  {headers:{authorization:access},badBack:true},
  {},
 ]) {
  await runScan({...params,env,libraryClient:db.makeClient});
 }
 assert.equal(db.calls.length,0);
});

test('server-owned scan ID is idempotent and duplicate saves cannot overwrite history',async()=>{
 const db=storage();
 const options={req:{headers:{authorization:access}},report:complete(),scanId:scan,
  model:'gemini-4-carbon',category:'sports',env,makeClient:db.makeClient};
 assert.deepEqual(await saveCompletedLibraryReport(options),{status:'saved'});
 const newer=complete();newer.prediction.cardTitle='Changed';
 assert.deepEqual(await saveCompletedLibraryReport({...options,report:newer}),{status:'saved'});
 assert.equal(db.byScan.size,1);
 assert.equal(db.byScan.values().next().value.report_payload.cardTitle,'Synthetic Collector Card');
});

test('owner may list, reopen and delete, while other accounts and anonymous callers cannot',async()=>{
 const payload=createSavedSnapshot(complete());
 const rows=[{id:reportId,scan_id:scan,owner_id:owner,schema_version:1,payload}];
 const db=storage({rows});
 const handler=createSavedReportsHandler({env,makeClient:db.makeClient});
 const list=await request(handler,'GET',{search:'8B_11',sort:'name'});
 assert.equal(list.code,200);
 assert.equal(list.body.reports[0].payload,undefined);
 assert.deepEqual(db.calls[0],['search','search_text','%8B\\_11%']);
 assert.equal((await request(handler,'GET',{id:reportId},'')).code,401);
 assert.equal((await request(handler,'DELETE',{id:reportId},'')).code,401);
 assert.equal((await request(handler,'GET',{id:reportId},'Bearer token-for-other')).code,404);
 assert.equal((await request(handler,'DELETE',{id:reportId},'Bearer token-for-other')).code,404);
 assert.equal((await request(handler,'POST',{})).code,405);
 const opened=await request(handler,'GET',{id:reportId});
 assert.deepEqual(opened.body.report.payload,payload);
 assert.equal(opened.headers['Cache-Control'],'private, no-store');
 assert.equal((await request(handler,'DELETE',{id:reportId})).body.deleted,true);
 assert.equal((await request(handler,'GET',{id:reportId})).code,404);
 assert.ok(db.calls.every(([action])=>action==='search'));
});

test('saved v1 evidence stays frozen, unknown versions fail closed and historical renderer uses the snapshot',async()=>{
 const payload=createSavedSnapshot(complete());
 assert.equal(readSavedSnapshot({schema_version:1,payload}),payload);
 assert.equal(readSavedSnapshot({schema_version:2,payload}),null);
 const db=storage({rows:[{id:reportId,owner_id:owner,schema_version:2,payload}]});
 const result=await request(createSavedReportsHandler({env,makeClient:db.makeClient}),'GET',{id:reportId});
 assert.equal(result.code,422);
 const html=renderReports(payload,null,{historical:true}).upper;
 assert.match(html,/Corner whitening/);
 assert.match(html,/Model photo observations/);
 assert.doesNotMatch(html,/Review or correct identification/);
});

test('snapshot excludes credentials, uploads, request metadata and raw provider responses',()=>{
 const report=complete();
 report.identityReviewToken='private_review_token';
 report.providerResponse={text:'private_provider_body'};
 report.imageAnalysis.upload={frontImage:Buffer.from('private_photo_bytes'),photo:'data:image/jpeg;base64,private'};
 report.imageAnalysis.authorization='private_authorization';
 report.prediction.privateContact='people@example.com';
 report.imageAnalysis.imageSummary='blob:https://example.com/private';
 const serialized=JSON.stringify(createSavedSnapshot(report));
 assert.doesNotMatch(serialized,/private_|example\.com|identityReviewToken|providerResponse|data:image|\bblob:/);
 assert.match(serialized,/Corner whitening/);
});

test('Preview requires a distinct configured project and configuration response never returns the writer credential',async()=>{
 assert.equal(libraryConfiguration({...env,VERCEL_ENV:'production'}),null);
 assert.equal(libraryConfiguration({...env,NEXT_PUBLIC_SUPABASE_URL:env.GEMPREDICT_LIBRARY_PREVIEW_SUPABASE_URL}),null);
 assert.equal(libraryConfiguration({...env,GEMPREDICT_LIBRARY_PREVIEW_PUBLISHABLE_KEY:'sb_secret_wrong'}),null);
 const handler=createSavedReportsHandler({env,makeClient:()=>assert.fail('configuration must not contact Supabase')});
 const result=await request(handler,'GET',{config:'1'},'');
 assert.deepEqual(result.body,{url:env.GEMPREDICT_LIBRARY_PREVIEW_SUPABASE_URL,publishableKey:env.GEMPREDICT_LIBRARY_PREVIEW_PUBLISHABLE_KEY});
});

test('migration restricts direct mutation and applies ownership RLS to reads, deletes and server writes',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261122_saved_reports.sql','utf8');
 assert.match(sql,/force row level security/i);
 assert.match(sql,/unique \(owner_id, scan_id\)/i);
 assert.match(sql,/grant select, delete .* to authenticated/i);
 assert.doesNotMatch(sql,/grant (?:insert|update|all)[^;]* to authenticated/i);
 assert.match(sql,/nologin nobypassrls/i);
 assert.match(sql,/with check \(owner_id::text = current_setting/i);
 assert.match(sql,/on conflict \(owner_id, scan_id\) do nothing/i);
});

test('mobile library controls wrap with touch-sized actions and no fixed content width',()=>{
 const html=renderLibraryMobile({id:reportId,card_name:'Synthetic Collector',card_number:'8B-11',created_at:'2026-11-22T00:00:00Z'});
 assert.match(html,/My Card Library/);
 assert.match(html,/flex-wrap:wrap/);
 assert.match(html,/min-width:0/);
 assert.match(html,/min-height:44px/);
 assert.match(html,/Open saved report/);
 assert.match(html,/Delete saved report/);
 assert.match(html,/Search cards/);
});

test('authorized Gemini Full Analysis saves the provider version and front/back evidence',async()=>{
 const host='gempredict-live-unit123.vercel.app';
 const environment={...env,VERCEL_URL:host,VERCEL_GIT_COMMIT_REF:'feature/saved-reports-phase5c',
  VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',
  GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),
  GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32),GEMPREDICT_FULL_ANALYSIS_CLAUDE_ROLLBACK:'false',
  GEMPREDICT_GEMINI_FULL_ANALYSIS:'true',VISION_BENCH_GEMINI_KEY:'synthetic-key',
  GEMPREDICT_GEMINI_INPUT_USD_PER_MILLION:'2',GEMPREDICT_GEMINI_OUTPUT_USD_PER_MILLION:'10',
  GEMPREDICT_GEMINI_MAX_SCAN_USD:'0.40',
  GEMPREDICT_GEMINI_PRICING_VERIFIED_THROUGH:new Date().toISOString().slice(0,10),
 };
 const headers={host,origin:'https://'+host,authorization:access};
 headers.cookie=authorizeDiagnosticOwner({method:'POST',headers},environment.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,environment).split(';')[0];
 const sides=['front','back'];
 const output={
  identity:{facts:[{field:'identifiedSubject',value:'Synthetic Collector'},{field:'identifiedCardNumber',value:'8B-11'}]},
  photos:sides.map(side=>({side,status:'expected'})),
  observations:sides.flatMap(side=>Object.keys(compactRegions).map(region=>({side,region,status:'possible',evidence:'Visible border wear.'}))),
 };
 let providerCalls=0;
 const db=storage();
 const result=await runScan({env:environment,headers,libraryClient:db.makeClient,
  geminiCountFetch:async()=>Response.json({totalTokens:2621}),
  geminiClient:()=>({models:{async generateContent(){
   providerCalls++;
   return {modelVersion:'gemini-4-carbon-synthetic',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]};
  }}}),
 });
 assert.equal(result.status,200);
 assert.equal(result.payload.librarySave.status,'saved');
 assert.equal(providerCalls,1);
 assert.equal(result.metrics.vision,0);
 const row=db.calls[0][2];
 assert.equal(row.report_model,'gemini-4-carbon');
 assert.equal(row.report_model_version,'gemini-4-carbon-synthetic');
 assert.equal(row.report_scan,result.responseHeaders['X-GemPredict-Diagnostic-Scan']);
 assert.deepEqual([...new Set(row.report_payload.imageAnalysis.compactPhotoObservations.map(row=>row.side))],sides);
});

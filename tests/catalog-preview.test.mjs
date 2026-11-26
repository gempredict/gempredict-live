import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogPreviewHandler } from '../lib/catalogPreviewHandler.mjs';
import { catalogConfiguration,liveCatalogBranch } from '../lib/catalogPreviewConfiguration.mjs';
import { createReviewedCrosswalkAdapter,CARD_API_CATALOG_ID_TYPES } from '../lib/catalogSalesCrosswalk.mjs';
import { authorizeDiagnosticOwner } from '../lib/scanDiagnosticsAuth.mjs';

const now=Date.parse('2026-11-26T12:00:00Z');
const host='gempredict-live-synthetic-preview.vercel.app';
const env={
 VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:host,VERCEL_GIT_COMMIT_REF:liveCatalogBranch,
 VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),
 VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',
 GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32),
 GEMPREDICT_CARD_API_CATALOG_PREVIEW_ENABLED:'true',GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE:'synthetic-review',
 THE_CARD_API_KEY:'synthetic-sales-key',THE_CARD_API_CATALOG_KEY:'synthetic-separate-catalog-key',
};
const headers={host,origin:'https://'+host,authorization:'Bearer synthetic-owner'};
headers.cookie=authorizeDiagnosticOwner({method:'POST',headers},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,now).split(';')[0];
const reportId='cd02a4a5-34f6-4b85-ac52-fbee0b0fbe1a';
const payload={canonicalCard:{subject:'Shohei Ohtani',year:'2018',manufacturer:'Topps',brandSet:'Topps Series 2',cardNumber:'700',parallel:'Base'},
 identityV2:{category:'sports'}};
const loadSaved=async(req,id)=>req.headers.authorization!==headers.authorization?{status:401,error:'library_sign_in_required'}:
 id!==reportId?{status:404,error:'report_not_found'}:{report:{payload}};
const body={reportId,confirmed:true,reviewedIdentity:{photoPose:'pitching'}};
async function request(handler,override={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.body=data;return this;}};
 await handler({method:'POST',headers,body,...override},res);
 return res;
}
const authorize=reference=>reference==='synthetic-review';
const adapter=createReviewedCrosswalkAdapter({namespace:'the_card_api',types:CARD_API_CATALOG_ID_TYPES,
 source:{id:'synthetic-catalog',provenance:'Synthetic boundary fixture'},
 authorize,projectCatalog:row=>row,projectSale:()=>null});
// This is the internal fixture format, not a claim about an upstream schema.
const contract={crosswalkAdapter:adapter,authorizeEntitlement:authorize,
 parse:bytes=>JSON.parse(bytes.toString('utf8')).records};
const row=(id,claims={})=>({recordId:id,revision:'synthetic-reviewed',identifiers:[{type:'URID',value:id}],
 exactVariantType:'URID',requiredVariantFields:['parallel','photoPose'],
 claims:{category:'sports',subjects:['Shohei Ohtani'],year:'2018',set:'Topps Series 2',number:'700',
 parallel:'Base',photoPose:'pitching',...claims}});
const base=row('synthetic-base'),factory=row('synthetic-factory',{parallel:'Factory Complete Set Variation',photoPose:'batting'});
const make=(search,options={})=>createCatalogPreviewHandler({env,clock:()=>now,loadSaved,contract:{...contract,search},...options});

test('configuration does not enable live calls without reviewed transport and separate entitlement',async()=>{
 assert.equal(catalogConfiguration(env).status,'catalog_contract_unverified');
 assert.equal(catalogConfiguration({...env,THE_CARD_API_CATALOG_KEY:env.THE_CARD_API_KEY},contract).status,'catalog_credentials_missing_or_not_separate');
 assert.equal(catalogConfiguration({...env,GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE:'unknown'},
  {...contract,search(){}}).status,'catalog_entitlement_unverified');
 const status=await request(createCatalogPreviewHandler({env,clock:()=>now,loadSaved}));
 assert.equal(status.code,503);
 assert.deepEqual(status.body,{error:'catalog_contract_unverified'});
});
test('rejects foreign owners, invalid origins, incorrect branches and unreviewed searches before transport',async()=>{
 const never=()=>assert.fail('unexpected catalog call');
 const handler=make(never);
 assert.equal((await request(handler,{headers:{...headers,origin:'https://example.invalid'}})).code,404);
 assert.equal((await request(handler,{headers:{...headers,cookie:''}})).code,403);
 assert.equal((await request(handler,{headers:{...headers,authorization:'Bearer other'}})).code,401);
 assert.equal((await request(handler,{body:{...body,confirmed:false}})).code,400);
 assert.equal((await request(handler,{body:{...body,url:'https://example.invalid'}})).code,400);
 assert.equal((await request(make(never,{env:{...env,VERCEL_ENV:'production'}}))).code,404);
});
test('reviewed boundary normalizes bounded base and factory variants without upgrading physical evidence',async()=>{
 let calls=0;
 const handler=make(async({identity,key,signal,maxRecords})=>{
  calls++;
  assert.equal(key,env.THE_CARD_API_CATALOG_KEY);
  assert.equal(maxRecords,20);
  assert.equal(signal.aborted,false);
  assert.deepEqual(identity.subjects,['Shohei Ohtani']);
  assert.equal(identity.photoPose,'pitching');
  assert.equal(identity.manufacturer,'Topps');
  return Response.json({records:[base,factory]});
 });
 const result=await request(handler);
 assert.equal(result.code,200);
 assert.equal(result.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.equal(result.body.result.status,'exact_catalog_variant_supported');
 assert.equal(result.body.result.physicalPrintingVerified,false);
 assert.equal(result.body.result.authorizesValuation,false);
 assert.equal(result.body.result.candidates[1].compatible,false);
 assert.doesNotMatch(JSON.stringify(result.body),/synthetic-separate-catalog-key|synthetic-sales-key/);
 assert.equal((await request(handler)).code,429);
 assert.equal(calls,1);
 const unknown=await request(make(()=>Response.json({records:[base,factory]}),{loadSaved:async()=>({report:{payload:{
  ...payload,canonicalCard:{...payload.canonicalCard,parallel:null},
 }}})}),{body:{reportId,confirmed:true}});
 assert.equal(unknown.body.result.status,'ambiguous_catalog_variants');
});
test('provider permission, quota, malformed rows, identifiers and response bounds fail closed',async()=>{
 const invalid=[{...base,identifiers:[{type:'URID',value:'https://example.invalid/id'}]},
  {...base,recordId:env.THE_CARD_API_CATALOG_KEY}];
 for(const [response,code,error] of [
  [new Response('',{status:401}),502,'catalog_provider_access_denied'],
  [new Response('',{status:429}),429,'catalog_quota'],
  [Response.json({records:{}}),502,'catalog_schema_invalid'],
  ...invalid.map(record=>[Response.json({records:[record]}),502,'catalog_schema_invalid']),
  [Response.json({records:Array(21).fill(base)}),502,'catalog_schema_invalid'],
  [new Response('a'.repeat(131073)),502,'catalog_schema_invalid'],
 ]){
  const result=await request(make(()=>response));
  assert.equal(result.code,code);
  assert.deepEqual(result.body,{error});
 }
});

test('catalog transport is aborted at its deadline without retrying',async()=>{
 let calls=0;
 let signal;
 const handler=make(options=>{
  calls++;
  signal=options.signal;
  return new Promise(()=>{});
 },{clock:()=>now+899997});
 const response=await request(handler);
 assert.equal(response.code,504);
 assert.deepEqual(response.body,{error:'catalog_timeout'});
 assert.equal(calls,1);
 assert.equal(signal.aborted,true);
});

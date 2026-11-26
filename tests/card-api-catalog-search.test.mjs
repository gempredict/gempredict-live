import assert from 'node:assert/strict';
import test from 'node:test';
import { createCardApiCatalogSearchContract,parseCardApiCatalogSearch } from '../lib/cardApiCatalogSearchContract.mjs';
import { catalogConfiguration,catalogResponseBranch } from '../lib/catalogPreviewConfiguration.mjs';
import { createCatalogPreviewHandler } from '../lib/catalogPreviewHandler.mjs';
import { authorizeDiagnosticOwner } from '../lib/scanDiagnosticsAuth.mjs';

const now=Date.parse('2026-11-26T12:00:00Z');
const host='gempredict-live-synthetic.vercel.app';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:host,VERCEL_GIT_COMMIT_REF:catalogResponseBranch,
 VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),
 VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',
 GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32),
 GEMPREDICT_CARD_API_CATALOG_PREVIEW_ENABLED:'true',THE_CARD_API_CATALOG_KEY:'synthetic-catalog-key',
 THE_CARD_API_KEY:'synthetic-sales-key',GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE:'synthetic-owner-approval',
 GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_TIER:'builder_catalog',GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_VERIFIED_UNTIL:'2026-12-01T00:00:00Z'};
const headers={host,origin:'https://'+host,authorization:'Bearer owner'};
headers.cookie=authorizeDiagnosticOwner({method:'POST',headers},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,now).split(';')[0];

// Fields follow the owner-supplied official search example. IDs and rows are synthetic.
const record={ucid:'synthetic-ohtani-001',slug:'ohtani-700',set_usid:'synthetic-series-two',
 set_name:'Topps Series 2',parent_set_name:'Topps',card_number:'700',subject:'Shohei Ohtani',
 is_rookie:true,is_auto:false,print_run:null};
const fixture={data:[record,{ucid:'synthetic-unknown',subject:null,set_usid:null}],
 pagination:{total:21,page:1,limit:20,pages:2}};
const providerHeaders={'X-RateLimit-Limit':'500','X-RateLimit-Remaining':'498'};
const parse=value=>parseCardApiCatalogSearch(Buffer.from(JSON.stringify(value)),{
 now,headers:new Headers({...providerHeaders,'content-type':'application/json'}),entitlement:{tier:'builder_catalog'}});
const reportId='cd02a4a5-34f6-4b85-ac52-fbee0b0fbe1a';
const payload={canonicalCard:{subject:'Shohei Ohtani',year:'2018',brandSet:'Topps Series 2',cardNumber:'700',parallel:'Base'},
 identityV2:{category:'sports'}};

test('documented fields preserve exact typed IDs, nullable values and incomplete pages',()=>{
 const result=parse(fixture);
 assert.deepEqual(result.pagination,{...fixture.pagination,incomplete:true});
 assert.deepEqual(result.quota,{scope:'catalog',limit:500,remaining:498,documentedDailyLimit:500});
 assert.deepEqual(result.records[0].identifiers,[{type:'UCID',value:record.ucid},{type:'USID',value:record.set_usid}]);
 assert.equal(result.records[0].claims.parallel,undefined);
 assert.equal(result.records[0].claims.year,undefined);
 assert.equal(result.records[0].claims.printRun,null);
 assert.equal(result.records[0].claims.autograph,false);
 assert.deepEqual(result.records[1].identifiers,[{type:'UCID',value:'synthetic-unknown'}]);
});
test('malformed fields, duplicate identifiers and inconsistent pagination fail closed',()=>{
 for(const row of [{...record,ucid:null},{...record,subject:['Ohtani']},{...record,is_auto:0},{...record,print_run:'100'},
  {...record,set_usid:'https://example.invalid'},{...record,card_number:700}]){
  assert.throws(()=>parse({...fixture,data:[row]}));
 }
 assert.throws(()=>parse({...fixture,data:[record,record]}));
 assert.throws(()=>parse({...fixture,pagination:{...fixture.pagination,pages:1}}));
 assert.throws(()=>parse({...fixture,pagination:{...fixture.pagination,limit:21}}));
});

test('explicit owner request uses reviewed transport and yields catalog evidence without exact printing or valuation',async()=>{
 let calls=0;
 const contract=createCardApiCatalogSearchContract({fetchImpl:async(url,options)=>{
  calls++;
  assert.equal(url.pathname,'/api/v1/catalog');
  assert.equal(url.searchParams.get('card_number'),'700');
  assert.equal(options.headers['x-api-key'],env.THE_CARD_API_CATALOG_KEY);
  assert.equal(options.cache,'no-store');
  return Response.json(fixture,{headers:providerHeaders});
 }});
 const handler=createCatalogPreviewHandler({env,contract,clock:()=>now,loadSaved:async()=>({report:{payload}})});
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.value=value;}};
 await handler({method:'POST',headers,body:{reportId,confirmed:true}},res);
 assert.equal(res.code,200);
 assert.equal(calls,1);
 assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.equal(res.value.result.exactCatalogVariantSupported,false);
 assert.equal(res.value.result.physicalPrintingVerified,false);
 assert.equal(res.value.result.authorizesValuation,false);
 assert.equal(res.value.result.candidates.length,2);
 assert.equal(res.value.result.rows.length,0);
 assert.equal(res.value.pagination.incomplete,true);
 assert.doesNotMatch(JSON.stringify(res.value),/synthetic-catalog-key|synthetic-owner-approval/);
});
test('registered response branch still requires a separate credential and dated Catalog approval',()=>{
 assert.equal(catalogConfiguration(env,undefined,now).status,'ready');
 for(const patch of [{GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_TIER:'free'},
  {GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_VERIFIED_UNTIL:'2026-11-25T00:00:00Z'},
  {GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE:''},
  {GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_VERIFIED_UNTIL:''}]){
  assert.equal(catalogConfiguration({...env,...patch},undefined,now).status,'catalog_entitlement_unverified');
 }
 assert.equal(catalogConfiguration({...env,THE_CARD_API_CATALOG_KEY:env.THE_CARD_API_KEY},undefined,now).status,'catalog_credentials_missing_or_not_separate');
 assert.equal(catalogConfiguration({...env,VERCEL_GIT_COMMIT_REF:'feature/catalog-rest-adapter-phase5o'},undefined,now).status,'catalog_contract_unverified');
});

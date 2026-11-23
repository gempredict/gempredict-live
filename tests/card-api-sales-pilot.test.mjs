import { compareScanSale, extractScanSalesIdentity, prepareScanSalesQuery } from '../lib/scanToSalesIdentity.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeDiagnosticOwner } from '../lib/scanDiagnosticsAuth.mjs';
import { cardApiPilotPage, createCardApiPilotHandler } from '../lib/cardApiSalesPilot.mjs';

const now=Date.parse('2026-11-22T15:00:00Z');
const host='gempredict-live-pilot123.vercel.app';
const env={
  VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:host,VERCEL_GIT_COMMIT_REF:'feature/cardapi-sales-pilot-phase5d',
  VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',
  VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',
  GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),
  GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32),GEMPREDICT_CARD_API_FREE_PILOT_ENABLED:'true',
  THE_CARD_API_KEY:'synthetic-provider-secret',
};
const headers={host,origin:'https://'+host};
headers.cookie=authorizeDiagnosticOwner({method:'POST',headers},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,now).split(';')[0];
const query={q:'"Synthetic Collector" #8B-11',cohort:'PSA 9',category:'sports',dateFrom:'2026-11-20',dateTo:'2026-11-22'};
const sale={
  id:'ebay:synthetic-1',platform:'ebay',title:'Synthetic test fixture',sales_channel:null,listing_type:'best_offer',
  sale_date:'2026-11-21',price:null,original_price:999,shipping_price:null,currency:'USD',price_confirmed:false,
  grade:'9',grader:'PSA',category:'sports',card_number:'8B-11',
  listing_url:'https://example.invalid/private',image_url:'https://example.invalid/private-image',cert:'synthetic-private-cert',
};
const wrapper=(rows=[sale])=>({data:rows,pagination:{total:rows.length,has_more:false},meta:{coverage_date_from:'2026-11-20',coverage_date_to:'2026-11-22'}});
async function request(handler,patch={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await handler({method:'POST',headers,body:query,...patch},res);
 return res;
}
const make=(fetchImpl,environment=env)=>createCardApiPilotHandler({env:environment,clock:()=>now,fetchImpl});

test('Preview branch, feature switch, same-origin owner session and secret all gate the pilot',async()=>{
 const noFetch=()=>assert.fail('provider call not permitted');
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'feature/saved-reports-phase5c'},{GEMPREDICT_CARD_API_FREE_PILOT_ENABLED:''}]){
  assert.equal(cardApiPilotPage({method:'GET',headers},{...env,...patch},now),null);
  assert.equal((await request(make(noFetch,{...env,...patch}))).code,404);
 }
 assert.deepEqual(cardApiPilotPage({method:'GET',headers},env,now),{today:'2026-11-22',earliest:'2026-10-24'});
 assert.equal((await request(make(noFetch),{headers:{...headers,cookie:''}})).code,403);
 assert.equal((await request(make(noFetch),{headers:{...headers,origin:'https://other.invalid'}})).code,404);
 assert.equal((await request(make(noFetch,{...env,THE_CARD_API_KEY:''}))).code,503);
 assert.equal((await request(make(noFetch),{method:'GET'})).code,405);
});

test('each explicit cohort uses one bounded, documented request and sales quota headers',async()=>{
 for(const cohort of ['Raw','PSA 8','PSA 9','PSA 10']){
  const calls=[];
  const result=await request(make(async(url,options)=>{
   calls.push(url);
   assert.equal(url.origin+url.pathname,'https://www.thecardapi.com/api/v1/market/sales');
   assert.equal(url.searchParams.get('limit'),'20');
   assert.equal(url.searchParams.get('page'),'1');
   assert.equal(url.searchParams.get('date_from'),query.dateFrom);
   assert.equal(url.searchParams.get('date_to'),query.dateTo);
   assert.equal(url.searchParams.get('q'),query.q);
   assert.equal(url.searchParams.get('graded'),cohort==='Raw'?'false':'true');
   assert.equal(url.searchParams.get('grader'),cohort==='Raw'?null:'PSA');
   assert.equal(url.searchParams.get('grade'),cohort==='Raw'?null:cohort.slice(4));
   assert.equal(url.searchParams.has('cursor'),false);
   assert.equal(options.headers['x-market-api-key'],env.THE_CARD_API_KEY);
   assert.equal(options.redirect,'error');
   assert.equal(options.cache,'no-store');
   assert.ok(options.signal instanceof AbortSignal);
   return Response.json(wrapper([]),{headers:{'X-RateLimit-Remaining':'4980','X-RateLimit-Limit':'5000'}});
  }),{body:{...query,cohort}});
  assert.equal(result.code,200);
  assert.equal(calls.length,1);
  assert.equal(result.body.quota.remaining,'4980');
  assert.equal(result.headers['Cache-Control'],'private, no-store, max-age=0');
 }
});

test('rejects unsafe, out-of-lookback, invalid calendar and excessive date/price requests before fetch',async()=>{
 const noFetch=()=>assert.fail('provider call not permitted');
 for(const invalid of [
  {q:'abc'},{q:'https://other.invalid'},{cohort:'PSA 7'},{category:'pokemon'},
  {dateFrom:'2026-10-23'},{dateFrom:'2026-11-19'},{dateTo:'2026-11-23'},
  {dateFrom:'2026-02-30'},{dateFrom:'2026-11-22',dateTo:'2026-11-21'},
  {priceMin:'11',priceMax:'10'},{priceMin:'-1'},{card_id:'synthetic'},{page:2},
 ]) assert.equal((await request(make(noFetch),{body:{...query,...invalid}})).code,400);
});

test('ephemeral candidates omit asking price and private URLs, and fail Phase 3G rights, identity and settlement checks',async()=>{
 const rows=[
  sale,
  {...sale,id:'goldin:synthetic-2',platform:'goldin',price:80,price_confirmed:true,shipping_price:0},
  {...sale,id:'ebay:synthetic-3',grade:'10',title:env.THE_CARD_API_KEY},
  {...sale,id:'ebay:synthetic-duplicate'},
  {...sale,id:'ebay:synthetic-duplicate'},
 ];
 const r=await request(make(async()=>Response.json(wrapper(rows))));
 assert.equal(r.code,200);
 assert.equal(r.body.candidates.length,2);
 assert.equal(r.body.rejected.length,3);
 assert.equal(r.body.qualifiedCount,0);
 assert.equal(r.body.candidates[0].price,null);
 assert.equal(r.body.candidates[0].shipping,null);
 assert.equal(r.body.candidates[1].amountReportedConfirmed,true);
 assert.equal(r.body.candidates[1].shipping,0);
 for(const row of r.body.candidates){
  for(const reason of ['commercial_use_not_authorized','settlement_evidence_missing','single_card_quantity_not_established','price_inclusions_unknown','sale_product_link_unverified']) assert.ok(row.qualificationReasons.includes(reason));
 }
 assert.ok(r.body.rejected[0].reasons.includes('grade_mismatch_or_qualifier'));
 assert.ok(r.body.rejected.slice(1).every(row=>row.reasons.includes('repeated_provider_record_id')));
 assert.doesNotMatch(JSON.stringify(r.body),/999|private|original_price|synthetic-provider-secret|synthetic-private-cert/);
});

test('schema differences disclose only expected field paths and observed types',async()=>{
 const r=await request(make(async()=>Response.json(wrapper([{...sale,price:'private-provider-value'}]))));
 assert.deepEqual(r.body,{error:'schema_difference',differences:[{field:'data[0].price',expected:'number or null',received:'string'}]});
 const invalid=await request(make(async()=>Response.json({sales:[]})));
 assert.equal(invalid.body.error,'schema_difference');
 assert.deepEqual(invalid.body.differences.map(row=>row.field),['data','pagination','meta']);
});

test('quota failures do not retry or expose upstream messages, and body and row budgets fail closed',async()=>{
 let calls=0;
 const limited=await request(make(async()=>{
  calls++;
  return new Response('private quota detail',{status:429,headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':'2026-11-23T00:00:00Z'}});
 }));
 assert.equal(limited.code,429);assert.equal(calls,1);assert.equal(limited.body.quota.remaining,'0');
 assert.doesNotMatch(JSON.stringify(limited.body),/private/);
 const tooMany=await request(make(async()=>Response.json(wrapper(Array(21).fill(sale)))));
 assert.equal(tooMany.body.error,'row_budget_exceeded');
 const large=await request(make(async()=>new Response('x'.repeat(131073),{headers:{'Content-Type':'application/json'}})));
 assert.equal(large.body.error,'response_too_large');
});

test('an overlapping owner request cannot create a second upstream request in the same instance',async()=>{
 let release;
 let calls=0;
 const handler=make(async()=>{
  calls++;
  await new Promise(resolve=>{release=resolve;});
  return Response.json(wrapper([]));
 });
 const first=request(handler);
 const second=await request(handler);
 assert.equal(second.code,429);
 assert.equal(second.body.error,'pilot_busy');
 release();
 assert.equal((await first).code,200);
 assert.equal(calls,1);
});

const savedId='aaaaaaaa-0000-4000-8000-000000000001';
const sportReport={
  identityV2:{category:'sports',identityVerified:false,printingVerified:false},
  canonicalCard:{subject:'Synthetic Collector',year:'2025',brandSet:'Synthetic Set',cardNumber:'8B-11',
    manufacturer:'Synthetic Manufacturer',subset:'Synthetic Insert',parallel:'Blue Refractor',printRun:'99',autoOrRelic:'Autograph no relic'},
  originalIdentityObservation:{identifiedSerialNumber:'7/99'},
  imageAnalysis:{observedFoilTreatment:'Holo'},
  sportsIdentityEvidence:{subjects:[{name:'Synthetic Collector'}],subjectStatus:'supported_observations'},
  catalogComparison:{finalConflicts:['parallel'],printing:{status:'conflict'}},
};
const target=extractScanSalesIdentity(sportReport).identity;
const exactTitle='2025 Synthetic Collector Synthetic Set #8B-11 Synthetic Insert Blue Refractor Holo autograph no relic';
const exactRow={title:exactTitle,year:'2025',set:'Synthetic Set',manufacturer:'Synthetic Manufacturer',
 cardNumber:'8B-11',player:'Synthetic Collector',printRun:'99',grader:'PSA',grade:'9'};

test('saved identity preserves uncertainty and requires explicit review for unresolved or multi-player cards',()=>{
 const extracted=extractScanSalesIdentity(sportReport);
 assert.equal(extracted.identity.serial,'7/99');
 assert.equal(extracted.identity.printRun,'99');
 assert.ok(extracted.requiresReview);
 assert.ok(extracted.conflicts.includes('catalog: parallel'));
 assert.equal(prepareScanSalesQuery(sportReport,undefined,false).error,'owner_identity_review_required');
 const prepared=prepareScanSalesQuery(sportReport,undefined,true);
 assert.equal(prepared.q,'"Synthetic Collector" "2025" "Synthetic Set" "8B-11" "Synthetic Insert" "Blue Refractor" "Synthetic Manufacturer"');
 assert.equal(prepared.ownerReviewed,true);
 assert.ok(!Object.hasOwn(prepared.identity,'verified'));
 const multi={...sportReport,canonicalCard:{...sportReport.canonicalCard,subject:'Synthetic Collector / Second Player'},
  sportsIdentityEvidence:{subjects:[{name:'Synthetic Collector'},{name:'Second Player'}],subjectStatus:'unresolved'}};
 assert.deepEqual(extractScanSalesIdentity(multi).identity.subjects,['Synthetic Collector','Second Player']);
 assert.equal(prepareScanSalesQuery(multi,undefined,false).error,'owner_identity_review_required');
 assert.equal(compareScanSale({...target,subjects:['Synthetic Collector','Second Player']},exactRow,'PSA 9').status,'plausible_unverified');
 assert.equal(compareScanSale(target,{...exactRow,player:'Synthetic Collector / Second Player'},'PSA 9').status,'mismatch');
});

test('per-field candidate audit distinguishes supported listing evidence, unknowns and contradictions',()=>{
 assert.equal(compareScanSale(target,exactRow,'PSA 9').status,'exact_listing_evidence');
 for(const [patch,field] of [
  [{year:'2024'},'year'],[{set:'Different Set'},'set'],[{cardNumber:'8B-12'},'card_number'],
  [{title:exactTitle.replace('Blue','Red')},'parallel'],[{grade:'10'},'grade'],
 ]) {
  const result=compareScanSale(target,{...exactRow,...patch},'PSA 9');
  assert.equal(result.status,'mismatch');
  assert.ok(result.mismatches.includes(field));
 }
 const sparse=compareScanSale(target,{...exactRow,year:null,cardNumber:null},'PSA 9');
 assert.equal(sparse.status,'plausible_unverified');
 assert.deepEqual(sparse.unknown,['year','card_number']);
});

test('saved pilot rechecks ownership and review before one exact title query; provider metadata stays untrusted',async()=>{
 const environment={...env,VERCEL_GIT_COMMIT_REF:'feature/scan-to-sales-phase5e'};
 const scoped={host,origin:'https://'+host,authorization:'Bearer synthetic-owner-session'};
 scoped.cookie=authorizeDiagnosticOwner({method:'POST',headers:scoped},environment.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,environment,now).split(';')[0];
 const body={reportId:savedId,confirmed:true,cohort:query.cohort,dateFrom:query.dateFrom,dateTo:query.dateTo};
 let calls=0;
 const overrides={env:environment,clock:()=>now,
  loadSaved:async(req,id)=>{
   assert.equal(id,savedId);
   return req.headers.authorization===scoped.authorization?{status:200,report:{payload:sportReport}}:{status:404,error:'report_not_found'};
  },
  fetchImpl:async url=>{
   calls++;
   assert.equal(url.searchParams.get('q'),prepareScanSalesQuery(sportReport,undefined,true).q);
   assert.equal(url.searchParams.get('grade'),'9');
   assert.equal(url.searchParams.has('card_id'),false);
   const row={...sale,title:exactTitle,year:2025,card_set:'Synthetic Set',manufacturer:'Synthetic Manufacturer',
    player:'Synthetic Collector',print_run:99};
   return Response.json(wrapper([row,{...row,id:'other:synthetic',platform:'unknown_platform',currency:null,listing_type:'unknown_kind'}]));
  }};
 const handler=createCardApiPilotHandler(overrides);
 assert.equal((await request(handler,{headers:{...scoped,authorization:'Bearer another-account'},body})).code,404);
 assert.equal((await request(handler,{headers:scoped,body:{...body,confirmed:false}})).body.error,'owner_identity_review_required');
 assert.equal((await request(handler,{headers:scoped,body:{...body,q:'manually injected'}})).code,400);
 assert.equal(calls,0);
 const result=await request(handler,{headers:scoped,body});
 assert.equal(result.code,200);
 assert.equal(calls,1);
 assert.equal(result.body.candidates[0].identityMatch.status,'exact_listing_evidence');
 assert.equal(result.body.candidates[0].price,null);
 assert.ok(result.body.candidates[0].qualificationReasons.includes('settlement_evidence_missing'));
 assert.equal(result.body.qualifiedCount,0);
 assert.ok(result.body.rejected[0].reasons.includes('platform_unsupported'));
 assert.ok(result.body.rejected[0].reasons.includes('currency_missing'));
 assert.ok(result.body.rejected[0].reasons.includes('listing_type_unsupported'));
 assert.doesNotMatch(JSON.stringify(result.body),/unknown_platform|unknown_kind|original_price|synthetic-owner-session/);
});

import {planSalesWindows,mergeLookbackBatch} from '../lib/salesLookback.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createActiveMarketHandler } from '../lib/activeMarketPilot.mjs';
import { cardApiPilotPage,createCardApiPilotHandler } from '../lib/cardApiSalesPilot.mjs';
import { providerFinalPrice,summarizeRecentSales } from '../lib/marketEvidenceSummary.mjs';
import { authorizeDiagnosticOwner } from '../lib/scanDiagnosticsAuth.mjs';
import { renderMarketEvidence } from './helpers/renderReports.mjs';

const now=Date.parse('2026-11-23T12:00:00Z');
const host='gempredict-live-synthetic-deployment.vercel.app';
const env={
 VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:host,VERCEL_GIT_COMMIT_REF:'feature/qualified-market-comparables-phase5k',
 VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),
 VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',
 GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),
 GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32),GEMPREDICT_CARD_API_FREE_PILOT_ENABLED:'true',
 THE_CARD_API_KEY:'synthetic-card-api-secret',EBAY_PROD_CLIENT_ID:'synthetic-client-id',EBAY_PROD_CLIENT_SECRET:'synthetic-client-secret',
};
const headers={host,origin:'https://'+host,authorization:'Bearer synthetic.owner.token'};
headers.cookie=authorizeDiagnosticOwner({method:'POST',headers},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,now).split(';')[0];
const reportId='cd02a4a5-34f6-4b85-ac52-fbee0b0fbe1a';
const input={reportId,cohort:'Raw',confirmed:true};
const salesInput={...input,dateFrom:'2026-11-21',dateTo:'2026-11-23'};
const title='2018 Topps Series 2 Shohei Ohtani #700';
const report=Object.freeze({payload:Object.freeze({
 canonicalCard:Object.freeze({subject:'Shohei Ohtani',year:'2018',manufacturer:'Topps',brandSet:'Topps Series 2',cardNumber:'700',parallel:'Base'}),
 identityV2:{category:'sports'},
})});
const loadSaved=async(req,id)=>req.headers.authorization!==headers.authorization?{status:401,error:'library_sign_in_required'}:
 id!==reportId?{status:404,error:'report_not_found'}:{report};
const opts={env,clock:()=>now,loadSaved};
async function request(handler,body,patch={}) {
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.body=data;return this;}};
 await handler({method:'POST',headers,body,...patch},res);
 return res;
}

// Synthetic records modeled on the three observed outcomes. No provider data retained.
const saleFixture={platform:'eBay',listing_type:'best_offer',title,sale_date:'2026-11-22',
 price:null,original_price:995,price_confirmed:false,shipping_price:null,currency:'USD',category:'sports',
 year:2018,manufacturer:'Topps',card_set:'Topps Series 2',card_number:'700',player:'Shohei Ohtani'};
const observed=[
 {...saleFixture,id:'synthetic-offer-1'},
 {...saleFixture,id:'synthetic-offer-2',price:999},
 {...saleFixture,id:'synthetic-fixed',listing_type:'fixed_price',price:120,price_confirmed:true},
];
const wrongCards=[
 [title.replace('2018','2019'),'year'],
 [title.replace('Series 2','Update'),'set'],
 [title.replace('#700','#701'),'card_number'],
 [title+' Gold Parallel','parallel'],
 [title+' Photo Variation','photo_variation'],
 [title+' PSA 9','grade'],
];
const browseItem=(itemTitle,index)=>({title:itemTitle,itemId:`v1|1234567890${index}|0`,
 price:{value:'175.00',currency:'USD'},buyingOptions:['FIXED_PRICE'],
 itemWebUrl:`https://www.ebay.com/itm/1234567890${index}?tracking=synthetic`});

async function lookupSales(records, overrides={}) {
 let calls=0;
 const handler=createCardApiPilotHandler({...opts,fetchImpl:async(url,options)=>{
  calls++;
  assert.equal(url.pathname,'/api/v1/market/sales');
  assert.equal(url.searchParams.get('q'),'Shohei Ohtani 2018 700');
  assert.equal(options.cache,'no-store');
  return Response.json({data:records,pagination:{total:records.length},meta:{}});
 }});
 const res=await request(handler,{...salesInput,...overrides});
 assert.equal(calls,1);
 assert.equal(res.code,200);
 assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
 return res.body;
}
async function lookupBrowse(fixtures,overrides={}) {
 const calls=[];
 const items=[title,...wrongCards.map(([value])=>value)].map(browseItem);
 items.push({...browseItem(title,9),itemWebUrl:'https://example.invalid/itm/12345678909',buyingOptions:['AUCTION']});
 const handler=createActiveMarketHandler({...opts,fetchImpl:async(url,options)=>{
  calls.push(String(url));
  assert.equal(options.cache,'no-store');
  assert.equal(options.redirect,'error');
  if (String(url).includes('/oauth2/token')) return Response.json({access_token:'synthetic-ebay-access'});
  const endpoint=new URL(url);
  assert.equal(endpoint.pathname,'/buy/browse/v1/item_summary/search');
  assert.equal(endpoint.searchParams.get('limit'),'20');
  assert.equal(endpoint.searchParams.get('q'),'Shohei Ohtani 2018 700');
  return Response.json({itemSummaries:fixtures||items});
 }});
 const res=await request(handler,{...input,...overrides});
 assert.equal(res.code,200);
 assert.equal(calls.length,2);
 assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
 return res.body;
}

test('Ohtani benchmark retains a provider-reported $120 fixed price and two unknown offers',async()=>{
 const result=await lookupSales(observed);
 assert.deepEqual(result.candidates.map(providerFinalPrice),[null,null,120]);
 assert.deepEqual(result.candidates.map(row=>row.price),[null,null,120]);
 const {qualificationBlockers,...counts}=summarizeRecentSales(result);
 assert.deepEqual(counts,{recordsRetrieved:3,plausibleMatches:3,identityMismatches:0,knownFinalPrices:1,unknownFinalPrices:2});
 assert.ok(qualificationBlockers.includes('commercial_use_not_authorized'));
 assert.equal(result.qualifiedCount,0);
 assert.equal(result.identityEvidence.version,1);
 assert.equal(result.comparableEvidence.version,1);
 assert.equal(result.comparableEvidence.counts.restricted,3);
 assert.equal(result.comparableEvidence.counts.qualified,0);
 assert.deepEqual(result.comparableEvidence.rows.map(row=>row.finalAmountStatus),['unknown','unknown','provider_reported']);
 assert.equal(result.identityEvidence.physicalPrinting.status,'unverified');
 assert.doesNotMatch(JSON.stringify(result),/995|999|median|profit|synthetic-card-api-secret/);
});
test('both providers reject explicit year, set, collector number, parallel, photo variation and grade conflicts',async()=>{
 const sales=await lookupSales(wrongCards.map(([title],i)=>({...saleFixture,title,id:'wrong-'+i})));
 assert.equal(sales.candidates.length,0);
 assert.equal(summarizeRecentSales(sales).identityMismatches,wrongCards.length);
 const active=await lookupBrowse();
 assert.deepEqual(active.rows[0].ask,{amount:'175.00',currency:'USD'});
 assert.equal(active.rows[0].link,'https://www.ebay.com/itm/12345678900');
 assert.ok(active.rows[0].identityMatch.matched.includes('card_number'));
 wrongCards.forEach(([,field],i)=>{
  assert.ok(sales.rejected[i].identityMatch.mismatches.includes(field));
  assert.ok(active.rows[i+1].identityMatch.mismatches.includes(field));
 });
 assert.equal(active.rows.at(-1).link,null);
 assert.equal(active.rows.at(-1).ask,null);
});
test('both endpoints deny unauthorized, foreign and unreviewed saved-card requests before provider access',async()=>{
 for(const [create,body] of [[createActiveMarketHandler,input],[createCardApiPilotHandler,salesInput]]) {
  const fetchImpl=()=>assert.fail('provider called without authorized owned report');
  const handler=create({...opts,fetchImpl});
  assert.equal((await request(handler,body,{headers:{...headers,origin:'https://other.invalid'}})).code,404);
  assert.equal((await request(handler,body,{headers:{...headers,cookie:''}})).code,403);
  assert.equal((await request(handler,body,{headers:{...headers,authorization:'Bearer synthetic.other.token'}})).code,401);
  assert.equal((await request(handler,{...body,reportId:'df02a4a5-34f6-4b85-ac52-fbee0b0fbe1a'})).code,404);
  assert.equal((await request(handler,{...body,confirmed:false})).code,400);
  assert.equal((await request(create({...opts,env:{...env,VERCEL_ENV:'production'},fetchImpl}),body)).code,404);
 }
 assert.equal(cardApiPilotPage({method:'GET',headers},env,now).unified,true);
 assert.equal(report.payload.canonicalCard.parallel,'Base');
 assert.deepEqual(Object.keys(report.payload),['canonicalCard','identityV2']);
});
test('market renderer separates active asking prices, reported final prices and unknown Best Offers',async()=>{
 const html=await renderMarketEvidence(await lookupBrowse(),await lookupSales(observed));
 assert.match(html,/Active Listings — eBay/);
 assert.match(html,/Comparable-sales qualification/);
 assert.match(html,/Commercially restricted/);
 assert.match(html,/Recent Sales — The Card API/);
 assert.match(html,/Asking price: USD 175.00/);
 assert.match(html,/Provider-reported final price: USD 120. Settlement unverified/);
 assert.equal((html.match(/Final price unknown/g)||[]).length,2);
 assert.equal((html.match(/ · Best Offer · /g)||[]).length,2);
 assert.match(html,/Fixed-price/);
 assert.match(html,/Identity mismatch/);
 assert.doesNotMatch(html,/995|999|tracking=|example.invalid/);
});

test('Ohtani printing comparison uses explicit factory, photo, numbered and short-print evidence',async()=>{
 const cases=[
  ['Regular Base Pitching Photo', 'matched','exact_printing'],
  ['Factory Complete Set Variation', 'mismatches','factory_set'],
  ['Batting Photo', 'mismatches','photo_variation'],
  ['Photo Variation', 'mismatches','photo_variation'],
  ['Short Print', 'mismatches','short_print'],
  ['Numbered 12/99', 'mismatches','print_run'],
  ['Refractor', 'mismatches','parallel'],
  ['Complete Your Set', 'unknown','exact_printing'],
  ['Variation?', 'unknown','exact_printing'],
  ['Not a Factory Set Variation', 'unknown','exact_printing'],
  ['Regular Base', 'unknown','exact_printing'],
  ['', 'unknown','exact_printing'],
 ];
 const overrides={reviewedIdentity:{photoPose:'pitching'}};
 const browse=await lookupBrowse(cases.map(([suffix],i)=>browseItem(title+' '+suffix,i)),overrides);
 const sales=await lookupSales(cases.map(([suffix],i)=>({...saleFixture,id:'printing-'+i,title:title+' '+suffix})),overrides);
 const rows=[...sales.candidates,...sales.rejected].sort((a,b)=>a.index-b.index);
 cases.forEach(([suffix,bucket,field],i)=>{
  for(const row of [browse.rows[i],rows[i]]) {
   assert.ok(row.identityMatch[bucket].includes(field),suffix+' '+JSON.stringify(row.identityMatch));
   assert.equal(row.identityMatch.status==='mismatch',bucket==='mismatches',suffix);
  }
 });
 const html=await renderMarketEvidence(browse,sales);
 assert.match(html,/Different factory complete-set printing/);
 assert.match(html,/Different photo variation/);
 assert.match(html,/Exact printing unconfirmed/);
 assert.match(html,/<summary>Identity evidence<\/summary>/);
});

test('both sources separate explicit Raw, unknown grade and grading company or score conflicts',async()=>{
 const cases=[
  ['Ungraded','Listed as Raw','matched'],
  ['Raw','Listed as Raw','matched'],
  ['PSA Graded','Graded · exact grade unknown','mismatch'],
  ['', 'Grade status unknown','unknown'],
  ['PSA 9','PSA 9','mismatch'],
  ['BGS 9.5','BGS 9.5','mismatch'],
 ];
 const browse=await lookupBrowse(cases.map(([suffix],i)=>browseItem(title+' '+suffix,i)));
 const sales=await lookupSales(cases.map(([suffix],i)=>({...saleFixture,id:'grade-'+i,title:title+' '+suffix})));
 const rows=[...sales.candidates,...sales.rejected].sort((a,b)=>a.index-b.index);
 cases.forEach(([,label,status],i)=>{
  for(const row of [browse.rows[i],rows[i]]) assert.deepEqual(row.identityMatch.gradeEvidence,{label,status});
 });
 assert.match(await renderMarketEvidence(browse,sales),/Graded PSA 9, not Raw/);

 const psaTitles=['PSA 8','PSA 9','PSA 10','SGC 10',''];
 const psaBrowse=await lookupBrowse(psaTitles.map((suffix,i)=>browseItem(title+' '+suffix,i)),{cohort:'PSA 10'});
 const psaSales=await lookupSales(psaTitles.map((suffix,i)=>({...saleFixture,id:'psa-'+i,title:title+' '+suffix,
  ...(suffix.startsWith('PSA')?{grader:'PSA',grade:suffix.slice(4)}:{})})),{cohort:'PSA 10'});
 const psaRows=[...psaSales.candidates,...psaSales.rejected].sort((a,b)=>a.index-b.index);
 const expected=['mismatch','mismatch','matched','mismatch','unknown'];
 assert.deepEqual(psaBrowse.rows.map(row=>row.identityMatch.gradeEvidence.status),expected);
 assert.deepEqual(psaRows.map(row=>row.identityMatch.gradeEvidence.status),expected);
 assert.equal(psaSales.qualifiedCount,0);
 assert.equal(psaBrowse.rows[4].identityMatch.status,'plausible_unverified');
});

const lookbackEnv={...env,VERCEL_GIT_COMMIT_REF:'feature/live-catalog-integration-phase5n'};
const pack=(data,has_more=false,remaining='50')=>Response.json({
 data,pagination:{total:data.length,has_more},meta:{},
},{headers:{'X-RateLimit-Remaining':remaining}});
function lookbackClient(fetchImpl,settings={}) {
 let time=now;
 const calls=[];
 const handler=createCardApiPilotHandler({...opts,env:lookbackEnv,clock:()=>time,...settings,
  fetchImpl:(url,options)=>{
   assert.equal(url.searchParams.get('limit'),'20');
   assert.equal(options.redirect,'error');
   assert.equal(options.cache,'no-store');
   calls.push(url);
   return fetchImpl(url,options,calls.length);
  }});
 return {calls,advance(ms=2100){time+=ms;},request:(patch={},requestPatch={})=>request(handler,{...input,...patch},requestPatch)};
}

test('planning spans year and leap-month boundaries with at most three dates and no overlap',()=>{
 const windows=planSalesWindows(Date.parse('2028-01-01T00:00:00Z'));
 assert.equal(windows.length,10);
 assert.deepEqual(windows[0],{dateFrom:'2027-12-30',dateTo:'2028-01-01'});
 assert.equal(windows.at(-1).dateFrom,'2027-12-03');
 for(let i=1;i<windows.length;i++)assert.equal(Date.parse(windows[i-1].dateFrom)-Date.parse(windows[i].dateTo),86400000);
 assert.deepEqual(planSalesWindows(Date.parse('2028-03-01T23:59:59Z'),4),[
  {dateFrom:'2028-02-28',dateTo:'2028-03-01'},{dateFrom:'2028-02-27',dateTo:'2028-02-27'},
 ]);
 assert.throws(()=>planSalesWindows(now,31));
});

test('owner advances explicit two-window batches with honest coverage and a ten-call cap',async()=>{
 const service=lookbackClient((url,_options,index)=>{
  const date=url.searchParams.get('date_to');
  if(index===1)return pack(observed.map(row=>({...row,sale_date:'2026-11-21'})));
  if(index===3)return pack([{...observed[2],sale_date:date},{...saleFixture,id:'wrong-parallel',sale_date:date,title:title+' Gold Refractor'}]);
  return pack([]);
 });
 let result=await service.request();
 assert.equal(result.code,200);
 assert.equal(result.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.equal(service.calls.length,2);
 assert.equal(result.body.lookback.earliestChecked,'2026-11-18');
 assert.equal(result.body.lookback.latestChecked,'2026-11-23');
 assert.deepEqual(result.body.lookback.windows.slice(0,3).map(w=>w.status),['successful','empty','unsearched']);
 assert.equal(result.body.lookback.complete,false);
 assert.deepEqual(result.body.comparableEvidence.rows.map(row=>row.finalAmountStatus),['unknown','unknown','provider_reported']);
 assert.ok(result.body.comparableEvidence.rows.every(row=>row.settlementStatus==='unverified'));
 let cumulative=mergeLookbackBatch(null,result.body);
 const firstCursor=result.body.continuation;
 assert.equal((await service.request({continuation:firstCursor})).code,429);
 service.advance();
 assert.equal((await service.request({continuation:firstCursor,cohort:'PSA 9'})).code,400);
 assert.equal((await service.request({continuation:firstCursor+'x'})).code,400);
 for(let batch=1;batch<5;batch++){
  result=await service.request({continuation:result.body.continuation});
  assert.equal(result.code,200);
  cumulative=mergeLookbackBatch(cumulative,result.body);
  service.advance();
 }
 assert.equal(service.calls.length,10);
 assert.equal(cumulative.lookback.earliestChecked,'2026-10-25');
 assert.equal(cumulative.lookback.complete,true);
 assert.equal(cumulative.lookback.recordsRetrieved,5);
 assert.equal(cumulative.continuation,null);
 assert.equal(cumulative.candidates.filter(row=>row.suspectedDuplicate).length,2);
 assert.ok(cumulative.rejected.some(row=>row.identityMatch.mismatches.includes('parallel')));
 assert.equal(cumulative.comparableEvidence.counts.qualified,0);
 assert.equal(cumulative.economicsReadiness.status,'withheld');
 assert.ok(cumulative.economicsReadiness.blockers.includes('independent_physical_printing_unverified'));
 assert.ok(cumulative.economicsReadiness.blockers.includes('commercial_rights_unverified'));
 assert.equal(cumulative.comparableEvidence.readiness.automaticEconomicsAllowed,false);
 assert.equal((await service.request()).code,429);
 assert.equal((await service.request({continuation:firstCursor})).code,409);
 assert.doesNotMatch(JSON.stringify(cumulative),/synthetic-card-api-secret|original_price|995|999/);
});

test('provider stop conditions preserve prior success and leave older windows unsearched',async()=>{
 for(const [code,reason] of [[401,'provider_authentication'],[403,'provider_entitlement'],[429,'provider_quota'],[200,'schema_difference']]){
  const service=lookbackClient((_url,_options,i)=>i===1?pack([]):Response.json({}, {status:code}));
  const response=await service.request();
  assert.equal(service.calls.length,2);
  assert.equal(response.body.lookback.stopped,reason);
  assert.deepEqual(response.body.lookback.windows.slice(0,3).map(x=>x.status),['empty','failed','unsearched']);
  assert.equal(response.body.continuation,null);
 }
 const exhausted=lookbackClient(()=>pack([],false,'0'));
 const result=await exhausted.request();
 assert.equal(exhausted.calls.length,1);
 assert.equal(result.body.lookback.stopped,'provider_quota');
 assert.equal(result.body.lookback.windows[1].status,'unsearched');
 assert.equal(result.body.continuation,null);
});

test('provider timeout and expired owner cannot yield stale or automatic retries',async()=>{
 const service=lookbackClient((_url,{signal})=>new Promise((_,reject)=>{
  signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
 }),{clock:()=>now+899999});
 // The real request signal expires in one millisecond. Keep the test loop alive.
 const keepAlive=setTimeout(()=>{},100);
 try {
  const result=await service.request();
  assert.equal(result.body.lookback.windows[0].status,'failed');
  assert.equal(result.body.lookback.stopped,'provider_timeout');
  assert.equal(service.calls.length,1);
 } finally {clearTimeout(keepAlive);}
 const expired=lookbackClient(()=>assert.fail('expired owner contacted provider'));
 expired.advance(900001);
 const response=await expired.request();
 assert.equal(response.code,403);
 assert.equal(expired.calls.length,0);
});

test('only an absent confirmation field is compatible, preserving safe Ohtani evidence and unknown price',async()=>{
 const {price_confirmed:discarded,...absent}=observed[2];
 const service=lookbackClient((_url,_options,i)=>i===1?pack([
  {...absent,id:'synthetic-missing',price:98765},
  {...observed[2]},
  {...saleFixture,id:'synthetic-explicit-false',price:98765},
  {...absent,id:'synthetic-wrong-parallel',title:title+' Gold Refractor'},
  {...absent,id:'synthetic-wrong-source',platform:'Unknown market'},
  {...absent,id:'synthetic-invalid-date',sale_date:'2026-11-31'},
  {...absent,id:'synthetic-unsafe-title',title:'https://example.invalid/private'},
  {...absent,id:'synthetic-invalid-currency',currency:['USD']},
 ]):pack([]));
 const result=await service.request();
 assert.equal(result.code,200);
 const {lookback,comparableEvidence,candidates,rejected}=result.body;
 assert.equal(lookback.recordsRetrieved,8);
 assert.equal(lookback.missingPriceConfirmation,6);
 assert.deepEqual(lookback.windows.slice(0,3).map(window=>window.status),['successful','empty','unsearched']);
 assert.equal(lookback.complete,false);
 assert.ok(result.body.continuation);
 assert.deepEqual(candidates.map(row=>row.priceConfirmationStatus),['unknown','reported_confirmed','reported_unconfirmed']);
 assert.deepEqual(candidates.map(row=>row.amountReportedConfirmed),[null,true,false]);
 assert.deepEqual(candidates.map(providerFinalPrice),[null,120,null]);
 assert.equal(candidates[0].title,title);
 assert.equal(candidates[0].platform,'ebay');
 assert.equal(candidates[0].sold,'2026-11-22');
 assert.ok(rejected.some(row=>row.identityMatch.mismatches.includes('parallel')));
 for(const reason of ['platform_unsupported','sale_date_invalid','title_unsupported','currency_invalid_type'])
  assert.ok(rejected.some(row=>row.reasons.includes(reason)),reason);
 assert.ok(comparableEvidence.rows[0].reasons.includes('provider_price_confirmation_missing'));
 assert.equal(comparableEvidence.rows[0].finalAmountStatus,'unknown');
 assert.equal(comparableEvidence.rows[0].reportedAmount,null);
 assert.equal(comparableEvidence.rows[1].settlementStatus,'unverified');
 assert.equal(comparableEvidence.counts.qualified,0);
 assert.equal(result.body.economicsReadiness.status,'withheld');
 assert.doesNotMatch(JSON.stringify(result.body),/98765|example.invalid/);
 const html=await renderMarketEvidence({rows:[],cohort:'Raw'},result.body);
 assert.match(html,/6 records arrived without the documented price confirmation field/);
 assert.match(html,/Final price unknown. Provider confirmation field missing/);
 service.advance();
 const next=await service.request({continuation:result.body.continuation});
 assert.equal(next.body.lookback.windows[3].status,'empty');
 assert.equal(next.body.lookback.windows[4].status,'unsearched');
 assert.equal(next.body.lookback.missingPriceConfirmation,6);
});

test('explicit null and wrong confirmation types fail their window and preserve checked windows only',async()=>{
 for(const value of [null,'true',0,[]]){
  const {price_confirmed:discarded,...absent}=observed[2];
  const service=lookbackClient((url,_options,i)=>{
   const sale_date=url.searchParams.get('date_to');
   if(i===1)return pack([{...absent,sale_date}],true);
   if(i===2)return pack([]);
   return pack([{...observed[2],sale_date,price_confirmed:value}]);
  });
  const first=await service.request();
  assert.equal(first.body.lookback.windows[0].truncated,true);
  service.advance();
  const result=await service.request({continuation:first.body.continuation});
  assert.equal(service.calls.length,3);
  const cumulative=mergeLookbackBatch(first.body,result.body);
  assert.equal(cumulative.candidates.length,1);
  assert.deepEqual(cumulative.lookback.windows.slice(0,4).map(window=>window.status),['successful','empty','failed','unsearched']);
  assert.equal(cumulative.lookback.earliestChecked,'2026-11-18');
  assert.equal(cumulative.lookback.complete,false);
  assert.equal(cumulative.lookback.stopped,'schema_difference');
  assert.equal(cumulative.continuation,null);
  assert.deepEqual(cumulative.differences,[{field:'data[0].price_confirmed',expected:'boolean',
   received:value===null?'null':Array.isArray(value)?'array':typeof value}]);
 }
});

test('Phase 5M preserves missing prices and separates explicit sale outcomes in a lookback batch',async()=>{
 const {price_confirmed:omitted,...missing}=observed[2];
 const service=lookbackClient((_url,_options,i)=>i===1?pack([
  {...missing,id:'synthetic-missing-offer',sale_type:'accepted_offer'},
  {...observed[2],sale_type:'fixed_price'},
  {...observed[2],id:'synthetic-unknown-outcome',sale_type:'other',price:555},
 ]):pack([]));
 const result=await service.request();
 assert.equal(result.code,200);
 assert.equal(result.body.crosswalk.status,'catalog_provider_not_configured');
 assert.equal(result.body.crosswalk.physicalPrintingVerified,false);
 assert.ok(result.body.continuation);
 assert.deepEqual(result.body.comparableEvidence.rows.map(row=>row.finalAmountStatus),['unknown','provider_reported','unknown']);
 assert.ok(result.body.comparableEvidence.rows.every(row=>row.reasons.includes('reviewed_exact_sale_catalog_link_missing')));
 assert.equal(result.body.candidates[0].listingType,'fixed_price');
 assert.equal(result.body.candidates[0].transactionType,'accepted_offer');
 assert.equal(result.body.candidates[0].price,null);
 assert.ok(result.body.rejected[0].reasons.includes('unsupported_sale_type'));
 assert.equal(result.body.candidates[1].price,120);
 assert.equal(result.body.comparableEvidence.rows[1].settlementStatus,'unverified');
 assert.equal(result.body.comparableEvidence.counts.qualified,0);
 assert.equal(result.body.economicsReadiness.automaticEconomicsAllowed,false);
 assert.doesNotMatch(JSON.stringify(result.body),/555/);
 const html=await renderMarketEvidence({rows:[],cohort:'Raw'},result.body);
 assert.match(html,/Catalog provider not configured/);
 assert.match(html,/Accepted offer/);
});

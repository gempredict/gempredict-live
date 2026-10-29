import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {COVERAGE_APPROVAL,CASES,runCoverage,summarizeCoverage,candidateMatch,gradeClassification} from '../scripts/the-card-api/coverage.mjs';
import {APPROVAL,SCHEMA_APPROVAL,BROAD_SCHEMA_APPROVAL,REDIRECT_APPROVAL,approvedContext,claimRun,requestOnce,readQuotaHeaders,ENDPOINT} from '../scripts/the-card-api/verify.mjs';
const now=Date.parse('2026-10-29T23:00:00Z');
const row=(c,i=0,patch={})=>({id:'SYNTHETIC-'+i,platform:'TCGplayer',listing_type:'fixed_price',title:`${c.subject} - ${c.cardNumber} - ${c.aliases[0]} - Holofoil`,sale_date:'2026-10-29',sold_at:'2026-10-29T00:00:00Z',price:40,original_price:null,currency:'USD',price_confirmed:true,card_set:c.aliases[0],card_number:c.cardNumber,grade:null,grader:null,...patch});
const body=rows=>({data:rows,pagination:{total:2105,page:1,limit:25,pages:85,next_cursor:'PRIVATE CURSOR'},meta:{coverage_date_from:'2026-10-27',coverage_date_to:'2026-10-29'}});
const env=()=>({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'gempredict/gempredict-live',GITHUB_REF:'refs/heads/restore/phase1-identity-market-matching',GITHUB_RUN_ATTEMPT:'1',CARD_MODE:'dry-run',CARD_APPROVAL:COVERAGE_APPROVAL,CARD_OWNER_ID:'123',GITHUB_ACTOR_ID:'123',GITHUB_RUN_ID:'123',GITHUB_SHA:'a'.repeat(40),RUNNER_TEMP:'/tmp'});
test('three fixed searches, exactly one GET per case, 25/page and 75 total, no cursor or grade-union invention',async()=>{
 let calls=0;const r=await runCoverage('mock',{now,request:async(u,key,options)=>{
  const c=CASES[calls++];assert.equal(u.origin+u.pathname,ENDPOINT);assert.equal(key,'mock');assert.deepEqual(options,{includeQuota:true});assert.equal(u.searchParams.get('q'),c.q);assert.equal(u.searchParams.get('limit'),'25');assert.equal(u.searchParams.get('page'),'1');assert.equal(u.searchParams.get('sort'),'date_desc');assert.equal(u.searchParams.has('cursor'),false);assert.equal(u.searchParams.get('grade'),c.id==='C'?'10':null);
  if(c.id==='C'){assert.equal(u.searchParams.get('grader'),'PSA');assert.equal(u.searchParams.get('graded'),'true');assert.equal(u.searchParams.get('grade'),'10');}
  return {status:200,body:body(Array.from({length:25},(_,i)=>row(c,i))),quota:{remaining:4200,limit:5000,reset:1793318400}};
 }});
 assert.equal(calls,3);assert.equal(r.status,'three_searches_completed');assert.equal(r.acceptedRows,75);assert.equal(r.requests.length,3);
 for(const e of r.requests){assert.equal(e.coverage.returned,25);assert.equal(e.coverage.reportedTotalMatches,2105);assert.equal(e.coverage.pagination.hasMore,true);assert.equal(e.coverage.pagination.additionalPagesFetched,0);assert.equal(e.coverage.priceStatistics.median,null);assert.equal(e.coverage.valuationApproved,false);assert.equal(e.quota.dailySalesRowsRemaining,4200);}
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE CURSOR|SYNTHETIC-/);
});
test('empty pages still make all three planned searches; missing indicator and lookback stay unknown',async()=>{
 let calls=0;const r=await runCoverage('mock',{now,request:async()=>{calls++;return {status:200,body:{data:[],pagination:{total:0,page:1,limit:25},meta:{}}};}});
 assert.equal(calls,3);assert.equal(r.acceptedRows,0);
 for(const e of r.requests){assert.equal(e.coverage.pagination.hasMore,null);assert.equal(e.coverage.lookback.effectivePlanDays,null);assert.equal(e.coverage.lookback.historyComplete,false);assert.equal(e.coverage.allReturned.saleDateRange,null);assert.equal(e.quota.dailySalesRowsRemaining,null);}
});
test('row/size/schema failures never silently truncate, retry, broaden or continue',async()=>{
 for(const b of [body(Array.from({length:26},(_,i)=>row(CASES[0],i))),{data:[]},body([row(CASES[0],0,{price_confirmed:undefined})])]){
  let calls=0;const r=await runCoverage('mock',{now,request:async()=>{calls++;return {status:200,body:b};}});assert.equal(calls,1);assert.equal(r.status,'stopped_schema_or_row_bound_failure');assert.equal(r.acceptedRows,0);
 }
});
test('HTTP, redirect, transport, quota failures stop without retry or extra probes; missing credential makes zero calls',async()=>{
 let calls=0;await runCoverage('',{request:async()=>{calls++;}});assert.equal(calls,0);
 for(const status of [301,307,401,403,429,500]){calls=0;const r=await runCoverage('mock',{request:async()=>{calls++;return {status,error:'PRIVATE RAW FAILURE',quota:{remaining:0}};}});assert.equal(calls,1);assert.equal(r.requests[0].httpStatus,status);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);}
 const r=await runCoverage('mock',{request:async()=>{throw Error('PRIVATE EXCEPTION');}});assert.equal(r.requests.length,1);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('candidate identity counts are separate from wrong collector numbers, sets, languages and printings',()=>{
 for(const c of CASES){assert.equal(candidateMatch(row(c),c),true);for(const patch of [{card_number:'999/999'},{card_set:'Other set'},{language:'Japanese'},{parallel:'Reverse Holofoil'},{title:row(c).title+' Japanese'},{title:row(c).title+' 150/128'},{player:'Other subject'}])assert.equal(candidateMatch(row(c,0,patch),c),false,JSON.stringify(patch));}
 const c=CASES[1],r=summarizeCoverage(body([row(c),row(c,1,{card_number:'150/128'})]),c,now);assert.equal(r.candidateExactCardMatches,1);assert.equal(r.unmatchedPool.returned,1);assert.equal(r.independentlyVerifiedExactMatches,0);
});
test('provider grade fields and title/condition inference are distinct; null grade, qualifiers and conflicts remain unknown',()=>{
 const base=row(CASES[2]);
 assert.deepEqual(gradeClassification({...base,grade:'9',grader:'PSA'}),{group:'PSA 9',basis:'provider_structured_not_independently_verified'});
 assert.equal(gradeClassification({...base,title:base.title+' PSA 10'}).basis,'title_inferred');
 assert.equal(gradeClassification({...base,condition:'Raw ungraded'}).basis,'label_inferred');
 assert.equal(gradeClassification({...base,condition:'Near Mint'}).group,'unknown');
 for(const patch of [{grade:'9',grader:'PSA',title:base.title+' PSA 10'},{grade:'9.5',grader:'BGS'},{grade:'10',grader:'PSA',has_grade_qualifier:true},{grade:'10',grader:'PSA',has_autograph_grade:true}])assert.equal(gradeClassification({...base,...patch}).group,'unknown');
 const r=summarizeCoverage(body([{...base,grade:'9',grader:'PSA'},{...base,title:base.title+' PSA 10'},{...base,condition:'Raw ungraded'}]),CASES[2],now);assert.equal(r.candidatePool.grades['PSA 9'].providerStructured,1);assert.equal(r.candidatePool.grades['PSA 10'].inferred,1);assert.equal(r.candidatePool.grades.raw.inferred,1);assert.equal(r.candidatePool.grades.raw.independentlyVerified,0);
});
test('price counts never substitute asks; validated price ranges/medians remain withheld and invalid dates are counted',()=>{
 const c=CASES[1];const r=summarizeCoverage(body([row(c),row(c,1,{price:null,original_price:999,price_confirmed:false,listing_type:'best_offer'}),row(c,2,{sold_at:'2099-01-01T00:00:00Z'})]),c,now);
 assert.equal(r.candidatePool.prices.providerConfirmed,1);assert.equal(r.candidatePool.prices.unconfirmed,2);assert.equal(r.candidatePool.prices.acceptedOffersAmountUnknown,1);assert.equal(r.candidatePool.invalidCompletionDates,1);assert.equal(r.priceStatistics.range,null);assert.equal(r.priceStatistics.median,null);assert.equal(r.priceStatistics.validatedComparableCount,0);assert.equal(r.commercialDisplayEnabled,false);assert.doesNotMatch(JSON.stringify(r),/999/);
});
test('source and duplicate summaries never publish raw IDs, URLs, seller details, product identifiers or cursor contents',()=>{
 const c=CASES[1],r=summarizeCoverage(body([row(c,0,{id:'PRIVATE ID',seller:'PRIVATE SELLER',listing_url:'https://www.tcgplayer.com/product/123?token=PRIVATE',product_id:'PRIVATE PRODUCT'}),row(c,0,{id:'PRIVATE ID',listing_url:'https://www.tcgplayer.com/product/123'}),row(c,1,{listing_url:'https://www.ebay.com/itm/123456789012'})]),c,now);
 assert.equal(r.candidatePool.sources.available,3);assert.equal(r.candidatePool.sources.publicCatalogRoutes,1);assert.equal(r.candidatePool.sources.publicListingRoutes,1);assert.equal(r.candidatePool.deduplication.repeatedProviderIds,1);assert.doesNotMatch(JSON.stringify(r),/PRIVATE|https:|123456789012/);
});
test('quota whitelist accepts numeric counters only and never echoes arbitrary headers',()=>{
 assert.deepEqual(readQuotaHeaders({'x-ratelimit-limit':'5000','x-ratelimit-remaining':'123','x-ratelimit-reset':'1793318400',authorization:'PRIVATE'}),{limit:5000,remaining:123,reset:1793318400});
 for(const v of ['-1','Infinity','PRIVATE','123\nsecret',['123'],'1234567890123'])assert.equal(readQuotaHeaders({'x-ratelimit-remaining':v}).remaining,null);
});
test('native quota-enabled transport sends one authenticated GET and rejects redirects without forwarding credentials',async t=>{
 let calls=0;t.mock.method(https,'request',(u,opts,callback)=>{calls++;assert.equal(u.origin+u.pathname,ENDPOINT);assert.equal(opts.method,'GET');assert.equal(opts.headers['x-market-api-key'],'mock');const req=new EventEmitter();req.end=()=>{const res=new EventEmitter();res.statusCode=307;res.headers={location:'https://private.example','x-ratelimit-remaining':'4000'};res.destroy=()=>{};callback(res);};return req;});
 const r=await requestOnce(new URL(ENDPOINT),'mock',{includeQuota:true});assert.equal(calls,1);assert.equal(r.status,307);assert.equal(r.quota.remaining,4000);assert.equal(r.body,undefined);assert.doesNotMatch(JSON.stringify(r),/private/);
});
test('coverage phrase is unique; owner, repository, branch, manual dispatch, first attempt and sentinel safeguards remain',()=>{
 assert.ok(![APPROVAL,SCHEMA_APPROVAL,BROAD_SCHEMA_APPROVAL,REDIRECT_APPROVAL].includes(COVERAGE_APPROVAL));approvedContext(env(),COVERAGE_APPROVAL);
 for(const patch of [{CARD_APPROVAL:APPROVAL},{CARD_MODE:'smoke'},{GITHUB_EVENT_NAME:'push'},{GITHUB_REPOSITORY:'fork/repo'},{GITHUB_REF:'refs/heads/main'},{GITHUB_ACTOR_ID:'999'},{GITHUB_RUN_ATTEMPT:'2'}])assert.throws(()=>approvedContext({...env(),...patch},COVERAGE_APPROVAL));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'coverage-test-'));try{claimRun({...env(),RUNNER_TEMP:dir},COVERAGE_APPROVAL);assert.throws(()=>claimRun({...env(),RUNNER_TEMP:dir},COVERAGE_APPROVAL));}finally{fs.rmSync(dir,{recursive:true});}
});
test('workflow reuses registered inputs, pinned actions and one secret in a separate bounded coverage job',()=>{
 const y=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8'),job=y.split('\n  the-card-api-coverage:')[1].split('\n  the-card-api-sales:')[0];
 for(const text of [COVERAGE_APPROVAL,"inputs.mode == 'dry-run'","github.repository == 'gempredict/gempredict-live'","github.ref == 'refs/heads/restore/phase1-identity-market-matching'","github.actor_id == vars.VISION_BENCH_OWNER_ID","github.run_attempt == 1",'environment: vision-benchmark','timeout-minutes: 3','persist-credentials: false'])assert.ok(job.includes(text));
 assert.equal((job.match(/secrets\./g)||[]).length,1);assert.ok(job.includes('secrets.THE_CARD_API_KEY'));assert.doesNotMatch(job,/ANTHROPIC|OPENAI|GEMINI|upload-artifact|npm ci/);
 assert.match(y,/permissions:\n  contents: read/);for(const m of job.matchAll(/uses: (\S+)/g))assert.match(m[1],/@[a-f0-9]{40}$/);
});
test('quota-enabled transport preserves HTTP 200 on a non-JSON failure without reading the body',async t=>{
 t.mock.method(https,'request',(u,opts,callback)=>{const req=new EventEmitter();req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/html','x-ratelimit-remaining':'123'};res.destroy=()=>{};callback(res);};return req;});
 const r=await requestOnce(new URL(ENDPOINT),'mock',{includeQuota:true});assert.equal(r.status,200);assert.equal(r.error,'non_json');assert.equal(r.quota.remaining,123);assert.equal(r.body,undefined);
});
test('broad retrieval moves number/set/grade title constraints out of full-text queries',async()=>{
 assert.deepEqual(CASES.map(c=>c.q),['"Charizard ex"','"Pikachu ex"','"Pikachu ex"']);
 assert.deepEqual(CASES[2].filters,{graded:'true',grader:'PSA',grade:'10'});
 let calls=0;await runCoverage('mock',{now,request:async u=>{const c=CASES[calls++];assert.equal(u.searchParams.get('sort'),'date_desc');assert.equal(u.searchParams.get('page'),'1');assert.equal(u.searchParams.has('cursor'),false);assert.ok(!u.searchParams.get('q').includes(c.cardNumber));assert.ok(!u.searchParams.get('q').includes(c.brandSet));return {status:200,body:{data:[],pagination:{total:0,page:1,limit:25},meta:{}}};}});assert.equal(calls,3);
});
test('three observed 149/128 candidates survive local candidate screening, never verified printing or valuation',async()=>{
 // Owner-supplied observation facts only; no IDs, exact timestamps, product,
 // language or printing crosswalk values are fabricated to fill missing fields.
 const observed=[27.99,47.99,43.49].map(price=>({title:'Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil',platform:'TCGplayer',sale_date:'2026-10-29',price,currency:'USD',price_confirmed:true,listing_type:'fixed_price'}));
 const {adaptTheCardApi,PIKACHU_TARGET}=await import('../lib/providers/theCardApiAdapter.mjs');
 assert.equal(CASES[1].q,'"Pikachu ex"');assert.equal(observed.filter(r=>candidateMatch(r,CASES[1])).length,3);
 const a=adaptTheCardApi(observed,PIKACHU_TARGET,{now,coverage:{lookbackDays:3}});assert.deepEqual(a.transactions.map(r=>r.amount),[27.99,47.99,43.49]);assert.ok(a.transactions.every(r=>r.identity.status==='unresolved'&&r.settlement.independentlyVerified===false));assert.equal(a.valuationApproved,false);assert.equal(a.evidence.groups.unknown.windows[30].median,null);
});
test('broad retrieval does not relax strict local subject, number, set, language, or ambiguous-variant screening',()=>{
 const c=CASES[1];for(const patch of [{title:'Mega Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil'},{card_number:'149/129'},{card_set:'Other set'},{language:'Japanese'},{printing:'Reverse Holofoil'},{printing:'Cosmos Holo'},{variant:{finish:'reverse'}}])assert.equal(candidateMatch(row(c,0,patch),c),false);
 const r=summarizeCoverage(body([row(c),row(c,1,{variant:{ambiguous:true}}),row(c,2,{card_number:'150/128'})]),c,now);
 assert.deepEqual(r.localIdentityStatus,{candidateUnverified:1,ambiguous:1,otherOrConflicting:1,verified:0});assert.equal(r.ambiguousPool.returned,1);assert.equal(r.unmatchedPool.returned,1);assert.equal(r.priceStatistics.median,null);assert.equal(r.reportedTotalMatches,2105);assert.equal(r.pagination.hasMore,true);assert.equal(r.pagination.complete,false);
});
test('new broad authorization cannot be replayed using the old narrow benchmark phrase',()=>{
 assert.notEqual(COVERAGE_APPROVAL,'AUTHORIZE_THE_CARD_API_THREE_SEARCHES_75_ROWS');assert.throws(()=>approvedContext({...env(),CARD_APPROVAL:'AUTHORIZE_THE_CARD_API_THREE_SEARCHES_75_ROWS'},COVERAGE_APPROVAL));
 const y=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');const job=y.split('\n  the-card-api-coverage:')[1].split('\n  the-card-api-sales:')[0];assert.ok(job.includes(COVERAGE_APPROVAL));assert.equal(job.includes("'AUTHORIZE_THE_CARD_API_THREE_SEARCHES_75_ROWS'"),false);
});
test('newest-first requests preserve actual transaction time ranges and independently check structured grade filters',()=>{
 const c=CASES[2];const r=summarizeCoverage(body([row(c,0,{grade:'10',grader:'PSA',sold_at:'2026-10-29T12:34:56Z'}),row(c,1,{grade:'9',grader:'PSA',sale_date:'2026-10-28',sold_at:'2026-10-28T07:08:09Z'}),row(c,2)]),c,now);
 assert.deepEqual(r.allReturned.saleTimestampRange,{oldest:'2026-10-28T07:08:09Z',newest:'2026-10-29T12:34:56Z'});
 assert.deepEqual(r.structuredFilterEvidence,{requestedGrader:'PSA',requestedGrade:'10',matchingProviderFields:1,missingProviderFields:1,conflictingProviderFields:1});assert.equal(r.independentlyVerifiedExactMatches,0);assert.equal(r.priceStatistics.median,null);
 const tainted=summarizeCoverage(body([row(c,0,{sold_at:'2026-10-29T00:00:00Z PRIVATE'})]),c,now);assert.equal(tainted.allReturned.saleTimestampRange,null);assert.doesNotMatch(JSON.stringify(tainted),/PRIVATE/);
});

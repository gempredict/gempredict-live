// Mocked transport/schema/security contracts only. No provider calls or live claims.
import test from 'node:test';import https from 'node:https';import {EventEmitter} from 'node:events';import assert from 'node:assert/strict';import fs from 'node:fs';
import {approvedContext,APPROVAL,selectCard,summarizePricing,executeAccessTest,requestOnce} from '../scripts/cardsight/access.mjs';
const id='00000000-0000-4000-8000-000000000149';
const card=()=>({id,name:'Pikachu ex',number:'149/128',releaseYear:'2026',setName:'Special Illustration Rare',releaseName:'30th Celebration',fields:[{key:'CARD_LANGUAGE',value:'en'},{key:'RARITY',value:'Special illustration rare'}]});
const catalog=()=>({cards:[card()],total_count:1});
const row=(listing_type='auction')=>({title:'2026 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare',price:12.34,date:'2026-09-20',source:'ebay',listing_type,url:'https://www.ebay.com/itm/123456789012?secret=must-not-publish',parallel_name:'Holo'});
const pricing=()=>({card:{card_id:id,name:'Pikachu ex',number:'149/128',set:{year:'2026',release:'30th Celebration',name:'Special Illustration Rare'}},raw:{count:2,records:[row(),row('fixed')]},graded:[{company_name:'PSA',grades:[{grade_value:'9',count:1,records:[row()]},{grade_value:'10',count:0,records:[]}]},{company_name:'BGS',grades:[{grade_value:'9.5',count:1,records:[row()]}]}]});
const context=()=>({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'gempredict/gempredict-live',GITHUB_REF:'refs/heads/restore/phase1-identity-market-matching',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123',GITHUB_SHA:'a'.repeat(40),GITHUB_ACTOR_ID:'42',CARDSIGHT_OWNER_ID:'42',CARDSIGHT_MODE:'dry-run',CARDSIGHT_APPROVAL:APPROVAL});
test('admission restricts repository, branch, owner, dispatch, attempt and separate approval',()=>{
 approvedContext(context());
 for(const patch of [{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/main'},{GITHUB_ACTOR_ID:'43'},{CARDSIGHT_OWNER_ID:''},{GITHUB_EVENT_NAME:'push'},{GITHUB_RUN_ATTEMPT:'2'},{CARDSIGHT_APPROVAL:'AUTHORIZE_SMOKE_0_75_USD'},{CARDSIGHT_MODE:'smoke'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'}])assert.throws(()=>approvedContext({...context(),...patch}));
});
test('exact catalog identity requires explicit language/rarity and rejects wrong denominator, set and ambiguity',()=>{
 assert.equal(selectCard(catalog()).cardId,id);
 for(const change of [{number:'149/165'},{releaseYear:'2023'},{releaseName:'Surging Sparks',setName:'Base Set'},{fields:[]},{fields:[{key:'CARD_LANGUAGE',value:'ja'},{key:'RARITY',value:'SIR'}]},{variationOf:'x',id:'unsafe'}])assert.equal(selectCard({cards:[{...card(),...change}],total_count:1}).cardId,null);
 assert.equal(selectCard({...catalog(),total_count:2}).cardId,null);
 assert.equal(selectCard({cards:[card(),{...card(),id:'00000000-0000-4000-8000-000000000150'}],total_count:2}).cardId,null);
});
test('two successful mocked requests use documented endpoints and never identify/AI or follow alternative cards',async()=>{
 const calls=[];const result=await executeAccessTest('mock-test-only',{request:async(url,key)=>{calls.push(url.href);assert.equal(key,'mock-test-only');return {status:200,body:calls.length===1?catalog():pricing()};}});
 assert.equal(calls.length,2);assert.match(calls[0],/^https:\/\/api.cardsight.ai\/v1\/catalog\/cards\?/);assert.match(calls[1],new RegExp('/v1/pricing/'+id+'\\?period=90d&listing_type=both$'));
 assert.equal(result.status,'pricing_response_observed');assert.equal(result.pricing.acceptedForValuation,0);
});
test('missing key, first HTTP/network/JSON failure and incomplete identity stop without retry',async()=>{
 let calls=0;await executeAccessTest('',{request:()=>{calls++;}});assert.equal(calls,0);
 for(const first of [{status:401,error:'http_error'},{error:'network_or_tls_failed'},{status:302,error:'redirect_rejected'},{status:200,error:'malformed_json'},{status:200,body:{cards:[],total_count:0}}]){
  calls=0;const result=await executeAccessTest('mock',{request:async()=>{calls++;return first;}});assert.equal(calls,1);assert.equal(result.requests.length,1);
 }
});
test('second failure consumes at most two requests with no fallback/retry',async()=>{
 let calls=0;const result=await executeAccessTest('mock',{request:async()=>++calls===1?{status:200,body:catalog()}:{status:429,error:'http_error'}});
 assert.equal(calls,2);assert.equal(result.status,'pricing_request_failed');assert.equal(result.requests[1].httpStatus,429);
});
test('provider auctions stay separate from asks, unknown types, other graders and unverified printing',()=>{
 const data=pricing();data.raw.records.push(row('unknown'));data.raw.count++;
 const r=summarizePricing(data,id,Date.parse('2026-10-29'));
 assert.equal(r.groups.raw.providerReportedCompletedAuctions,1);assert.equal(r.groups.raw.askingPrices,1);assert.equal(r.groups.raw.unclassified,1);
 assert.equal(r.groups['PSA 9'].returned,1);assert.equal(r.groups['PSA 10'].returned,0);assert.equal(r.otherGradeRecords,1);
 assert.equal(r.printingVariantMatchingVerified,false);assert.equal(r.acceptedForValuation,0);assert.equal(r.groups.raw.samples[0].priceUSD,12.34);
 assert.equal(r.groups.raw.samples[0].sourceUrl,'https://www.ebay.com/itm/123456789012');assert.doesNotMatch(JSON.stringify(r),/must-not-publish/);
 assert.equal(summarizePricing({...data,card:{...data.card,card_id:'different'}},id).status,'pricing_identity_or_schema_unverified');
});
test('unknown sensitive provider fields and malformed dates/links are never copied into output',()=>{
 const d=pricing();Object.assign(d.raw.records[0],{url:'https://user:password@www.ebay.com/itm/123456789012',date:'credential-data',apiKey:'must-not-publish',price:NaN});
 const r=summarizePricing(d,id);assert.equal(r.groups.raw.samples[0].sourceUrl,null);assert.equal(r.groups.raw.samples[0].date,null);assert.equal(r.groups.raw.samples[0].priceUSD,null);assert.doesNotMatch(JSON.stringify(r),/password|credential-data|must-not-publish/);
});
test('workflow reuses registered input schema and isolates the only CardSight secret from paid vision',()=>{
 const yaml=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');const job=yaml.split('\n  cardsight-access:')[1];
 assert.ok(job);for(const value of ["inputs.mode == 'dry-run'",APPROVAL,"github.run_attempt == 1","github.actor_id == vars.VISION_BENCH_OWNER_ID","environment: vision-benchmark","persist-credentials: false"])assert.ok(job.includes(value));
 assert.equal((job.match(/secrets\./g)||[]).length,1);assert.doesNotMatch(job,/ANTHROPIC|OPENAI|GEMINI|upload-artifact|npm ci/);
 const source=fs.readFileSync('scripts/cardsight/access.mjs','utf8');assert.doesNotMatch(source,/console\.(?:log|error)\(key|headers\)|response\.headers\)/);assert.match(source,/fs\.openSync\(sentinel,'wx'/);
});

test('native transport sends one HTTPS GET with header authentication and rejects redirects without following',async t=>{
 let calls=0;
 t.mock.method(https,'request',(url,options,callback)=>{
  calls++;assert.equal(url.origin,'https://api.cardsight.ai');assert.equal(options.method,'GET');assert.equal(options.headers['X-API-Key'],'mock-only');assert.equal(options.agent,false);assert.ok(!url.href.includes('mock-only'));
  const req=new EventEmitter();req.destroy=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=302;res.headers={location:'https://unapproved.invalid/'};res.destroy=()=>{};callback(res);};return req;
 });
 const result=await requestOnce(new URL('https://api.cardsight.ai/v1/catalog/cards'),'mock-only');
 assert.equal(calls,1);assert.equal(result.error,'redirect_rejected');
});
test('wrong pricing set, future/invalid dates and schema drift cannot become usable sale evidence',()=>{
 const p=pricing();p.card.set.year='2023';assert.equal(summarizePricing(p,id).status,'pricing_identity_or_schema_unverified');
 for(const date of ['2026-02-30','2099-01-01']){const d=pricing();d.raw.records[0].date=date;assert.equal(summarizePricing(d,id,Date.parse('2026-10-29')).groups.raw.samples[0].date,null);}
 assert.equal(summarizePricing({card:{card_id:id}},id).status,'pricing_identity_or_schema_unverified');
});

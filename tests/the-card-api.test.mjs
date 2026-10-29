import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {APPROVAL,ENDPOINT,EXACT,BROAD,approvedContext,claimRun,exactCandidate,summarize,verify,requestOnce,redact} from '../scripts/the-card-api/verify.mjs';
const now=Date.parse('2026-10-29T20:00:00Z');
const row=(changes={})=>({id:'ebay-123456789012',platform:'eBay',title:'2026 Pokémon 30th Celebration Pikachu ex #149/128 SIR',listing_type:'fixed_price',sale_date:'2026-10-28',sold_at:'2026-10-28T00:00:00Z',price:80,original_price:100,price_confirmed:true,currency:'USD',listing_url:'https://www.ebay.com/itm/123456789012?secret=private',...changes});
const body=(rows=[])=>({data:rows,pagination:{total:rows.length,page:1,limit:25,has_more:false,next_cursor:null},meta:{}});
const context=()=>({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'gempredict/gempredict-live',GITHUB_REF:'refs/heads/restore/phase1-identity-market-matching',GITHUB_RUN_ATTEMPT:'1',CARD_MODE:'dry-run',CARD_APPROVAL:APPROVAL,CARD_OWNER_ID:'123',GITHUB_ACTOR_ID:'123',GITHUB_RUN_ID:'456',GITHUB_SHA:'a'.repeat(40),RUNNER_TEMP:'/tmp'});
test('authorization rejects non-owner/branch/manual context, retries, wrong approval and debug leakage',()=>{
 approvedContext(context());
 for(const change of [{GITHUB_ACTIONS:'false'},{GITHUB_EVENT_NAME:'push'},{GITHUB_REPOSITORY:'fork/example'},{GITHUB_REF:'refs/heads/main'},{GITHUB_RUN_ATTEMPT:'2'},{CARD_MODE:'smoke'},{CARD_APPROVAL:'yes'},{CARD_OWNER_ID:''},{GITHUB_ACTOR_ID:'999'},{GITHUB_RUN_ID:''},{GITHUB_SHA:''},{RUNNER_TEMP:''},{NODE_TLS_REJECT_UNAUTHORIZED:'0'},{NODE_DEBUG:'https'},{NODE_OPTIONS:'--inspect'}])assert.throws(()=>approvedContext({...context(),...change}));
});
test('sentinel prevents repeated invocation even after interruption',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'the-card-test-'));
 try{const e={...context(),RUNNER_TEMP:dir};claimRun(e);assert.throws(()=>claimRun(e));assert.equal(fs.statSync(path.join(dir,'the-card-api-456.attempted')).mode&0o777,0o600);}finally{fs.rmSync(dir,{recursive:true});}
});
test('exact completed match stops after one GET and uses documented query/auth path',async()=>{
 let calls=0;
 const report=await verify('mock',{now,request:async(u,k)=>{calls++;assert.equal(k,'mock');assert.equal(u.origin+u.pathname,ENDPOINT);assert.equal(u.searchParams.get('q'),EXACT);assert.equal(u.searchParams.get('limit'),'25');assert.equal(u.searchParams.get('page'),'1');assert.equal(u.searchParams.has('cursor'),false);return {status:200,body:body([row()])};}});
 assert.equal(calls,1);assert.equal(report.requests[0].result.confirmedExactSales,1);assert.equal(report.acceptedForValuation,0);
});
test('only one broader search follows no exact results, never a third or pagination',async()=>{
 for(const first of [[],[row({title:'2025 Pikachu ex 001/100'})]]){
  let calls=0;const report=await verify('mock',{now,request:async u=>{calls++;assert.equal(u.searchParams.get('q'),calls===1?EXACT:BROAD);const b=body(calls===1?first:[]);b.pagination.has_more=true;b.pagination.total=1000;return {status:200,body:b};}});
  assert.equal(calls,2);assert.equal(report.status,'sales_response_observed');assert.equal(report.requests.length,2);
 }
});
test('missing key, HTTP failures, thrown private errors and schema drift do not retry or broaden',async()=>{
 let calls=0;await verify('',{request:async()=>{calls++;}});assert.equal(calls,0);
 for(const response of [{status:401},{status:403},{status:429},{status:500},{error:'secret-error'},{status:200,body:{data:[]}}]){
  calls=0;const r=await verify('mock',{request:async()=>{calls++;return response;}});assert.equal(calls,1);assert.notEqual(r.status,'sales_response_observed');assert.doesNotMatch(JSON.stringify(r),/secret-error/);
 }
 const r=await verify('mock',{request:async()=>{throw Error('private-provider-error');}});assert.equal(r.status,'request_failed');assert.doesNotMatch(JSON.stringify(r),/private-provider-error/);
});
test('completed fixed-price, auctions, offers and asks remain separate',()=>{
 const s=summarize(body([row(),row({listing_type:'auction'}),row({listing_type:'best_offer'}),row({listing_type:'best_offer',price:null,price_confirmed:false}),row({price:100,price_confirmed:false})]),now);
 assert.equal(s.rows[0].kind,'completed_sale_confirmed_amount');assert.equal(s.rows[1].kind,'completed_sale_confirmed_amount');assert.equal(s.rows[2].kind,'accepted_offer_confirmed_amount');
 assert.equal(s.rows[3].kind,'accepted_offer_amount_unknown');assert.equal(s.rows[3].finalPrice,null);assert.equal(s.rows[3].originalAskingPrice,100);assert.equal(s.rows[4].finalPrice,null);
 assert.equal(s.confirmedExactSales,3);assert.equal(s.rows[0].sourceUrl,'https://www.ebay.com/itm/123456789012');
});
test('identity requires full title evidence and rejects conflicting variants/structured fields',()=>{
 assert.equal(exactCandidate(row()),true);
 for(const changes of [{title:'Pikachu ex 149/128'},{title:row().title+' Japanese'},{title:row().title+' SAR'},{title:row().title+' proxy'},{title:row().title.replace('149/128','149/129')},{year:2025},{card_number:'150/128'},{card_set:'Other set'}])assert.equal(exactCandidate(row(changes)),false);
});
test('missing, invalid and future completion dates cannot become confirmed transactions',()=>{
 for(const changes of [{sale_date:''},{sale_date:'2026-02-30'},{sale_date:'2099-01-01',sold_at:'2099-01-01T00:00:00Z'},{sold_at:'invalid'},{sold_at:'2026-10-27T00:00:00Z'}]){
  const r=summarize(body([row(changes)]),now);assert.equal(r.exactResults,0);assert.equal(r.rows[0].finalPrice,null);assert.equal(r.rows[0].kind,'unverified_completion');
 }
 for(const changes of [{price:NaN},{price_confirmed:undefined},{original_price:undefined},{currency:'unknown'},{listing_type:'active'}])assert.throws(()=>summarize(body([row(changes)]),now));
 assert.throws(()=>summarize(body(Array.from({length:26},()=>row())),now));
});
test('allowlisted output drops unknown provider fields and redacts credentials and encoded credentials',()=>{
 const result=summarize(body([row({api_key:'private',seller:'private',listing_url:'https://user:private@www.ebay.com/itm/123456789012'})]),now);
 assert.doesNotMatch(JSON.stringify(result),/private/);assert.equal(result.rows[0].sourceUrl,null);
 assert.equal(redact('abc/x abc%2Fx','abc/x'),'[REDACTED] [REDACTED]');
});
test('native HTTPS sends exactly one authenticated GET and refuses redirects without following',async t=>{
 let calls=0;t.mock.method(https,'request',(url,options,callback)=>{
  calls++;assert.equal(url.origin+url.pathname,ENDPOINT);assert.equal(options.method,'GET');assert.equal(options.headers['x-market-api-key'],'mock');assert.equal(options.agent,false);assert.ok(!url.href.includes('mock'));
  const req=new EventEmitter();req.destroy=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=302;res.headers={location:'https://elsewhere.invalid'};res.destroy=()=>{};callback(res);};return req;
 });
 const r=await requestOnce(new URL(ENDPOINT),'mock');assert.equal(calls,1);assert.equal(r.status,302);assert.equal(r.error,'http_failure');
 assert.throws(()=>requestOnce(new URL('https://elsewhere.invalid'),'mock'));assert.equal(calls,1);
});
test('workflow retains registered inputs and spending boundaries while isolating the existing secret',()=>{
 const yaml=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');const job=yaml.split('\n  the-card-api-sales:')[1].split('\n  cardsight-access:')[0];
 for(const text of ["inputs.mode == 'dry-run'",APPROVAL,"github.repository == 'gempredict/gempredict-live'","github.ref == 'refs/heads/restore/phase1-identity-market-matching'","github.run_attempt == 1","github.actor_id == vars.VISION_BENCH_OWNER_ID",'environment: vision-benchmark','persist-credentials: false','timeout-minutes: 3'])assert.ok(job.includes(text));
 assert.equal((job.match(/secrets\./g)||[]).length,1);assert.ok(job.includes('secrets.THE_CARD_API_KEY'));assert.doesNotMatch(job,/ANTHROPIC|OPENAI|GEMINI|CARDSIGHT|npm ci|upload-artifact/);
 assert.match(yaml,/permissions:\n  contents: read/);assert.doesNotMatch(yaml,/\n  (?:push|pull_request|schedule):/);
 for(const action of yaml.matchAll(/uses: (\S+)/g))assert.match(action[1],/@[a-f0-9]{40}$/);
});

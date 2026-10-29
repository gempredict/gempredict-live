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

import {REDIRECT_APPROVAL,sanitizeLocation,inspectRedirect} from '../scripts/the-card-api/verify.mjs';
test('redirect inspection requires its own unique phrase; sales phrase cannot authorize it',()=>{
 assert.notEqual(REDIRECT_APPROVAL,APPROVAL);
 approvedContext({...context(),CARD_APPROVAL:REDIRECT_APPROVAL},REDIRECT_APPROVAL);
 assert.throws(()=>approvedContext(context(),REDIRECT_APPROVAL));
 assert.throws(()=>approvedContext({...context(),CARD_APPROVAL:REDIRECT_APPROVAL}));
 for(const change of [{GITHUB_ACTOR_ID:'999'},{GITHUB_REF:'refs/heads/main'},{GITHUB_RUN_ATTEMPT:'2'}])assert.throws(()=>approvedContext({...context(),CARD_APPROVAL:REDIRECT_APPROVAL,...change},REDIRECT_APPROVAL));
});
test('Location retains public route/query and strips credentials, fragments and unknown parameters',()=>{
 const base=new URL(ENDPOINT);base.search=new URLSearchParams({q:EXACT,limit:'1',page:'1',sort:'date_desc'}).toString();
 const target=new URL(base);target.hostname='www.thecardapi.com';
 assert.equal(sanitizeLocation(target.href,base),target.href);
 target.username='private-user';target.password='private-password';target.hash='private-fragment';target.searchParams.set('token','private-token');target.searchParams.set('q','private-query');
 const s=sanitizeLocation(target.href,base);assert.doesNotMatch(s,/private|token/);assert.match(s,/_redacted=1/);
 assert.equal(sanitizeLocation('https://foreign.example/private-path?credential=private',base),'https://foreign.example/[REDACTED_PATH]?_redacted=1');
 assert.equal(sanitizeLocation('/api/v1/market/sales?limit=1',base),'https://www.thecardapi.com/api/v1/market/sales?limit=1');
 for(const v of [undefined,['a','b'],'javascript:alert(1)','https://example.com/\r\nsecret'])assert.equal(sanitizeLocation(v,base),null);
});
test('inspection consumes one GET at most and returns status and sanitized Location only',async()=>{
 let calls=0;const request=async(u,key,options)=>{calls++;assert.equal(u.origin+u.pathname,ENDPOINT);assert.equal(u.searchParams.get('limit'),'1');assert.deepEqual(options,{headersOnly:true});return {httpStatus:307,location:'https://www.thecardapi.com/api/v1/market/sales?token=private',body:'private',headers:{key:'private'}};};
 const r=await inspectRedirect('mock',{request});assert.equal(calls,1);assert.deepEqual(r,{httpStatus:307,location:'https://www.thecardapi.com/api/v1/market/sales?_redacted=1'});
 calls=0;assert.deepEqual(await inspectRedirect('',{request}),{httpStatus:null,location:null});assert.equal(calls,0);
 calls=0;const fail=await inspectRedirect('mock',{request:async()=>{calls++;throw Error('private');}});assert.equal(calls,1);assert.deepEqual(fail,{httpStatus:null,location:null});
});
test('native headers-only GET destroys every response without consuming a body, retrying or following',async t=>{
 let calls=0,destroyed=0;
 for(const status of [200,307,401,500]){
  t.mock.method(https,'request',(url,options,callback)=>{
   calls++;assert.equal(url.origin+url.pathname,ENDPOINT);assert.equal(options.method,'GET');assert.equal(options.headers['x-market-api-key'],'mock');
   const req=new EventEmitter();req.destroy=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=status;res.headers={location:'https://elsewhere.invalid/api/v1/market/sales?token=private'};res.destroy=()=>{destroyed++;};res.on=()=>{throw Error('body must never be consumed');};callback(res);};return req;
  });
  const r=await inspectRedirect('mock');assert.equal(r.httpStatus,status);assert.equal(r.location,'https://elsewhere.invalid/api/v1/market/sales?_redacted=1');
 }
 assert.equal(calls,4);assert.equal(destroyed,4);
});
test('workflow selects inspection command only for new phrase while retaining the single secret step',()=>{
 const y=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');const job=y.split('\n  the-card-api-sales:')[1].split('\n  cardsight-access:')[0];
 assert.ok(job.includes(REDIRECT_APPROVAL));assert.match(job,/node scripts\/the-card-api\/verify.mjs inspect-redirect/);
 assert.equal((job.match(/secrets\./g)||[]).length,1);
});

test('canonical endpoint is fixed to verified www hostname; apex is rejected before transport',()=>{
 assert.equal(ENDPOINT,'https://www.thecardapi.com/api/v1/market/sales');
 assert.throws(()=>requestOnce(new URL('https://thecardapi.com/api/v1/market/sales'),'mock'),/endpoint_rejected/);
});

import {SCHEMA_APPROVAL,validateSchema,schemaDiagnostic,inspectSchema} from '../scripts/the-card-api/verify.mjs';
test('schema diagnostic reports structure and exact requirement, never response values or unsafe field names',()=>{
 const b=body([row({price_confirmed:undefined,seller:'PRIVATE SELLER',api_key:'PRIVATE KEY','PRIVATE TITLE AS KEY':99})]);
 const d=schemaDiagnostic(b);
 assert.equal(d.failedRequirement,'price_confirmed must be boolean');assert.equal(d.topLevelType,'object');assert.equal(d.returnedArrayLength,1);
 assert.deepEqual(d.envelope.data,{exists:true,type:'array'});assert.ok(d.firstRecordFields.some(f=>f.name==='price'&&f.type==='number'));
 assert.doesNotMatch(JSON.stringify(d),/PRIVATE|2026 Pokémon|ebay-123|https:|originalAskingPrice|80|100/);
 assert.equal(schemaDiagnostic(null).failedRequirement,'data must be an array');
 assert.equal(schemaDiagnostic(body([])).failedRequirement,null);
 const x=body([]);delete x.meta;assert.equal(schemaDiagnostic(x).failedRequirement,'meta must exist and be a non-null object');assert.deepEqual(schemaDiagnostic(x).envelope.meta,{exists:false,type:'missing'});
});
test('shared validator identifies each existing envelope and record constraint without relaxing it',()=>{
 const cases=[['data must be an array',b=>{b.data={};}],['data length must be at most 25',b=>{b.data=Array.from({length:26},()=>row());}],['pagination must exist and be non-null',b=>{b.pagination=null;}],['pagination.total must be an integer',b=>{b.pagination.total='1';}],['pagination.total must be at least data length',b=>{b.pagination.total=0;}],['pagination.page must equal 1',b=>{b.pagination.page=2;}],['pagination.limit must equal 25',b=>{b.pagination.limit=1;}],['pagination.has_more must be boolean',b=>{b.pagination.has_more='invalid';}],['meta must exist and be a non-null object',b=>{delete b.meta;}]];
 for(const [reason,mutate] of cases){const b=body([row()]);mutate(b);assert.equal(schemaDiagnostic(b).failedRequirement,reason);assert.throws(()=>summarize(b,now));}
 for(const field of ['id','platform','title','listing_type','price_confirmed','price','original_price','currency','sale_date','sold_at']){const b=body([row()]);delete b.data[0][field];assert.ok(schemaDiagnostic(b).failedRequirement.startsWith(field));assert.throws(()=>summarize(b,now));}
 const later=body([row(),row({price_confirmed:null})]);assert.equal(schemaDiagnostic(later).failedRequirement,'price_confirmed must be boolean');
 validateSchema(body([row({listing_type:'best_offer',price:null,price_confirmed:false})]));
 assert.equal(summarize(body([row({listing_type:'best_offer',price:null,price_confirmed:false})]),now).rows[0].finalPrice,null);
});
test('schema type reports handle scalars, arrays, null, empty data and bounded malicious object keys',()=>{
 for(const v of [null,[],1,'PRIVATE',true]){const d=schemaDiagnostic(v);assert.equal(d.returnedArrayLength,null);assert.deepEqual(d.topLevelFields,[]);assert.doesNotMatch(JSON.stringify(d),/PRIVATE/);}
 const b=body([null]);assert.equal(schemaDiagnostic(b).firstRecordType,'null');assert.equal(schemaDiagnostic(b).failedRequirement,'each record must be non-null');
 assert.equal(schemaDiagnostic(body([])).firstRecordType,'missing');
 const hostile=Object.fromEntries(Array.from({length:100},(_,i)=>['PRIVATE_'+i,'PRIVATE_VALUE']));assert.equal(schemaDiagnostic(hostile).topLevelFields.length,64);assert.doesNotMatch(JSON.stringify(schemaDiagnostic(hostile)),/PRIVATE/);
});
test('schema mode is separately authorized, consumes at most one GET and never broadens on schema or request failure',async()=>{
 approvedContext({...context(),CARD_APPROVAL:SCHEMA_APPROVAL},SCHEMA_APPROVAL);
 assert.throws(()=>approvedContext(context(),SCHEMA_APPROVAL));assert.throws(()=>approvedContext({...context(),CARD_APPROVAL:SCHEMA_APPROVAL}));
 for(const response of [{status:200,body:body([row()])},{status:200,body:{}},{status:307},{status:429},{error:'PRIVATE'}]){
  let calls=0;const d=await inspectSchema('mock',{request:async(u,key)=>{calls++;assert.equal(u.origin+u.pathname,ENDPOINT);assert.equal(u.searchParams.get('q'),EXACT);assert.equal(u.searchParams.get('limit'),'25');return response;}});assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(d),/PRIVATE|Pikachu|https:/);
 }
 let calls=0;await inspectSchema('',{request:async()=>{calls++;}});assert.equal(calls,0);
 const y=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');assert.ok(y.includes(SCHEMA_APPROVAL));assert.match(y,/node scripts\/the-card-api\/verify.mjs inspect-schema/);
});

test('observed empty-results shape may omit has_more without inferring completeness or mutating response',()=>{
 // Reconstruct only the shape established by the owner log and prior successful
 // validators; numeric values below are synthetic, not claimed captured values.
 const empty={data:[],pagination:{total:0,page:1,limit:25},meta:{}};
 const before=JSON.stringify(empty);const r=summarize(empty,now);
 assert.equal(r.returned,0);assert.equal(r.exactResults,0);assert.equal(r.hasMore,null);
 assert.equal(Object.hasOwn(empty.pagination,'has_more'),false);assert.equal(JSON.stringify(empty),before);
 assert.equal(schemaDiagnostic(empty).failedRequirement,null);
 // Even reported totals above zero do not turn an empty page into completeness.
 const partial=structuredClone(empty);partial.pagination.total=20;assert.equal(summarize(partial,now).hasMore,null);
});
test('optional availability rejects malformed pagination and preserves unknown on populated pages',()=>{
 const empty=()=>({data:[],pagination:{total:0,page:1,limit:25},meta:{}});
 for(const p of [undefined,null,[],0,'private',{}, {total:-1,page:1,limit:25},{total:'0',page:1,limit:25},{total:0,page:2,limit:25},{total:0,page:1,limit:50}])assert.throws(()=>summarize({...empty(),pagination:p},now));
 for(const bad of [null,'false',0,{},[]]){const b=empty();b.pagination.has_more=bad;assert.throws(()=>summarize(b,now));}
 for(const field of ['total','page','limit']){const b=empty();delete b.pagination[field];assert.throws(()=>summarize(b,now));}
 const populated=body([row()]);delete populated.pagination.has_more;assert.equal(summarize(populated,now).hasMore,null);
});
test('empty exact result missing has_more allows only the planned broader GET; malformed page stops',async()=>{
 const empty=()=>({data:[],pagination:{total:0,page:1,limit:25},meta:{}});
 for(const second of [empty(),body([row()])]){
  let calls=0;const r=await verify('mock',{now,request:async u=>{calls++;assert.equal(u.searchParams.get('q'),calls===1?EXACT:BROAD);assert.equal(u.searchParams.get('limit'),'25');return {status:200,body:calls===1?empty():second};}});
  assert.equal(calls,2);assert.equal(r.maximumRequests,2);assert.equal(r.maximumReturnedRows,50);assert.equal(r.requests[0].result.hasMore,null);assert.equal(r.status,'sales_response_observed');
 }
 let calls=0;const malformed=empty();malformed.pagination.has_more='no';const r=await verify('mock',{request:async()=>{calls++;return {status:200,body:malformed};}});assert.equal(calls,1);assert.equal(r.status,'schema_unrecognized');
});

import {BROAD_SCHEMA_APPROVAL,paginationDiagnostic} from '../scripts/the-card-api/verify.mjs';
test('broader schema authorization is unique and preserves owner/branch/first-attempt admission',()=>{
 assert.ok(![APPROVAL,SCHEMA_APPROVAL,REDIRECT_APPROVAL].includes(BROAD_SCHEMA_APPROVAL));
 approvedContext({...context(),CARD_APPROVAL:BROAD_SCHEMA_APPROVAL},BROAD_SCHEMA_APPROVAL);
 assert.throws(()=>approvedContext(context(),BROAD_SCHEMA_APPROVAL));
 for(const change of [{GITHUB_REF:'refs/heads/main'},{GITHUB_ACTOR_ID:'999'},{GITHUB_RUN_ATTEMPT:'2'}])assert.throws(()=>approvedContext({...context(),CARD_APPROVAL:BROAD_SCHEMA_APPROVAL,...change},BROAD_SCHEMA_APPROVAL));
 const y=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');assert.ok(y.includes(BROAD_SCHEMA_APPROVAL));assert.match(y,/node scripts\/the-card-api\/verify.mjs inspect-broad-schema/);
});
test('broader schema uses only the broad query, once, without returning sensitive values or accepting sales',async()=>{
 let calls=0;const b=body([row({title:'PRIVATE TITLE',price:87654.32,seller:'PRIVATE SELLER',listing_url:'https://private.example/secret'})]);delete b.pagination.has_more;b.pagination.next_cursor='PRIVATE CURSOR';
 const d=await inspectSchema('mock',{broader:true,request:async(u,key)=>{calls++;assert.equal(u.origin+u.pathname,ENDPOINT);assert.equal(u.searchParams.get('q'),BROAD);assert.equal(u.searchParams.get('limit'),'25');assert.equal(u.searchParams.has('cursor'),false);return {status:200,body:b};}});
 assert.equal(calls,1);assert.equal(d.returnedArrayLength,1);assert.equal(d.failedRequirement,null);assert.equal(d.pagination.nextCursor.nonEmpty,true);assert.equal(d.pagination.hasMore.reportedValue,null);assert.equal(d.pagination.completeness,'not_independently_established');
 assert.doesNotMatch(JSON.stringify(d),/PRIVATE|87654|https:|finalPrice|acceptedForValuation/);
});
test('pagination diagnostics expose structure and bounded counters without inferring unknown completeness',()=>{
 for(const p of [undefined,null,[],{}, {has_more:null,next_cursor:null},{has_more:'PRIVATE',next_cursor:'PRIVATE',total:'PRIVATE'},{has_more:false,next_cursor:'',total:0,page:1,limit:25,pages:0}]){
  const r=paginationDiagnostic(p);assert.equal(r.completeness,'not_independently_established');assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
 }
 assert.equal(paginationDiagnostic({}).hasMore.reportedValue,null);assert.equal(paginationDiagnostic({has_more:false}).hasMore.reportedValue,false);
});
test('broader schema failures never retry, fall back to exact, or leak provider errors',async()=>{
 for(const response of [{status:307},{status:429},{status:200,body:{}},{error:'PRIVATE'}]){
  let calls=0;const d=await inspectSchema('mock',{broader:true,request:async u=>{calls++;assert.equal(u.searchParams.get('q'),BROAD);return response;}});assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(d),/PRIVATE/);
 }
});

import {pageAvailability} from '../scripts/the-card-api/verify.mjs';
// Sanitized schema fixture: observed counters/field layout, synthetic sale values.
const observedCursorPage=()=>({data:Array.from({length:25},(_,i)=>row({id:'synthetic-'+i,card_set:'2026 Pokemon 30th Celebration',card_number:'149/128',grade:'10',grader:'PSA'})),pagination:{total:2105,page:1,limit:25,pages:85,next_cursor:'SYNTHETIC_OPAQUE_CURSOR'},meta:{}});
test('observed populated cursor schema validates and records positive availability without leaking cursor',()=>{
 const b=observedCursorPage(),before=JSON.stringify(b);const s=summarize(b,now);
 assert.equal(s.returned,25);assert.equal(s.total,2105);assert.equal(s.hasMore,true);assert.equal(s.paginationEvidence,'nonempty_next_cursor');assert.equal(s.confirmedExactSales,25);
 assert.equal(schemaDiagnostic(b).failedRequirement,null);assert.equal(JSON.stringify(b),before);assert.equal(Object.hasOwn(b.pagination,'has_more'),false);
 assert.doesNotMatch(JSON.stringify(s),/SYNTHETIC_OPAQUE_CURSOR/);
});
test('availability remains unknown without a usable cursor or explicit boolean; totals/pages do not imply completion',()=>{
 for(const cursor of [undefined,null,'','   ']){
  const b=observedCursorPage();if(cursor===undefined)delete b.pagination.next_cursor;else b.pagination.next_cursor=cursor;
  const s=summarize(b,now);assert.equal(s.hasMore,null);assert.equal(s.paginationEvidence,'unknown');
 }
 assert.deepEqual(pageAvailability({has_more:false,next_cursor:'opaque'}),{hasMore:true,evidence:'nonempty_next_cursor'});
 assert.equal(pageAvailability({has_more:true}).hasMore,true);assert.equal(pageAvailability({has_more:false,next_cursor:null}).hasMore,false);
 for(const changes of [{next_cursor:{}},{next_cursor:42},{pages:'85'},{pages:-1},{has_more:null}])assert.throws(()=>summarize({...observedCursorPage(),pagination:{...observedCursorPage().pagination,...changes}},now));
});
test('observed cursor never triggers more pages; broader fallback stays within two GETs and 50 rows',async()=>{
 let calls=0;const r=await verify('mock',{now,request:async u=>{calls++;assert.equal(u.searchParams.get('page'),'1');assert.equal(u.searchParams.has('cursor'),false);assert.equal(u.searchParams.get('q'),calls===1?EXACT:BROAD);return {status:200,body:calls===1?{data:[],pagination:{total:0,page:1,limit:25},meta:{}}:observedCursorPage()};}});
 assert.equal(calls,2);assert.equal(r.status,'sales_response_observed');assert.equal(r.requests[1].result.hasMore,true);assert.equal(r.maximumReturnedRows,50);
 calls=0;await verify('mock',{now,request:async()=>{calls++;return {status:200,body:observedCursorPage()};}});assert.equal(calls,1);
});
test('cursor pagination does not weaken sale confirmation, dates, identity or source sanitization',()=>{
 const b=observedCursorPage();b.data[0]=row({listing_type:'best_offer',price:null,original_price:999,price_confirmed:false});b.data[1]=row({sale_date:'2099-01-01'});b.data[2]=row({card_number:'150/128'});b.data[3]=row({listing_url:'https://unapproved.example/private?token=secret'});
 const s=summarize(b,now);assert.equal(s.rows[0].finalPrice,null);assert.equal(s.rows[0].kind,'accepted_offer_amount_unknown');assert.equal(s.rows[0].originalAskingPrice,999);assert.equal(s.rows[1].finalPrice,null);assert.equal(s.rows[2].identity,'unmatched_variant_or_insufficient_identity');assert.equal(s.rows[3].sourceUrl,null);
 delete b.data[4].price_confirmed;assert.throws(()=>summarize(b,now),/price_confirmed/);
});

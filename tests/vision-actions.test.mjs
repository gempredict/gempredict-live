// Synthetic security/transport tests only: zero paid calls, no accuracy claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import https from 'node:https';
import dns from 'node:dns';
import {EventEmitter} from 'node:events';
import {seal,openEnvelope,packPhotos,unpackPhotos,storageUrl,publicAddress,requestObject,ROLES} from '../scripts/vision-benchmark/bundle.mjs';
import {createSpendGuard,REVIEWED_AT,REVIEWED_RATES,PROFILES} from '../scripts/vision-benchmark/spend.mjs';
import {providers,hash,providerRequest,executeBenchmark,parseProviderResponse} from '../scripts/vision-benchmark/core.mjs';
import {benchmarkChildEnvironment} from '../scripts/vision-benchmark/prepare.mjs';
import {configureProfile,liveContext} from '../scripts/vision-benchmark/actions.mjs';
import {sanitizedMetrics} from '../scripts/vision-benchmark/metrics.mjs';
const now=Date.parse(REVIEWED_AT)+3600000,revision='a'.repeat(40),key=randomBytes(32).toString('base64');
const truth={verified:true,reference:'SYNTHETIC UNIT LABELS ONLY',identity:{subject:'Test ex',year:'2026',brandSet:'Test',cardNumber:'11/22',language:'English',parallel:'Holo Special Art',rarity:'Special illustration rare'},conditionReviewed:true,assessableAttributes:['surface'],visibleDefects:[]};
const fixture=id=>({id,category:'pokemon',consentToProviderUpload:true,rightsReference:'SYNTHETIC TEST ONLY',front:{path:'front.jpeg',sha256:'a'.repeat(64)},back:{path:'back.jpeg',sha256:'b'.repeat(64)},groundTruth:truth});
const base={fixtures:[fixture('original'),fixture('improved')],repeats:3,maxRequests:18,maxEstimatedCostUSD:4.25,rates:REVIEWED_RATES,ratesAsOf:REVIEWED_AT};
const jpeg=await sharp({create:{width:512,height:720,channels:3,background:'white'}}).jpeg().toBuffer();
const images=[{buffer:jpeg,mime:'image/jpeg'},{buffer:jpeg,mime:'image/jpeg'}];
const prepared=new Map([['original',images],['improved',images]]);
const manifest=mode=>{const m=configureProfile(structuredClone(base),mode);m.spendPolicy.requireJournal=false;return m;};
const payload=id=>providerRequest(id,'test prompt',images);
const prediction={identifiedSubject:'Test ex',identifiedYear:'2026',identifiedBrandSet:'Test',identifiedCardNumber:'11/22',identifiedLanguage:'en',identifiedParallel:'Holo Special Art',identifiedRarity:'SIR',visualObservations:[]};
const response=id=>id==='anthropic'?{model:providers[id].model,content:[{type:'text',text:JSON.stringify(prediction)}],usage:{input_tokens:100,output_tokens:50}}:id==='openai'?{model:providers[id].model,output:[{content:[{type:'output_text',text:JSON.stringify(prediction)}]}],usage:{input_tokens:100,output_tokens:50}}:{modelVersion:providers[id].model,candidates:[{content:{parts:[{text:JSON.stringify(prediction)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:40,thoughtsTokenCount:10}};

test('admission reserves smoke/full envelopes before requests and ceilings fit a single $5 sequence',async()=>{
 for(const mode of ['smoke','full']){
  const m=manifest(mode),guard=await createSpendGuard(m,prepared,{now});
  assert.ok(guard.report().plannedMaximumUSD<=PROFILES[mode].maxUSD);
  assert.equal(guard.report().attemptedRequests,0);
  for(const id of Object.keys(providers))for(const f of m.fixtures)for(let i=0;i<m.repeats;i++)guard.reserve(id,f,payload(id),'test prompt');
  assert.equal(guard.report().attemptedRequests,PROFILES[mode].requests);assert.equal(guard.report().reservedMaximumUSD,guard.report().plannedMaximumUSD);
  assert.throws(()=>guard.reserve('anthropic',m.fixtures[0],payload('anthropic'),'test prompt'),/limit/);
 }
 assert.equal(PROFILES.smoke.maxUSD+PROFILES.full.maxUSD,5);
});
test('stale/missing policy, unreviewed rates and altered profiles block before transport',async()=>{
 await assert.rejects(()=>createSpendGuard(base,prepared,{now}),/policy/);
 await assert.rejects(()=>createSpendGuard(manifest('full'),prepared,{now:now+8*86400000}),/stale/);
 const bad=manifest('full');bad.rates={...bad.rates,anthropic:{inputPerMillion:.01,outputPerMillion:.01}};
 await assert.rejects(()=>createSpendGuard(bad,prepared,{now}),/rates/);
 const tooMany=manifest('full');tooMany.maxRequests=19;await assert.rejects(()=>createSpendGuard(tooMany,prepared,{now}),/profile/);
});
test('all image inputs and prompt bounds are checked before any call can be reserved',async()=>{
 const big=await sharp({create:{width:2560,height:2560,channels:3,background:'white'}}).jpeg().toBuffer();
 const map=new Map(prepared);map.set('improved',[{buffer:big,mime:'image/jpeg'},{buffer:big,mime:'image/jpeg'}]);
 await assert.rejects(()=>createSpendGuard(manifest('full'),map,{now}),/input_bound/);
 const missing=new Map(prepared);missing.set('original',[images[0]]);await assert.rejects(()=>createSpendGuard(manifest('full'),missing,{now}),/front_and_back/);
 const guard=await createSpendGuard(manifest('smoke'),prepared,{now});
 assert.throws(()=>guard.reserve('anthropic',base.fixtures[0],payload('anthropic'),'x'.repeat(20000)),/input_bound/);
 assert.equal(guard.report().attemptedRequests,0);
});
test('output/model/tool changes and missing usage cannot release a reservation',async()=>{
 const guard=await createSpendGuard(manifest('smoke'),prepared,{now});
 assert.throws(()=>guard.reserve('openai',base.fixtures[0],{...payload('openai'),model:'unapproved'},'test'),/approved/);
 assert.throws(()=>guard.reserve('openai',base.fixtures[0],{...payload('openai'),max_output_tokens:4000},'test'),/approved/);
 const reservation=guard.reserve('openai',base.fixtures[0],payload('openai'),'test');
 assert.throws(()=>guard.observe(reservation,{input:100,output:null}),/usage/);
 assert.ok(guard.report().reservedMaximumUSD>0);assert.equal(guard.report().stopped,true);
 assert.throws(()=>guard.reserve('google',base.fixtures[0],payload('google'),'test'),/limit/);
 assert.equal(parseProviderResponse('google',{...response('google'),usageMetadata:{promptTokenCount:100}}).usage.output,null);
});
test('shared runner smoke makes exactly 3 mocked attempts; full mode makes 18',async t=>{
 t.mock.method(Date,'now',()=>now);
 for(const mode of ['smoke','full']){
  let calls=0;const result=await executeBenchmark(manifest(mode),prepared,{transport:async id=>{calls++;return response(id);}});
  assert.equal(calls,PROFILES[mode].requests);assert.equal(result.testOnly,true);assert.equal(result.spendReservation.attemptedRequests,calls);
 }
});
test('first failed or malformed provider response stops the guarded runner without retry or refund',async t=>{
 t.mock.method(Date,'now',()=>now);
 for(const transport of [async()=>{throw Error('SYNTHETIC PRIVATE ERROR');},async()=>({})]){
  const result=await executeBenchmark(manifest('full'),prepared,{transport});
  assert.equal(result.status,'STOPPED_SAFETY_FAILURE');assert.equal(result.rows.length,1);assert.equal(result.spendReservation.attemptedRequests,1);assert.ok(result.spendReservation.reservedMaximumUSD>0);
  assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC PRIVATE ERROR/);
 }
});
test('journal records a reservation before transport and refuses journal replay',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gp-journal-')),file=path.join(dir,'journal.json'),previous=process.env.VISION_BENCH_JOURNAL;
 process.env.VISION_BENCH_JOURNAL=file;t.after(()=>{if(previous===undefined)delete process.env.VISION_BENCH_JOURNAL;else process.env.VISION_BENCH_JOURNAL=previous;fs.rmSync(dir,{recursive:true,force:true});});
 const m=manifest('smoke');m.spendPolicy.requireJournal=true;
 const guard=await createSpendGuard(m,prepared,{now});guard.reserve('anthropic',m.fixtures[0],payload('anthropic'),'test');
 assert.equal(JSON.parse(fs.readFileSync(file)).attemptedRequests,1);assert.equal(fs.statSync(file).mode&0o777,0o600);
 await assert.rejects(()=>createSpendGuard(m,prepared,{now}),/journal/);
});
test('encrypted envelopes bind purpose/revision/expiry and authenticate all contents',()=>{
 const sealed=seal({private:'SYNTHETIC PHOTO DATA'},key,{purpose:'photos',revision,now});
 assert.doesNotMatch(sealed.toString(),/SYNTHETIC PHOTO DATA/);
 assert.equal(openEnvelope(sealed,key,{purpose:'photos',revision,now}).private,'SYNTHETIC PHOTO DATA');
 for(const options of [{purpose:'metrics',revision,now},{purpose:'photos',revision:'b'.repeat(40),now},{purpose:'photos',revision,now:now+31*60000}])assert.throws(()=>openEnvelope(sealed,key,options));
 const modified=Buffer.from(sealed);modified[modified.length-1]^=1;assert.throws(()=>openEnvelope(modified,key,{purpose:'photos',revision,now}));
 assert.throws(()=>openEnvelope(sealed,randomBytes(32).toString('base64'),{purpose:'photos',revision,now}));
 assert.throws(()=>seal({},'weak',{purpose:'photos',revision,now}));
});
test('four-photo packing validates hashes/labels and extraction uses fixed private filenames',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gp-bundle-'));
 try{
  const m=structuredClone(base);
  for(const f of m.fixtures)for(const side of ['front','back']){const file=f.id+'-'+side+'.jpeg';fs.writeFileSync(path.join(dir,file),jpeg);f[side]={path:file,sha256:hash(jpeg)};}
  const bundle=packPhotos(m,dir),restored=unpackPhotos(bundle,path.join(dir,'photos'));
  for(const f of restored.fixtures)for(const side of ['front','back'])assert.equal(fs.statSync(f[side].path).mode&0o777,0o600);
  assert.equal(fs.statSync(path.join(dir,'photos')).mode&0o777,0o700);assert.deepEqual(Object.keys(bundle.photos).sort(),[...ROLES].sort());
  const corrupt=structuredClone(bundle);corrupt.photos['original-front'].sha256='c'.repeat(64);assert.throws(()=>unpackPhotos(corrupt,path.join(dir,'corrupt')),/hash/);
  const extra=structuredClone(bundle);extra.photos['../escape']={};assert.throws(()=>unpackPhotos(extra,path.join(dir,'extra')),/entries/);
  m.fixtures[0].groundTruth.conditionReviewed=false;assert.throws(()=>packPhotos(m,dir),/reviewed/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('storage rejects redirects by design, foreign/insecure origins and private addresses',()=>{
 assert.equal(storageUrl('https://owner.example.com/private?signature=SYNTHETIC','owner.example.com').hostname,'owner.example.com');
 for(const url of ['http://owner.example.com/file','https://other.example.com/file','https://user:pass@owner.example.com/file','https://owner.example.com:444/file'])assert.throws(()=>storageUrl(url,'owner.example.com'));
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.20.1.1','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fd00::1','fe80::1'])assert.equal(publicAddress(ip),false);
 assert.equal(publicAddress('8.8.8.8'),true);
});
test('live execution is owner-only, branch-bound, manually confirmed and cannot rerun paid attempts',()=>{
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'gempredict/gempredict-live',GITHUB_REF:'refs/heads/restore/phase1-identity-market-matching',GITHUB_RUN_ATTEMPT:'1',BENCH_OWNER_ID:'123',GITHUB_ACTOR_ID:'123',BENCH_LIVE_ENABLED:'true',GITHUB_SHA:revision,BENCH_MODE:'smoke',BENCH_CONFIRMATION:'AUTHORIZE_SMOKE_0_75_USD'};
 assert.equal(liveContext(env).mode,'smoke');
 for(const changed of [{GITHUB_EVENT_NAME:'push'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_ACTOR_ID:'456'},{BENCH_LIVE_ENABLED:'false'},{GITHUB_REF:'refs/heads/main'},{BENCH_CONFIRMATION:'yes'},{BENCH_MODE:'full'}])assert.throws(()=>liveContext({...env,...changed}));
});
test('sanitized metrics drop every free-text/photo/credential field and preserve unknown billing',()=>{
 const raw={status:'STOPPED_SAFETY_FAILURE',providerRequestsAttempted:1,rows:[{provider:'anthropic',error:'SYNTHETIC_CREDENTIAL_AND_RESPONSE',proposedIdentity:{subject:'PRIVATE_PHOTO_LABEL'},imageFingerprints:['PRIVATE_IMAGE_HASH']}],summaries:{anthropic:{identityAccuracy:{subject:'PRIVATE'},estimatedCostUSD:'UNKNOWN'}}};
 const clean=sanitizedMetrics(raw,{attemptedRequests:1,reservedMaximumUSD:.2775},{mode:'smoke',revision});
 assert.doesNotMatch(JSON.stringify(clean),/SYNTHETIC_CREDENTIAL|PRIVATE|UNKNOWN/);assert.equal(clean.attemptedRequests,1);assert.equal(clean.providers.anthropic.estimatedCostUSD,null);assert.equal(clean.billingCapClaimed,false);
});
test('preparation child processes cannot inherit provider/storage/GitHub credentials or debug switches',()=>{
 const safe=benchmarkChildEnvironment({PATH:'/usr/bin',HTTPS_PROXY:'http://trusted-proxy',NODE_EXTRA_CA_CERTS:'/trusted-ca',Claude_API_Key:'SYNTHETIC',VISION_BENCH_DATA_KEY:'SYNTHETIC',VISION_BENCH_BUNDLE_URL:'SYNTHETIC',GITHUB_TOKEN:'SYNTHETIC',NODE_DEBUG:'http',DEBUG:'*',NODE_OPTIONS:'--trace-warnings'});
 assert.deepEqual(safe,{PATH:'/usr/bin',HTTPS_PROXY:'http://trusted-proxy',NODE_EXTRA_CA_CERTS:'/trusted-ca'});
});
test('workflow is manual-only, least-privilege, SHA-pinned and never publishes data artifacts or summaries',()=>{
 const yaml=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');
 assert.match(yaml,/on:\n  workflow_dispatch:/);assert.doesNotMatch(yaml,/\n  (?:push|pull_request|pull_request_target|schedule|workflow_run):/);
 assert.match(yaml,/permissions:\n  contents: read/);assert.doesNotMatch(yaml,/(?:write-all|contents: write|id-token: write|upload-artifact|GITHUB_STEP_SUMMARY)/);
 for(const action of yaml.matchAll(/uses: (\S+)/g))assert.match(action[1],/@[a-f0-9]{40}$/);
 assert.doesNotMatch(yaml,/run:.*\$\{\{/);assert.match(yaml,/persist-credentials: false/);assert.match(yaml,/if: always\(\)/);
});


test('storage transport never follows redirects or forwards provider credentials and rejects private DNS',async t=>{
 let requestCount=0,address='8.8.8.8';
 t.mock.method(dns,'lookup',(host,options,callback)=>queueMicrotask(()=>callback(null,[{address,family:4}])));
 t.mock.method(https,'request',(url,options,callback)=>{
  requestCount++;assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers['x-api-key'],undefined);assert.notEqual(options.rejectUnauthorized,false);
  const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=302;res.destroy=()=>{};callback(res);});return req;
 });
 await assert.rejects(()=>requestObject('https://owner.example.com/private?signature=SYNTHETIC','owner.example.com'),/storage_http/);
 assert.equal(requestCount,1);
 address='169.254.169.254';await assert.rejects(()=>requestObject('https://owner.example.com/private','owner.example.com'),/storage_dns/);assert.equal(requestCount,1);
});


test('unexpected response models stop further requests even when token usage fits',async()=>{
 const guard=await createSpendGuard(manifest('smoke'),prepared,{now});
 const held=guard.reserve('openai',base.fixtures[0],payload('openai'),'test prompt');
 assert.throws(()=>guard.observe(held,{input:100,output:50},'unexpected-model','openai'),/model_mismatch/);
 assert.equal(guard.report().stopped,true);assert.ok(guard.report().reservedMaximumUSD>0);
 assert.equal(providerRequest('openai','test',images).store,false);
});

test('native paid transport cannot run without the new admission policy',async t=>{
 let networkCalls=0;t.mock.method(https,'request',()=>{networkCalls++;throw Error('NETWORK MUST NOT RUN');});
 const m=manifest('smoke');delete m.spendPolicy;m.paidCallsAuthorized=true;
 const env=Object.fromEntries(Object.values(providers).map(p=>[p.key,'SYNTHETIC_TEST_ONLY']));
 const result=await executeBenchmark(m,prepared,{env});
 assert.equal(result.status,'BLOCKED_SPEND_POLICY');assert.equal(result.providerCallsPerformed,0);assert.equal(networkCalls,0);
});

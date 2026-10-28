// Harness tests only. No image/model accuracy is asserted from these fixtures.
import test from 'node:test';import assert from 'node:assert/strict';
import {benchmarkCredential,benchmarkProxy,providers,planBenchmark,providerRequest,parseProviderResponse,scoreResponse,executeBenchmark} from '../scripts/vision-benchmark/core.mjs';
const identity={subject:'Pikachu ex',year:'2026',brandSet:'30th Celebration',cardNumber:'149/128',language:'English',parallel:'Holo Special Art',rarity:'Special illustration rare'};
const truth={verified:true,reference:'synthetic-test-label-not-real',identity,conditionReviewed:true,assessableAttributes:['surface','corners'],visibleDefects:[]};
const fixture={id:'synthetic-unit',synthetic:true,category:'pokemon',rightsReference:'test-only',consentToProviderUpload:true,front:{path:'not-real.jpg',sha256:'a'.repeat(64)},groundTruth:truth};
const manifest={fixtures:[fixture],repeats:2,maxRequests:6,maxEstimatedCostUSD:1,rates:Object.fromEntries(Object.keys(providers).map(id=>[id,{inputPerMillion:1,outputPerMillion:2}]))};
const predicted={identifiedSubject:'Pikachu ex',identifiedYear:'2026',identifiedBrandSet:'30th Celebration',identifiedCardNumber:'149/128',identifiedLanguage:'en',identifiedParallel:'Holo Special Art',identifiedRarity:'SIR',visualObservations:[]};
const response=(id,data=predicted)=>id==='anthropic'?{model:providers[id].model,content:[{type:'text',text:JSON.stringify(data)}],usage:{input_tokens:100,output_tokens:50}}:id==='openai'?{model:providers[id].model,output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}],usage:{input_tokens:100,output_tokens:50}}:{modelVersion:providers[id].model,candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:40,thoughtsTokenCount:10}};
test('default or synthetic benchmark manifests are BLOCKED and cannot accidentally make paid calls',async()=>{
 assert.equal(planBenchmark(manifest).status,'BLOCKED');
 const result=await executeBenchmark(manifest,new Map());assert.equal(result.status,'BLOCKED');assert.equal(result.providerCallsPerformed,0);
 const env=Object.fromEntries(Object.values(providers).map(p=>[p.key,'mock-secret']));
 const plan=planBenchmark(manifest,{live:true,authorized:true,env});assert.ok(plan.blockers.some(x=>x.includes('real_image_rights_or_consent')));
});
test('three adapters send the same prompt/images, keep labels out, and parse each usage schema',()=>{
 for(const id of Object.keys(providers)){
  const request=providerRequest(id,'neutral vision contract',[{mime:'image/jpeg',buffer:Buffer.from('synthetic-image-bytes')}]);
  assert.match(JSON.stringify(request),/neutral vision contract/);assert.doesNotMatch(JSON.stringify(request),/groundTruth|Pikachu/);
  const parsed=parseProviderResponse(id,response(id));assert.equal(parsed.usage.input,100);assert.equal(parsed.usage.output,50);
  assert.equal(scoreResponse(parsed.parsed,truth).exactIdentity,true);
 }
});
test('raw false defect assertions are counted even if the production contract downgrades them',()=>{
 const r=scoreResponse({...predicted,visualObservations:[{attribute:'surface',code:'scratches',certainty:'confirmed'}]},truth);
 assert.equal(r.falsePositiveDefects,1);assert.equal(r.unsupportedConfirmedClaims,1);assert.equal(r.confirmedDefects.length,0);
 assert.equal(scoreResponse({...predicted,identifiedCardNumber:'149/165'},truth).exactIdentity,false);
});
test('mock transport exercises repeatability, cost and error accounting without becoming a real accuracy result',async()=>{
 const prepared=new Map([[fixture.id,[{mime:'image/jpeg',buffer:Buffer.from('synthetic-test-only')}]]]);let calls=0;
 const result=await executeBenchmark(manifest,prepared,{transport:async id=>{calls++;return response(id);}});
 assert.equal(calls,6);assert.equal(result.status,'HARNESS_TEST_ONLY_NOT_MODEL_ACCURACY');assert.equal(result.testOnly,true);
 assert.ok(Math.abs(result.estimatedCostUSD-.0012)<1e-10);
 for(const summary of Object.values(result.summaries)){assert.equal(summary.perImageStability[0].identityVersions,1);assert.equal(summary.perImageStability[0].conditionVersions,1);}
 const bad=await executeBenchmark(manifest,prepared,{transport:async()=>{throw Error('private raw provider body and credentials');}});
 assert.doesNotMatch(JSON.stringify(bad),/private raw|credentials/);assert.equal(bad.summaries.openai.validResponses,0);assert.equal(bad.summaries.openai.exactIdentityRate,null);
});
test('budget stops and malformed provider responses never become successful measurements',async()=>{
 assert.throws(()=>parseProviderResponse('openai',{output:[]}),/benchmark/);
 const prepared=new Map([[fixture.id,[{mime:'image/jpeg',buffer:Buffer.from('test')}]]]);
 const result=await executeBenchmark({...manifest,maxRequests:1},prepared,{transport:async id=>response(id)});
 assert.equal(result.status,'STOPPED_AT_BUDGET');assert.equal(result.rows.length,1);
});

test('reviewed real-image plans still reject malformed or unassessable condition ground truth',()=>{
 const real={...fixture,synthetic:false};const env=Object.fromEntries(Object.values(providers).map(p=>[p.key,'mock-secret']));
 assert.equal(planBenchmark({...manifest,fixtures:[real]},{live:true,authorized:true,env}).status,'READY_FOR_AUTHORIZED_CALLS');
 for(const visibleDefects of [[null],[{attribute:'surface',code:'mint'}],[{attribute:'edges',code:'whitening'}]]){
  const plan=planBenchmark({...manifest,fixtures:[{...real,groundTruth:{...truth,visibleDefects}}]},{live:true,authorized:true,env});
  assert.equal(plan.status,'BLOCKED');assert.ok(plan.blockers.some(b=>b.includes('condition_labels_unverified')));
 }
});


test('benchmark-only Anthropic binding aliases remain opaque, isolated and do not mutate the environment',()=>{
 const env={Claude_API_Key:'synthetic-anthropic-binding',VISION_BENCH_OPENAI_KEY:'synthetic-openai-binding',VISION_BENCH_GEMINI_KEY:'synthetic-gemini-binding'};
 const before={...env};
 assert.equal(benchmarkCredential('anthropic',env),env.Claude_API_Key);
 assert.equal(benchmarkCredential('openai',env),env.VISION_BENCH_OPENAI_KEY);
 assert.equal(benchmarkCredential('google',env),env.VISION_BENCH_GEMINI_KEY);
 assert.equal(benchmarkCredential('openai',{Claude_API_Key:env.Claude_API_Key}),undefined);
 assert.equal(benchmarkCredential('google',{Claude_API_Key:env.Claude_API_Key}),undefined);
 assert.equal(benchmarkCredential('unsupported',env),undefined);
 assert.equal(benchmarkCredential('anthropic',{CLAUDE_API_KEY:'synthetic-uppercase-binding'}),'synthetic-uppercase-binding');
 assert.equal(benchmarkCredential('anthropic',{...env,VISION_BENCH_ANTHROPIC_KEY:'synthetic-dedicated-binding'}),'synthetic-dedicated-binding');
 assert.deepEqual(env,before);
 const real={...fixture,synthetic:false};
 const plan=planBenchmark({...manifest,fixtures:[real]},{live:true,authorized:true,env});
 assert.equal(plan.status,'READY_FOR_AUTHORIZED_CALLS');
 assert.doesNotMatch(JSON.stringify(plan),/synthetic-.*binding/);
});

test('benchmark transport preserves inherited proxy precedence including lowercase names',()=>{
 for(const name of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])assert.equal(benchmarkProxy({[name]:'http://test-proxy:8080'}),'http://test-proxy:8080');
 assert.equal(benchmarkProxy({HTTPS_PROXY:'http://first:8080',https_proxy:'http://second:8080',HTTP_PROXY:'http://third:8080'}),'http://first:8080');
 assert.equal(benchmarkProxy({}),undefined);
});

import https from 'node:https';
import {EventEmitter} from 'node:events';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {callProvider} from '../scripts/vision-benchmark/core.mjs';
test('benchmark HTTPS requests keep credentials in provider-specific headers and retain proxy TLS verification without connecting',async t=>{
 const previousProxy=process.env.HTTPS_PROXY;
 process.env.HTTPS_PROXY='http://synthetic-local-proxy:8080';
 t.after(()=>{if(previousProxy===undefined)delete process.env.HTTPS_PROXY;else process.env.HTTPS_PROXY=previousProxy;});
 let count=0;
 t.mock.method(https,'request',(url,options,callback)=>{
  const id=Object.keys(providers)[count++];
  assert.equal(url,providers[id].url);assert.equal(new URL(url).protocol,'https:');
  assert.equal(new URL(url).search,'');assert.equal(new URL(url).username,'');
  assert.ok(options.agent instanceof HttpsProxyAgent);
  assert.notEqual(options.rejectUnauthorized,false);assert.equal(options.ca,undefined);
  assert.notEqual(options.agent.options.rejectUnauthorized,false);assert.equal(options.agent.options.ca,undefined);
  assert.equal(options.headers[id==='anthropic'?'x-api-key':id==='openai'?'authorization':'x-goog-api-key'],id==='openai'?'Bearer synthetic-test-credential':'synthetic-test-credential');
  const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;callback(res);res.emit('data',Buffer.from('{}'));res.emit('end');});return req;
 });
 for(const id of Object.keys(providers))await callProvider(id,{},'synthetic-test-credential');
 assert.equal(count,3);
});

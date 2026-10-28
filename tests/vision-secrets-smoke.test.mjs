// Offline smoke transport tests; no GitHub secret writes or paid model calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {photoPayload,decodePhotos,runnerDirectory,MAX_CHUNKS,CHUNK_SIZE,browserPhotoBundle,receiveBrowserPhotos,BROWSER_PHOTO_REVISION} from '../scripts/vision-benchmark/secrets-smoke.mjs';
import {executeBenchmark,planBenchmark,providers,providerRequest} from '../scripts/vision-benchmark/core.mjs';
import {REVIEWED_AT} from '../scripts/vision-benchmark/spend.mjs';
import {seal,openEnvelope} from '../scripts/vision-benchmark/bundle.mjs';
const revision='b'.repeat(40),now=Date.parse(REVIEWED_AT)+60000;
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'gp-secrets-test-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const source=await sharp({create:{width:720,height:1000,channels:3,background:'white'}}).jpeg().withMetadata({orientation:6}).toBuffer();
async function setup(t){
 const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const front=path.join(dir,'source.jpeg');fs.writeFileSync(front,source);
 const payload=await photoPayload(front,front,revision,{now});
 const env={VISION_BENCH_PHOTO_META:JSON.stringify(payload.metadata),...Object.fromEntries(payload.chunks.map((c,i)=>[`VISION_BENCH_PHOTO_${String(i).padStart(2,'0')}`,c]))};
 return {dir,front,payload,env};
}
const credentials=Object.fromEntries(Object.values(providers).map(p=>[p.key,'SYNTHETIC_TEST_ONLY']));
test('private photo secrets round-trip actual JPEG bytes, rotate EXIF and remove metadata',async t=>{
 t.mock.method(Date,'now',()=>now);const {dir,env,payload}=await setup(t);
 assert.ok(payload.chunks.length<=MAX_CHUNKS);assert.ok(payload.chunks.every(c=>Buffer.byteLength(c)<=CHUNK_SIZE));
 const manifest=await decodePhotos(env,path.join(dir,'decoded'),revision,{now});
 assert.equal(manifest.executionProfile,'provider_smoke_unscored');assert.equal(manifest.maxRequests,3);assert.equal(manifest.repeats,1);
 assert.equal(manifest.groundTruth,undefined);assert.equal(manifest.fixtures[0].groundTruth,undefined);
 const front=manifest.fixtures[0].front,bytes=fs.readFileSync(front.path),meta=await sharp(bytes).metadata();
 assert.equal(hash(bytes),front.sha256);assert.equal(meta.width,1000);assert.equal(meta.height,720);assert.equal(meta.exif,undefined);
 assert.equal(fs.statSync(front.path).mode&0o777,0o600);assert.equal(fs.statSync(path.dirname(front.path)).mode&0o777,0o700);
 assert.equal(planBenchmark(manifest,{live:true,authorized:true,env:credentials}).status,'READY_FOR_AUTHORIZED_CALLS');
});
test('partial/stale/wrong-revision/oversized secret payloads fail before files or paid calls',async t=>{
 t.mock.method(Date,'now',()=>now);const {dir,env}=await setup(t);
 for(const altered of [{...env,VISION_BENCH_PHOTO_00:''},{...env,VISION_BENCH_PHOTO_00:env.VISION_BENCH_PHOTO_00+'x'},{...env,VISION_BENCH_PHOTO_META:'null'},{...env,VISION_BENCH_PHOTO_00:'x'.repeat(CHUNK_SIZE+1)}])await assert.rejects(()=>decodePhotos(altered,path.join(dir,'absent'),revision,{now}));
 await assert.rejects(()=>decodePhotos(env,path.join(dir,'absent'),'c'.repeat(40),{now}),/metadata/);
 await assert.rejects(()=>decodePhotos(env,path.join(dir,'absent'),revision,{now:now+25*3600000}),/context/);
 assert.equal(fs.existsSync(path.join(dir,'absent')),false);
});
test('malformed and too-small images fail admission without manufacturing input data',async t=>{
 t.mock.method(Date,'now',()=>now);const {dir,front}=await setup(t);fs.writeFileSync(front,'invalid image');
 await assert.rejects(()=>photoPayload(front,front,revision,{now}));
 fs.writeFileSync(front,await sharp({create:{width:100,height:100,channels:3,background:'white'}}).jpeg().toBuffer());
 const p=await photoPayload(front,front,revision,{now});const env={VISION_BENCH_PHOTO_META:JSON.stringify(p.metadata),VISION_BENCH_PHOTO_00:p.chunks[0]};
 await assert.rejects(()=>decodePhotos(env,path.join(dir,'small'),revision,{now}),/dimensions/);
 assert.equal(fs.existsSync(path.join(dir,'small')),false);
});
test('unscored smoke reuses evaluator, sends identical blind inputs and performs at most three mocked requests',async t=>{
 t.mock.method(Date,'now',()=>now);const {dir,env}=await setup(t),m=await decodePhotos(env,path.join(dir,'photos'),revision,{now});
 m.spendPolicy.requireJournal=false;
 const images=['front','back'].map(side=>({buffer:fs.readFileSync(m.fixtures[0][side].path),mime:'image/jpeg'}));let calls=0;
 const result=await executeBenchmark(m,new Map([['original',images]]),{transport:async(id,payload)=>{
  calls++;assert.deepEqual(payload,providerRequest(id, id==='google'?payload.contents[0].parts[0].text:id==='openai'?payload.input[0].content[0].text:payload.messages[0].content.at(-1).text,images));
  assert.doesNotMatch(JSON.stringify(payload),/Pikachu|30th Celebration|149\/128/);
  const text=JSON.stringify({identifiedSubject:'SYNTHETIC_RESPONSE_ONLY'});
  return id==='anthropic'?{model:providers[id].model,content:[{type:'text',text}],usage:{input_tokens:100,output_tokens:50}}:id==='openai'?{model:providers[id].model,output:[{content:[{type:'output_text',text}]}],usage:{input_tokens:100,output_tokens:50}}:{modelVersion:providers[id].model,candidates:[{content:{parts:[{text}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:50}};
 }});
 assert.equal(calls,3);assert.equal(result.accuracyScored,false);assert.equal(result.summaries,undefined);assert.equal(result.rows.length,3);
 assert.ok(result.rows.every(r=>r.assessment.identifiedSubject==='SYNTHETIC_RESPONSE_ONLY'&&r.exactIdentity===undefined));
 assert.ok(result.spendReservation.reservedMaximumUSD<=.75);assert.equal(result.testOnly,true);
 // Missing labels still block the actual scored benchmark, and unscored scope cannot expand.
 const scored={...m,executionProfile:'provider_smoke'};assert.equal(planBenchmark(scored,{live:true,authorized:true,env:credentials}).status,'BLOCKED');
 assert.equal(planBenchmark({...m,maxRequests:18},{live:true,authorized:true,env:credentials}).status,'BLOCKED');
});
test('private encrypted assessment artifact requires the owner key and exact revision',()=>{
 const key=randomBytes(32).toString('base64'),privateText='SYNTHETIC PRIVATE ASSESSMENT';
 const cipher=seal({assessments:[{assessment:privateText}]},key,{purpose:'metrics',revision,now});
 assert.equal(cipher.includes(Buffer.from(privateText)),false);
 assert.equal(openEnvelope(cipher,key,{purpose:'metrics',revision,now}).assessments[0].assessment,privateText);
 assert.throws(()=>openEnvelope(cipher,randomBytes(32).toString('base64'),{purpose:'metrics',revision,now}));
 assert.throws(()=>openEnvelope(cipher,key,{purpose:'metrics',revision:'c'.repeat(40),now}));
});
test('workflow permits only smoke, scopes secrets, and uploads only ciphertext with one-day retention',()=>{
 const yaml=fs.readFileSync('.github/workflows/vision-benchmark.yml','utf8');
 assert.doesNotMatch(yaml,/BUNDLE_URL|RESULTS_URL|STORAGE_HOST|toJSON\(secrets\)|- full/);
 assert.equal([...yaml.matchAll(/VISION_BENCH_PHOTO_\d\d:/g)].length,0);
 assert.match(yaml,/inputs.mode == 'smoke'/);assert.match(yaml,/LIVE_ENABLED == 'true'/);
 assert.match(yaml,/retention-days: 1/);assert.match(yaml,/path:.*gp-encrypted-smoke\/assessments.enc/);
 assert.match(yaml,/permissions:\n  contents: read/);assert.doesNotMatch(yaml,/GITHUB_STEP_SUMMARY|contents: write|id-token: write/);
 const receiver=yaml.split('- name: Decrypt private')[1].split('- name: Run the existing')[0];assert.doesNotMatch(receiver,/ANTHROPIC_KEY|OPENAI_KEY|GEMINI_KEY/);
 const provider=yaml.split('- name: Run the existing')[1].split('- name: Encrypt private')[0];assert.doesNotMatch(provider,/PHOTO_|DATA_KEY/);
 assert.throws(()=>runnerDirectory({RUNNER_TEMP:process.cwd()}),/private_temp/);
});


test('browser ciphertext round-trip reuses admission, rejects wrong keys/tampering/expired inputs',async t=>{
 t.mock.method(Date,'now',()=>now);const {dir,front}=await setup(t),key=randomBytes(32).toString('base64');
 const encrypted=await browserPhotoBundle(front,front,key,{now});
 assert.equal(encrypted.includes(source),false);assert.equal(encrypted.includes(Buffer.from(key)),false);
 const m=await receiveBrowserPhotos(encrypted,key,path.join(dir,'browser'),{now});
 assert.equal(m.maxRequests,3);assert.equal(m.executionProfile,'provider_smoke_unscored');
 await assert.rejects(()=>receiveBrowserPhotos(encrypted,randomBytes(32).toString('base64'),path.join(dir,'bad'),{now}));
 const corrupt=Buffer.from(encrypted);corrupt[corrupt.length-1]^=1;
 await assert.rejects(()=>receiveBrowserPhotos(corrupt,key,path.join(dir,'bad'),{now}));
 await assert.rejects(()=>receiveBrowserPhotos(encrypted,key,path.join(dir,'bad'),{now:now+25*3600000}),/expired/);
 assert.throws(()=>openEnvelope(encrypted,key,{purpose:'smoke-photos',revision:BROWSER_PHOTO_REVISION,now:now+25*3600000,allowExpiredMetrics:true}),/expired/);
 assert.throws(()=>seal({},key,{purpose:'photos',revision:BROWSER_PHOTO_REVISION,ttlMs:24*3600000}),/policy/);
 assert.equal(fs.existsSync(path.join(dir,'bad')),false);
});

#!/usr/bin/env node
// Smoke-only encrypted photo input; no external storage or model calls here.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {liveContext,configureProfile} from './actions.mjs';
import {seal,openEnvelope,dataKey} from './bundle.mjs';
import {createSpendGuard} from './spend.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const CHUNK_SIZE=32000,MAX_CHUNKS=48;
// Input format anchor, separate from the executing workflow SHA (which includes
// the ciphertext itself). The live approval gate still checks the actual run SHA.
export const BROWSER_PHOTO_REVISION='f390b32987a79d2c9c075af62eba459d4c627c0b';
export async function browserPhotoBundle(front,back,key,{now=Date.now()}={}){
 const payload=await photoPayload(front,back,BROWSER_PHOTO_REVISION,{now});
 return seal(payload,key,{purpose:'smoke-photos',revision:BROWSER_PHOTO_REVISION,now,ttlMs:24*60*60000});
}
export async function receiveBrowserPhotos(encrypted,key,directory,{now=Date.now()}={}){
 const payload=openEnvelope(encrypted,key,{purpose:'smoke-photos',revision:BROWSER_PHOTO_REVISION,now});
 const env={VISION_BENCH_PHOTO_META:JSON.stringify(payload.metadata),...Object.fromEntries(payload.chunks.map((c,i)=>[name(i),c]))};
 return decodePhotos(env,directory,BROWSER_PHOTO_REVISION,{now});
}
const digest=b=>createHash('sha256').update(b).digest('hex');
const name=i=>`VISION_BENCH_PHOTO_${String(i).padStart(2,'0')}`;
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value),{mode:0o600,flag:'wx'});
function option(args,key){const i=args.indexOf(key);if(i<0||typeof args[i+1]!=='string'||args[i+1].startsWith('--'))throw Error('required_option');return args[i+1];}
export async function photoPayload(front,back,revision,{now=Date.now()}={}) {
 if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('revision_required');
 const photos=[];
 for(const file of [front,back]){
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size>12*1024*1024)throw Error('source_photo_size');
  // Fixed high-quality preparation, EXIF rotation and metadata removal. No fallback
  // to aggressive compression just to fit secret limits; reject instead.
  const bytes=await sharp(file,{limitInputPixels:40000000}).rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
  if(bytes.length>700000)throw Error('prepared_photo_too_large');
  photos.push({sha256:digest(bytes),base64:bytes.toString('base64')});
 }
 const json=JSON.stringify({version:1,revision,expiresAt:now+24*60*60000,photos});
 if(Buffer.byteLength(json)>CHUNK_SIZE*MAX_CHUNKS)throw Error('photo_secret_capacity');
 const chunks=json.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`,'g'));
 return {chunks,metadata:{version:1,revision,count:chunks.length,sha256:digest(json)}};
}
export async function decodePhotos(env,directory,revision,{now=Date.now()}={}) {
 const meta=JSON.parse(env.VISION_BENCH_PHOTO_META||'null');
 if(meta?.version!==1||meta.revision!==revision||!Number.isInteger(meta.count)||meta.count<1||meta.count>MAX_CHUNKS||!/^[a-f0-9]{64}$/.test(meta.sha256||''))throw Error('photo_metadata');
 let json='';for(let i=0;i<meta.count;i++){const chunk=env[name(i)];if(!chunk||Buffer.byteLength(chunk)>CHUNK_SIZE)throw Error('photo_chunk');json+=chunk;}
 if(digest(json)!==meta.sha256)throw Error('photo_hash');
 const value=JSON.parse(json);
 if(value.version!==1||value.revision!==revision||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+24*60*60000||value.photos?.length!==2)throw Error('photo_context');
 const specs=[],prepared=[];
 // Validate both images before creating files. Fixed filenames; incoming paths ignored.
 for(const photo of value.photos){
  if(typeof photo.base64!=='string'||photo.base64.length>1000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64))throw Error('photo_encoding');
  const bytes=Buffer.from(photo.base64,'base64');if(bytes.length>700000||digest(bytes)!==photo.sha256)throw Error('photo_hash');
  const m=await sharp(bytes,{limitInputPixels:40000000}).metadata();if(m.format!=='jpeg')throw Error('photo_format');
  prepared.push({buffer:bytes,mime:'image/jpeg'});
  specs.push({path:path.join(directory,specs.length?'back.jpeg':'front.jpeg'),sha256:photo.sha256});
 }
 const manifest=configureProfile({fixtures:[{id:'original',category:'pokemon',consentToProviderUpload:true,rightsReference:'Owner explicitly supplies these private photos for authorized three-provider smoke only',front:specs[0],back:specs[1]}]},'smoke');
 manifest.executionProfile='provider_smoke_unscored';
 // Reuse the same pre-request image/budget checks. This admission-only call has no journal or transport.
 await createSpendGuard({...manifest,spendPolicy:{...manifest.spendPolicy,requireJournal:false}},new Map([['original',prepared]]));
 fs.mkdirSync(directory,{mode:0o700});
 specs.forEach((spec,i)=>fs.writeFileSync(spec.path,prepared[i].buffer,{flag:'wx',mode:0o600}));
 return manifest;
}
export function runnerDirectory(env=process.env){
 if(!env.RUNNER_TEMP)throw Error('runner_temp_required');
 const temp=fs.realpathSync(env.RUNNER_TEMP);if(temp===root||temp.startsWith(root+path.sep))throw Error('private_temp_required');
 return path.join(temp,'gp-secrets-smoke');
}
function approved(){const context=liveContext();if(context.mode!=='smoke')throw Error('smoke_only');return context;}
async function receive(){
 const {revision}=approved(),dir=runnerDirectory();dataKey(process.env.VISION_BENCH_DATA_KEY);fs.mkdirSync(dir,{mode:0o700});
 const bundle=fs.readFileSync(path.join(root,'benchmarks/private-smoke.enc'));
 const manifest=await receiveBrowserPhotos(bundle,process.env.VISION_BENCH_DATA_KEY,path.join(dir,'photos'));write(path.join(dir,'manifest.json'),manifest);
 console.log('Private smoke pair validated; zero provider requests.');
}
async function run(){
 approved();const dir=runnerDirectory(),raw=path.join(dir,'raw.json');let failed=false;
 // Do not allow input chunks, encryption keys or debug switches in the evaluator.
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^VISION_BENCH_PHOTO_|^VISION_BENCH_DATA_KEY$|^(?:DEBUG|NODE_DEBUG|NODE_OPTIONS)$/.test(k)));
 env.VISION_BENCH_JOURNAL=path.join(dir,'journal.json');
 try{execFileSync(process.execPath,['scripts/benchmark-vision.mjs','--manifest',path.join(dir,'manifest.json'),'--output',raw,'--live','--authorize-paid-calls'],{cwd:root,env,stdio:'pipe',timeout:12*60000,maxBuffer:1024*1024});}catch{failed=true;}
 // Child output is captured, never printed. Raw assessments remain runner-private.
 if(failed||!fs.existsSync(raw)||JSON.parse(fs.readFileSync(raw)).status!=='SMOKE_COMPLETE_UNSCORED')throw Error('smoke_incomplete');
 console.log('Three provider responses completed; assessments are private and unscored.');
}
async function encrypt(){
 const {revision}=approved(),dir=runnerDirectory(),file=path.join(dir,'raw.json');
 const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{status:'FAILED_OR_UNKNOWN',providerRequestsAttempted:null};
 const journal=path.join(dir,'journal.json');
 // Only selected assessment fields, timing/usage/model metadata and generic errors.
 // No provider HTTP response, credentials, image bytes, paths or manifests.
 const result={version:1,revision,status:report.status,accuracyScored:false,providerRequestsAttempted:report.providerRequestsAttempted,
  reservation:fs.existsSync(journal)?JSON.parse(fs.readFileSync(journal)):null,
  assessments:(report.rows||[]).map(r=>({provider:r.provider,requestedModel:r.requestedModel,returnedModel:r.returnedModel,assessment:r.assessment,error:r.error,latencyMs:r.latencyMs,usage:r.usage,estimatedCostUSD:r.estimatedCostUSD}))};
 const encrypted=seal(result,process.env.VISION_BENCH_DATA_KEY,{purpose:'metrics',revision});
 const artifact=path.join(process.env.RUNNER_TEMP,'gp-encrypted-smoke');fs.mkdirSync(artifact,{mode:0o700});fs.writeFileSync(path.join(artifact,'assessments.enc'),encrypted,{flag:'wx',mode:0o600});
 console.log('Encrypted assessments ready; no plaintext results published.');
}
async function install(args){
 const arg=k=>option(args,k);
 if(!args.includes('--consent-provider-upload'))throw Error('photo_upload_consent_required');
 const revision=arg('--revision'),privateDir=path.resolve(arg('--private-dir')||'');
 fs.mkdirSync(privateDir,{recursive:true,mode:0o700});const real=fs.realpathSync(privateDir);
 if(real===root||real.startsWith(root+path.sep)||fs.existsSync(path.join(real,'data-key.txt')))throw Error('new_private_directory_required');
 const payload=await photoPayload(arg('--front'),arg('--back'),revision);
 const key=randomBytes(32).toString('base64');fs.writeFileSync(path.join(real,'data-key.txt'),key,{flag:'wx',mode:0o600});
 write(path.join(real,'setup.json'),{revision,count:payload.chunks.length});
 const set=(secret,value)=>execFileSync('gh',['secret','set',secret,'--repo','gempredict/gempredict-live','--env','vision-benchmark'],{input:value,stdio:['pipe','pipe','pipe']});
 // Publish metadata last: partial uploads cannot pass the combined hash check.
 set('VISION_BENCH_PHOTO_META','invalid');
 for(let i=0;i<payload.chunks.length;i++)set(name(i),payload.chunks[i]);
 set('VISION_BENCH_DATA_KEY',key);set('VISION_BENCH_PHOTO_META',JSON.stringify(payload.metadata));
 console.log('Private smoke secrets installed. Keep the local key file for decryption. Live remains disabled.');
}
async function main(){
 const [phase,...args]=process.argv.slice(2);
 if(phase==='receive')return receive();if(phase==='run')return run();if(phase==='encrypt')return encrypt();
 if(phase==='cleanup'){fs.rmSync(runnerDirectory(),{recursive:true,force:true});fs.rmSync(path.join(process.env.RUNNER_TEMP,'gp-encrypted-smoke'),{recursive:true,force:true});return;}
 if(phase==='install')return install(args);
 if(phase==='clear'){
  // No provider credentials or existing environment settings are touched.
  const names=JSON.parse(execFileSync('gh',['secret','list','--repo','gempredict/gempredict-live','--env','vision-benchmark','--json','name'],{encoding:'utf8',stdio:'pipe'}));
  for(const {name:secret} of names.filter(s=>/^VISION_BENCH_(?:PHOTO_(?:META|[0-9]{2})|DATA_KEY)$/.test(s.name)))execFileSync('gh',['secret','delete',secret,'--repo','gempredict/gempredict-live','--env','vision-benchmark'],{stdio:'pipe'});
  console.log('Temporary photo and encryption secrets removed; provider keys unchanged.');
  return;
 }
 if(phase==='open'){
  const arg=k=>option(args,k),out=path.resolve(arg('--output'));const parent=fs.realpathSync(path.dirname(out));
  if(parent===root||parent.startsWith(root+path.sep)||fs.existsSync(out))throw Error('private_new_output_required');
  const result=openEnvelope(fs.readFileSync(arg('--input')),fs.readFileSync(arg('--key-file'),'utf8').trim(),{purpose:'metrics',revision:arg('--revision'),allowExpiredMetrics:true});
  write(out,result);console.log('Private assessments decrypted locally.');return;
 }
 throw Error('unknown_phase');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Smoke stopped safely. No private details were logged.');process.exitCode=1;});

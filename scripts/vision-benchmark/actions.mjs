#!/usr/bin/env node
// GitHub Actions orchestrator. Reuses scripts/benchmark-vision.mjs verbatim as
// the evaluator; this file handles private inputs, approvals and metric delivery.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes,createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {seal,openEnvelope,packPhotos,unpackPhotos,requestObject,storageUrl,dataKey} from './bundle.mjs';
import {REVIEWED_AT,REVIEWED_RATES,PROFILES} from './spend.mjs';
import {sanitizedMetrics} from './metrics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function liveContext(env=process.env) {
 const mode=env.BENCH_MODE;
 if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||!PROFILES[mode]||env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_REPOSITORY!=='gempredict/gempredict-live'||env.GITHUB_REF!=='refs/heads/restore/phase1-identity-market-matching'||env.GITHUB_RUN_ATTEMPT!=='1'||!/^\d+$/.test(env.BENCH_OWNER_ID||'')||env.GITHUB_ACTOR_ID!==env.BENCH_OWNER_ID||env.BENCH_LIVE_ENABLED!=='true'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||''))throw Error('live_context_not_approved');
 const required=mode==='smoke'?'AUTHORIZE_SMOKE_0_75_USD':'AUTHORIZE_FULL_4_25_USD';
 if(env.BENCH_CONFIRMATION!==required)throw Error('live_confirmation_required');
 return {mode,revision:env.GITHUB_SHA};
}
function privateRoot(env=process.env) {
 if(!env.RUNNER_TEMP)throw Error('runner_temp_required');
 const temp=fs.realpathSync(env.RUNNER_TEMP),dir=path.join(temp,'gp-private-vision');
 if(temp===root||temp.startsWith(root+path.sep))throw Error('runner_temp_must_be_outside_checkout');
 return dir;
}
function writeJson(file,value){fs.writeFileSync(file,JSON.stringify(value),{mode:0o600});fs.chmodSync(file,0o600);}
export function configureProfile(manifest,mode) {
 const profile=PROFILES[mode];if(!profile)throw Error('unknown_profile');
 return {...manifest,fixtures:mode==='smoke'?[manifest.fixtures[0]]:manifest.fixtures,repeats:profile.repeats,maxRequests:profile.requests,maxEstimatedCostUSD:profile.maxUSD,
  executionProfile:mode==='smoke'?'provider_smoke':'comparison',rates:structuredClone(REVIEWED_RATES),ratesAsOf:REVIEWED_AT,spendPolicy:{version:1,profile:mode,ratesReviewedAt:REVIEWED_AT,requireJournal:true}};
}
async function dryRun() {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gp-vision-dry-'));fs.chmodSync(dir,0o700);
 try{
  // No inherited provider secrets, even if run locally in a configured shell.
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(?:KEY|TOKEN|SECRET|PASSWORD|BUNDLE_URL|RESULTS_URL)$/i.test(k)));
  let exit=0;
  try{execFileSync(process.execPath,['scripts/benchmark-vision.mjs','--manifest','benchmarks/vision.example.json','--output',path.join(dir,'dry.json')],{cwd:root,env,stdio:'pipe',timeout:30000});}catch(error){exit=error.status;}
  const report=JSON.parse(fs.readFileSync(path.join(dir,'dry.json')));
  if(exit!==2||report.status!=='BLOCKED'||report.providerRequestsAttempted!==0||report.plannedRequests!==18||report.realModelAccuracyClaim!=='NONE')throw Error('dry_run_boundary_failed');
  console.log('PASS credential-free benchmark dry-run: BLOCKED as expected; zero provider requests.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
async function fetchPrivate() {
 const context=liveContext(),dir=privateRoot();fs.mkdirSync(dir,{mode:0o700});
 storageUrl(process.env.VISION_BENCH_RESULTS_URL,process.env.BENCH_STORAGE_HOST);
 const encrypted=await requestObject(process.env.VISION_BENCH_BUNDLE_URL,process.env.BENCH_STORAGE_HOST);
 const value=openEnvelope(encrypted,process.env.VISION_BENCH_DATA_KEY,{purpose:'photos',revision:context.revision});
 const manifest=unpackPhotos(value,path.join(dir,'photos'));
 writeJson(path.join(dir,'manifest.json'),configureProfile(manifest,context.mode));
 const datasetCommitment=createHmac('sha256',dataKey(process.env.VISION_BENCH_DATA_KEY)).update(JSON.stringify(value.manifest.fixtures.map(f=>[f.front.sha256,f.back.sha256,f.groundTruth]))).digest('hex');
 writeJson(path.join(dir,'dataset.json'),{datasetCommitment});
 // Verify the private result channel before a model request. The final encrypted
 // metrics overwrite this encrypted zero-request receipt at the same object.
 const receipt=seal({version:1,status:'INPUTS_VALIDATED_NO_MODEL_REQUESTS',attemptedRequests:0,datasetCommitment,...context},process.env.VISION_BENCH_DATA_KEY,{purpose:'metrics',revision:context.revision});
 await requestObject(process.env.VISION_BENCH_RESULTS_URL,process.env.BENCH_STORAGE_HOST,{method:'PUT',body:receipt});
 console.log('Private input bundle validated.');
}
async function runPrivate() {
 const context=liveContext(),dir=privateRoot(),reportPath=path.join(dir,'raw.json'),journalPath=path.join(dir,'journal.json');
 let exit=0;
 try{execFileSync(process.execPath,['scripts/benchmark-vision.mjs','--manifest',path.join(dir,'manifest.json'),'--output',reportPath,'--live','--authorize-paid-calls'],{
  cwd:root,env:{...process.env,DEBUG:'',NODE_DEBUG:'',NODE_OPTIONS:'',VISION_BENCH_JOURNAL:journalPath},stdio:'pipe',timeout:12*60000,maxBuffer:1024*1024,
 });}catch(error){exit=error.status||1;}
 const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)):{status:'FAILED_OR_UNKNOWN',providerRequestsAttempted:null};
 const journal=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath)):null;
 const metrics=sanitizedMetrics(report,journal,context);
 metrics.datasetCommitment=JSON.parse(fs.readFileSync(path.join(dir,'dataset.json'))).datasetCommitment;
 writeJson(path.join(dir,'metrics.json'),metrics);
 if(exit!==0||report.status!=='COMPLETE_NOT_AUTOMATIC_APPROVAL')throw Error('live_benchmark_did_not_complete');
 console.log('Benchmark completed; comparison metrics are private.');
}
async function deliverPrivate() {
 const context=liveContext(),dir=privateRoot(),file=path.join(dir,'metrics.json');
 if(!fs.existsSync(file)){console.log('No comparison metrics were produced.');return;}
 const metrics=JSON.parse(fs.readFileSync(file));
 const encrypted=seal(metrics,process.env.VISION_BENCH_DATA_KEY,{purpose:'metrics',revision:context.revision});
 await requestObject(process.env.VISION_BENCH_RESULTS_URL,process.env.BENCH_STORAGE_HOST,{method:'PUT',body:encrypted});
 console.log('Encrypted sanitized metrics delivered to the owner-controlled destination.');
}
async function main(){
 const args=process.argv.slice(2),arg=name=>args.includes(name)?args[args.indexOf(name)+1]:null,phase=args[0];
 if(phase==='dry-run')return dryRun();
 if(phase==='fetch')return fetchPrivate();
 if(phase==='run')return runPrivate();
 if(phase==='deliver')return deliverPrivate();
 if(phase==='cleanup'){fs.rmSync(privateRoot(),{recursive:true,force:true});return;}
 const output=arg('--output');
 if(!['keygen','seal-photos','open-metrics'].includes(phase)||!output)throw Error('invalid_command');
 const out=path.resolve(output),parent=path.dirname(out);fs.mkdirSync(parent,{recursive:true,mode:0o700});
 if(fs.realpathSync(parent)===root||fs.realpathSync(parent).startsWith(root+path.sep)||fs.existsSync(out))throw Error('private_new_output_required');
 if(phase==='keygen'){fs.writeFileSync(out,randomBytes(32).toString('base64'),{flag:'wx',mode:0o600});console.log('Private data key created; its value was not printed.');return;}
 const key=fs.readFileSync(arg('--key-file'),'utf8').trim(),revision=arg('--revision');
 if(phase==='seal-photos'){
  const source=path.resolve(arg('--manifest')),manifest=JSON.parse(fs.readFileSync(source));
  const value=packPhotos(manifest,path.dirname(source));fs.writeFileSync(out,seal(value,key,{purpose:'photos',revision}),{flag:'wx',mode:0o600});
 }else{
  const value=openEnvelope(fs.readFileSync(arg('--input')),key,{purpose:'metrics',revision,allowExpiredMetrics:true});writeJson(out,value);
 }
 console.log('Private output written; contents were not printed.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Vision benchmark stopped safely; inspect private configuration or contact the owner. No private error details were printed.');process.exitCode=1;});

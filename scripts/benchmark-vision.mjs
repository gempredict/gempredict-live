#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {planBenchmark,executeBenchmark,hash} from './vision-benchmark/core.mjs';
const args=process.argv.slice(2),value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:null;
const manifestPath=path.resolve(value('--manifest')||'benchmarks/vision.example.json'),output=path.resolve(value('--output')||'/tmp/gempredict-vision-benchmark.json');
if(output===manifestPath)throw Error('benchmark_output_must_not_overwrite_manifest');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const plan=planBenchmark(manifest,{live:args.includes('--live'),authorized:args.includes('--authorize-paid-calls')});
let result=plan,executionStarted=false;
if(plan.status==='READY_FOR_AUTHORIZED_CALLS'){
 try{
  const {prepareRealPhotos}=await import('./vision-benchmark/prepare.mjs');
  const prepared=await prepareRealPhotos(manifest,path.dirname(manifestPath));
  executionStarted=true;
  result={...plan,...await executeBenchmark({...manifest,paidCallsAuthorized:true},prepared)};
 }catch{result={...plan,status:'BLOCKED',blockers:[executionStarted?'benchmark_execution_failed':'real_photo_validation_or_local_preparation_failed'],providerCallsPerformed:executionStarted?null:0};}
}
const report={...result,codeRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),manifestFingerprint:hash(manifest),providerRequestsAttempted:result.providerCallsPerformed===null?null:result.rows?.filter(row=>row.requestAttempted!==false).length||0,rateBasis:{table:manifest.rates,asOf:manifest.ratesAsOf||null,kind:'user_reviewed_token_rate_estimate_not_invoice'},realModelAccuracyClaim:result.status==='COMPLETE_NOT_AUTOMATIC_APPROVAL'?'Measured against user-supplied independent labels; review required':'NONE'};
fs.writeFileSync(output,JSON.stringify(report,null,2),{mode:0o600});fs.chmodSync(output,0o600);console.log(JSON.stringify({status:report.status,plannedRequests:plan.plannedRequests,output,blockers:report.blockers||[]}));
if(report.status!=='COMPLETE_NOT_AUTOMATIC_APPROVAL')process.exitCode=2;

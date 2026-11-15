import {evaluateReferenceScorecard,referenceScorecardMarkdown} from '../lib/referenceValidation.mjs';
import {readControlledValidationAttempt} from '../lib/referenceValidationFiles.mjs';
import {readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sanitizeObservation,evaluateBenchmark,benchmarkMarkdown} from '../lib/identificationBenchmark.mjs';
const fields={subject:'identifiedSubject',year:'identifiedYear',set:'identifiedBrandSet',cardNumber:'identifiedCardNumber',manufacturer:'identifiedManufacturer',language:'identifiedLanguage',rarity:'identifiedRarity',parallel:'identifiedParallel',franchise:'identifiedFranchise',autoOrRelic:'identifiedAutoOrRelic'};
function canonical(c){return {...c,set:c?.brandSet??c?.set,finish:c?.finish??c?.variant?.finish,serialNumber:c?.serialNumber};}
// Import an already owner-authorized exported report/diagnostic, never a ticket,
// photograph, provider request/response, network URL or environment credential.
export function importScanEvidence(raw,{id,cardId,cohortId,attemptIndex,photoHashes={},evidenceDigest=null,allowControlledFull=false}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('benchmark_import_object_required');
 const controlledFull=allowControlledFull===true&&raw.version===1&&raw.environment==='preview'&&raw.stage==='full'&&raw.conditionValidation?.preparedImagesMatched===true&&raw.conditionValidation?.marketplace==='not_requested';
 const diagnostic=raw.version===1&&raw.environment==='preview'&&(raw.stage==='identity'||controlledFull);
 const report=raw.stage==='identity'&&typeof raw.success==='boolean';
 if(!diagnostic&&!report)throw Error('benchmark_import_requires_identity_report_or_exported_diagnostic');
 const original=diagnostic?raw.model?.originalIdentity:raw.originalIdentityObservation;
 const candidate=raw.identityVerification?.catalog?.candidate;
 const technical=diagnostic?{validCompletedResponse:(controlledFull||raw.stages?.identity==='completed')&&raw.responseStatus===200&&raw.visionStatus==='normalized'&&!raw.failureCode,httpStatus:raw.responseStatus,failureCode:raw.failureCode,phase:raw.identityValidation?.phase,rule:raw.identityValidation?.rule,stopReason:raw.identityCompletion?.stopReason}:{validCompletedResponse:raw.success===true,httpStatus:raw.success?200:null,failureCode:raw.errorCode||raw.code};
 const u=raw.identityCompletion?.usage;
 const usage=u?{inputTokens:u.inputTokens,outputTokens:u.outputTokens,cacheReadTokens:u.cacheReadInputTokens,cacheCreationTokens:u.cacheCreationInputTokens}:null;
 return sanitizeObservation({id,cardId,cohortId,attemptIndex,evidenceDigest,evidenceKind:'live_scan',deploymentCommit:diagnostic?raw.commit:null,scanId:raw.scanId,photoHashes,photoLinkage:{method:diagnostic?'diagnostic_prepared_sha256':null,preparedHashes:{front:diagnostic?raw.images?.front?.preparedSha256:null,back:diagnostic?raw.images?.back?.preparedSha256:null},backRequired:diagnostic?raw.images?.back?.presence==='present':null},
  technical,originalAI:Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,original?.[field]])),modelConfidence:original?.identityConfidence??raw.model?.uncertainty?.identityConfidence,
  canonical:canonical(diagnostic?raw.canonicalIdentity:raw.canonicalCard),
  printedReadings:diagnostic?[...(raw.identity?.printed?.setMarkings||[]).map(r=>({...r,field:'setCode'})),...(raw.model?.uncertainty?.readings||[])]:original?.identityReadings,
  catalog:{outcome:diagnostic?raw.identity?.catalogOutcome:raw.pokemonIdentityStatus?.catalogOutcome,reasonCodes:diagnostic?raw.identity?.catalogReasonCodes:raw.identityVerification?.catalog?.reasonCodes,conflicts:diagnostic?raw.catalogComparison?.finalConflicts:raw.catalogComparison?.finalConflicts,
   provenance:{provider:diagnostic?raw.identity?.catalogReference?.provider:raw.identityVerification?.catalog?.source,revision:raw.sourceCatalogEvidence?.source?.revision||raw.sourceCatalogEvidence?.revision,cardBlob:raw.sourceCatalogEvidence?.source?.cardBlob||raw.sourceCatalogEvidence?.cardBlob,setBlob:raw.sourceCatalogEvidence?.source?.setBlob||raw.sourceCatalogEvidence?.setBlob},candidatesRetained:false,candidates:candidate?[{provider:raw.identityVerification?.catalog?.source,id:raw.identityVerification.catalog.referenceId,identity:canonical(candidate)}]:[],selectedReference:diagnostic?raw.identity?.catalogReference:raw.identityVerification?.catalog?.referenceId?{provider:raw.identityVerification.catalog.source,id:raw.identityVerification.catalog.referenceId}:null},
  dimensions:{coreCatalog:diagnostic?raw.catalogComparison?.core?.status:raw.coreCatalogIdentity?.status,photo:diagnostic?raw.photoIdentity?.status:raw.photoIdentityStatus?.status,variant:diagnostic?raw.identity?.variantStatus:raw.variantVerification?.status,artwork:diagnostic?raw.identity?.artwork:raw.artworkStatus?.status,physicalPrinting:diagnostic?raw.identity?.physicalPrinting:raw.physicalPrintingStatus?.status,catalogPrinting:diagnostic?raw.catalogComparison?.printing?.status:raw.catalogComparison?.printing?.status},
  claims:{catalogVerified:diagnostic?raw.identity?.catalogVerified:raw.pokemonIdentityStatus?.catalogVerified,photoVerified:diagnostic?raw.photoIdentity?.photoSupported:raw.photoIdentityStatus?.photoSupported,printingVerified:diagnostic?null:raw.physicalPrintingStatus?.verified},
  usage,cost:{actualUsd:null,basis:null},latencyMs:null,
  unresolvedReasons:[...(raw.photoIdentity?.missingReadings||raw.photoIdentityStatus?.missingReadings||[]).map(k=>'missing_clear_'+k)],annotations:{possibleConflation:raw.sourceCatalogEvidence?.possibleCombinedMarking===true}});
}
function read(file){const text=readFileSync(file,'utf8');if(Buffer.byteLength(text)>2*1024*1024)throw Error('benchmark_input_too_large');return JSON.parse(text);}
export function main(args){
 const command=args[0],options={};for(let i=1;i<args.length;i+=2){if(!args[i]?.startsWith('--')||args[i+1]==null)throw Error('benchmark_arguments_invalid');options[args[i].slice(2)]=args[i+1];}
 function privateOutput(value){
  const root=path.resolve('benchmarks/identity/private'),output=path.resolve(value||'');
  if(!output.startsWith(root+path.sep))throw Error('validation_private_output_required');
  let current=path.resolve('.');for(const part of path.relative(current,output).split(path.sep)){current=path.join(current,part);try{if(lstatSync(current).isSymbolicLink())throw Error('validation_symlink_output_rejected');}catch(e){if(e.code!=='ENOENT')throw e;}}
  return output;
 }
 if(command==='scorecard'){
  const manifest=read(options.manifest||'benchmarks/identity/phase3l/manifest.json'),input=options.observations?read(options.observations):[];
  if(!Array.isArray(input))throw Error('validation_attempt_array_required');const result=evaluateReferenceScorecard(manifest,input);
  const output=input.length?privateOutput(options.output):options.output||'benchmarks/identity/phase3l/baseline';if(input.length){mkdirSync(path.dirname(output),{recursive:true,mode:0o700});mkdirSync(output,{mode:0o700});}else mkdirSync(output,{recursive:true,mode:0o700});
  writeFileSync(path.join(output,'scorecard.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});writeFileSync(path.join(output,'SCORECARD.md'),referenceScorecardMarkdown(result),{mode:0o600});
  console.log(`Controlled reference scorecard: ${result.status}; ${input.length} retained attempts. No scans executed.`);return;
 }
 if(command==='import-controlled'){
  const output=privateOutput(options.output),manifest=read(options.manifest||'benchmarks/identity/phase3l/manifest.json');
  return readControlledValidationAttempt(options,manifest,importScanEvidence).then(attempt=>{
   const result=evaluateReferenceScorecard(manifest,[attempt],{verifiedPreparedAttempts:new WeakSet([attempt])});privateOutput(options.output);mkdirSync(path.dirname(output),{recursive:true,mode:0o700});mkdirSync(output,{mode:0o700});
   for(const [name,data] of [['attempt.json',JSON.stringify(attempt,null,2)+'\n'],['scorecard.json',JSON.stringify(result,null,2)+'\n'],['SCORECARD.md',referenceScorecardMarkdown(result)]])writeFileSync(path.join(output,name),data,{flag:'wx',mode:0o600});
   console.log('Retained controlled evidence imported privately. No scan executed.');
  });
 }
 if(command==='import'){
  if(!options.input||!options.output||!options.id||!options.card||!options.cohort||!options.attempt)throw Error('benchmark_import_arguments_required');
  const photoHash=side=>{const file=options[side+'-file'],declared=options[side+'-hash'];if(!file)return declared;const actual=createHash('sha256').update(readFileSync(file)).digest('hex');if(declared&&declared!==actual)throw Error('benchmark_photo_file_hash_mismatch');return actual;};
  const result=importScanEvidence(read(options.input),{id:options.id,cardId:options.card,cohortId:options.cohort,attemptIndex:Number(options.attempt),evidenceDigest:createHash('sha256').update(readFileSync(options.input)).digest('hex'),photoHashes:{front:photoHash('front'),back:photoHash('back')}});
  if(!result.id||!result.cardId||!result.cohortId||!result.attemptIndex)throw Error('benchmark_import_identifiers_invalid');
  writeFileSync(options.output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});return;
 }
 if(command!=='report')throw Error('benchmark_command_must_be_report_or_import');
 const manifest=read(options.manifest||'benchmarks/identity/manifest.json'),input=read(options.observations||'benchmarks/identity/historical-observations.json');
 const result=evaluateBenchmark(manifest,input.observations||input);
 const output=options.output||'benchmarks/identity/results';mkdirSync(output,{recursive:true});
 writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});writeFileSync(path.join(output,'REPORT.md'),benchmarkMarkdown(result),{mode:0o600});
 console.log(`Benchmark report: ${result.completedAccuracyTests} completed accuracy tests; ${result.historical.observations} historical observations excluded from accuracy.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const run=main(process.argv.slice(2));if(run&&typeof run.then==='function')run.catch(()=>{console.error('Benchmark command failed: private evidence or metadata could not be validated. No input contents logged.');process.exitCode=1;});}catch{console.error('Benchmark command failed: check local JSON schema, identifiers and file permissions. No input contents were logged.');process.exitCode=1;}
}

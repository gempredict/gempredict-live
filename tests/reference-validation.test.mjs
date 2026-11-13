import {prepareDiagnosticExport} from '../lib/diagnosticExport.mjs';
// Synthetic software regressions, not measured real-card accuracy or new paid scans.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {compareReferenceFields,evaluateReferenceScorecard as evaluateUntrustedScorecard,referenceScorecardMarkdown,ownerReferenceBinding,controlledConditionEvidence} from '../lib/referenceValidation.mjs';
import {readControlledValidationAttempt} from '../lib/referenceValidationFiles.mjs';
import {importScanEvidence,main} from '../scripts/identity-benchmark.mjs';
import {runScan,confirmed} from './helpers/reconciliationPipeline.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const manifest=JSON.parse(fs.readFileSync('benchmarks/identity/phase3l/manifest.json','utf8')),pokemon=manifest.cards[0],sports=manifest.cards[1],revision=manifest.baselineCommit;
const fields=c=>Object.fromEntries(Object.entries(c.groundTruth.fields).map(([k,v])=>[k,v.value]));
// Explicit in-process file-audit context is mocked for pure evaluator unit cases only.
const evaluateReferenceScorecard=(m,a=[])=>evaluateUntrustedScorecard(m,a,{verifiedPreparedAttempts:new WeakSet(a)});
const baseline=()=>evaluateReferenceScorecard(manifest);
test('versioned references separate owner assertions, unknown attributes and unretained independent catalog support',()=>{
 assert.equal(pokemon.groundTruth.fields.year.value,'2019');assert.equal(sports.groundTruth.fields.cardNumber.value,'BCP-86');assert.equal(pokemon.groundTruth.fields.language.value,null);assert.equal(sports.groundTruth.fields.autoOrRelic.value,null);assert.equal(sports.groundTruth.fields.printRun.value,null);
 assert.match(pokemon.independentReferences[0].status,/not_independently_retained/);assert.equal(sports.independentReferences.length,0);assert.notEqual(pokemon.groundTruth.status,'independently_reviewed');
});
test('no new photographs or attempts means NOT RUN, no success rate, no fabricated scan outcome or paid cost',()=>{
 const b=baseline();assert.equal(b.status,'NOT RUN');assert.equal(b.accuracyRate,null);for(const c of b.rows){assert.equal(c.status,'NOT RUN');assert.equal(c.calls.paidModelCalls,0);assert.equal(c.calls.marketplaceCalls,0);assert.equal(c.costs.estimatedUsd,null);assert.equal(c.costs.observedUsd,0);assert.equal(c.attempts.length,0);assert.ok(Object.values(c.identityBaseline).every(f=>f.status==='NOT TESTED'));assert.ok(Object.values(c.conditionBaseline).every(f=>f.status==='NOT TESTED'));}
 assert.match(referenceScorecardMarkdown(b),/NOT RUN/);assert.match(referenceScorecardMarkdown(b),/\| Field.*\n\|---/);assert.doesNotMatch(referenceScorecardMarkdown(b),/100%|accuracy: PASS/);
});
test('exact per-field comparison rejects wrong Pokémon set, denominator and finish without model-confidence shortcuts',()=>{
 const correct=compareReferenceFields(pokemon,{...fields(pokemon),set:'Unified Minds'});assert.equal(correct.set.status,'PASS');assert.equal(correct.parallel.status,'PASS');assert.equal(correct.language.status,'UNRESOLVED');assert.equal(correct.parallel.independentlyVerified,false);
 for(const [field,value] of [['set','Cosmic Eclipse'],['year','2020'],['cardNumber','155/237'],['parallel','Holo'],['finish','normal']]){const x=compareReferenceFields(pokemon,{...fields(pokemon),[field]:value,confidence:100});assert.equal(x[field].status,'FAIL');}
 assert.equal(compareReferenceFields(pokemon,{...fields(pokemon),parallel:null}).parallel.status,'UNRESOLVED');
});
test('sports Mojo Refractor does not equate to generic Mojo, base, refractor, green or other Mojo treatments',()=>{
 assert.equal(compareReferenceFields(sports,fields(sports)).parallel.status,'PASS');assert.equal(compareReferenceFields(sports,{...fields(sports),parallel:'Mojo'}).parallel.status,'UNRESOLVED');
 for(const parallel of ['Base','Refractor','Green Mojo Refractor','Blue Mojo','Purple Mojo'])assert.equal(compareReferenceFields(sports,{...fields(sports),parallel}).parallel.status,'FAIL');
 assert.equal(compareReferenceFields(sports,{...fields(sports),cardNumber:'BCP-68'}).cardNumber.status,'FAIL');
});
function syntheticAttempt(c,patch={}){
 const h={front:'a'.repeat(64),back:'b'.repeat(64)};
 return {evidenceOrigin:'owner_exported_controlled_diagnostic',preparedPairVerified:true,observation:{id:'MOCK-ATTEMPT',cardId:c.id,cohortId:manifest.cohortId,attemptIndex:1,evidenceKind:'live_scan',deploymentCommit:revision,evidenceDigest:'c'.repeat(64),photoHashes:h,technical:{validCompletedResponse:true,httpStatus:200},originalAI:fields(c),canonical:fields(c),catalog:{outcome:'supported'},claims:{catalogVerified:!c.category.startsWith('sports'),printingVerified:true},dimensions:{physicalPrinting:'not_verified'}},referenceReview:{version:1,referenceManifestVersion:1,cardId:c.id,ownerApproved:true,physicalCardId:'MOCK-COPY',reviewer:'Synthetic test reviewer',reviewedAt:'2026-11-11',preparedHashes:h},conditionEvidence:{states:{corners:'unassessable'},findings:[],limitations:['glare']},...patch};
}
test('correct prediction and a claimed catalog flag never become physical printing, sports catalog or condition verification',()=>{
 for(const c of [pokemon,sports]){const a=syntheticAttempt(c),r=evaluateReferenceScorecard(manifest,[a]).rows.find(r=>r.cardId===c.id).attempts[0];assert.equal(r.prediction.subject.status,'PASS');assert.equal(r.status,'UNRESOLVED');assert.equal(r.exactPrinting.status,'UNRESOLVED');assert.equal(r.independentCatalog.status,'UNRESOLVED');assert.equal(r.condition.accuracy,'NOT TESTED');assert.ok(Object.values(r.condition.categories).every(v=>v.status==='NOT TESTED'));assert.equal(r.calls.paidModelCalls,null);assert.equal(r.costs.observedUsd,null);assert.equal(r.financialStatus,'WITHHELD');}
});
test('material original errors remain visible even if canonical identity corrects them; failed/truncated responses are not scored as identity successes',()=>{
 const a=syntheticAttempt(pokemon);a.observation.originalAI.set='Cosmic Eclipse';const out=evaluateReferenceScorecard(manifest,[a]).rows[0].attempts[0];assert.equal(out.status,'FAIL');assert.equal(out.prediction.set.status,'FAIL');assert.equal(out.canonical.set.status,'PASS');assert.ok(out.reasons.includes('material_set_mismatch'));
 for(const code of ['ANALYSIS_RESPONSE_INCOMPLETE','ANALYSIS_RESPONSE_INVALID','ANALYSIS_EMPTY_RESPONSE']){const f=syntheticAttempt(pokemon);f.observation.technical={validCompletedResponse:false,httpStatus:502,failureCode:code,rule:code==='ANALYSIS_RESPONSE_INCOMPLETE'?'output_limit':'json_syntax'};const r=evaluateReferenceScorecard(manifest,[f]).rows[0].attempts[0];assert.equal(r.technical.status,'FAIL');assert.equal(r.status,'FAIL');assert.equal(r.prediction.subject.status,'NOT TESTED');assert.equal(r.technical.reason,code);}
});
test('file hashes alone cannot approve the reference; excluded synthetic and historical fixtures cannot become real trials',()=>{
 const a=syntheticAttempt(pokemon);assert.equal(ownerReferenceBinding(null,pokemon,a.observation.photoHashes),false);a.referenceReview.ownerApproved=false;const r=evaluateReferenceScorecard(manifest,[a]).rows[0].attempts[0];assert.equal(r.photoLinkage.ownerReferenceBound,false);assert.equal(r.prediction.subject.status,'NOT TESTED');
 for(const kind of ['synthetic','owner_reported_summary']){const x=syntheticAttempt(pokemon);x.observation.evidenceKind=kind;x.evidenceOrigin=kind;const scored=evaluateReferenceScorecard(manifest,[x]);assert.equal(scored.rows[0].status,'NOT RUN');assert.equal(scored.rows[0].attempts[0].status,'NOT TESTED');assert.equal(scored.accuracyRate,null);}
});
test('diagnostics keep individual side/certainty decisions but cannot invent exact defect coordinates or human correctness',()=>{
 const e=controlledConditionEvidence({model:{observations:[{attribute:'corners',side:'back',code:'whitening',result:'suspected',accepted:true,downgraded:true,reasons:['global_photo_limitation']}],photoLimitations:['perspective'],coverageSummary:{field:'missing',rows:0}},finalPresentation:{states:{corners:'suspected_defect'}}});assert.equal(e.findings.length,1);assert.equal(e.findings[0].region,null);assert.equal(e.findings[0].side,'back');assert.equal(e.findings[0].certainty,'suspected');assert.equal(e.states.corners,'suspected_defect');assert.equal(e.coverage.field,'missing');
 const a=syntheticAttempt(pokemon,{conditionEvidence:e});a.referenceReview.conditionReview={ownerApproved:true,referenceAssessmentId:'MOCK-REF',adjudicationId:'MOCK-REF',diagnosticSha256:'c'.repeat(64),categories:{corners:'PASS'}};assert.equal(evaluateReferenceScorecard(manifest,[a]).rows[0].attempts[0].condition.accuracy,'NOT TESTED');
});
test('known multiple paid calls or marketplace traffic is a visible controlled-budget failure, not averaged away',()=>{
 const a=syntheticAttempt(sports);a.referenceReview.callAudit={paidModelCalls:2,marketplaceCalls:1,sourceReference:'MOCK-AUDIT'};const r=evaluateReferenceScorecard(manifest,[a]).rows[1].attempts[0];assert.equal(r.status,'FAIL');assert.ok(r.reasons.includes('controlled_request_budget_violation'));assert.equal(r.calls.paidModelCalls,2);assert.equal(r.calls.marketplaceCalls,1);
});
test('actual controlled diagnostic import verifies retained JPEG bytes/dimensions against both manifest and diagnostic; never substitutes hashes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gp-3l-'));try{
 const front=await sharp({create:{width:30,height:40,channels:3,background:'white'}}).jpeg().toBuffer(),back=await sharp({create:{width:30,height:40,channels:3,background:'gray'}}).jpeg().toBuffer();const hash=b=>createHash('sha256').update(b).digest('hex');
 const prepared={version:1,category:'sports',attemptId:'11111111-1111-4111-8111-111111111111',revision,files:Object.fromEntries([['front',front],['back',back]].map(([side,b])=>[side,{side,name:'prepared-'+side+'.jpg',mime:'image/jpeg',width:30,height:40,size:b.length,sha256:hash(b)}]))};
 const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:revision,VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
 const headers={host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL};headers.cookie=authorizeDiagnosticOwner({method:'POST',headers},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 const response=await runScan({env,headers,fields:{cardType:'sports',mode:'condition-validation',validationManifest:JSON.stringify(prepared),validationCategorySelected:'sports',validationCategoryConfirmed:'sports',validationCategoryAttempt:prepared.attemptId},frontBytes:front,backBytes:back,vision:{...confirmed,visualObservations:[]}});assert.equal(response.status,200);assert.equal(response.metrics.vision,1);assert.equal(response.metrics.sdkMaxRetries,0);assert.equal(response.metrics.neutralEbay+response.metrics.upstream+response.metrics.internal.length,0);
 const original=readDiagnosticTicket({method:'POST',headers},response.responseHeaders[TICKET_HEADER],response.responseHeaders[SCAN_HEADER],env);
 const exported=await prepareDiagnosticExport({ticket:response.responseHeaders[TICKET_HEADER],scanId:response.responseHeaders[SCAN_HEADER],expiresAt:Number(response.responseHeaders['X-GemPredict-Diagnostic-Expires']),attemptId:prepared.attemptId,preparedHashes:{front:hash(front),back:hash(back)}},{fetchImpl:async()=>new Response(JSON.stringify(original))});
 const diagnostic=JSON.parse(await exported.text());assert.equal(diagnostic.scanId,response.responseHeaders[SCAN_HEADER]);assert.deepEqual(diagnostic.model.originalIdentity,original.model.originalIdentity);assert.deepEqual(diagnostic.canonicalIdentity,original.canonicalIdentity);assert.ok(Array.isArray(diagnostic.model.observations));diagnostic.synthetic=true;diagnostic.secret='sk-ant-must-not-export';
 const save=(name,data)=>{const p=path.join(dir,name);fs.writeFileSync(p,data);return p;};const input=save('diagnostic.json',JSON.stringify(diagnostic)),pm=save('prepared.json',JSON.stringify(prepared)),ff=save('front.jpg',front),bf=save('back.jpg',back);
 const options={input,'prepared-manifest':pm,'front-file':ff,'back-file':bf,card:sports.id,id:'MOCK-RETAINED'};
 const attempt=await readControlledValidationAttempt(options,manifest,importScanEvidence);assert.equal(attempt.preparedPairVerified,true);assert.equal(attempt.observation.evidenceKind,'synthetic');assert.equal(evaluateReferenceScorecard(manifest,[attempt]).rows[1].status,'NOT RUN');assert.doesNotMatch(JSON.stringify(attempt),/sk-ant-must-not-export|image\/jpeg|base64/);
 await assert.rejects(readControlledValidationAttempt({...options,'back-file':ff},manifest,importScanEvidence),/prepared_pair_mismatch/);await assert.rejects(readControlledValidationAttempt({...options,'front-file':null},manifest,importScanEvidence),/prepared_file_required/);
 const privateRoot=path.resolve('benchmarks/identity/private');fs.mkdirSync(privateRoot,{recursive:true});const privateTest=fs.mkdtempSync(path.join(privateRoot,'phase3l-import-test-'));try{const out=path.join(privateTest,'attempt');const args=['import-controlled','--input',input,'--prepared-manifest',pm,'--front-file',ff,'--back-file',bf,'--card',sports.id,'--id','MOCK-CLI-IMPORT','--output',out];await main(args);assert.deepEqual(fs.readdirSync(out).sort(),['SCORECARD.md','attempt.json','scorecard.json']);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'scorecard.json'))).status,'NOT RUN');assert.doesNotMatch(fs.readFileSync(path.join(out,'attempt.json'),'utf8'),/sk-ant-must-not-export|base64/);await assert.rejects(main(args),/EEXIST/);}finally{fs.rmSync(privateTest,{recursive:true,force:true});}

 assert.throws(()=>main(['import-controlled','--output',path.join(dir,'public')]),/private_output_required/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('runtime Pokémon core support is reported separately from physical reference and exact printing; unsupported sports verification is flagged',()=>{
 const a=syntheticAttempt(pokemon);a.observation.catalog={outcome:'supported',provenance:{provider:'tcgdex'},selectedReference:{provider:'tcgdex',id:'sm11-155'}};const r=evaluateReferenceScorecard(manifest,[a]).rows[0].attempts[0];assert.equal(r.independentCatalog.status,'PASS');assert.equal(r.independentCatalog.physicalReferenceIndependentlyReviewed,false);assert.equal(r.exactPrinting.status,'UNRESOLVED');assert.equal(r.status,'UNRESOLVED');
 const s=syntheticAttempt(sports);s.observation.claims.catalogVerified=true;const fail=evaluateReferenceScorecard(manifest,[s]).rows[1].attempts[0];assert.equal(fail.independentCatalog.status,'FAIL');assert.equal(fail.status,'FAIL');assert.ok(fail.reasons.includes('unsupported_sports_catalog_verification_claim'));
});
test('scorecard aggregation refuses public destinations and historical private output overwrite',()=>{
 const privateRoot=path.resolve('benchmarks/identity/private');fs.mkdirSync(privateRoot,{recursive:true});const root=fs.mkdtempSync(path.join(privateRoot,'phase3l-software-test-'));try{
 const input=path.join(root,'attempts.json');fs.writeFileSync(input,JSON.stringify([syntheticAttempt(pokemon)]));assert.throws(()=>main(['scorecard','--observations',input,'--output','benchmarks/identity/phase3l/unsafe']),/private_output_required/);
 const out=path.join(root,'scorecard');main(['scorecard','--observations',input,'--output',out]);assert.ok(fs.existsSync(path.join(out,'SCORECARD.md')));assert.throws(()=>main(['scorecard','--observations',input,'--output',out]),/EEXIST/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('serialized photo hashes and verified flags cannot substitute for reading actual retained prepared files',()=>{
 const a=syntheticAttempt(pokemon),replayed=JSON.parse(JSON.stringify(a));const r=evaluateUntrustedScorecard(manifest,[replayed]).rows[0].attempts[0];assert.equal(r.photoLinkage.ownerReferenceBound,false);assert.equal(r.prediction.subject.status,'NOT TESTED');assert.equal(r.status,'UNRESOLVED');
});

test('reimporting the same scan cannot create another trial; another cohort cannot borrow photo-linkage eligibility',()=>{
 const a=syntheticAttempt(pokemon);a.observation.scanId='11111111-1111-4111-8111-111111111111';const duplicate=structuredClone(a);duplicate.observation.id='MOCK-SECOND-ID';assert.throws(()=>evaluateReferenceScorecard(manifest,[a,duplicate]),/duplicate_scan/);a.observation.cohortId='historical-other-cohort';const r=evaluateReferenceScorecard(manifest,[a]).rows[0].attempts[0];assert.equal(r.photoLinkage.ownerReferenceBound,false);assert.equal(r.prediction.subject.status,'NOT TESTED');
});

test('unapproved scorecard separates verified bytes, original set error, canonical correction and retrospective confirmation',()=>{
 const a=syntheticAttempt(pokemon);a.referenceReview.ownerApproved=false;a.observation.originalAI.set='Cosmic Eclipse';a.observation.canonical.set='Unified Minds';a.observation.catalog={outcome:'conflict',provenance:{provider:'tcgdex'},selectedReference:{provider:'tcgdex',id:'sm11-155'}};a.observation.claims.catalogVerified=false;a.observation.dimensions.coreCatalog='supported';a.referenceReview.conditionReview={ownerApproved:false,retrospectiveConfirmation:{timing:'after_analysis',sourceReference:'owner_post_scan_statement',findings:[{attribute:'surface',code:'scratches',side:'back'},{attribute:'corners',code:'whitening',side:null}]}};
 const r=evaluateReferenceScorecard(manifest,[a]),x=r.rows[0].attempts[0];assert.equal(r.status,'UNRESOLVED');assert.equal(x.photoLinkage.preparedPairVerified,true);assert.equal(x.photoLinkage.ownerReferenceBound,false);assert.equal(x.prediction.set.status,'NOT TESTED');assert.equal(x.preliminaryIdentity.set.originalComparison,'mismatch');assert.equal(x.preliminaryIdentity.set.canonicalComparison,'matches_declared_reference');assert.deepEqual(x.observedCanonicalCorrections,['set']);assert.equal(x.runtimeCoreCatalog.status,'reported_supported');assert.equal(x.exactPrinting.status,'UNRESOLVED');assert.equal(x.condition.accuracy,'NOT TESTED');assert.equal(x.condition.blindedBenchmarkEstablished,false);assert.equal(x.financialStatus,'WITHHELD');
 const md=referenceScorecardMarkdown(r);for(const text of ['VERIFIED — actual files','MISSING / UNRESOLVED','Cosmic Eclipse / mismatch','Unified Minds / matches_declared_reference','AFTER ANALYSIS','not blinded ground truth'])assert.ok(md.includes(text),text);
 const replay=evaluateUntrustedScorecard(manifest,[structuredClone(a)]).rows[0].attempts[0];assert.equal(replay.photoLinkage.preparedPairVerified,false);assert.equal(replay.preliminaryIdentity.set.originalComparison,'no_linked_completed_attempt');assert.equal(a.referenceReview.ownerApproved,false);
});

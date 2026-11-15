// Mock readings/images: these do not reconstruct the missing Babe Ruth transcriptions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {photoIdentityStatus,withPhotoIdentityStatus} from '../lib/photoIdentity.mjs';
import {protectFinancialReport,protectedCopySummary} from '../lib/financialSafety.mjs';
import {renderIdentityResult} from './helpers/renderReports.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {IDENTITY_STRING_FIELDS} from '../lib/identityValidation.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
import {importScanEvidence} from '../scripts/identity-benchmark.mjs';
const reading=(field,text,side='back',area=field==='subject'?'name':'collector_line')=>({field,text,side,area,certainty:'clear',alternatives:[]});
const sports=rows=>({stage:'identity',identityV2:{category:'sports'},canonicalCard:{subject:'Shohei Ohtani',cardNumber:'S-17',language:'English'},originalIdentityObservation:{identityReadings:rows}});
test('sports observations do not require Pokemon set or printed language marks',()=>{
 const s=photoIdentityStatus(sports([reading('subject','SHOHEI OHTANI'),reading('subject','Shohei Ohtani','front'),reading('cardNumber','S-17')]));
 assert.deepEqual(s.missingReadings,[]);assert.deepEqual(s.conflicts,[]);assert.equal(s.status,'unresolved');assert.equal(s.photoSupported,false);assert.equal(s.reason,'sports_catalog_unavailable');assert.equal(s.subjectComparison.distinctValueCount,1);
});
test('sports set labels are not parsed as Pokemon language codes',()=>{
 const s=photoIdentityStatus(sports([reading('subject','Shohei Ohtani'),reading('cardNumber','S-17'),reading('setCode','PRODUCT FR','front','set_mark'),reading('setCode','OTHER EN','back','set_mark')]));
 assert.deepEqual(s.conflicts,[]);assert.deepEqual(s.missingReadings,[]);assert.equal(s.photoSupported,false);
});
test('genuine unrelated sports subject conflicts are retained with comparison regions',()=>{
 for(const other of ['Mike Trout','Patrick Mahomes']){const s=photoIdentityStatus(sports([reading('subject','Shohei Ohtani'),reading('subject',other,'front'),reading('cardNumber','S-17')]));assert.equal(s.status,'conflict');assert.ok(s.conflicts.includes('subject'));assert.equal(s.subjectComparison.distinctValueCount,2);assert.equal(s.subjectComparison.readings[1].matchesProposed,false);assert.equal(s.subjectComparison.readings[1].side,'front');}
});
test('a headline misclassified as subject stays conflicting, never silently ignored or aliased',()=>{
 const s=photoIdentityStatus(sports([reading('subject','Shohei Ohtani'),reading('subject','TEAM WINS SERIES','front','body_text'),reading('cardNumber','S-17')]));assert.equal(s.status,'conflict');assert.equal(s.subjectComparison.readings[1].area,'body_text');assert.equal(s.subjectComparison.readings[1].matchesProposed,false);
});
test('missing and contradictory sports collector identifiers and explicit languages remain protected',()=>{
 assert.ok(photoIdentityStatus(sports([])).missingReadings.includes('cardNumber'));
 assert.ok(photoIdentityStatus(sports([reading('cardNumber','17')])).conflicts.includes('cardNumber'));
 assert.ok(photoIdentityStatus(sports([reading('language','Japanese')])).conflicts.includes('language'));
});
test('Pokemon missing language/set evidence and wrong names remain blocked under original policy',()=>{
 const r=sports([reading('subject','Pikachu'),reading('cardNumber','025/165')]);r.identityV2.category='pokemon';r.canonicalCard={subject:'Pikachu',cardNumber:'025/165',language:'English'};
 const s=photoIdentityStatus(r);assert.ok(s.missingReadings.includes('language'));assert.ok(s.missingReadings.includes('setCode'));
 r.originalIdentityObservation.identityReadings.push(reading('subject','Raichu','front'));assert.ok(photoIdentityStatus(r).conflicts.includes('subject'));
});
test('restored sports reports cannot borrow forged Pokemon catalog flags or financial approval',()=>{
 const r=sports([reading('subject','Shohei Ohtani'),reading('cardNumber','S-17')]);r.pokemonIdentityStatus={catalogVerified:true};r.coreCatalogIdentity={supported:true};const p=withPhotoIdentityStatus(r);assert.equal(p.photoIdentityStatus.photoSupported,false);assert.equal(p.identityV2.identityVerified,false);
 delete r.pokemonIdentityStatus;delete r.coreCatalogIdentity;const safe=protectFinancialReport(r);assert.equal(safe.financialDecision.allowed,false);assert.match(renderIdentityResult(safe),/language is optional/);assert.match(protectedCopySummary(safe),/withheld/);
});
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'3cc855b598bb2c5625e84fd6f6aa2fdcf1781215',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('complete handler exports owner-only digests of actual SDK photo bytes and safe subject comparisons',async()=>{
 const model={...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identifiedSubject:'Shohei Ohtani',identifiedYear:'2025',identifiedBrandSet:'Synthetic sports set',identifiedCardNumber:'S-17',identifiedLanguage:'English',identityConfidence:80,identityReadings:[reading('subject','Shohei Ohtani'),reading('subject','SECRET_NARRATIVE_STRING','front','body_text'),reading('cardNumber','S-17')]};
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 const r=await runScan({fields:{mode:'identity',cardType:'sports'},env,headers:req.headers,actualSdkFetch:async()=>new Response(JSON.stringify({type:'message',role:'assistant',id:'msg_mock',model:'claude-sonnet-4-6',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(model)}],usage:{input_tokens:100,output_tokens:100}}),{status:200,headers:{'content-type':'application/json'}})});
 assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.financialDecision.allowed,false);
 const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.ok(d);const images=r.metrics.sdkRequest.messages[0].content.filter(c=>c.type==='image');
 for(const [i,side] of ['front','back'].entries()){const digest=createHash('sha256').update(Buffer.from(images[i].source.data,'base64')).digest('hex');assert.equal(d.images[side].preparedSha256,digest);}
 assert.equal(d.photoIdentity.subjectComparison.distinctValueCount,2);assert.equal(d.photoIdentity.subjectComparison.readings[1].area,'body_text');assert.equal(d.photoIdentity.subjectComparison.readings[1].matchesProposed,false);assert.doesNotMatch(JSON.stringify(d),/SECRET_NARRATIVE_STRING/);
 const imported=importScanEvidence(d,{id:'TEST-1',cardId:'GP-ID-008',cohortId:'test',attemptIndex:1,photoHashes:{front:d.images.front.preparedSha256,back:d.images.back.preparedSha256}});assert.equal(imported.photoLinkage.preparedHashes.front,d.images.front.preparedSha256);
});

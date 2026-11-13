// Mocked evidence only; the original Snivy diagnostic was not provided.
import test from 'node:test';
import assert from 'node:assert/strict';
import {languageObservation} from '../lib/catalogNormalization.mjs';
import {readIdentityReadings,clearIdentityReading} from '../lib/visionIdentityEvidence.mjs';
import {buildCanonicalCardFromImageAnalysis} from '../lib/pokemonCardIdentifier.mjs';
import {safeCatalogReasons,catalogReasonCodes} from '../lib/catalogResolution.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {IDENTITY_STRING_FIELDS} from '../lib/identityValidation.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const row=(field,text)=>({field,text,certainty:'clear',side:'front',area:field==='subject'?'name':'body_text',alternatives:[]});
const snivy=()=>({...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identifiedSubject:'Snivy',identifiedYear:'2021',identifiedBrandSet:"McDonald's 25th Anniversary",identifiedCardNumber:'5/25',identifiedLanguage:'English',identifiedParallel:'Holo',identityConfidence:80,identityReadings:[row('subject','Snivy'),row('cardNumber','5/25'),row('language','Illus. Ken Sugimori')]});
const message=raw=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(raw)}]});
test('recognized language observations exclude illustrator credits and unrelated prose without guessing defaults',()=>{
 for(const value of ['English','EN','French','Japanese','ja','Traditional Chinese','zh-tw','Korean','KO'])assert.equal(languageObservation(value),value);
 for(const value of ['Illus. Ken Sugimori','Ken Sugimori','English artwork','2021','unknown','https://private.test',null,{}])assert.equal(languageObservation(value),null);
});
test('invalid clear language cannot outrank the original proposal and remains preserved as original evidence',()=>{
 const raw=snivy(),before=structuredClone(raw);assert.equal(clearIdentityReading(raw.identityReadings,'language'),null);assert.equal(readIdentityReadings(raw.identityReadings).some(r=>r.field==='language'),false);assert.equal(buildCanonicalCardFromImageAnalysis(raw).language,'English');assert.deepEqual(raw,before);
 raw.identifiedLanguage='Illus. Ken Sugimori';assert.equal(buildCanonicalCardFromImageAnalysis(raw).language,null);
});
test('real language conflicts and combined printed language markings retain existing evidence semantics',()=>{
 assert.equal(clearIdentityReading([row('language','French')],'language'),'French');assert.equal(clearIdentityReading([row('setCode','30C EN')],'language'),'EN');
 assert.equal(clearIdentityReading([row('language','English'),row('language','French')],'language'),null);
 const r=row('language','English');r.alternatives=['Illus. artist'];assert.equal(readIdentityReadings([r]).length,0);
});
test('reason vocabulary is not an occurrence list and only actual sanitized reasons are emitted',()=>{
 assert.ok(catalogReasonCodes.has('catalog_search_page_limit'));assert.deepEqual(safeCatalogReasons(null),[]);assert.deepEqual(safeCatalogReasons({status:'verified',reasonCode:'catalog_identity_supported'}),['catalog_identity_supported']);
 const r={reasonCode:'catalog_candidate_not_found',reasonCodes:['catalog_timeout','catalog_candidate_not_found','private_url'],diagnostics:[{reason:'official_count_mismatch'},{reasonCode:'catalog_search_page_limit'},{reason:'https://private.test'}]};
 assert.deepEqual(safeCatalogReasons(r),['catalog_candidate_not_found','catalog_timeout','official_count_mismatch','catalog_search_page_limit']);
});
test('complete Snivy mock preserves original credit, uses English, withholds printing and financial claims',async()=>{
 const raw=snivy();const r=await runScan({fields:{mode:'identity',cardType:'pokemon'},visionResponse:message(raw)});assert.equal(r.status,200);assert.equal(r.payload.canonicalCard.language,'English');assert.deepEqual(r.payload.originalIdentityObservation,raw);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(r.payload.identityV2.printingVerified,false);assert.equal(r.payload.financialDecision.allowed,false);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.sdkMaxRetries,0);
 assert.equal(r.payload.photoIdentityStatus.readingDisposition[2].reasonCode,'invalid_language_observation');assert.ok(r.payload.photoIdentityStatus.missingReadings.includes('language'));
});
test('invalid sports model language is not promoted and user contradictions remain explicit',async()=>{
 const raw={...snivy(),identifiedSubject:'Synthetic Athlete',identifiedCardNumber:'PA-JD',identifiedLanguage:'Illus. Artist',identityReadings:[row('subject','Synthetic Athlete'),row('cardNumber','PA-JD')]};
 const sports=await runScan({fields:{mode:'identity',cardType:'sports'},visionResponse:message(raw)});assert.equal(sports.payload.canonicalCard.language,null);assert.equal(sports.payload.originalIdentityObservation.identifiedLanguage,'Illus. Artist');
 const user=await runScan({fields:{mode:'identity',cardType:'pokemon',confirmedIdentity:{language:'French'}},visionResponse:message(snivy())});assert.ok(user.payload.userIdentityConflicts.some(v=>v.field==='language'));assert.equal(user.payload.financialDecision.allowed,false);
});
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'d88a0d3b736c2d0ed4a3f86ba32d6e4506ef5f25',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('owner diagnostics export actual reason occurrences and safe language rejection, never rejected literal text',async()=>{
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 const r=await runScan({fields:{mode:'identity',cardType:'pokemon'},env,headers:req.headers,visionResponse:message(snivy())});const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.ok(d);assert.equal(d.photoIdentity.readingDisposition[2].reasonCode,'invalid_language_observation');assert.ok(!d.identity.catalogReasonCodes.includes('reviewed_set_code_ambiguous'));assert.doesNotMatch(JSON.stringify(d),/Illus\. Ken Sugimori/);
 const s=await runScan({fields:{mode:'identity',cardType:'sports'},env,headers:req.headers,visionResponse:message({...snivy(),identifiedCardNumber:'PA-JD'})});const sd=readDiagnosticTicket(req,s.responseHeaders[TICKET_HEADER],s.responseHeaders[SCAN_HEADER],env);assert.deepEqual(sd.identity.catalogReasonCodes,[]);
});

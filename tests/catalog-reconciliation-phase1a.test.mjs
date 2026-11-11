import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runScan,confirmed} from './helpers/reconciliationPipeline.mjs';
import {scan as pikachuScan} from './helpers/pikachuFixture.mjs';
import {catalogIdentityConflicts} from '../lib/catalogIdentity.mjs';
import {readIdentityReadings,catalogInvestigation,printedIdentityEvidence} from '../lib/visionIdentityEvidence.mjs';
import {reviewedSetForCode} from '../lib/tcgdexSnapshot.mjs';
import {verificationRows} from '../lib/reportVerification.mjs';
import {reportFromResponse,protectFinancialReport,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderReports} from './helpers/renderReports.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const {facts,source}=JSON.parse(fs.readFileSync('tests/fixtures/zapdos-catalog-facts.json','utf8'));
const reading=(field,text)=>({field,text,certainty:'clear',side:'front',area:field==='subject'?'name':field==='cardNumber'?'collector_line':field==='copyrightYear'?'body_text':'set_mark',alternatives:[]});
const vision={identifiedSubject:facts.subject,identifiedCardNumber:'133/128',identifiedYear:'2025',identifiedBrandSet:'Unverified model set',identifiedLanguage:'English',identifiedParallel:null,identifiedAutoOrRelic:'none',identityConfidence:88,identityReadings:[reading('subject',facts.subject),reading('cardNumber','133/128'),reading('setCode','30C EN'),reading('copyrightYear','©2026')]};
// Hosted-shaped responses below are MOCKS, derived from pinned public facts.
// IDs and filler cards are explicitly synthetic, not retained live REST records.
function transport({missing=false,ambiguous=false,unavailable=false,incomplete=false,noList=false,cardPatch={},setPatch={}}={}){
 const calls=[];const set={id:facts.setId,name:facts.setName,releaseDate:facts.releaseDate,cardCount:{official:facts.officialCount},tcgOnline:facts.setCode,...setPatch};
 const card={id:'mock-zapdos-133',name:facts.subject,localId:facts.localId,rarity:facts.rarity,set:{id:set.id,name:set.name,cardCount:{official:set.cardCount.official}},variants:{normal:false,holo:true,reverse:false},...cardPatch};
 const other={...card,id:'mock-ambiguous',rarity:'Special illustration rare'};
 const fillers=Array.from({length:128},(_,i)=>({id:'mock-filler-'+i,localId:String(i+1),name:'Synthetic fixture card'}));
 if(!noList)set.cards=[...fillers,...(missing?[]:[{id:card.id,localId:card.localId,name:card.name}]),...(ambiguous?[{id:other.id,localId:other.localId,name:other.name}]:[])];
 if(incomplete)set.cards=[];
 return {calls,fetch:async url=>{calls.push(String(url));if(unavailable)throw Error('private transport failure https://internal.invalid');const u=new URL(url);const data=u.pathname.endsWith('/sets/'+set.id)?set:u.pathname.endsWith('/cards/'+card.id)?card:u.pathname.endsWith('/cards/'+other.id)?other:u.pathname.endsWith('/cards')?(missing?[]:noList?Array(5).fill({id:card.id,localId:card.localId,name:card.name}):[{id:card.id,localId:card.localId,name:card.name},...(ambiguous?[{id:other.id,localId:other.localId,name:other.name}]:[])]):null;return {ok:true,status:200,json:async()=>structuredClone(data)};}};
}
async function scan(patch={},options={}){const t=transport(options);const r=await runScan({vision,fields:{cardType:'pokemon'},catalogFetch:t.fetch,items:[],neutral:[],...patch});assert.equal(r.status,200);assert.equal(r.metrics.valuation,0);for(const f of FINANCIAL_FIELDS)assert.equal(r.payload.prediction[f],null,f);return {...r,calls:t.calls};}
test('reviewed set mapping uses pinned set provenance, not a Zapdos-specific exception',()=>{
 const reviewed=reviewedSetForCode('30C');assert.equal(reviewed.id,facts.setId);assert.equal(reviewed.officialCount,128);assert.equal(reviewed.sourceBlob,source.setBlob);assert.equal(reviewedSetForCode('UNREVIEWED'),null);
});
test('complete handler: combined 30C EN guides set-first retrieval and independent facts correct 2025 without rewriting original observation',async()=>{
 const r=await scan();const p=r.payload;assert.equal(p.pokemonIdentityStatus.catalogVerified,true);assert.equal(p.pokemonIdentityStatus.catalogOutcome,'supported');assert.equal(p.canonicalCard.year,'2026');assert.equal(p.canonicalCard.brandSet,facts.setName);assert.equal(p.canonicalCard.cardNumber,'133/128');assert.equal(p.canonicalCard.rarity,'Illustration rare');
 assert.equal(p.originalIdentityObservation.identifiedYear,'2025');assert.equal(p.originalIdentityObservation.identityConfidence,88);assert.equal(p.originalIdentityObservation.identityReadings[2].text,'30C EN');assert.equal(p.identityVerification.printed.copyright[0].text,'©2026');assert.equal(p.identityVerification.printed.proposedReleaseYear,'2025');assert.equal(p.identityVerification.printed.parsedSetMarkings[0].language,'EN');
 assert.ok(r.calls[0].includes('/sets/30th'));assert.ok(!r.calls.some(u=>u.includes('?name=')));assert.ok(r.calls.length<=9);assert.equal(p.identityV2.printingVerified,false);assert.equal(p.financialDecision.allowed,false);
});
test('missing candidate is not four false conflicts and copyright/set metadata cannot invent a card',async()=>{
 const r=await scan({}, {missing:true});assert.equal(r.payload.pokemonIdentityStatus.catalogOutcome,'not_found');assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.deepEqual(r.payload.pokemonIdentityStatus.conflicts,[]);assert.equal(r.payload.identityVerification.catalog.candidate,undefined);assert.equal(r.payload.canonicalCard.year,'2025');assert.deepEqual(catalogIdentityConflicts(r.payload.canonicalCard,undefined),[]);assert.deepEqual(catalogIdentityConflicts(r.payload.canonicalCard,{}),[]);
 const language=await scan({vision:{...vision,identifiedLanguage:null,identityReadings:[reading('subject',facts.subject),reading('cardNumber','133/128'),reading('setCode','30C')]}});assert.equal(language.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(language.payload.pokemonIdentityStatus.catalogOutcome,'incomplete');assert.deepEqual(language.payload.pokemonIdentityStatus.conflicts,[]);
 const report=reportFromResponse(r.payload);assert.match(verificationRows(report)[0].reason,/No matching catalog candidate/);assert.match(renderReports(report).upper,/No matching catalog candidate/);
});
test('ambiguous, unavailable and incomplete hosted evidence remain different unresolved outcomes',async()=>{
 for(const [options,outcome] of [[{ambiguous:true},'ambiguous'],[{unavailable:true},'unavailable'],[{incomplete:true},'incomplete']]){
  const r=await scan({},options);assert.equal(r.payload.pokemonIdentityStatus.catalogOutcome,outcome);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.deepEqual(r.payload.pokemonIdentityStatus.conflicts,[]);assert.equal(r.payload.marketData.success,false);
 }
});
test('wrong denominator and printed set/language contradictions never authorize catalog identity',async()=>{
 for(const readings of [[reading('cardNumber','133/165'),reading('setCode','30C EN')],[reading('cardNumber','133/128'),reading('setCode','SVI EN')],[reading('cardNumber','133/128'),reading('setCode','30C FR'),reading('language','EN')]]){
  const r=await scan({vision:{...vision,identityReadings:readings}});assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.deepEqual(r.payload.pokemonIdentityStatus.conflicts,[]);assert.ok(r.payload.identityVerification.catalog.reasonCodes.length>0);
 }
});
test('a real retrieved-candidate contradiction stays a conflict when explicit user set/year is protected',async()=>{
 const r=await scan({fields:{cardType:'pokemon',cardSet:'2025 Unverified model set'}});assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(r.payload.pokemonIdentityStatus.catalogOutcome,'conflict');assert.ok(r.payload.identityVerification.catalog.candidate);assert.ok(r.payload.pokemonIdentityStatus.conflicts.includes('year'));
});
test('five broad candidates stay ambiguous and an incomplete set listing is never treated as exhaustive',async()=>{
 const r=await scan({}, {noList:true});assert.equal(r.payload.pokemonIdentityStatus.catalogOutcome,'ambiguous');assert.ok(r.calls.length<=9);
 const partial=await scan({}, {incomplete:true});assert.equal(partial.payload.pokemonIdentityStatus.catalogOutcome,'incomplete');assert.ok(partial.payload.identityVerification.catalog.reasonCodes.includes('catalog_set_list_incomplete'));
});
test('Pikachu correction, saved/copied statuses, missing provenance and sports BCP identifiers retain protections',async()=>{
 const p=await pikachuScan();assert.equal(p.payload.canonicalCard.year,'2026');assert.equal(p.payload.pokemonIdentityStatus.catalogVerified,true);
 const zap=await scan();const report=reportFromResponse(zap.payload),restored=protectFinancialReport(JSON.parse(JSON.stringify(report)));assert.equal(restored.pokemonIdentityStatus.catalogOutcome,'supported');assert.match(protectedCopySummary(restored),/2025.*©2026/);
 const missing=structuredClone(restored);delete missing.identityVerification.catalog.referenceId;assert.equal(protectFinancialReport(missing).pokemonIdentityStatus.catalogVerified,false);
 const sports=await runScan({vision:confirmed});assert.equal(sports.payload.canonicalCard.cardNumber,'BCP-86');assert.equal(sports.metrics.catalog,0);assert.equal(sports.payload.financialDecision.allowed,false);
});
test('copyright is distinct printed evidence and uncertain/contradictory readings are not replaced by a confident proposal',()=>{
 const multiple=printedIdentityEvidence({...vision,identityReadings:[reading('copyrightYear','©1995-2026')]});assert.equal(multiple.copyright[0].year,null);assert.deepEqual(multiple.copyright[0].years,['1995','2026']);
 const raw=readIdentityReadings(vision.identityReadings);assert.equal(raw.find(r=>r.field==='copyrightYear').text,'©2026');
 const investigation=catalogInvestigation({subject:'Zapdos',cardNumber:'133/128',language:'en'},{enabled:true,readings:[...raw,reading('cardNumber','133/165')]});assert.equal(investigation.blocked,true);
});
test('authorized Preview diagnostics retain catalog outcome and safe rejection codes without URLs, provider prose or credentials',async()=>{
 const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'64916865bf0ebf0c12e500df8878dd6370e34656',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 for(const [patch,options,outcome,reason] of [[{}, {missing:true},'not_found','catalog_candidate_not_found'],[{}, {incomplete:true},'incomplete','catalog_set_list_incomplete'],[{vision:{...vision,identityReadings:[reading('cardNumber','133/128'),reading('setCode','SVI EN')]}},{},'not_found','printed_set_code_conflict']]){
  const r=await scan({env,headers:req.headers,...patch},options);const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.ok(d);assert.equal(d.identity.catalogOutcome,outcome);assert.notEqual(d.identity.catalogStatus,'unknown');assert.ok(d.identity.catalogReasonCodes.includes(reason));assert.equal(d.identity.candidateCompared,false);assert.deepEqual(d.identity.conflicts,[]);
  assert.doesNotMatch(JSON.stringify(d),/https?:|private transport|endpoint|itemWebUrl|Authorization/);
 }
 const success=await scan({env,headers:req.headers});const d=readDiagnosticTicket(req,success.responseHeaders[TICKET_HEADER],success.responseHeaders[SCAN_HEADER],env);assert.equal(d.identity.printed.setMarkings[0].text,'30C EN');assert.equal(d.identity.printed.copyright[0].text,'©2026');assert.equal(d.model.originalIdentity.identifiedYear,'2025');assert.equal(d.model.uncertainty.identityConfidence,88);
});

import {describeCatalogComparison} from '../lib/catalogComparison.mjs';
import {hostedCatalogEvidence} from '../lib/reviewedCatalogSource.mjs';
import {catalogVariantProvenance} from '../lib/catalogVariantProvenance.mjs';
// Synthetic hosted shapes exercise documented compiler behavior; not a live Fraxure response.
function finishCase(variants,detailed){
 const hosted={id:'sm11-155',set:{id:'sm11'},variants,...(detailed===undefined?{}:{variants_detailed:detailed})};
 const record={id:'sm11-155',provider:'tcgdex',subject:'Fraxure',year:'2019',brandSet:'Unified Minds',cardNumber:'155/236',language:'en',setId:'sm11',localId:'155',officialCount:236,releaseDate:'2019-08-02',variants,hostedEvidence:hostedCatalogEvidence(hosted)};
 const card={subject:'Fraxure',year:'2019',brandSet:'Unified Minds',cardNumber:'155/236',language:'en',parallel:'Reverse Holo'};
 const before=structuredClone(record),comparison=describeCatalogComparison({catalog:{status:'conflict',source:'tcgdex',referenceId:record.id,candidate:record,conflicts:['finish']}},card);assert.deepEqual(record,before);return{record,card,comparison};
}
test('missing finish flag is unresolved while an explicit non-generated contradiction remains a conflict',()=>{
 const missing=finishCase({normal:true});assert.equal(missing.comparison.printing.status,'unresolved');assert.equal(missing.comparison.printing.providerEvidence.reportedFlags.reverse,null);
 const explicit=finishCase({normal:true,holo:false,reverse:false},[{type:'normal',variantId:'explicit-normal-reference'}]);assert.equal(explicit.comparison.printing.status,'conflict');assert.equal(explicit.comparison.printing.providerEvidence.kind,'provider_detailed');assert.equal(explicit.comparison.printing.providerEvidence.reportedFlags.reverse,false);assert.equal(explicit.comparison.printing.verified,false);
});
test('generated legacy normal defaults preserve raw false flags but do not prove Reverse Holo impossible or verified',()=>{
 const x=finishCase({normal:true,holo:false,reverse:false},[{type:'normal',size:'standard',variantId:'generated'}]);assert.equal(x.comparison.core.status,'supported');assert.equal(x.comparison.printing.status,'unresolved');assert.equal(x.comparison.printing.reason,'printing_evidence_incomplete');assert.equal(x.comparison.printing.providerEvidence.kind,'generated_legacy');assert.equal(x.record.variants.reverse,false);assert.deepEqual(catalogIdentityConflicts(x.card,x.record),['finish']);assert.equal(x.comparison.printing.verified,false);
 const withoutProvenance=finishCase({normal:true,holo:false,reverse:false});assert.equal(withoutProvenance.comparison.printing.status,'conflict');assert.equal(withoutProvenance.comparison.printing.providerEvidence.negativeBasis,'provider_flags_without_source_provenance');
 const unsafe=catalogVariantProvenance({...x.record,hostedEvidence:{...x.record.hostedEvidence,detailedComplete:false,printings:[{finish:'normal',variantId:'generated'}]}});assert.notEqual(unsafe.kind,'generated_legacy');
 assert.notEqual(catalogVariantProvenance({...x.record,hostedEvidence:{...x.record.hostedEvidence,id:'another-card'}}).kind,'generated_legacy');
 assert.notEqual(catalogVariantProvenance({...x.record,provider:'other-provider'}).kind,'generated_legacy');
});
test('catalog provenance is bounded and omits arbitrary provider fields, pricing and private payloads',()=>{
 const x=finishCase({normal:true},[{type:'normal',variantId:'generated',pricing:{private:'secret'}}]);const p=catalogVariantProvenance({...x.record,hostedEvidence:{...x.record.hostedEvidence,updated:'https://private.example',printings:Array.from({length:30},()=>({finish:'normal',variantId:'secret:https://private.example'}))}});
 assert.equal(p.entries.length,4);assert.equal(p.entriesTruncated,true);assert.notEqual(p.kind,'generated_legacy');assert.equal(p.hostedUpdated,null);assert.doesNotMatch(JSON.stringify(p),/secret|https:|pricing/);
});

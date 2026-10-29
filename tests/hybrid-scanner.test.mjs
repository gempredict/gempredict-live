// Mocked boundary/evidence regressions; real-photo hosted receipts are separate.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {acceptHybridResult,hybridCatalog,hybridSeed,hybridLookup,identityOnlyReport,identifyUploadedCard} from '../lib/hybridIdentification.mjs';
import {resolveMarketIdentity} from '../lib/reconcileMarketIdentity.mjs';
import {identitySearchGate} from '../lib/catalogIdentity.mjs';
const catalog=hybridCatalog(),r=catalog.records.find(r=>r.id==='30th-149');
const evidence={collectorNumber:{supported:true,readings:[{value:'149/128',passes:3,confidence:95}]},name:{supported:true,score:1,exactReadings:[{text:'Pikachuex',confidence:95,pass:'name:scene-color'}]},setCode:{supported:true,value:'30C',readings:[{code:'30C',language:'en',pass:'footer:scene-color'},{code:'30C',language:'en',pass:'footer:scene-gray'}]},language:{supported:true,value:'en'},artwork:{status:'reference_unavailable'}};
const raw=()=>({catalogSha256:catalog.pins.catalogSha256,status:'identity_candidate',catalogIdentitySupported:true,detection:{status:'detected'},candidates:[{id:r.id,score:.85,evidence:structuredClone(evidence)}]});
test('local catalog is pinned and candidate facts are reloaded, never accepted from a model/transport',()=>{
 const input=raw();input.candidates[0].identity={year:'2023',brandSet:'Scarlet & Violet 151'};
 const result=acceptHybridResult(input);const card=hybridSeed(result);
 assert.equal(result.catalogIdentitySupported,true);assert.equal(card.year,'2026');assert.equal(card.brandSet,'30th Celebration');assert.equal(card.rarity,'Special illustration rare');assert.deepEqual(card.printings,['holo']);assert.equal(result.printingVerified,false);
 assert.equal(acceptHybridResult({...raw(),catalogSha256:'wrong'}).status,'unavailable');
 assert.equal(acceptHybridResult({...raw(),candidates:[{id:'missing',score:.9}]}).status,'unavailable');
});
test('OCR set/language ambiguity, conflicting numbers, absent evidence or close parallels cannot verify a card',()=>{
 for(const mutate of [v=>v.candidates[0].evidence.setCode.supported=false,v=>v.candidates[0].evidence.language.supported=false,v=>v.candidates[0].evidence.collectorNumber.readings=[{value:'149/165',passes:3,confidence:95}],v=>v.candidates[0].evidence.name.supported=false,v=>v.detection.status='retake',v=>v.candidates.push({...v.candidates[0],score:.84})]){const v=raw();mutate(v);assert.equal(acceptHybridResult(v).catalogIdentitySupported,false);}
});
test('identity-only response withholds all pricing, Atlas and physical-printing trust even for supported identity',()=>{
 const report=identityOnlyReport(acceptHybridResult(raw()));assert.equal(report.receipt.paidProviderCalls,0);assert.equal(report.atlas,null);assert.equal(report.prediction.rawValue,null);assert.equal(identitySearchGate(report.identityVerification,report.canonicalCard).allowed,true);assert.equal(report.variantVerification.status,'needs_confirmation');
 assert.equal(identityOnlyReport(null).canonicalCard,null);
});
test('unavailable/local OCR outside Preview makes no request',async()=>{
 let calls=0;const fetchImpl=()=>{calls++;throw Error('must not call');};
 assert.equal((await identifyUploadedCard(Buffer.from('x'),{env:{VERCEL_ENV:'production'},fetchImpl})).status,'unavailable');assert.equal(calls,0);
});
test('scanner uses local seed before model-derived fields and private identity-only exits before paid analysis',()=>{
 const source=fs.readFileSync('pages/api/predict.js','utf8');assert.match(source,/originalCanonicalCard = localIdentity \|\|/);assert.match(source,/visionReadings: hybridIdentification \? \[\]/);
 assert.ok(source.indexOf('return res.status(200).json(identityOnlyReport')<source.indexOf('imageAnalysis = await fetchImageAnalysis'));
 assert.match(source,/cardType === 'pokemon' && preview/);
});

test('real handler boundary: identity-only upload performs zero paid/model/market calls',async()=>{
 const {runPipeline}=await import('./helpers/phase1Pipeline.mjs');
 const result=await runPipeline({hybridResult:acceptHybridResult(raw()),fields:{cardName:'',cardType:'pokemon',identityOnly:'true'},routingEnv:{VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',NEXT_PUBLIC_SITE_URL:undefined},requestHeaders:{'x-vercel-oidc-token':'mock.preview.signature'}});
 assert.equal(result.httpStatus,200);assert.equal(result.payload.canonicalCard.brandSet,'30th Celebration');
 for(const key of ['claudeVision','claudePrediction','neutralBrowse','valuationBrowse','neutralOAuth','valuationOAuth'])assert.equal(result.metrics[key],0);
 assert.equal(result.report.rawValue,null);assert.equal(result.report.atlas,null);
});
test('real handler boundary: conflicting mocked Claude set/year/number cannot override independent local identity',async()=>{
 const {runPipeline}=await import('./helpers/phase1Pipeline.mjs');
 const result=await runPipeline({hybridResult:acceptHybridResult(raw()),proposal:{subject:'Pikachu ex',brandSet:'Scarlet & Violet 151',year:'2023',cardNumber:'149/165',language:'English',parallel:'Reverse Holo'},fields:{cardName:'',cardType:'pokemon'},routingEnv:{VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',NEXT_PUBLIC_SITE_URL:undefined},requestHeaders:{'x-vercel-oidc-token':'mock.preview.signature'}});
 assert.equal(result.httpStatus,200);assert.equal(result.payload.canonicalCard.year,'2026');assert.equal(result.payload.canonicalCard.brandSet,'30th Celebration');assert.equal(result.payload.canonicalCard.cardNumber,'149/128');assert.equal(result.payload.variantVerification.status,'needs_confirmation');assert.notEqual(result.report.valuationVerification.status,'trusted');assert.equal(result.report.atlas,null);
});

test('printed identity may verify without artwork or physical printing while financial trust remains withheld after saving',async()=>{
 const {reportFromPrediction,isValuationTrusted,safeStoredReport}=await import('../lib/valuationProtection.mjs');
 const payload=identityOnlyReport(acceptHybridResult(raw()));
 assert.equal(payload.identityVerification.catalog.requiresConfirmation,false);
 assert.equal(payload.valuationIdentityGate.allowed,true);assert.equal(payload.receipt.printedIdentityVerified,true);
 assert.equal(payload.receipt.printingVerified,false);assert.equal(payload.receipt.artworkReferenceRequired,false);
 const saved=reportFromPrediction(payload),restored=safeStoredReport(JSON.parse(JSON.stringify(saved)));
 assert.equal(identitySearchGate(restored.identityVerification,restored.canonicalCard).allowed,true);
 assert.equal(isValuationTrusted(restored),false);assert.equal(restored.rawValue,null);assert.equal(restored.atlas,null);
 assert.equal(restored.variantVerification.status,'needs_confirmation');
 const changed={...restored.canonicalCard,brandSet:'Scarlet & Violet 151'};
 assert.equal(identitySearchGate(restored.identityVerification,changed).allowed,false);
});
test('missing exact name, misleading lookalike, contradictory OCR or single-pass set marks cannot verify',()=>{
 const mutations=[
  v=>delete v.candidates[0].evidence.name.exactReadings,
  v=>v.candidates[0].evidence.name.exactReadings[0].text='Dark Pikachu ex',
  v=>v.candidates[0].evidence.setCode.readings.pop(),
  v=>v.candidates[0].evidence.setCode.readings.push({code:'SV3',language:'en',pass:'footer:other'}),
  v=>v.candidates[0].evidence.setCode.readings.push({code:'30C',language:'fr',pass:'footer:other'}),
  v=>v.candidates[0].evidence.collectorNumber.readings.push({value:'149/165',passes:1,confidence:99}),
 ];
 for(const mutate of mutations){const input=raw();mutate(input);const report=identityOnlyReport(acceptHybridResult(input));assert.equal(report.valuationIdentityGate.allowed,false);assert.equal(report.identityVerification.catalog.requiresConfirmation,true);}
});
test('catalog variants sharing printed identifiers are ambiguous even if outside the returned top-five shortlist',()=>{
 const extra={...r,id:r.id+'-alternate-printing',printings:['reverse']};
 const result=acceptHybridResult(raw(),{pins:catalog.pins,records:[...catalog.records,extra]});
 assert.equal(result.catalogIdentitySupported,false);assert.equal(identityOnlyReport(result).valuationIdentityGate.allowed,false);
});

test('specific confirmation reasons distinguish unreadable marks, conflicts and catalog ambiguity',()=>{
 let v=raw();v.catalogIdentitySupported=false;v.status='ambiguous';v.candidates[0].evidence.setCode={supported:false,value:null,readings:[]};v.candidates[0].evidence.language={supported:false,value:null};
 assert.match(acceptHybridResult(v).confirmationReasons.join(' '),/set code and language are not reliably readable/);
 v=raw();v.candidates[0].evidence.setCode.readings.push({code:'SV1',language:'en',pass:'footer:other'});
 assert.match(acceptHybridResult(v).confirmationReasons.join(' '),/readings conflict/);
 const duplicate={...r,id:'mock-other-edition'};
 assert.match(acceptHybridResult(raw(),{records:[...catalog.records,duplicate],pins:catalog.pins}).confirmationReasons.join(' '),/Multiple catalog editions/);
 assert.deepEqual(acceptHybridResult(raw()).confirmationReasons,[]);
});

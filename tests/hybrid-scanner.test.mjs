// Mocked boundary/evidence regressions; real-photo hosted receipts are separate.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {acceptHybridResult,hybridCatalog,hybridSeed,hybridLookup,identityOnlyReport,identifyUploadedCard} from '../lib/hybridIdentification.mjs';
import {resolveMarketIdentity} from '../lib/reconcileMarketIdentity.mjs';
import {identitySearchGate} from '../lib/catalogIdentity.mjs';
const catalog=hybridCatalog(),r=catalog.records.find(r=>r.id==='30th-149');
const evidence={collectorNumber:{supported:true,readings:[{value:'149/128',passes:3,confidence:95}]},name:{supported:true,score:1},setCode:{supported:true,value:'30C'},language:{supported:true,value:'en'},artwork:{status:'reference_unavailable'}};
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
 const report=identityOnlyReport(acceptHybridResult(raw()));assert.equal(report.receipt.paidProviderCalls,0);assert.equal(report.atlas,null);assert.equal(report.prediction.rawValue,null);assert.equal(identitySearchGate(report.identityVerification,report.canonicalCard).allowed,false);assert.equal(report.variantVerification.status,'needs_confirmation');
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

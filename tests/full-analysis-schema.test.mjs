import test from 'node:test';
import assert from 'node:assert/strict';
import {fullAnalysisSchema,fullAnalysisOutputFormat,adaptFullAnalysis,parseFullAnalysisMessage,fullAnalysisStructuredEnabled} from '../lib/fullAnalysisSchema.mjs';
import {compatibilityExamples,fullObservation,fullMessage} from './helpers/fullAnalysisFixtures.mjs';
import {sportsIdentityEvidence} from '../lib/sportsIdentityEvidence.mjs';
import {conditionPresentation} from '../lib/visualEvidence.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {protectFinancialReport} from '../lib/financialSafety.mjs';
for(const example of compatibilityExamples)test('synthetic compatibility: '+example.name,()=>{
 const before=JSON.stringify(example.raw),out=parseFullAnalysisMessage(fullMessage(example.raw),['front','back'],example.category);
 assert.equal(JSON.stringify(example.raw),before);assert.equal(out.identifiedParallel,example.raw.identifiedParallel);assert.deepEqual(out.visualObservations,example.raw.visualObservations);assert.equal(out.schemaVersion,undefined);
 const report=protectFinancialReport({success:true,imageAnalysis:out,canonicalCard:{subject:out.identifiedSubject},identityV2:{category:example.category,identityVerified:false,printingVerified:false}});
 assert.equal(report.prediction,undefined);assert.equal(report.financialDecision.allowed,false);
 if(out.sportsIdentity){const evidence=sportsIdentityEvidence(out);assert.equal(evidence.verified,false);assert.equal(evidence.subjects.length,out.sportsIdentity.subjects.length);}
});
test('provider subset stays within documented explicit complexity limits; local bounds retained',()=>{
 for(const category of ['pokemon','sports']){
  let unions=0,optional=0;
  const walk=s=>{if(!s||typeof s!=='object')return;if(Array.isArray(s.type))unions++;if(s.properties){optional+=Object.keys(s.properties).filter(k=>!s.required.includes(k)).length;assert.equal(s.additionalProperties,false);for(const v of Object.values(s.properties))walk(v);}if(s.items)walk(s.items);for(const k of ['minimum','maximum','minItems','maxItems','maxLength'])assert.equal(s[k],undefined);};
  walk(fullAnalysisOutputFormat(true,category).schema);assert.ok(unions<=16);assert.ok(optional<=24);assert.ok(fullAnalysisSchema(true,category).properties.visualObservations.maxItems);
 }
});
test('missing optional details preserve unknowns; essential containers and version required',()=>{
 const raw=fullObservation('sports');assert.doesNotThrow(()=>adaptFullAnalysis(raw,['front'],'sports'));
 for(const mutate of [x=>delete x.schemaVersion,x=>x.schemaVersion=2,x=>delete x.visualObservations,x=>x.identifiedParallel=123,x=>x.psa10Probability=.9,x=>x.visualObservations.push({attribute:'surface',code:'scratches',certainty:'confirmed',evidence:{side:'back',region:[0,0,.1,.1],cue:'surface_line',confidence:.9}})]){
  const x=structuredClone(raw);mutate(x);assert.throws(()=>adaptFullAnalysis(x,['front'],'sports'),/ANALYSIS_RESPONSE_INVALID/);
 }
});
test('strict completion rejection: refusal, capped closed JSON, malformed and incomplete JSON',()=>{
 for(const stop of ['refusal','max_tokens','tool_use',null])assert.throws(()=>parseFullAnalysisMessage({...fullMessage(fullObservation()),stop_reason:stop},['front'],'pokemon'));
 for(const text of ['{','```json\n{}\n```','[]','null'])assert.throws(()=>parseFullAnalysisMessage({stop_reason:'end_turn',content:[{type:'text',text}]},['front'],'pokemon'));
});
test('mixed sides remain suspected/unassessable under existing conservative condition presentation',()=>{
 const out=adaptFullAnalysis(compatibilityExamples[5].raw,['front','back'],'pokemon');
 const p=conditionPresentation({...out,inspectedSides:['front','back']});
 assert.ok(JSON.stringify(p).includes('suspected'));assert.ok(JSON.stringify(p).includes('unassessable'));assert.ok(JSON.stringify(p).includes('back'));
});
test('flag defaults off and cannot enable in Production, public requests or without controlled authorization',()=>{
 for(const env of [{},{GEMPREDICT_PREVIEW_FULL_STRUCTURED_OUTPUT_ENABLED:'true',VERCEL_ENV:'production'},{GEMPREDICT_PREVIEW_FULL_STRUCTURED_OUTPUT_ENABLED:'true',VERCEL_ENV:'preview'}])assert.equal(fullAnalysisStructuredEnabled({headers:{}},true,'sports',env),false);
});
test('default actual route keeps prompt JSON and financial withholding',async()=>{
 const r=await runScan({visionResponse:fullMessage(fullObservation('sports'))});assert.equal(r.metrics.sdkRequest.output_config,undefined);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.financialDecision.allowed,false);
});
test('adapted original wrong set survives canonical correction; Reverse Holo remains unverified',async()=>{
 const {fraxureScan,fraxureModel}=await import('./helpers/fraxureFixture.mjs');
 const adapted=adaptFullAnalysis({...fullObservation(),...fraxureModel},['front','back'],'pokemon');
 const r=await fraxureScan({model:adapted});assert.equal(r.status,200);assert.equal(r.payload.originalIdentityObservation.identifiedBrandSet,'Cosmic Eclipse');assert.equal(r.payload.canonicalCard.brandSet,'Unified Minds');assert.equal(r.payload.physicalPrintingStatus.verified,false);assert.equal(r.payload.financialDecision.allowed,false);
});
test('sports stamped serial readings, foil evidence, and optional details survive the adapter without verification',()=>{
 const raw=structuredClone(compatibilityExamples[2].raw);raw.identifiedSerialNumber='12/99';raw.identityReadings.push({field:'serialNumber',text:'12/99',side:'back',area:'body_text',certainty:'clear',alternatives:[]});Object.assign(raw.sportsIdentity,{serialNumber:'12/99',serialReadingIndex:2});
 const out=adaptFullAnalysis(raw,['front','back'],'sports');assert.equal(out.sportsIdentity.serialNumber,'12/99');assert.equal(out.identityReadings[2].field,'serialNumber');assert.equal(out.sportsIdentity.foilTreatment,'confetti-like foil');assert.equal(sportsIdentityEvidence(out).verified,false);
});
test('local bounds reject excessive observations, malformed regions and unknown nested financial fields',()=>{
 for(const mutate of [x=>x.visualObservations=Array(17).fill({attribute:'surface',code:'scratches',certainty:'suspected'}),x=>x.photoNotes=[{attribute:'surface',text:'a'.repeat(81)}],x=>x.inspectionCoverage=[{attribute:'surface',side:'front',regions:[{region:[.9,0,.5,.5],status:'partial'}],limitations:[]}],x=>x.identityReadings=[{field:'subject',text:'x',certainty:'clear',side:'front',area:'name',alternatives:[],salePrice:100}]]){
  const raw=fullObservation();mutate(raw);assert.throws(()=>adaptFullAnalysis(raw,['front','back'],'pokemon'),/ANALYSIS_RESPONSE_INVALID/);
 }
});

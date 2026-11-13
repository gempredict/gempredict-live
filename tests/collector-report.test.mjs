import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fraxureScan,fraxureModel} from './helpers/fraxureFixture.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderReports} from './helpers/renderReports.mjs';
import {conditionReportStateFixture} from './helpers/conditionReportFixture.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
const primary=html=>html.split('<details>')[0];
test('full Fraxure regression retains independent core correction with unresolved finish and original AI disagreement',async()=>{
 const r=await fraxureScan();assert.equal(r.status,200);const p=r.payload;assert.equal(p.identityVerification.catalog.referenceId,'sm11-155');assert.equal(p.canonicalCard.brandSet,'Unified Minds');assert.equal(p.canonicalCard.cardNumber,'155/236');assert.equal(p.canonicalCard.year,'2019');assert.equal(p.coreCatalogIdentity.supported,true);assert.equal(p.originalIdentityObservation.identifiedBrandSet,'Cosmic Eclipse');assert.equal(p.originalIdentityObservation.identifiedParallel,'Reverse Holo');assert.ok(p.catalogComparison.initialConflicts.includes('brandSet'));assert.ok(!p.catalogComparison.finalConflicts.includes('brandSet'));assert.equal(p.catalogComparison.printing.status,'unresolved');assert.equal(p.physicalPrintingStatus.verified,false);assert.equal(p.financialDecision.allowed,false);assert.equal(p.canonicalCard.parallel,'Reverse Holo');assert.doesNotMatch(p.canonicalCard.displayName,/Reverse Holo/);
 const html=renderReports(reportFromResponse(p));for(const view of [html.upper,html.lower]){assert.match(primary(view),/2019/);assert.match(primary(view),/Unified Minds/);assert.match(primary(view),/Fraxure/);assert.doesNotMatch(primary(view),/Cosmic Eclipse/);assert.match(view,/Cosmic Eclipse/);}assert.match(primary(html.lower),/Finish and physical printing remain unverified/);assert.match(primary(html.lower),/Reverse Holo.*unverified/);
});
test('ambiguous candidates, wrong collector denominator and explicit user set conflicts never force correction',async()=>{
 for(const options of [{ambiguous:true},{model:{identifiedCardNumber:'155/237',identityReadings:fraxureModel.identityReadings.map(r=>r.field==='cardNumber'?{...r,text:'155/237'}:r)}},{fields:{cardSet:'2019 Cosmic Eclipse'}}]){
  const r=await fraxureScan(options);assert.equal(r.payload.coreCatalogIdentity.supported,false);assert.equal(r.payload.canonicalCard.brandSet,'Cosmic Eclipse');assert.equal(r.payload.financialDecision.allowed,false);
 }
});
test('missing or partial reverse flags are incomplete; explicit contradictory finish flags stay disputed without undoing core identity',async()=>{
 for(const variants of [undefined,{normal:true},{normal:true,reverse:false}]){const r=await fraxureScan({variants});assert.equal(r.payload.canonicalCard.brandSet,'Unified Minds');assert.equal(r.payload.coreCatalogIdentity.supported,true);assert.equal(r.payload.catalogComparison.printing.status,variants?.reverse===false?'conflict':'unresolved');assert.equal(r.payload.physicalPrintingStatus.verified,false);}
});
test('collector primary has three plain-English states; technical details closed and full evidence remains inspectable',async()=>{
 for(const cardType of ['pokemon','sports']){
  const r=await runScan({fields:{cardType},vision:conditionReportStateFixture(),items:[],neutral:[]});const p=reportFromResponse(r.payload),view=renderReports(p).lower,main=primary(view);
  assert.match(main,/Corners/);assert.match(main,/Edges/);assert.match(main,/Surface/);assert.match(main,/Centering/);assert.match(main,/Possible visible damage/);assert.match(main,/Unable to assess reliably/);assert.match(main,/Back photo/);assert.match(main,/resolution/);assert.match(main,/camera angle/);
  assert.doesNotMatch(main,/\[0\.01|inspectionCoverage|reasonCodes|coverage_not_established|Model-proposed photo region|Grade Ceiling|Estimated PSA Grade/);assert.match(view,/<details><summary[^>]*>Technical Details/);assert.doesNotMatch(view,/<details open/);assert.match(view,/inspectionCoverage/);assert.match(view,/0\.01/);assert.match(view,/Original AI Observation — Unverified/);
  const restored=protectFinancialReport(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.imageAnalysis.visualObservations,p.imageAnalysis.visualObservations);for(const f of FINANCIAL_FIELDS)assert.equal(restored[f],null);assert.equal(restored.imageAnalysis.overallScore,null);assert.match(protectedCopySummary(restored),/withheld/);
 }
 const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');assert.match(app,/repeat\(auto-fit, minmax\(min\(100%, 180px\), 1fr\)\)/);
});
test('save/restore cannot grant exact printing or finance to a corrected catalog core',async()=>{
 const r=await fraxureScan();const raw=JSON.parse(JSON.stringify(r.payload));raw.identityV2.identityVerified=true;raw.identityV2.printingVerified=true;raw.financialDecision={allowed:true};const safe=protectFinancialReport(raw);assert.equal(safe.financialDecision.allowed,false);assert.equal(safe.identityV2.printingVerified,false);assert.equal(safe.canonicalCard.brandSet,'Unified Minds');assert.match(protectedCopySummary(safe),/Cosmic Eclipse/);
 const sports=protectFinancialReport({identityV2:{category:'sports'},coreCatalogIdentity:{supported:true},imageAnalysis:{}});assert.doesNotMatch(primary(renderReports(sports).lower),/Core catalog identity supported/);assert.equal(sports.financialDecision.allowed,false);
});

test('supported regional clean result uses the collector state without claiming whole-card condition',async()=>{
 const finding={attribute:'surface',code:'no_defect_observed',certainty:'confirmed',evidence:{side:'front',region:[.1,.1,.1,.1],cue:'clear_inspected_area',confidence:.95}};
 const r=await runScan({vision:{visualObservations:[finding],inspectionCoverage:[{attribute:'surface',side:'front',regions:[{region:[0,0,.3,.3],status:'inspected'}],limitations:[]}]},items:[]});
 const p=reportFromResponse(r.payload),main=primary(renderReports(p).lower);assert.match(main,/No visible defect in inspected areas/);assert.match(main,/documented area/);assert.match(main,/not proof of mint/);assert.doesNotMatch(main,/\[0\.1|reasonCodes|PSA 10/);const copy=protectedCopySummary(p);assert.match(copy.split('Technical Details')[0],/No visible defect in inspected areas/);assert.match(copy,/model-proposed image region/);
});

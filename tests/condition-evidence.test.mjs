// Synthetic evidence + synthetic JPEG fixtures. No real detector accuracy claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionPresentation,readVisualEvidence} from '../lib/visualEvidence.mjs';
import {protectFinancialReport,protectedCopySummary,reportFromResponse,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {runScan,confirmed} from './helpers/reconciliationPipeline.mjs';
import {scan,vision} from './helpers/pikachuFixture.mjs';
import {renderReports} from './helpers/renderReports.mjs';
const codes={whitening:'localized_color_loss',chipping:'missing_edge_fragment',scratches:'surface_line',no_defect_observed:'clear_inspected_area',off_center:'border_width_difference'};
const f=(attribute='corners',code='whitening',side='front',region=[.01,.01,.1,.1])=>({attribute,code,certainty:'confirmed',evidence:{side,region,cue:codes[code],confidence:.95}});
const coverage=(attribute='surface',side='front',regions=[{region:[0,0,.4,.4],status:'inspected'}],limitations=[])=>({attribute,side,regions,limitations});
const inspect=(visualObservations=[],extra={})=>conditionPresentation({inspectedSides:['front','back'],visualObservations,...extra});
test('explicit clean-front coverage never invents inspected back or whole-surface cleanliness',()=>{
 const p=inspect([f('surface','no_defect_observed')],{inspectedSides:['front'],inspectionCoverage:[coverage()]});
 const front=p.inspectionCoverage.find(c=>c.side==='front'&&c.attribute==='surface'),back=p.inspectionCoverage.find(c=>c.side==='back'&&c.attribute==='surface');assert.equal(front.status,'partial');assert.equal(front.regions[0].status,'inspected');assert.equal(front.wholeAttributeVerified,false);assert.equal(back.reason,'photo_unavailable');assert.deepEqual(back.regions,[]);assert.match(p.surfaceNote,/documented area.*not proof of mint/);
});
test('distinct same-type corner, edge and scratch locations survive; only identical observations deduplicate',()=>{
 for(const [attribute,code] of [['corners','whitening'],['edges','chipping'],['surface','scratches']]){
  const a=f(attribute,code),b=f(attribute,code,'front',[.8,.8,.1,.1]);const p=inspect([a,b,a]);assert.equal(p.visualObservations.length,2);assert.deepEqual(p.visualObservations.map(o=>o.evidence.region),[a.evidence.region,b.evidence.region]);assert.ok(p.visualObservations.every(o=>o.certainty==='confirmed'));assert.deepEqual(inspect(p.visualObservations,p).visualObservations,p.visualObservations);
 }
});
test('different sides remain separate and overlapping clean/damage contradictions cannot confirm',()=>{
 const split=inspect([f('corners','no_defect_observed'),f('corners','whitening','back')]);assert.ok(split.visualObservations.every(o=>o.certainty==='confirmed'));
 const conflict=inspect([f('corners','no_defect_observed'),f('corners','whitening')]);assert.ok(conflict.visualObservations.every(o=>o.certainty!=='confirmed'));assert.equal(conflict.visualObservations.length,2);
 const separated=inspect([f('corners','no_defect_observed'),f('corners','whitening','front',[.8,.8,.1,.1])]);assert.ok(separated.visualObservations.every(o=>o.certainty==='confirmed'));
});
test('localized glare qualifies only overlapping findings and does not obscure the clear back',()=>{
 const rows=[coverage('surface','front',[{region:[0,0,1,1],status:'inspected'}],[{code:'glare',region:[0,0,.4,.4]}])];
 const p=inspect([f('surface','scratches'),f('surface','scratches','front',[.8,.8,.1,.1]),f('surface','scratches','back')],{inspectionCoverage:rows});assert.deepEqual(p.visualObservations.map(o=>o.certainty),['suspected','confirmed','confirmed']);assert.equal(p.inspectionCoverage.find(c=>c.side==='front'&&c.attribute==='surface').regions[0].status,'partial');
});
test('sleeve, blur, resolution and perspective limits remain conservative; model ratios do not establish geometry',()=>{
 for(const code of ['sleeve','blur','limited_resolution','perspective']){
  const p=inspect([f()],{imageLimitations:[code]});assert.notEqual(p.visualObservations[0].certainty,'confirmed');assert.equal(p.localizationVerified,false);
 }
 const a=f('centering','off_center');a.evidence.measurement={axis:'horizontal',ratio:[65,35],basis:'independent_pixel_measurement',verified:true};const p=inspect([a]);assert.equal(p.centeringGeometryVerified,false);assert.equal(p.centeringMeasurementStatus,'unverified_geometry');assert.notEqual(p.visualObservations[0].certainty,'confirmed');assert.equal(p.visualObservations[0].evidence.measurement.verified,undefined);
 assert.equal(inspect([f('centering','off_center')]).centeringMeasurementStatus,'unavailable');
});
test('missing photos, out-of-bounds boxes and findings outside explicit inspection scope stay unassessable',()=>{
 for(const a of [f('corners','whitening','back'),f('corners','whitening','front',[.9,.9,.2,.2])]){
  const p=inspect([a],{inspectedSides:['front']});assert.equal(p.visualObservations[0].certainty,'unassessable');assert.equal(p.visualObservations[0].evidence,undefined);
 }
 const p=inspect([f('surface','scratches','front',[.8,.8,.1,.1])],{inspectionCoverage:[coverage()]});assert.equal(p.visualObservations[0].certainty,'unassessable');
 const missingCertainty=f();delete missingCertainty.certainty;assert.equal(inspect([missingCertainty]).visualObservations[0].certainty,'unassessable');
 const noProof=conditionPresentation({visualObservations:[f()]});assert.deepEqual(noProof.inspectedSides,[]);assert.equal(noProof.visualObservations[0].certainty,'unassessable');assert.ok(noProof.inspectionCoverage.every(c=>c.status==='unassessable'));
});
test('coverage accepts only bounded supplied-side regions and does not derive them from legacy findings',()=>{
 const legacy=inspect([f()]);assert.ok(legacy.inspectionCoverage.every(c=>c.regions.length===0));
 const p=inspect([],{inspectedSides:['front'],inspectionCoverage:[coverage('surface','back'),coverage('surface','front',[{region:[1,1,1,1],status:'inspected'},{region:[0,0,1,1],status:'mint'}])],imageLimitations:'malformed'});assert.ok(p.inspectionCoverage.every(c=>c.regions.length===0));assert.equal(p.inspectionCoverage.length,8);
});
test('conflicting same-location certainty does not erase either claim or promote later confirmations',()=>{
 const a=f(),b={...f(),certainty:'unassessable'};const p=inspect([a,b]);assert.equal(p.visualObservations.length,2);assert.ok(p.visualObservations.every(o=>o.certainty!=='confirmed'));
 const restored=inspect(p.visualObservations,p);assert.ok(restored.visualObservations.every(o=>o.certainty!=='confirmed'));
});
test('sports and Pokemon full scans render and restore equal evidence policy while withholding grade/score/probability/advice',async()=>{
 const extra={visualObservations:[f('surface','scratches'),f('surface','scratches','front',[.8,.8,.1,.1])],inspectionCoverage:[coverage('surface','front',[{region:[0,0,1,1],status:'inspected'}])],estimatedGrade:'PSA 10',gradeCeiling:'PSA 10',overallScore:10,psa9Probability:99,psa10Probability:99,confidenceLevel:'high',worthGrading:true,surface:'excellent'};
 for(const category of ['sports','pokemon']){
  const r=category==='sports'?await runScan({vision:{...confirmed,...extra}}):await scan({vision:{...vision,...extra}});assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.sdkMaxRetries,0);
  const report=reportFromResponse(r.payload),restored=protectFinancialReport(JSON.parse(JSON.stringify(report)));const a=restored.imageAnalysis;
  for(const key of ['estimatedGrade','gradeCeiling','overallScore','psa9Probability','psa10Probability','confidenceLevel','worthGrading'])assert.equal(a[key],null,key);
  for(const key of FINANCIAL_FIELDS)assert.equal(restored[key],null,key);assert.equal(restored.financialDecision.allowed,false);assert.equal(restored.identityV2.printingVerified,false);
  assert.deepEqual(a.visualObservations,report.imageAnalysis.visualObservations);assert.deepEqual(a.inspectionCoverage,report.imageAnalysis.inspectionCoverage);assert.equal(a.visualObservations.length,2);
  const html=renderReports(restored).lower;assert.match(html,/partial.*reported region/);assert.match(html,/model proposals/);assert.doesNotMatch(html,/PSA 10|10 \/ 10|Lower Submission Risk/);
  const copied=protectedCopySummary(restored);assert.match(copied,/0\.8, 0\.8/);assert.match(copied,/Inspection coverage:.*partial/);assert.doesNotMatch(copied,/PSA 10|99%|Submit now/);
 }
});
test('legacy saved reports lose unsupported numeric scores/grades without invented coverage or financial permission',()=>{
 const p=protectFinancialReport({imageAnalysis:{overallScore:10,estimatedGrade:'PSA 10',gradeCeiling:'PSA 10',corners:'excellent',worthGrading:true},psa9Probability:99});assert.equal(p.imageAnalysis.overallScore,null);assert.equal(p.imageAnalysis.estimatedGrade,null);assert.equal(p.imageAnalysis.corners,null);assert.equal(p.psa9Probability,null);assert.ok(p.imageAnalysis.inspectionCoverage.every(c=>c.regions.length===0));assert.equal(p.financialDecision.allowed,false);assert.doesNotMatch(renderReports(p).lower,/PSA 10|10 \/ 10/);
});
test('front-only sports handler overrides forged model-side metadata and preserves unavailable back coverage',async()=>{
 const r=await runScan({back:false,vision:{...confirmed,inspectedSides:['front','back'],visualObservations:[f('edges','chipping','back')],inspectionCoverage:[coverage('edges','back')]}});assert.equal(r.status,200);assert.equal(r.metrics.images,1);assert.deepEqual(r.payload.imageAnalysis.inspectedSides,['front']);assert.equal(r.payload.imageAnalysis.visualObservations[0].certainty,'unassessable');assert.equal(r.payload.imageAnalysis.visualObservations[0].evidence,undefined);const back=r.payload.imageAnalysis.inspectionCoverage.find(c=>c.side==='back'&&c.attribute==='edges');assert.equal(back.reason,'photo_unavailable');assert.deepEqual(back.regions,[]);assert.doesNotMatch(renderReports(r.payload).lower,/Back photo:|Evidence: Back photo/);
});
test('over-budget evidence fails closed and saved reports cannot erase the limit warning',()=>{
 const a=inspect(Array.from({length:33},()=>f()));assert.equal(a.conditionEvidenceLimits.observationsExceeded,true);assert.ok(a.visualObservations.every(o=>o.certainty==='unassessable'));assert.equal(inspect(a.visualObservations,a).conditionEvidenceLimits.observationsExceeded,true);
 const b=inspect([f()],{inspectionCoverage:Array.from({length:9},()=>coverage('corners'))});assert.equal(b.conditionEvidenceLimits.coverageExceeded,true);assert.ok(b.visualObservations.every(o=>o.certainty==='unassessable'));assert.ok(b.inspectionCoverage.filter(c=>c.regions.length).every(c=>c.status==='unassessable'));
});

// Phase 2B: historical categories/states only; no historical coordinates inferred.
import {conditionReportStateFixture} from './helpers/conditionReportFixture.mjs';
async function stateReport(cardType='pokemon'){
 const r=await runScan({fields:{cardType},vision:conditionReportStateFixture()});assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);return reportFromResponse(r.payload);
}
test('Phase 2B synthetic seven-finding report preserves categories, states and side attribution for both categories',async()=>{
 for(const category of ['pokemon','sports']){
  const p=await stateReport(category),a=p.imageAnalysis;
  assert.equal(a.visualObservations.length,7);assert.equal(a.conditionAssessments.corners.observations.length,3);assert.equal(a.conditionAssessments.edges.observations.length,1);assert.equal(a.conditionAssessments.surface.observations.length,2);
  assert.ok(a.visualObservations.filter(f=>['corners','edges'].includes(f.attribute)).every(f=>f.certainty==='suspected'&&f.evidence.side==='back'));
  assert.ok(a.visualObservations.filter(f=>['surface','centering'].includes(f.attribute)).every(f=>f.certainty==='unassessable'));
  assert.ok(a.inspectionCoverage.every(c=>c.regions.length===0&&c.reason==='coverage_not_established'));assert.deepEqual(a.inspectedSides,['front','back']);assert.equal(a.localizationVerified,false);assert.equal(p.financialDecision.allowed,false);
 }
});
test('Phase 2B rendered actual report shows three possible back-corner findings and explicit unassessable front/back areas',async()=>{
 const html=renderReports(await stateReport()).lower.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 assert.equal((html.match(/Back photo: Possible corners whitening/g)||[]).length,3);assert.equal((html.match(/Back photo: Possible edges whitening/g)||[]).length,1);
 assert.match(html,/Front photo: Unassessable surface/);assert.match(html,/Back photo: Unassessable surface/);assert.match(html,/Front photo: Unassessable centering/);
 assert.match(html,/Possible defect/);assert.match(html,/resolution limits inspection/);assert.match(html,/Camera angle limits inspection/);assert.match(html,/coverage not established/);assert.match(html,/model proposals/);
 assert.doesNotMatch(html,/Visible defect observed|No visible defect detected|PSA 10|10 \/ 10|99%|Submit now|Lower Submission Risk/);
});
test('Phase 2B saved/restored/copy retains all findings and limitations without inventing coverage or advice',async()=>{
 const p=await stateReport(),saved=JSON.parse(JSON.stringify(p)),restored=protectFinancialReport(saved);
 assert.deepEqual(restored.imageAnalysis.visualObservations,p.imageAnalysis.visualObservations);assert.deepEqual(restored.imageAnalysis.inspectionCoverage,p.imageAnalysis.inspectionCoverage);
 assert.deepEqual(restored.imageAnalysis.imageLimitations,['limited_resolution','perspective']);
 for(const key of FINANCIAL_FIELDS)assert.equal(restored[key],null);
 for(const key of ['estimatedGrade','gradeCeiling','overallScore','psa9Probability','psa10Probability','worthGrading'])assert.equal(restored.imageAnalysis[key],null);
 const copy=protectedCopySummary(restored);assert.equal((copy.match(/back Possible corners whitening/g)||[]).length,3);assert.match(copy,/front Unassessable surface/);assert.match(copy,/back Unassessable surface/);assert.match(copy,/coverage_not_established/);assert.doesNotMatch(copy,/PSA 10|99%|Submit now/);
 // Limitations must remain explained in the copied report as well as the UI.
 assert.match(copy,/resolution|limited_resolution/);assert.match(copy,/perspective|Camera angle/);
});

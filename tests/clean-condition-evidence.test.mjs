// Synthetic cases only, never reconstructed coordinates or coverage of Harper.
import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionPresentation} from '../lib/visualEvidence.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderReports} from './helpers/renderReports.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const clean=(region=[.1,.1,.1,.1],side='front')=>({attribute:'surface',code:'no_defect_observed',certainty:'confirmed',evidence:{side,region,cue:'clear_inspected_area',confidence:.95}});
const scope=(regions=[{region:[0,0,1,1],status:'inspected'}],limitations=[],side='front')=>({attribute:'surface',side,regions,limitations});
const inspect=(rows,extra={})=>conditionPresentation({inspectedSides:['front','back'],visualObservations:rows,...extra});
test('qualified regional clean evidence requires explicit accepted inspected scope and never whole-card verification',()=>{
 const p=inspect([clean()],{inspectionCoverage:[scope()]});assert.equal(p.visualObservations[0].certainty,'confirmed');assert.equal(p.conditionAssessments.surface.state,'no_defect_observed');assert.equal(p.inspectionCoverage.find(c=>c.side==='front'&&c.attribute==='surface').status,'partial');assert.equal(p.inspectionCoverage[0].wholeAttributeVerified,false);assert.match(p.surfaceNote,/documented area.*not proof of mint/);
});
test('missing, rejected and partially inspected coverage stay unassessable with different reasons',()=>{
 for(const [coverage,reason] of [[undefined,'inspection_coverage_missing'],[[scope([{region:[.9,.9,.5,.5],status:'inspected'}])],'inspection_coverage_rejected'],[[scope([{region:[0,0,1,1],status:'partial'}])],'inspection_region_not_inspected']]){
  const p=inspect([clean()],{inspectionCoverage:coverage});assert.equal(p.visualObservations[0].certainty,'unassessable');assert.ok(p.visualObservations[0].reasonCodes.includes(reason));assert.deepEqual(protectFinancialReport({imageAnalysis:p}).imageAnalysis.visualObservations,p.visualObservations);
 }
});
test('clean outside inspected region or with missing localization/cue stays unassessable',()=>{
 const p=inspect([clean([.8,.8,.1,.1])],{inspectionCoverage:[scope([{region:[0,0,.4,.4],status:'inspected'}])]});assert.ok(p.visualObservations[0].reasonCodes.includes('outside_inspection_scope'));
 for(const bad of [{...clean(),evidence:null},{...clean(),evidence:{...clean().evidence,cue:'fabricated'}}]){const v=inspect([bad],{inspectionCoverage:[scope()]});assert.equal(v.visualObservations[0].certainty,'unassessable');assert.ok(v.visualObservations[0].reasonCodes.includes('invalid_localization_cue_or_measurement'));}
});
test('global perspective remains conservative while scoped glare affects only its overlapping region',()=>{
 const rows=[clean(),clean([.8,.8,.1,.1])];const global=inspect(rows,{inspectionCoverage:[scope()],imageLimitations:['perspective']});assert.ok(global.visualObservations.every(f=>f.certainty==='unassessable'&&f.reasonCodes.includes('global_photo_limitation')));
 const scoped=inspect(rows,{inspectionCoverage:[scope(undefined,[{code:'glare',region:[0,0,.4,.4]}])]});assert.deepEqual(scoped.visualObservations.map(f=>f.certainty),['unassessable','confirmed']);assert.ok(scoped.visualObservations[0].reasonCodes.includes('scoped_photo_limitation'));assert.deepEqual(scoped.visualObservations[1].reasonCodes,[]);
});
test('overlapping suspected damage contradicts clean evidence; clean front and damage back remain separate',()=>{
 const damage={...clean(),code:'scratches',certainty:'suspected',evidence:{...clean().evidence,cue:'surface_line'}};
 const conflict=inspect([clean(),damage],{inspectionCoverage:[scope()]});assert.ok(conflict.visualObservations.every(f=>f.reasonCodes.includes('contradictory_observations')));assert.equal(conflict.visualObservations[0].certainty,'unassessable');
 const separate=inspect([clean(),{...damage,evidence:{...damage.evidence,side:'back'}}],{inspectionCoverage:[scope()]});assert.deepEqual(separate.visualObservations.map(f=>f.certainty),['confirmed','suspected']);
});
test('multiple regional clean findings survive both categories, restore/copy and financial/printing withholding',async()=>{
 for(const category of ['sports','pokemon']){
  const r=await runScan({fields:{cardType:category},vision:{identifiedSubject:'Synthetic clean fixture',identifiedBrandSet:'Synthetic product',visualObservations:[clean(),clean([.8,.8,.1,.1])],inspectionCoverage:[scope()],estimatedGrade:'PSA 10',overallScore:10,psa10Probability:99,worthGrading:true}});assert.equal(r.status,200);
  const p=reportFromResponse(r.payload),restored=protectFinancialReport(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.imageAnalysis.visualObservations,p.imageAnalysis.visualObservations);assert.equal(p.imageAnalysis.visualObservations.length,2);assert.ok(p.imageAnalysis.visualObservations.every(f=>f.certainty==='confirmed'));
  const html=renderReports(restored).lower;assert.match(html,/No visible defect detected/);assert.match(html,/not proof of mint/);assert.match(html,/partial/);assert.doesNotMatch(html,/PSA 10|10 \/ 10|Lower Submission Risk/);
  const copy=protectedCopySummary(restored);assert.equal((copy.match(/No visible defect observed in the documented area/g)||[]).length,2);assert.match(copy,/0\.8, 0\.8/);for(const f of FINANCIAL_FIELDS)assert.equal(restored[f],null);assert.equal(restored.imageAnalysis.estimatedGrade,null);assert.equal(restored.imageAnalysis.overallScore,null);assert.equal(restored.identityV2.printingVerified,false);assert.equal(restored.financialDecision.allowed,false);
 }
});
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'24afd423ed061cd327395c65c8806fe97fab20ae',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('authorized diagnostics map same-type regions accurately and distinguish absence, limitation and contradiction without coordinates',async()=>{
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 const r=await runScan({env,headers:req.headers,vision:{visualObservations:[clean(),clean([.8,.8,.1,.1])],inspectionCoverage:[scope(undefined,[{code:'glare',region:[0,0,.4,.4]}])]}});const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.deepEqual(d.model.observations.map(o=>o.result),['unassessable','confirmed']);assert.ok(d.model.observations[0].reasons.includes('scoped_photo_limitation'));assert.deepEqual(d.model.observations[1].reasons,[]);assert.equal(d.model.coverageSummary.field,'array');assert.doesNotMatch(JSON.stringify(d),/0\.8|clear_inspected_area/);
 const missing=await runScan({env,headers:req.headers,vision:{visualObservations:[clean()]}});const md=readDiagnosticTicket(req,missing.responseHeaders[TICKET_HEADER],missing.responseHeaders[SCAN_HEADER],env);assert.ok(md.model.observations[0].reasons.includes('inspection_coverage_missing'));assert.equal(md.model.coverageSummary.field,'missing');
});

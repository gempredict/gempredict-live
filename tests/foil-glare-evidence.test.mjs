import test from 'node:test';
import assert from 'node:assert/strict';
import {foilGlareCases,foilCaseResponse} from './helpers/foilGlareFixtures.mjs';
import {conditionPresentation} from '../lib/visualEvidence.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {reportFromResponse,protectFinancialReport,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderReports} from './helpers/renderReports.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
for(const c of foilGlareCases())test('offline foil matrix: '+c.id,()=>{
 const p=conditionPresentation({...foilCaseResponse(c),inspectedSides:['front','back']});
 assert.deepEqual(p.visualObservations.map(f=>f.certainty),c.expected);assert.equal(p.visualObservations.length,c.observations.length);
 c.reasons.forEach((reasons,i)=>{for(const reason of reasons)assert.ok(p.visualObservations[i].reasonCodes.includes(reason));});
 if(c.id==='suspected_scratch_away_from_glare')assert.deepEqual(p.visualObservations[0].reasonCodes,[]);
 assert.equal(p.localizationVerified,false);assert.equal(p.centeringGeometryVerified,false);assert.ok(p.inspectionCoverage.every(c=>c.wholeAttributeVerified===false));
});
test('global quality limitations remain conservative across both supplied photos',()=>{
 for(const code of ['perspective','blur','glare','sleeve','limited_resolution','cropped','occluded']){
  const c=foilGlareCases().find(c=>c.id==='clear_back_glare_obscured_front');c.coverage.forEach(s=>s.limitations=[]);const p=conditionPresentation({...foilCaseResponse(c),imageLimitations:[code],inspectedSides:['front','back']});assert.ok(p.visualObservations.every(f=>f.certainty==='unassessable'&&f.reasonCodes.includes('global_photo_limitation')),code);
 }
});
test('foil/reflection cues or confidence alone cannot authenticate a scratch or regional cleanliness',()=>{
 for(const code of ['scratches','no_defect_observed']){const c=foilGlareCases()[0],r=foilCaseResponse(c);r.visualObservations[0].code=code;r.visualObservations[0].evidence.cue='foil_pattern';r.visualObservations[0].evidence.confidence=1;const p=conditionPresentation({...r,inspectedSides:['front','back']});assert.equal(p.visualObservations[0].certainty,'unassessable');assert.ok(p.visualObservations[0].reasonCodes.includes('invalid_localization_cue_or_measurement'));}
});
test('all matrix scenarios render, restore and copy with category parity and withholding',async()=>{
 for(const c of foilGlareCases()){
  const reports=[];
  for(const cardType of ['pokemon','sports']){
   const r=await runScan({fields:{cardType},vision:foilCaseResponse(c),items:[],neutral:[]});assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.sdkMaxRetries,0);
   const p=reportFromResponse(r.payload),restored=protectFinancialReport(JSON.parse(JSON.stringify(p)));reports.push(restored.imageAnalysis);
   assert.deepEqual(restored.imageAnalysis.visualObservations,p.imageAnalysis.visualObservations);assert.deepEqual(restored.imageAnalysis.inspectionCoverage,p.imageAnalysis.inspectionCoverage);
   const html=renderReports(restored).lower,copy=protectedCopySummary(restored);assert.doesNotMatch(html,/PSA 10|10 \/ 10|99%|Lower Submission Risk/);assert.doesNotMatch(copy,/PSA 10|99%|Submit now/);
   for(const key of FINANCIAL_FIELDS)assert.equal(restored[key],null);assert.equal(restored.imageAnalysis.estimatedGrade,null);assert.equal(restored.imageAnalysis.overallScore,null);assert.equal(restored.identityV2.printingVerified,false);assert.equal(restored.financialDecision.allowed,false);
   if(c.expected.includes('suspected'))assert.match(html,/Possible (?:surface|corners|centering)/);
   if(c.expected.includes('unassessable'))assert.match(html,/Unable to assess/);
   if(c.id==='clear_back_glare_obscured_front'){assert.match(html,/Back photo: No visible defect observed in the documented area/);assert.match(html,/Front photo:.*unassessable/);assert.match(copy,/back No visible defect observed/);}
   if(c.id==='two_suspected_scratches_only_one_masked'){assert.equal((html.match(/Front photo: Possible surface scratches/g)||[]).length,2);assert.match(copy,/0\.75, 0\.75/);assert.match(copy,/glare/);}
   if(c.id==='sleeve_reflection_possible_print_line')assert.match(html,/sleeve/);
   if(c.id==='angled_uncertain_centering'){assert.match(html,/Camera angle limits inspection/);assert.equal(restored.imageAnalysis.centeringMeasurementStatus,'unverified_geometry');}
  }
  assert.deepEqual(reports[0].visualObservations,reports[1].visualObservations);assert.deepEqual(reports[0].inspectionCoverage,reports[1].inspectionCoverage);
 }
});
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'74b09cc0259d1c4d893041cb64842522e3cbb203',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('diagnostics retain actual masking reasons even when a suspected finding did not change certainty',async()=>{
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 const c=foilGlareCases().find(c=>c.id==='two_suspected_scratches_only_one_masked');const r=await runScan({env,headers:req.headers,vision:foilCaseResponse(c),items:[],neutral:[]});const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);
 assert.deepEqual(d.model.observations.map(o=>o.result),['suspected','suspected']);assert.equal(d.model.observations[0].downgraded,false);assert.deepEqual(d.model.observations[0].reasons,['scoped_photo_limitation']);assert.deepEqual(d.model.observations[1].reasons,[]);assert.doesNotMatch(JSON.stringify(d),/surface_line|0\.75|0\.12/);
});

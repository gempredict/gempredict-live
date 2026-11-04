import test from 'node:test';
import assert from 'node:assert/strict';
import {scan,vision} from './helpers/pikachuFixture.mjs';
import {renderReports} from './helpers/renderReports.mjs';
import {protectFinancialReport,reportFromResponse,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
const clean=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const cues={no_defect_observed:'clear_inspected_area',whitening:'localized_color_loss',scratches:'surface_line',crease:'surface_deformation',off_center:'border_width_difference'};
const finding=(attribute,code,side='front',patch={})=>({attribute,code,certainty:'confirmed',evidence:{side,region:[0.1,0.1,0.2,0.2],cue:cues[code],confidence:0.95,...patch}});
async function report(extra={},options={}){
 const r=await scan({...options,vision:{...vision,...extra}});
 assert.equal(r.status,200);assert.equal(r.metrics.valuation,0);
 const p=reportFromResponse(r.payload);
 for(const key of FINANCIAL_FIELDS)assert.equal(p[key],null,key);
 assert.equal(p.financialDecision.allowed,false);assert.equal(p.imageAnalysis.estimatedGrade,null);assert.equal(p.imageAnalysis.worthGrading,null);
 return {p,html:clean(renderReports(p).lower),metrics:r.metrics};
}
test('complete front/back handler preserves localized clean observations as no visible defect, not unassessed or mint',async()=>{
 const visualObservations=['centering','corners','edges','surface'].map((a,i)=>finding(a,'no_defect_observed',i%2?'back':'front'));
 const {p,html,metrics}=await report({visualObservations});
 assert.equal(metrics.images,2);assert.match(metrics.visionPrompt,/Image 1.*FRONT/);assert.match(metrics.visionPrompt,/Image 2.*BACK/);
 for(const a of ['centering','corners','edges','surface']){assert.equal(p.imageAnalysis.conditionAssessments[a].state,'no_defect_observed');assert.equal(p.imageAnalysis[a],null);}
 assert.equal((html.match(/No visible defect detected/g)||[]).length,4);
 assert.match(html,/Evidence: Front photo/);assert.match(html,/Evidence: Back photo/);assert.match(html,/not proof of mint condition/);
});
test('complete handler retains qualitative fields without promoting unlocalized notes to defect evidence',async()=>{
 const {p,html}=await report({cornersNote:'Front corners appear sharp in this photo.',surfaceNote:'Glare prevents complete surface inspection.',photoNotes:[{attribute:'edges',side:'back',text:'Back edges are visible without obvious whitening.'}]});
 assert.equal(p.imageAnalysis.conditionAssessments.corners.state,'unassessable');
 assert.match(html,/Model photo note — unverified \(Photo side not established\): Front corners appear sharp/);
 assert.match(html,/Model photo note — unverified \(Back photo\): Back edges are visible/);
 assert.match(html,/Glare prevents complete surface inspection/);assert.match(html,/Unable to assess/);
});
test('missing observations never inherit model good ratings or invented clean findings',async()=>{
 const {p,html}=await report({visualObservations:[],corners:'good',surface:'excellent'});
 assert.equal((html.match(/Unable to assess/g)||[]).length,4);
 assert.equal(p.imageAnalysis.visualObservations.length,0);assert.doesNotMatch(html,/No visible defect detected/);
 assert.equal(p.imageAnalysis.overallScore,null);
});
test('front-only image rejects back claims and retains explicit back/resolution limitations',async()=>{
 const {p,html,metrics}=await report({visualObservations:[finding('corners','no_defect_observed','back')],photoNotes:[{attribute:'edges',side:'back',text:'Back edges show whitening.'}],imageLimitations:['limited_resolution']},{back:false});
 assert.equal(metrics.images,1);assert.deepEqual(p.imageAnalysis.inspectedSides,['front']);
 assert.equal(p.imageAnalysis.conditionAssessments.corners.state,'unassessable');assert.deepEqual(p.imageAnalysis.conditionAssessments.corners.sides,[]);
 assert.match(html,/back is not visible/);assert.match(html,/resolution limits inspection/);assert.doesNotMatch(html,/Evidence: Back photo|Back edges show whitening/);
});
test('uncertain and glare-limited findings remain possible observations, never confirmed defects',async()=>{
 const {p,html}=await report({visualObservations:[{...finding('surface','scratches'),certainty:'suspected'},finding('corners','whitening')],imageLimitations:['glare']});
 assert.equal(p.imageAnalysis.conditionAssessments.surface.state,'suspected_defect');assert.equal(p.imageAnalysis.conditionAssessments.corners.state,'suspected_defect');
 assert.match(html,/Possible defect/);assert.match(html,/Possible surface scratches/);assert.match(html,/Glare limits surface inspection/);assert.doesNotMatch(html,/Visible defect observed/);
});
test('front clean area and back defect are separate observations; contradictory same-side assertions remain uncertain',async()=>{
 const split=await report({visualObservations:[finding('corners','no_defect_observed','front'),finding('corners','whitening','back')]});
 assert.equal(split.p.imageAnalysis.conditionAssessments.corners.state,'confirmed_visible_defect');
 assert.deepEqual(split.p.imageAnalysis.visualObservations.map(f=>f.certainty),['confirmed','confirmed']);
 assert.match(split.html,/Evidence: Front photo, Back photo/);
 assert.match(split.html,/Front photo: No visible defect observed/);assert.match(split.html,/Back photo: Visible corner whitening/);
 const conflict=await report({visualObservations:[finding('corners','no_defect_observed'),finding('corners','whitening')],corners:'excellent',cornersNote:'Corners look perfect.'});
 assert.equal(conflict.p.imageAnalysis.conditionAssessments.corners.state,'unassessable');
 assert.doesNotMatch(conflict.html,/No visible defect detected|Visible defect observed|Corners look perfect/);
});
test('centering without measured evidence cannot become a precise confirmed finding',async()=>{
 const {p,html}=await report({visualObservations:[finding('centering','off_center')],centeringNote:'Centering appears 60/40 with 95% confidence.'});
 assert.equal(p.imageAnalysis.conditionAssessments.centering.state,'unassessable');assert.doesNotMatch(html,/60\/40|95%/);
});
test('safe photo notes and evidence survive saved-report revalidation without restoring financial advice',async()=>{
 const {p}=await report({visualObservations:[finding('edges','whitening','back')],photoNotes:[{attribute:'surface',side:'front',text:'Surface glare limits inspection. Submit for profit at $500.'}]});
 const restored=protectFinancialReport(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(restored.imageAnalysis.modelPhotoNotes,p.imageAnalysis.modelPhotoNotes);
 assert.deepEqual(restored.imageAnalysis.visualObservations,p.imageAnalysis.visualObservations);
 const html=clean(renderReports(restored).lower);assert.match(html,/Visible defect observed/);assert.match(html,/Surface glare limits inspection/);assert.doesNotMatch(html,/\$500|Submit for profit/);
 assert.match(html,/2026.*30th Celebration/);assert.match(html,/Original AI Observation — Unverified/);assert.equal(restored.financialDecision.allowed,false);
});

test('localized structural damage remains visible without becoming a grading recommendation',async()=>{
 const {p,html}=await report({visualObservations:[finding('corners','crease','back')],worthGrading:true});
 assert.equal(p.imageAnalysis.visualSafetyFlags.structuralDamage,true);
 assert.match(html,/Back photo: Visible corner crease/);assert.match(html,/Visible structural damage requires physical inspection/);
 assert.doesNotMatch(html,/High Submission Risk|Lower Submission Risk/);
});

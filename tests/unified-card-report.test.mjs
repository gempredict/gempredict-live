import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fraxureScan} from './helpers/fraxureFixture.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {conditionReportStateFixture} from './helpers/conditionReportFixture.mjs';
import {renderReports,unifiedReportInteraction} from './helpers/renderReports.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {unifiedReportPresentation} from '../lib/unifiedReportPresentation.mjs';
const clean=s=>s.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
test('complete Pokémon handler feeds a single report with canonical core, qualified condition, pending sales and embedded existing calculator',async()=>{
 const r=await fraxureScan({model:{...conditionReportStateFixture(),identifiedSubject:'Fraxure',identifiedCardNumber:'155/236',identifiedBrandSet:'Cosmic Eclipse',identifiedYear:'2019'}});
 const safe=reportFromResponse(r.payload),html=renderReports(safe).upper,body=clean(html);
 assert.equal((html.match(/aria-label="Unified card analysis report"/g)||[]).length,1);
 assert.match(body,/Unified Minds.*Fraxure/);assert.match(body,/Collector number 155\/236/);assert.match(body,/Possible visible damage/);assert.match(body,/Back photo/);assert.match(body,/resolution/);
 for(const section of ['Card identification','Condition evidence','Completed sales evidence','eBay discovery','Grading economics'])assert.ok(html.includes(`aria-label="${section}"`));
 assert.ok(html.includes('econ-embedded'));assert.ok(!html.includes('<main'));assert.doesNotMatch(body,/GemPredict Score|Grade It|Consider It/);
 assert.match(body,/Inspect the flagged areas before deciding/);assert.match(body,/No qualified feed connected/);assert.match(body,/Grading break-even/);assert.equal(safe.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(safe[f],null);
});
test('unrelated sports metadata cannot classify a Pokémon report as Baseball; category disagreements remain explicit',async()=>{
 const r=await fraxureScan();const safe=protectFinancialReport({...reportFromResponse(r.payload),sport:'Baseball',category:'Baseball',cardMeta:'Baseball · 2022',identityV2:{...r.payload.identityV2,sport:'Baseball'}});
 const html=renderReports(safe).upper,primary=clean(html.split('<details>')[0]);assert.match(primary,/Pokémon/);assert.doesNotMatch(primary,/Baseball|2022/);
 const view=unifiedReportPresentation({...safe,cardType:'sports'});assert.equal(view.category,'Category needs review');assert.equal(view.identityLabel,'Identity needs review');
});
test('legacy Mint/Excellent and forged valuations never become condition classifications or sale evidence',()=>{
 const report=protectFinancialReport({cardTitle:'Synthetic unverified card',identityV2:{category:'sports'},imageAnalysis:{corners:'excellent',edges:'mint',estimatedGrade:'PSA 10',overallScore:10,cornersNote:'Mint',imageSummary:'GENERIC_AI_ESSAY',gradingRisk:'UNSUPPORTED_PROSE'},rawValue:98765,psa10Value:99999,expectedNetValue:12345,completedSales:{records:[{amount:654321}]},marketData:{success:true,count:1,rawComparableItems:[{title:'UNRELATED_STERLING_PURPLE_250',priceValue:88888}],marketSummary:{fairMarketValue:88888,rawMedian:88888}}});
 const html=clean(renderReports(report).upper);assert.doesNotMatch(html,/Excellent|GENERIC_AI_ESSAY|UNSUPPORTED_PROSE|UNRELATED_STERLING_PURPLE_250|98765|99999|88888|654321/);assert.match(html,/Unable to assess reliably/);assert.match(html,/Exact printing is not independently verified/);assert.match(html,/Not available/);assert.equal(report.financialDecision.allowed,false);
});
test('sports full handler preserves alphanumeric identity and qualified defects without independent sports-catalog claims',async()=>{
 const r=await runScan({fields:{cardType:'sports'},vision:{...conditionReportStateFixture(),identifiedSubject:'Konnor Griffin',identifiedYear:'2024',identifiedBrandSet:'Bowman Chrome Prospects',identifiedCardNumber:'BCP-86',identifiedParallel:'Mojo Refractor'},items:[],neutral:[]});
 const report=reportFromResponse(r.payload),html=clean(renderReports(report).upper);assert.match(html,/Sports card/);assert.match(html,/BCP-86/);assert.match(html,/Possible visible damage/);assert.match(html,/Identification proposal/);assert.equal(report.financialDecision.allowed,false);
});
test('saved/restored reports and copy preserve identity, localized findings and withheld economics',async()=>{
 const r=await fraxureScan();const report=reportFromResponse(r.payload),restored=protectFinancialReport(JSON.parse(JSON.stringify(report)));
 assert.equal(renderReports(restored).upper,renderReports(report).upper);const copy=protectedCopySummary(restored);assert.match(copy,/Unified Minds/);assert.match(copy,/Cosmic Eclipse/);assert.match(copy,/withheld/);assert.equal(restored.financialDecision.allowed,false);
});
test('unified actions save and copy only protected report data; manual assumptions cannot unlock or contaminate saved evidence',async()=>{
 const r=await fraxureScan();const report=reportFromResponse({...r.payload,rawValue:200,financialDecision:{allowed:true}});let copied='',saved;
 const ui=unifiedReportInteraction(report,{navigator:{clipboard:{writeText(s){copied=s;}}}});const tree=ui.render({onSave:r=>{saved=r;}});
 const button=name=>ui.nodes(tree,n=>n.type==='button'&&n.props.children===name)[0];button('Copy Summary').props.onClick();button('Save Report').props.onClick();assert.match(copied,/withheld/);assert.equal(saved.financialDecision.allowed,false);assert.equal(saved.rawValue,null);assert.equal(saved.manualScenario,undefined);assert.equal(saved.originalIdentityObservation.identifiedBrandSet,report.originalIdentityObservation.identifiedBrandSet);
 const app=fs.readFileSync('src/App.jsx','utf8');assert.ok(!app.includes('<ImageAnalysisCard report={r} />'));assert.ok(app.includes('<ConditionSnapshot data={data.imageAnalysis} demo={demo}/>'));assert.ok(app.includes('<ScanDiagnostics report={saved} />'));
});

test('sports and unsupported TCG categories cannot borrow a core-catalog badge from unrelated flags',()=>{
 for(const category of ['sports','mtg','unknown']){const r=protectFinancialReport({identityV2:{category},coreCatalogIdentity:{supported:true},rarityVerification:{verified:true},cardTitle:'Synthetic proposal'});assert.equal(unifiedReportPresentation(r).identityLabel,'Identification proposal');}
});

test('identity-only results use the unified shell without claiming condition or marketplace stages ran',async()=>{
 const model={...Object.fromEntries(['identifiedSubject','identifiedYear','identifiedBrandSet','identifiedCardNumber','identifiedLanguage','identifiedParallel','identifiedRarity','identifiedFranchise','identifiedManufacturer','identifiedAutoOrRelic','identityNotes','identityConfidence'].map(k=>[k,null])),identifiedSubject:'Konnor Griffin',identifiedCardNumber:'BCP-86',identityReadings:[]};const r=await runScan({fields:{mode:'identity',cardType:'sports'},visionResponse:{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(model)}]}});assert.equal(r.status,200);const safe=reportFromResponse(r.payload);const body=clean(renderReports(safe).upper);assert.match(body,/Condition analysis: not requested/);assert.match(body,/Not requested/);assert.match(body,/Original AI Observation/);assert.equal(r.metrics.internal.length,0);assert.equal(safe.financialDecision.allowed,false);
});

test('mixed-side surface summary states front uncertainty and suspected back scratches without changing aggregate or saved evidence',async()=>{
 const model={inspectedSides:['front','back'],imageLimitations:['perspective'],visualObservations:[{attribute:'surface',code:'scratches',certainty:'suspected',evidence:{side:'back',region:[0.15,0.15,0.25,0.25],cue:'surface_line',confidence:0.7}},{attribute:'surface',code:'no_defect_observed',certainty:'confirmed',evidence:{side:'front',region:[0.6,0.6,0.1,0.1],cue:'clear_inspected_area',confidence:0.9}}]};
 const response=await fraxureScan({model});const safe=reportFromResponse(response.payload),restored=protectFinancialReport(JSON.parse(JSON.stringify(safe)));
 for(const report of [safe,restored]){assert.equal(report.imageAnalysis.conditionAssessments.surface.state,'unassessable');const html=renderReports(report).upper;assert.match(clean(html),/Front surface: unable to assess reliably/);assert.match(clean(html),/Back surface: suspected scratches/);assert.match(clean(html),/Suspected defects require physical confirmation/);assert.equal(report.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(report[f],null);assert.ok(report.imageAnalysis.conditionAssessments.surface.observations.some(o=>o.side==='back'&&o.certainty==='suspected'&&o.code==='scratches'));}
 assert.match(protectedCopySummary(restored),/surface|Surface/);assert.doesNotMatch(clean(renderReports(safe).upper),/Back surface: confirmed/);
});

test('Babe Ruth SV-40 historical reference does not turn a mocked scan proposal into runtime verification',async()=>{
 const manifest=JSON.parse(fs.readFileSync('benchmarks/identity/manifest.json','utf8'));
 const slot=manifest.cards.find(card=>card.id==='GP-ID-008');
 assert.equal(slot.groundTruth.fields.subset.value,'Sweet Victory');
 const result=await runScan({fields:{cardType:'sports'},vision:{
  identifiedSubject:'Babe Ruth',identifiedYear:'2025',identifiedBrandSet:'2025 Topps Allen & Ginter - Storied Victories insert',
  identifiedCardNumber:'SV-40',identityReadings:[],
 },items:[],neutral:[]});
 assert.equal(result.status,200);
 const report=reportFromResponse(result.payload);
 const html=clean(renderReports(report).upper);
 assert.match(html,/Babe Ruth #SV-40/);
 assert.match(html,/Storied Victories/);
 assert.match(html,/Identification proposal/);
 assert.match(html,/printing not verified/);
 assert.match(html,/Get a clearer view before deciding/);
 assert.match(html,/Grading break-even/);
 assert.doesNotMatch(html,/Accuracy Lab|Sweet Victory|Card name or description|PSA 10 Odds/);
 assert.equal(report.financialDecision.allowed,false);
});

test('compact observations distinguish localized defects, clear areas, uncertainty and limited photos',()=>{
 const imageAnalysis={visualEvidenceVersion:4,inspectedSides:['front','back'],imageLimitations:['glare'],
  compactPhotoObservations:[
   {side:'back',region:'corner_bottom_right',status:'apparent',text:'bottom right corner: Mild whitening.'},
   {side:'front',region:'edge_top',status:'apparent',text:'top edge: No obvious wear.'},
   {side:'back',region:'surface',status:'possible',text:'surface, left: Possible scuff.'},
   {side:'front',region:'centering',status:'not_assessable',text:'centering: Glare obscures the border.'},
  ]};
 const body=clean(renderReports({imageAnalysis}).upper);
 assert.match(body,/Back · Reported visible defect: bottom right corner: Mild whitening/);
 assert.match(body,/Front · No obvious defect: top edge: No obvious wear/);
 assert.match(body,/Back · Possible defect or limitation: surface, left: Possible scuff/);
 assert.match(body,/Front · Not assessable: centering: Glare obscures the border/);
 assert.match(body,/Use sharp, straight-on photos of both sides/);
 assert.doesNotMatch(body,/PSA 10 quality|Odds/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {distinctConditionRows,conditionSnapshot,reportHero} from '../lib/unifiedReportPresentation.mjs';
import {collectorConditions} from '../lib/collectorPresentation.mjs';
import {demoExample} from '../lib/demoReportServer.mjs';
import {renderReports,unifiedReportInteraction} from './helpers/renderReports.mjs';
import {protectFinancialReport,protectedCopySummary} from '../lib/financialSafety.mjs';
import {qualifyCompletedSales,SALES_COHORTS} from '../lib/completedSales.mjs';
import {salesContext,syntheticSales} from './helpers/completedSalesFixture.mjs';
const row={side:'back',code:'whitening',certainty:'suspected',cue:'localized_color_loss',text:'Possible corner whitening',region:[.1,.1,.1,.1]};
test('presentation deduplication retains different sides, regions, certainty, cues and provenance without changing original data',()=>{
 const rows=[row,structuredClone(row),{...row,region:[.7,.1,.1,.1]},{...row,side:'front'},{...row,certainty:'unassessable'},{...row,cue:'other_cue'},{...row,sourceReference:'another-photo'}],before=JSON.stringify(rows);
 const unique=distinctConditionRows(rows);assert.equal(unique.length,6);assert.equal(JSON.stringify(rows),before);
 const groups=conditionSnapshot([{key:'corners',observations:rows}])[0];assert.equal(groups.observations.length,6);assert.equal(groups.groups.length,5);assert.ok(groups.groups.some(g=>g.locations.length===2));assert.match(groups.brief,/Back/);assert.match(groups.brief,/Front/);
});
test('existing synthetic defects are summarized once per issue with multiple locations retained in detailed evidence',()=>{
 const d=demoExample('pokemon'),before=JSON.stringify(d.report),snap=conditionSnapshot(collectorConditions(d.report.imageAnalysis));
 const corners=snap.find(s=>s.key==='corners');assert.equal(corners.groups.length,1);assert.equal(corners.groups[0].locations.length,3);assert.match(corners.brief,/3 regions/);
 const html=renderReports(d.report,null,{demo:true}).upper;assert.match(html,/Detailed Condition Findings/);assert.match(html,/Image regions:/);assert.match(html,/Inspection coverage/);assert.match(html,/3 regions/);assert.equal(JSON.stringify(d.report),before);
});
test('hero preserves canonical card identifiers while original proposals and unresolved printing remain secondary',()=>{
 for(const id of ['pokemon','sports']){const d=demoExample(id),hero=reportHero(d.report);assert.equal(hero.title,id==='pokemon'?'Fraxure #155/236':'Konnor Griffin #BCP-86');assert.match(hero.subtitle,id==='pokemon'?/2019 · Unified Minds/:/2024 · Bowman Chrome Prospects/);const html=renderReports(d.report,null,{demo:true}).upper;assert.match(html,/printing not verified/);assert.match(html,/Original AI Observation — Unverified/);if(id==='pokemon')assert.match(html,/Cosmic Eclipse/);}
});
test('one shared missing-market state has no invented zero amounts, per-grade empty cards, grades or probabilities',()=>{
 const html=renderReports(demoExample('sports').report,null,{demo:true}).upper;assert.equal((html.match(/Verified sales data isn&#x27;t available yet/g)||[]).length,1);assert.equal((html.match(/gp-market-cell"/g)||[]).length,0);for(const g of SALES_COHORTS)assert.ok(html.includes(g));assert.match(html,/PSA outlook not available yet/);assert.doesNotMatch(html,/\$0|PSA 10 Odds|GemPredict Score|Mint|Excellent|Grade It/);
});
test('qualified historical medians stay separated by cohort, with evidence in disclosures and no financial authorization',()=>{
 const records=SALES_COHORTS.flatMap((g,i)=>syntheticSales(g,[String(10+i*10),String(20+i*10),String(30+i*10)])),e=qualifyCompletedSales(records,salesContext());const report=demoExample('pokemon').report,html=renderReports(report,e).upper;
 for(const value of ['USD 20.00','USD 30.00','USD 40.00','USD 50.00'])assert.ok(html.includes(value));assert.match(html,/Qualified historical samples/);assert.match(html,/Permitted supporting transactions/);assert.equal(report.financialDecision.allowed,false);assert.equal(e.automaticEconomicsAllowed,false);
});
test('save, copy and share still operate on protected original evidence, never presentation groups or manual inputs',()=>{
 const report=demoExample('sports').report;let saved,shared,copied='';const ui=unifiedReportInteraction({...report,rawValue:999,financialDecision:{allowed:true}},{navigator:{clipboard:{writeText:s=>{copied=s;}},share:v=>{shared=v;return Promise.resolve();}}});const tree=ui.render({onSave:r=>{saved=r;}});
 for(const name of ['Copy Summary','Save Report','Share'])ui.nodes(tree,n=>n.type==='button'&&n.props.children===name)[0].props.onClick();assert.equal(saved.rawValue,null);assert.equal(saved.financialDecision.allowed,false);assert.match(copied,/withheld/);assert.match(shared.text,/withheld/);assert.equal(saved.manualScenario,undefined);assert.equal(saved.imageAnalysis.conditionAssessments.corners.observations.length,report.imageAnalysis.conditionAssessments.corners.observations.length);assert.equal(protectedCopySummary(protectFinancialReport(saved)),protectedCopySummary(saved));
});
test('redesign stays in presentation and leaves owner gate, engines and normalized fixture inputs unchanged',()=>{
 const css=fs.readFileSync('src/components/ReportStyle.jsx','utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/:focus-visible/);assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);
 const page=fs.readFileSync('pages/demo-report.jsx','utf8');assert.match(page,/demoPageProps\(context\)/);assert.match(page,/<ResultCard/);assert.doesNotMatch(page,/fetch\(|\/api\/predict|localStorage/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {demoExample} from '../lib/demoReportServer.mjs';
import {renderReports,unifiedReportInteraction} from './helpers/renderReports.mjs';
import {FINANCIAL_FIELDS,protectedCopySummary} from '../lib/financialSafety.mjs';
const labels=['Most Likely Outcome','PSA 10 Odds','Expected Net','Decision Confidence','Potential Upside'];
const clean=s=>s.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
test('approved original nine-part hierarchy is restored in both real and demo report renderings',()=>{
 for(const example of ['pokemon','sports'])for(const demo of [false,true]){
  const data=demoExample(example).report,html=renderReports(data,null,{demo}).upper;
  const markers=['gp-original-header','gp-decision-panel','id="gp-report-0-listings"','aria-label="Decision explanation"','aria-label="Raw and PSA values"','aria-label="Grading economics"','aria-label="Best use case"','aria-label="Recommended action"','class="gp-u-actions"'];
  const positions=markers.map(x=>html.indexOf(x,html.indexOf('</style>')));assert.ok(positions.every(x=>x>=0));assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
  const metrics=html.match(/<dl class="gp-five-metrics"[\s\S]*?<\/dl>/)[0];assert.equal((metrics.match(/<dd>Unavailable<\/dd>/g)||[]).length,5);let previous=-1;for(const label of labels){const n=metrics.indexOf(label);assert.ok(n>previous);previous=n;}
  const tiles=html.match(/<section class="gp-three-values"[\s\S]*?<\/section>/)[0];assert.equal((tiles.match(/class="gp-value-tile"/g)||[]).length,3);assert.match(tiles,/Raw Value/);assert.match(tiles,/PSA 9 Value/);assert.match(tiles,/PSA 10/);
  assert.ok(html.indexOf('aria-label="Condition evidence"')>html.indexOf('class="gp-u-actions"'));
 }
});
test('forged scores, odds, profit, fees and submission advice never populate the original financial display',()=>{
 const original=demoExample('sports').report;
 const hostile={...original,gemPredictScore:99,psa10Probability:90,decisionConfidence:95,rawValue:750,psa9Value:900,psa10Value:1200,expectedNetValue:200,gradingUpside:300,psaFee:80,recommendation:'Submit now',financialDecision:{allowed:true}};
 const html=clean(renderReports(hostile).upper);assert.doesNotMatch(html,/99\/99|90%|95%|\$750|\$900|\$1200|\$200|\$300|-\$80|Submit now|Consider It|Grade It/);assert.match(html,/Not determined/);assert.match(html,/Evidence review only; not a grading or sale recommendation/);
 let saved;const ui=unifiedReportInteraction(hostile);const tree=ui.render({onSave:r=>{saved=r;}});ui.nodes(tree,n=>n.type==='button'&&n.props.children==='Save Report')[0].props.onClick();assert.equal(saved.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(saved[f],null);assert.match(protectedCopySummary(saved),/withheld/);
});
test('original visual proportions keep all five metrics and all three value tiles on one row on mobile',()=>{
 const css=fs.readFileSync('src/components/ReportStyle.jsx','utf8');assert.match(css,/gp-five-metrics\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);assert.match(css,/gp-three-values\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/border-radius:80px;background:#fff8e5/);assert.match(css,/background:#fffbee/);assert.match(css,/background:#f6f5f1/);assert.doesNotMatch(css,/--gp-bg:#101214/);
});
test('original appearance does not erase independent identity, original proposal, condition or listing rejection evidence',()=>{
 for(const id of ['pokemon','sports']){const data=demoExample(id).report,before=JSON.stringify(data),html=renderReports(data,null,{demo:true}).upper;assert.match(html,/printing not verified/);assert.match(html,/Original AI Observation — Unverified/);assert.match(html,/Detailed Condition Findings/);assert.match(html,/Image regions:/);assert.match(html,/Photo observations do not establish a PSA grade/);assert.equal(JSON.stringify(data),before);if(id==='pokemon')assert.match(html,/Cosmic Eclipse/);else{assert.match(html,/Unverified candidate · active listing/);assert.doesNotMatch(html,/href="https:\/\/www.ebay.com/);}}
});

test('restored static style text remains identical across server rendering and browser hydration',()=>{
 const html=renderReports(demoExample('sports').report).upper;const style=html.match(/<style>([\s\S]*?)<\/style>/)[1];assert.doesNotMatch(style,/&#(?:x27|39);|&quot;/);assert.match(html,/class="gp-why-marker"/);
});

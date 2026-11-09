import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarioCalculatorInteraction} from './helpers/renderReports.mjs';
import {calculateGradingScenario,syntheticScenarioExample} from '../lib/gradingScenarios.mjs';
import {feeEligibility,publishedFeeInput} from '../lib/gradingFeeReference.mjs';
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
async function driver(bindings){
 const ui=await scenarioCalculatorInteraction(bindings);let tree=ui.render();
 return {html:()=>ui.html(tree),nodes:p=>ui.nodes(tree,p),click(label){const n=ui.nodes(tree,n=>n.type==='button'&&text(n.props.children)===label)[0];assert.ok(n,label);assert.ok(!n.props.disabled,'button enabled: '+label);n.props.onClick();tree=ui.render();},set(label,value,checked){const n=ui.nodes(tree,n=>n.props?.['aria-label']===label)[0];assert.ok(n,label);n.props.onChange({target:{value,checked}});tree=ui.render();},value(label){return ui.nodes(tree,n=>n.props?.['aria-label']===label)[0]?.props.value;}};
}
test('guided navigation retains manual card inputs and keeps PSA as the only active provider',async()=>{
 const d=await driver();d.set('Card name or description (optional)','My manually described card');d.set('Estimated raw resale price','80');d.click('Continue to PSA Grading →');
 assert.ok(!/Beckett|BGS|CGC|SGC|TAG/.test(d.html()));d.set('PSA 9 hypothetical resale price','110');d.click('See Your Economics →');assert.ok(d.html().includes('My manually described card'));
 assert.ok(d.html().includes('Unavailable'));assert.ok(d.html().includes('Raw price and raw selling expenses'));assert.ok(d.html().includes('Submission fee per card'));
 d.click('Back');assert.equal(d.value('PSA 9 hypothetical resale price'),'110');d.click('Back');assert.equal(d.value('Estimated raw resale price'),'80');assert.equal(d.value('Original purchase price (optional)'),'');
});
test('all three synthetic PSA outcomes use existing engine math and emphasize incremental returns',async()=>{
 const d=await driver();d.click('Load synthetic example');d.click('Your Economics');
 const e=syntheticScenarioExample();for(const [grade,price] of [['8','100'],['9','140'],['10','250']]){
  const r=calculateGradingScenario(e.common,{...e.scenarios[0],grade,gradedSalePrice:price});
  const card=d.nodes(n=>n.type==='article'&&n.props['aria-label']===`PSA ${grade} scenario`)[0];const s=text(card);
  assert.ok(s.includes('PSA '+grade));assert.ok(s.includes('hypothetical')||s.includes('Hypothetical'));
  assert.ok(s.includes(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Math.abs(r.incrementalBenefitCents)/100)));
 }
 assert.ok(d.html().includes('$53.00 less than selling raw'));assert.ok(d.html().includes('$17.00 less than selling raw'));assert.ok(d.html().includes('$82.00 more than selling raw'));
 assert.ok(d.html().includes('Lifetime profit'));assert.ok(d.html().includes('$158.89'));
 assert.ok(d.html().includes('not a recommendation or a likely grade'));assert.ok(!d.html().includes('<table'));
});
test('optional purchase basis affects lifetime return only; missing raw expenses are never treated as zero',async()=>{
 const d=await driver();d.click('Load synthetic example');d.set('Original purchase price (optional)','');d.click('Your Economics');
 assert.ok(d.html().includes('$82.00 more than selling raw'));assert.ok(d.html().includes('Add your original purchase price'));
 d.click('Your Card');d.set('Raw fixed selling fee','');d.click('Your Economics');assert.ok(!d.html().includes('$82.00 more than selling raw'));assert.ok(d.html().includes('Raw price and raw selling expenses'));
});
test('lower grades are optional, individually priced and never create default estimates for missing outcomes',async()=>{
 const d=await driver();d.click('Load synthetic example');d.click('PSA Grading');assert.ok(d.html().includes('PSA 8 is not a floor'));
 d.set('Show lower grade scenarios',undefined,true);d.set('PSA 7 hypothetical resale price','60');d.click('Your Economics');assert.ok(d.html().includes('PSA 7'));
 const card=d.nodes(n=>n.type==='article'&&n.props['aria-label']==='PSA 7 scenario')[0];assert.ok(text(card).includes('$89.00 less than selling raw'));
 const missing=d.nodes(n=>n.type==='article'&&n.props['aria-label']==='PSA 1 scenario')[0];assert.ok(text(missing).includes('Unavailable'));assert.ok(text(missing).includes('hypothetical resale price'));
 d.click('PSA Grading');assert.ok(d.html().includes('Authentic-only, altered or ungradable results are not modeled'));
});
test('published PSA fees cannot bypass stale dates, caps or currency and conflicting resale assumptions stay qualified',async()=>{
 const future='2026-12-20';const d=await driver({feeEligibility:(t,c,cur)=>feeEligibility(t,c,cur,future),publishedFeeInput:(c,s)=>publishedFeeInput(c,s,future)});
 d.click('PSA Grading');d.set('PSA service tier','psa-standard');d.set('Submission category','sports');d.set('Cards in this service submission','1');d.set('Declared card value (USD assumption)','500');d.set('Submission requirements confirmed',undefined,true);
 assert.ok(d.html().includes('This reference needs a fresh review'));assert.equal(d.nodes(n=>n.type==='button'&&text(n.props.children)==='Use published grading fee')[0].props.disabled,true);
 const a=await driver();a.click('Load synthetic example');a.click('PSA Grading');a.set('PSA service tier','psa-value');a.set('PSA 10 hypothetical resale price','900');a.click('Your Economics');assert.ok(a.html().includes('exceeds this tier’s value cap'));
});
test('explicit zero action is opt-in and leaves submission fee, percentage fees and resale assumptions unknown',async()=>{
 const d=await driver();d.click('PSA Grading');assert.equal(d.value('Insurance — batch total'),'');d.click('Mark blank extra costs as zero');assert.equal(d.value('Insurance — batch total'),'0');assert.equal(d.value('Submission fee per card'),'');assert.equal(d.value('Graded selling fee (%)'),'');assert.equal(d.value('PSA 10 hypothetical resale price'),'');d.click('Your Economics');assert.ok(d.html().includes('Unavailable'));
});

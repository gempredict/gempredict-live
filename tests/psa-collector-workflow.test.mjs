import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarioCalculatorInteraction} from './helpers/renderReports.mjs';
import {calculateGradingScenario,syntheticScenarioExample} from '../lib/gradingScenarios.mjs';
import {feeEligibility,publishedFeeInput} from '../lib/gradingFeeReference.mjs';
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
async function driver(bindings){
 const ui=await scenarioCalculatorInteraction(bindings);let tree=ui.render();
 return {html:()=>ui.html(tree),nodes:p=>ui.nodes(tree,p),click(label){const n=ui.nodes(tree,n=>n.type==='button'&&text(n.props.children)===label)[0];assert.ok(n,label);assert.ok(!n.props.disabled,'button enabled: '+label);n.props.onClick();tree=ui.render();},set(label,value,checked){const n=ui.nodes(tree,n=>n.props?.['aria-label']===label)[0];assert.ok(n,label);n.props.onChange({target:{value,checked}});tree=ui.render();},toggle(label,open){const n=ui.nodes(tree,n=>n.type==='details'&&n.props['aria-label']===label)[0];assert.ok(n,label);n.props.onToggle({currentTarget:{open}});tree=ui.render();},value(label){return ui.nodes(tree,n=>n.props?.['aria-label']===label)[0]?.props.value;}};
}
test('guided navigation retains manual card inputs and keeps PSA as the only active provider',async()=>{
 const d=await driver();d.set('Card name or description (optional)','My manually described card');d.set('Estimated raw resale price','80');d.click('Continue to PSA Grading →');
 assert.ok(!/Beckett|BGS|CGC|SGC|TAG/.test(d.html()));d.set('PSA 9 hypothetical resale price','110');d.click('See Your Economics →');assert.ok(d.html().includes('My manually described card'));
 assert.ok(d.html().includes('Unavailable'));assert.ok(d.html().includes('Add your raw selling fees'));assert.ok(d.html().includes('Complete your PSA fee'));
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
 d.click('Your Card');d.set('Raw fixed selling fee','');d.click('Your Economics');assert.ok(!d.html().includes('$82.00 more than selling raw'));assert.ok(d.html().includes('Add your raw selling fees'));
});
test('lower grades are optional, individually priced and never create default estimates for missing outcomes',async()=>{
 const d=await driver();d.click('Load synthetic example');d.click('PSA Grading');assert.ok(d.html().includes('PSA 8 is not a floor'));
 d.set('Show lower grade scenarios',undefined,true);d.set('PSA 7 hypothetical resale price','60');d.click('Your Economics');assert.ok(d.html().includes('PSA 7'));
 const card=d.nodes(n=>n.type==='article'&&n.props['aria-label']==='PSA 7 scenario')[0];assert.ok(text(card).includes('$89.00 less than selling raw'));
 const missing=d.nodes(n=>n.type==='article'&&n.props['aria-label']==='PSA 1 scenario')[0];assert.ok(text(missing).includes('Incomplete'));assert.ok(text(missing).includes('Add your PSA 1 resale assumption'));
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

test('advanced controls and financial details start collapsed with no nested accordion controls',async()=>{
 const d=await driver();
 assert.equal(d.nodes(n=>n.type==='details'&&n.props['aria-label']==='Raw advanced costs and assumptions')[0].props.open,false);
 d.click('PSA Grading');assert.equal(d.nodes(n=>n.type==='details'&&n.props['aria-label']==='PSA advanced costs and assumptions')[0].props.open,false);
 d.click('Your Economics');assert.equal(d.nodes(n=>n.type==='details'&&n.props['aria-label']==='Financial details')[0].props.open,false);
 const cards=d.nodes(n=>n.type==='article');assert.equal(cards.length,3);for(const card of cards){assert.ok(!text(card).includes('ROI'));assert.ok(!text(card).includes('Net graded sale proceeds'));}
});
test('opening and closing advanced controls preserves edited expenses and explicit zeros across navigation',async()=>{
 const d=await driver();d.click('Load synthetic example');d.toggle('Raw advanced costs and assumptions',true);d.set('Raw selling fee (%)','8');d.set('Original purchase price (optional)','75');d.toggle('Raw advanced costs and assumptions',false);d.toggle('Raw advanced costs and assumptions',true);
 assert.equal(d.value('Raw selling fee (%)'),'8');assert.equal(d.value('Original purchase price (optional)'),'75');
 d.click('PSA Grading');d.toggle('PSA advanced costs and assumptions',true);d.set('Insurance — batch total','7');d.set('Graded fixed selling fee','0');d.toggle('PSA advanced costs and assumptions',false);d.click('Your Card');d.click('PSA Grading');d.toggle('PSA advanced costs and assumptions',true);
 assert.equal(d.value('Insurance — batch total'),'7');assert.equal(d.value('Graded fixed selling fee'),'0');assert.ok(d.html().includes('Synthetic example loaded'));
});
test('missing-net guidance opens the right advanced section without converting any blanks into zero',async()=>{
 const d=await driver();d.set('Estimated raw resale price','100');d.click('Your Economics');assert.ok(d.html().includes('Incomplete net comparison'));assert.ok(!d.html().includes('unsupported_provenance'));assert.ok(!d.html().includes('<ul>'));
 d.click('Edit raw costs & assumptions');assert.equal(d.nodes(n=>n.type==='details'&&n.props['aria-label']==='Raw advanced costs and assumptions')[0].props.open,true);assert.equal(d.value('Raw selling fee (%)'),'');
 d.click('Your Economics');d.click('Edit PSA costs & assumptions');assert.equal(d.nodes(n=>n.type==='details'&&n.props['aria-label']==='PSA advanced costs and assumptions')[0].props.open,true);assert.equal(d.value('Insurance — batch total'),'');assert.equal(d.value('Graded selling fee (%)'),'');
});
test('zero confirmations affect only blank named expenses; a complete hypothetical comparison still requires all cost groups',async()=>{
 const d=await driver();d.set('Estimated raw resale price','100');d.set('Raw fixed selling fee','3');d.click('Confirm blank raw selling expenses are zero');assert.equal(d.value('Raw fixed selling fee'),'3');assert.equal(d.value('Raw selling fee (%)'),'0');assert.equal(d.value('Original purchase price (optional)'),'');assert.ok(d.html().includes('Explicit zero assumption'));
 d.click('PSA Grading');d.set('Submission fee per card','20');for(const g of ['8','9','10'])d.set('PSA '+g+' hypothetical resale price','150');d.click('Mark blank extra costs as zero');d.click('Your Economics');assert.ok(d.html().includes('Incomplete net comparison'));assert.ok(d.html().includes('Add your graded selling fees'));
 d.click('Edit PSA costs & assumptions');d.click('Confirm blank graded selling expenses are zero');d.click('Your Economics');assert.ok(d.html().includes('Fully specified hypothetical net comparison'));assert.ok(d.html().includes('$33.00 more than selling raw'));assert.ok(d.html().includes('not verified profit'));
});

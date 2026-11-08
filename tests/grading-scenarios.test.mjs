// Explicitly synthetic arithmetic. No current provider fees/prices/policies.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GRADING_PROVIDERS,calculateGradingScenario,allocateBatchCents,syntheticScenarioExample,MAX_CENTS} from '../lib/gradingScenarios.mjs';
import {protectFinancialReport,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
const example=()=>syntheticScenarioExample();
const calc=(c={},s={},costs={})=>{const e=example();return calculateGradingScenario({...e.common,...c},{...e.scenarios[0],...s,costs:{...e.scenarios[0].costs,...costs}});};
test('all five provider scenarios use independently hand-calculated example with no implied provider schedule',()=>{
 const e=example();assert.deepEqual(e.scenarios.map(s=>s.provider),['PSA','BGS','CGC','SGC','TAG']);
 for(const s of e.scenarios){const r=calculateGradingScenario(e.common,s);assert.equal(r.status,'calculated');assert.equal(r.gradingInvestmentCents,3500);assert.equal(r.upfrontInvestmentCents,13500);assert.equal(r.totalInvestmentCents,16500);assert.equal(r.sellingPercentageFeeCents,2500);assert.equal(r.netSaleProceedsCents,22000);assert.equal(r.profitCents,8500);assert.equal(r.rawAlternativeNetCents,10300);assert.equal(r.incrementalBenefitCents,8200);assert.equal(r.breakEvenSalePriceCents,15556);assert.equal(r.incrementalBreakEvenSalePriceCents,15889);assert.ok(Math.abs(r.roiPercent-100*85/165)<1e-10);assert.equal(r.expectedValue,null);assert.equal(r.recommendation,null);assert.equal(r.verifiedMarketValue,false);assert.ok(Object.values(r.inputs).every(v=>v.basis==='assumed'));}
});
test('shipping allocations sum to each batch total without gaining or losing cents',()=>{
 for(const count of [1,2,3,7,100])for(const total of [0,1,2,101,1000,10001])assert.equal(Array.from({length:count},(_,i)=>allocateBatchCents(total,count,i+1)).reduce((a,b)=>a+b,0),total);
 assert.deepEqual([1,2,3].map(i=>allocateBatchCents(1000,3,i)),[334,333,333]);assert.throws(()=>allocateBatchCents(10,0,1));assert.throws(()=>allocateBatchCents(10,2,3));
 const a=calc({}, {batchCount:'3',cardIndex:'1'},{outboundShipping:'10'}),b=calc({}, {batchCount:'3',cardIndex:'3'},{outboundShipping:'10'});assert.equal(a.allocationCents.outboundShipping,334);assert.equal(b.allocationCents.outboundShipping,333);
});
test('negative outcomes, percentage plus fixed fees, and zero investment have defined results',()=>{
 const r=calc({}, {gradedSalePrice:'50'});assert.equal(r.netSaleProceedsCents,4000);assert.equal(r.profitCents,-9500);assert.equal(r.incrementalBenefitCents,-9800);assert.ok(r.roiPercent<0);
 const free=calc({acquisitionCost:'0'},{gradedSalePrice:'0'},{gradingFee:'0',declaredValueSurcharge:'0',outboundShipping:'0',returnShipping:'0',insurance:'0',handling:'0',sellingFixedFee:'0',otherSellingExpenses:'0',sellingPercent:'0'});assert.equal(free.totalInvestmentCents,0);assert.equal(free.profitCents,0);assert.equal(free.roiPercent,null);assert.equal(free.roiUnavailableReason,'zero_investment');assert.equal(free.breakEvenSalePriceCents,0);
});
test('acquisition basis changes lifetime return, not grading benefit versus today’s raw sale',()=>{
 const a=calc({acquisitionCost:'1'}),b=calc({acquisitionCost:'500'});assert.equal(a.incrementalBenefitCents,b.incrementalBenefitCents);assert.equal(a.incrementalBreakEvenSalePriceCents,b.incrementalBreakEvenSalePriceCents);assert.notEqual(a.profitCents,b.profitCents);assert.notEqual(a.breakEvenSalePriceCents,b.breakEvenSalePriceCents);
 const unknown=calc({acquisitionCost:''});assert.equal(unknown.profitCents,null);assert.equal(unknown.totalInvestmentCents,null);assert.equal(unknown.incrementalBenefitCents,8200);
});
test('missing inputs do not default to zero; available ledgers still calculate independently',()=>{
 const r=calc({}, {}, {insurance:''});assert.equal(r.gradingInvestmentCents,null);assert.equal(r.profitCents,null);assert.equal(r.netSaleProceedsCents,22000);assert.equal(r.status,'incomplete');assert.ok(r.issues.some(i=>i.field==='insurance'));
 const noPrice=calc({}, {gradedSalePrice:''});assert.equal(noPrice.profitCents,null);assert.equal(noPrice.breakEvenSalePriceCents,15556);
 const raw=calc({rawSalePrice:''});assert.equal(raw.incrementalBenefitCents,null);assert.equal(raw.profitCents,8500);
});
test('fees of 100 percent cannot imply a finite profitable break-even; invalid fees/costs reject',()=>{
 const r=calc({}, {}, {sellingPercent:'100'});assert.equal(r.breakEvenSalePriceCents,null);assert.equal(r.breakEvenUnavailableReason,'selling_fee_retains_no_proceeds');assert.equal(r.netSaleProceedsCents,-500);
 for(const v of ['-1','100.01','NaN','Infinity','1e3','10.001'])assert.ok(calc({}, {}, {sellingPercent:v}).issues.some(i=>i.field==='sellingPercent'));
 for(const v of ['-0.01','NaN','1.001',String(MAX_CENTS),' '])assert.equal(calc({}, {}, {gradingFee:v}).gradingInvestmentCents,null);
 assert.equal(calc({}, {batchCount:'0'}).gradingInvestmentCents,null);assert.equal(calc({}, {batchCount:'1.5'}).gradingInvestmentCents,null);
});
test('break-even is the first nonnegative-profit cent under exact rounded variable/fixed fees',()=>{
 for(const pct of ['0','2.9','12.35','99.99']){
  const r=calc({}, {}, {sellingPercent:pct});const at=calc({}, {gradedSalePrice:(r.breakEvenSalePriceCents/100).toFixed(2)},{sellingPercent:pct});assert.ok(at.profitCents>=0);if(r.breakEvenSalePriceCents>0)assert.ok(calc({}, {gradedSalePrice:((r.breakEvenSalePriceCents-1)/100).toFixed(2)},{sellingPercent:pct}).profitCents<0);
 }
 const half=calc({}, {gradedSalePrice:'0.05'},{sellingPercent:'10'});assert.equal(half.sellingPercentageFeeCents,1);
});
test('manual provenance and currencies are explicit; client claims cannot create verified schedules or expected values',()=>{
 const bad=calc({}, {}, {gradingFee:{value:'25',basis:'verified_schedule',date:'2026-11-08',source:'claimed'}});assert.equal(bad.gradingInvestmentCents,null);assert.ok(bad.issues.some(i=>i.reason==='unsupported_provenance'));
 assert.equal(calc({currency:'JPY'}).profitCents,null);assert.equal(calc({}, {provider:'OTHER'}).profitCents,null);
 const r=calc({}, {probability:1,grade:'10',identityConfidence:99});assert.equal(r.expectedValue,null);assert.equal(r.verifiedMarketValue,false);assert.equal(r.recommendation,null);assert.equal(calc({}, {turnaroundDays:'-1'}).turnaroundDays,null);
});
test('scenario calculations are immutable and cannot authorize protected reports or change identity/condition data',()=>{
 const e=example(),before=structuredClone(e);const r=calculateGradingScenario(e.common,e.scenarios[0]);assert.deepEqual(e,before);
 const identity={subject:'Synthetic card',cardNumber:'PA-JD'},condition={visualObservations:[],inspectedSides:['front']};const safe=protectFinancialReport({canonicalCard:identity,identityV2:{category:'sports'},imageAnalysis:condition,manualScenario:r,financialDecision:{allowed:true},rawValue:999});assert.deepEqual(safe.canonicalCard,identity);assert.equal(safe.financialDecision.allowed,false);for(const k of FINANCIAL_FIELDS)assert.equal(safe[k],null);assert.equal(safe.imageAnalysis.worthGrading,null);assert.equal(r.kind,'manual_hypothetical_grading_scenario');
});

test('actual calculator renders blank scenarios, loads explicit synthetic example and recalculates editable inputs',async()=>{
 const {scenarioCalculatorInteraction}=await import('./helpers/renderReports.mjs');
 const ui=await scenarioCalculatorInteraction();let tree=ui.render();
 assert.match(ui.html(tree),/Scenario Calculator/);assert.match(ui.html(tree),/Unavailable/);
 assert.equal(ui.nodes(tree,n=>n.type==='input'&&n.props.value==='250').length,0);
 ui.nodes(tree,n=>n.type==='button'&&n.props.children==='Load synthetic arithmetic example')[0].props.onClick();
 tree=ui.render();let html=ui.html(tree);
 for(const label of ['Synthetic example loaded','$85.00','$155.56','$158.89','51.52%','Beckett/BGS'])assert.ok(html.includes(label),label);
 const price=ui.nodes(tree,n=>n.type==='input'&&n.props.value==='250')[0];price.props.onChange({target:{value:'50'}});
 tree=ui.render();assert.ok(ui.html(tree).includes('-$95.00'));
 ui.nodes(tree,n=>n.type==='input'&&n.props.value==='50')[0].props.onChange({target:{value:''}});
 html=ui.html(ui.render());assert.ok(html.includes('Unavailable'));assert.ok(html.includes('User-supplied — not verified'));
});

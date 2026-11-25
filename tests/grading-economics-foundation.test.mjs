import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateGradingEconomics,datedGradingService,gradingEconomicsReadiness,gradingGradeKey} from '../lib/gradingEconomics.mjs';
import {evaluateComparableSales,freeResearchSale} from '../lib/comparableSalesEvidence.mjs';
import {FEE_REFERENCE} from '../lib/gradingFeeReference.mjs';

// All amounts, outcomes, probabilities and tier labels in this scenario are synthetic.
const grade=(scale,number,label='standard')=>({scale,number,label});
const price=amountMinor=>({amountMinor,currency:'USD',provenance:'hypothetical_manual'});
const seller={currency:'USD',feeBasis:'gross_sale',rateBps:1000,fixedMinor:100,shippingMinor:300,otherMinor:100};
function example(){
 return {mode:'hypothetical_manual',provider:'PSA',currency:'USD',acquisitionMinor:6000,declaredValueMinor:12000,
  service:{version:1,provider:'PSA',currency:'USD',tier:'Synthetic service tier',verificationStatus:'hypothetical_manual',
   feeMinor:2500,shippingOutMinor:300,shippingBackMinor:500,insuranceMinor:100,additionalFeesMinor:100,
   declaredValueLimitMinor:20000,turnaroundDays:[20,40]},
  raw:{price:price(12000),seller},gradedSeller:seller,probabilitySource:'hypothetical_manual',
  outcomes:[
   {kind:'sold',grade:grade('psa_numeric',10),price:price(25000),upchargeMinor:1500,eventExpenseMinor:0,probabilityBps:2500},
   {kind:'sold',grade:grade('psa_numeric',9),price:price(10000),upchargeMinor:0,eventExpenseMinor:0,probabilityBps:5000},
   {kind:'returned',upchargeMinor:0,eventExpenseMinor:400,probabilityBps:1000},
   {kind:'unsold',upchargeMinor:0,eventExpenseMinor:200,probabilityBps:1000},
   {kind:'grading_failed',upchargeMinor:0,eventExpenseMinor:0,probabilityBps:500},
  ],sensitivity:[{label:'Synthetic price and cost stress',haircutBps:1000,extraCostMinor:500}]};
}
test('explicit grading scales and distinct top labels do not imply equivalence',()=>{
 for(const [provider,scale,number,label] of [
  ['PSA','psa_numeric',8.5,'standard'],['BGS','bgs_numeric_label',9.5,'standard'],
  ['BGS','bgs_numeric_label',10,'black_label'],['CGC','cgc_current_card_label',10,'pristine'],
  ['SGC','sgc_current_card_label',10,'gem_mint'],['TAG','tag_card_grade',10,'standard'],
 ]){
  const input=example();
  input.provider=input.service.provider=provider;
  delete input.probabilitySource;
  input.outcomes=[{kind:'sold',grade:grade(scale,number,label),price:price(20000),upchargeMinor:0,eventExpenseMinor:0}];
  const result=calculateGradingEconomics(input);
  assert.equal(result.status,'calculated');
  assert.equal(result.analysis.expectedNetResaleMinor,null);
  assert.ok(result.analysis.rows[0].gradeKey.startsWith(provider+':'));
 }
 assert.equal(gradingGradeKey('PSA',grade('psa_numeric',9.5)),null);
 assert.equal(gradingGradeKey('PSA',grade('tag_card_grade',10)),null);
 assert.equal(gradingGradeKey('TAG',grade('tag_card_grade',990)),null);
 for(const [provider,scale,ordinary,distinct] of [
  ['BGS','bgs_numeric_label','pristine','black_label'],
  ['CGC','cgc_current_card_label','gem_mint','pristine'],
  ['SGC','sgc_current_card_label','gem_mint','pristine'],
 ])assert.notEqual(gradingGradeKey(provider,grade(scale,10,ordinary)),gradingGradeKey(provider,grade(scale,10,distinct)));
});
test('grading and seller ledgers, break-even, downside and probability-weighted results use explicit costs',()=>{
 const {analysis:a}=calculateGradingEconomics(example());
 assert.equal(a.baseGradingCostMinor,3500);
 assert.equal(a.rawSale.netMinor,10300);
 const [top,next,returned]=a.rows;
 assert.equal(top.gradingCostMinor,5000);
 assert.deepEqual(top.sale,{grossMinor:25000,percentMinor:2500,expensesMinor:3000,netMinor:22000});
 assert.equal(top.incrementalCashMinor,6700);
 assert.equal(top.accountingProfitMinor,11000);
 assert.equal(top.incrementalBreakEvenMinor,17556);
 assert.equal(next.incrementalCashMinor,-5300);
 assert.equal(returned.incrementalCashMinor,-14200);
 assert.equal(returned.accountingProfitMinor,null);
 assert.equal(a.lowestIncrementalCashMinor,-14200);
 assert.equal(a.expectedIncrementalCashMinor,-4485);
 assert.equal(a.expectedAccountingProfitMinor,null);
 assert.equal(a.downsideProbabilityBps,7500);
 assert.ok(a.sensitivity[0].expectedIncrementalCashMinor<a.expectedIncrementalCashMinor);
});
test('probability, currency, grade, declared value and fee contradictions fail closed',()=>{
 for(const change of [
  x=>x.outcomes[0].probabilityBps--, x=>delete x.outcomes[0].probabilityBps,
  x=>x.probabilitySource='ai_photo_score', x=>delete x.outcomes[0].grade.scale,
  x=>x.outcomes[1].grade.number=9.5,x=>x.raw.price.currency='EUR',
  x=>x.gradedSeller.rateBps=10001,x=>x.gradedSeller.feeBasis='gross_with_tax',
  x=>x.declaredValueMinor=20001,x=>x.service.feeMinor=-1,
  x=>x.outcomes[0].price.provenance='provider_reported_unverified',
  x=>x.outcomes[2].price=price(100),x=>x.service.turnaroundDays=[40,20],
 ]){
  const input=example();
  change(input);
  const result=calculateGradingEconomics(input);
  assert.equal(result.status,'invalid');
  assert.equal(result.analysis,null);
 }
 const live=calculateGradingEconomics({...example(),mode:'live'});
 assert.equal(live.status,'withheld');
 assert.equal(live.analysis,null);
});
test('dated fee references preserve source, effective date and eligibility without checkout claims',()=>{
 const tier=FEE_REFERENCE.tiers.find(row=>row.provider==='PSA'&&row.availability==='listed');
 const context={category:'sports',submissionCount:1,declaredValue:tier.maxDeclaredValue+1,requirementsConfirmed:true};
 const service=datedGradingService(tier.id,context,'USD','2026-11-25');
 assert.equal(service.effectiveDate,tier.effectiveDate);
 assert.ok(service.sources.length);
 assert.ok(service.eligibility.reasons.includes('declared_value_above_tier'));
 assert.equal(service.checkoutVerified,false);
 assert.equal(service.upchargeMinor,null);
 assert.equal(datedGradingService(tier.id,context,'USD','2027-02-01').freshness,'outdated');
});
test('legacy identity and Free research records cannot authorize live economics',()=>{
 const now='2026-11-24T12:00:00Z';
 const sales=['best_offer','fixed_price'].map((listingType,i)=>freeResearchSale({
  id:'synthetic-'+i,platform:'ebay',listingType,amountReportedConfirmed:i===1,price:120,currency:'USD',sold:'2026-11-21',
 },now));
 const comparables=evaluateComparableSales(sales,{scope:'free_research',now});
 assert.equal(comparables.rows[0].finalAmountStatus,'unknown');
 assert.equal(comparables.rows[1].settlementStatus,'unverified');
 for(const evidence of [comparables,structuredClone(comparables),{qualified:true,commercialRights:true}]){
  const result=gradingEconomicsReadiness({comparables:evidence});
  assert.equal(result.status,'withheld');
  for(const reason of ['exact_catalog_identity_unresolved','independent_physical_printing_unverified',
   'commercial_rights_unverified','insufficient_independently_qualified_sales','verified_applicable_fee_schedule_required'])
   assert.ok(result.blockers.includes(reason));
 }
});

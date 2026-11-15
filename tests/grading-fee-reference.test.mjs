import test from 'node:test';
import assert from 'node:assert/strict';
import {FEE_REFERENCE,feeTier,feeEligibility,publishedFeeInput,feeComparison} from '../lib/gradingFeeReference.mjs';
import {calculateGradingScenario,syntheticScenarioExample} from '../lib/gradingScenarios.mjs';
import {scenarioCalculatorInteraction} from './helpers/renderReports.mjs';
const now=new Date('2026-11-09T00:00:00Z');
const context={category:'pokemon',declaredValue:'400',submissionCount:'25',member:true,requirementsConfirmed:true};
const selection=(id='cgc-bulk')=>{const tier=feeTier(id);return {provider:tier.provider,feeReferenceId:id,feeEligibility:{...context},costs:{}};};
test('reviewed reference covers every provider with dated auditable sources and explicit unknowns',()=>{
 assert.equal(FEE_REFERENCE.tiers.length,39);assert.equal(new Set(FEE_REFERENCE.tiers.map(t=>t.id)).size,39);
 for(const provider of ['PSA','BGS','CGC','SGC','TAG'])assert.ok(FEE_REFERENCE.tiers.some(t=>t.provider===provider));
 for(const t of FEE_REFERENCE.tiers){assert.equal(t.currency,'USD');assert.equal(t.checkedOn,'2026-11-08');assert.ok(t.sourceIds.every(id=>new URL(FEE_REFERENCE.sources[id].url).protocol==='https:'));}
 assert.equal(feeTier('tag-value').submissionFee,null);assert.equal(feeTier('psa-premium-10').submissionFee,null);assert.equal(feeTier('cgc-unlimited').submissionFee,null);
 assert.equal(feeTier('psa-value').effectiveDate,'2026-10-29');assert.equal(feeTier('tag-standard').includedCoverage,1000);assert.equal(feeTier('tag-standard').maxDeclaredValue,null);
});
test('minimum submission, account, category, declared value and manual eligibility acknowledgement are enforced',()=>{
 const tier=feeTier('cgc-bulk');assert.equal(feeEligibility(tier,context,'USD',now).allowed,true);
 for(const [k,v,reason] of [['submissionCount','24','minimum_cards_not_met'],['member',false,'membership_or_account_required'],['category','magic','category_required_or_ineligible'],['declaredValue','501','declared_value_above_tier'],['declaredValue','','declared_value_required'],['requirementsConfirmed',false,'physical_and_submission_requirements_not_confirmed']])assert.ok(feeEligibility(tier,{...context,[k]:v},'USD',now).reasons.includes(reason));
 assert.equal(feeEligibility(tier,context,'EUR',now).allowed,false);assert.equal(feeEligibility(feeTier('bgs-express'),context,'USD',now).allowed,true);
});
test('paused, sold-out, indexed-only, variable, special-format and unknown services never auto-populate',()=>{
 for(const id of ['psa-value-bulk','bgs-standard','sgc-standard-1500','tag-value','cgc-unlimited','cgc-jumbo','cgc-coin'])assert.equal(publishedFeeInput({currency:'USD'},selection(id),now),null,id);
 assert.equal(feeEligibility(null,context,'USD',now).allowed,false);
});
test('outdated and future-dated reviews are blocked without fetching or silently changing the reference',()=>{
 const tier=feeTier('cgc-bulk');assert.equal(feeEligibility(tier,context,'USD','2026-12-09').freshness,'outdated');
 assert.equal(feeEligibility(tier,context,'USD','2026-11-01').freshness,'date_invalid');
 const s=selection();assert.equal(publishedFeeInput({currency:'USD'},s,'2026-12-09'),null);
});
test('published fee is bound to provider, tier, eligibility, revision and amount; override is user-supplied',()=>{
 const e=syntheticScenarioExample(),s={...e.scenarios[2],...selection(),costs:{...e.scenarios[2].costs}};
 s.costs.gradingFee=publishedFeeInput(e.common,s,now);const r=calculateGradingScenario(e.common,s,now);
 assert.equal(r.inputs.gradingFee.basis,'published_reference');assert.equal(r.gradingInvestmentCents,2700);assert.equal(r.profitCents,9300);assert.equal(r.feeReference.overridden,false);
 for(const patch of [{value:'1'},{revision:'invented'},{referenceId:'psa-standard'}]){const forged=calculateGradingScenario(e.common,{...s,costs:{...s.costs,gradingFee:{...s.costs.gradingFee,...patch}}},now);assert.equal(forged.gradingInvestmentCents,null);}
 assert.equal(publishedFeeInput(e.common,{...s,provider:'PSA'},now),null);
 const stale=calculateGradingScenario(e.common,s,'2026-12-09');assert.equal(stale.gradingInvestmentCents,null);assert.equal(stale.feeReference.eligibility.freshness,'outdated');
 const override=calculateGradingScenario(e.common,{...s,costs:{...s.costs,gradingFee:{value:'18',basis:'user_supplied'}}},now);assert.equal(override.inputs.gradingFee.basis,'user_supplied');assert.equal(override.feeReference.differs,true);assert.equal(override.gradingInvestmentCents,2800);
 assert.equal(calculateGradingScenario(e.common,{...s,costs:{gradingFee:s.costs.gradingFee}},now).gradingInvestmentCents,null);
 assert.equal(r.recommendation,null);assert.equal(r.expectedValue,null);assert.equal(r.verifiedMarketValue,false);
});
test('actual PSA workflow preserves published fee eligibility, fee provenance and manual overrides',async()=>{
 const ui=await scenarioCalculatorInteraction();let tree=ui.render();
 ui.nodes(tree,n=>n.type==='button'&&n.props.children?.includes?.('Continue to PSA Grading'))[0].props.onClick();tree=ui.render();
 const input=(name,value,checked)=>{ui.nodes(tree,n=>n.props?.['aria-label']===name)[0].props.onChange({target:{value,checked}});tree=ui.render();};
 input('PSA service tier','psa-standard');assert.ok(ui.html(tree).includes('Review and confirm submission requirements'));
 input('Submission category','pokemon');input('Cards in this service submission','1');input('Declared card value (USD assumption)','1001');input('Submission requirements confirmed',undefined,true);
 let apply=ui.nodes(tree,n=>n.type==='button'&&n.props.children==='Use published grading fee')[0];assert.equal(apply.props.disabled,true);
 input('Declared card value (USD assumption)','400');apply=ui.nodes(tree,n=>n.type==='button'&&n.props.children==='Use published grading fee')[0];assert.equal(apply.props.disabled,false);apply.props.onClick();tree=ui.render();
 assert.ok(ui.html(tree).includes('Published fee reference'));assert.equal(ui.nodes(tree,n=>n.props?.['aria-label']==='Submission fee per card')[0].props.value,'59.99');
 assert.equal(ui.nodes(tree,n=>n.props?.['aria-label']==='Insurance — batch total')[0].props.value,'');
 input('Submission fee per card','19');assert.ok(ui.html(tree).includes('differs from the published reference'));
 input('PSA service tier','psa-value-bulk');assert.ok(ui.html(tree).includes('paused when checked'));
});

test('an unpublished fee cannot be labeled a numeric mismatch; immutable reference cannot be edited in place',()=>{
 const s={...selection('tag-value'),costs:{gradingFee:{value:'19',basis:'user_supplied'}}};
 assert.equal(feeComparison({currency:'USD'},s,now).differs,false);
 assert.throws(()=>{FEE_REFERENCE.tiers[0].submissionFee='0';},TypeError);
});

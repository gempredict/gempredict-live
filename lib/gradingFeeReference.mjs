// Reviewed static public schedule. No network, report identity or provider calls.
import reference from '../data/grading/fees-2026-11-08.json' with {type:'json'};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const FEE_REFERENCE=freeze(reference);
export function feeTier(id){return reference.tiers.find(t=>t.id===id)||null;}
export function feeEligibility(tier,context={},currency='USD',now=new Date()){
 const reasons=[];
 if(!tier)return {allowed:false,reasons:['tier_unknown'],freshness:'unknown'};
 const stamp=Date.parse(tier.checkedOn+'T00:00:00Z'),clock=new Date(now).getTime();
 const age=(clock-stamp)/86400000;
 const freshness=!Number.isFinite(age)||age<0?'date_invalid':age>reference.reviewAfterDays?'outdated':'dated_reference';
 if(freshness!=='dated_reference')reasons.push(freshness);
 if(tier.verificationStatus!=='reviewed_public_source')reasons.push('live_schedule_unverified');
 if(!['listed'].includes(tier.availability))reasons.push('service_'+tier.availability);
 if(tier.submissionFee===null)reasons.push('fee_unknown_or_variable');
 if(currency!==tier.currency)reasons.push('currency_mismatch_no_conversion');
 if(tier.serviceType!=='raw_card_grading')reasons.push('service_outside_raw_card_scope');
 if(!tier.categories.includes(context.category))reasons.push('category_required_or_ineligible');
 const count=String(context.submissionCount??'');
 if(!/^[1-9]\d{0,4}$/.test(count))reasons.push('submission_quantity_required');
 else if(tier.minimumCards&&Number(count)<tier.minimumCards)reasons.push('minimum_cards_not_met');
 if(['collectors_club','collector_account'].includes(tier.membership)&&context.member!==true)reasons.push('membership_or_account_required');
 if(tier.maxDeclaredValue!==null){
  const v=String(context.declaredValue??'');
  if(!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(v))reasons.push('declared_value_required');
  else if(Number(v)>tier.maxDeclaredValue)reasons.push('declared_value_above_tier');
 }
 // User attests only to submission requirements; never verifies the card/report.
 if(context.requirementsConfirmed!==true)reasons.push('physical_and_submission_requirements_not_confirmed');
 return {allowed:reasons.length===0,reasons,freshness};
}
export function publishedFeeInput(common,scenario,now=new Date()){
 const tier=feeTier(scenario.feeReferenceId),eligibility=feeEligibility(tier,scenario.feeEligibility,common.currency,now);
 if(!tier||tier.provider!==scenario.provider||!eligibility.allowed)return null;
 return {value:tier.submissionFee,basis:'published_reference',referenceId:tier.id,revision:reference.revision,checkedOn:tier.checkedOn};
}
export function feeComparison(common,scenario,now=new Date()){
 const tier=feeTier(scenario.feeReferenceId);
 if(!tier)return null;
 const input=scenario.costs?.gradingFee;
 const amount=input&&typeof input==='object'?input.value:input;
 return {tier,eligibility:feeEligibility(tier,scenario.feeEligibility,common.currency,now),overridden:input?.basis!=='published_reference',differs:tier.submissionFee!==null&&amount!==''&&amount!=null&&Number(amount)!==Number(tier.submissionFee)};
}

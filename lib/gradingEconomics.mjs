import { GRADING_PROVIDERS,SCENARIO_CURRENCIES,MAX_CENTS,breakEven,roundSellingFee } from './gradingScenarios.mjs';
import { FEE_REFERENCE,feeTier,feeEligibility } from './gradingFeeReference.mjs';
import { comparableReadinessReceipt } from './comparableSalesEvidence.mjs';

export const GRADING_ECONOMICS_VERSION=1;
const money=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX_CENTS;
const bps=value=>Number.isInteger(value)&&value>=0&&value<=10000;
const text=value=>typeof value==='string'&&value.trim()&&value.length<=100;
const costs=['shippingOutMinor','shippingBackMinor','insuranceMinor','additionalFeesMinor'];
const outcomesAllowed=['sold','unsold','returned','grading_failed'];
const reasonsForScale={
 PSA:'psa_numeric',BGS:'bgs_numeric_label',CGC:'cgc_current_card_label',SGC:'sgc_current_card_label',TAG:'tag_card_grade',
};

// Slab labels are intentionally separate within a company. Unsupported labels,
// qualifiers, old scales and TAG's separate precision score are never converted.
export function gradingGradeKey(provider,grade) {
 if(!GRADING_PROVIDERS.includes(provider)||!grade||grade.scale!==reasonsForScale[provider]||
    typeof grade.number!=='number'||!Number.isInteger(grade.number*2)||grade.number<1||grade.number>10)return null;
 const {number,label}=grade;
 if(provider==='PSA'&&number===9.5||provider==='TAG'&&!Number.isInteger(number))return null;
 const topLabels={BGS:['pristine','black_label'],CGC:['gem_mint','pristine'],SGC:['gem_mint','pristine']};
 const labels=number===10&&topLabels[provider]?topLabels[provider]:['standard'];
 return labels.includes(label)?[provider,grade.scale,number,label].join(':'):null;
}

export function datedGradingService(referenceId,eligibility,currency,asOf) {
 const tier=feeTier(referenceId);
 if(!tier)return null;
 if(typeof asOf!=='string'||!Number.isFinite(Date.parse(asOf)))return null;
 const result=feeEligibility(tier,eligibility,currency,asOf);
 return {version:1,provider:tier.provider,tier:referenceId,currency:tier.currency,
  publishedFeeMinor:tier.submissionFee===null?null:Math.round(tier.submissionFee*100),
  declaredValueLimitMinor:tier.maxDeclaredValue===null?null:Math.round(tier.maxDeclaredValue*100),
  turnaroundBusinessDays:tier.turnaroundBusinessDays,sources:tier.sourceIds.map(id=>FEE_REFERENCE.sources[id]?.url).filter(Boolean),
  effectiveDate:tier.effectiveDate,checkedOn:tier.checkedOn,revision:FEE_REFERENCE.revision,
  verificationStatus:tier.verificationStatus,freshness:result.freshness,eligibility:result,
  shippingOutMinor:null,shippingBackMinor:null,insuranceMinor:null,additionalFeesMinor:null,upchargeMinor:null,
  checkoutVerified:false};
}

export function gradingEconomicsReadiness({identityEvidence,comparables,service}={}) {
 const receipt=comparableReadinessReceipt(comparables);
 const blockers=[];
 if(identityEvidence?.version!==1||identityEvidence.status!=='catalog_supported'||
    identityEvidence.catalogPrinting?.status!=='catalog_record_consistent'||identityEvidence.catalogAmbiguity)
  blockers.push('exact_catalog_identity_unresolved');
 if(!receipt?.physicalVerified)blockers.push('independent_physical_printing_unverified');
 if(!receipt?.qualified||!receipt.compatibleSamples)blockers.push('insufficient_independently_qualified_sales');
 if(!receipt?.commercialRights)blockers.push('commercial_rights_unverified');
 blockers.push('verified_applicable_fee_schedule_required','validated_grade_probability_source_required','live_economics_disabled');
 return {version:GRADING_ECONOMICS_VERSION,status:'withheld',blockers,datedFeeReferenceAvailable:service?.freshness==='dated_reference'&&service?.eligibility?.allowed===true,automaticEconomicsAllowed:false};
}

const validSeller=(seller,currency)=>seller?.currency===currency&&bps(seller.rateBps)&&
 ['fixedMinor','shippingMinor','otherMinor'].every(field=>money(seller[field]))&&seller.feeBasis==='gross_sale';
function net(gross,seller) {
 const percentMinor=roundSellingFee(gross,seller.rateBps);
 const expensesMinor=percentMinor+seller.fixedMinor+seller.shippingMinor+seller.otherMinor;
 return {grossMinor:gross,percentMinor,expensesMinor,netMinor:gross-expensesMinor};
}
const manualPrice=(price,currency)=>price?.currency===currency&&price.provenance==='hypothetical_manual'&&money(price.amountMinor);

export function calculateGradingEconomics(input={}) {
 const {mode,provider,currency,service,raw,gradedSeller,acquisitionMinor,declaredValueMinor,outcomes,sensitivity=[],probabilitySource}=input||{};
 const problems=[];
 const fail=code=>problems.push(code);
 const gated={version:GRADING_ECONOMICS_VERSION,mode:'hypothetical_manual',verifiedMarketValue:false,
  automaticEconomicsAllowed:false,recommendation:null};
 if(mode!=='hypothetical_manual') return {...gated,mode:'withheld',status:'withheld',issues:['live_economics_disabled'],analysis:null};
 if(!GRADING_PROVIDERS.includes(provider)||!SCENARIO_CURRENCIES.includes(currency))fail('unsupported_provider_or_currency');
 if(service?.version!==1||service.provider!==provider||service.currency!==currency||!text(service.tier)||
    service.verificationStatus!=='hypothetical_manual'||!money(service.feeMinor)||!costs.every(key=>money(service[key]))||
    !(service.declaredValueLimitMinor===null||money(service.declaredValueLimitMinor)))fail('invalid_manual_service');
 if(!money(declaredValueMinor)||service?.declaredValueLimitMinor!=null&&declaredValueMinor>service.declaredValueLimitMinor)fail('declared_value_above_tier_or_invalid');
 const turnaround=service?.turnaroundDays;
 if(turnaround!=null&&(!Array.isArray(turnaround)||turnaround.length!==2||
    !turnaround.every(day=>Number.isInteger(day)&&day>=0&&day<=3650)||turnaround[0]>turnaround[1]))fail('invalid_turnaround_range');
 if(!money(acquisitionMinor))fail('invalid_acquisition_cost');
 if(!manualPrice(raw?.price,currency)||!validSeller(raw?.seller,currency))fail('invalid_raw_sale_assumption');
 if(!validSeller(gradedSeller,currency))fail('invalid_graded_seller_costs');
 if(!Array.isArray(sensitivity)||sensitivity.length>8||sensitivity.some(row=>!row||!text(row.label)||!bps(row.haircutBps)||!money(row.extraCostMinor)))
  fail('invalid_sensitivity');
 let weighted=false;
 if(!Array.isArray(outcomes)||!outcomes.length||outcomes.length>40)fail('missing_or_excessive_outcomes');
 else {
  const keys=new Set();
  weighted=outcomes.some(row=>row?.probabilityBps!==undefined);
  if(weighted&&(probabilitySource!=='hypothetical_manual'||outcomes.some(row=>!bps(row?.probabilityBps))||
     outcomes.reduce((sum,row)=>sum+(row?.probabilityBps||0),0)!==10000))fail('invalid_probability_distribution');
  if(!weighted&&probabilitySource!=null)fail('probability_inputs_missing');
  for(const row of outcomes){
   const gradeKey=row?.grade?gradingGradeKey(provider,row.grade):null;
   if(!row||!outcomesAllowed.includes(row.kind)||!money(row.upchargeMinor)||!money(row.eventExpenseMinor)||
      (row.grade!=null&&!gradeKey)||(row.kind==='grading_failed'&&gradeKey)||
      (row.kind==='sold'?(!gradeKey||!manualPrice(row.price,currency)):row.price!=null)){
    fail('invalid_grade_or_outcome');continue;
   }
   // Distinct price/cost scenarios for the same grade remain possible, but
   // exact duplicate scenarios cannot accidentally double their probability.
   const key=JSON.stringify([row.kind,gradeKey,row.price?.amountMinor,row.upchargeMinor,row.eventExpenseMinor]);
   if(keys.has(key))fail('duplicate_outcome');
   keys.add(key);
  }
 }
 if(problems.length)return {...gated,status:'invalid',issues:[...new Set(problems)],analysis:null};
 const rawSale=net(raw.price.amountMinor,raw.seller);
 const baseCost=service.feeMinor+costs.reduce((sum,key)=>sum+service[key],0);
 const calculate=(outcome,haircut=0,extraCost=0)=>{
  const sold=outcome.kind==='sold';
  const gradeKey=outcome.grade?gradingGradeKey(provider,outcome.grade):null;
  const gradingCostMinor=baseCost+outcome.upchargeMinor+extraCost;
  const cost=gradingCostMinor+outcome.eventExpenseMinor;
  const sale=sold?net(outcome.price.amountMinor-roundSellingFee(outcome.price.amountMinor,haircut),gradedSeller):null;
  const incrementalCashMinor=(sale?.netMinor||0)-cost-rawSale.netMinor;
  const fixed=gradedSeller.fixedMinor,other=gradedSeller.shippingMinor+gradedSeller.otherMinor;
  return {kind:outcome.kind,gradeKey,probabilityBps:outcome.probabilityBps??null,gradingCostMinor,
   upchargeMinor:outcome.upchargeMinor,eventExpenseMinor:outcome.eventExpenseMinor,sale,incrementalCashMinor,
   accountingProfitMinor:sold?sale.netMinor-cost-acquisitionMinor:null,
   incrementalBreakEvenMinor:breakEven(rawSale.netMinor+cost,gradedSeller.rateBps,fixed,other),
   accountingBreakEvenMinor:breakEven(acquisitionMinor+cost,gradedSeller.rateBps,fixed,other),
   cardResidualValueModeled:false};
 };
 const summarize=rows=>{
  // Expected minor-unit values may be fractional. Round only the display.
  const expected=read=>rows.reduce((sum,row)=>sum+read(row)*row.probabilityBps,0)/10000;
  return {
   lowestIncrementalCashMinor:Math.min(...rows.map(row=>row.incrementalCashMinor)),
   expectedIncrementalCashMinor:weighted?expected(row=>row.incrementalCashMinor):null,
   expectedAccountingProfitMinor:weighted&&rows.every(row=>row.kind==='sold'||row.probabilityBps===0)?expected(row=>row.accountingProfitMinor??0):null,
   expectedGrossResaleMinor:weighted?expected(row=>row.sale?.grossMinor??0):null,
   expectedNetResaleMinor:weighted?expected(row=>row.sale?.netMinor??0):null,
   expectedGradingCostMinor:weighted?expected(row=>row.gradingCostMinor):null,
   downsideProbabilityBps:weighted?rows.filter(row=>row.incrementalCashMinor<0).reduce((sum,row)=>sum+row.probabilityBps,0):null};
 };
 const rows=outcomes.map(outcome=>calculate(outcome));
 const riskFlags=[
  ...(!weighted?['grade_probabilities_not_supplied']:[]),
  ...(!turnaround?['turnaround_uncertain']:[]),
  ...(outcomes.some(row=>row.kind!=='sold')?['unsold_asset_value_excluded']:['non_sale_outcomes_not_modeled']),
  ...(rows.some(row=>row.upchargeMinor>0)?['upcharges_modeled']:['upcharge_risk_not_modeled']),
  'prices_and_costs_are_hypothetical',
 ];
 return {...gated,status:'calculated',issues:[],provider,currency,analysis:{
  provenance:{price:'hypothetical_manual',fees:'hypothetical_manual',probabilities:weighted?'hypothetical_manual':null},
  assumptions:{declaredValueMinor,acquisitionMinor,turnaroundDays:turnaround??null,sellerFeeBasis:'gross_sale',
   rawSeller:{...raw.seller},gradedSeller:{...gradedSeller},declaredValueLimitMinor:service.declaredValueLimitMinor,
   costBreakdown:Object.fromEntries(['feeMinor',...costs].map(key=>[key,service[key]])),serviceTier:service.tier},
  rawSale:{...rawSale,accountingProfitMinor:rawSale.netMinor-acquisitionMinor},baseGradingCostMinor:baseCost,
  calculationSteps:['subtract_selling_expenses_from_gross','subtract_grading_and_event_costs','compare_raw_net_separately_from_acquisition'],
  rows,...summarize(rows),riskFlags,sensitivity:sensitivity.map(({label,haircutBps,extraCostMinor})=>({
   label,haircutBps,extraCostMinor,...summarize(outcomes.map(row=>calculate(row,haircutBps,extraCostMinor))),
  })),
 }};
}

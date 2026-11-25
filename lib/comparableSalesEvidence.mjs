import { qualifyCompletedSales, SALES_COHORTS } from './completedSales.mjs';

export const COMPARABLE_SALES_VERSION=1;
const inclusion=value=>['included','excluded'].includes(value)?value:'unknown';
const ref=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(value)?value:null;
const list=value=>Array.isArray(value)?value:[];
const distinct=values=>[...new Set(values)];
const company=value=>typeof value==='string'&&/^[a-z0-9 ]{1,24}$/i.test(value)?
  (/^beckett$/i.test(value)?'BGS':value.toUpperCase()):null;
const numericGrade=value=>typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=10?value:null;
const readinessReceipts=new WeakMap();
export const comparableReadinessReceipt=batch=>readinessReceipts.get(batch)||null;
const categories=['qualified','plausible','mismatch','insufficient','restricted'];

// Input records and policies are supplied by reviewed server adapters. This API
// is not exposed to request bodies. A physical verifier must bind its reviewed
// evidence to this card, target printing and catalog evidence.
export function evaluateComparableSales(records, {
 identityEvidence,target,verifyPhysicalTarget,policies=[],mappings=[],cohort,
 now,windowDays=30,coverage={},maxRows=75,minSample=3,scope='reviewed',
}={}) {
 if(!Array.isArray(records)||records.length>maxRows)throw new TypeError('Invalid comparable sales batch');
 const identitySupported=identityEvidence?.version===1&&identityEvidence.status==='catalog_supported'&&
  identityEvidence.catalogPrinting?.status==='catalog_record_consistent'&&
  !identityEvidence.catalogAmbiguity&&!identityEvidence.conflicts?.length&&!identityEvidence.priorConflicts?.length;
 const physicalVerified=scope!=='free_research'&&identitySupported&&typeof verifyPhysicalTarget==='function'&&
  verifyPhysicalTarget({identityEvidence,target})===true;
 const targetReasons=[
  ...(!identitySupported?['catalog_identity_or_printing_unresolved']:[]),
  ...(!physicalVerified?['target_physical_printing_unverified']:[]),
 ];
 const audited=records.map((record,index)=>{
  const policy=scope==='free_research'?null:policies.find(item=>item.provider===record.provider&&item.marketplace===record.source?.marketplace);
  const rights=policy?.rights;
  const allowed=policy?.approved===true&&rights?.commercialCalculation===true&&rights.summaryDisplay===true&&
   !!ref(rights.reference)&&Number.isFinite(Date.parse(rights.expiresAt))&&Date.parse(rights.expiresAt)>Date.parse(now);
  const supportedId=policy?.sourceTransactionIdVerified===true?ref(record.source?.transactionId):null;
  const graded=company(record.grading?.provider);
  const grade=numericGrade(record.grading?.grade);
  const raw=record.grading?.status==='raw';
  const observedCohort=raw?'Raw':graded&&grade!==null?graded+' '+grade:null;
  const premium=inclusion(record.buyerPremium);
  // The qualified path and Phase 3G consume the same canonical amount.
  const reported=record.amount||record.reportedAmount;
  const boundedAmount=reported&&/^[A-Z]{3}$/.test(reported.currency)&&
   ['major','minor'].includes(reported.unit)&&/^[0-9]{1,10}(?:\.[0-9]{1,4})?$/.test(String(reported.value))&&Number(reported.value)>0?
   {value:reported.value,unit:reported.unit,currency:reported.currency,basis:reported.basis==='per_card'?'per_card':'unknown'}:null;
  const amountKnown=!!boundedAmount&&record.priceConfirmed===true&&['fixed_price','auction','accepted_offer'].includes(record.transactionType)&&
   (record.transactionType!=='accepted_offer'||record.finalOfferPriceConfirmed===true);
  const independentlyPriced=amountKnown&&!!record.amount&&record.finalAmountEvidence?.status==='independently_verified'&&
   !!ref(record.finalAmountEvidence.reference)&&policy?.reviewedTransactionEvidence===true;
  const settled=record.settlement==='independently_verified'&&!!ref(record.settlementReference)&&
   policy?.reviewedTransactionEvidence===true;
  const contradictions=distinct(list(record.identityContradictions).filter(value=>ref(value)));
  const mismatches=[
   ...contradictions.map(field=>'identity_'+field+'_mismatch'),
   ...(record.status==='active'?['active_asking_listing']:[]),
   ...(cohort&&observedCohort&&observedCohort!==cohort?['requested_grade_mismatch']:[]),
   ...(record.quantity>1||record.lotStatus==='lot'?['multi_card_transaction']:[]),
   ...list(record.rejectionReasons).filter(value=>ref(value)),
  ];
  const extra=[
   ...targetReasons,
   ...list(record.incompleteReasons).filter(value=>ref(value)),
   ...(!allowed?['commercial_use_not_authorized']:[]),
   ...(!independentlyPriced?['independent_final_amount_missing']:[]),
   ...(!settled?['independent_settlement_missing']:[]),
   ...(premium==='unknown'?['buyer_premium_treatment_unknown']:[]),
  ];
  const {status,provider,providerRecordId,transactionType,saleDate,retrievedAt}=record;
  return {index,allowed,mismatches,extra,observedCohort,amountKnown,record:{
   provider:ref(provider),providerRecordId:ref(providerRecordId),
   source:{marketplace:ref(record.source?.marketplace),reference:ref(record.source?.reference),
    transactionId:supportedId,listingId:ref(record.source?.listingId)},
   status:status||'unknown',transactionType:transactionType||'unknown',saleDate:saleDate||null,retrievedAt:retrievedAt||null,
   reportedAmount:amountKnown?boundedAmount:null,
   finalAmountStatus:independentlyPriced?'independently_verified':amountKnown?'provider_reported':'unknown',
   settlementStatus:settled?'independently_verified':'unverified',
   finalAmountReference:independentlyPriced?ref(record.finalAmountEvidence.reference):null,
   settlementReference:settled?ref(record.settlementReference):null,
   rawCondition:raw&&['near_mint','lightly_played','moderately_played','heavily_played','damaged'].includes(record.condition)?record.condition:null,
   grading:{status:raw?'raw':graded||record.grading?.status==='graded'?'graded':'unknown',company:graded,grade,
    verified:policy?.gradingClassificationVerified===true&&record.grading?.verified===true},
   quantity:Number.isSafeInteger(record.quantity)&&record.quantity>0?record.quantity:null,
   lotStatus:['single_card','lot'].includes(record.lotStatus)?record.lotStatus:'unknown',
   shipping:inclusion(record.shipping),tax:inclusion(record.tax),buyerPremium:premium,
   rights:{commercialCalculation:allowed,reference:allowed?rights.reference:null,
    retention:scope==='free_research'?'ephemeral_only':allowed&&rights.retention==='permitted'?'permitted':'ephemeral_only'},
   exactPrinting:{claim:record.identityEvidence?.method==='reviewed_catalog_crosswalk'?{
    mappingId:ref(record.identityEvidence.mappingId),revision:ref(record.identityEvidence.revision),
    productId:ref(record.identityEvidence.productId),
   }:null,targetStatus:physicalVerified?'independently_verified':'unverified',
    listingStatus:['mismatch','plausible_unverified','exact_listing_evidence'].includes(record.listingIdentityStatus)?record.listingIdentityStatus:null,
    identity:record.identity||null,contradictions,missing:list(record.identityMissing).filter(value=>ref(value))},
  }};
 });
 const transactions=new Map();
 for(const entry of audited){
  const {marketplace,transactionId}=entry.record.source;
  if(!marketplace||!transactionId)continue;
  const key=JSON.stringify([marketplace,transactionId]);
  const group=transactions.get(key)||[];
  group.push(entry);
  transactions.set(key,group);
 }
 for(const group of transactions.values()){
  if(new Set(group.map(entry=>entry.record.buyerPremium)).size>1){
   for(const entry of group)entry.mismatches.push('conflicting_duplicate_buyer_premium');
  }
 }
 // Blocked siblings still go through 3G with their original identifiers, so
 // conflicting copies cannot disappear before transaction deduplication.
 const legacy=qualifyCompletedSales(records.map((record,index)=>{
  const {extra,mismatches}=audited[index];
  return {...record,status:extra.length||mismatches.length?'withheld':record.status};
 }),{target:physicalVerified?target:null,policies:scope==='free_research'?[]:policies,mappings:scope==='free_research'?[]:mappings,
  now,windowDays,coverage,maxRows,minSample});
 const qualifiedIndexes=new Set(legacy.qualified.map(record=>record.index));
 const blocked=new Map(legacy.quarantined.map(record=>[record.index,record.reasons]));
 const counts=Object.fromEntries(categories.map(category=>[category,0]));
 const qualifiedByCohort=Object.fromEntries(SALES_COHORTS.map(group=>[group,0]));
 const cohortsByBasis=new Map();
 const rows=audited.map(entry=>{
  const baseReasons=blocked.get(entry.index)||[];
  const reasons=distinct([...entry.mismatches,...entry.extra,...baseReasons.filter(reason=>
   reason!=='not_completed_sale'||records[entry.index].status!=='completed')]);
  const conflicted=entry.mismatches.length||baseReasons.some(reason=>/^(?:identity_.*_mismatch|provider_.*_conflict|(?:conflicting_)?duplicate_transaction|copy_serial_print_run_conflict)$/.test(reason));
  const classification=qualifiedIndexes.has(entry.index)?'qualified':conflicted?'mismatch':!entry.allowed?'restricted':
   !entry.amountKnown||!entry.observedCohort||records[entry.index].status!=='completed'?'insufficient':'plausible';
  counts[classification]++;
  if(classification==='qualified'){
   qualifiedByCohort[entry.observedCohort]++;
   const r=entry.record;
   const key=JSON.stringify([r.reportedAmount?.currency,r.shipping,r.tax,r.buyerPremium]);
   const basis=cohortsByBasis.get(key)||{};
   const bucket=entry.observedCohort==='Raw'?'Raw:'+r.rawCondition:entry.observedCohort;
   basis[bucket]=(basis[bucket]||0)+1;
   cohortsByBasis.set(key,basis);
  }
  return {...entry.record,index:entry.index,classification,reasons,
   researchCandidate:!conflicted&&entry.record.status==='completed',
   insufficientTransactionEvidence:!entry.amountKnown||!entry.observedCohort||
    entry.record.settlementStatus!=='independently_verified'||entry.record.quantity!==1||
    entry.record.lotStatus!=='single_card'||[entry.record.shipping,entry.record.tax,entry.record.buyerPremium].includes('unknown')};
 });
 const comparableSamples=[...cohortsByBasis.values()].some(count=>Object.keys(count).some(group=>group.startsWith('Raw:')&&count[group]>=minSample)&&
  SALES_COHORTS.filter(group=>group!=='Raw').every(group=>count[group]>=minSample));
 const result={version:COMPARABLE_SALES_VERSION,rows,counts,qualifiedByCohort,
  coverage:{...legacy.coverage,received:records.length,windowDays,minSample,evaluatedAt:now},
  readiness:{automaticEconomicsAllowed:false,status:'withheld',blockers:distinct([
   ...targetReasons,...(scope==='free_research'||!audited.some(row=>row.allowed)?['commercial_use_not_authorized']:[]),
   ...(!comparableSamples?['insufficient_compatible_cohort_samples']:[]),'automatic_economics_not_enabled',
  ])}};
 readinessReceipts.set(result,Object.freeze({qualified:counts.qualified,physicalVerified,compatibleSamples:comparableSamples,
  commercialRights:audited.some(row=>row.allowed)}));
 return result;
}

// Reviewed mapping for the Free-tier response. Provider result IDs are not
// transaction IDs. A missing numeric grade never establishes Raw.
export function freeResearchSale(row,retrievedAt) {
 const grade=row.identityMatch?.gradeEvidence;
 const titleGrade=grade?.label?.match(/^([A-Z]+) (\d+(?:\.\d)?)$/);
 const explicitMismatch=reason=>/^(?:identity_.*_mismatch|outside_requested_(?:date_range|category)|condition_grade_conflicts_with_raw_filter|repeated_provider_record_id)$/.test(reason)||
  (reason==='grade_mismatch_or_qualifier'&&grade?.status==='mismatch');
 const numeric=typeof row.grade==='string'&&/^\d{1,2}(?:\.\d)?$/.test(row.grade)?Number(row.grade):titleGrade?Number(titleGrade[2]):null;
 return {provider:'the_card_api',providerRecordId:row.id,source:{marketplace:row.platform},
  status:'completed',transactionType:row.listingType==='best_offer'?'accepted_offer':row.listingType,
  priceConfirmed:row.amountReportedConfirmed,finalOfferPriceConfirmed:row.listingType==='best_offer'&&row.amountReportedConfirmed,
  reportedAmount:row.price==null?null:{value:row.price,unit:'major',currency:row.currency,basis:'unknown'},
  saleDate:row.sold,retrievedAt,grading:{
   status:grade?.label==='Listed as Raw'?'raw':numeric!==null||row.grader||grade?.label?.startsWith('Graded')?'graded':'unknown',
   provider:row.grader||titleGrade?.[1],grade:numeric,
  },
  listingIdentityStatus:row.identityMatch?.status,identityContradictions:row.identityMatch?.mismatches,
  identityMissing:row.identityMatch?.unknown,
  identity:{subject:row.player||null,year:row.year||null,set:row.set||null,collectorNumber:row.cardNumber||null,printRun:row.printRun||null},
  rejectionReasons:list(row.reasons).filter(explicitMismatch),incompleteReasons:list(row.reasons).filter(reason=>!explicitMismatch(reason))};
}

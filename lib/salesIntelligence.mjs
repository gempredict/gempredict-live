import { cardApiSalesAdapter } from './cardApiSalesAdapter.mjs';
import { compareScanSale } from './scanToSalesIdentity.mjs';
import { qualifyCompletedSales } from './completedSales.mjs';
import { evaluateComparableSales } from './comparableSalesEvidence.mjs';

const knownGraders=new Set(['PSA','BGS','CGC','SGC','TAG','CSG','HGA','ACE','GMA','KSA']);
export const salesIntelligenceBranch='feature/provider-independent-sales-intelligence-phase5p';
export const benchmarkCalibrationBranch='feature/identification-grading-calibration-phase5q';
export const salesIntelligenceBranches=Object.freeze([salesIntelligenceBranch,benchmarkCalibrationBranch]);
export const salesProviderRegistry=Object.freeze({primary:'the_card_api',providers:Object.freeze({
 the_card_api:Object.freeze({enabled:true,adapter:cardApiSalesAdapter,credentialEnv:'THE_CARD_API_KEY',entitlement:'free_research',
  rights:'ephemeral_only',lookbackDays:30,windowDays:3,maxRequestsPerFiveMinutes:10,cooldownMs:2000,
  cohorts:Object.freeze(['Raw','PSA 8','PSA 9','PSA 10']),finalPrice:'provider_reported'}),
 card_ladder:Object.freeze({enabled:false,entitlement:'unverified'}),
})});

// The adapter owns the wire format. The common layer applies saved-card identity
// and legacy qualification to its normalized window without rewriting prices.
export async function readProviderWindow(adapter,options) {
 let response;
 try{response=await adapter.readWindow(options);}
 catch{return {status:502,error:'provider_unavailable'};}
 if(!response.batch)return response;
 const {rows,...metadata}=response.batch;
 const candidates=[],rejected=[];
 for(const row of rows){
  const {reasons:initial,...candidate}=row;
  const reasons=[...initial];
  if(options.target){
   const match=compareScanSale(options.target,candidate,options.input.cohort,{strictTitle:options.unified});
   if(match.status==='mismatch')reasons.push(...match.mismatches.map(field=>'identity_'+field+'_mismatch'));
   if(reasons.length&&match.status==='exact_listing_evidence')match.status='plausible_unverified';
   candidate.identityMatch=match;
  }
  if(reasons.length)rejected.push({...candidate,reasons});else candidates.push(candidate);
 }
 const retrievedAt=new Date(options.now).toISOString();
 const records=[...candidates,...rejected].sort((a,b)=>a.index-b.index).map(row=>adapter.normalize(row,retrievedAt));
 const legacy=qualifyCompletedSales(records,{now:retrievedAt,windowDays:30,maxRows:20,
  coverage:{complete:false,reportedTotal:metadata.coverage.reportedTotal,lookbackDays:30}});
 const byIndex=new Map(legacy.quarantined.map(row=>[row.index,row.reasons]));
 const reasons=row=>({...row,qualificationReasons:byIndex.get(row.index)||[]});
 return {...response,batch:{...metadata,candidates:candidates.map(reasons),
  rejected:options.unified?rejected.map(reasons):rejected,cohort:options.input.cohort,qualifiedCount:legacy.qualified.length}};
}

// Versioned research evidence uses the same normalized names as the common
// comparable gate. Provider-declared rights and settlement cannot authorize it.
function researchRecord(record,provider,policy,link) {
 const tx=record.source?.transactionId;
 const supportedReference=policy.verifiedTransactionReferences===true&&typeof tx==='string'&&
  /^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(tx)?tx:null;
 return {...record,version:1,provider,source:{...record.source,transactionId:supportedReference},
  listingType:record.listingType??null,saleTypeBasis:record.saleTypeBasis??null,originalAmount:record.originalAmount??null,
  catalogIdentifiers:record.catalogIdentifiers??[],retention:'ephemeral_only',commercialDisplay:false,
  rejectionReasons:[...(record.rejectionReasons||[]),...(link?.contradictions.includes('catalog_variant')?['identity_catalog_variant_mismatch']:[])],
  incompleteReasons:[...(record.incompleteReasons||[]),...(link&&link.status!=='sale_linked_to_exact_catalog_variant'?
   ['reviewed_exact_sale_catalog_link_missing']:[])]};
}

// Trusted server adapters supply batches. A failed source has no records and
// is recorded independently. This entry point never grants commercial rights.
export function evaluateSalesIntelligence(batches,{registry=salesProviderRegistry,crosswalk,...options}={}) {
 const links=new Map((crosswalk?.rows||[]).map(row=>[row.index,row]));
 const records=[], failures=[],providers=new Set();
 for(const batch of batches){
  const policy=Object.hasOwn(registry.providers,batch.provider)?registry.providers[batch.provider]:null;
  if(!policy?.enabled)continue;
  providers.add(batch.provider);
  if(batch.error){
   if(!failures.includes(batch.provider))failures.push(batch.provider);
   continue;
  }
  try{
   if(!Array.isArray(batch.rows)||typeof policy.adapter?.normalize!=='function')throw Error();
   const normalized=batch.rows.map(row=>policy.adapter.normalize(row,options.now));
   if(normalized.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error();
   for(const row of normalized)records.push(researchRecord(row,batch.provider,policy,links.get(records.length)));
  }catch{if(!failures.includes(batch.provider))failures.push(batch.provider);}
 }
 const comparableEvidence=evaluateComparableSales(records,{...options,scope:'free_research'});
 // The Free qualification audit drops transaction IDs. Only trusted adapter
 // references may be used for this separate research overlap annotation.
 const rows=comparableEvidence.rows.map((row,index)=>({...row,researchTransactionReference:records[index].source.transactionId||null}));
 return {comparableEvidence,evidenceRows:rows,summary:summarizeSalesIntelligence(rows,{providers:[...providers],failures})};
}

export function summarizeSalesIntelligence(rows,{providers=[],failures=[]}={}) {
 const cohortCounts={},currencies={},references=new Map(),fingerprints=new Map();
 let identityCompatible=0,priceUnknown=0,reportedPrices=0;
 const missing=new Set();
 const group=(map,key,row)=>{
  const values=map.get(key)||[];
  values.push(row);
  map.set(key,values);
 };
 for(const row of rows){
  if(row.researchCandidate&&['plausible_unverified','exact_listing_evidence'].includes(row.exactPrinting.listingStatus))identityCompatible++;
  const grading=row.grading;
  const cohort=grading.status==='raw'?'Raw':knownGraders.has(grading.company)&&grading.grade!==null?grading.company+' '+grading.grade:'Unknown';
  cohortCounts[cohort]=(cohortCounts[cohort]||0)+1;
  const amount=row.reportedAmount;
  if(!amount||row.finalAmountStatus==='unknown')priceUnknown++;
  else{
   reportedPrices++;
   currencies[amount.currency]=(currencies[amount.currency]||0)+1;
  }
  for(const reason of row.reasons)missing.add(reason);
  const market=row.source.marketplace, tx=row.researchTransactionReference;
  if(market&&tx)group(references,JSON.stringify([market,tx]),row);
  const id=row.exactPrinting.identity;
  if(market&&row.saleDate&&amount&&id?.subject&&id.year&&id.set&&id.collectorNumber)
   group(fingerprints,JSON.stringify([market,row.saleDate,id.subject,id.year,id.set,id.collectorNumber,cohort,amount.currency,amount.unit,amount.value]),row);
 }
 const overlaps=[...fingerprints.values()].filter(group=>new Set(group.map(row=>row.provider)).size>1&&
  (group.some(row=>!row.researchTransactionReference)||new Set(group.map(row=>row.researchTransactionReference)).size>1));
 const duplicates=[...references.values()].filter(group=>group.length>1);
 const conflictingReferences=duplicates.filter(group=>new Set(group.map(row=>JSON.stringify([row.saleDate,row.reportedAmount,row.grading,
  row.exactPrinting.identity,row.quantity,row.lotStatus]))).size>1);
 return {version:1,recordsRetrieved:rows.length,identityCompatible,reportedPrices,priceUnknown,cohortCounts,currencies,
  providers,failedProviders:failures,duplicateReferenceGroups:duplicates.length,conflictingReferenceGroups:conflictingReferences.length,
  suspectedOverlapGroups:overlaps.length,
  suspectedOverlapIndexes:[...new Set(overlaps.flatMap(group=>group.map(row=>row.index)))].sort((a,b)=>a-b),
  repeatedProviderRecordCount:rows.filter(row=>row.suspectedDuplicate||row.reasons.includes('repeated_provider_record_id')).length,
  valuationEligible:false,missingEvidence:[...missing].sort(),
  nextResearch:'Verify the physical printing, exact catalog linkage, transaction settlement and display rights.'};
}

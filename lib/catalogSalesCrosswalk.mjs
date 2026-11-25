import { createCatalogEvidenceAdapter,reconcileCatalogIdentity } from './catalogIdentityEvidence.mjs';

export const CATALOG_SALES_CROSSWALK_VERSION=1;
export const CARD_API_CATALOG_ID_TYPES=Object.freeze(['UCID','USID','URID','CFID']);
const core=['category','subjects','year','set','number'];
const variants=['printing','parallel','photoPose','finish','foilTreatment','printRun','autograph','relic','subset','stamp'];
const opaque=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(value)?value:null;
const same=(a,b)=>a.namespace===b.namespace&&a.type===b.type&&a.value===b.value;
const adapterData=new WeakMap();

function projectIdentifiers(input,namespace,types) {
 if(!Array.isArray(input)||input.length>8)return null;
 const projected=[];
 for(const identifier of input){
  if(!identifier||typeof identifier!=='object')return null;
  const {type,value}=identifier;
  if(!types.includes(type)||!opaque(value)||projected.some(id=>id.type===type))return null;
  projected.push(Object.freeze({namespace,type,value}));
 }
 return Object.freeze(projected);
}

// Only reviewed server code can install this capability. There is no runtime
// adapter or catalog credential binding in Phase 5M.
export function createReviewedCrosswalkAdapter({namespace,types,source,projectCatalog,projectSale,authorize}) {
 if(!opaque(namespace)||!Array.isArray(types)||!types.length||types.some(type=>!opaque(type))||
    ![projectCatalog,projectSale,authorize].every(fn=>typeof fn==='function'))throw new TypeError('Invalid crosswalk adapter');
 const supportedTypes=Object.freeze([...new Set(types)]);
 const catalogProjection=createCatalogEvidenceAdapter(source,input=>input);
 const adapter=Object.freeze({});
 adapterData.set(adapter,{
  authorized(configuration){
   try{return authorize(configuration)===true;}catch{return false;}
  },
  catalog(input){
   const projected=projectCatalog(input);
   const evidence=catalogProjection(projected);
   const ids=projectIdentifiers(projected?.identifiers,namespace,supportedTypes);
   const exactId=ids?.find(id=>id.type===projected.exactVariantType)||null;
   const required=projected?.requiredVariantFields;
   if(!evidence||!ids||!Array.isArray(required)||!required.length||required.some(field=>!variants.includes(field)))return null;
   return {evidence,ids,exactId,required:[...new Set(['printing',...required])]};
  },
  sale(input){
   const projected=projectSale(input);
   const ids=projectIdentifiers(projected?.identifiers,namespace,supportedTypes);
   const exactId=ids?.find(id=>id.type===projected.exactVariantType);
   if(!exactId||!opaque(projected.saleId)||!opaque(projected.sourceReference))return null;
   return {saleId:projected.saleId,exactId,sourceReference:projected.sourceReference};
  },
 });
 return adapter;
}

export function evaluateCatalogSalesCrosswalk({
 adapter,configuration,proposal,reviewed,observations,priorConflicts,catalogRecords=[],sales=[],
}={}) {
 const capability=adapterData.get(adapter);
 const configured=!!capability&&capability.authorized(configuration);
 const records=configured&&Array.isArray(catalogRecords)?
  catalogRecords.slice(0,32).map(row=>capability.catalog(row)).filter(Boolean):[];
 const evidence=reconcileCatalogIdentity({proposal,reviewed,observations,priorConflicts,records:records.map(row=>row.evidence)});
 const candidates=records.map((row,index)=>{
  const single=reconcileCatalogIdentity({proposal,reviewed,observations,priorConflicts,records:[row.evidence]});
  const missing=[...core,...row.required].filter(field=>row.evidence.claims[field]===undefined||
   !evidence.claims[field]?.proposed.some(value=>value.evidence.some(origin=>origin.certainty!=='uncertain')));
  if(!row.exactId)missing.push('exact_catalog_identifier');
  return {compatible:evidence.candidateIndexes.includes(index),missing,contradictions:[...single.conflicts,...single.priorConflicts],identifiers:row.ids,exactIdentifier:row.exactId,
   source:row.evidence.source,provenance:row.evidence.provenance,recordId:row.evidence.recordId,revision:row.evidence.revision,
   retrievedAt:row.evidence.retrievedAt,claims:row.evidence.claims};
 });
 const compatible=candidates.filter(row=>row.compatible);
 // Sparse but potentially compatible records preserve ambiguity rather than
 // making the one more complete record win by default.
 const exact=evidence.status==='catalog_supported'&&compatible.length===1&&!compatible[0].missing.length?compatible[0]:null;
 const status=!configured?'catalog_provider_not_configured':!records.length?'catalog_record_missing':
  evidence.status==='conflict'?'identity_conflict':exact?'exact_catalog_variant_supported':
  compatible.length>1?'ambiguous_catalog_variants':'catalog_record_found';
 const rows=(Array.isArray(sales)?sales:[]).slice(0,40).map(sale=>{
  const link=configured?capability.sale(sale):null;
  const contradictions=Array.isArray(sale?.identityMatch?.mismatches)?[...sale.identityMatch.mismatches]:[];
  if(sale?.identityMatch?.gradeEvidence?.status==='mismatch'&&!contradictions.includes('grade'))contradictions.push('grade');
  const linked=link&&link.saleId===sale?.id;
  if(linked&&exact&&!same(link.exactId,exact.exactIdentifier))contradictions.push('catalog_variant');
  const plausible=['plausible_unverified','exact_listing_evidence'].includes(sale?.identityMatch?.status);
  return {index:sale?.index??null,saleId:opaque(sale?.id),status:contradictions.length?'identity_conflict':
   linked&&exact?'sale_linked_to_exact_catalog_variant':plausible?'plausible_title_association':'missing_evidence',
   contradictions,unresolvedFields:[...(!linked?['exact_sale_catalog_link']:[]),...(!exact?['exact_catalog_variant']:[]),
    ...(sale?.identityMatch?.gradeEvidence?.status==='unknown'?['grading_cohort']:[]),
    'independent_physical_comparison'],link:linked?link:null};
 });
 return {version:CATALOG_SALES_CROSSWALK_VERSION,status,catalogRecordFound:records.length>0,
  exactCatalogVariantSupported:!!exact,physicalPrintingVerified:false,candidates,rows,
  unresolvedFields:[...new Set([...evidence.missing,...compatible.flatMap(row=>row.missing),'independent_physical_comparison'])],
  contradictions:[...new Set([...evidence.conflicts,...evidence.priorConflicts,...(evidence.jointConflict?['incompatible_claim_combination']:[])])],
  nextEvidence:!configured?'Catalog provider not configured. An independently authorized catalog adapter is required.':
   !exact?'Obtain an exact catalog variant record and resolve the conflicting or missing fields.':
   'Compare the photographed card independently and obtain a reviewed sale-to-variant link.',
  authorizesValuation:false};
}

// listing_type describes the listing. sale_type describes the transaction
// outcome, when an explicitly supported value is supplied. The older reviewed
// Sales contract did not include sale_type, so retain a marked legacy fallback.
export function readCardApiSaleType(listingType,row) {
 if(!Object.hasOwn(row,'sale_type'))return {transactionType:listingType==='best_offer'?'accepted_offer':listingType,
  saleTypeBasis:'listing_type_only',usable:true};
 const saleType=row.sale_type;
 const usable=listingType==='auction'?saleType==='auction':listingType==='fixed_price'?
  ['fixed_price','accepted_offer'].includes(saleType):listingType==='best_offer'&&saleType==='accepted_offer';
 return {transactionType:usable?saleType:null,saleTypeBasis:usable?'provider_sale_type':'unsupported_sale_type',usable};
}

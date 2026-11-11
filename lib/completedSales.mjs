// Provider-independent, deterministic qualification. No network, persistence or economics mutation.
// Policies and reviewed mappings belong to a trusted server adapter, never the model or client.
export const SALES_COHORTS=Object.freeze(['Raw','PSA 8','PSA 9','PSA 10']);
const batches=new WeakSet();
const clean=v=>typeof v==='string'&&v.length<=200&&v.trim()?v.trim():null;
const norm=v=>clean(v)?.toLowerCase().replace(/\s+/g,' ')||null;
const token=v=>norm(v)?.replace(/\s/g,'')||null;
const same=(a,b)=>norm(a)!==null&&norm(a)===norm(b);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v?v:null;
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&date(v.slice(0,10))&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const money=amount=>{
 if(!plain(amount)||!['USD','EUR','GBP','CAD','AUD'].includes(amount.currency)||amount.basis!=='per_card')return null;
 let n=null;
 if(amount.unit==='minor'&&Number.isSafeInteger(amount.value))n=amount.value;
 if(amount.unit==='major'&&typeof amount.value==='string'&&/^\d{1,9}(?:\.\d{1,2})?$/.test(amount.value))n=Math.round(Number(amount.value)*100);
 return Number.isSafeInteger(n)&&n>0&&n<=9999999999?n:null;
};
const fields=['category','subject','year','set','collectorNumber','language','rarity','parallel','finish','variation','stamp','regulationMark','autograph','printRun','subset','printedTitle'];
function exactIdentity(record,target,mappings){
 const failures=[];
 if(!plain(target)||!['pokemon','sports'].includes(target.category))return ['target_identity_unresolved'];
 const required=['category','subject','year','set','collectorNumber','language','parallel','finish','variation','stamp','autograph','printRun','subset','printedTitle'];
 if(target.category==='pokemon')required.push('rarity','regulationMark');
 if(required.some(f=>!clean(target[f])))return ['target_identity_incomplete'];
 const evidence=record.identityEvidence;
 const mapping=plain(evidence)&&evidence.method==='reviewed_catalog_crosswalk'&&mappings.find(m=>m.id===evidence.mappingId&&m.reviewed===true&&m.revision===evidence.revision&&clean(m.sourceReference)&&clean(m.productId)&&m.provider===record.provider&&m.productId===evidence.productId);
 if(!mapping)return ['exact_printing_evidence_missing'];
 for(const f of fields){
  if(f==='rarity'&&target.category==='sports'&&!target[f]&&!mapping.identity?.[f])continue;
  if(f==='regulationMark'&&target.category==='sports'&&!target[f]&&!mapping.identity?.[f])continue;
  const a=mapping.identity?.[f],b=target[f],r=record.identity?.[f];
  const equal=f==='collectorNumber'?token(a)!==null&&token(a)===token(b):same(a,b);
  if(!equal)failures.push('identity_'+f+'_mismatch');
  // Null provider attributes remain unknown; the independently reviewed mapping can supply them.
  // Contradictory supplied provider facts are never overwritten by a catalog mapping.
  if(r!==null&&r!==undefined&&!same(r,a)&&!(f==='collectorNumber'&&token(r)===token(a)))failures.push('provider_'+f+'_conflict');
 }
 return failures;
}
function cohort(record){
 const g=record.grading;
 if(g?.status==='raw'&&g.provider===null&&g.grade===null&&g.qualifier===null&&g.verified===true)return 'Raw';
 if(g?.status==='graded'&&g.provider==='PSA'&&[8,9,10].includes(g.grade)&&g.qualifier===null&&g.verified===true)return 'PSA '+g.grade;
 return null;
}
const stableId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v)?v:null;
function safeSourceUrl(value,policy,record){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&policy.sourceHosts?.includes(u.hostname)&&typeof policy.validateTransactionUrl==='function'&&policy.validateTransactionUrl(u,record)===true?u.href:null;}catch{return null;}
}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export function qualifyCompletedSales(records,{target,policies=[],mappings=[],now,windowDays=30,minSample=3,maxRows=75,coverage={}}={}){
 const clock=instant(now);
 if(clock===null||!Number.isInteger(windowDays)||windowDays<1||windowDays>90||!Number.isInteger(minSample)||minSample<3||!Number.isInteger(maxRows)||maxRows<1||maxRows>75)throw new TypeError('Invalid bounded sales context');
 if(!Array.isArray(records)||records.length>maxRows)throw new TypeError('Sales row cap exceeded or invalid array');
 const quarantined=[],candidates=[],blockedKeys=new Set();
 records.forEach((record,index)=>{
  const fail=[];if(!plain(record)){quarantined.push({index,reasons:['invalid_record']});return;}
  const p=policies.find(p=>p.provider===record.provider&&p.marketplace===record.source?.marketplace);
  // A record cannot assert its own usage rights or source identity semantics.
  const rights=p?.rights;
  if(p?.approved!==true||rights?.commercialCalculation!==true||rights?.summaryDisplay!==true||!clean(rights?.reference)||instant(rights?.expiresAt)===null||instant(rights.expiresAt)<=clock)fail.push('commercial_use_not_authorized');
  if(!stableId(record.provider)||!stableId(record.providerRecordId)||!stableId(record.source?.marketplace)||!stableId(record.source?.reference))fail.push('provenance_incomplete');
  const tx=stableId(record.source?.transactionId);
  const key=tx?record.source.marketplace+':'+tx:p?.providerRecordIsUniqueTransaction===true&&stableId(record.providerRecordId)?record.provider+':'+record.providerRecordId:null;
  if(!key||tx&&p?.sourceTransactionIdVerified!==true)fail.push('stable_transaction_identity_missing');
  if(record.status!=='completed'||!['fixed_price','auction','accepted_offer'].includes(record.transactionType))fail.push('not_completed_sale');
  if(record.priceConfirmed!==true||record.transactionType==='accepted_offer'&&record.finalOfferPriceConfirmed!==true)fail.push('final_amount_unconfirmed');
  if(!['provider_confirmed','independently_verified'].includes(record.settlement))fail.push('settlement_evidence_missing');
  if(record.settlement==='independently_verified'&&!clean(record.settlementReference))fail.push('independent_settlement_reference_missing');
  if(p?.saleProductLinkVerified!==true)fail.push('sale_product_link_unverified');
  if(record.grading?.status==='raw'&&!['near_mint','lightly_played','moderately_played','heavily_played','damaged'].includes(record.condition))fail.push('raw_condition_unestablished');
  const minor=money(record.amount);if(minor===null)fail.push('amount_units_currency_or_basis_unknown');
  if(record.quantity!==1||record.lotStatus!=='single_card')fail.push('single_card_quantity_not_established');
  if(!['included','excluded'].includes(record.shipping)||!['included','excluded'].includes(record.tax))fail.push('price_inclusions_unknown');
  const sale=date(record.saleDate),retrieved=instant(record.retrievedAt);
  if(!sale||Date.parse(sale+'T00:00:00Z')>clock||Date.parse(sale+'T00:00:00Z')<clock-windowDays*86400000)fail.push('sale_date_invalid_or_outside_window');
  if(retrieved===null||retrieved>clock||retrieved<clock-3*86400000||sale&&retrieved<Date.parse(sale+'T00:00:00Z'))fail.push('data_freshness_unestablished');
  const group=p?.gradingClassificationVerified===true?cohort(record):null;if(!group)fail.push('grade_or_raw_status_unverified');
  fail.push(...exactIdentity(record,target,mappings));
  let copySerial=null;
  if(record.copySerial!==null&&record.copySerial!==undefined){
   const serial=typeof record.copySerial==='string'?record.copySerial.match(/^([1-9]\d{0,6})\/([1-9]\d{0,6})$/):null;
   if(!serial||Number(serial[1])>Number(serial[2])||String(serial[2])!==String(target?.printRun))fail.push('copy_serial_print_run_conflict');else copySerial=record.copySerial;
  }
  if(fail.length){if(key)blockedKeys.add(key);quarantined.push({index,provider:stableId(record.provider),providerRecordId:stableId(record.providerRecordId),reasons:[...new Set(fail)]});return;}
  candidates.push({index,key,group,condition:record.grading.status==='raw'?record.condition:null,identity:structuredClone(target),identityVerification:'reviewed_catalog_crosswalk',identityEvidence:structuredClone(record.identityEvidence),grading:structuredClone(record.grading),copySerial,quantity:1,lotStatus:'single_card',status:'completed',transactionType:record.transactionType,priceConfirmed:true,amount:{value:minor,unit:'minor',basis:'per_card',currency:record.amount.currency},currency:record.amount.currency,minor,saleDate:sale,retrievedAt:record.retrievedAt,shipping:record.shipping,tax:record.tax,provider:record.provider,providerRecordId:record.providerRecordId,marketplace:record.source.marketplace,transactionId:tx,listingId:stableId(record.source.listingId),reference:record.source.reference,identityMapping:record.identityEvidence.mappingId,identityReference:mappings.find(m=>m.id===record.identityEvidence.mappingId).sourceReference,rightsReference:rights.reference,settlement:record.settlement,settlementReference:record.settlement==='independently_verified'?record.settlementReference:null,detailsAllowed:rights.transactionDisplay===true,sourceUrl:rights.transactionDisplay===true?safeSourceUrl(record.source.url,p,record):null,sourceUrlStatus:rights.transactionDisplay===true&&safeSourceUrl(record.source.url,p,record)?'verified_source_mapping':'unverified_or_unavailable'});
 });
 const groups=new Map();for(const c of candidates){const g=groups.get(c.key)||[];g.push(c);groups.set(c.key,g);}
 const qualified=[];
 for(const duplicate of groups.values()){
  // Economic facts must agree across providers; a listing ID alone never deduplicates transactions.
  const fingerprint=c=>JSON.stringify([c.group,c.currency,c.minor,c.saleDate,c.shipping,c.tax,c.identityMapping,c.copySerial,c.condition]);
  const conflict=blockedKeys.has(duplicate[0].key)||duplicate.some(c=>fingerprint(c)!==fingerprint(duplicate[0]));
  if(conflict){for(const c of duplicate)quarantined.push({index:c.index,reasons:['conflicting_duplicate_transaction']});}
  else{qualified.push(duplicate[0]);for(const c of duplicate.slice(1))quarantined.push({index:c.index,reasons:['duplicate_transaction']});}
 }
 const summaries=SALES_COHORTS.map(group=>{
  const items=qualified.filter(c=>c.group===group),partitions=new Map();
  for(const c of items){const key=[c.currency,c.shipping,c.tax,c.condition].join(':');const list=partitions.get(key)||[];list.push(c);partitions.set(key,list);}
  return {group,count:items.length,samples:[...partitions.values()].map(list=>{
   const prices=list.map(c=>c.minor).sort((a,b)=>a-b),dates=list.map(c=>c.saleDate).sort(),n=prices.length;
   const enough=n>=minSample;
   return {count:n,currency:list[0].currency,condition:list[0].condition,shipping:list[0].shipping,tax:list[0].tax,firstSale:dates[0],lastSale:dates.at(-1),latestRetrieval:list.map(c=>c.retrievedAt).sort().at(-1),medianMinor:enough?(prices[Math.floor((n-1)/2)]+prices[Math.floor(n/2)])/2:null,lowMinor:enough?prices[0]:null,highMinor:enough?prices.at(-1):null,status:enough?'qualified_sample':'insufficient_sample',references:[...new Set(list.map(c=>c.reference))],transactions:list.filter(c=>c.detailsAllowed)};
  })};
 });
 const result=freeze({status:qualified.length?'evaluated':'insufficient',qualified,summaries,quarantined,windowDays,minSample,evaluatedAt:now,coverage:{complete:coverage.complete===true?true:coverage.complete===false?false:null,reportedTotal:Number.isSafeInteger(coverage.reportedTotal)&&coverage.reportedTotal>=records.length?coverage.reportedTotal:null,lookbackDays:Number.isInteger(coverage.lookbackDays)&&coverage.lookbackDays>0&&coverage.lookbackDays<=90?coverage.lookbackDays:null},automaticEconomicsAllowed:false});
 batches.add(result);return result;
}
// Only an in-process qualifier result can reach this presentation boundary. Cached/client claims fail closed.
export function completedSalesView(evidence){return batches.has(evidence)?evidence:null;}
export function completedSalesEconomicsReference(evidence,{group,currency,shipping,tax,condition=null}={}){
 const e=completedSalesView(evidence),s=e?.summaries.find(s=>s.group===group)?.samples.find(s=>s.currency===currency&&s.shipping===shipping&&s.tax===tax&&s.condition===condition);
 // Read-only inputs for future server wiring; never invokes or authorizes automatic report economics.
 return freeze({available:!!s&&s.status==='qualified_sample'&&Number.isSafeInteger(s.medianMinor),salePrice:s?.status==='qualified_sample'&&Number.isSafeInteger(s.medianMinor)?s.medianMinor/100:null,currency:s?.currency||null,group:group||null,sampleCount:s?.count??null,assumption:'Qualified historical sample, not a predicted resale price',automaticEconomicsAllowed:false});
}

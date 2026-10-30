// Offline, pure translation only. No network, secrets, storage or live registration.
import {analyzeCompletedSales, exactEvidenceIdentity, validEvidenceDate, EVIDENCE_TYPES, SALES_POLICY} from '../completedSales.mjs';
import {catalogNameKey, catalogLanguageKey, catalogVariantKey} from '../catalogNormalization.mjs';
import {invalidCatalogIdentityFields} from '../catalogIdentityValidation.mjs';
import {PSA_FEE} from '../gradingEconomics.mjs';
import marketEvidenceEngine from '../marketEvidenceEngine.js';
import {completionDateCheck} from './theCardApiDates.mjs';

export const PROVIDER='the-card-api';
export const PIKACHU_TARGET=Object.freeze({subject:'Pikachu ex',year:'2026',brandSet:'30th Celebration',cardNumber:'149/128',language:'English',rarity:'Special Illustration Rare',parallel:'Holo Special Art',autoOrRelic:'none'});
// Reviewed naming equivalence only, NOT a reviewed transaction/SKU/printing map.
export const PIKACHU_CROSSWALK=Object.freeze({
 status:'pending_product_language_printing_review',canonicalSet:'30th Celebration',
 setAliases:Object.freeze(['30th Celebration','ME: 30th Celebration']),
 setAliasReference:'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=Pikachu-ex',
 mappings:Object.freeze([]),
});
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=500&&!/[\x00-\x1f\x7f]/.test(v);
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const num=v=>typeof v==='string'?v.trim().replace(/^#\s*/,'').replace(/\s/g,'').toLowerCase():'';
const day=86400000;
const medianOf=sorted=>sorted.length?(sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2):null;
function dateOnly(v,now){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&Date.parse(v)<=now;}
function titleParts(title){const parts=typeof title==='string'?title.split(/\s+-\s+/):[];return {subject:parts[0],number:parts.find(v=>/^#?\s*\d+\s*\/\s*\d+$/.test(v)),set:parts.find(v=>/^ME:\s*/.test(v)),printing:parts.at(-1)};}
function canonicalReady(c){return !invalidCatalogIdentityFields(c).length&&text(c.language)&&text(c.rarity)&&text(c.parallel)&&/^[a-z0-9]+\/[a-z0-9]+$/i.test(num(c.cardNumber))&&exactEvidenceIdentity(c,c);}
function mappingReady(m,c,now){
 const p=m?.provider;
 return m?.status==='reviewed'&&text(m.reviewedBy)&&validEvidenceDate(m.reviewedAt,now)&&text(m.reference)&&canonicalReady(m.canonical)&&exactEvidenceIdentity(c,m.canonical)&&catalogVariantKey(c.rarity)===catalogVariantKey(m.canonical.rarity)&&p&&text(p.subject)&&text(p.set)&&text(p.number)&&text(p.productId)&&text(p.language)&&text(p.rarity)&&text(p.printing)&&catalogLanguageKey(p.language)===catalogLanguageKey(c.language)&&catalogVariantKey(p.rarity)===catalogVariantKey(c.rarity);
}
export function matchProviderIdentity(record,canonical,{crosswalk=PIKACHU_CROSSWALK,now}={}){
 const reasons=[],parts=titleParts(record?.title),aliases=(crosswalk.setAliases||[]).map(catalogNameKey);
 if(!canonicalReady(canonical))reasons.push('canonical_identity_incomplete');
 if(catalogNameKey(crosswalk.canonicalSet)!==catalogNameKey(canonical.brandSet))reasons.push('crosswalk_target_set_conflict');
 const subjects=[record?.card_name,record?.player,parts.subject].filter(text);
 if(subjects.some(v=>catalogNameKey(v)!==catalogNameKey(canonical.subject)))reasons.push('subject_conflict');
 if(!subjects.length)reasons.push('subject_missing');
 const numbers=[record?.card_number,parts.number].filter(v=>v!=null&&v!=='');
 // A local number alone is insufficient; full fractions must agree.
 if(numbers.some(v=>num(v)!==num(canonical.cardNumber)))reasons.push('collector_number_conflict_or_partial');
 if(!numbers.length)reasons.push('collector_number_missing');
 const sets=[record?.card_set,parts.set].filter(text);
 if(sets.some(v=>!aliases.includes(catalogNameKey(v))))reasons.push('set_conflict_or_unreviewed_alias');
 if(!sets.length)reasons.push('set_missing');
 if(record?.year!=null&&String(record.year)!==canonical.year)reasons.push('year_conflict');
 if(record?.language!=null&&catalogLanguageKey(record.language)!==catalogLanguageKey(canonical.language))reasons.push('language_conflict');
 if(record?.rarity!=null&&catalogVariantKey(record.rarity)!==catalogVariantKey(canonical.rarity))reasons.push('rarity_conflict');
 if(/\b(?:japanese|jpn|korean|chinese|french|german|spanish|italian|portuguese|reverse|non.?holo|jumbo|oversized|proxy|replica|reprint|custom|rainbow|hyper|sar|lot|bundle)\b/i.test(record?.title||''))reasons.push('conflicting_or_ambiguous_title_variant');
 const mappings=(crosswalk.mappings||[]).filter(m=>mappingReady(m,canonical,now)&&aliases.includes(catalogNameKey(m.provider.set))&&record?.product_id===m.provider.productId&&subjects.every(v=>catalogNameKey(v)===catalogNameKey(m.provider.subject))&&sets.every(v=>catalogNameKey(v)===catalogNameKey(m.provider.set)||aliases.includes(catalogNameKey(v)))&&numbers.every(v=>num(v)===num(m.provider.number))&&catalogNameKey(record?.printing||parts.printing)===catalogNameKey(m.provider.printing));
 if(mappings.length!==1)reasons.push(mappings.length?'ambiguous_reviewed_crosswalk':'reviewed_product_language_printing_crosswalk_missing');
 const m=mappings[0];
 if(m&&record?.printing!=null&&parts.printing&&catalogNameKey(record.printing)!==catalogNameKey(parts.printing))reasons.push('printing_conflict');
 if(record?.variant&&(record.variant.ambiguous||record.variant.unrecognized||!m||!exactEvidenceIdentity(canonical,{...m.canonical,variant:record.variant,parallel:record.parallel||m.canonical.parallel})))reasons.push('structured_variant_conflict_or_unresolved');
 if(record?.parallel!=null&&(!m||![catalogNameKey(m.canonical.parallel),catalogNameKey(m.provider.printing)].includes(catalogNameKey(record.parallel))))reasons.push('parallel_conflict_or_unreviewed');
 if(record?.finish!=null&&(!m||!text(m.provider.finish)||catalogNameKey(record.finish)!==catalogNameKey(m.provider.finish)))reasons.push('finish_conflict_or_unreviewed');
 if(m&&catalogNameKey(m.provider.subject)!==catalogNameKey(canonical.subject))reasons.push('crosswalk_subject_conflict');
 if(m&&num(m.provider.number)!==num(canonical.cardNumber))reasons.push('crosswalk_number_conflict');
 return {status:reasons.some(v=>/conflict|ambiguous/.test(v))?'rejected':reasons.length?'unresolved':'verified',canonical:reasons.length?null:{...canonical},target:{...canonical},reasons,reference:reasons.length?null:m.reference};
}
function gradeOf(r,review){
 const title=r?.title||'',labels=[...title.matchAll(/\b(PSA|BGS|CGC|SGC|TAG)\s*(\d+(?:\.\d+)?)\b/gi)];
 const company=typeof r?.grader==='string'?r.grader.toUpperCase():null,g=r?.grade==null?null:String(r.grade);
 const qualifiers=/\b(?:pristine|black label|perfect|authentic|qualifier)\b/i.test(title)||r?.grade_qualifier||r?.label;
 if(company==='PSA'&&['9','10'].includes(g)&&!qualifiers&&!labels.some(l=>l[1].toUpperCase()!==company||l[2]!==g))return {group:'PSA '+g,status:'graded',company:'PSA',grade:g};
 if(review?.rawVerified===true&&text(review.reference)&&r?.grade==null&&r?.grader==null&&!labels.length&&!qualifiers)return {group:'raw',status:'raw',company:null,grade:null};
 return {group:'unknown',status:'unknown',company:null,grade:null};
}
export function inspectSourceUrl(value){
 if(value==null)return {status:'not_available',url:null,kind:'unknown'};
 if(typeof value!=='string'||value.length>2000)return {status:'rejected',url:null,kind:'unknown'};
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search)return {status:'rejected',url:null,kind:'unknown'};
  if(!['tcgplayer.com','www.tcgplayer.com'].includes(u.hostname))return {status:'unreviewed_host_or_route',url:null,kind:'unknown'};
  if(!/^\/product\/\d+(?:\/[a-z0-9-]+)?\/?$/i.test(u.pathname))return {status:'unreviewed_host_or_route',url:null,kind:'unknown'};
  return {status:'syntax_and_host_only',url:u.href,kind:'catalog_product_not_transaction'};
 }catch{return {status:'rejected',url:null,kind:'unknown'};}
}
function provenanceOf(r,review,now){
 const url=inspectSourceUrl(r.listing_url);
 const verified=text(r.id)&&text(r.platform)&&review?.status==='reviewed'&&text(review.reference)&&text(review.sourceItemId)&&text(review.sourceTransactionId)&&validEvidenceDate(review.observedAt,now)&&review.providerTransactionId===r.id&&review.marketplace===r.platform;
 return {status:verified?'reviewed_provider_observation':'unresolved',providerId:PROVIDER,providerTransactionId:text(r.id)?r.id:null,marketplace:text(r.platform)?r.platform:null,sourceItemId:verified?review.sourceItemId:null,transactionId:verified?review.sourceTransactionId:null,observedAt:verified?review.observedAt:null,reference:verified?review.reference:null,delivery:'api_observation_license_unverified',sourceUrl:url};
}
export function normalizeSale(r,canonical,{now,crosswalk=PIKACHU_CROSSWALK,review=null}={}){
 if(!r||typeof r!=='object'||Array.isArray(r))return {status:'rejected',blockers:['invalid_record'],provider:PROVIDER,transactionId:null};
 const identity=matchProviderIdentity(r,canonical,{crosswalk,now}),grading=gradeOf(r,review),provenance=provenanceOf(r,review,now);
 const timestamp=validEvidenceDate(r.sold_at,now)?r.sold_at:null;
 const saleDate=dateOnly(r.sale_date,now)?r.sale_date:null;
 const dateCheck=completionDateCheck(r,now);
 const dated=dateCheck.valid;
 const type=['auction','fixed_price','best_offer'].includes(r.listing_type)?r.listing_type:'unknown';
 const asking=r.listing_type==='asking'||r.transaction_status==='active';
 const confirmed=!asking&&type!=='unknown'&&r.price_confirmed===true&&amount(r.price);
 const evidenceType=asking?EVIDENCE_TYPES.asking:confirmed?(type==='auction'?EVIDENCE_TYPES.auction:type==='fixed_price'?EVIDENCE_TYPES.fixed:type==='best_offer'?EVIDENCE_TYPES.offer:EVIDENCE_TYPES.ambiguous):EVIDENCE_TYPES.ambiguous;
 const blockers=[...(identity.status==='verified'?[]:identity.reasons),...(!text(r.id)?['provider_transaction_id_missing']:[]),...(!text(r.title)?['source_title_missing_or_invalid']:[]),...(!dated?['transaction_timestamp_missing_invalid_or_conflicting']:[]),...(!confirmed?['final_amount_unconfirmed']:[]),...(type==='unknown'?['transaction_type_unrecognized']:[]),...(r.currency!=='USD'?['currency_not_supported']:[]),...(grading.group==='unknown'?['grade_not_established']:[]),...(provenance.status!=='reviewed_provider_observation'?['transaction_provenance_unresolved']:[]),...(r.transaction_status!=null&&!['completed','settled'].includes(r.transaction_status)?['transaction_status_conflict']:[])];
 const quantity=Number.isInteger(r.quantity)&&r.quantity>0?r.quantity:null;
 const shipping=typeof r.shipping_price==='number'&&Number.isFinite(r.shipping_price)&&r.shipping_price>=0?r.shipping_price:null;
 if(r.quantity!=null&&quantity===null)blockers.push('quantity_invalid');
 // Amount-unit interpretation must be positively established, not inferred.
 if(review?.amountBasis!=='per_card'||!text(review.reference))blockers.push('amount_unit_not_established');
 return {provider:PROVIDER,transactionId:text(r.id)?r.id:null,sourceTitle:text(r.title)?r.title:null,identity,saleDate,timestamp,dateValidation:dateCheck,datePrecision:timestamp?'timestamp':saleDate?'day':'unknown',amount:confirmed?r.price:null,currency:typeof r.currency==='string'?r.currency:null,amountConfirmation:confirmed?'provider_confirmed':'unconfirmed',askingAmount:typeof r.original_price==='number'&&Number.isFinite(r.original_price)&&r.original_price>=0?r.original_price:null,evidenceType,listingType:type,shipping,quantity,amountBasis:review?.amountBasis==='per_card'?'per_card':'unknown',grading,provenance,settlement:{providerConfirmed:confirmed&&(!!saleDate||!!timestamp)&&(!r.transaction_status||['completed','settled'].includes(r.transaction_status)),independentlyVerified:false},deduplication:{status:'not_checked'},status:blockers.length?'blocked':'eligible_for_offline_evidence',blockers};
}
export function deduplicateSales(records){
 const groups=new Map();
 for(const [index,r] of records.entries()){
  const key=r.provenance?.transactionId?`${r.provenance.marketplace.toLowerCase()}:${r.provenance.transactionId}`:r.transactionId?`${r.provider}:${r.transactionId}`:`missing:${index}`;
  const items=groups.get(key)||[];items.push(r);groups.set(key,items);
 }
 const output=[];
 for(const list of groups.values()){
  const fingerprint=r=>JSON.stringify([r.amount,r.currency,r.saleDate,r.timestamp,r.identity,r.grading,r.quantity,r.shipping,r.evidenceType,r.amountBasis]);
  const conflict=list.some(r=>fingerprint(r)!==fingerprint(list[0]));
  for(const [i,r] of list.entries()){
   const status=conflict?'conflicting_duplicate':i?'duplicate_observation':r.provenance?.transactionId?'unique_reviewed_source_transaction':r.transactionId?'unique_provider_observation_source_uniqueness_unknown':'missing_identifier';
   const blockers=[...(r.blockers||[]),...(conflict?['contradictory_duplicate']:i?['duplicate_transaction']:[])];
   output.push({...r,deduplication:{status},blockers,status:blockers.length?'blocked':r.status});
  }
 }
 return output;
}
function windowStats(rows,days,now,minimumSample,coverage){
 const eligible=rows.filter(r=>r.status==='eligible_for_offline_evidence'&&r.timestamp&&now-Date.parse(r.timestamp)<=days*day&&now>=Date.parse(r.timestamp));
 const candidateDates=rows.map(r=>r.saleDate).filter(v=>v&&now-Date.parse(v)<=days*day&&now>=Date.parse(v)).sort();
 const values=eligible.map(r=>r.amount).sort((a,b)=>a-b),dates=eligible.map(r=>r.timestamp).sort((a,b)=>Date.parse(a)-Date.parse(b));
 const median=values.length>=minimumSample?medianOf(values):null;
 const center=medianOf(values);
 const deviations=center===null?[]:values.map(v=>Math.abs(v-center)).sort((a,b)=>a-b);
 const mad=medianOf(deviations);
 const flagged=eligible.filter(r=>mad>0?Math.abs(r.amount-center)>3*1.4826*mad:values.length>=3&&r.amount!==center);
 return {days,count:eligible.length,minimumSample,median:median===null?null:Math.round(median*100)/100,currency:'USD',qualified:median!==null,oldest:dates[0]||null,newest:dates.at(-1)||null,daysSinceNewest:dates.length?(now-Date.parse(dates.at(-1)))/day:null,variability:{low:values[0]??null,high:values.at(-1)??null,medianAbsoluteDeviation:mad,outlierCount:flagged.length,outliersExcluded:0},coverage:{providerLookbackDays:coverage.lookbackDays??null,complete:false,requestedHistoryAvailable:typeof coverage.lookbackDays==='number'?coverage.lookbackDays>=days:null},candidateDateRange:candidateDates.length?[candidateDates[0],candidateDates.at(-1)]:null,gaps:[...(eligible.length<minimumSample?['insufficient_verified_samples']:[]),...(!(coverage.lookbackDays>=days)?['requested_history_not_established']:[]),'coverage_not_proven_complete',...(eligible.some(r=>r.shipping===null)?['shipping_unknown']:[]),...(eligible.some(r=>r.quantity===null)?['quantity_unknown']:[]),...(flagged.length?['high_variability_review_required']:[])]};
}
export function buildMarketEvidence(rows,{now,windows=[7,30,90],minimumSample=SALES_POLICY.minimumSample,coverage={}}={}){
 if(!Number.isFinite(now)||!Number.isInteger(minimumSample)||minimumSample<SALES_POLICY.minimumSample||!Array.isArray(windows)||!windows.length||windows.some(v=>!Number.isInteger(v)||v<1||v>SALES_POLICY.maxAgeDays)||new Set(windows).size!==windows.length)throw Error('invalid_evidence_policy');
 const groups={};
 for(const grade of ['raw','PSA 9','PSA 10','unknown']){
  const groupRows=rows.filter(r=>(r.grading?.group||'unknown')===grade);
  const periods=Object.fromEntries(windows.map(d=>[d,windowStats(groupRows,d,now,minimumSample,coverage)]));
  const selected=periods[30]?.qualified?30:periods[90]?.qualified?90:null;
  groups[grade]={candidateCount:groupRows.length,windows:periods,selectedWindowDays:grade==='unknown'?null:selected,basis:selected===90?'historical_support_only':selected===30?'primary_current_window':'insufficient_evidence'};
 }
 return {evaluationOnly:true,groups,valuationApproved:false,releaseDayHandling:'recency_and_variability_review_no_automatic_exclusion'};
}
export function adaptTheCardApi(records,canonical=PIKACHU_TARGET,{now,crosswalk=PIKACHU_CROSSWALK,reviews={},coverage={},windows,minimumSample}={}){
 if(!Number.isFinite(now)||!Array.isArray(records)||records.length>50)throw Error('bounded_offline_records_and_clock_required');
 const transactions=deduplicateSales(records.map(r=>normalizeSale(r,canonical,{now,crosswalk,review:reviews[r?.id]||null})));
 const evidence=buildMarketEvidence(transactions,{now,coverage,windows,minimumSample});
 // Translation target is the existing completed-sales contract. This milestone
 // never asserts a commercial license, configures a provider or unlocks valuation.
 const envelope={status:'unavailable',providerId:PROVIDER,rights:{reference:null,commercialDisplay:false,transactionRecords:false},truncated:true,records:transactions.filter(r=>r.status==='eligible_for_offline_evidence').map(r=>({title:r.sourceTitle,identity:r.identity.canonical,evidenceType:r.evidenceType,amountBasis:'actual_transaction',soldAt:r.timestamp,transactionStatus:'completed',currency:r.currency,amount:r.amount,grading:{status:r.grading.status,company:r.grading.company,grade:r.grading.grade},provenance:{providerId:PROVIDER,marketplace:r.provenance.marketplace,sourceItemId:r.provenance.sourceItemId,transactionId:r.provenance.transactionId,observedAt:r.provenance.observedAt,reference:r.provenance.reference,rightsReference:null,delivery:'license_not_established'}}))};
 const existingAnalysis=analyzeCompletedSales(envelope,canonical,{now});
 return {version:1,mode:'offline_evaluation_only',transactions,evidence,completedSalesEnvelope:envelope,existingCompletedSalesAnalysis:existingAnalysis,marketPresentation:existingAnalysis.status==='available'?marketEvidenceEngine({completedSalesAnalysis:existingAnalysis}):null,gradingEconomics:{status:'blocked',feeUSD:PSA_FEE,reason:'commercial_rights_and_qualified_grade_evidence_and_calibration_required'},valuationApproved:false,integrationGaps:['commercial_license_and_upstream_rights_not_established','reviewed_product_language_printing_crosswalk_required','source_transaction_uniqueness_and_amount_basis_required','no_provider_registered_no_live_integration']};
}

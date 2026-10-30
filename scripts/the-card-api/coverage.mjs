// Aggregate-only owner-authorized benchmark. No raw response persistence.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ENDPOINT,claimRun,requestOnce,validateSchema,pageAvailability,redact} from './verify.mjs';
import {adaptTheCardApi} from '../../lib/providers/theCardApiAdapter.mjs';
import {catalogNameKey,catalogLanguageKey,catalogVariantKey} from '../../lib/catalogNormalization.mjs';
import {completionDateCheck} from '../../lib/providers/theCardApiDates.mjs';
export const COVERAGE_APPROVAL='AUTHORIZE_THE_CARD_API_BROAD_THREE_SEARCHES_75_ROWS';
export const CASES=Object.freeze([
 Object.freeze({id:'A',category:'high_volume_pokemon',subject:'Charizard ex',year:'2023',brandSet:'Scarlet & Violet 151',cardNumber:'006/165',language:'English',rarity:'Double Rare',parallel:'Holo',aliases:Object.freeze(['SV: Scarlet & Violet 151','Scarlet & Violet 151','Scarlet and Violet 151']),q:'"Charizard ex"',filters:Object.freeze({})}),
 Object.freeze({id:'B',category:'special_illustration_rare',subject:'Pikachu ex',year:'2026',brandSet:'30th Celebration',cardNumber:'149/128',language:'English',rarity:'Special Illustration Rare',parallel:'Holo Special Art',aliases:Object.freeze(['ME: 30th Celebration','30th Celebration']),q:'"Pikachu ex"',filters:Object.freeze({})}),
 Object.freeze({id:'C',category:'psa_10_coverage',subject:'Pikachu ex',year:'2024',brandSet:'Surging Sparks',cardNumber:'238/191',language:'English',rarity:'Special Illustration Rare',parallel:'Holo Special Art',aliases:Object.freeze(['SV08: Surging Sparks','Surging Sparks']),q:'"Pikachu ex"',filters:Object.freeze({graded:'true',grader:'PSA',grade:'10'})}),
]);
const isDay=(v,now)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&Date.parse(v)<=now;
const number=v=>typeof v==='string'?v.replace(/^#\s*/,'').replace(/\s/g,'').toLowerCase():'';
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function candidateMatch(r,c){
 const t=r.title||'',key=catalogNameKey(t);
 const subject=catalogNameKey(c.subject);
 const structuredNames=[r.card_name,r.player].filter(v=>typeof v==='string'&&v.trim());
 const titleName=catalogNameKey(t.split(/\s+-\s+/)[0]);
 if((titleName!==subject&&!structuredNames.some(v=>catalogNameKey(v)===subject))||!key.includes(subject))return false;
 if(/\b(?:mega|dark|light|team rocket)\b/i.test(t))return false;
 const fractions=t.match(/\b\d+\s*\/\s*\d+\b/g)||[];
 if((!fractions.length&&number(r.card_number)!==number(c.cardNumber))||fractions.some(v=>number(v)!==number(c.cardNumber)))return false;
 if(r.card_number!=null&&number(r.card_number)!==number(c.cardNumber))return false;
 if(r.card_set!=null&&!c.aliases.map(catalogNameKey).includes(catalogNameKey(r.card_set)))return false;
 if(!c.aliases.some(alias=>key.includes(catalogNameKey(alias)))&&!c.aliases.map(catalogNameKey).includes(catalogNameKey(r.card_set)))return false;
 // A structured set cannot conceal a contradictory marketplace title segment.
 const segments=t.split(/\s+-\s+/);
 if(segments.length>=4&&!c.aliases.map(catalogNameKey).includes(catalogNameKey(segments[2])))return false;
 if(r.year!=null&&String(r.year)!==c.year)return false;
 if([r.card_name,r.player].some(v=>v!=null&&catalogNameKey(v)!==catalogNameKey(c.subject)))return false;
 if(r.variant?.ambiguous||r.variant?.unrecognized)return false;
 if(r.variant?.finish!=null&&r.variant.finish!=='holo')return false;
 const genericPrinting=['holo','holofoil',catalogNameKey(c.parallel)];
 if([r.parallel,r.printing,r.finish].some(v=>v!=null&&!genericPrinting.includes(catalogNameKey(v))))return false;
 if(r.language!=null&&catalogLanguageKey(r.language)!==catalogLanguageKey(c.language))return false;
 if(r.rarity!=null&&catalogVariantKey(r.rarity)!==catalogVariantKey(c.rarity))return false;
 if(/\b(?:japanese|jpn|korean|chinese|french|german|spanish|italian|portuguese|thai|indonesian|reverse|non.?holo|rainbow|hyper|gold|jumbo|oversized|proxy|replica|fake|reprint|custom|lot|bundle|world\s+championship|prize\s+pack|cosmos|cracked\s+ice|stamped)\b/i.test([t,r.parallel,r.printing,r.finish].filter(v=>typeof v==='string').join(' ')))return false;
 return true; // Candidate only: no language/rarity/printing/product mapping inferred.
}
export function gradeClassification(r){
 const title=r.title||'',labels=[...title.matchAll(/\b(PSA|BGS|CGC|SGC|TAG)\s*(\d+(?:\.\d+)?)\b/gi)];
 const company=typeof r.grader==='string'?r.grader.toUpperCase():null,grade=r.grade==null?null:String(r.grade);
 if(r.has_grade_qualifier===true||r.has_autograph_grade===true||r.grade_qualifier||r.autograph_grade||r.label||/\b(?:authentic|pristine|black label|perfect|qualifier)\b/i.test(title))return {group:'unknown',basis:'ambiguous_or_qualified'};
 if(company||grade){
  if(company==='PSA'&&['9','10'].includes(grade)&&!labels.some(m=>m[1].toUpperCase()!==company||m[2]!==grade))return {group:'PSA '+grade,basis:'provider_structured_not_independently_verified'};
  return {group:'unknown',basis:'unsupported_or_conflicting_grade'};
 }
 if(labels.length){const unique=new Set(labels.map(m=>m[1].toUpperCase()+' '+m[2]));if(unique.size===1&&['PSA 9','PSA 10'].includes([...unique][0]))return {group:[...unique][0],basis:'title_inferred'};return {group:'unknown',basis:'unsupported_or_conflicting_grade'};}
 if(/\b(?:raw|ungraded)\b/i.test(title+' '+(typeof r.condition==='string'?r.condition:'')))return {group:'raw',basis:'label_inferred'};
 return {group:'unknown',basis:'not_established'}; // Null grade is not raw proof.
}
function sourceKind(value){
 if(typeof value!=='string'||!value.trim())return 'missing';
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return 'unreviewed_or_unsafe';
  if(['www.tcgplayer.com','tcgplayer.com'].includes(u.hostname)&&/^\/product\/\d+(?:\/[a-z0-9-]+)?\/?$/i.test(u.pathname))return 'public_catalog_route_not_transaction';
  if(/^(www\.)?ebay\.(com|co\.uk|ca|com\.au|de)$/.test(u.hostname)&&/^\/itm\/(?:[^/]+\/)?\d{9,15}\/?$/.test(u.pathname))return 'public_listing_route_not_settlement';
 }catch{}
 return 'unreviewed_or_unsafe';
}
function poolSummary(rows,now){
 const grades=Object.fromEntries(['raw','PSA 9','PSA 10','unknown'].map(g=>[g,{count:0,independentlyVerified:0,providerStructured:0,inferred:0}]));
 const dates=[],timestamps=[],byDate={},currencies={},gradeBasisCounts={},gradeFieldSupport={gradePresent:0,graderPresent:0,booleanQualifierFlagPresent:0},sources={available:0,missing:0,publicCatalogRoutes:0,publicListingRoutes:0,unreviewedOrUnsafe:0};
 const dateFailureReasons={},identityFieldSupport=Object.fromEntries(['card_name','player','card_set','card_number','language','rarity','printing','product_id','quantity'].map(k=>[k,{present:0,missing:0,null:0}]));
 let confirmed=0,unconfirmed=0,offersConfirmed=0,offersUnknown=0,originalAsks=0,invalidDates=0,duplicateProviderIds=0;const ids=new Set();
 for(const r of rows){
  if(typeof r.currency==='string'&&/^[A-Z]{3}$/.test(r.currency))currencies[r.currency]=(currencies[r.currency]||0)+1;
  const dateCheck=completionDateCheck(r,now),valid=dateCheck.valid;
  if(!valid)dateFailureReasons[dateCheck.reason]=(dateFailureReasons[dateCheck.reason]||0)+1;
  for(const [field,counts] of Object.entries(identityFieldSupport)){if(!Object.hasOwn(r,field))counts.missing++;else if(r[field]===null)counts.null++;else counts.present++;}
  if(valid){dates.push(r.sale_date);timestamps.push(r.sold_at);byDate[r.sale_date]=(byDate[r.sale_date]||0)+1;}else invalidDates++;
  const price=valid&&r.price_confirmed===true&&positive(r.price)&&/^[A-Z]{3}$/.test(r.currency);
  if(price)confirmed++;else unconfirmed++;
  if(r.listing_type==='best_offer'){if(price)offersConfirmed++;else offersUnknown++;}
  if(typeof r.original_price==='number'&&Number.isFinite(r.original_price)&&r.original_price>=0)originalAsks++;
  if(r.grade!=null)gradeFieldSupport.gradePresent++;if(r.grader!=null)gradeFieldSupport.graderPresent++;if(typeof r.has_grade_qualifier==='boolean')gradeFieldSupport.booleanQualifierFlagPresent++;
  const g=gradeClassification(r);gradeBasisCounts[g.basis]=(gradeBasisCounts[g.basis]||0)+1;grades[g.group].count++;if(g.basis==='provider_structured_not_independently_verified')grades[g.group].providerStructured++;if(['title_inferred','label_inferred'].includes(g.basis))grades[g.group].inferred++;
  const source=sourceKind(r.listing_url);if(source==='missing')sources.missing++;else{sources.available++;if(source==='public_catalog_route_not_transaction')sources.publicCatalogRoutes++;else if(source==='public_listing_route_not_settlement')sources.publicListingRoutes++;else sources.unreviewedOrUnsafe++;}
  if(ids.has(r.id))duplicateProviderIds++;else ids.add(r.id);
 }
 dates.sort();timestamps.sort((a,b)=>Date.parse(a)-Date.parse(b));return {returned:rows.length,dateFailureReasons,identityFieldSupport,currencies,gradeBasisCounts,gradeFieldSupport,saleDateRange:dates.length?{oldest:dates[0],newest:dates.at(-1)}:null,saleTimestampRange:timestamps.length?{oldest:timestamps[0],newest:timestamps.at(-1)}:null,observationsBySaleDate:byDate,invalidCompletionDates:invalidDates,prices:{providerConfirmed:confirmed,unconfirmed,confirmedAcceptedOffers:offersConfirmed,acceptedOffersAmountUnknown:offersUnknown,originalAskingPricePresent:originalAsks},grades,sources,deduplication:{distinctProviderIds:ids.size,repeatedProviderIds:duplicateProviderIds,independentSourceTransactions:'not_established'}};
}
export function summarizeCoverage(body,c,now){
 validateSchema(body);
 const ambiguousVariant=r=>r.variant?.ambiguous===true||r.variant?.unrecognized===true||/\b(?:lot|bundle|set of)\b/i.test(r.title)||new Set((r.title.match(/\b\d+\s*\/\s*\d+\b/g)||[]).map(number)).size>1;
 const ambiguous=body.data.filter(ambiguousVariant);
 const candidate=body.data.filter(r=>!ambiguousVariant(r)&&candidateMatch(r,c)),unmatched=body.data.filter(r=>!ambiguousVariant(r)&&!candidateMatch(r,c));
 // Reuse the offline adapter's disabled commercial gate. No reviews or product
 // mappings are fabricated; this benchmark cannot authorize valuation medians.
 const evaluation=adaptTheCardApi(candidate,c,{now,crosswalk:{canonicalSet:c.brandSet,setAliases:c.aliases,mappings:[]},coverage:{}});
 const reasons={};for(const r of evaluation.transactions)for(const blocker of r.blockers)reasons[blocker]=(reasons[blocker]||0)+1;
 const coverageFrom=isDay(body.meta?.coverage_date_from,now)?body.meta.coverage_date_from:null;
 const coverageTo=isDay(body.meta?.coverage_date_to,now)?body.meta.coverage_date_to:null;
 const structuredFilterEvidence=c.filters.grade?{requestedGrader:c.filters.grader,requestedGrade:c.filters.grade,matchingProviderFields:body.data.filter(r=>String(r.grade)===c.filters.grade&&typeof r.grader==='string'&&r.grader.toUpperCase()===c.filters.grader).length,missingProviderFields:body.data.filter(r=>r.grade==null||r.grader==null).length,conflictingProviderFields:body.data.filter(r=>r.grade!=null&&r.grader!=null&&(String(r.grade)!==c.filters.grade||String(r.grader).toUpperCase()!==c.filters.grader)).length}:null;
 return {structuredFilterEvidence,returned:body.data.length,reportedTotalMatches:body.pagination.total,candidateExactCardMatches:candidate.length,ambiguousVariantRecords:ambiguous.length,localIdentityStatus:{candidateUnverified:candidate.length,ambiguous:ambiguous.length,otherOrConflicting:unmatched.length,verified:0},independentlyVerifiedExactMatches:0,allReturned:poolSummary(body.data,now),candidatePool:poolSummary(candidate,now),ambiguousPool:poolSummary(ambiguous,now),unmatchedPool:poolSummary(unmatched,now),priceStatistics:{validatedComparableCount:0,minimumSample:3,range:null,median:null,status:'withheld_identity_grade_provenance_units_and_rights_unresolved',blockerCounts:reasons},pagination:{...pageAvailability(body.pagination),reportedPages:Number.isInteger(body.pagination.pages)?body.pagination.pages:null,pageRequested:1,pageLimit:25,complete:false,additionalPagesFetched:0},lookback:{effectivePlanDays:null,freePlanDocumentedDays:3,providerCoverageFrom:coverageFrom,providerCoverageTo:coverageTo,historyComplete:false},valuationApproved:false,commercialDisplayEnabled:false,independentSettlementVerified:false};
}
const quotaNumber=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
export async function runCoverage(key,{request=requestOnce,now=Date.now()}={}){
 const report={scope:'three_card_coverage_not_valuation',retrievalStrategy:'broad_subject_then_strict_local_screening',maximumRequests:3,maximumRowsPerSearch:25,maximumTotalRows:75,requests:[],acceptedRows:0,valuationApproved:false,commercialDisplayEnabled:false};
 if(!key)return {...report,status:'credential_missing'};
 for(const c of CASES){
  if(report.requests.length>=3)throw Error('request_cap');
  const url=new URL(ENDPOINT);url.search=new URLSearchParams({q:c.q,...c.filters,limit:'25',page:'1',sort:'date_desc'}).toString();
  const entry={test:c.id,category:c.category,card:c.subject+' #'+c.cardNumber+' — '+c.brandSet,query:c.q,filters:c.filters,method:'GET'};report.requests.push(entry);
  let response;try{response=await request(url,key,{includeQuota:true});}catch{response={error:'transport_failed'};}
  entry.httpStatus=Number.isInteger(response?.status)?response.status:null;
  entry.quota={dailySalesRowsLimit:quotaNumber(response?.quota?.limit),dailySalesRowsRemaining:quotaNumber(response?.quota?.remaining),resetUnixSeconds:quotaNumber(response?.quota?.reset)};
  if(response?.error||response?.status!==200){entry.status='request_failed';return {...report,status:'stopped_request_failure'};}
  try{entry.coverage=summarizeCoverage(response.body,c,now);}catch(e){entry.failedRequirement=typeof e?.message==='string'&&e.message.startsWith('schema_unrecognized: ')?e.message.slice(21):'bounded schema and offline evidence evaluation required';entry.status='schema_or_row_bound_rejected';return {...report,status:'stopped_schema_or_row_bound_failure'};}
  report.acceptedRows+=entry.coverage.returned;if(report.acceptedRows>75)throw Error('row_cap');entry.status='coverage_observed';
 }
 return {...report,status:'three_searches_completed',limitations:['Exactly one page per fixed search; counts are observations, not proven unique settlements or full market volume.','Broad subject queries retrieve newest matching observations, not an exhaustive exact-card universe. Structured PSA filters do not prove identity or independently verify grades; null grade never proves raw.','All price ranges and medians are withheld until exact identity, comparable grade/condition, provenance, units and minimum samples are established.','No product/language/printing crosswalk or commercial entitlement is assumed; no 30/90-day history is created from free-plan results.','No raw records, transaction IDs, source URLs, cursor values, seller details or response bodies are emitted or persisted.']};
}
async function main(){
 if(process.argv[2]==='dry-run'){console.log(JSON.stringify({status:'DRY_RUN_NO_REQUESTS',maximumRequests:3,maximumTotalRows:75,searches:CASES.map(c=>({test:c.id,q:c.q,filters:c.filters,limit:25,page:1}))}));return;}
 if(process.argv[2]!=='live')throw Error('invalid_mode');
 claimRun(process.env,COVERAGE_APPROVAL);
 const key=process.env.THE_CARD_API_KEY;const report=await runCoverage(key);
 console.log(redact(JSON.stringify(report,null,2),key));
 if(report.status!=='three_searches_completed')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Coverage benchmark stopped safely; no raw response or exception details logged.');process.exitCode=1;});

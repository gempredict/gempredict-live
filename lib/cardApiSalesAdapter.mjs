import { readCardApiSaleType } from './catalogSalesCrosswalk.mjs';
import { SALES_COHORTS } from './completedSales.mjs';

const endpoint='https://www.thecardapi.com/api/v1/market/sales';
export const CARD_API_SALES_ROW_LIMIT=20;
const rowLimit=CARD_API_SALES_ROW_LIMIT;
const byteLimit=131072;
const day=86400000;
const list=value=>Array.isArray(value)?value:[];
const platforms = ['ebay','tcgplayer','goldin','lelands','scp','hakes','rea','fanatics_collect','yahoo_japan'];
// Provider display names may differ in case from our canonical marketplace IDs.
// Case-fold ONLY recognized IDs: never turn an unknown name into an approved source.
const normalizePlatform = value => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : null;
  return platforms.includes(normalized) ? normalized : null;
};
const listingTypes = ['auction','fixed_price','best_offer'];
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const utcDay = time => new Date(time).toISOString().slice(0,10);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && utcDay(Date.parse(value)) === value ? value : null;
const label = (value,max=160) => typeof value === 'string' && value.length <= max && value.trim() &&
  !/[\u0000-\u001f\u007f]/.test(value) && !/https?:|(?:sk-|tca_|AIza)[a-z0-9_-]{12,}/i.test(value) ? value.trim() : null;
const money = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function buildQuery(input, now) {
  if (!plain(input) || Object.keys(input).some(key =>
    !['q','cohort','category','dateFrom','dateTo','priceMin','priceMax'].includes(key))) return null;
  const q = label(input.q,120), from = date(input.dateFrom), to = date(input.dateTo);
  if (!q || q.length < 4 || !/^[\p{L}\p{N} "#()'&+.,:/_-]+$/u.test(q) ||
      !SALES_COHORTS.includes(input.cohort) || !['sports','tcg','non_sport'].includes(input.category) ||
      !from || !to || from > to || from < utcDay(now - 29*day) || to > utcDay(now) ||
      Date.parse(to)-Date.parse(from)>2*day) return null;
  const url = new URL(endpoint);
  const params = new URLSearchParams({ q, category:input.category, date_from:from, date_to:to,
    graded:input.cohort === 'Raw' ? 'false' : 'true', sort:'date_desc', page:'1', limit:String(rowLimit) });
  if (input.cohort !== 'Raw') {
    params.set('grader','PSA');
    params.set('grade',input.cohort.slice(4));
  }
  for (const [name,key] of [['priceMin','price_min'],['priceMax','price_max']]) {
    if (input[name] === undefined || input[name] === '') continue;
    if (typeof input[name] !== 'string' || !/^\d{1,7}(?:\.\d{1,2})?$/.test(input[name])) return null;
    params.set(key,input[name]);
  }
  if (params.has('price_min') && params.has('price_max') &&
      Number(params.get('price_min')) > Number(params.get('price_max'))) return null;
  url.search = params.toString();
  return url;
}
class ResponseIssue extends Error {
  constructor(code, differences) { super(code); this.code = code; this.differences = differences; }
}
const type = value => value === undefined ? 'missing' : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
async function boundedJson(response) {
  if (Number(response.headers.get('content-length')) > byteLimit) throw new ResponseIssue('response_too_large');
  if (!response.body || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
    throw new ResponseIssue('schema_difference', [{ field:'response', expected:'application/json body', received:'other_or_missing' }]);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > byteLimit) { await reader.cancel(); throw new ResponseIssue('response_too_large'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks,length).toString('utf8')); }
  catch { throw new ResponseIssue('schema_difference', [{field:'response',expected:'JSON object',received:'invalid_json'}]); }
}
function parseCardApiWindow(body,input,key,target,unified,allowMissingPriceConfirmation,crosswalk) {
  const providerLabel = (value, max) => typeof value === 'string' && value.includes(key) ? null : label(value,max);
  const differences = [];
  function report(field,expected,value) {
    if (differences.length < 16) differences.push({ field,expected,received:type(value) });
  }
  if (!plain(body)) report('response','object',body);
  else {
    if (!Array.isArray(body.data)) report('data','array',body.data);
    if (!plain(body.pagination)) report('pagination','object',body.pagination);
    if (!plain(body.meta)) report('meta','object',body.meta);
  }
  if (differences.length) throw new ResponseIssue('schema_difference',differences);
  if (body.data.length > rowLimit) throw new ResponseIssue('row_budget_exceeded');
  const idCounts = new Map();
  for (const row of body.data) {
    const id = providerLabel(row?.id,128);
    if (id) idCounts.set(id,(idCounts.get(id)||0)+1);
  }
  const rows = [];
  let missingPriceConfirmation=0;
  for (const [index,row] of body.data.entries()) {
    if (!plain(row)) { report(`data[${index}]`,'object',row); continue; }
    // This is tested on the decoded upstream body, before any projection.
    const confirmationMissing=!Object.hasOwn(row,'price_confirmed');
    if(allowMissingPriceConfirmation&&confirmationMissing)missingPriceConfirmation++;
    for (const [key,expected,nullable] of [
      ['price','number',true],['price_confirmed','boolean',false],['shipping_price','number',true],
      ['grade','string',true],['grader','string',true],
    ]) {
      if (row[key] === undefined && ['grade','grader'].includes(key)) continue;
      if (key==='price_confirmed'&&allowMissingPriceConfirmation&&confirmationMissing) continue;
      if (!(nullable && row[key] === null) && typeof row[key] !== expected) report(`data[${index}].${key}`,expected+(nullable?' or null':''),row[key]);
    }
    if (differences.length) continue;
    const id = providerLabel(row.id,128), title = providerLabel(row.title,300), sold = date(row.sale_date);
    const grade = providerLabel(row.grade,24), grader = providerLabel(row.grader,24);
    const platform = normalizePlatform(row.platform);
    const listingType = listingTypes.includes(row.listing_type) ? row.listing_type : null;
    const transaction=crosswalk?readCardApiSaleType(listingType,row):null;
    const price = money(row.price), shipping = money(row.shipping_price);
    const currency = typeof row.currency==='string' && /^[A-Z]{3}$/.test(row.currency) ? row.currency : null;
    const reasons = [];
    if(transaction&&!transaction.usable)reasons.push('unsupported_sale_type');
    for (const [field,value] of [['id',id],['title',title],['platform',platform],['listing_type',listingType],['currency',currency]]) {
      if (value===null) reasons.push(field+'_'+(row[field]==null?'missing':typeof row[field]!=='string'?'invalid_type':'unsupported'));
    }
    if (!sold) reasons.push(row.sale_date==null?'sale_date_missing':'sale_date_invalid');
    else if (sold < input.dateFrom || sold > input.dateTo) reasons.push('outside_requested_date_range');
    if (row.category != null && row.category !== input.category) reasons.push('outside_requested_category');
    if (input.cohort !== 'Raw' && (grader?.toUpperCase() !== 'PSA' || grade !== input.cohort.slice(4) ||
        row.has_grade_qualifier === true || row.grade_qualifier)) reasons.push('grade_mismatch_or_qualifier');
    if (input.cohort === 'Raw' && grade) reasons.push('condition_grade_conflicts_with_raw_filter');
    if (row.price !== null && price === null || row.shipping_price !== null && shipping === null) reasons.push('invalid_amount');
    if (idCounts.get(id)>1) reasons.push('repeated_provider_record_id');
    const candidate = {
      index, id, title, platform, channel: providerLabel(row.sales_channel,48), listingType, sold,
      grader, grade, condition: providerLabel(row.condition,60), cardNumber:providerLabel(row.card_number,40),
      price:unified&&(row.price_confirmed!==true||!listingType||!currency||transaction?.usable===false)?null:price, currency, shipping,
      amountReportedConfirmed:allowMissingPriceConfirmation&&confirmationMissing?null:row.price_confirmed === true && price !== null && transaction?.usable!==false,
      ...(transaction?{transactionType:transaction.transactionType,saleTypeBasis:transaction.saleTypeBasis}:{}),
      ...(allowMissingPriceConfirmation?{priceConfirmationStatus:confirmationMissing?'unknown':
        row.price_confirmed?'reported_confirmed':'reported_unconfirmed'}:{}),
      ...(target?{
        year:Number.isInteger(row.year)&&row.year>=1900&&row.year<=2099?String(row.year):null,
        set:providerLabel(row.card_set,100),manufacturer:providerLabel(row.manufacturer,80),
        player:providerLabel(row.player,160),printRun:Number.isSafeInteger(row.print_run)&&row.print_run>0?String(row.print_run):null,
      }:{}),
    };
    rows.push({ ...candidate,reasons });
  }
  if (differences.length) throw new ResponseIssue('schema_difference',differences);
  return {rows,
    ...(allowMissingPriceConfirmation?{missingPriceConfirmation}:{}),
    coverage:{from:date(body.meta.coverage_date_from),to:date(body.meta.coverage_date_to),
      reportedTotal:integer(body.pagination.total),hasMore:typeof body.pagination.has_more==='boolean'?body.pagination.has_more:null},
  };
}

const errorByStatus = { 401:'provider_authentication',403:'provider_entitlement',422:'provider_validation',429:'provider_quota' };
const safeQuota = (headers,key) => {
  const value = headers.get(key);
  return typeof value === 'string' && /^\d{1,16}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ? value : null;
};
export async function readCardApiWindow({input,now,key,target,fetchImpl,signal,unified,allowMissingPriceConfirmation=false,crosswalk=false}) {
 const url=buildQuery(input,now);
 if(!url)return {status:400,error:'invalid_query'};
 try {
  const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json','x-market-api-key':key},
   cache:'no-store',redirect:'error',signal});
  const quota={limit:safeQuota(response.headers,'X-RateLimit-Limit'),remaining:safeQuota(response.headers,'X-RateLimit-Remaining'),
   reset:safeQuota(response.headers,'X-RateLimit-Reset')};
  if(!response.ok){
   await response.body?.cancel();
   return {status:response.status===429?429:502,error:errorByStatus[response.status]||'provider_unavailable',quota};
  }
  const batch=parseCardApiWindow(await boundedJson(response),input,key,target,unified,allowMissingPriceConfirmation,crosswalk);
  return {batch,quota};
 }catch(error){
  const safe=error instanceof ResponseIssue;
  return {status:signal.aborted?504:502,error:signal.aborted?'provider_timeout':safe?error.code:'provider_unavailable',
   ...(safe&&error.differences?{differences:error.differences}:{})};
 }
}

// Reviewed mapping for the Free-tier response. Provider result IDs are not
// transaction IDs. A missing numeric grade never establishes Raw.
export function freeResearchSale(row,retrievedAt) {
 const grade=row.identityMatch?.gradeEvidence;
 const missingConfirmation=row.priceConfirmationStatus==='unknown';
 const priceConfirmed=missingConfirmation?null:row.amountReportedConfirmed;
 const transactionType=row.saleTypeBasis?row.transactionType:row.listingType==='best_offer'?'accepted_offer':row.listingType;
 const titleGrade=grade?.label?.match(/^([A-Z]+) (\d+(?:\.\d)?)$/);
 const explicitMismatch=reason=>/^(?:identity_.*_mismatch|outside_requested_(?:date_range|category)|condition_grade_conflicts_with_raw_filter|repeated_provider_record_id)$/.test(reason)||
  (reason==='grade_mismatch_or_qualifier'&&grade?.status==='mismatch');
 const numeric=typeof row.grade==='string'&&/^\d{1,2}(?:\.\d)?$/.test(row.grade)?Number(row.grade):titleGrade?Number(titleGrade[2]):null;
 return {provider:'the_card_api',providerRecordId:row.id,source:{marketplace:row.platform},
  status:'completed',transactionType,listingType:row.listingType,saleTypeBasis:row.saleTypeBasis,
  priceConfirmed,finalOfferPriceConfirmed:missingConfirmation?null:transactionType==='accepted_offer'&&priceConfirmed,
  reportedAmount:row.price==null?null:{value:row.price,unit:'major',currency:row.currency,basis:'unknown'},
  saleDate:row.sold,retrievedAt,grading:{
   status:grade?.label==='Listed as Raw'?'raw':numeric!==null||row.grader||grade?.label?.startsWith('Graded')?'graded':'unknown',
   provider:row.grader||titleGrade?.[1],grade:numeric,
  },
  listingIdentityStatus:row.identityMatch?.status,identityContradictions:row.identityMatch?.mismatches,
  identityMissing:row.identityMatch?.unknown,
  identity:{subject:row.player||null,year:row.year||null,set:row.set||null,collectorNumber:row.cardNumber||null,printRun:row.printRun||null},
  rejectionReasons:list(row.reasons).filter(explicitMismatch),incompleteReasons:[...list(row.reasons).filter(reason=>!explicitMismatch(reason)),
   ...(missingConfirmation?['provider_price_confirmation_missing']:[])]};
}

export const cardApiSalesAdapter=Object.freeze({
 id:'the_card_api',buildQuery,readWindow:readCardApiWindow,normalize:freeResearchSale,
});

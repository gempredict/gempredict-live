import { compareScanSale, prepareScanSalesQuery } from './scanToSalesIdentity.mjs';
import { libraryConfiguration, libraryOwner, readOwnedSavedReport } from './savedReportsServer.mjs';
import { qualifyCompletedSales, SALES_COHORTS } from './completedSales.mjs';
import { diagnosticDeployment, diagnosticSession } from './scanDiagnosticsAuth.mjs';

const endpoint = 'https://www.thecardapi.com/api/v1/market/sales';
const manualBranch = 'feature/cardapi-sales-pilot-phase5d';
const savedBranch = 'feature/scan-to-sales-phase5e';
const recallBranch = 'feature/sales-search-recall-phase5f';
const normalizeBranch = 'feature/marketplace-normalization-phase5f1';
const savedBranches = [savedBranch,recallBranch,normalizeBranch];
const rowLimit = 20;
const byteLimit = 131072;
const timeoutMs = 6000;
const day = 86400000;
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

export function cardApiPilotPage(req, env = process.env, now = Date.now()) {
  if (![manualBranch,...savedBranches].includes(env.VERCEL_GIT_COMMIT_REF) || env.GEMPREDICT_CARD_API_FREE_PILOT_ENABLED !== 'true' ||
      !diagnosticDeployment(req,env)) return null;
  return { today: utcDay(now), earliest: utcDay(now - 29 * day),
    ...(savedBranches.includes(env.VERCEL_GIT_COMMIT_REF)?{savedIdentity:true}:{}) };
}
function buildQuery(input, now) {
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
function projectResults(body,input,now,key,target) {
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
  const candidates = [], rejected = [], evidence = [];
  for (const [index,row] of body.data.entries()) {
    if (!plain(row)) { report(`data[${index}]`,'object',row); continue; }
    for (const [key,expected,nullable] of [
      ['price','number',true],['price_confirmed','boolean',false],['shipping_price','number',true],
      ['grade','string',true],['grader','string',true],
    ]) {
      if (row[key] === undefined && ['grade','grader'].includes(key)) continue;
      if (!(nullable && row[key] === null) && typeof row[key] !== expected) report(`data[${index}].${key}`,expected+(nullable?' or null':''),row[key]);
    }
    if (differences.length) continue;
    const id = providerLabel(row.id,128), title = providerLabel(row.title,300), sold = date(row.sale_date);
    const grade = providerLabel(row.grade,24), grader = providerLabel(row.grader,24);
    const platform = normalizePlatform(row.platform);
    const listingType = listingTypes.includes(row.listing_type) ? row.listing_type : null;
    const price = money(row.price), shipping = money(row.shipping_price);
    const currency = /^[A-Z]{3}$/.test(row.currency) ? row.currency : null;
    const reasons = [];
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
      price, currency, shipping, amountReportedConfirmed:row.price_confirmed === true && price !== null,
      ...(target?{
        year:Number.isInteger(row.year)&&row.year>=1900&&row.year<=2099?String(row.year):null,
        set:providerLabel(row.card_set,100),manufacturer:providerLabel(row.manufacturer,80),
        player:providerLabel(row.player,160),printRun:Number.isSafeInteger(row.print_run)&&row.print_run>0?String(row.print_run):null,
      }:{}),
    };
    if(target){
      candidate.identityMatch=compareScanSale(target,candidate,input.cohort);
      if(candidate.identityMatch.status==='mismatch')reasons.push(...candidate.identityMatch.mismatches.map(field=>'identity_'+field+'_mismatch'));
      if(reasons.length&&candidate.identityMatch.status==='exact_listing_evidence')candidate.identityMatch.status='plausible_unverified';
    }
    if (reasons.length) rejected.push({ ...candidate,reasons });
    else candidates.push(candidate);
    // Only documented facts cross the qualifier boundary. No policy, reviewed
    // mapping, source transaction ID, quantity, settlement or price basis is inferred.
    evidence.push({
      provider:'the_card_api',providerRecordId:id,source:{marketplace:platform},saleDate:sold,
      retrievedAt:new Date(now).toISOString(),
      transactionType:listingType === 'best_offer' ? 'accepted_offer' : listingType,
      priceConfirmed:candidate.amountReportedConfirmed,
      finalOfferPriceConfirmed:listingType === 'best_offer' && candidate.amountReportedConfirmed,
    });
  }
  if (differences.length) throw new ResponseIssue('schema_difference',differences);
  const qualified = qualifyCompletedSales(evidence,{now:new Date(now).toISOString(),windowDays:30,maxRows:rowLimit,
    coverage:{complete:false,lookbackDays:30,reportedTotal:integer(body.pagination.total)}});
  const byIndex = new Map(qualified.quarantined.map(row=>[row.index,row.reasons]));
  return {
    candidates:candidates.map(row=>({...row,qualificationReasons:byIndex.get(row.index)||[]})),
    rejected, qualifiedCount:qualified.qualified.length, cohort:input.cohort,
    coverage:{from:date(body.meta.coverage_date_from),to:date(body.meta.coverage_date_to),
      reportedTotal:integer(body.pagination.total),hasMore:typeof body.pagination.has_more==='boolean'?body.pagination.has_more:null},
  };
}

const errorByStatus = { 401:'provider_authentication',403:'provider_entitlement',422:'provider_validation',429:'provider_quota' };
const safeQuota = (headers,key) => {
  const value = headers.get(key);
  return typeof value === 'string' && /^\d{1,16}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ? value : null;
};
async function loadSavedForSales(req,id,env) {
  const config=libraryConfiguration(env);
  if(!config) return {status:503,error:'library_unavailable'};
  const owner=await libraryOwner(req,config);
  if(!owner) return {status:401,error:'library_sign_in_required'};
  return readOwnedSavedReport(owner,id);
}
export function createCardApiPilotHandler({env=process.env,fetchImpl=fetch,clock=Date.now,loadSaved=loadSavedForSales}={}) {
  let inFlight = false;
  return async (req,res) => {
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    res.setHeader('Vary','Cookie, Origin, Authorization');
    res.setHeader('X-Content-Type-Options','nosniff');
    const now = clock();
    if (!cardApiPilotPage(req,env,now)) return res.status(404).json({error:'pilot_unavailable'});
    if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
    if (!diagnosticSession(req,env,now)) return res.status(403).json({error:'owner_authorization_required'});
    const key = env.THE_CARD_API_KEY;
    if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) return res.status(503).json({error:'pilot_key_missing'});
    if (inFlight) return res.status(429).json({error:'pilot_busy'});
    inFlight = true;
    let signal;
    try {
      let input=req.body;
      let target;
      if(savedBranches.includes(env.VERCEL_GIT_COMMIT_REF)){
        if(!plain(input)||Object.keys(input).some(field=>!['reportId','reviewedIdentity','confirmed','cohort','dateFrom','dateTo','priceMin','priceMax'].includes(field))||
            typeof input.reportId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.reportId)) {
          return res.status(400).json({error:'invalid_query'});
        }
        let selected;
        try { selected=await loadSaved(req,input.reportId,env); }
        catch { return res.status(503).json({error:'library_unavailable'}); }
        if(!selected.report) return res.status(selected.status).json({error:selected.error});
        const prepared=prepareScanSalesQuery(selected.report.payload,input.reviewedIdentity,input.confirmed);
        if(prepared.error) return res.status(400).json({error:prepared.error});
        const {cohort,dateFrom,dateTo,priceMin,priceMax}=input;
        input={cohort,dateFrom,dateTo,priceMin,priceMax,q:prepared.q,category:prepared.category};
        target=prepared.identity;
      }
      const url=buildQuery(input,now);
      if (!url) return res.status(400).json({error:'invalid_query'});
      signal=AbortSignal.timeout(timeoutMs);
      const response = await fetchImpl(url,{method:'GET',headers:{Accept:'application/json','x-market-api-key':key},
        cache:'no-store',redirect:'error',signal});
      const quota = { limit:safeQuota(response.headers,'X-RateLimit-Limit'),
        remaining:safeQuota(response.headers,'X-RateLimit-Remaining'),reset:safeQuota(response.headers,'X-RateLimit-Reset') };
      if (!response.ok) {
        await response.body?.cancel();
        return res.status(response.status===429?429:502).json({error:errorByStatus[response.status]||'provider_unavailable',quota});
      }
      const results = projectResults(await boundedJson(response),input,now,key,target);
      return res.status(200).json({...results,quota,...(target?{query:input.q}:{})});
    } catch (error) {
      const safe = error instanceof ResponseIssue;
      return res.status(signal?.aborted?504:502).json({
        error:signal?.aborted?'provider_timeout':safe?error.code:'provider_unavailable',
        ...(safe&&error.differences?{differences:error.differences}:{}),
      });
    } finally { inFlight=false; }
  };
}

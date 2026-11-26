import { catalogPreviewBranches } from './catalogPreviewConfiguration.mjs';
import { evaluateCatalogSalesCrosswalk,readCardApiSaleType } from './catalogSalesCrosswalk.mjs';
import { gradingEconomicsReadiness } from './gradingEconomics.mjs';
import { createHash } from 'node:crypto';
import { planSalesWindows, describeLookback, LOOKBACK_BATCH_SIZE } from './salesLookback.mjs';
import { evaluateComparableSales, freeResearchSale } from './comparableSalesEvidence.mjs';
import { compareScanSale, prepareScanSalesQuery } from './scanToSalesIdentity.mjs';
import { libraryConfiguration, libraryOwner, readOwnedSavedReport } from './savedReportsServer.mjs';
import { qualifyCompletedSales, SALES_COHORTS } from './completedSales.mjs';
import { diagnosticDeployment, diagnosticSession, issueSalesContinuation, readSalesContinuation } from './scanDiagnosticsAuth.mjs';

const endpoint = 'https://www.thecardapi.com/api/v1/market/sales';
const manualBranch = 'feature/cardapi-sales-pilot-phase5d';
const savedBranch = 'feature/scan-to-sales-phase5e';
const recallBranch = 'feature/sales-search-recall-phase5f';
const normalizeBranch = 'feature/marketplace-normalization-phase5f1';
export const unifiedMarketBranch = 'feature/unified-market-evidence-phase5g';
export const collectorDashboardBranch = 'feature/collector-dashboard-phase5i';
export const catalogFoundationBranch = 'feature/catalog-evidence-foundation-phase5j';
export const comparablesBranch = 'feature/qualified-market-comparables-phase5k';
export const salesLookbackBranch='feature/sales-lookback-phase5k1';
export const gradingEconomicsBranch='feature/grading-economics-foundation-phase5l';
export const priceConfirmationRepairBranch='fix/cardapi-price-confirmed-schema-phase5l2';
export const crosswalkBranch='feature/catalog-sales-crosswalk-phase5m';
const lookbackBranches=[salesLookbackBranch,gradingEconomicsBranch,priceConfirmationRepairBranch,crosswalkBranch,...catalogPreviewBranches];
const unifiedBranches = [unifiedMarketBranch,'feature/variation-match-accuracy-phase5h',collectorDashboardBranch,catalogFoundationBranch,comparablesBranch,...lookbackBranches];
const savedBranches = [savedBranch,recallBranch,normalizeBranch,...unifiedBranches];
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
  return { ...(lookbackBranches.includes(env.VERCEL_GIT_COMMIT_REF)?{lookback:true}:{}), today: utcDay(now), earliest: utcDay(now - 29 * day),
    ...(unifiedBranches.includes(env.VERCEL_GIT_COMMIT_REF)?{unified:true}:{}),
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
function projectResults(body,input,now,key,target,unified,allowMissingPriceConfirmation,crosswalk) {
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
    if(target){
      candidate.identityMatch=compareScanSale(target,candidate,input.cohort,{strictTitle:unified});
      if(candidate.identityMatch.status==='mismatch')reasons.push(...candidate.identityMatch.mismatches.map(field=>'identity_'+field+'_mismatch'));
      if(reasons.length&&candidate.identityMatch.status==='exact_listing_evidence')candidate.identityMatch.status='plausible_unverified';
    }
    if (reasons.length) rejected.push({ ...candidate,reasons });
    else candidates.push(candidate);
    // Only documented facts cross the qualifier boundary. No policy, reviewed
    // mapping, source transaction ID, quantity, settlement or price basis is inferred.
    const transactionType=transaction?transaction.transactionType:listingType==='best_offer'?'accepted_offer':listingType;
    evidence.push({
      provider:'the_card_api',providerRecordId:id,source:{marketplace:platform},saleDate:sold,
      retrievedAt:new Date(now).toISOString(),
      transactionType,
      priceConfirmed:candidate.amountReportedConfirmed,
      finalOfferPriceConfirmed:transactionType==='accepted_offer'&&candidate.amountReportedConfirmed,
    });
  }
  if (differences.length) throw new ResponseIssue('schema_difference',differences);
  const qualified = qualifyCompletedSales(evidence,{now:new Date(now).toISOString(),windowDays:30,maxRows:rowLimit,
    coverage:{complete:false,lookbackDays:30,reportedTotal:integer(body.pagination.total)}});
  const byIndex = new Map(qualified.quarantined.map(row=>[row.index,row.reasons]));
  return {
    candidates:candidates.map(row=>({...row,qualificationReasons:byIndex.get(row.index)||[]})),
    rejected:unified?rejected.map(row=>({...row,qualificationReasons:byIndex.get(row.index)||[]})):rejected, qualifiedCount:qualified.qualified.length, cohort:input.cohort,
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
export async function loadSavedForSales(req,id,env) {
  const config=libraryConfiguration(env);
  if(!config) return {status:503,error:'library_unavailable'};
  const owner=await libraryOwner(req,config);
  if(!owner) return {status:401,error:'library_sign_in_required'};
  return readOwnedSavedReport(owner,id);
}
function qualifyResearch(results,identityEvidence,cohort,now,maxRows,crosswalk) {
 const links=new Map((crosswalk?.rows||[]).map(row=>[row.index,row]));
 return evaluateComparableSales(
  [...results.candidates,...results.rejected].sort((a,b)=>a.index-b.index).map(row=>{
   const record=freeResearchSale(row,new Date(now).toISOString());
   const link=links.get(row.index);
   if(link){
    if(link.status!=='sale_linked_to_exact_catalog_variant')record.incompleteReasons.push('reviewed_exact_sale_catalog_link_missing');
    if(link.contradictions.includes('catalog_variant'))record.rejectionReasons.push('identity_catalog_variant_mismatch');
   }
   return record;
  }),
  {identityEvidence,cohort,now:new Date(now).toISOString(),maxRows,scope:'free_research',
   coverage:{complete:false,lookbackDays:30,reportedTotal:results.coverage?.reportedTotal}});
}

async function readWindow({input,now,key,target,fetchImpl,signal,unified,allowMissingPriceConfirmation=false,crosswalk=false}) {
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
  const batch=projectResults(await boundedJson(response),input,now,key,target,unified,allowMissingPriceConfirmation,crosswalk);
  return {batch,quota};
 }catch(error){
  const safe=error instanceof ResponseIssue;
  return {status:signal.aborted?504:502,error:signal.aborted?'provider_timeout':safe?error.code:'provider_unavailable',
   ...(safe&&error.differences?{differences:error.differences}:{})};
 }
}

export function createCardApiPilotHandler({env=process.env,fetchImpl=fetch,clock=Date.now,loadSaved=loadSavedForSales}={}) {
  let inFlight = false;
  // Per-instance admission metadata only. The provider enforces its account
  // quota across instances. No provider rows or coverage are retained here.
  let attempts=[];
  let lastBatch=-Infinity;
  const usedCursors=new Map();
  return async (req,res) => {
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    res.setHeader('Vary','Cookie, Origin, Authorization');
    res.setHeader('X-Content-Type-Options','nosniff');
    const now = clock();
    if (!cardApiPilotPage(req,env,now)) return res.status(404).json({error:'pilot_unavailable'});
    if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
    const session=diagnosticSession(req,env,now);
    if (!session) return res.status(403).json({error:'owner_authorization_required'});
    const key = env.THE_CARD_API_KEY;
    if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) return res.status(503).json({error:'pilot_key_missing'});
    if (inFlight) return res.status(429).json({error:'pilot_busy'});
    inFlight = true;
    const lookback=lookbackBranches.includes(env.VERCEL_GIT_COMMIT_REF);
    try {
      let input=req.body;
      let target, identityEvidence;
      const {continuation,reportId}=input||{};
      if(savedBranches.includes(env.VERCEL_GIT_COMMIT_REF)){
        if(!plain(input)||Object.keys(input).some(field=>!['reportId','reviewedIdentity','confirmed','cohort','dateFrom','dateTo','priceMin','priceMax',...(lookback?['continuation']:[])].includes(field))||
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
        if([catalogFoundationBranch,comparablesBranch,...lookbackBranches].includes(env.VERCEL_GIT_COMMIT_REF)) identityEvidence=prepared.identityEvidence;
      }
      if(!lookback){
       const {batch,quota,status,...failure}=await readWindow({input,now,key,target,fetchImpl,
        signal:AbortSignal.timeout(timeoutMs),unified:unifiedBranches.includes(env.VERCEL_GIT_COMMIT_REF)});
       if(!batch)return res.status(status).json({...failure,...(quota?{quota}:{})});
       const comparableEvidence=env.VERCEL_GIT_COMMIT_REF===comparablesBranch?qualifyResearch(batch,identityEvidence,input.cohort,now,rowLimit):null;
       return res.status(200).json({...batch,...(comparableEvidence?{comparableEvidence}:{}),quota,
        ...(target?{query:input.q}:{}),...(identityEvidence?{identityEvidence}:{})});
      }
      const hash=value=>createHash('sha256').update(value).digest('hex');
      const binding=hash(JSON.stringify([reportId,target,input.cohort,input.priceMin||null,input.priceMax||null]));
      const state=continuation===undefined?{binding,startedAt:now,history:[]}:
       readSalesContinuation(session,continuation,now);
      if(!state||state.binding!==binding||!Number.isFinite(state.startedAt)||state.startedAt>now||
         now-state.startedAt>=300000||!Array.isArray(state.history)||state.history.length>=10)
       return res.status(400).json({error:'invalid_sales_continuation'});
      const windows=planSalesWindows(state.startedAt);
      const start=state.history.length;
      const cursorId=continuation?hash(continuation):null;
      const admittedAt=clock();
      attempts=attempts.filter(time=>time>admittedAt-300000);
      for(const [id,until] of usedCursors)if(until<=admittedAt)usedCursors.delete(id);
      if(cursorId&&usedCursors.has(cursorId))return res.status(409).json({error:'invalid_sales_continuation'});
      if(admittedAt-lastBatch<2000||attempts.length>=10)return res.status(429).json({error:'lookback_rate_limit'});
      if(!buildQuery({...input,...windows[start]},admittedAt))return res.status(400).json({error:'invalid_query'});
      if(!diagnosticSession(req,env,admittedAt))return res.status(403).json({error:'owner_authorization_required'});
      lastBatch=admittedAt;
      if(cursorId)usedCursors.set(cursorId,state.startedAt+300000);
      const candidates=[],rejected=[];
      const history=[...state.history];
      const deadline=AbortSignal.timeout(10000);
      let stopped=null,quota=null,differences,offset=0,firstRemaining=null;
      for(const window of windows.slice(start,start+LOOKBACK_BATCH_SIZE)){
       const current=clock();
       if(deadline.aborted||!diagnosticSession(req,env,current)){
        stopped=deadline.aborted?'provider_timeout':'owner_authorization_required';
        break;
       }
       if(attempts.length>=10){stopped='lookback_rate_limit';break;}
       if(!buildQuery({...input,...window},current)){stopped='invalid_query';break;}
       attempts.push(current);
       const result=await readWindow({input:{...input,...window},now:current,key,target,fetchImpl,unified:true,
        allowMissingPriceConfirmation:[priceConfirmationRepairBranch,crosswalkBranch,...catalogPreviewBranches].includes(env.VERCEL_GIT_COMMIT_REF),
        crosswalk:[crosswalkBranch,...catalogPreviewBranches].includes(env.VERCEL_GIT_COMMIT_REF),
        signal:AbortSignal.any([deadline,AbortSignal.timeout(Math.min(timeoutMs,Math.max(1,session.exp-current)))])});
       if(result.quota){
        quota=result.quota;
        if(firstRemaining===null&&quota.remaining!==null&&/^\d+$/.test(quota.remaining))firstRemaining=Number(quota.remaining);
       }
       if(!result.batch){
        history.push({...window,status:'failed',reason:result.error});
        stopped=result.error;
        differences=result.differences;
        break;
       }
       const batch=result.batch;
       const count=batch.candidates.length+batch.rejected.length;
       const truncated=batch.coverage.hasMore!==false||
        (batch.coverage.reportedTotal!==null&&batch.coverage.reportedTotal>count);
       history.push({...window,status:count?'successful':'empty',count,truncated,...(batch.missingPriceConfirmation?{missingPriceConfirmation:batch.missingPriceConfirmation}:{})});
       const withWindow=row=>({...row,index:row.index+offset,window});
       candidates.push(...batch.candidates.map(withWindow));
       rejected.push(...batch.rejected.map(withWindow));
       offset+=count;
       if(quota?.remaining!==null&&quota?.remaining!==undefined&&Number(quota.remaining)===0){stopped='provider_quota';break;}
      }
      const ended=clock();
      if(ended>=session.exp)return res.status(403).json({error:'owner_authorization_required'});
      const next=!stopped&&history.length<windows.length&&ended<state.startedAt+300000?
       issueSalesContinuation(session,{...state,history},ended):null;
      const coverage={...describeLookback(windows,history,stopped),expiresAt:Math.min(session.exp,state.startedAt+300000)};
      const projected={candidates,rejected,qualifiedCount:0,cohort:input.cohort};
      const quotaDelta=firstRemaining!==null&&quota?.remaining!==null&&/^\d+$/.test(quota?.remaining||'')?
       Math.max(0,firstRemaining-Number(quota.remaining)):null;
      const crosswalk=[crosswalkBranch,...catalogPreviewBranches].includes(env.VERCEL_GIT_COMMIT_REF)?
       evaluateCatalogSalesCrosswalk({proposal:target,sales:[...candidates,...rejected]}):null;
      const comparableEvidence=qualifyResearch(projected,identityEvidence,input.cohort,now,rowLimit*LOOKBACK_BATCH_SIZE,crosswalk);
      const payload={...projected,...(crosswalk?{crosswalk}:{}),comparableEvidence,query:input.q,identityEvidence,lookback:coverage,continuation:next,
       quota,quotaDelta,...([gradingEconomicsBranch,priceConfirmationRepairBranch,crosswalkBranch,...catalogPreviewBranches].includes(env.VERCEL_GIT_COMMIT_REF)?
        {economicsReadiness:gradingEconomicsReadiness({identityEvidence,comparables:comparableEvidence})}:{}),...(differences?{differences}:{})};
      if(Buffer.byteLength(JSON.stringify(payload))>524288)return res.status(502).json({error:'response_too_large'});
      return res.status(200).json(payload);
    } catch {
      return res.status(502).json({error:'provider_unavailable'});
    } finally { inFlight=false; }
  };
}

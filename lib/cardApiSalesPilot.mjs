import { catalogPreviewBranches } from './catalogPreviewConfiguration.mjs';
import { evaluateCatalogSalesCrosswalk } from './catalogSalesCrosswalk.mjs';
import { gradingEconomicsReadiness } from './gradingEconomics.mjs';
import { createHash } from 'node:crypto';
import { planSalesWindows, describeLookback, LOOKBACK_BATCH_SIZE } from './salesLookback.mjs';
import { CARD_API_SALES_ROW_LIMIT } from './cardApiSalesAdapter.mjs';
import { salesProviderRegistry,salesIntelligenceBranch,readProviderWindow,evaluateSalesIntelligence } from './salesIntelligence.mjs';
import { prepareScanSalesQuery } from './scanToSalesIdentity.mjs';
import { libraryConfiguration, libraryOwner, readOwnedSavedReport } from './savedReportsServer.mjs';
import { diagnosticDeployment, diagnosticSession, issueSalesContinuation, readSalesContinuation } from './scanDiagnosticsAuth.mjs';

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
const rowLimit=CARD_API_SALES_ROW_LIMIT;
const timeoutMs = 6000;
const providerPolicy=salesProviderRegistry.providers[salesProviderRegistry.primary];
const adapter=providerPolicy.adapter;
const day = 86400000;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const utcDay=time=>new Date(time).toISOString().slice(0,10);

export function cardApiPilotPage(req, env = process.env, now = Date.now()) {
  if (![manualBranch,...savedBranches].includes(env.VERCEL_GIT_COMMIT_REF) || !providerPolicy.enabled || env.GEMPREDICT_CARD_API_FREE_PILOT_ENABLED !== 'true' ||
      !diagnosticDeployment(req,env)) return null;
  return { ...(lookbackBranches.includes(env.VERCEL_GIT_COMMIT_REF)?{lookback:true}:{}), today: utcDay(now), earliest: utcDay(now - 29 * day),
    ...(unifiedBranches.includes(env.VERCEL_GIT_COMMIT_REF)?{unified:true}:{}),
    ...(savedBranches.includes(env.VERCEL_GIT_COMMIT_REF)?{savedIdentity:true}:{}) };
}
export async function loadSavedForSales(req,id,env) {
  const config=libraryConfiguration(env);
  if(!config) return {status:503,error:'library_unavailable'};
  const owner=await libraryOwner(req,config);
  if(!owner) return {status:401,error:'library_sign_in_required'};
  return readOwnedSavedReport(owner,id);
}
function qualifyResearch(results,identityEvidence,cohort,now,maxRows,crosswalk,stopped) {
 return evaluateSalesIntelligence([{provider:adapter.id,
  rows:[...results.candidates,...results.rejected].sort((a,b)=>a.index-b.index)},
   ...(stopped?[{provider:adapter.id,error:stopped}]:[])],{
  registry:salesProviderRegistry,identityEvidence,cohort,now:new Date(now).toISOString(),maxRows,crosswalk,
  coverage:{complete:false,lookbackDays:30,reportedTotal:results.coverage?.reportedTotal},
 });
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
    const key = env[salesProviderRegistry.providers[salesProviderRegistry.primary].credentialEnv];
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
       const {batch,quota,status,...failure}=await readProviderWindow(adapter,{input,now,key,target,fetchImpl,
        signal:AbortSignal.timeout(timeoutMs),unified:unifiedBranches.includes(env.VERCEL_GIT_COMMIT_REF)});
       if(!batch)return res.status(status).json({...failure,...(quota?{quota}:{})});
       const comparableEvidence=env.VERCEL_GIT_COMMIT_REF===comparablesBranch?qualifyResearch(batch,identityEvidence,input.cohort,now,rowLimit).comparableEvidence:null;
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
      if(admittedAt-lastBatch<providerPolicy.cooldownMs||attempts.length>=providerPolicy.maxRequestsPerFiveMinutes)return res.status(429).json({error:'lookback_rate_limit'});
      if(!adapter.buildQuery({...input,...windows[start]},admittedAt))return res.status(400).json({error:'invalid_query'});
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
       if(attempts.length>=providerPolicy.maxRequestsPerFiveMinutes){stopped='lookback_rate_limit';break;}
       if(!adapter.buildQuery({...input,...window},current)){stopped='invalid_query';break;}
       attempts.push(current);
       const result=await readProviderWindow(adapter,{input:{...input,...window},now:current,key,target,fetchImpl,unified:true,
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
      const {comparableEvidence,summary}=qualifyResearch(projected,identityEvidence,input.cohort,now,rowLimit*LOOKBACK_BATCH_SIZE,crosswalk,stopped);
      const payload={...projected,...(env.VERCEL_GIT_COMMIT_REF===salesIntelligenceBranch?{salesIntelligence:summary}:{}),...(crosswalk?{crosswalk}:{}),comparableEvidence,query:input.q,identityEvidence,lookback:coverage,continuation:next,
       quota,quotaDelta,...([gradingEconomicsBranch,priceConfirmationRepairBranch,crosswalkBranch,...catalogPreviewBranches].includes(env.VERCEL_GIT_COMMIT_REF)?
        {economicsReadiness:gradingEconomicsReadiness({identityEvidence,comparables:comparableEvidence})}:{}),...(differences?{differences}:{})};
      if(Buffer.byteLength(JSON.stringify(payload))>524288)return res.status(502).json({error:'response_too_large'});
      return res.status(200).json(payload);
    } catch {
      return res.status(502).json({error:'provider_unavailable'});
    } finally { inFlight=false; }
  };
}

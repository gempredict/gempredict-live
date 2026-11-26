import { liveCatalogBranch } from './catalogPreviewConfiguration.mjs';
import { cardApiPilotPage, loadSavedForSales, catalogFoundationBranch, comparablesBranch, salesLookbackBranch, gradingEconomicsBranch, priceConfirmationRepairBranch, crosswalkBranch } from './cardApiSalesPilot.mjs';
import { deduplicateBrowseListings, safeEbayListingUrl } from './ebayListingProvenance.mjs';
import { fetchBrowsePage } from './marketIdentityEvidence.mjs';
import { diagnosticSession } from './scanDiagnosticsAuth.mjs';
import { compareScanSale, prepareScanSalesQuery } from './scanToSalesIdentity.mjs';
import { unofficialReasons } from './cardAuthenticity.mjs';
import { SALES_COHORTS } from './completedSales.mjs';

const limit = 20;

export function createActiveMarketHandler({env=process.env,fetchImpl=fetch,clock=Date.now,loadSaved=loadSavedForSales}={}) {
  let inFlight=false;
  return async (req,res) => {
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    res.setHeader('Vary','Cookie, Origin, Authorization');
    res.setHeader('X-Content-Type-Options','nosniff');
    const now=clock();
    if (!cardApiPilotPage(req,env,now)?.unified) return res.status(404).json({error:'pilot_unavailable'});
    if (req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
    if (!diagnosticSession(req,env,now)) return res.status(403).json({error:'owner_authorization_required'});
    const body=req.body;
    if (!body || typeof body!=='object' || Array.isArray(body) ||
        Object.keys(body).some(key=>!['reportId','reviewedIdentity','confirmed','cohort'].includes(key)) ||
        typeof body.reportId!=='string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.reportId) ||
        !SALES_COHORTS.includes(body.cohort)) return res.status(400).json({error:'invalid_query'});
    if (inFlight) return res.status(429).json({error:'ebay_busy'});
    inFlight=true;
    let signal;
    try {
      const selected=await loadSaved(req,body.reportId,env);
      if (!selected.report) return res.status(selected.status).json({error:selected.error});
      const prepared=prepareScanSalesQuery(selected.report.payload,body.reviewedIdentity,body.confirmed);
      if (prepared.error) return res.status(400).json({error:prepared.error});
      const clientId=env.EBAY_PROD_CLIENT_ID, clientSecret=env.EBAY_PROD_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(503).json({error:'ebay_not_configured'});
      signal=AbortSignal.timeout(6000);
      const browse=await fetchBrowsePage(prepared.q,{clientId,clientSecret,fetchImpl,signal,limit,maxBytes:262144});
      if (browse.error) return res.status(browse.status===429?429:502).json({error:browse.status===429?'ebay_quota':'ebay_unavailable'});
      const raw=browse.data?.itemSummaries ?? (browse.data?.total===0?[]:null);
      if (!Array.isArray(raw) || raw.length>limit || raw.some(item=>!item || typeof item.title!=='string' || item.title.length>300 ||
          item.title.includes(clientSecret) || item.title.includes(clientId))) {
        return res.status(502).json({error:'ebay_invalid_response'});
      }
      const {items,duplicateCount,conflictingDuplicateCount}=deduplicateBrowseListings(raw);
      const rows=items.map(item=>{
        const condition=typeof item.condition==='string'?item.condition:'';
        const identityMatch=compareScanSale(prepared.identity,{title:item.title,condition},body.cohort,{strictTitle:true});
        const exclusions=unofficialReasons(item).map(result=>result.reason);
        if (exclusions.length) {
          identityMatch.status='mismatch';
          identityMatch.mismatches.push('unofficial_printing');
        }
        const amount=item.price?.value;
        const currency=item.price?.currency;
        const ask=Array.isArray(item.buyingOptions) && item.buyingOptions.includes('FIXED_PRICE') && typeof amount==='string' &&
          /^\d{1,10}(?:\.\d{1,4})?$/.test(amount) && Number(amount)>0 &&
          typeof currency==='string' && /^[A-Z]{3}$/.test(currency) ? {amount,currency} : null;
        return {title:item.title,ask,link:safeEbayListingUrl(item),identityMatch,exclusions};
      });
      return res.status(200).json({rows,duplicateCount,conflictingDuplicateCount,cohort:body.cohort,
        ...([catalogFoundationBranch,comparablesBranch,salesLookbackBranch,gradingEconomicsBranch,priceConfirmationRepairBranch,crosswalkBranch,liveCatalogBranch].includes(env.VERCEL_GIT_COMMIT_REF)?{identityEvidence:prepared.identityEvidence}:{})});
    } catch {
      return res.status(signal?.aborted?504:502).json({error:signal?.aborted?'ebay_timeout':signal?'ebay_unavailable':'library_unavailable'});
    } finally { inFlight=false; }
  };
}

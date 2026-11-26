import { useEffect, useRef, useState } from 'react';
import { extractScanSalesIdentity } from '../../lib/scanToSalesIdentity.mjs';
import { SALES_COHORTS } from '../../lib/completedSales.mjs';
import { mergeLookbackBatch } from '../../lib/salesLookback.mjs';
import { summarizeRecentSales } from '../../lib/marketEvidenceSummary.mjs';
import { ActiveListings, RecentSales, MarketEvidenceStyles, MarketIdentityFields, controls, fields, labels } from './MarketEvidencePanels';

const routes={
  active:'/api/active-market-pilot',
  sales:'/api/card-sales-pilot',
  catalog:'/api/catalog-preview',
};
const names={
  active:'Active Listings — eBay',
  sales:'Recent Sales — The Card API',
};

const catalogLabels={
 catalog_provider_not_configured:'Catalog provider not configured.',
 catalog_credentials_missing_or_not_separate:'Catalog provider not configured. A separate catalog credential is required.',
 catalog_entitlement_unverified:'Catalog provider not configured. Catalog entitlement has not been verified.',
 catalog_contract_unverified:'Catalog provider not configured. The catalog HTTP contract has not been verified.',
 catalog_provider_access_denied:'The catalog provider denied access.',
 catalog_quota:'Catalog quota reached.',
 catalog_rate_limit:'Wait before requesting the catalog again.',
 catalog_timeout:'The catalog request timed out.',
 catalog_schema_invalid:'The catalog response failed validation.',
 catalog_unavailable:'The catalog request failed.',
};
function CatalogResults({data}) {
 if(data?.error)return <p role="alert">{catalogLabels[data.error]||labels[data.error]||catalogLabels.catalog_unavailable}</p>;
 if(!data?.result)return null;
 const evidence=data.result;
 return <>
  <p role="status">{evidence.nextEvidence} Exact physical printing remains unverified.</p>
  {!!evidence.contradictions.length&&<p>Conflicts: {evidence.contradictions.join(', ')}.</p>}
  {!!evidence.unresolvedFields.length&&<p>Unresolved: {evidence.unresolvedFields.join(', ')}.</p>}
  {data.pagination?.incomplete&&<p>Showing the first page of catalog results ({data.pagination.total} reported). More variants may exist.</p>}
  {data.quota?.remaining!=null&&<p>Catalog quota remaining: {data.quota.remaining}{data.quota.limit!=null?' of '+data.quota.limit:''}.</p>}
  <ul>{evidence.candidates.map((row,index)=><li key={index}>
   <strong>{[row.claims.subjects?.join(' / '),row.claims.set,row.claims.number&&'#'+row.claims.number].filter(Boolean).join(' · ')||row.recordId}</strong>
   <p>{row.provenance} · {row.compatible?'Possible variant':'Conflicting variant'}</p>
   {!!row.contradictions.length&&<p>Conflicts: {row.contradictions.join(', ')}.</p>}
   {!!row.identifiers.length&&<p>{row.identifiers.map(id=>id.type+' '+id.value).join(' · ')}</p>}
   {!!row.missing.length&&<p>Missing: {row.missing.join(', ')}.</p>}
  </li>)}</ul>
 </>;
}

function countLine(source,result) {
  if (!result) return 'Ready to request';
  if (result.error&&!result.lookback) return 'Request unavailable';
  if (source==='active') {
    const mismatches=result.rows.filter(row=>row.identityMatch.status==='mismatch').length;
    return `${result.rows.length} listings · ${result.rows.length-mismatches} possible · ${mismatches} mismatches`;
  }
  const summary=summarizeRecentSales(result);
  return `${summary.recordsRetrieved} sales · ${summary.plausibleMatches} possible · ${summary.identityMismatches} mismatches · ${summary.knownFinalPrices} priced · ${summary.unknownFinalPrices} price unknown`;
}

async function dashboardRequest(path,options,controller,timeout=19000) {
  const timer=setTimeout(()=>controller.abort(),timeout);
  try {
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error',
      ...options,signal:controller.signal});
    const data=await response.json();
    return response.ok?data:{...data,error:data.error||'provider_unavailable'};
  } finally { clearTimeout(timer); }
}

export default function MarketDashboard({report,reportId,token,today,name,comparableEvidence,lookback=false,catalogStatus=null}) {
  const [opened,setOpened]=useState({});
  const [results,setResults]=useState({});
  const [busy,setBusy]=useState(null);
  const [authorizationError,setAuthorizationError]=useState('');
  const [expiresAt,setExpiresAt]=useState(0);
  const request=useRef(null);
  const review=extractScanSalesIdentity(report);
  const from=new Date(Date.parse(today)-2*86400000).toISOString().slice(0,10);

  function clear() {
    request.current?.abort();
    request.current=null;
    setBusy(null);
    setResults({});
  }
  useEffect(()=>{
    function pageHide() {
      clear();
      setExpiresAt(0);
    }
    window.addEventListener('pagehide',pageHide);
    return ()=>{
      request.current?.abort();
      request.current=null;
      window.removeEventListener('pagehide',pageHide);
    };
  },[]);
  useEffect(()=>{
    if (!expiresAt) return;
    const timer=setTimeout(()=>{
      request.current?.abort();
      setResults({});
      setExpiresAt(0);
    },Math.max(0,expiresAt-Date.now()));
    return ()=>clearTimeout(timer);
  },[expiresAt]);
  useEffect(()=>{
    if (!results.active&&!results.sales&&!results.catalog) return;
    const expiry=results.sales?.lookback?.expiresAt;
    const timer=setTimeout(clear,Number.isFinite(expiry)?Math.max(0,expiry-Date.now()):5*60000);
    return ()=>clearTimeout(timer);
  },[results]);

  async function authorize() {
    if (request.current || !token) return;
    const controller=new AbortController();
    request.current=controller;
    setBusy('authorization');
    setAuthorizationError('');
    try {
      const status=await dashboardRequest('/api/scan-diagnostics',{},controller,8000);
      if (request.current!==controller || controller.signal.aborted) return;
      if (status.authorized && status.expiresAt>Date.now()) {
        setExpiresAt(status.expiresAt);
        return;
      }
      const key=window.prompt('Enter the Preview owner diagnostic key.');
      if (!key) return;
      const authorized=await dashboardRequest('/api/scan-diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'authorize',key})},controller,8000);
      if (request.current!==controller || controller.signal.aborted) return;
      if (authorized.authorized && authorized.expiresAt>Date.now()) setExpiresAt(authorized.expiresAt);
      else setAuthorizationError('Preview owner authorization failed.');
    } catch {
      if (request.current===controller) setAuthorizationError('Preview owner authorization is unavailable.');
    } finally {
      if (request.current===controller) {request.current=null;setBusy(null);}
    }
  }

  async function search(event) {
    event.preventDefault();
    const action=event.nativeEvent.submitter?.value;
    const older=lookback&&action==='older';
    const source=older?'sales':action;
    if(older&&!results.sales?.continuation||source==='catalog'&&catalogStatus!=='ready')return;
    if (!Object.hasOwn(routes,source)||!token||!reportId||request.current||expiresAt<=Date.now()) return;
    const {cohort,confirmed,subjects,...reviewedIdentity}=Object.fromEntries(new FormData(event.currentTarget));
    const body={reportId,cohort,confirmed:confirmed==='on',
      reviewedIdentity:{...reviewedIdentity,subjects:subjects.split('\n').map(line=>line.trim()).filter(Boolean)}};
    if(source==='catalog')delete body.cohort;
    if(source==='sales'){
      if(older) body.continuation=results.sales.continuation;
      else if(!lookback) Object.assign(body,{dateFrom:from,dateTo:today});
    }
    const controller=new AbortController();
    request.current=controller;
    setBusy(source);
    if(!older)setResults(current=>({...current,[source]:null}));
    try {
      const data=await dashboardRequest(routes[source],{method:'POST',headers:{'Content-Type':'application/json',
        Authorization:`Bearer ${token}`},body:JSON.stringify(body)},controller);
      if (request.current!==controller || controller.signal.aborted || expiresAt<=Date.now()) return;
      if (data.error==='owner_authorization_required') {
        setResults({});
        setExpiresAt(0);
        setAuthorizationError('Owner authorization expired. Authorize again to request evidence.');
        return;
      }
      setResults(current=>({...current,[source]:data.lookback?
        mergeLookbackBatch(older?current.sales:null,data):
        older?{...current.sales,error:data.error,continuation:data.error==='lookback_rate_limit'?current.sales.continuation:null}:data}));
    } catch {
      if (request.current===controller && expiresAt>Date.now()) {
        const error=source==='catalog'?(controller.signal.aborted?'catalog_timeout':'catalog_unavailable'):
          controller.signal.aborted?(source==='sales'?'provider_timeout':'ebay_timeout'):
          source==='sales'?'provider_unavailable':'ebay_unavailable';
        setResults(current=>({...current,[source]:older?{...current.sales,error,continuation:null}:{error}}));
      }
    } finally {
      if (request.current===controller) {request.current=null;setBusy(null);}
    }
  }

  const canRequest=!!(reportId&&token);
  return <section className="gp-reference-panel market-dashboard" aria-label="Market Intelligence Dashboard">
    <MarketEvidenceStyles/>
    <h3>Market Intelligence Dashboard</h3>
    <p className="market-muted">Owner Preview · Temporary, noncommercial evaluation</p>
    <form onSubmit={search} onChange={clear} noValidate>
      {Object.entries(names).map(([source,title])=><details key={source} className="market-dashboard-panel"
        onToggle={event=>{const open=event.currentTarget.open;setOpened(current=>({...current,[source]:open}));}}>
        <summary><strong>{title}</strong><small>{busy===source?'Requesting evidence…':countLine(source,results[source])}</small></summary>
        {opened[source]&&<div className="market-dashboard-body">
          <p>{source==='active'?'Current asking prices.':lookback?'Provider-reported sales in batches across up to 30 UTC dates.':'Provider-reported sales from the latest three UTC dates.'}</p>
          {!canRequest?<p>Open a saved report while signed in to request market evidence.</p>:
            !expiresAt?<button type="button" disabled={!!busy} onClick={authorize}>Authorize Preview owner</button>:
            <button type="submit" name="marketSource" value={source==='sales'&&lookback&&results.sales?.continuation?'older':source} disabled={!!busy}>
              {source==='active'?'Request eBay listings':lookback&&results.sales?.continuation?'Load older sales':'Request recent sales'}
            </button>}
          {source==='active'?<ActiveListings result={results.active} pending={busy==='active'} embedded/>:
            <RecentSales result={results.sales} message={results.sales?.error?labels[results.sales.error]||labels.provider_unavailable:''} unified embedded/>}
          {source==='sales'&&comparableEvidence&&!results.sales?.comparableEvidence&&<p>Qualification checks run when recent sales are requested. Active listings are excluded.</p>}
          {results[source]?.identityEvidence?.status==='conflict'&&<p role="status">{results[source].identityEvidence.nextAction}</p>}
          {busy==='sales'&&source==='sales'&&<p role="status">Searching recent sales…</p>}
          {results.sales?.candidates?.length===0&&results.sales?.rejected?.length===0&&(!results.sales.lookback||results.sales.lookback.earliestChecked)&&source==='sales'&&<p>No recent records returned.</p>}
        </div>}
      </details>)}
      {catalogStatus&&<details className="market-dashboard-panel">
        <summary><strong>Catalog lookup</strong><small>{catalogStatus==='ready'?'Owner request required':'Catalog provider not configured'}</small></summary>
        <div className="market-dashboard-body">
          {catalogStatus!=='ready'?<p>{catalogLabels[catalogStatus]}</p>:
           !canRequest?<p>Open a saved report while signed in to request catalog evidence.</p>:
           !expiresAt?<button type="button" disabled={!!busy} onClick={authorize}>Authorize Preview owner</button>:
           <button type="submit" value="catalog" disabled={!!busy}>Request catalog candidates</button>}
          {busy==='catalog'&&<p role="status">Checking catalog…</p>}
          <CatalogResults data={results.catalog}/>
        </div>
      </details>}
      {canRequest&&<details className="market-dashboard-panel">
        <summary>Review identity and cohort</summary>
        <div className="market-dashboard-body" style={controls}>
          <MarketIdentityFields review={review} name={name}/>
          <label style={fields}>Cohort<select name="cohort">{SALES_COHORTS.map(group=><option key={group}>{group}</option>)}</select></label>
        </div>
      </details>}
    </form>
    {authorizationError&&<p role="alert">{authorizationError}</p>}
    <p className="market-muted">Grading economics requires independently qualified evidence.</p>
  </section>;
}

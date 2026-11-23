import MyCardLibrary from '../src/components/MyCardLibrary';
import { extractScanSalesIdentity, scanSalesFields } from '../lib/scanToSalesIdentity.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { providerFinalPrice, summarizeRecentSales } from '../lib/marketEvidenceSummary.mjs';
import { SALES_COHORTS } from '../lib/completedSales.mjs';
import { cardApiPilotPage } from '../lib/cardApiSalesPilot.mjs';

export function getServerSideProps({req,res}) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  const props = cardApiPilotPage(req);
  return props ? {props} : {notFound:true};
}
const labels = {
  ebay_not_configured:'This Preview needs its server-side eBay Browse credentials.',
  ebay_busy:'An eBay search is already running.',
  ebay_quota:'eBay rate limit reached. No retry was attempted.',
  ebay_timeout:'The eBay search timed out.',
  ebay_invalid_response:'eBay returned a response outside the pilot limits.',
  ebay_unavailable:'eBay could not return active listings.',
  library_sign_in_required:'Sign in to My Card Library before using a saved card.',
  library_unavailable:'The Preview library is unavailable.',
  report_not_found:'This saved report is unavailable in your library.',
  unsupported_report_version:'This saved report version is unsupported.',
  owner_identity_review_required:'Review and confirm the saved identity before searching.',
  invalid_reviewed_identity:'Review the card identity. Supply subjects, a four-digit year, set and card number. Optional finish and treatment values must be supported.',
  identity_query_too_long:'The reviewed identity is too long for one bounded title query. Use accurate shorter set or parallel labels.',
  invalid_query:'Use a title query of at least four characters and a date range of up to three UTC calendar days within the last 30 days.',
  pilot_key_missing:'The branch Preview needs a server-side Card API key.',
  owner_authorization_required:'Owner authorization expired. Authorize again before running a query.',
  pilot_busy:'A sales query is already running.',
  provider_authentication:'The Card API rejected the configured key.',
  provider_entitlement:'The Card API denied access or requires another entitlement.',
  provider_validation:'The Card API rejected the query parameters.',
  provider_quota:'The Card API rate or row limit was reached. No retry was attempted.',
  provider_timeout:'The Card API query timed out.',
  provider_unavailable:'The Card API could not return a result.',
  response_too_large:'The Card API response exceeded the byte limit.',
  row_budget_exceeded:'The Card API returned more rows than this pilot allows.',
  schema_difference:'The provider response differs from the reviewed REST contract. The batch was withheld.',
};
const fields = {display:'grid',gap:4,flex:'1 1 150px',minWidth:0, maxWidth:'100%'};
const controls = {display:'flex',flexWrap:'wrap',alignItems:'end',gap:12};
function displayAmount(value,currency) {
  return value === null ? 'Unknown' : (currency ? currency+' ' : '') + String(value);
}
function IdentityEvidence({evidence}) {
  if (!evidence) return null;
  return <details open={evidence.status==='mismatch'}><summary>{{
    exact_listing_evidence:'Exact identity supported by listing evidence',
    plausible_unverified:'Plausible, identity unverified',
    mismatch:'Identity mismatch',
  }[evidence.status]}</summary>
    {['matched','unknown','mismatches'].map(kind=>evidence[kind].length>0&&
      <p key={kind}>{kind}: {evidence[kind].map(field=>field.replace(/_/g,' ')).join(', ')}</p>)}
  </details>;
}
const rowStyle={padding:'12px 0',borderBottom:'1px solid #dfd8ca',overflowWrap:'anywhere'};
const transactionLabels={best_offer:'Best Offer',fixed_price:'Fixed-price',auction:'Auction'};
function Row({row,rejected,unified}) {
  const finalPrice=providerFinalPrice(row);
  return <li style={rowStyle}>
    <strong>{row.title || 'Listing title unavailable'}</strong>
    <p>{[row.platform,row.channel,transactionLabels[row.listingType],row.id].filter(Boolean).join(' · ') || 'Provenance incomplete'}</p>
    <p>{row.sold || 'Sale date unknown'} · {row.grade ? [row.grader,row.grade].filter(Boolean).join(' ') : 'Condition grade not reported'}
      {row.condition ? ' · '+row.condition : ''}{row.cardNumber ? ' · #'+row.cardNumber : ''}</p>
    {unified?<p>{finalPrice===null?'Final price unknown.':[
      row.platform==='goldin'&&row.listingType==='auction'?'Provider-reported hammer price: ':'Provider-reported final price: ',
      displayAmount(finalPrice,row.currency),'. Settlement unverified.',
    ].join('')}</p>:<p>{row.platform==='goldin'?'Reported hammer price':'Reported price'}: {displayAmount(row.price,row.currency)}.
      Shipping: {displayAmount(row.shipping,row.currency)}. {row.amountReportedConfirmed?'Provider reports final amount known.':'Final amount unconfirmed.'}</p>}
    <IdentityEvidence evidence={row.identityMatch}/>
    <details><summary>{rejected?'Rejection reasons':'Why this is not a qualified comparable'}</summary>
      <ul>{[...new Set([...(row.reasons||[]),...(row.qualificationReasons||[])])].map(reason=><li key={reason}>{reason.replace(/_/g,' ')}</li>)}</ul>
    </details>
  </li>;
}
function ActiveListings({result,pending}) {
  return <section aria-labelledby="active-market-title">
    <h2 id="active-market-title">Active Listings — eBay</h2>
    <p>Current asking prices. Listing titles and seller claims are discovery evidence only.</p>
    {pending&&<p role="status">Searching eBay…</p>}
    {result?.error&&<p role="alert">{labels[result.error]||labels.ebay_unavailable}</p>}
    {result?.rows&&<>
      <p>{result.rows.length?result.rows.length+' active records returned.':'No active records returned.'}
        {!!(result.duplicateCount||result.conflictingDuplicateCount)&&
          ` Duplicate rows removed: ${result.duplicateCount}; conflicting duplicate rows withheld: ${result.conflictingDuplicateCount}.`}</p>
      <ul>{result.rows.map((row,index)=><li key={index} style={rowStyle}>
        <strong>{row.title}</strong>
        <p>{row.ask?`Asking price: ${row.ask.currency} ${row.ask.amount}`:'Fixed asking price unavailable'}</p>
        <IdentityEvidence evidence={row.identityMatch}/>
        {row.exclusions.length>0&&<p>{row.exclusions.join(', ')}</p>}
        {row.link&&<p><a href={row.link} target="_blank" rel="noopener noreferrer">Open eBay listing</a></p>}
      </li>)}</ul>
    </>}
  </section>;
}
function SalesSummary({result}) {
  const summary=summarizeRecentSales(result);
  return <>
    <dl>
      <dt>Records retrieved</dt><dd>{summary.recordsRetrieved}</dd>
      <dt>Plausible identity matches</dt><dd>{summary.plausibleMatches}</dd>
      <dt>Identity mismatches</dt><dd>{summary.identityMismatches}</dd>
      <dt>Records with a provider-reported final price</dt><dd>{summary.knownFinalPrices}</dd>
      <dt>Records with unknown final price</dt><dd>{summary.unknownFinalPrices}</dd>
    </dl>
    {summary.qualificationBlockers.length>0&&<details><summary>Why records cannot qualify</summary>
      <ul>{summary.qualificationBlockers.map(reason=><li key={reason}>{reason.replace(/_/g,' ')}</li>)}</ul>
    </details>}
  </>;
}
function RecentSales({result,message,unified,clear}) {
  return <section aria-label="Recent sales evidence">
      {unified&&<h2>Recent Sales — The Card API</h2>}
      {message&&<p role="alert">{message}</p>}
      {result?.differences&&<ul aria-label="Nonsecret schema differences">{result.differences.map(row=>
        <li key={row.field}>{row.field} expected {row.expected}, received {row.received}</li>)}</ul>}
      {result?.quota&&Object.values(result.quota).some(value=>value!==null)&&
        <p>Sales quota remaining: {result.quota.remaining??'unknown'} of {result.quota.limit??'unknown'}. Reset: {result.quota.reset??'unknown'}.</p>}
      {result?.candidates&&<>
        {result.query&&<p>Discovery-only title query: {result.query}. The search omits parallel, full set spelling, and additional subjects to find candidates; each result is separately checked against the complete reviewed identity. This is not an exact-sale match.</p>}
        {unified&&<SalesSummary result={result}/>}
        {unified?<h3>{result.cohort} provider candidates ({result.candidates.length})</h3>:<h2>{result.cohort} provider candidates ({result.candidates.length})</h2>}
        <p>One bounded page. Empty results do not establish that no market exists. Grade filters can omit unparsed records.</p>
        <p>Provider amounts do not independently verify payment or settlement. Best Offer amounts may be unknown.
          Shipping, tax and buyer-premium inclusion vary. Exact parallels, lots and distinct transactions are unverified.</p>
        <ul>{result.candidates.map(row=><Row key={row.index} row={row} unified={unified}/>)}</ul>
        <h3>Rejected matches ({result.rejected.length})</h3>
        <ul>{result.rejected.map(row=><Row key={row.index} row={row} unified={unified} rejected/>)}</ul>
        <h3>Independently qualified comparables ({result.qualifiedCount})</h3>
        <p>Free evaluation lacks the rights and independent evidence required for comparable sales and grading profitability.</p>
        <button type="button" onClick={clear}>Clear results</button>
      </>}
  </section>;
}
export default function CardSalesPilot({today,earliest,savedIdentity=false,unified=false}) {
  const [expiresAt,setExpiresAt] = useState(0);
  const [result,setResult] = useState(null);
  const [active,setActive] = useState(null);
  const [activePending,setActivePending] = useState(false);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const request = useRef(null);
  const owner = useRef(null);
  const [token,setToken] = useState(null);
  const [selected,setSelected] = useState(null);
  const onSession=useCallback((access,id=null)=>{
    if(owner.current!==id){
      owner.current=id;
      request.current?.abort();
      setSelected(null);setResult(null);setActive(null);setMessage('');
    }
    setToken(access);
  },[]);
  function selectReport(report){
    request.current?.abort();
    setSelected({id:report.id,name:report.card_name,review:extractScanSalesIdentity(report.payload)});
    setResult(null);setActive(null);setMessage('');
  }
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/scan-diagnostics',{cache:'no-store',redirect:'error',signal:controller.signal})
      .then(async response=>response.ok?response.json():null).then(status=>{
        if (!controller.signal.aborted && status?.authorized) setExpiresAt(status.expiresAt);
      }).catch(()=>{});
    function clear(){request.current?.abort();setResult(null);setActive(null);}
    window.addEventListener('pagehide',clear);
    return ()=>{controller.abort();request.current?.abort();window.removeEventListener('pagehide',clear);};
  },[]);
  useEffect(()=>{
    if (!expiresAt) return;
    const timer=setTimeout(()=>{request.current?.abort();setExpiresAt(0);setResult(null);setActive(null);setSelected(null);setToken(null);owner.current=null;},Math.max(0,expiresAt-Date.now()));
    return ()=>clearTimeout(timer);
  },[expiresAt]);
  useEffect(()=>{
    if (!result) return;
    const timer=setTimeout(()=>setResult(null),5*60*1000);
    return ()=>clearTimeout(timer);
  },[result]);
  async function authorize(){
    const key=window.prompt('Enter the Preview owner diagnostic key.');
    if (!key) return;
    setMessage('');
    const authorizeController=new AbortController();
    const timer=setTimeout(()=>authorizeController.abort(),8000);
    try {
      const res=await fetch('/api/scan-diagnostics',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},
        signal:authorizeController.signal,body:JSON.stringify({action:'authorize',key})});
      if (!res.ok) throw Error();
      setExpiresAt((await res.json()).expiresAt);
    } catch { setMessage('Owner authorization failed.'); }
    finally { clearTimeout(timer); }
  }
  async function search(event){
    event.preventDefault();
    if (request.current || expiresAt<=Date.now()) return;
    const controller=new AbortController();
    request.current=controller;
    let input=Object.fromEntries(new FormData(event.currentTarget));
    if(savedIdentity){
      if(!token||!selected){request.current=null;return;}
      const {cohort,dateFrom,dateTo,priceMin,priceMax,confirmed,subjects,...reviewedIdentity}=input;
      input={cohort,dateFrom,dateTo,priceMin,priceMax,reportId:selected.id,confirmed:confirmed==='on',
        reviewedIdentity:{...reviewedIdentity,subjects:subjects.split('\n').map(line=>line.trim()).filter(Boolean)}};
    }
    setBusy(true);setMessage('');setResult(null);setActive(null);setActivePending(unified);
    async function fetchEvidence(path,body,onResult,fallback) {
      const deadline=new AbortController();
      const cancel=()=>deadline.abort();
      controller.signal.addEventListener('abort',cancel);
      const timeout=setTimeout(cancel,savedIdentity?19000:9000);
      try {
        const response=await fetch(path,{method:'POST',redirect:'error',cache:'no-store',signal:deadline.signal,
          headers:{'Content-Type':'application/json',...(savedIdentity?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
        const data=await response.json();
        if (!controller.signal.aborted&&expiresAt>Date.now()) onResult(response.ok?data:{...data,error:data.error||fallback});
      } catch {
        if (!controller.signal.aborted&&expiresAt>Date.now()) onResult({error:fallback});
      } finally {
        controller.signal.removeEventListener('abort',cancel);
        clearTimeout(timeout);
      }
    }
    const searches=[fetchEvidence('/api/card-sales-pilot',input,data=>{
      if (data.error) setMessage(labels[data.error]||labels.provider_unavailable);
      setResult(data);
    },'provider_unavailable')];
    if (unified) {
      const {reportId,reviewedIdentity,confirmed,cohort}=input;
      searches.push(fetchEvidence('/api/active-market-pilot',{reportId,reviewedIdentity,confirmed,cohort},setActive,'ebay_unavailable')
        .finally(()=>setActivePending(false)));
    }
    try { await Promise.all(searches); }
    finally { request.current=null;setBusy(false); }
  }
  const title=unified?'Market Evidence':'Card API Sales Pilot';
  const defaultFrom=unified?new Date(Date.parse(today)-2*86400000).toISOString().slice(0,10):today;
  return <>
    <Head><title>{title} · GemPredict</title><meta name="robots" content="noindex,nofollow"/>
      <meta name="referrer" content="no-referrer"/></Head>
    <main style={{maxWidth:820,margin:'auto',padding:16,fontFamily:'system-ui,sans-serif',color:'#27251e'}}>
      <h1>{title}</h1>
      <p>Owner-only noncommercial evaluation. Results are temporary and cannot be saved to a card report.</p>
      {!expiresAt&&<button type="button" onClick={authorize}>Authorize Preview owner</button>}
      {expiresAt>0&&savedIdentity&&<MyCardLibrary onSession={onSession} revision={0} selectReport={selectReport}/>}
      {expiresAt>0&&(!savedIdentity||selected&&token)&&
       <form key={selected?.id||'manual'} onSubmit={search} style={controls}>
        {savedIdentity?<fieldset style={{...controls,flexBasis:'100%',minWidth:0}}>
          <legend>Review saved identity</legend><p style={{flexBasis:'100%'}}>{selected.name} · {selected.review.identity.category||'Unknown category'}</p>
          {selected.review.conflicts.length>0&&<p style={{flexBasis:'100%'}}>Saved disagreements: {selected.review.conflicts.join(', ')}</p>}
          {selected.review.originalProposals.length>0&&<ul style={{flexBasis:'100%'}}>
           {selected.review.originalProposals.map(row=><li key={row.field}>{row.field}: saved proposal {row.proposed} · current identity {row.chosen}</li>)}
          </ul>}
          {selected.review.missing.length>0&&<p style={{flexBasis:'100%'}}>Missing fields: {selected.review.missing.map(key=>scanSalesFields[key]||'Subjects').join(', ')}</p>}
          <label style={fields}>Subjects, one per line<textarea name="subjects" rows={3} maxLength={324}
            defaultValue={selected.review.identity.subjects.join('\n')} required/></label>
          {Object.entries(scanSalesFields).map(([key,label])=>
            <label key={key} style={fields}>{label}<input
              name={key} defaultValue={selected.review.identity[key]||''} maxLength={key==='number'?40:80}
              required={['year','set','number'].includes(key)}/></label>)}
          <p style={{flexBasis:'100%'}}>Use holo, non-holo, or reverse-holo for finish, and yes or no for autograph and relic. Leave unknown fields empty.</p>
          <label style={{flexBasis:'100%'}}><input type="checkbox" name="confirmed"/>
            I reviewed this identity for comparison. My confirmation does not verify the catalog identity or physical printing.</label>
        </fieldset>:<>
         <label style={{...fields,flexBasis:'100%'}}>Listing title query<input name="q" minLength={4} maxLength={120} required/></label>
         <label style={fields}>Category<select name="category"><option value="sports">Sports</option><option value="tcg">TCG</option><option value="non_sport">Non-sport</option></select></label>
        </>}
        <label style={fields}>Cohort<select name="cohort">{SALES_COHORTS.map(group=><option key={group}>{group}</option>)}</select></label>

        <label style={fields}>From (UTC)<input name="dateFrom" type="date" min={earliest} max={today} defaultValue={defaultFrom} required/></label>
        <label style={fields}>To (UTC)<input name="dateTo" type="date" min={earliest} max={today} defaultValue={today} required/></label>
        <label style={fields}>Minimum USD<input name="priceMin" inputMode="decimal" maxLength={10}/></label>
        <label style={fields}>Maximum USD<input name="priceMax" inputMode="decimal" maxLength={10}/></label>
        <button type="submit" disabled={busy} style={{minHeight:44}}>{busy?'Querying…':unified?'Search marketplace evidence':'Query one sales cohort'}</button>
       </form>}
      {unified&&expiresAt>0&&selected&&<ActiveListings result={active} pending={activePending}/>}
      {(!unified||expiresAt>0&&selected)&&<RecentSales result={result} message={message} unified={unified}
        clear={()=>{request.current?.abort();setResult(null);setActive(null);setMessage('');}}/>}
      {unified&&!expiresAt&&message&&<p role="alert">{message}</p>}
    </main>
  </>;
}
CardSalesPilot.excludeAnalytics = true;

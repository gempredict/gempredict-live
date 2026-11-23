import MyCardLibrary from '../src/components/MyCardLibrary';
import { extractScanSalesIdentity } from '../lib/scanToSalesIdentity.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { ActiveListings, RecentSales, MarketEvidenceStyles, MarketIdentityFields, controls, fields, labels } from '../src/components/MarketEvidencePanels';
import { SALES_COHORTS } from '../lib/completedSales.mjs';
import { cardApiPilotPage } from '../lib/cardApiSalesPilot.mjs';

export function getServerSideProps({req,res}) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  const props = cardApiPilotPage(req);
  return props ? {props} : {notFound:true};
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
        {savedIdentity?<MarketIdentityFields review={selected.review} name={selected.name}/>:<>
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
    <MarketEvidenceStyles/>
  </>;
}
CardSalesPilot.excludeAnalytics = true;

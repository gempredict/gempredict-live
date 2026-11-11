import React,{useEffect,useState,useRef} from 'react';
import {scanDiagnosticAccess} from '../../lib/scanDiagnosticClient.mjs';
import {prepareDiagnosticExport,initiateDiagnosticDownload} from '../../lib/diagnosticExport.mjs';
export default function ScanDiagnostics({report=null,prominent=false,scrollToCapture=false}){
 const handle=scanDiagnosticAccess(report);
 if(prominent)return handle?.controlled?<ControlledCapture key={handle.scanId||handle.attemptId||'unavailable'} handle={handle} scrollToCapture={scrollToCapture}/>:null;
 if(handle?.controlled)return null;
 return <OrdinaryDiagnostics report={report}/>;
}
function OrdinaryDiagnostics({report}){
 const [access,setAccess]=useState(null),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;fetch('/api/scan-diagnostics',{cache:'no-store',credentials:'same-origin',redirect:'error'}).then(async r=>{if(active&&r.ok)setAccess(await r.json());}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>{if(!access?.expiresAt)return;const timer=setTimeout(()=>setAccess({enabled:true,authorized:false}),Math.max(0,access.expiresAt-Date.now()));return()=>clearTimeout(timer);},[access?.expiresAt]);
 if(!access?.enabled)return null;
 const handle=scanDiagnosticAccess(report);
 async function authorize(){
  const key=window.prompt('Enter the Preview owner diagnostic key. It will not be saved.');if(!key)return;
  try{const r=await fetch('/api/scan-diagnostics',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authorize',key})});if(!r.ok)throw Error();const data=await r.json();setAccess({enabled:true,authorized:true,expiresAt:data.expiresAt});setMessage('Authorized for 15 minutes. Diagnostics will be available for the next scan.');}catch{setMessage('Diagnostic authorization unavailable.');}
 }
 async function download(){
  try{const r=await fetch('/api/scan-diagnostics',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'download',...handle})});if(!r.ok)throw Error();const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='gempredict-scan-'+handle.scanId+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch{setMessage('Export unavailable or expired. Authorize and capture a fresh scan.');}
 }
 if(report&&(!access.authorized||!handle))return null;
 return <div style={{fontSize:'0.75rem',margin:'0.6rem 0'}}>
  {report?<button type="button" onClick={download}>Download Scan Diagnostics</button>:access.authorized?<span>Preview diagnostics authorized for new scans.</span>:<button type="button" onClick={authorize}>Authorize Preview Scan Diagnostics</button>}
  {message&&<p role="status">{message}</p>}
 </div>;
}

function ControlledCapture({handle,scrollToCapture=false}){
 const [access,setAccess]=useState(null),[clock,setClock]=useState(Date.now),[buffer,setBuffer]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[initiated,setInitiated]=useState(false);
 const panel=useRef(null),lock=useRef(false),alive=useRef(false),request=useRef(null),release=useRef(null);
 const available=!!handle.ticket&&!!handle.expiresAt,expired=available&&clock>=handle.expiresAt;
 const ownerExpired=!!access&&(!access.authorized||!access.expiresAt||clock>=access.expiresAt);
 useEffect(()=>{
  alive.current=true;const abort=new AbortController();
  checkAccess(abort.signal);
  if(scrollToCapture)panel.current?.scrollIntoView({block:'start',behavior:'smooth'});
  const tick=()=>setClock(Date.now()),timer=setInterval(tick,1000);
  const leave=()=>{setBuffer(null);request.current?.abort();};
  window.addEventListener('pagehide',leave);
  window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);
  return()=>{alive.current=false;abort.abort();request.current?.abort();clearTimeout(release.current);clearInterval(timer);window.removeEventListener('pagehide',leave);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};
 },[]);
 useEffect(()=>{if(expired||ownerExpired){setBuffer(null);request.current?.abort();}},[expired,ownerExpired]);
 function checkAccess(signal){
  fetch('/api/scan-diagnostics',{cache:'no-store',credentials:'same-origin',redirect:'error',signal}).then(async r=>{if(!r.ok)throw Error();const a=await r.json();if(alive.current)setAccess(a);}).catch(()=>{if(alive.current)setMessage('Could not check owner authorization. Keep this page open and tap Check owner authorization before the displayed expiry.');});
 }
 function download(){
  if(lock.current)return;
  const at=Date.now();setClock(at);
  if(!available||at>=handle.expiresAt||!access?.authorized||at>=access.expiresAt){setMessage('Diagnostic or owner authorization is unavailable or expired. Reauthorizing cannot restore an expired or previous-session ticket. Keep your existing evidence; do not repeat the paid scan.');return;}
  lock.current=true;setBusy(true);
  if(buffer){
   try{initiateDiagnosticDownload(buffer,handle.scanId);setInitiated(true);setMessage('Download initiated — saving is not confirmed. In Safari choose Save to Files → Downloads. If canceled, tap Download Scan Diagnostics again before expiry.');}
   catch{setMessage('Download could not start. Keep this page open and tap Download Scan Diagnostics again before expiry. No scan was submitted.');}
   release.current=setTimeout(()=>{lock.current=false;if(alive.current)setBusy(false);},700);return;
  }
  const abort=new AbortController();request.current=abort;const timeout=setTimeout(()=>abort.abort(),20000);
  prepareDiagnosticExport(handle,{signal:abort.signal}).then(blob=>{
   if(!alive.current)return;
   if(Date.now()>=handle.expiresAt||Date.now()>=access.expiresAt){setBuffer(null);setClock(Date.now());return;}
   setBuffer(blob);setMessage('Export ready in memory. Tap Download Scan Diagnostics again to save the file. This second tap lets Safari start the download directly. Nothing is saved yet.');
  }).catch(e=>{if(alive.current)setMessage(e.name==='AbortError'?'Export interrupted, timed out or expired. Check the availability below; retry only the diagnostic export while valid. Do not repeat the paid scan.':e.message||'Export failed. Retry the diagnostic export before expiry; do not rescan.');})
   .finally(()=>{clearTimeout(timeout);lock.current=false;if(alive.current)setBusy(false);});
 }
 return <section ref={panel} aria-label="Controlled scan validation evidence" style={{background:'#fffbeb',border:'2px solid #b78738',borderRadius:12,padding:16,marginBottom:16,overflowWrap:'anywhere'}}>
  <h3 style={{marginTop:0}}>Controlled Scan Complete — Save Validation Evidence</h3>
  <p role="status">Diagnostic availability: {!available?'Unavailable — no usable export handle or server expiry was returned.':expired?'Expired — the server export window has ended.':!access?'Checking owner authorization.':ownerExpired?'Owner authorization expired or unavailable.':buffer?'Export prepared in memory; ready to download.':'Available for owner export.'}</p>
  {handle.expiresAt&&<p>Export expires at {new Date(handle.expiresAt).toLocaleTimeString()} ({Math.max(0,Math.ceil((handle.expiresAt-clock)/1000))} seconds remaining). Owner authorization may expire sooner.</p>}
  <p>Save to <strong>Files → Downloads</strong>, not Photos. First tap prepares the export; second tap starts the download. Keep the exact prepared front/back JPEGs and manifest with this JSON.</p>
  <button type="button" onClick={download} disabled={busy||!available||expired||ownerExpired||!access?.authorized} style={{width:'100%',minHeight:48,whiteSpace:'normal',padding:12,fontWeight:700}}>Download Scan Diagnostics</button>
  {!access&&!expired&&available&&<button type="button" onClick={()=>checkAccess()}>Check owner authorization</button>}
  <p>{initiated?'Download was initiated; filesystem saving is not confirmed.':'No diagnostic download initiated yet.'}</p>
  {message&&<p role="alert">{message}</p>}
  {(expired||ownerExpired||!available)&&<p>Keep existing prepared files and reference notes. This page cannot recover an expired diagnostic. Do not repeat a paid scan to recover it.</p>}
  <p style={{fontSize:'0.8rem'}}>This export stays in memory only and is cleared at expiry or when leaving/reloading the page. Do not navigate away until you have checked the file in Files.</p>
 </section>;
}

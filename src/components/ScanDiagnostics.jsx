import React,{useEffect,useState} from 'react';
import {scanDiagnosticAccess} from '../../lib/scanDiagnosticClient.mjs';
export default function ScanDiagnostics({report=null}){
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

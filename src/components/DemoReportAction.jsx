import React,{useEffect,useState} from 'react';
export default function DemoReportAction(){
 const [access,setAccess]=useState(null),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;fetch('/api/demo-report',{cache:'no-store',credentials:'same-origin',redirect:'error'}).then(async r=>{if(r.ok&&active)setAccess(await r.json());}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>{if(!access?.expiresAt)return;const timer=setTimeout(()=>setAccess({enabled:true,authorized:false}),Math.max(0,access.expiresAt-Date.now()));return()=>clearTimeout(timer);},[access?.expiresAt]);
 if(!access?.enabled)return null;
 async function authorize(){
  const key=window.prompt('Enter your existing Preview owner diagnostic key to view synthetic demos. It will not be saved.');if(!key)return;
  try{const r=await fetch('/api/demo-report',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authorize',key})});if(!r.ok)throw Error();setAccess(await r.json());setMessage('Owner demo access authorized for 15 minutes. No scan will run.');}catch{setMessage('Owner demo authorization unavailable.');}
 }
 return <div style={{fontSize:13,margin:'12px 0'}}>{access.authorized?<a href="/demo-report" style={{color:'#70561e',fontWeight:700}}>View Demo Report</a>:<button type="button" onClick={authorize}>Authorize owner demo access</button>}{message&&<p role="status">{message}</p>}</div>;
}

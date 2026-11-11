import React,{useState,useRef,useEffect} from 'react';
import {createPreparedValidation} from '../../lib/preparedValidation.mjs';
export default function ControlledValidation({front,back,busy,getSelectionEpoch,onSubmit}){
 const [access,setAccess]=useState(null),[attempt,setAttempt]=useState(null),[message,setMessage]=useState(''),[working,setWorking]=useState(false),[verified,setVerified]=useState({});
 const [spendAuthorized,setSpendAuthorized]=useState(false);
 const current=useRef(null),controller=useRef(null);
 current.current={front,back,busy,getSelectionEpoch};
 function invalidate(){controller.current?.invalidate();setAttempt(null);setVerified({});setSpendAuthorized(false);}
 async function refresh(){
  invalidate();setAccess(null);
  try{const r=await fetch('/api/scan-diagnostics',{credentials:'same-origin',cache:'no-store',redirect:'error'});if(!r.ok)return;const a=await r.json();setAccess(a);
   if(a.authorized&&a.conditionValidationAvailable&&a.expiresAt>Date.now())controller.current=createPreparedValidation({revision:a.revision,getFiles:()=>{const c=current.current;return {front:c.front,back:c.back,busy:c.busy,version:c.getSelectionEpoch()};}});
  }catch{setMessage('Preview owner authorization unavailable.');}
 }
 useEffect(()=>{refresh();return()=>controller.current?.invalidate();},[]);
 useEffect(()=>{invalidate();},[front,back,busy]);
 useEffect(()=>{if(!access?.expiresAt)return;const timer=setTimeout(()=>{invalidate();setAccess(null);},Math.max(0,access.expiresAt-Date.now()));return()=>clearTimeout(timer);},[access?.expiresAt]);
 if(!access?.conditionValidationAvailable)return null;
 async function action(task){setWorking(true);setMessage('');try{await task();}catch(e){invalidate();setMessage(e.message||'Controlled preparation failed. No scan submitted.');}finally{setWorking(false);}}
 return <section aria-label="Controlled Preview validation" style={{padding:16,border:'1px solid #d2b48c',borderRadius:12,marginTop:16}}>
  <h3>Owner-only controlled card validation</h3>
  <p>Expected request cost: unknown. One paid Claude request may incur a charge; no automatic retries.</p>
  <p>Local evidence export first; one Full Analysis attempt with marketplace disabled. No grade or financial recommendation.</p>
  <button type="button" onClick={refresh} disabled={busy||working}>Refresh owner authorization</button>
  {!access.authorized?<p>Authorize Preview Scan Diagnostics using the existing owner control, then refresh here.</p>:<>
   <p>Keep originals separately. Freeze both prepared photos, download each JPEG and manifest, then reselect all three saved files below to verify the bytes. No evidence is uploaded during export or verification.</p>
   <button type="button" disabled={busy||working||!front||!back} onClick={()=>action(async()=>{const a=await controller.current.freeze();setAttempt(a);setVerified({});setSpendAuthorized(false);})}>Freeze prepared front and back</button>
   {attempt&&<div><p>Attempt: {attempt.manifest.attemptId}</p>{['front','back','manifest'].map(kind=><div key={kind} style={{marginTop:10}}>
    <button type="button" disabled={busy||working} onClick={()=>action(()=>controller.current.export(attempt,kind))}>Download {kind==='manifest'?'manifest':`prepared ${kind} JPEG`}</button>
    <label style={{marginLeft:10}}>Verify saved {kind} <input type="file" accept={kind==='manifest'?'.json':'image/jpeg'} disabled={busy||working} onChange={e=>{const file=e.target.files?.[0];e.target.value='';return action(async()=>{await controller.current.verifySaved(attempt,kind,file);setVerified(v=>({...v,[kind]:true}));});}}/></label>
    <span>{verified[kind]?' Match verified locally':''}</span>
   </div>)}
   <p>Submission uses the same frozen File objects. Replacing either photograph invalidates this preparation. A failed or submitted attempt cannot be reused automatically.</p>
   <label style={{display:'block',margin:'12px 0'}}><input type="checkbox" checked={spendAuthorized} disabled={busy||working} onChange={e=>setSpendAuthorized(e.target.checked)}/> I explicitly authorize one paid controlled scan of this prepared pair. Cost is unknown.</label>
   <button type="button" disabled={busy||working||!spendAuthorized||!['front','back','manifest'].every(k=>verified[k])} onClick={()=>{if(!spendAuthorized){setMessage('Explicit cost authorization required. No scan submitted.');return;}return action(async()=>{const frozen=controller.current.consume(attempt);setAttempt(null);setVerified({});await onSubmit(frozen);});}}>Run controlled Full Analysis once</button>
   </div>}
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}

import {CONTROLLED_CATEGORIES,validControlledCategory} from '../../lib/controlledCategories.mjs';
import React,{useState,useRef,useEffect} from 'react';
import {createPreparedValidation} from '../../lib/preparedValidation.mjs';
const kinds=['front','back','manifest'];
const emptyStatus=()=>Object.fromEntries(kinds.map(k=>[k,'Not prepared']));
export default function ControlledValidation({front,back,busy,cardType,onCategoryChange,getSelectionEpoch,onSubmit}){
 const [access,setAccess]=useState(null),[attempt,setAttempt]=useState(null),[message,setMessage]=useState(''),[working,setWorking]=useState(false),[verified,setVerified]=useState({});
 const [status,setStatus]=useState(emptyStatus),[spendAuthorized,setSpendAuthorized]=useState(false);
 const [categoryChoice,setCategoryChoice]=useState(null),[confirmedCategory,setConfirmedCategory]=useState(null);
 const current=useRef(null),controller=useRef(null),generation=useRef(0),locked=useRef(false),mounted=useRef(false),owner=useRef(null),refreshId=useRef(0);
 current.current={front,back,busy,getSelectionEpoch,cardType,categoryChoice};
 function invalidate(reason){generation.current++;controller.current?.invalidate();setAttempt(null);setVerified({});setSpendAuthorized(false);setConfirmedCategory(null);if(reason)setMessage(reason);}
 function expire(){
  if(!owner.current?.authorized)return;
  owner.current={...owner.current,authorized:false};setAccess(owner.current);
  invalidate('Owner authorization expired. No controlled scan was submitted by verification. Reauthorize Preview Scan Diagnostics, refresh owner authorization here, then freeze, download and verify all three files again.');
  setStatus(Object.fromEntries(kinds.map(k=>[k,'Authorization expired — prepare again'])));
 }
 function requireOwner(){if(!owner.current?.authorized||owner.current.expiresAt<=Date.now()){expire();throw Error('Owner authorization unavailable or expired. Reauthorize Preview Scan Diagnostics, refresh here, then prepare again.');}}
 async function refresh(){
  const id=++refreshId.current;invalidate();setWorking(true);
  try{
   const r=await fetch('/api/scan-diagnostics',{credentials:'same-origin',cache:'no-store',redirect:'error'});
   if(!mounted.current||id!==refreshId.current)return;
   if(!r.ok)throw Error();const received=await r.json();if(!mounted.current||id!==refreshId.current)return;
   const a={...received,authorized:received.authorized===true&&received.expiresAt>Date.now()};
   owner.current=a;setAccess(a);
   if(a.authorized&&a.conditionValidationAvailable&&a.expiresAt>Date.now()){
    controller.current=createPreparedValidation({revision:a.revision,getFiles:()=>{const c=current.current;return {front:c.front,back:c.back,busy:c.busy,version:c.getSelectionEpoch(),category:c.cardType,categorySelected:c.categoryChoice===c.cardType};}});
   }else if(a.conditionValidationAvailable){setMessage('Owner authorization unavailable or expired. Reauthorize Preview Scan Diagnostics, then refresh here and prepare again.');}
  }catch{
   if(mounted.current&&id===refreshId.current){owner.current=null;setAccess(previous=>previous?{...previous,authorized:false}:null);setMessage('Could not refresh owner authorization. Check your connection, reauthorize Preview Scan Diagnostics, then refresh here. No scan was submitted.');}
  }finally{if(mounted.current&&id===refreshId.current)setWorking(false);}
 }
 useEffect(()=>{mounted.current=true;refresh();return()=>{mounted.current=false;refreshId.current++;generation.current++;controller.current?.invalidate();};},[]);
 useEffect(()=>{invalidate(controller.current?'Selected photos or preparation state changed. No scan was submitted by verification. Freeze, download and verify the pair again.':undefined);setStatus(emptyStatus());},[front,back,busy,cardType]);
 useEffect(()=>{
  if(!access?.authorized||!access?.expiresAt)return;
  // iOS can suspend timers while Files is open. Returning only checks expiry;
  // ordinary focus/visibility changes must never discard a valid preparation.
  const checkExpiry=()=>{if(mounted.current&&Date.now()>=access.expiresAt)expire();};
  const timer=setTimeout(checkExpiry,Math.max(0,access.expiresAt-Date.now()));
  if(typeof window!=='undefined')window.addEventListener('focus',checkExpiry);
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',checkExpiry);
  return()=>{clearTimeout(timer);if(typeof window!=='undefined')window.removeEventListener('focus',checkExpiry);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',checkExpiry);};
 },[access?.authorized,access?.expiresAt]);
 if(!access?.conditionValidationAvailable)return null;
 async function action(task,complete,failedKind){
  if(locked.current)return;locked.current=true;setWorking(true);const token=generation.current;
  try{requireOwner();const value=await task();if(!mounted.current||token!==generation.current)return;requireOwner();complete?.(value);}
  catch(e){if(mounted.current&&token===generation.current){invalidate(e.message||'Controlled preparation failed. No scan was submitted. Freeze, download and verify again.');setStatus(Object.fromEntries(kinds.map(k=>[k,k===failedKind?'Verification failed — prepare again':'Preparation reset — prepare again'])));}}
  finally{locked.current=false;if(mounted.current)setWorking(false);}
 }
 const next=!access.authorized?'Reauthorize Preview Scan Diagnostics, then refresh owner authorization.':categoryChoice!==cardType?'Choose the controlled card category explicitly.':!front||!back?'Select and prepare both front and back photos.':!attempt?'Freeze the prepared pair. Reloading this page resets the in-memory preparation.':kinds.find(k=>!verified[k])?`Download and verify the saved ${kinds.find(k=>!verified[k])} file. Choose the exported file from Files/Downloads.`:confirmedCategory!==cardType?'All three files match. Confirm the selected category before authorizing a paid scan.':!spendAuthorized?'All three files match. Review the unknown cost; authorize a paid scan only when ready.':'All three files match. The controlled scan is ready for explicit owner initiation.';
 function pickerCanceled(){
  if(!owner.current?.authorized)return;
  if(owner.current.expiresAt<=Date.now()){expire();return;}
  if(attempt)setMessage('No file selected. Your frozen pair and existing verification matches are unchanged. Select the saved file when ready.');
 }
 function selectSaved(e,kind){
  const file=e.target.files?.[0];e.target.value='';
  if(!file){pickerCanceled();return;}
  if(locked.current)return;
  setStatus(v=>({...v,[kind]:'Checking saved bytes…'}));
  return action(()=>controller.current.verifySaved(attempt,kind,file),matched=>{if(matched){setVerified(v=>({...v,[kind]:true}));setStatus(v=>({...v,[kind]:'Match verified locally'}));setMessage('');}},kind);
 }
 return <section aria-label="Controlled Preview validation" style={{padding:16,border:'1px solid #d2b48c',borderRadius:12,marginTop:16}}>
  <h3>Owner-only controlled card validation</h3>
  <p><strong>Selected card category: {CONTROLLED_CATEGORIES[cardType]||'Unresolved'}</strong></p>
  <label>Category for this controlled test <select aria-label="Controlled card category" value={categoryChoice===cardType?cardType:''} disabled={!access.authorized||busy||working} onChange={e=>{const value=e.target.value;invalidate('Category selection changed. Choose the category, then freeze, download and verify again.');setStatus(emptyStatus());setCategoryChoice(validControlledCategory(value)?value:null);if(validControlledCategory(value))onCategoryChange(value);}}><option value="">Choose category explicitly</option>{Object.entries(CONTROLLED_CATEGORIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <p>Expected request cost: unknown. One paid Claude request may incur a charge; no automatic retries.</p>
  <p>Local evidence export first; one Full Analysis attempt with marketplace disabled. No grade or financial recommendation.</p>
  {message&&<p role="alert" style={{border:'1px solid #b78738',padding:10}}>{message}</p>}
  <p role="status"><strong>Next step:</strong> {next}</p>
  <button type="button" onClick={refresh} disabled={busy||working}>Refresh owner authorization</button>
  {!access.authorized?<p>Authorize Preview Scan Diagnostics using the existing owner control, then refresh here.</p>:<>
   <p>Keep originals separately. Freeze both prepared photos, download each JPEG and manifest, then reselect all three saved files below to verify the bytes. No evidence is uploaded during export or verification. Canceling the picker keeps your preparation.</p>
   <button type="button" disabled={busy||working||!front||!back||categoryChoice!==cardType} onClick={()=>action(()=>controller.current.freeze(),a=>{setAttempt(a);setVerified({});setSpendAuthorized(false);setConfirmedCategory(null);setStatus(Object.fromEntries(kinds.map(k=>[k,'Download required'])));setMessage('');})}>Freeze prepared front and back</button>
  </>}
  {attempt&&<p>Attempt: {attempt.manifest.attemptId}</p>}
  <ul aria-label="Saved file verification status">{kinds.map(kind=><li key={kind} style={{marginTop:10}}>
   <strong>{kind==='manifest'?'Manifest':`Prepared ${kind} JPEG`}: </strong><span aria-live="polite">{status[kind]}</span>
   {attempt&&access.authorized&&<div>
    <button type="button" disabled={busy||working} onClick={()=>action(()=>controller.current.export(attempt,kind),()=>setStatus(v=>({...v,[kind]:verified[kind]?'Match verified locally':'Download initiated — select saved file'})))}>Download {kind==='manifest'?'manifest':`prepared ${kind} JPEG`}</button>
   <label style={{display:'block',marginTop:8}}>Verify saved {kind} <input type="file" accept={kind==='manifest'?'.json,application/json':'.jpg,.jpeg,image/jpeg'} disabled={busy||working} onChange={e=>selectSaved(e,kind)} onCancel={pickerCanceled}/></label>
   </div>}
  </li>)}</ul>
  {attempt&&access.authorized&&<div>
   <p>Submission uses the same frozen File objects. Replacing either photograph invalidates this preparation. A failed or submitted attempt cannot be reused automatically.</p>
    <label style={{display:'block',margin:'12px 0'}}><input type="checkbox" aria-label="Confirm selected category" checked={confirmedCategory===cardType} disabled={busy||working} onChange={e=>{setConfirmedCategory(e.target.checked?cardType:null);setSpendAuthorized(false);}}/> I confirm the selected category is {CONTROLLED_CATEGORIES[cardType]||'unresolved'} for this frozen pair.</label>
   <label style={{display:'block',margin:'12px 0'}}><input type="checkbox" checked={spendAuthorized} disabled={busy||working||confirmedCategory!==cardType} onChange={e=>setSpendAuthorized(e.target.checked)}/> I explicitly authorize one paid controlled scan of this prepared pair. Cost is unknown.</label>
   <button type="button" disabled={busy||working||confirmedCategory!==cardType||!spendAuthorized||!kinds.every(k=>verified[k])} onClick={()=>{if(confirmedCategory!==cardType||!spendAuthorized){setMessage('Confirm the selected category and explicitly authorize one paid scan. No scan submitted.');return;}return action(async()=>{const frozen=controller.current.consume(attempt,confirmedCategory);setAttempt(null);setVerified({});setSpendAuthorized(false);setConfirmedCategory(null);await onSubmit(frozen);});}}>Run controlled Full Analysis once</button>
  </div>}
 </section>;
}

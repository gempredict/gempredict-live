import { useEffect, useRef, useState } from 'react';
import { normalizeMobileImage } from '../lib/mobileImages.mjs';
import { CORE_FIELDS } from '../lib/identificationBenchmark.mjs';
import { newExactFields } from '../lib/ownerBenchmarkReview.mjs';
import { accuracyLabDeployment } from '../lib/ownerBenchmarkRoute.mjs';

const statusLabels = {draft:'Draft',owner_reported:'Owner-reported',independently_reviewed:'Independently reviewed',incomplete:'Incomplete'};
const fieldLabel = field => field.replace(/([A-Z])/g,' $1').replace(/^./,c => c.toUpperCase());
const emptyRow = {attribute:'centering',side:'front',location:'whole',state:'uncertain',limitations:[]};
const messages = {
 baseline_truth_conflict:'A reviewed field conflicts with historical benchmark truth. Resolve the source disagreement before exporting.',
 invalid_photo_quality:'Use up to eight short photo limitation codes separated by commas.',
 invalid_condition:'Check for repeated regions or invalid region and limitation codes.',
 benchmark_duplicate_front_photo:'Two card slots have the same prepared front photograph.',
 invalid_new_slot:'Enter a card name. A packet can contain up to ten new slots.',
};

export function getServerSideProps({req,res}) {
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 return accuracyLabDeployment(req) ? {props:{}} : {notFound:true};
}

async function request(path, body) {
 const response = await fetch(path,{
  cache:'no-store',credentials:'same-origin',
  ...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}),
 });
 if (!response.ok) {
  const result = await response.json().catch(() => ({}));
  throw new Error(response.status === 403 ? 'expired' : result.error || 'request_failed');
 }
 return response.json();
}

function download(blob,name) {
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = name;
 link.click();
 setTimeout(() => URL.revokeObjectURL(url),1000);
}

function Receipt({value,onChange,label}) {
 return <div className="grid">
  <label>{label} reviewer code<input maxLength={100} value={value.reviewer || ''} onChange={e=>onChange({reviewer:e.target.value})}/></label>
  <label>Private evidence reference code<input maxLength={100} value={value.reference || ''} onChange={e=>onChange({reference:e.target.value})}/></label>
  <label>Review date<input type="date" value={value.date || ''} onChange={e=>onChange({date:e.target.value})}/></label>
 </div>;
}

function IdentityReview({fields,value,onChange,printing}) {
 return <>
  <p>{printing ? 'Compare this physical card with the independent source. Enter N/A only for fields the evidence supports as inapplicable.' : 'Check each identity claim against the independent source.'}</p>
  <div className="grid">{fields.map(field=><label key={field}>{fieldLabel(field)}
   <input maxLength={120} value={value.fields?.[field] || ''} onChange={e=>onChange({fields:{...value.fields,[field]:e.target.value}})}/>
  </label>)}</div>
  <div className="grid">
   <label>Source type<select value={value.kind || ''} onChange={e=>onChange({kind:e.target.value})}>
    <option value="">Choose source</option><option value="manufacturer_checklist">Manufacturer checklist</option><option value="independent_catalog">Independent catalog</option>
   </select></label>
   <label>Source record HTTPS URL<input type="url" maxLength={400} value={value.url || ''} onChange={e=>onChange({url:e.target.value})}/></label>
  </div>
  <Receipt value={value} onChange={onChange} label={printing?'Printing':'Identity'}/>
 </>;
}

export default function AccuracyLab() {
 const [slots,setSlots] = useState([]);
 const [selected,setSelected] = useState('');
 const [drafts,setDrafts] = useState({});
 const [photos,setPhotos] = useState({});
 const [statuses,setStatuses] = useState({});
 const [pending,setPending] = useState({});
 const [expires,setExpires] = useState(0);
 const [key,setKey] = useState('');
 const [busy,setBusy] = useState(false);
 const [message,setMessage] = useState('');
 const urls = useRef(new Set());
 const localSlots = useRef(0);
 const active = useRef(true);

 function clear() {
  for (const url of urls.current) URL.revokeObjectURL(url);
  urls.current.clear();
  localSlots.current = 0;
  setSlots([]); setSelected(''); setDrafts({}); setPhotos({}); setStatuses({}); setPending({}); setExpires(0);
 }

 async function load() {
  const state = await request('/api/accuracy-lab');
  if (!active.current) return;
  setSlots(state.slots);
  setSelected(state.slots[0]?.id || '');
  setExpires(state.expiresAt);
 }
 useEffect(()=>{
  active.current = true;
  load().catch(()=>{});
  const leave = () => {active.current = false;clear();};
  const restore = event => {if (event.persisted) {active.current = true;load().catch(()=>{});}};
  window.addEventListener('pagehide',leave);
  window.addEventListener('pageshow',restore);
  return ()=>{
   active.current = false;
   window.removeEventListener('pagehide',leave);
   window.removeEventListener('pageshow',restore);
   for (const url of urls.current) URL.revokeObjectURL(url);
   urls.current.clear();
  };
 },[]);
 useEffect(()=>{
  if (!expires) return;
  const timer = setTimeout(()=>{clear();setMessage('Owner session expired. Authorize again to start a new review.');},Math.max(0,expires-Date.now()));
  return ()=>clearTimeout(timer);
 },[expires]);

 const draft = drafts[selected] || {id:selected,mode:'draft'};
 const slot = slots.find(row=>row.id===selected);
 const pair = photos[selected] || {};
 function update(change,id=selected) {
  setDrafts(previous=>({...previous,[id]:{id,mode:'draft',...previous[id],...change}}));
  setStatuses({});
  setPending({});
 }
 function changeStep(step,change) {
  update({[step]:{...draft[step],...change}});
 }
 function addSlot() {
  if (localSlots.current >= 10) return;
  const id = 'GP-OWNER-'+crypto.randomUUID();
  localSlots.current++;
  setSlots([...slots,{id,name:'New card',status:'draft'}]);
  update({name:'',category:'sports_owner'},id);
  setSelected(id);
 }
 async function choose(side,file) {
  setBusy(true);setMessage('');
  try {
   const prepared = await normalizeMobileImage(file);
   const digest = await crypto.subtle.digest('SHA-256',await prepared.arrayBuffer());
   if (!active.current || Date.now() >= expires) return;
   const sha256 = Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
   if (pair[side]) {
    URL.revokeObjectURL(pair[side].url);
    urls.current.delete(pair[side].url);
   }
   const url = URL.createObjectURL(prepared);
   urls.current.add(url);
   setPhotos({...photos,[selected]:{...pair,[side]:{prepared,url,sha256}}});
   update({hashes:{...draft.hashes,[side]:sha256},photo:{},condition:{},printing:{...draft.printing,reference:''},grading:{...draft.grading,reference:''}});
  } catch {setMessage('Unable to prepare this photo. Choose a supported image under 25 MB.');}
  finally {setBusy(false);}
 }
 async function authorize(event) {
  event.preventDefault();
  setBusy(true);setMessage('');
  try {
   await request('/api/scan-diagnostics',{action:'authorize',key});
   await load();
  } catch {setMessage('Owner authorization failed. Check the diagnostics key and Preview settings.');}
  finally {setKey('');setBusy(false);}
 }
 async function exportReview(action) {
  setBusy(true);setMessage('');
  try {
   const packet = await request('/api/accuracy-lab',{action,drafts:Object.values(drafts)});
   if (!active.current || Date.now() >= expires) return;
   if (action === 'review') {setStatuses(packet.statuses);setPending(packet.pending);}
   download(new Blob([JSON.stringify(packet,null,2)+'\n'],{type:'application/json'}),
    action === 'review' ? 'gempredict-private-review.json' : 'gempredict-redacted-scorecard.json');
   setMessage(action === 'review' ? 'Private review exported. Check slot statuses and download the reviewed JPEGs while this page is open.' : 'Redacted coverage exported. Accuracy requires separate linked blind trials.');
  } catch (error) {
   if (error.message === 'expired') clear();
   setMessage(messages[error.message] || (error.message === 'expired' ? 'Owner authorization expired.' : 'Export failed. Check the review fields and try again.'));
  } finally {setBusy(false);}
 }
 async function exportPhoto(side) {
  setBusy(true);setMessage('');
  try {
   const packet = await request('/api/accuracy-lab',{action:'review',drafts:[draft]});
   const approved = packet.blindInputs[selected]?.images.some(image=>image.side===side && image.sha256===pair[side]?.sha256);
   if (!active.current || Date.now() >= expires) return;
   if (!approved) {setMessage('Complete and confirm the photo review before downloading a blind image.');return;}
   download(pair[side].prepared,side+'.jpg');
  } catch(error) {
   if (error.message === 'expired') clear();
   setMessage('Unable to download the reviewed photo. Check owner authorization and photo review.');
  } finally {setBusy(false);}
 }
 const rows = draft.condition?.observations || [];
 return <main>
  <h1>Accuracy Lab</h1>
  <p>Review cards privately before a blind benchmark trial. Photos stay in this browser tab. Download approved evidence and both prepared JPEGs before leaving or your session expires. Incomplete review steps stay in this tab.</p>
  <p role="status">{message}</p>
  {!expires ? <form onSubmit={authorize}>
   <label>Owner diagnostics key<input type="password" autoComplete="off" required value={key} onChange={e=>setKey(e.target.value)}/></label>
   <button disabled={busy}>Authorize</button>
  </form> : slot && <fieldset disabled={busy}>
   <div className="grid">
    <label>Benchmark card<select value={selected} onChange={e=>setSelected(e.target.value)}>
     {slots.map(row=><option key={row.id} value={row.id}>{drafts[row.id]?.name || row.name} · {statusLabels[statuses[row.id] || (drafts[row.id]?.mode==='owner_reported'?'owner_reported':row.status)]}</option>)}
    </select></label>
    <button type="button" onClick={addSlot} disabled={localSlots.current>=10}>Add card slot</button>
   </div>
   {!slot.category && <div className="grid">
    <label>Card name<input maxLength={120} value={draft.name} onChange={e=>update({name:e.target.value})}/></label>
    <label>Category<select value={draft.category} onChange={e=>update({category:e.target.value,printing:{}})}>
     <option value="sports_owner">Sports</option><option value="pokemon_owner">Pokémon</option>
    </select></label>
   </div>}
   <p>{slot.coreReviewed ? 'Existing independent core identity review.' : 'Core identity needs independent evidence.'} {slot.photosReviewed ? 'Photos linked.' : 'No reviewed photo pair in the baseline.'} {slot.printingReviewed ? 'Printing reviewed.' : 'Physical printing evidence still needs review.'}</p>
   {pending[selected]?.reasons.length > 0 && <ul>{pending[selected].reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
   <label>Review status<select value={draft.mode} onChange={e=>update({mode:e.target.value})}>
    <option value="draft">Draft</option><option value="owner_reported">Owner-reported</option><option value="reviewed">Submit evidence for independent review status</option>
   </select></label>
   <details><summary>Core card identity</summary>
    <IdentityReview fields={CORE_FIELDS} value={draft.core || {}} onChange={change=>changeStep('core',change)}/>
   </details>
   <details><summary>Exact printing and variation</summary>
    <IdentityReview printing fields={slot.fields || newExactFields[draft.category]} value={draft.printing || {}} onChange={change=>changeStep('printing',change)}/>
   </details>
   <details open><summary>Photos and blind input</summary>
    <p>Choose a cropped front and back. Review the prepared previews at full size and make sure slab labels, grades, and other hints are outside the image. JPEG preparation re-encodes the pixels without the original metadata.</p>
    <div className="grid">{['front','back'].map(side=><div key={side}>
     <label>{fieldLabel(side)} photo<input type="file" accept="image/*,.heic,.heif" onChange={e=>{if(e.target.files[0])choose(side,e.target.files[0]);e.target.value='';}}/></label>
     {pair[side] && <>
      <a href={pair[side].url} target="_blank" rel="noreferrer"><img src={pair[side].url} alt={'Prepared '+side}/></a>
      <small>SHA-256 <code>{pair[side].sha256}</code></small>
      <button type="button" onClick={()=>exportPhoto(side)}>Download reviewed {side} JPEG</button>
     </>}
    </div>)}</div>
    <Receipt label="Photo" value={draft.photo || {}} onChange={change=>changeStep('photo',change)}/>
    <label><input type="checkbox" checked={!!draft.photo?.cardOnlyPixels} onChange={e=>changeStep('photo',{cardOnlyPixels:e.target.checked})}/> I inspected both previews. Only the card is visible, with no grade or slab label.</label>
    <label><input type="checkbox" checked={!!draft.photo?.metadataStripped} onChange={e=>changeStep('photo',{metadataStripped:e.target.checked})}/> I confirmed the blind inputs are the prepared JPEGs with original metadata removed.</label>
    <label>Photo limitations (comma-separated)<input maxLength={240} value={draft.photo?.qualityText || ''} onChange={e=>changeStep('photo',{qualityText:e.target.value,qualityLimitations:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label>
   <label><input type="checkbox" checked={!!draft.photo?.identityAssessable} onChange={e=>changeStep('photo',{identityAssessable:e.target.checked})}/> These photos show enough detail to identify the card.</label>
   </details>
   <details><summary>Visible condition</summary>
    <p>Record only what you can see. Use region codes such as top-left or upper-edge and limitation codes such as glare or blur.</p>
    <Receipt label="Condition" value={draft.condition || {}} onChange={change=>changeStep('condition',change)}/>
    {rows.map((row,index)=>{
     const edit=change=>changeStep('condition',{observations:rows.map((item,i)=>i===index?{...item,...change}:item)});
     return <div className="grid region" key={index}>
      <label>Attribute<select value={row.attribute} onChange={e=>edit({attribute:e.target.value})}>{['centering','corners','edges','surface'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Side<select value={row.side} onChange={e=>edit({side:e.target.value})}><option>front</option><option>back</option></select></label>
      <label>Region<input value={row.location} maxLength={100} onChange={e=>edit({location:e.target.value})}/></label>
      <label>Finding<select value={row.state} onChange={e=>edit({state:e.target.value})}><option>uncertain</option><option>defect</option><option>clear</option></select></label>
      <label>Limitations (comma-separated)<input maxLength={240} value={row.limitationText || ''} onChange={e=>edit({limitationText:e.target.value,limitations:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label>
      <button type="button" onClick={()=>changeStep('condition',{observations:rows.filter((_,i)=>i!==index)})}>Remove finding</button>
     </div>;
    })}
    <button type="button" disabled={rows.length>=48} onClick={()=>changeStep('condition',{observations:[...rows,emptyRow]})}>Add condition finding</button>
   </details>
   <details><summary>Observed grading outcome (optional)</summary>
    <p>Record a separately documented PSA grade here. Use a private reference code for the grading record.</p>
    <label>Observed PSA grade<select value={draft.grading?.grade || ''} onChange={e=>changeStep('grading',{grade:Number(e.target.value) || null})}>
     <option value="">No grading outcome</option>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}
    </select></label>
    <Receipt label="Grading outcome" value={draft.grading || {}} onChange={change=>changeStep('grading',change)}/>
   </details>
   <p>Use letters, digits, periods, hyphens or underscores for reviewer and evidence codes. A checked photo attestation or owner assertion alone cannot establish independent identity or printing evidence.</p>
   <div className="grid">
    <button type="button" onClick={()=>exportReview('review')}>Download private review packet</button>
    <button type="button" onClick={()=>exportReview('scorecard')}>Download redacted scorecard</button>
   </div>
  </fieldset>}
  <style jsx global>{`
   body{margin:0;background:#f5f5ef;color:#18241e;font:16px/1.55 system-ui,sans-serif}
   main{box-sizing:border-box;max-width:54rem;margin:auto;padding:1.25rem}
   h1{margin-bottom:0} fieldset{padding:0;border:0;min-width:0}
   details{border:1px solid #c5d4c9;background:white;padding:.85rem;margin:.75rem 0;border-radius:.6rem}
   summary{cursor:pointer;font-weight:650;min-height:2rem}
   .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:.6rem;align-items:end}
   label{display:block;margin:.35rem 0} input,select,button{font:inherit}
   input:not([type=checkbox]),select{box-sizing:border-box;width:100%;min-height:2.65rem;border:1px solid #788e80;background:white;border-radius:.35rem;padding:.35rem}
   button{border:0;border-radius:.4rem;background:#254f3c;color:white;min-height:2.75rem;padding:.5rem .8rem;margin:.3rem 0;cursor:pointer}
   button:disabled{opacity:.55} img{display:block;max-width:100%;max-height:18rem} code{overflow-wrap:anywhere}
   small{display:block} .region{border-top:1px solid #c5d4c9;padding:.6rem 0}
  `}</style>
 </main>;
}
AccuracyLab.excludeAnalytics = true;

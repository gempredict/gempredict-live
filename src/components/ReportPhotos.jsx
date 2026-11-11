import React,{useState,useEffect} from 'react';
export default function ReportPhotos({photos}){
 const [side,setSide]=useState('front'),[urls,setUrls]=useState({}),[failed,setFailed]=useState({});
 useEffect(()=>{const next={};for(const s of ['front','back'])if(photos?.[s] instanceof Blob&&photos[s].type==='image/jpeg')next[s]=URL.createObjectURL(photos[s]);setUrls(next);setFailed({});return ()=>Object.values(next).forEach(url=>URL.revokeObjectURL(url));},[photos]);
 return <section aria-label="Submitted card photographs" style={{margin:'14px 0',padding:16,background:'#171c17',borderRadius:14,color:'#fff'}}>
  <div style={{display:'flex',gap:8,marginBottom:12}}>{['front','back'].map(s=><button type="button" key={s} aria-pressed={side===s} onClick={()=>setSide(s)} style={{padding:'9px 16px',minHeight:44,border:'1px solid #c9a84c',borderRadius:8,background:side===s?'#c9a84c':'transparent',color:side===s?'#111':'white'}}>{s==='front'?'Front':'Back'}</button>)}</div>
  {urls[side]&&!failed[side]?<img src={urls[side]} alt={`${side==='front'?'Front':'Back'} submitted card photograph`} onError={()=>setFailed(f=>({...f,[side]:true}))} style={{display:'block',width:'100%',maxHeight:420,objectFit:'contain',imageOrientation:'from-image',borderRadius:8}}/>:<p>{photos?.[side]?'Photograph unavailable in this session.':photos?'This photograph was not supplied.':'Submitted photos are not retained in saved or restored reports. Re-upload to view them.'}</p>}
  <p style={{fontSize:12,color:'#ddd'}}>Your submitted photograph · session only · no catalog artwork</p>
 </section>;
}

import React,{useEffect,useMemo} from 'react';
import Head from 'next/head';
import {ResultCard} from '../src/App';
import {qualifyCompletedSales} from '../lib/completedSales.mjs';
import {demoPageProps} from '../lib/demoReportServer.mjs';
export function getServerSideProps(context){return demoPageProps(context);}
export default function DemoReport({report,example,examples,asOf,expiresAt}){
 // No fake approvals, transactions, mappings or image bytes. Exercise the real empty-sales qualifier.
 const evidence=useMemo(()=>qualifyCompletedSales([],{now:asOf,policies:[],mappings:[],coverage:{complete:null}}),[asOf]);
 useEffect(()=>{const timer=setTimeout(()=>window.location.replace('/demo-report'),Math.max(0,expiresAt-Date.now()));return()=>clearTimeout(timer);},[expiresAt]);
 return <><Head><title>DEMO — SYNTHETIC DATA · GemPredict</title><meta name="robots" content="noindex,nofollow"/><style>{'body{margin:0;background:#ffffff}'}</style></Head><main style={{background:'#ffffff',minHeight:'100vh',padding:'20px 12px',fontFamily:'Arial,sans-serif'}}><div style={{maxWidth:1040,margin:'auto'}}>
  <header style={{color:'#42483b',padding:'8px 4px 18px',marginBottom:4}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><h1 style={{fontSize:15,color:'#995519',margin:0,letterSpacing:'.04em'}}>DEMO — SYNTHETIC DATA</h1><a href="/" style={{color:'#626859',fontSize:12,minHeight:44,display:'inline-flex',alignItems:'center'}}>Return to scanner</a></div><nav aria-label="Demo examples" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{examples.map(e=><a key={e.id} href={'/demo-report?example='+e.id} aria-current={example===e.id?'page':undefined} aria-label={e.label} style={{color:example===e.id?'#865317':'#626859',background:example===e.id?'#fff6de':'#f6f5f0',border:'1px solid #e0d8c2',borderRadius:9,padding:'11px 12px',fontSize:12,textDecoration:'none',minHeight:44,boxSizing:'border-box',display:'inline-flex',alignItems:'center'}}>{e.id==='pokemon'?'Pokémon · Fraxure':'Sports · Konnor Griffin'}</a>)}</nav><details style={{fontSize:12,marginTop:10}}><summary style={{cursor:'pointer',minHeight:44,padding:'10px 0',color:'#666b5d'}}>About this owner-only demo</summary><p>Mock catalog and condition evidence, not observations of a physical card. No scan or marketplace request. Fixture date: {asOf.slice(0,10)}. Reports cannot be saved or shared. Financial outputs remain withheld.</p></details></header>
  <ResultCard data={report} index={0} isSaved={false} demo completedSalesEvidence={evidence}/>
 </div></main></>;
}

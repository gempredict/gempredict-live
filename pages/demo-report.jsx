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
 return <><Head><title>DEMO — SYNTHETIC DATA · GemPredict</title><meta name="robots" content="noindex,nofollow"/></Head><main style={{background:'#10140f',minHeight:'100vh',padding:'20px 12px',fontFamily:'Arial,sans-serif'}}><div style={{maxWidth:1040,margin:'auto'}}>
  <header style={{background:'#fff0c4',color:'#222',padding:18,borderRadius:12,marginBottom:16}}><h1 style={{fontSize:22,marginTop:0}}>DEMO — SYNTHETIC DATA</h1><p>Owner-only Preview example. No paid scan, real card photograph, marketplace request or transaction. Catalog and condition evidence below are mocked, not independently verified observations of a physical card.</p><p>Fixture date: {asOf.slice(0,10)}. Sales and grading recommendations remain withheld. Demo reports cannot be saved, shared or added to scan history.</p><nav aria-label="Demo examples" style={{display:'flex',gap:16,flexWrap:'wrap'}}>{examples.map(e=><a key={e.id} href={'/demo-report?example='+e.id} aria-current={example===e.id?'page':undefined} style={{color:'#70561e',fontWeight:700,padding:'10px 0'}}>{e.label}</a>)}</nav><a href="/" style={{color:'#70561e'}}>Return to scanner</a></header>
  <ResultCard data={report} index={0} isSaved={false} demo completedSalesEvidence={evidence}/>
 </div></main></>;
}

import { useState } from 'react';
import { conditionPresentation } from '../lib/visualEvidence.mjs';

const cases = [
  { name: 'Visible edge wear', analysis: { inspectedSides:['front','back'], visualObservations:[{attribute:'edges',code:'whitening',certainty:'confirmed',evidence:{side:'front',region:[0.02,0.2,0.05,0.15],cue:'localized_color_loss',confidence:0.94}}] } },
  { name: 'Glare / uncertain', analysis: { inspectedSides:['front'],imageLimitations:['glare','back_not_visible'],visualObservations:[{attribute:'surface',code:'scratches',certainty:'suspected',evidence:{side:'front',region:[0.3,0.4,0.2,0.08],cue:'surface_line',confidence:0.55}}] } },
  { name: 'Insufficient evidence', analysis: { inspectedSides:['front'],visualObservations:[] } },
  { name: 'One clear inspected area', analysis: { inspectedSides:['front','back'],visualObservations:[{attribute:'corners',code:'no_defect_observed',certainty:'confirmed',evidence:{side:'front',region:[0.03,0.03,0.07,0.07],cue:'clear_inspected_area',confidence:0.94}}] } }
];

export default function HybridDemo() {
  const [index, setIndex] = useState(0);
  const report = conditionPresentation(cases[index].analysis);
  return <main style={{background:'#f9f6ef',minHeight:'100vh',padding:'24px 16px',fontFamily:'Arial,sans-serif',color:'#121720'}}>
    <div style={{maxWidth:850,margin:'auto'}}>
      <a href="/" style={{color:'#121720'}}>GemPredict home</a>
      <p style={{color:'#95753b',fontWeight:700,letterSpacing:2,fontSize:12}}>GEMPREDICT / HYBRID EXPERIMENT</p>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:38}}>GemPredict Report · Visual Checkpoint</h1>
      <p>Review the original-style financial report and photo condition assessment together. Choose a synthetic condition scenario below. This page does not scan cards, call AI services, or retrieve prices.</p>
      <div style={{background:'#fff0c9',padding:15,borderRadius:10,margin:'20px 0'}}><strong>DEMO DATA ONLY</strong> — No real photographs, grading results, or financial values.</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:9,marginBottom:20}}>
        {cases.map((item,i)=><button key={i} aria-pressed={index===i} onClick={()=>setIndex(i)} style={{padding:12,borderRadius:25,border:'1px solid #cab78b',background:index===i?'#171c25':'white',color:index===i?'white':'#171c25',cursor:'pointer'}}>{item.name}</button>)}
      </div>
      <section data-testid="demo-financial-report" style={{borderRadius:17,background:'white',overflow:'hidden',border:'1px solid #ddd5c5',marginBottom:20}}>
        <header style={{background:'#0d1117',color:'#d2b36e',padding:19,fontWeight:800}}>GEMPREDICT REPORT / FINANCIAL EVIDENCE</header>
        <div style={{padding:24}}>
          <p style={{letterSpacing:1,fontSize:12,fontWeight:800,color:'#95753b'}}>DECISION STATUS</p>
          <h2 style={{fontFamily:'Georgia,serif',margin:'7px 0'}}>Financial recommendation pending</h2>
          <p style={{lineHeight:1.6}}>Verified completed-sales evidence is required before we calculate a defensible GemPredict Score or advise grading for profit.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginTop:20}}>
            {['RAW CARD','PSA 9','PSA 10'].map(label=><div key={label} style={{background:'#f5f3ee',padding:18,borderRadius:12,border:'1px solid #e2dfd8'}}>
              <div style={{fontSize:12,letterSpacing:1,fontWeight:800}}>{label}</div>
              <div style={{fontSize:26,fontWeight:800,margin:'9px 0'}}>—</div>
              <div style={{color:'#62666e',fontSize:13}}>Verified sale price unavailable</div>
            </div>)}
          </div>
          <div style={{marginTop:20,padding:16,background:'#f9f6ef',borderRadius:12}}>
            <strong>eBay comparable evidence</strong>
            <p style={{fontSize:14,lineHeight:1.5,marginBottom:0}}>Actual listing links will appear here when returned and verified. Asking listings will be labeled separately from completed sales. No example links or prices have been fabricated for this preview.</p>
          </div>
        </div>
      </section>
      <section style={{borderRadius:17,background:'white',overflow:'hidden',border:'1px solid #ddd5c5'}}>
        <header style={{background:'#0d1117',color:'#d2b36e',padding:19,fontWeight:800}}>PHOTO CONDITION ANALYSIS / EXPERIMENTAL</header>
        <div style={{padding:24}}>
          <h2>{cases[index].name}</h2>
          <div data-testid="demo-outlook" style={{background:'#f5efe1',padding:20,borderRadius:12}}>
            <p style={{fontSize:12,fontWeight:800,letterSpacing:1}}>PHOTO CONDITION OUTLOOK</p>
            <h3 style={{fontSize:23,margin:'8px 0'}}>{report.conditionOutlook.label}</h3>
            <p style={{lineHeight:1.6}}>{report.conditionOutlook.reason}</p>
          </div>
          <h3>Observed attributes</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
            {['centering','corners','edges','surface'].map(attr=><div key={attr} style={{background:'#faf7f1',padding:15,borderRadius:10}}>
              <strong style={{textTransform:'capitalize'}}>{attr}</strong>
              <p style={{fontSize:14,lineHeight:1.5}}>{report[attr+'Note']}</p>
            </div>)}
          </div>
          <p style={{fontSize:13,color:'#566172',marginTop:22}}>Financial decision and PSA grade: not established by this demonstration.</p>
        </div>
      </section>
    </div>
  </main>;
}

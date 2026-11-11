import React from 'react';
import {collectorConditions,collectorLimitations} from '../../lib/collectorPresentation.mjs';
import {conditionSnapshot} from '../../lib/unifiedReportPresentation.mjs';
export default function ConditionSnapshot({data=null,demo=false}){
 if(!data)return <p className="gp-empty">Condition analysis: not requested. No photographic condition assessment is available.</p>;
 const overview=conditionSnapshot(collectorConditions(data)),limitations=collectorLimitations(data);
 return <><div className="gp-condition-grid">{overview.map(a=><div className="gp-condition" key={a.key}><h4>{a.name}</h4><strong>{a.state}</strong><p>{a.brief}</p><small>{a.state==='No visible defect in inspected areas'?'Inspected regions only; not proof of whole-card cleanliness.':a.state==='Possible visible damage'?'Photo evidence is inconclusive.':'More photo evidence needed.'}</small></div>)}</div>
  <p className="gp-fine">{demo?'Synthetic observations. ':''}Photo evidence only — no grade prediction.{limitations.length?' '+limitations.slice(0,2).join(' '):''}</p>
  <details><summary>Detailed Condition Findings</summary><div className="gp-detail-body">
   {overview.map(a=><section className="gp-condition-detail" key={a.key}><h4>{a.name}</h4>{a.groups.length?a.groups.map((o,n)=><div key={n}><p><strong>{o.side==='front'?'Front photo':o.side==='back'?'Back photo':'Photograph not established'}</strong> · {o.text}</p><p className="gp-fine">{o.certainty.replace(/_/g,' ')}{o.cue?' · '+o.cue.replace(/_/g,' '):''}{o.locations.length?' · '+o.locations.length+' model-proposed region(s)':''}</p>{o.locations.length>0&&<p className="gp-fine">Image regions: {o.locations.map(r=>'['+r.join(', ')+']').join('; ')}. Locations are not independently verified geometry.</p>}</div>):<p>No supported observations.</p>}</section>)}
   {limitations.length>0&&<><h4>Photo limitations</h4>{[...new Set(limitations)].map(s=><p key={s}>{s}</p>)}</>}
   {(data.modelPhotoNotes||[]).map((n,i)=><p key={i}>Model photo note — unverified ({n.side||'unknown photo'}): {n.text}</p>)}
   <p>Unassessed areas are not clean areas. Centering measurements require defensible image geometry. These observations do not establish a grade or submission recommendation.</p>
   <details><summary>Inspection coverage &amp; original evidence</summary><pre>{JSON.stringify({visualObservations:data.visualObservations,conditionAssessments:data.conditionAssessments,inspectionCoverage:data.inspectionCoverage,conditionEvidenceLimits:data.conditionEvidenceLimits,centeringMeasurementStatus:data.centeringMeasurementStatus,imageSummary:data.imageSummary,gradingRisk:data.gradingRisk},null,2)}</pre></details>
  </div></details>
 </>;
}

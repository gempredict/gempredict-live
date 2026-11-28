import React from 'react';
import {collectorConditions,collectorLimitations} from '../../lib/collectorPresentation.mjs';
import {compactFindingLabel,conditionSnapshot} from '../../lib/unifiedReportPresentation.mjs';
export default function ConditionSnapshot({data=null,demo=false}){
 if(!data)return <p className="gp-empty">Condition analysis: not requested. No photographic condition assessment is available.</p>;
 const overview=conditionSnapshot(collectorConditions(data)),limitations=collectorLimitations(data);
 const compact=data.compactPhotoObservations||[];
 const photoNotes=data.modelPhotoNotes||[];
 const qualityLimited=data.photoSideUncertain?.length||data.imageLimitations?.some(code=>
  ['glare','blur','cropped','occluded','limited_resolution','sleeve'].includes(code));
 return <>{qualityLimited? <p className="gp-fine" role="status">Photo quality limits inspection. Check front and back order and retake affected photos with the entire card visible, in focus and free of strong reflections.</p>:null}
  <div className="gp-condition-grid">{overview.map(a=>{
   const findings=compact.filter(row=>row.attribute===a.key);
   const notes=findings.length?[]:photoNotes.filter(note=>note.attribute===a.key);
   return <div className="gp-condition" key={a.key}><h4>{a.name}</h4>
    <strong>{findings.length&&!a.groups.length?(data.conditionAssessments?.[a.key]?.state==='model_observations_available'?'Model photo observations':'Unable to assess reliably'):notes.length&&!a.groups.length?'Photo notes':a.state}</strong>
    {a.groups.length||(!notes.length&&!findings.length)?<p>{a.brief}</p>:null}
    {findings.map((row,i)=><p key={i}>{row.side==='front'?'Front':'Back'} · {compactFindingLabel(row)}: {row.text}</p>)}
    {!a.groups.length&&notes.map(note=><p key={note.text}>{note.side==='front'?'Front':note.side==='back'?'Back':'Side unclear'}: {note.text}</p>)}
   </div>;
  })}</div>
  <p className="gp-fine">{demo?'Synthetic observations. ':''}Photo evidence only — no grade prediction. Regional findings do not establish whole-card cleanliness; unassessed areas remain unknown.{limitations.length?' Limits: '+collectorLimitations(data,{compact:true}).join('; ')+'.':''}</p>
  <details><summary>Detailed Condition Findings</summary><div className="gp-detail-body">
   {overview.map(a=><section className="gp-condition-detail" key={a.key}><h4>{a.name}</h4>{a.groups.length?a.groups.map((o,n)=><div key={n}><p><strong>{o.side==='front'?'Front photo':o.side==='back'?'Back photo':o.reportedSide?'Reported '+o.reportedSide+' — side provenance unverified':'Photograph not established'}</strong> · {o.collectorText}{o.reasonCodes?.includes('contradictory_observations')?' Overlapping observations disagree.':''}</p><p className="gp-fine">{o.certainty.replace(/_/g,' ')}{o.cue?' · '+o.cue.replace(/_/g,' '):''}{o.locations.length?' · '+o.locations.length+' model-proposed region(s)':''}</p>{o.locations.length>0&&<p className="gp-fine">Image regions: {o.locations.map(r=>'['+r.join(', ')+']').join('; ')}. Locations are not independently verified geometry.</p>}</div>):!compact.some(row=>row.attribute===a.key)&&!photoNotes.some(note=>note.attribute===a.key)&&<p>No supported observations.</p>}</section>)}
   {limitations.length>0&&<><h4>Photo limitations</h4>{[...new Set(limitations)].map(s=><p key={s}>{s}</p>)}</>}
   {photoNotes.filter(note=>!compact.some(row=>row.attribute===note.attribute&&row.side===note.side)).map((n,i)=><p key={i}>Model photo note — unverified ({n.side||'unknown photo'}): {n.text}</p>)}
   <p>Suspected defects require physical confirmation. Centering requires measured geometry; submission advice remains withheld.</p>
   <details><summary>Inspection coverage &amp; original evidence</summary><pre>{JSON.stringify({modelPhotoNotes:data.modelPhotoNotes,visualObservations:data.visualObservations,conditionAssessments:data.conditionAssessments,inspectionCoverage:data.inspectionCoverage,conditionEvidenceLimits:data.conditionEvidenceLimits,centeringMeasurementStatus:data.centeringMeasurementStatus,imageSummary:data.imageSummary,gradingRisk:data.gradingRisk},null,2)}</pre></details>
  </div></details>
 </>;
}

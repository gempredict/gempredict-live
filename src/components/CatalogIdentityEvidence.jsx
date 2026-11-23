import { identityClaimLabels, reportCatalogIdentityEvidence } from '../../lib/catalogIdentityEvidence.mjs';

const format=value=>Array.isArray(value)?value.join(' / '):value;
const kindLabels={ai_proposal:'AI proposal',saved_proposal:'Saved identification proposal',owner_review:'Owner-reviewed assertion',photo_observation:'Photo observation',catalog:'Catalog record'};
const statusLabels={
 catalog_supported:'Catalog supports claim',catalog_record_only:'Recorded in catalog',catalog_alternatives:'Catalog alternatives',
 conflict:'Conflict',observed:'Observed in photo',owner_reviewed:'Owner reviewed',proposed:'Proposed',unresolved:'Unresolved',
};

export default function CatalogIdentityEvidence({report}) {
 const result=reportCatalogIdentityEvidence(report);
 return <details className="gp-reference-panel">
  <summary>Identity evidence · {statusLabels[result.status]}</summary>
  <p><strong>Exact physical printing unverified.</strong> {result.nextAction}</p>
  {result.missing.length>0&&<p>Missing identity details: {result.missing.map(field=>identityClaimLabels[field]).join(', ')}.</p>}
  {result.priorConflicts.length>0&&<p>Earlier disagreements retained: {result.priorConflicts.map(field=>identityClaimLabels[field]).join(', ')}.</p>}
  {result.catalogAmbiguity&&<p>Multiple catalog records remain possible.</p>}
  <dl>{Object.entries(result.claims).filter(([,claim])=>claim.proposed.length||claim.supported.length).map(([field,claim])=>
   <div key={field}><dt>{identityClaimLabels[field]} · {statusLabels[claim.status]}</dt>
    <dd>{[...claim.proposed,...claim.supported].map((row,index)=><p key={index}>{format(row.value)} · {row.evidence.map(item=>
     item.kind==='catalog'?`${kindLabels.catalog} ${result.records[item.recordIndex].recordId}`:
     item.kind==='photo_observation'?`${kindLabels.photo_observation} (${item.side}, ${item.certainty})`:kindLabels[item.kind]).join(' · ')}</p>)}</dd></div>)}</dl>
  {result.records.length>0&&<ul>{result.records.map(record=><li key={record.source+'/'+record.recordId}>
   {record.source} · {record.provenance} · {record.recordId} · {record.revision||record.retrievedAt}</li>)}</ul>}
 </details>;
}

import {protectFinancialReport,protectedCopySummary} from '../../lib/financialSafety.mjs';
import {reportTitle,verificationRows} from '../../lib/reportVerification.mjs';
import ScanDiagnostics from './ScanDiagnostics';
// An identification result never renders the condition/economics report.
export default function IdentityResult({report,onSave}){
 const r=protectFinancialReport(report),original=r.originalIdentityObservation||{};
 const verified=r.pokemonIdentityStatus?.catalogVerified===true;
 const printed=r.printedIdentityEvidence||r.identityVerification?.printed;
 const rows=verificationRows(r);
 if(!r.identityVerification)rows[0]={...rows[0],reason:'No trusted independent catalog is connected for this card category. This is an unverified photo identification proposal.'};
 const show=value=>value||'Unresolved';
 return <section aria-label="Card identification result" style={{marginTop:24,padding:24,border:'1px solid #e2d9ca',borderRadius:18,background:'#fff'}}>
  <p style={{fontSize:12,fontWeight:700}}>Card identification · {r.photoIdentityStatus?.status==='conflict'?'Identity conflict — review required':r.photoIdentityStatus?.photoSupported?'Catalog and printed evidence agree':verified?'Catalog supported — photo evidence incomplete':'Unverified proposal'}</p>
  <h3>{reportTitle(r)}</h3>
  {r.verificationRuntimeFailed&&<p role="status">Photo identification completed, but catalog verification encountered a runtime problem. The proposal remains unverified.</p>}
  <p>Condition analysis: not requested. Marketplace discovery: not requested.</p>
  <dl>{rows.map(row=><div key={row.key} style={{marginBottom:12}}><dt><strong>{row.label}: {row.status}</strong></dt><dd style={{marginLeft:0}}>{row.reason}</dd></div>)}
   <div><dt><strong>Rarity: {verified&&r.canonicalCard?.rarity?'Catalog supported':'Unverified'}</strong></dt><dd style={{marginLeft:0}}>{show(verified?r.canonicalCard?.rarity:original.identifiedRarity)}</dd></div>
  </dl>
  <details open><summary>Printed photo evidence — readings may be uncertain</summary>
   {original.identityReadings?.length?<ul>{original.identityReadings.map((reading,i)=><li key={i}>{reading.field}: {reading.text||'Unreadable'} · {reading.side}, {reading.area} · {reading.certainty}{reading.alternatives?.length?' · Alternatives: '+reading.alternatives.join(' / '):''}</li>)}</ul>:<p>No readable printed evidence was returned.</p>}
   <p>Copyright is printed evidence, not proof of release year. Proposed release year: {show(printed?.proposedReleaseYear)}.</p>
  </details>
  <details><summary>Original AI Observation — Unverified</summary>
   <p>{[original.identifiedYear,original.identifiedBrandSet,original.identifiedSubject,original.identifiedCardNumber,original.identifiedLanguage,original.identifiedParallel].filter(Boolean).join(' ')||'No identity could be proposed.'}</p>
   <p>{original.identityNotes||'No additional uncertainty notes returned.'}</p>
  </details>
  <div style={{display:'flex',gap:12,marginTop:16}}>
   <button type="button" onClick={()=>navigator.clipboard?.writeText(protectedCopySummary(r))}>Copy Identity Summary</button>
   {onSave&&<button type="button" onClick={()=>onSave(r)}>Save Report</button>}
  </div>
  <ScanDiagnostics report={report}/>
 </section>;
}

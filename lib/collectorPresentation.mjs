// Presentation over revalidated report data. No identity or evidence trust grants.
const names={centering:'Centering',corners:'Corners',edges:'Edges',surface:'Surface'};
const fields={subject:'card name',cardNumber:'collector number',year:'year',brandSet:'set',language:'language'};
export function collectorIdentityMessage(r){
 if(r.userIdentityConflicts?.length)return 'Identity needs review: your supplied details disagree with the catalog. Finish and physical printing remain unverified.';
 if(r.identityV2?.category==='pokemon'&&r.identityVerification?.catalog?.source==='tcgdex'&&r.coreCatalogIdentity?.supported){
  const proposed=r.originalIdentityObservation?.identifiedParallel;
  return 'Core catalog identity supported. Finish and physical printing remain unverified.'+(typeof proposed==='string'&&proposed.length<=80?' Proposed finish/parallel: '+proposed+' — unverified.':'')+(r.catalogComparison?.printing?.status==='conflict'?' Catalog finish metadata disagrees with the proposal; printing needs review.':'');
 }
 const conflicts=r.coreCatalogIdentity?.conflicts||[];
 return conflicts.length?'Identity needs review: conflicting '+conflicts.map(f=>fields[f]||'card details').join(', ')+'.':'Identity is an unverified proposal; independent catalog evidence is incomplete or unavailable.';
}
export function collectorConditions(data={}){
 return ['corners','edges','surface','centering'].map(key=>{
  const a=data.conditionAssessments?.[key],rows=a?.observations||[];
  const state=a?.state==='no_defect_observed'?'No visible defect in inspected areas':['confirmed_visible_defect','suspected_defect'].includes(a?.state)?'Possible visible damage':'Unable to assess reliably';
  return {key,name:names[key],state,observations:rows.map(o=>({...o,text:o.code!=='no_defect_observed'?o.text.replace(/^Visible /,'Possible '):o.text}))};
 });
}
export function collectorLimitations(data={}){
 const phrases={glare:'Glare may hide surface details.',blur:'Blur limits reliable inspection.',sleeve:'A sleeve may hide marks or create reflections.',limited_resolution:'The photo resolution limits reliable inspection.',perspective:'The camera angle limits inspection and centering.',cropped:'Part of the card is cropped out.',occluded:'Part of the card is obscured.',back_not_visible:'The back photograph is unavailable; assessment is incomplete.'};
 const out=(data.imageLimitations||[]).map(c=>phrases[c]).filter(Boolean);
 for(const c of data.inspectionCoverage||[])for(const l of c.limitations||[]){const text=(c.side==='back'?'Back':'Front')+' '+c.attribute+': '+phrases[l.code];if(phrases[l.code]&&!out.includes(text))out.push(text);}
 return out;
}

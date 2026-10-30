// Observable condition vocabulary only. No model prose, identity, price or grade
// enters the trusted narrative. Codes remain AI observations, not catalog facts.
const attributes = ['centering', 'corners', 'edges', 'surface'];
const phrases = {
  centering: { off_center: 'Visible off-centering.', miscut: 'Possible miscut visible; inspect the physical card.' },
  corners: { whitening: 'Visible corner whitening.', softening: 'Visible corner softening.', bend: 'Visible corner bend.', crease: 'Visible corner crease.' },
  edges: { whitening: 'Visible edge whitening.', chipping: 'Visible edge chipping.', wear: 'Visible edge wear.', peeling: 'Visible edge peeling.' },
  surface: { scratches: 'Visible surface scratches.', print_lines: 'Visible print lines.', dent: 'Visible surface dent.', crease: 'Visible surface crease.', bend: 'Visible surface bend.', staining: 'Visible surface staining.' },
};
const limitationPhrases = { glare: 'Glare limits surface inspection.', blur: 'Blur limits inspection.', sleeve: 'A sleeve may obscure defects.', back_not_visible: 'The back is not visible; assessment is incomplete.', limited_resolution: 'Image resolution limits inspection.' };
const cues = { off_center:'border_width_difference', miscut:'truncated_print_border', whitening:'localized_color_loss', softening:'rounded_corner_outline', bend:'surface_deformation', crease:'surface_deformation', chipping:'missing_edge_fragment', wear:'localized_color_loss', peeling:'lifted_layer', scratches:'surface_line', print_lines:'printed_line', dent:'surface_depression', staining:'color_patch', no_defect_observed:'clear_inspected_area' };
export function observationSupport(item) {
 const e=item?.evidence;
 if(!e || !['front','back'].includes(e.side) || e.cue!==cues[item.code] || !Number.isFinite(e.confidence) || e.confidence<0 || e.confidence>1 || !Array.isArray(e.region) || e.region.length!==4 || e.region.some(n=>!Number.isFinite(n)||n<0||n>1) || e.region[2]<=0 || e.region[3]<=0 || e.region[0]+e.region[2]>1.001 || e.region[1]+e.region[3]>1.001) return null;
 // Conservative localization policy, not a calibrated defect detector: a
 // damage box covering most of the card cannot pinpoint a scratch/corner/edge.
 if(!['centering'].includes(item.attribute) && item.code!=='no_defect_observed' && e.region[2]*e.region[3]>.5)return null;
 const support={side:e.side,region:[...e.region],cue:e.cue,confidence:e.confidence};
 if(item.attribute==='centering' && item.code==='off_center'){
  const m=e.measurement;
  if(!m || !['horizontal','vertical'].includes(m.axis) || !Array.isArray(m.ratio) || m.ratio.length!==2 || m.ratio.some(n=>!Number.isFinite(n)||n<=0||n>=100) || Math.abs(m.ratio[0]+m.ratio[1]-100)>1 || Math.max(...m.ratio)<60) return null;
  support.measurement={axis:m.axis,ratio:[...m.ratio]};
 }
 return support;
}
export function readVisualEvidence(analysis = {}) {
 const limitations=Array.isArray(analysis.imageLimitations)?[...new Set(analysis.imageLimitations.filter(code=>Object.hasOwn(limitationPhrases,code)))].slice(0,5):[];
 const byCode=new Map();
 for(const item of (Array.isArray(analysis.visualObservations)?analysis.visualObservations:[]).slice(0,32)){
  if(!item || !attributes.includes(item.attribute) || !(Object.hasOwn(phrases[item.attribute],item.code)||item.code==='no_defect_observed'))continue;
  const evidence=observationSupport(item);
  const unseen=evidence && Array.isArray(analysis.inspectedSides) && !analysis.inspectedSides.includes(evidence.side);
  const limited=!!unseen || limitations.some(code=>['blur','limited_resolution'].includes(code)||['glare','sleeve'].includes(code));
  let certainty=item.certainty==='unassessable'||!evidence||unseen||evidence.confidence<0.4?'unassessable':item.certainty==='confirmed'&&evidence.confidence>=0.8&&!limited?'confirmed':'suspected';
  if(item.code==='no_defect_observed'&&certainty!=='confirmed')certainty='unassessable';
  // Independent front/back observations are not contradictory duplicates.
  // Keep same-side duplicate conflict handling conservative.
  const key=item.attribute+':'+item.code+':'+(evidence?.side||'unknown');
  const finding={attribute:item.attribute,code:item.code,certainty,...(evidence?{evidence}: {})};
  const old=byCode.get(key);
  if(old && JSON.stringify(old)!==JSON.stringify(finding))finding.certainty=[old.certainty,finding.certainty].includes('unassessable')?'unassessable':'suspected';
  byCode.set(key,finding);
 }
 // Contradictory clean/defect assertions cannot both establish an assessment.
 const findings=[...byCode.values()];
 // An unsupported duplicate has no trustworthy side; it may conflict with
 // either side, so preserve the prior conservative uncertainty rule.
 for(const f of findings)if(findings.some(other=>other.attribute===f.attribute&&other.code===f.code&&!other.evidence))f.certainty='unassessable';
 for(const attribute of attributes){
  const rows=findings.filter(f=>f.attribute===attribute);
  if(rows.some(f=>f.code==='no_defect_observed')&&rows.some(f=>f.code!=='no_defect_observed'))rows.forEach(f=>{if(f.certainty!=='unassessable')f.certainty='suspected';});
 }
 // Duplicate/conflicting rows may have downgraded a previously confirmed clean
 // observation. Keep that uncertainty out of the damage certainty vocabulary.
 for(const f of findings)if(f.code==='no_defect_observed'&&f.certainty==='suspected')f.certainty='unassessable';
 return {findings,limitations};
}
export function conditionObservationText(f){
 if(f.code==='no_defect_observed')return f.certainty==='confirmed'?'No visible defect observed in the documented area; this is not proof of mint condition.':`The model reported no visible defect; ${f.attribute} remains unassessable because inspection evidence is insufficient. This is not proof of mint condition.`;
 const label=phrases[f.attribute][f.code];
 if(f.certainty==='confirmed')return label;
 return f.certainty==='unassessable'?`Unassessable ${f.attribute}; a defect cannot be established.`:`Possible ${f.attribute} ${f.code.replace(/_/g,' ')}; unconfirmed, inspect the physical card.`;
}
export function conditionPresentation(analysis, { card, identityVerified, trusted } = {}) {
 const {findings,limitations}=readVisualEvidence(analysis);
 const confirmed=findings.filter(f=>f.certainty==='confirmed');
 const structural=confirmed.some(f=>['bend','crease','dent','peeling'].includes(f.code));
 const unverifiedRisk=analysis.visualSafetyFlags?.unverifiedStructuralRisk===true || analysis.visualSafetyFlags?.structuralDamage===true&&!structural;
 const notes=Object.fromEntries(attributes.map(attribute=>[`${attribute}Note`,findings.filter(f=>f.attribute===attribute).map(conditionObservationText).join(' ')||'Not assessed from the photo.']));
 const detail=findings.map(conditionObservationText);
 const riskDetail=findings.filter(f=>f.code!=='no_defect_observed').map(conditionObservationText);
 const identity=identityVerified?[card?.year,card?.brandSet,card?.subject,card?.parallel,card?.cardNumber&&`#${card.cardNumber}`].filter(Boolean).join(' · '):null;
 return {
  conditionAssessments:Object.fromEntries(attributes.map(attribute=>{
   const rows=findings.filter(f=>f.attribute===attribute);
   return [attribute,{state:rows.some(f=>f.certainty==='unassessable')?'unassessable':rows.some(f=>f.certainty==='suspected'&&f.code!=='no_defect_observed')?'suspected_defect':rows.some(f=>f.certainty==='confirmed'&&f.code!=='no_defect_observed')?'confirmed_visible_defect':rows.some(f=>f.certainty==='confirmed'&&f.code==='no_defect_observed')?'no_defect_observed':'unassessable'}];
  })),
  visualEvidenceVersion:2,inspectedSides:Array.isArray(analysis.inspectedSides)?analysis.inspectedSides.filter(side=>['front','back'].includes(side)):['front'],visualObservations:findings,imageLimitations:limitations,...notes,
  visualSafetyFlags:{structuralDamage:structural,unverifiedStructuralRisk:unverifiedRisk,imageQualityLimited:limitations.length>0},
  ...Object.fromEntries(attributes.map(attribute=>{
   const rows=confirmed.filter(f=>f.attribute===attribute);
   return [attribute,findings.some(f=>f.attribute===attribute&&f.certainty!=='confirmed')?null:rows.some(f=>['bend','crease','dent','peeling'].includes(f.code))?'poor':rows.some(f=>f.code!=='no_defect_observed')?'fair':null];
  })),
  imageSummary:`${identity?`Catalog-supported identity: ${identity}.`:'Card identity is unverified.'} Photo observations: ${detail.join(' ')||'Condition is unassessed; absence of a detected defect is not proof of mint condition.'} ${limitations.map(code=>limitationPhrases[code]).join(' ')} These observations do not establish a PSA grade.`,
  gradingRisk:structural?'Visible structural damage requires physical inspection.':unverifiedRisk?'Unverified structural damage warning requires inspection; it is not a confirmed defect.':'Photo inspection can miss defects; inspect the physical card.',
  primaryLimiter:riskDetail[0]||'No supported visible defect established; physical inspection remains necessary.',
  majorGradeCap:structural?'Visible structural damage requires physical inspection.':'A grade ceiling cannot be established from these observations.',
  minorConcerns:riskDetail.join(' ')||'No supported visible defect established; defects may remain unseen.',
  gemRiskFactors:[...riskDetail,...limitations.map(code=>limitationPhrases[code])],
  estimatedGrade:null,gradeCeiling:null,mostLikelyGradeRange:null,psa10Upside:null,overallScore:null,confidenceLevel:null,
  worthGrading:structural||unverifiedRisk?false:null,
  worthGradingReason:!trusted?'Grading recommendations are withheld until identity, version and matching market evidence are verified. Visual condition observations remain available.':'Photo observations alone do not establish a grade or submission recommendation. Review verified market evidence and physical condition separately.',
 };
}

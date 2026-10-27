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
  const limited=!!unseen || limitations.some(code=>['blur','limited_resolution'].includes(code)||['glare','sleeve'].includes(code)&&item.attribute!=='centering');
  const certainty=item.certainty==='unassessable'||!evidence||unseen||evidence.confidence<0.4?'unassessable':item.certainty==='confirmed'&&evidence.confidence>=0.8&&!limited?'confirmed':'suspected';
  const key=item.attribute+':'+item.code;
  const finding={attribute:item.attribute,code:item.code,certainty,...(evidence?{evidence}: {})};
  const old=byCode.get(key);
  if(old && JSON.stringify(old)!==JSON.stringify(finding))finding.certainty=[old.certainty,finding.certainty].includes('unassessable')?'unassessable':'suspected';
  byCode.set(key,finding);
 }
 // Contradictory clean/defect assertions cannot both establish an assessment.
 const findings=[...byCode.values()];
 for(const attribute of attributes){
  const rows=findings.filter(f=>f.attribute===attribute);
  if(rows.some(f=>f.code==='no_defect_observed')&&rows.some(f=>f.code!=='no_defect_observed'))rows.forEach(f=>{if(f.certainty!=='unassessable')f.certainty='suspected';});
 }
 return {findings,limitations};
}
function phrase(f){
 const label=f.code==='no_defect_observed'?'No defect observed in the documented area; this is not proof of mint condition.':phrases[f.attribute][f.code];
 if(f.certainty==='confirmed')return label;
 return f.certainty==='unassessable'?`Unassessable ${f.attribute}; a defect cannot be established.`:`Possible ${f.attribute} ${f.code.replace(/_/g,' ')}; unconfirmed, inspect the physical card.`;
}
export function conditionPresentation(analysis, { card, identityVerified, trusted } = {}) {
 const {findings,limitations}=readVisualEvidence(analysis);
 const confirmed=findings.filter(f=>f.certainty==='confirmed');
 const structural=confirmed.some(f=>['bend','crease','dent','peeling'].includes(f.code));
 const unverifiedRisk=analysis.visualSafetyFlags?.unverifiedStructuralRisk===true || analysis.visualSafetyFlags?.structuralDamage===true&&!structural;
 const notes=Object.fromEntries(attributes.map(attribute=>[`${attribute}Note`,findings.filter(f=>f.attribute===attribute).map(phrase).join(' ')||'Not assessed from the photo.']));
 const detail=findings.map(phrase);
 const identity=identityVerified?[card?.year,card?.brandSet,card?.subject,card?.parallel,card?.cardNumber&&`#${card.cardNumber}`].filter(Boolean).join(' · '):null;
 return {
  conditionAssessments:Object.fromEntries(attributes.map(attribute=>{
   const rows=findings.filter(f=>f.attribute===attribute);
   return [attribute,{state:rows.some(f=>f.certainty==='unassessable')?'unassessable':rows.some(f=>f.certainty==='suspected')?'suspected_defect':rows.some(f=>f.certainty==='confirmed'&&f.code!=='no_defect_observed')?'confirmed_visible_defect':rows.some(f=>f.certainty==='confirmed'&&f.code==='no_defect_observed')?'no_defect_observed':'unassessable'}];
  })),
  visualEvidenceVersion:2,inspectedSides:Array.isArray(analysis.inspectedSides)?analysis.inspectedSides.filter(side=>['front','back'].includes(side)):['front'],visualObservations:findings,imageLimitations:limitations,...notes,
  visualSafetyFlags:{structuralDamage:structural,unverifiedStructuralRisk:unverifiedRisk,imageQualityLimited:limitations.length>0},
  ...Object.fromEntries(attributes.map(attribute=>{
   const rows=confirmed.filter(f=>f.attribute===attribute);
   return [attribute,findings.some(f=>f.attribute===attribute&&f.certainty!=='confirmed')?null:rows.some(f=>['bend','crease','dent','peeling'].includes(f.code))?'poor':rows.some(f=>f.code!=='no_defect_observed')?'fair':null];
  })),
  imageSummary:`${identity?`Catalog-supported identity: ${identity}.`:'Card identity is unverified.'} Photo observations: ${detail.join(' ')||'Condition is unassessed; absence of a detected defect is not proof of mint condition.'} ${limitations.map(code=>limitationPhrases[code]).join(' ')} These observations do not establish a PSA grade.`,
  gradingRisk:structural?'Visible structural damage requires physical inspection.':unverifiedRisk?'Unverified structural damage warning requires inspection; it is not a confirmed defect.':'Photo inspection can miss defects; inspect the physical card.',
  primaryLimiter:detail[0]||'No supported visible limiter established; condition remains unassessed.',
  majorGradeCap:structural?'Visible structural damage requires physical inspection.':'A grade ceiling cannot be established from these observations.',
  minorConcerns:detail.join(' ')||'Condition is unassessed; defects may remain unseen.',
  gemRiskFactors:[...detail,...limitations.map(code=>limitationPhrases[code])],
  estimatedGrade:null,gradeCeiling:null,mostLikelyGradeRange:null,psa10Upside:null,overallScore:null,confidenceLevel:null,
  worthGrading:structural||unverifiedRisk?false:null,
  worthGradingReason:!trusted?'Grading recommendations are withheld until identity, version and matching market evidence are verified. Visual condition observations remain available.':'Photo observations alone do not establish a grade or submission recommendation. Review verified market evidence and physical condition separately.',
 };
}

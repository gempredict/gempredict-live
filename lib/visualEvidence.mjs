// Observable condition vocabulary only. No model prose, identity, price or grade
// enters the trusted narrative. Codes remain AI observations, not catalog facts.
const attributes = ['centering', 'corners', 'edges', 'surface'];
const phrases = {
  centering: { off_center: 'Visible off-centering.', miscut: 'Possible miscut visible; inspect the physical card.' },
  corners: { whitening: 'Visible corner whitening.', softening: 'Visible corner softening.', bend: 'Visible corner bend.', crease: 'Visible corner crease.' },
  edges: { whitening: 'Visible edge whitening.', chipping: 'Visible edge chipping.', wear: 'Visible edge wear.', peeling: 'Visible edge peeling.' },
  surface: { scratches: 'Visible surface scratches.', print_lines: 'Visible print lines.', dent: 'Visible surface dent.', crease: 'Visible surface crease.', bend: 'Visible surface bend.', staining: 'Visible surface staining.' },
};
const limitationPhrases = { glare: 'Glare limits surface inspection.', blur: 'Blur limits inspection.', sleeve: 'A sleeve may obscure defects.', back_not_visible: 'The back is not visible; assessment is incomplete.', limited_resolution: 'Image resolution limits inspection.', perspective: 'Camera angle limits inspection and centering measurement.', cropped: 'The photograph does not show the entire card.', occluded: 'Part of the card is obscured.' };
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
const validRegion=r=>Array.isArray(r)&&r.length===4&&r.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&r[2]>0&&r[3]>0&&r[0]+r[2]<=1.001&&r[1]+r[3]<=1.001;
const contains=(a,b)=>a&&b&&b[0]>=a[0]&&b[1]>=a[1]&&b[0]+b[2]<=a[0]+a[2]+.001&&b[1]+b[3]<=a[1]+a[3]+.001;
const overlap=(a,b)=>!a||!b||a[0]<b[0]+b[2]&&b[0]<a[0]+a[2]&&a[1]<b[1]+b[3]&&b[1]<a[1]+a[3];
const suppliedSides=a=>Array.isArray(a.inspectedSides)?[...new Set(a.inspectedSides.filter(v=>['front','back'].includes(v)))]:[];
function evidenceLimits(a){
 const rows=Array.isArray(a.inspectionCoverage)?a.inspectionCoverage:[];
 return {observationsExceeded:a.conditionEvidenceLimits?.observationsExceeded===true||(Array.isArray(a.visualObservations)&&a.visualObservations.length>32),coverageExceeded:a.conditionEvidenceLimits?.coverageExceeded===true||rows.length>8||rows.some(r=>Array.isArray(r?.regions)&&r.regions.length>4||Array.isArray(r?.limitations)&&r.limitations.length>4)};
}
// Coverage is explicitly reported inspection scope, not geometric proof or a
// whole-card clean claim. Legacy findings never manufacture coverage regions.
export function readInspectionCoverage(analysis={}){
 const exceeded=evidenceLimits(analysis).coverageExceeded;
 const sides=suppliedSides(analysis),input=Array.isArray(analysis.inspectionCoverage)?analysis.inspectionCoverage:[];
 return ['front','back'].flatMap(side=>attributes.map(attribute=>{
  const rows=input.slice(0,8).filter(r=>r?.side===side&&r.attribute===attribute);
  const available=sides.includes(side);
  let regions=available?rows.flatMap(r=>(Array.isArray(r.regions)?r.regions:[]).slice(0,4)).filter(r=>validRegion(r?.region)&&['inspected','partial','unassessable'].includes(r.status)).slice(0,4).map(r=>({region:[...r.region],status:r.status})):[];
  const limitations=available?rows.flatMap(r=>(Array.isArray(r.limitations)?r.limitations:[]).slice(0,4)).filter(l=>l&&Object.hasOwn(limitationPhrases,l.code)&&(l.region===null||validRegion(l.region))).slice(0,4).map(l=>({code:l.code,region:l.region?[...l.region]:null})):[];
  regions=regions.map(r=>({...r,status:exceeded?'unassessable':r.status==='inspected'&&(limitations.some(l=>overlap(l.region,r.region))||(Array.isArray(analysis.imageLimitations)?analysis.imageLimitations:[]).some(c=>Object.hasOwn(limitationPhrases,c)&&c!=='back_not_visible'))?'partial':r.status}));
  return {side,attribute,status:regions.some(r=>r.status!=='unassessable')?'partial':'unassessable',regions,limitations,reason:!available?'photo_unavailable':exceeded?'coverage_limit_exceeded':!regions.length?'coverage_not_established':'limited_to_reported_regions',basis:'model_observation',wholeAttributeVerified:false};
 }));
}
export function readVisualEvidence(analysis = {}) {
 const sides=suppliedSides(analysis),coverage=readInspectionCoverage(analysis),limits=evidenceLimits(analysis);
 const limitations=Array.isArray(analysis.imageLimitations)?[...new Set(analysis.imageLimitations.filter(code=>Object.hasOwn(limitationPhrases,code)))].slice(0,8):[];
 if(sides.length&&!sides.includes('back')&&!limitations.includes('back_not_visible'))limitations.push('back_not_visible');
 const findings=[],seen=new Set();
 for(const item of (Array.isArray(analysis.visualObservations)?analysis.visualObservations:[]).slice(0,32)){
  if(!item || !attributes.includes(item.attribute) || !(Object.hasOwn(phrases[item.attribute],item.code)||item.code==='no_defect_observed'))continue;
  let evidence=observationSupport(item);
  const unseen=evidence&&!sides.includes(evidence.side);
  const scope=coverage.find(r=>r.attribute===item.attribute&&r.side===evidence?.side);
  const limited=limitations.some(code=>code!=='back_not_visible')||scope?.limitations.some(l=>overlap(l.region,evidence?.region))||scope?.regions.some(r=>r.status==='unassessable'&&overlap(r.region,evidence?.region));
  const outsideReportedScope=scope?.regions.length>0&&!scope.regions.some(r=>r.status!=='unassessable'&&contains(r.region,evidence?.region));
  let certainty=!['confirmed','suspected','unassessable'].includes(item.certainty)||item.certainty==='unassessable'||limits.observationsExceeded||limits.coverageExceeded||!evidence||unseen||outsideReportedScope||evidence.confidence<0.4?'unassessable':item.certainty==='confirmed'&&evidence.confidence>=0.8&&!limited?'confirmed':'suspected';
  // These remain model-estimated ratios. No independent geometry measurement
  // is implemented; a self-declared basis cannot authorize precise centering.
  if(item.attribute==='centering'&&item.code==='off_center'&&certainty==='confirmed')certainty='suspected';
  if(item.code==='no_defect_observed'&&certainty!=='confirmed')certainty='unassessable';
  if(unseen)evidence=null;
  const finding={attribute:item.attribute,code:item.code,certainty,reportedCertainty:['confirmed','suspected','unassessable'].includes(item.reportedCertainty)?item.reportedCertainty:['confirmed','suspected','unassessable'].includes(item.certainty)?item.certainty:'unassessable',...(evidence?{evidence}: {}),localizationStatus:evidence?'model_proposed':'unestablished'};
  const key=JSON.stringify(finding);if(seen.has(key))continue;seen.add(key);findings.push(finding);
 }
 // Different locations are distinct findings. Only overlapping contradictory
 // claims on the same photograph are downgraded; never let last-row wins erase.
 for(const f of findings){
  for(const other of findings){
   if(f===other||f.attribute!==other.attribute)continue;
   if(!other.evidence&&other.code===f.code){f.certainty='unassessable';continue;}
   if(f.evidence&&other.evidence&&f.evidence.side===other.evidence.side&&overlap(f.evidence.region,other.evidence.region)&&
    ((f.code==='no_defect_observed')!==(other.code==='no_defect_observed')||f.code===other.code&&f.certainty!==other.certainty)){
    if(f.certainty!=='unassessable')f.certainty='suspected';
    if(other.certainty!=='unassessable')other.certainty='suspected';
   }
  }
 }
 for(const f of findings)if(f.code==='no_defect_observed'&&f.certainty==='suspected')f.certainty='unassessable';
 return {findings,limitations,coverage,limits};
}
export function conditionObservationText(f){
 if(f.code==='no_defect_observed')return f.certainty==='confirmed'?'No visible defect observed in the documented area; this is not proof of mint condition.':`The model reported no visible defect; ${f.attribute} remains unassessable because inspection evidence is insufficient. This is not proof of mint condition.`;
 const label=phrases[f.attribute][f.code];
 if(f.certainty==='confirmed')return label;
 return f.certainty==='unassessable'?`Unassessable ${f.attribute}; a defect cannot be established.`:`Possible ${f.attribute} ${f.code.replace(/_/g,' ')}; unconfirmed, inspect the physical card.`;
}
// Retain qualitative model notes separately from localized defect evidence.
// They never establish a defect, grade, measurement or assessment confidence.
export function readModelPhotoNotes(analysis = {}) {
 const sides=suppliedSides(analysis);
 const provided=Array.isArray(analysis.modelPhotoNotes)?analysis.modelPhotoNotes:Array.isArray(analysis.photoNotes)?analysis.photoNotes:[];
 const legacy=analysis.visualEvidenceVersion ? [] : attributes.map(attribute=>({attribute,side:null,text:analysis[attribute+'Note']}));
 const notes=[];
 for(const note of [...provided,...legacy].slice(0,24)){
  if(!note || !attributes.includes(note.attribute) || typeof note.text!=='string')continue;
  // Side is recorded only when explicitly supplied and actually uploaded.
  if(note.side!=null && (!['front','back'].includes(note.side)||!sides.includes(note.side)))continue;
  const text=note.text.slice(0,600).split(/(?<=[.!?])\s+|\n/).filter(sentence=>
   /\b(?:center(?:ing|ed)?|border|corner|edge|surface|scratch|whiten|glare|blur|reflect|light|resolution|photo|visible|inspect|assess|sleeve|print line|dent|crease|bend|wear|chip|soft|foil)\w*\b/i.test(sentence) &&
   !/(?:https?:|www\.|[$€£]|\b(?:PSA|BGS|CGC|grade|grading|mint|gem|perfect|flawless|profit|ROI|price|value|worth|submit|recommend|probability|confidence|Pokemon|Pikachu|set|year|rarity|edition)\b|\d+(?:\.\d+)?\s*(?:%|mm|cm)|\d+\s*[:/]\s*\d+)/i.test(sentence)
  ).join(' ').trim();
  if(!text)continue;
  const row={attribute:note.attribute,side:note.side||null,text};
  if(!notes.some(old=>JSON.stringify(old)===JSON.stringify(row)))notes.push(row);
 }
 return notes.slice(0,12);
}
export function conditionPresentation(analysis, { card, identityVerified, trusted } = {}) {
 const {findings,limitations,coverage,limits}=readVisualEvidence(analysis);
 const modelPhotoNotes=readModelPhotoNotes(analysis);
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
   const sideOf=f=>f.evidence && (!Array.isArray(analysis.inspectedSides)||analysis.inspectedSides.includes(f.evidence.side))?f.evidence.side:null;
   const state=rows.some(f=>f.certainty==='unassessable')?'unassessable':
    rows.some(f=>f.certainty==='suspected'&&f.code!=='no_defect_observed')?'suspected_defect':
    rows.some(f=>f.certainty==='confirmed'&&f.code!=='no_defect_observed')?'confirmed_visible_defect':
    rows.some(f=>f.certainty==='confirmed'&&f.code==='no_defect_observed')?'no_defect_observed':'unassessable';
   return [attribute,{
    observations:rows.map(f=>({side:sideOf(f),certainty:f.certainty,region:f.evidence?.region||null,cue:f.evidence?.cue||null,code:f.code,text:conditionObservationText(f)})),
    sides:[...new Set(rows.map(sideOf).filter(Boolean))],state,
   }];
  })),
  visualEvidenceVersion:4,conditionEvidenceLimits:limits,inspectionCoverage:coverage,localizationVerified:false,centeringGeometryVerified:false,centeringMeasurementStatus:findings.some(f=>f.attribute==='centering'&&f.evidence?.measurement)?'unverified_geometry':'unavailable',modelPhotoNotes,inspectedSides:suppliedSides(analysis),visualObservations:findings,imageLimitations:limitations,...notes,
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
  estimatedGrade:null,gradeCeiling:null,mostLikelyGradeRange:null,psa10Upside:null,overallScore:null,confidenceLevel:null,psa9Probability:null,psa10Probability:null,gradeProbabilities:null,gradingRecommendation:null,submissionRecommendation:null,
  // Visible damage is an observation, not submission advice.
  worthGrading:null,
  worthGradingReason:!trusted?'Grading recommendations are withheld until identity, version and matching market evidence are verified. Visual condition observations remain available.':'Photo observations alone do not establish a grade or submission recommendation. Review verified market evidence and physical condition separately.',
 };
}

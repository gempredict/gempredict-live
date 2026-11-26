import { CORE_FIELDS,validateManifest,sanitizeObservation,truthReady,compareBenchmarkIdentity } from './identificationBenchmark.mjs';

export const CONDITION_ATTRIBUTES=Object.freeze(['centering','corners','edges','surface']);
const code=value=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(value);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const list=value=>Array.isArray(value)?value:[];
const rate=(count,n)=>({count,n,rate:n?count/n:null});
const grade=value=>Number.isInteger(value)&&value>=1&&value<=10;
const review=value=>value?.status==='independently_reviewed'&&code(value.reviewer)&&code(value.evidenceReference)&&
 typeof value.reviewedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.reviewedAt)&&
 Number.isFinite(Date.parse(value.reviewedAt))&&new Date(value.reviewedAt).toISOString().slice(0,10)===value.reviewedAt;
const linkedPhotos=card=>{
 const front=card.photos?.front,back=card.photos?.back;
 if(!card.physicalCardId||front?.status!=='retained_and_reviewed'||!sha(front.sha256))return null;
 if(back?.status==='retained_and_reviewed'&&!sha(back.sha256))return null;
 return {front:front.sha256,back:back?.status==='retained_and_reviewed'?back.sha256:null};
};
const equalPhotos=(left,right)=>!!left&&!!right&&left.front===right.front&&(left.back??null)===(right.back??null);
const linkedReview=(record,card)=>review(record)&&record.physicalCardId===card.physicalCardId&&equalPhotos(record.photoHashes,linkedPhotos(card));

// Only this allowlisted payload crosses the benchmark prediction boundary.
// The caller is responsible for submitting these exact prepared bytes. No
// card identifier, filename, truth label, metadata or prompt hint is returned.
export function blindBenchmarkInput(card,inspection,actualHashes) {
 const expected=linkedPhotos(card);
 if(!equalPhotos(expected,actualHashes)||!linkedReview(inspection,card)||
    inspection.cardOnlyPixels!==true||inspection.metadataStripped!==true||inspection.gradeOrSlabVisible!==false)
  throw Error('benchmark_blind_input_unverified');
 return {version:1,images:[{side:'front',sha256:expected.front},
  ...(expected.back?[{side:'back',sha256:expected.back}]:[])]};
}

function validTrial(card,raw,labels) {
 const attempt=sanitizeObservation(raw);
 const trial=raw?.calibration;
 if(attempt.evidenceKind!=='live_scan'||!attempt.evidenceDigest||!attempt.deploymentCommit||
    !attempt.technical.validCompletedResponse||attempt.photoLinkage.method!=='diagnostic_prepared_sha256'||
    !trial||!['baseline','challenger'].includes(trial.arm)||!code(trial.model)||!code(trial.modelVersion)||
    !code(trial.imagePreparation)||!code(trial.promptRevision)||!attempt.attemptIndex||
    !code(attempt.scanId)||trial.truthVisible!==false||trial.usedOnlyBlindInput!==true)return null;
 const expected=linkedPhotos(card);
 if(!equalPhotos(attempt.photoLinkage.preparedHashes,expected)||!equalPhotos(attempt.photoHashes,expected)||
    attempt.photoLinkage.backRequired!==!!expected?.back)return null;
 let packet;
 try{packet=blindBenchmarkInput(card,labels?.blindReview,attempt.photoHashes);}catch{return null;}
 const images=trial.input?.images;
 if(trial.input?.version!==1||!Array.isArray(images)||images.length!==packet.images.length||
    Object.keys(trial.input).some(k=>!['version','images'].includes(k))||
    images.some((image,index)=>!image||Object.keys(image).some(k=>!['side','sha256'].includes(k))||
      image.side!==packet.images[index].side||image.sha256!==packet.images[index].sha256))return null;
 return {attempt,trial};
}

const observedStates=['defect','clear','uncertain'];
function regions(rows,photos){
 const byKey=new Map(),duplicates=new Set();
 for(const row of list(rows).slice(0,100)){
  if(!row||!CONDITION_ATTRIBUTES.includes(row.attribute)||!['front','back'].includes(row.side)||!photos?.[row.side]||
     !code(row.location)||!observedStates.includes(row.state))continue;
  const key=[row.attribute,row.side,row.location].join(':');
  if(byKey.has(key))duplicates.add(key);else byKey.set(key,row);
 }
 for(const key of duplicates)byKey.delete(key);
 return byKey;
}

function conditionResults(card,condition,prediction) {
 if(!linkedReview(condition,card))return [];
 const photos=linkedPhotos(card);
 const predicted=regions(prediction,photos);
 return [...regions(condition.regions,photos)].map(([key,truth])=>{
  const observed=predicted.get(key);
  const limitations=list(truth.limitations).filter(code);
  const outcome=truth.state==='uncertain'||limitations.length?'reference_uncertain':
   !observed||observed.state==='uncertain'?'abstained':observed.state===truth.state?'correct':
   observed.state==='defect'?'false_defect':'missed_defect';
  return {attribute:truth.attribute,side:truth.side,location:truth.location,reference:truth.state,
   prediction:observed?.state??null,limitations,outcome};
 });
}

function gradeMetrics(rows) {
 // Repeats do not inflate calibration. Input rows already contain one primary
 // attempt per distinct physical card and model arm.
 const paired=rows.filter(row=>grade(row.predictedGrade)&&grade(row.observedPSA));
 const probabilistic=rows.filter(row=>grade(row.observedPSA)&&row.psa10Probability!==null);
 const positive=probabilistic.filter(row=>row.observedPSA===10).length;
 const enoughGrades=paired.length>=30;
 const enoughProbability=probabilistic.length>=30&&positive>=5&&probabilistic.length-positive>=5;
 const bins=enoughProbability?Array.from({length:5},(_,index)=>{
  const group=probabilistic.filter(row=>Math.min(4,Math.floor(row.psa10Probability*5))===index);
  return {from:index/5,to:(index+1)/5,n:group.length,
   meanPrediction:group.length>=5?group.reduce((sum,row)=>sum+row.psa10Probability,0)/group.length:null,
   observedRate:group.length>=5?group.filter(row=>row.observedPSA===10).length/group.length:null};
 }):[];
 return {
  point:{status:enoughGrades?'measurable':'insufficient_samples',n:paired.length,minimumCards:30,
   meanAbsoluteError:enoughGrades?paired.reduce((sum,row)=>sum+Math.abs(row.predictedGrade-row.observedPSA),0)/paired.length:null},
  psa10:{status:enoughProbability?'measurable':'insufficient_samples',n:probabilistic.length,positive,negative:probabilistic.length-positive,
   minimumCards:30,minimumPerOutcome:5,brierScore:enoughProbability?
    probabilistic.reduce((sum,row)=>sum+(row.psa10Probability-Number(row.observedPSA===10))**2,0)/probabilistic.length:null,bins},
 };
}

function summarize(rows) {
 const eligible=rows.filter(row=>row.core!==null);
 const variant=rows.filter(row=>row.exact!==null);
 const condition=rows.flatMap(row=>row.condition);
 return {
  coreAccuracy:rate(eligible.filter(row=>row.core.status==='correct').length,eligible.length),
  exactVariantAccuracy:rate(variant.filter(row=>row.exact.status==='correct').length,variant.length),
  falseVerification:rows.filter(row=>row.falseVerification).length,
  unsupportedVerification:rows.filter(row=>row.unsupportedVerification).length,
  unsupportedConfidence:rows.filter(row=>row.unsupportedConfidence).length,
  appropriateAbstentions:rows.filter(row=>row.appropriateAbstention).length,
  condition:Object.fromEntries(CONDITION_ATTRIBUTES.map(attribute=>{
   const all=condition.filter(region=>region.attribute===attribute);
   const known=all.filter(region=>region.outcome!=='reference_uncertain');
   return [attribute,{...rate(known.filter(region=>region.outcome==='correct').length,known.length),
    abstained:known.filter(region=>region.outcome==='abstained').length,
    falseDefects:known.filter(region=>region.outcome==='false_defect').length,
    missedDefects:known.filter(region=>region.outcome==='missed_defect').length,
    limitedOrUncertain:all.length-known.length}];
  })),
  grading:gradeMetrics(rows),
 };
}

export function evaluateBenchmarkCalibration(manifest,observations=[],reviewLabels={}) {
 validateManifest(manifest);
 // Read only reviewed labels associated with this manifest. Unlinked history
 // and synthetic fixture records never become measured evidence.
 const byCard=new Map(manifest.cards.map(card=>[card.id,card]));
 const accepted=[],seen=new Set(),positions=new Set();
 let excluded=0;
 for(const raw of list(observations)){
  const card=byCard.get(raw?.cardId);
  const labels=card&&reviewLabels[card.id];
  const valid=card&&validTrial(card,raw,labels);
  if(!valid){excluded++;continue;}
  const {attempt,trial}=valid;
  const run=[trial.arm,trial.model,trial.modelVersion,trial.imagePreparation,trial.promptRevision,attempt.cohortId];
  const position=JSON.stringify([run,card.id,attempt.attemptIndex]);
  if(!attempt.id||!attempt.cohortId||seen.has(attempt.scanId)||positions.has(position))throw Error('benchmark_trial_duplicate');
  seen.add(attempt.scanId);positions.add(position);
  const truth=card.groundTruth;
  const core=truthReady(truth,CORE_FIELDS)?compareBenchmarkIdentity(truth,attempt.canonical,CORE_FIELDS):null;
  const exact=core&&linkedReview(labels?.printingReview,card)&&truthReady(truth,card.requiredExactFields)?
   compareBenchmarkIdentity(truth,attempt.canonical,[...CORE_FIELDS,...card.requiredExactFields]):null;
  const verifiedCore=attempt.claims.catalogVerified===true||attempt.claims.photoVerified===true;
  const verifiedPrint=attempt.claims.printingVerified===true;
  const originalCore=core?compareBenchmarkIdentity(truth,attempt.originalAI,CORE_FIELDS):null;
  const high=attempt.modelConfidence!==null&&attempt.modelConfidence>=90;
  const abstained=trial.identityAbstained===true&&CORE_FIELDS.every(field=>attempt.canonical[field]==null)&&!verifiedCore&&!verifiedPrint;
  const observed=labels?.gradingOutcome;
  const observedPSA=linkedReview(observed,card)&&observed.service==='PSA'&&grade(observed.grade)?observed.grade:null;
  const gradePrediction=trial.gradePrediction;
  const psa10=gradePrediction?.psa10Probability;
  accepted.push({cardId:card.id,run,arm:trial.arm,attemptIndex:attempt.attemptIndex,id:attempt.id,core,exact,
   condition:conditionResults(card,labels?.conditionReview,trial.condition),
   falseVerification:verifiedCore&&core?.status==='incorrect'||verifiedPrint&&exact?.status==='incorrect',
   unsupportedVerification:verifiedCore&&(!core||core.status==='incomplete')||verifiedPrint&&(!exact||exact.status==='incomplete'),
   unsupportedConfidence:high&&originalCore?.status!=='correct',
   appropriateAbstention:abstained&&labels?.blindReview?.identityAssessable===false,
   observedPSA,predictedGrade:gradePrediction?.service==='PSA'&&grade(gradePrediction.grade)?gradePrediction.grade:null,
   psa10Probability:gradePrediction?.service==='PSA'&&Number.isFinite(psa10)&&psa10>=0&&psa10<=1?psa10:null,
   actualCostUsd:attempt.cost.actualUsd,latencyMs:attempt.latencyMs});
 }
 const groups=new Map();
 for(const row of accepted){
  const key=JSON.stringify(row.run);
  const rows=groups.get(key)||[];rows.push(row);groups.set(key,rows);
 }
 const runs=[...groups.values()].map(rows=>{
  const primary=rows.filter(row=>row.attemptIndex===1);
  const known=rows.filter(row=>row.actualCostUsd!==null);
  const pairedRepeats=rows.filter(row=>row.attemptIndex>1&&primary.some(first=>first.cardId===row.cardId));
  const [arm,model,modelVersion,imagePreparation,promptRevision,cohortId]=rows[0].run;
  return {arm,model,modelVersion,imagePreparation,promptRevision,cohortId,attempts:rows.length,primaryTrials:primary.length,
   cost:{known:known.length,actualUsd:known.length?known.reduce((sum,row)=>sum+row.actualCostUsd,0):null},
   repeats:{paired:pairedRepeats.length,matchingIdentityOutcome:pairedRepeats.filter(row=>{
    const first=primary.find(first=>first.cardId===row.cardId);
    return first.core&&row.core&&JSON.stringify(first.core)===JSON.stringify(row.core);
   }).length},metrics:summarize(primary),rows};
 });
 const comparisons=runs.filter(run=>run.arm==='baseline').flatMap(baseline=>
  runs.filter(run=>run.arm==='challenger'&&run.cohortId===baseline.cohortId&&run.imagePreparation===baseline.imagePreparation&&run.promptRevision===baseline.promptRevision)
   .map(challenger=>{
    const common=baseline.rows.filter(row=>row.attemptIndex===1&&row.core&&challenger.rows.some(other=>
     other.cardId===row.cardId&&other.attemptIndex===1&&other.core));
    return {baseline:baseline.model+' '+baseline.modelVersion,challenger:challenger.model+' '+challenger.modelVersion,
     commonCards:common.length,baselineCorrect:common.filter(row=>row.core.status==='correct').length,
     challengerCorrect:challenger.rows.filter(row=>row.attemptIndex===1&&row.core?.status==='correct'&&common.some(base=>base.cardId===row.cardId)).length};
   }));
 return {version:1,baselineCommit:manifest.baselineCommit,coverage:{
  cards:manifest.cards.length,reviewedCore:manifest.cards.filter(card=>truthReady(card.groundTruth,CORE_FIELDS)).length,
  boundPhotos:manifest.cards.filter(card=>linkedPhotos(card)).length,
  reviewedPrinting:manifest.cards.filter(card=>linkedReview(reviewLabels[card.id]?.printingReview,card)).length,
  reviewedCondition:manifest.cards.filter(card=>linkedReview(reviewLabels[card.id]?.conditionReview,card)).length,
  reviewedPSA:manifest.cards.filter(card=>{const label=reviewLabels[card.id]?.gradingOutcome;return linkedReview(label,card)&&label.service==='PSA'&&grade(label.grade);}).length,
  acceptedTrials:accepted.length,excludedObservations:excluded,
 },baseline:runs.some(run=>run.arm==='baseline')?null:summarize([]),runs,comparisons};
}

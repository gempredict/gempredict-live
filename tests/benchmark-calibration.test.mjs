import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { blindBenchmarkInput,evaluateBenchmarkCalibration } from '../lib/benchmarkCalibration.mjs';

const actualManifest=JSON.parse(readFileSync(new URL('../benchmarks/identity/manifest.json',import.meta.url)));
const observations=JSON.parse(readFileSync(new URL('../benchmarks/identity/historical-observations.json',import.meta.url))).observations;
const hex=(value,length)=>value.toString(16).padStart(length,'0');

// Synthetic review receipts exercise the grader; they never enter the baseline files.
function fixtures(count=1) {
 const cards=Array.from({length:count},(_,index)=>({
  id:'synthetic-'+index,category:'sports_test',physicalCardId:'synthetic-copy-'+index,
  photos:{front:{status:'retained_and_reviewed',sha256:hex(index+1,64)}},
  requiredExactFields:['parallel'],
  groundTruth:{status:'independently_reviewed',reviewer:'synthetic-reviewer',reviewedAt:'2026-11-26',
   sources:[{kind:'manufacturer_checklist',url:'https://example.invalid/fixture',supports:['subject','year','set','cardNumber','parallel']}],
   fields:Object.fromEntries(Object.entries({subject:'Synthetic Card',year:'2018',set:'Synthetic Set',cardNumber:'700',parallel:'Base'})
    .map(([key,value])=>[key,{status:'known',value}]))},
 }));
 const manifest={version:1,cohortId:'fixture',baselineCommit:'a'.repeat(40),categoryPlan:{sports_test:count},cards};
 const labels=Object.fromEntries(cards.map((card,index)=>{
  const receipt={status:'independently_reviewed',reviewer:'synthetic-reviewer',reviewedAt:'2026-11-26',
   evidenceReference:'synthetic-reference',physicalCardId:card.physicalCardId,photoHashes:{front:card.photos.front.sha256,back:null}};
  return [card.id,{
   blindReview:{...receipt,cardOnlyPixels:true,metadataStripped:true,gradeOrSlabVisible:false},
   printingReview:receipt,
   gradingOutcome:{...receipt,service:'PSA',grade:index<5?10:9},
   conditionReview:{...receipt,regions:[
    {attribute:'corners',side:'front',location:'top-left',state:'defect'},
    {attribute:'surface',side:'front',location:'middle',state:'uncertain',limitations:['glare']},
    {attribute:'edges',side:'front',location:'top',state:'clear'},
   ]},
  }];
 }));
 function trial(card,changes={}){
  const {arm='baseline',attemptIndex=1,variant='Base',canonical={},...extra}=changes;
  const photos=labels[card.id].blindReview.photoHashes;
  const key=card.id+'-'+arm+'-'+attemptIndex;
  return {id:key,cardId:card.id,evidenceKind:'live_scan',scanId:key,cohortId:'fixture',attemptIndex,
   evidenceDigest:'b'.repeat(64),deploymentCommit:'a'.repeat(40),technical:{validCompletedResponse:true},
   photoHashes:photos,photoLinkage:{method:'diagnostic_prepared_sha256',preparedHashes:photos,backRequired:false},
   canonical:{subject:'Synthetic Card',year:'2018',set:'Synthetic Set',cardNumber:'700',parallel:variant,...canonical},
   originalAI:{subject:'Synthetic Card',year:'2018',set:'Synthetic Set',cardNumber:'700'},modelConfidence:95,
   claims:{printingVerified:true},cost:{actualUsd:0.02},
   calibration:{arm,model:'synthetic-model',modelVersion:'v1',imagePreparation:'mobile-v2',promptRevision:'test-prompt',
    truthVisible:false,usedOnlyBlindInput:true,input:blindBenchmarkInput(card,labels[card.id].blindReview,photos),
    condition:[{attribute:'corners',side:'front',location:'top-left',state:'clear'},
     {attribute:'edges',side:'front',location:'top',state:'uncertain'}],
    gradePrediction:{service:'PSA',grade:9,psa10Probability:0.2},...extra},
  };
 }
 return {manifest,labels,trial,cards};
}

test('current benchmark has reviewed identity coverage but no evidence-linked scored trials',()=>{
 const result=evaluateBenchmarkCalibration(actualManifest,observations);
 assert.deepEqual(result.coverage,{cards:12,reviewedCore:1,boundPhotos:0,reviewedPrinting:0,reviewedCondition:0,
  reviewedPSA:0,acceptedTrials:0,excludedObservations:6});
 assert.equal(result.baseline.coreAccuracy.rate,null);
 assert.equal(result.baseline.grading.psa10.brierScore,null);
});
test('linked benchmark measures variant errors, false verification and localized uncertainty separately',()=>{
 const {manifest,labels,trial,cards:[card]}=fixtures();
 const baseline=trial(card,{variant:'Factory Set'});
 baseline.originalAI.cardNumber='701';
 const result=evaluateBenchmarkCalibration(manifest,[baseline,trial(card,{arm:'challenger'}),
  trial(card,{attemptIndex:2,variant:'Factory Set'})],labels);
 const run=result.runs[0];
 assert.equal(run.metrics.coreAccuracy.rate,1);
 assert.equal(run.metrics.exactVariantAccuracy.rate,0);
 assert.equal(run.metrics.falseVerification,1);
 assert.equal(run.metrics.unsupportedConfidence,1);
 assert.equal(run.metrics.condition.corners.missedDefects,1);
 assert.equal(run.metrics.condition.edges.abstained,1);
 assert.equal(run.metrics.condition.surface.limitedOrUncertain,1);
 assert.equal(run.metrics.condition.centering.rate,null);
 assert.equal(run.metrics.grading.point.n,1);
 assert.equal(run.metrics.grading.point.meanAbsoluteError,null);
 assert.equal(run.primaryTrials,1);
 assert.equal(run.attempts,2);
 assert.equal(run.cost.actualUsd,0.04);
 assert.equal(result.comparisons[0].commonCards,1);
});
test('wrong hashes, visible labels, truth fields in the packet and synthetic-tagged runs are excluded',()=>{
 const {manifest,labels,trial,cards:[card]}=fixtures();
 const review=labels[card.id].blindReview;
 assert.throws(()=>blindBenchmarkInput(card,{...review,gradeOrSlabVisible:true},review.photoHashes));
 assert.throws(()=>blindBenchmarkInput(card,review,{front:'c'.repeat(64)}));
 const a=trial(card);a.photoLinkage.preparedHashes={front:'c'.repeat(64)};
 const b=trial(card);b.calibration.input={...b.calibration.input,grade:10};
 const c=trial(card,{truthVisible:true});
 const d={...trial(card),evidenceKind:'synthetic'};
 const result=evaluateBenchmarkCalibration(manifest,[a,b,c,d],labels);
 assert.equal(result.coverage.excludedObservations,4);
 assert.deepEqual(result.runs,[]);
});
test('linked trials may abstain and cannot borrow missing or wrongly linked truth labels',()=>{
 const {manifest,labels,trial,cards:[card]}=fixtures();
 labels[card.id].blindReview.identityAssessable=false;
 labels[card.id].conditionReview={...labels[card.id].conditionReview,photoHashes:{front:'z'}};
 delete labels[card.id].gradingOutcome;
 delete labels[card.id].printingReview;
 const attempt=trial(card,{identityAbstained:true,canonical:{subject:null,year:null,set:null,cardNumber:null}});
 attempt.claims={};
 const result=evaluateBenchmarkCalibration(manifest,[attempt],labels).runs[0].metrics;
 assert.equal(result.appropriateAbstentions,1);
 assert.equal(result.exactVariantAccuracy.rate,null);
 assert.equal(result.condition.corners.n,0);
 assert.equal(result.grading.point.n,0);
});
test('calibration needs enough independent cards and both outcomes',()=>{
 const {manifest,labels,trial,cards}=fixtures(30);
 const result=evaluateBenchmarkCalibration(manifest,cards.map(card=>trial(card)),labels).runs[0].metrics.grading;
 assert.equal(result.point.n,30);
 assert.equal(result.point.meanAbsoluteError,5/30);
 assert.equal(result.psa10.status,'measurable');
 assert.ok(Math.abs(result.psa10.brierScore-0.14)<1e-10);
 for(const card of cards)labels[card.id].gradingOutcome.grade=9;
 assert.equal(evaluateBenchmarkCalibration(manifest,cards.map(card=>trial(card)),labels).runs[0].metrics.grading.psa10.status,'insufficient_samples');
});

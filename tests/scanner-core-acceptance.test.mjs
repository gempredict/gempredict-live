// Offline acceptance contracts, not real-photo accuracy or actual market prices.
import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionPresentation,readVisualEvidence} from '../lib/visualEvidence.mjs';
import {normalizeMobileImage} from '../lib/mobileImages.mjs';
import {runPipeline} from './helpers/phase1Pipeline.mjs';
import {liveReportScenario} from './helpers/liveReportFixture.mjs';
import {supportedObservation} from './helpers/visionEvidence.mjs';
import {calculateGradingEconomics} from '../lib/gradingEconomics.mjs';
const observations=()=>['centering','corners','edges','surface'].map((a,i)=>supportedObservation(a,['off_center','whitening','whitening','scratches'][i]));
const parsed=(back=true)=>({fields:{cardName:'Unknown card from image',cardType:'pokemon'},imageBuffer:Buffer.from('synthetic front bytes'),imageMimeType:'image/png',...(back?{backImageBuffer:Buffer.from('synthetic back bytes'),backImageMimeType:'image/png'}:{})});
test('same mocked front/back inputs retain identity, rarity, condition and withheld economics across three handler runs',async()=>{
 const results=[];
 for(let i=0;i<3;i++){
  const r=await runPipeline({...liveReportScenario(),parsedRequest:parsed(),vision:{visualObservations:observations(),imageLimitations:[]}});
  assert.equal(r.httpStatus,200);assert.equal(r.report.canonicalCard.subject,'Pikachu ex');assert.equal(r.report.canonicalCard.brandSet,'30th Celebration');assert.equal(r.report.canonicalCard.cardNumber,'149/128');assert.match(r.report.canonicalCard.rarity,/special illustration rare/i);
  assert.deepEqual(r.metrics.modelRequests.find(x=>x.kind==='vision').imageFingerprints.length,2);
  for(const a of ['centering','corners','edges','surface'])assert.equal(r.report.imageAnalysis.conditionAssessments[a].state,'confirmed_visible_defect');
  assert.equal(r.report.rawValue,null);assert.equal(r.report.atlas,null);assert.notEqual(r.report.verdict,'grade');
  results.push(JSON.stringify({card:r.report.canonicalCard,condition:r.report.imageAnalysis,raw:r.report.rawValue,verdict:r.report.verdict,requests:r.metrics.modelRequests}));
 }
 assert.equal(new Set(results).size,1); // Transport/model replies are fixed; no live model determinism claim.
});
test('independent supported defects on front and back retain both sides without duplicate-conflict downgrade',async()=>{
 for(const attribute of ['corners','edges','surface']){
  const code=attribute==='surface'?'scratches':'whitening';const front=supportedObservation(attribute,code),back={...front,evidence:{...front.evidence,side:'back'}};
  const r=readVisualEvidence({inspectedSides:['front','back'],visualObservations:[front,back]});
  assert.equal(r.findings.length,2);assert.deepEqual(r.findings.map(f=>f.evidence.side),['front','back']);assert.ok(r.findings.every(f=>f.certainty==='confirmed'));
 }
 const front=supportedObservation('corners','whitening'),back={...front,evidence:{...front.evidence,side:'back'}};
 const r=await runPipeline({...liveReportScenario(),parsedRequest:parsed(),vision:{visualObservations:[front,back],imageLimitations:[]}});
 assert.equal(r.report.imageAnalysis.visualObservations.length,2);assert.ok(r.report.imageAnalysis.visualObservations.every(f=>f.certainty==='confirmed'));
});
test('contradictory evidence on the same side remains uncertain, and unseen back evidence cannot establish damage',()=>{
 const front=supportedObservation('surface','scratches');const conflict={...front,evidence:{...front.evidence,confidence:.5}};
 assert.equal(readVisualEvidence({inspectedSides:['front','back'],visualObservations:[front,conflict]}).findings[0].certainty,'suspected');
 const back={...front,evidence:{...front.evidence,side:'back'}};
 assert.equal(readVisualEvidence({inspectedSides:['front'],visualObservations:[back]}).findings[0].certainty,'unassessable');
});
test('front-only and blurry uploads keep condition limitations and cannot establish a grade or positive recommendation',async()=>{
 for(const back of [true,false]){
  const r=await runPipeline({...liveReportScenario(),parsedRequest:parsed(back),vision:{visualObservations:observations(),imageLimitations:['blur']}});
  assert.equal(r.httpStatus,200);const a=r.report.imageAnalysis;
  for(const field of ['centering','corners','edges','surface']){assert.equal(a[field],null);assert.equal(a.conditionAssessments[field].state,'suspected_defect');}
  assert.ok(a.imageLimitations.includes('blur'));assert.equal(a.imageLimitations.includes('back_not_visible'),!back);assert.equal(a.estimatedGrade,null);assert.notEqual(a.worthGrading,true);assert.notEqual(r.report.verdict,'grade');
 }
});
test('missing image and name fail before any model or market work',async()=>{
 const r=await runPipeline({parsedRequest:{fields:{cardName:'',cardType:'pokemon'},imageBuffer:null}});
 assert.equal(r.httpStatus,400);assert.equal(r.metrics.claudeVision,0);assert.equal(r.metrics.claudePrediction,0);assert.equal(r.metrics.neutralBrowse,0);assert.equal(r.metrics.valuationBrowse,0);
});
test('native orientation contract is requested once and normalized portrait pixels are not manually rotated again',async t=>{
 let calls=0,closed=0,drawn,encodedSize;const bitmap={width:120,height:180,close(){closed++;}};
 const original=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
 t.after(()=>{if(original)Object.defineProperty(globalThis,'createImageBitmap',original);else delete globalThis.createImageBitmap;});
 Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async(file,options)=>{calls++;assert.deepEqual(options,{imageOrientation:'from-image'});return bitmap;}});
 const canvas={getContext:()=>({fillRect(){},drawImage(...args){drawn=args;}}),toBlob(fn){encodedSize=[this.width,this.height];fn(new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'}));}};
 const file=new File([new Uint8Array([255,216,255,0])],'synthetic-oriented.jpg');
 const normalized=await normalizeMobileImage(file,{makeCanvas:()=>canvas});
 assert.equal(calls,1);assert.equal(closed,1);assert.deepEqual(encodedSize,[120,180]);assert.deepEqual(drawn,[bitmap,0,0,120,180]);assert.equal(normalized.type,'image/jpeg');
 // This verifies the native decode contract, not actual EXIF correctness on a device.
});
test('explicitly synthetic raw/PSA9/PSA10 scenarios include the fee and never independently authorize Grade It',()=>{
 for(const [p,expected,net] of [[0,75,-45],[50,137.5,17.5],[100,200,80]]){
  const r=calculateGradingEconomics({rawValue:40,psa9Value:75,psa10Value:200,psa10Probability:p});
  assert.equal(r.rawValue,40);assert.equal(r.psa9Value,75);assert.equal(r.psa10Value,200);assert.equal(r.psaFee,80);assert.equal(r.expectedGradedValue,expected);assert.equal(r.expectedNetValue,net);assert.notEqual(r.verdict,'grade');
 }
});

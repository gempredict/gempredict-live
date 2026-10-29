import test from 'node:test';import assert from 'node:assert/strict';
import { conditionPresentation,readVisualEvidence } from '../lib/visualEvidence.mjs';
import { liveReportScenario } from './helpers/liveReportFixture.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
test('bare scratches and softening codes cannot become confirmed visible damage',()=>{
 const out=conditionPresentation({surface:'poor',corners:'fair',visualObservations:[{attribute:'surface',code:'scratches'},{attribute:'corners',code:'softening'}]},{});
 assert.doesNotMatch(out.imageSummary,/Visible surface scratches|Visible corner softening/);
 assert.equal(out.surface,null);assert.equal(out.corners,null);
});
test('an explicit suspected finding remains uncertain despite a high model rating',()=>{
 const out=conditionPresentation({surface:'excellent',visualObservations:[{attribute:'surface',code:'scratches',certainty:'suspected'}]},{});
 assert.doesNotMatch(out.surfaceNote,/^Visible/);assert.equal(out.surface,null);
});
test('wrong denominator is investigated rather than silently selecting an imagined correct card',async()=>{
 const s=liveReportScenario();const r=await runPipeline({...s,proposal:{...s.proposal,cardNumber:'149/165',brandSet:'Scarlet & Violet 151'},vision:{...s.vision,identifiedBrandSet:'Scarlet & Violet 151',identifiedYear:'2023',identifiedCardNumber:'149/165'},market:s.neutral});
 assert.ok(r.payload.identityVerification.catalog.candidateInvestigation,'candidate investigation is explicit and bounded');
 assert.equal(r.report.atlas,null);
});

import {supportedObservation} from './helpers/visionEvidence.mjs';
import {catalog} from './helpers/liveReportFixture.mjs';
import {createTcgDexCatalog} from '../lib/tcgdexCatalog.mjs';
import {catalogIdentityConflicts} from '../lib/catalogIdentity.mjs';
const reading=(text,certainty='clear',alternatives=[])=>({field:'cardNumber',text,certainty,side:'front',area:'collector_line',alternatives});
test('localized support, suspected findings and obscuring artifacts produce coherent assessments',()=>{
 const finding=supportedObservation('surface','scratches');
 const good=conditionPresentation({surface:'excellent',visualObservations:[finding]},{});
 assert.equal(good.surface,'fair');assert.equal(good.surfaceNote,'Visible surface scratches.');
 for(const imageLimitations of [['glare'],['sleeve'],['blur'],['limited_resolution']]){
  const out=conditionPresentation({surface:'excellent',visualObservations:[finding],imageLimitations},{});
  assert.equal(out.surface,null);assert.equal(out.conditionAssessments.surface.state,'suspected_defect');assert.doesNotMatch(out.surfaceNote,/^Visible/);
 }
 for(const evidence of [null,{}, {...finding.evidence,region:[0,0,2,1]},{...finding.evidence,confidence:.2},{...finding.evidence,cue:'reflection'}]){
  const out=conditionPresentation({visualObservations:[{...finding,evidence}]},{});assert.equal(out.surface,null);assert.doesNotMatch(out.surfaceNote,/^Visible/);
 }
});
test('centering needs visible-border support and measurements; inspected clean patches do not imply gem mint',()=>{
 const centered=supportedObservation('centering','off_center');
 assert.equal(conditionPresentation({visualObservations:[centered]},{}).centering,'fair');
 delete centered.evidence.measurement;assert.equal(conditionPresentation({visualObservations:[centered]},{}).centering,null);
 const clean=conditionPresentation({corners:'excellent',visualObservations:[supportedObservation('corners','no_defect_observed')]},{});
 assert.equal(clean.corners,null);assert.match(clean.cornersNote,/not proof of mint/);assert.equal(clean.estimatedGrade,null);
});
test('unsupported backwards-side claims and unassessable findings cannot become definite defects',()=>{
 const back=supportedObservation('corners','softening');back.evidence.side='back';
 const out=conditionPresentation({inspectedSides:['front'],visualObservations:[back]},{});assert.equal(out.corners,null);
 const unknown=conditionPresentation({visualObservations:[{...supportedObservation(),certainty:'unassessable'}]},{});assert.equal(unknown.corners,null);assert.equal(unknown.conditionAssessments.corners.state,'unassessable');
});
test('clear printed readings beat speculative 149/165 guesses only after exact independent verification',async()=>{
 const s=liveReportScenario();
 const r=await runPipeline({...s,proposal:{...s.proposal,cardNumber:'149/165',brandSet:'Scarlet & Violet 151'},vision:{...s.vision,identifiedBrandSet:'Scarlet & Violet 151',identifiedYear:'2023',identifiedCardNumber:'149/165',identityReadings:[reading('149/128')]},market:s.neutral});
 assert.equal(r.payload.canonicalCard.cardNumber,'149/128');assert.equal(r.payload.canonicalCard.brandSet,'30th Celebration');assert.equal(r.payload.valuationIdentityGate.allowed,true);
 assert.equal(r.report.imageAnalysis.identifiedCardNumber,'149/165');assert.equal(r.report.canonicalCard.rarity,'Special illustration rare');assert.equal(r.report.canonicalCard.parallel,'Holo Special Art');
 assert.doesNotMatch(r.report.imageAnalysis.imageSummary,/151|149\/165/);
});
test('conflicting visible readings or absent supported denominators require confirmation, never a silent correction',async()=>{
 for(const identityReadings of [[reading('149/165')],[reading('149/128'),reading('149/165')],[reading('149/165','uncertain',['149/128'])]]){
  const s=liveReportScenario();const r=await runPipeline({...s,proposal:{...s.proposal,cardNumber:'149/165'},vision:{...s.vision,identifiedBrandSet:'Scarlet & Violet 151',identifiedYear:'2023',identifiedCardNumber:'149/165',identityReadings},market:s.neutral});
  assert.equal(r.payload.valuationIdentityGate.allowed,false);assert.equal(r.report.rawValue,null);assert.equal(r.report.atlas,null);
 }
});
test('same catalog-supported identity and labeled probability survive changing unsupported defects',async()=>{
 const results=[];
 for(const visualObservations of [[],[{attribute:'surface',code:'scratches'}],[{attribute:'corners',code:'softening',certainty:'suspected'}]]){
  const s=liveReportScenario();const r=await runPipeline({...s,vision:{...s.vision,visualObservations},market:s.neutral,model:{psa9Value:75,psa10Value:180,psa10Probability:30}});
  results.push([r.report.canonicalCard.cardNumber,r.report.canonicalCard.parallel,r.report.psa10Probability,r.report.expectedNetValue,r.report.verdict]);
  assert.equal(r.report.financialDecision.probability.visionDefectsUsed,false);
  assert.doesNotMatch(r.report.imageAnalysis.imageSummary,/Visible surface scratches|Visible corner softening/);
 }
 assert.equal(new Set(results.map(JSON.stringify)).size,1);
});

test('candidate combinations share the existing nine-request cap and discard incomplete investigations',async()=>{
 let calls=0;
 const adapter=createTcgDexCatalog({fetchImpl:async url=>{
  calls++;const u=new URL(url),path=u.pathname;
  if(path.endsWith('/cards')){const n=u.searchParams.get('localId');return {ok:true,json:async()=>Array.from({length:4},(_,i)=>({id:`c${n}-${i}`,localId:n,name:'Pikachu ex'}))};}
  if(path.includes('/cards/')){const id=path.split('/').at(-1),n=id.match(/^c(\d+)-/)[1];return {ok:true,json:async()=>({id,localId:n,name:'Pikachu ex',rarity:'Special illustration rare',variants:{holo:true},set:{id:`s${id}`,name:`Set ${id}`,cardCount:{official:128}}})};}
  const id=path.split('/').at(-1),card=id.slice(1);return {ok:true,json:async()=>({id,name:`Set ${card}`,cardCount:{official:128},releaseDate:'2026-01-01'})};
 }});
 const result=await adapter.catalogLookup({subject:'Pikachu ex',cardNumber:'149/128',candidateQueries:[{subject:'Pikachu ex',cardNumber:'149'},{subject:'Pikachu ex',cardNumber:'150'}]});
 assert.ok(calls<=9);assert.equal(result.complete,false);assert.deepEqual(result.records,[]);
});
test('declared clear set-code contradictions cannot be ignored to force the known regression card',async()=>{
 const s=liveReportScenario();const r=await runPipeline({...s,vision:{...s.vision,identityReadings:[reading('149/128'),{field:'setCode',text:'MEW',certainty:'clear',side:'front',area:'set_mark',alternatives:[]}]},market:s.neutral});
 assert.equal(r.payload.valuationIdentityGate.allowed,false);assert.equal(r.report.rawValue,null);assert.equal(r.report.atlas,null);
});
test('rarity is not finish evidence: SIR cannot legalize reverse-holo or non-holo pricing',async()=>{
 const s=liveReportScenario();const r=await runPipeline({...s,market:s.neutral});
 const candidate=r.report.identityVerification.catalog.candidate;
 assert.equal(candidate.rarity,'Special illustration rare');assert.equal(candidate.variants.holo,true);
 for(const parallel of ['Reverse Holo Special Art','Non-Holo Special Art','Base','Holo Alternate Art'])assert.ok(catalogIdentityConflicts({...r.report.canonicalCard,parallel,variant:undefined},candidate).length);
});

test('missing-side, duplicate and contradictory findings cannot promote unassessable evidence',()=>{
 const bare={attribute:'surface',code:'scratches'};
 const supported=supportedObservation('surface','scratches');
 for(const visualObservations of [[bare,supported],[supported,bare],[bare,supportedObservation('surface','no_defect_observed')]]){
  const result=conditionPresentation({visualObservations},{});
  assert.equal(result.surface,null);
  assert.equal(result.conditionAssessments.surface.state,'unassessable');
  assert.doesNotMatch(result.surfaceNote,/Visible surface scratches/);
 }
 const back=supportedObservation('surface','scratches');back.evidence.side='back';
 assert.equal(conditionPresentation({inspectedSides:['front'],visualObservations:[back]},{}).conditionAssessments.surface.state,'unassessable');
});

test('real adapter discovers by local number but preserves exact and protected collector constraints',async()=>{
 const base=liveReportScenario(),adapter=catalog();
 const exact=await adapter.catalogLookup({subject:'Pikachu ex',cardNumber:'149/165'});
 assert.equal(exact.complete,true);assert.equal(exact.records.length,0);
 const discovered=await adapter.catalogLookup({subject:'Pikachu ex',cardNumber:'149/165',candidateQueries:[{subject:'Pikachu ex',cardNumber:'149'}]});
 assert.equal(discovered.records[0].cardNumber,'149/128');assert.equal(discovered.records[0].variants.holo,true);
 const protectedReport=await runPipeline({...base,proposal:{...base.proposal,cardNumber:'149/165'},vision:{...base.vision,identifiedCardNumber:'149/165',identityReadings:[reading('149/128')]},textOnly:true,fields:{cardName:'Pikachu ex',cardType:'pokemon',confirmedVariant:{parallel:'Holo Special Art'},confirmedCardIdentity:{...base.proposal,cardNumber:'149/165'}},market:base.neutral});
 assert.equal(protectedReport.payload.valuationIdentityGate.allowed,false);assert.equal(protectedReport.report.rawValue,null);
});

import {catalogInvestigation} from '../lib/visionIdentityEvidence.mjs';
test('printed subject/language/partial-number contradictions and truncated alternatives fail closed',()=>{
 const card={subject:'Pikachu ex',cardNumber:'149/165'};
 const field=(field,text)=>({field,text,certainty:'clear',side:'front',area:field==='subject'?'name':'body_text'});
 for(const readings of [[field('subject','Pikachu ex'),field('subject','Charizard ex')],[field('language','English'),field('language','Japanese')],[reading('149'),reading('150/128')]])assert.equal(catalogInvestigation(card,{readings,enabled:true}).blocked,true);
 const bound=catalogInvestigation(card,{enabled:true,readings:[{...field('subject','Pikachu ex'),certainty:'uncertain',alternatives:['Raichu ex']},reading('149','uncertain',['150','151'])]});
 assert.equal(bound.blocked,true);assert.equal(bound.reason,'candidate_combination_limit');
 const clear=catalogInvestigation(card,{enabled:true,readings:[field('subject','Pikachu ex'),{...field('subject','Charizard ex'),certainty:'uncertain'}]});
 assert.ok(clear.queries.every(q=>q.subject==='Pikachu ex'));
 const unreadable=catalogInvestigation(card,{enabled:true,readings:[reading('150/128','unreadable')]});
 assert.equal(unreadable.queries[0].cardNumber,'149');
});

test('identity readings cannot claim an unprovided back or override a clear printed language',async()=>{
 const s=liveReportScenario();
 const unseen=await runPipeline({...s,vision:{...s.vision,identityReadings:[{...reading('150/128'),side:'back'}]},market:s.neutral});
 assert.equal(unseen.payload.imageAnalysis.identityReadings.length,0);
 const englishRecords=await catalog().catalogLookup({subject:'Pikachu ex',cardNumber:'149/128',language:'en'});
 const japanese=await runPipeline({...s,catalogOptions:{catalogSource:'tcgdex',allowCatalogCorrection:true,catalogLookup:async()=>englishRecords},vision:{...s.vision,identityReadings:[{field:'language',text:'Japanese',certainty:'clear',side:'front',area:'body_text'}]},market:s.neutral});
 assert.equal(japanese.payload.originalCanonicalCard.language,'Japanese');
 assert.equal(japanese.payload.valuationIdentityGate.allowed,false);
});

import {withheldSummary} from '../lib/valuationProtection.mjs';
test('shared withheld summaries cannot present a rejected AI identity as a current fact',async()=>{
 const s=liveReportScenario();const r=await runPipeline({...s,proposal:{...s.proposal,cardNumber:'149/165',brandSet:'Scarlet & Violet 151'},vision:{...s.vision,identifiedCardNumber:'149/165'},market:s.neutral});
 const summary=withheldSummary(r.report);assert.match(summary,/Unverified card/);assert.doesNotMatch(summary,/Scarlet & Violet 151|149\/165/);
});

test('observed three-provider smoke patterns cannot establish unsupported physical damage or centering',()=>{
 // Minimal structural reproductions of actual run #3 patterns; no private raw responses/photos.
 const scratch=supportedObservation('surface','scratches',{certainty:'suspected'});scratch.evidence={...scratch.evidence,region:[.1,.1,.8,.8],confidence:.6};
 const whitening=supportedObservation('corners','whitening',{certainty:'suspected'});whitening.evidence.region=[.9,0,1,.1];
 const centering=supportedObservation('centering','off_center');centering.evidence={...centering.evidence,side:'back',region:[0,0,1,1],measurement:{axis:'horizontal',ratio:[40,60]}};
 for(const imageLimitations of [['sleeve'],['glare']]){
  const result=conditionPresentation({inspectedSides:['front','back'],imageLimitations,visualObservations:[scratch,whitening,centering]},{});
  assert.equal(result.surface,null);assert.equal(result.corners,null);assert.equal(result.centering,null);
  assert.equal(result.conditionAssessments.centering.state,'suspected_defect');
  assert.equal(result.conditionAssessments.corners.state,'unassessable');
  assert.doesNotMatch(result.imageSummary,/Visible off-centering|Visible corner whitening|Visible surface scratches/);
  assert.equal(result.estimatedGrade,null);assert.equal(result.worthGrading,null);
 }
});
test('verified catalog context is optional, excludes printing claims and never enters benchmark defaults',async()=>{
 const {buildVisionPrompt}=await import('../lib/visionPrompt.mjs');
 const identity={subject:'Pikachu ex',year:'2026',brandSet:'30th Celebration',cardNumber:'149/128',language:'English',rarity:'Special illustration rare',parallel:'Holo Special Art',printings:['holo']};
 const prompt=buildVisionPrompt({verifiedIdentity:identity});
 assert.match(prompt,/Independently verified printed-card identity.*30th Celebration/);
 assert.match(prompt,/Physical printing, authenticity and condition are NOT established/);
 assert.doesNotMatch(prompt,/Holo Special Art|"printings"/);
 assert.doesNotMatch(buildVisionPrompt(),/Independently verified printed-card identity|30th Celebration/);
});

test('high confidence alone cannot turn a broad damage region into localized evidence',()=>{
 for(const [attribute,code] of [['surface','scratches'],['corners','whitening'],['corners','softening'],['edges','whitening']]){
  const finding=supportedObservation(attribute,code);finding.evidence.region=[.1,.1,.8,.8];
  const result=conditionPresentation({visualObservations:[finding]},{});
  assert.equal(result[attribute],null);assert.equal(result.conditionAssessments[attribute].state,'unassessable');
 }
});

import {conditionObservationText} from '../lib/visualEvidence.mjs';
import {hostedConditionSummary} from './helpers/hostedConditionSummary.mjs';
test('real hosted excerpt: negative observations never become damage allegations',()=>{
 assert.equal(hostedConditionSummary.observations[1].modelSupport,.82);
 for(const finding of hostedConditionSummary.observations.filter(f=>f.code==='no_defect_observed')){
  assert.match(conditionObservationText(finding),/model reported no visible defect/);
  assert.doesNotMatch(conditionObservationText(finding),/Possible .*no defect|suspected defect|Visible .*whitening/);
 }
 const out=conditionPresentation({visualObservations:hostedConditionSummary.observations},{});
 for(const attribute of ['surface','corners','edges','centering'])assert.equal(out.conditionAssessments[attribute].state,'unassessable');
 assert.equal(out.estimatedGrade,null);assert.equal(out.worthGrading,null);
});
test('synthetic evidence boundaries keep clean, suspected damage and insufficient evidence separate',()=>{
 for(const confidence of [.82,.72,.70]){
  const clean=supportedObservation('surface','no_defect_observed');clean.evidence.confidence=confidence;
  for(const imageLimitations of [[],['sleeve'],['glare']]){
   const out=conditionPresentation({visualObservations:[clean],imageLimitations},{});
   assert.equal(out.conditionAssessments.surface.state,confidence>=.8&&!imageLimitations.length?'no_defect_observed':'unassessable');
   assert.equal(out.surface,null);assert.equal(out.estimatedGrade,null);
   assert.doesNotMatch(out.surfaceNote,/Possible|suspected defect/);
  }
 }
 const scratch=supportedObservation('surface','scratches',{certainty:'suspected'});
 assert.equal(conditionPresentation({visualObservations:[scratch]},{}).conditionAssessments.surface.state,'suspected_defect');
 scratch.evidence.region=[0,0,1,1];
 assert.equal(conditionPresentation({visualObservations:[scratch]},{}).conditionAssessments.surface.state,'unassessable');
 const noMeasure=supportedObservation('centering','off_center');delete noMeasure.evidence.measurement;
 assert.equal(conditionPresentation({visualObservations:[noMeasure]},{}).conditionAssessments.centering.state,'unassessable');
});
test('negative findings remain safe across duplicate, conflict and saved-report re-normalization',()=>{
 const clean=supportedObservation('surface','no_defect_observed');
 const scratch=supportedObservation('surface','scratches');
 const first=conditionPresentation({visualObservations:[clean,scratch]},{});
 assert.doesNotMatch(first.surfaceNote,/Possible surface no defect/);
 assert.equal(first.visualObservations.find(f=>f.code==='no_defect_observed').certainty,'unassessable');
 assert.notEqual(first.conditionAssessments.surface.state,'no_defect_observed');
 const second=conditionPresentation(first,{});
 assert.doesNotMatch(second.surfaceNote,/Possible surface no defect/);assert.equal(second.surface,null);
});

test('clean observations never become grade limiters, damage ratings or gem risk factors',()=>{
 const out=conditionPresentation({visualObservations:['surface','corners','edges'].map(attribute=>supportedObservation(attribute,'no_defect_observed'))},{});
 assert.deepEqual(out.gemRiskFactors,[]);assert.doesNotMatch(out.primaryLimiter,/documented area/);
 assert.equal(out.worthGrading,null);assert.equal(out.estimatedGrade,null);
 for(const attribute of ['surface','corners','edges']){assert.equal(out[attribute],null);assert.equal(out.conditionAssessments[attribute].state,'no_defect_observed');}
});

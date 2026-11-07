// Synthetic measurement fixtures only; none are historical or real benchmark outcomes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {evaluateBenchmark,validateManifest,sanitizeObservation,benchmarkMarkdown,IDENTITY_FIELDS} from '../lib/identificationBenchmark.mjs';
import {importScanEvidence,main} from '../scripts/identity-benchmark.mjs';
const root=new URL('../',import.meta.url),load=p=>JSON.parse(readFileSync(new URL(p,root)));
const baseline='ff3b3a5cf2b4326049ec666af11c44fdfc621cbb';
test('sports import never fabricates a TCGdex provider or mistakes print run for the copy serial',()=>{
 const o=importScanEvidence({stage:'identity',success:true,canonicalCard:{subject:'Josh Dix',cardNumber:'PA-JD',printRun:'99'}},{id:'O-1',cardId:'GP-ID-011',cohortId:'test',attemptIndex:1});assert.equal(o.catalog.provenance.provider,null);assert.equal(o.canonical.serialNumber,null);assert.equal(o.canonical.printRun,'99');assert.equal(o.canonical.cardNumber,'PA-JD');
});
test('owner inventory does not force seven Pokemon and five sports into the original target mix',()=>{
 const m=load('benchmarks/identity/manifest.json');assert.equal(m.cards.filter(c=>c.category.startsWith('pokemon')).length,7);assert.equal(m.cards.filter(c=>c.category.startsWith('sports')).length,5);assert.ok(m.cards.some(c=>c.displayName.includes('Josh Dix')));assert.ok(m.cards.some(c=>c.displayName.includes('Babe Ruth')));assert.ok(m.cards.every(c=>c.groundTruth.status==='unreviewed'));assert.equal(m.cards.find(c=>c.id==='GP-ID-011').groundTruth.fields.serialNumber,undefined);
});
test('Rosa reference is Ultra Rare, never a physically reviewed SIR label',()=>{
 const c=load('benchmarks/identity/manifest.json').cards.find(c=>c.id==='GP-ID-006');assert.equal(c.referenceFacts.rarity,'Ultra Rare');assert.equal(c.category,'pokemon_other_rarity');assert.equal(c.groundTruth.status,'unreviewed');assert.ok(c.referenceFacts.sources[0].revision);
});
test('verified catalog/photo claims cannot ignore a wrong independently reviewed language',()=>{
 const f=fixture();f.observation.canonical={...f.values,language:'Japanese'};const r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.rows[0].core.status,'correct');assert.equal(r.metrics.falseVerificationCount,1);
});
test('owner or model-derived labels cannot substitute for independent field-specific truth',()=>{
 const f=fixture();f.truth.sources[0].kind='owner_summary';assert.equal(evaluateBenchmark(f.manifest,[f.observation]).metrics.coreAccuracy.denominator,0);
});
test('failed or incomplete repeat outputs are not counted as consistent card identification',()=>{
 const f=fixture();f.observation.technical.validCompletedResponse=false;f.observation.canonical={};const repeat={...f.observation,id:'O-2',attemptIndex:2};const r=evaluateBenchmark(f.manifest,[f.observation,repeat]);assert.equal(r.repeatComparisons[0].comparable,false);assert.equal(r.repeatComparisons[0].canonicalSame,null);
});
test('historical copyright summary is retained without inventing a literal model transcription',()=>{
 const r=evaluateBenchmark(load('benchmarks/identity/manifest.json'),load('benchmarks/identity/historical-observations.json').observations);const o=r.observations.find(o=>o.id==='H-ZAP-03');assert.equal(o.technical.stopReason,'end_turn');assert.equal(o.reportedPrintedFacts[0].value,'2026');assert.equal(o.reportedPrintedFacts[0].literalTranscriptionRetained,false);assert.ok(!o.printedReadings.some(r=>r.field==='copyrightYear'));
});
function fixture(category='pokemon_standard'){
 const values={subject:'Synthetic card',year:'2026',set:'Synthetic set',cardNumber:'133/128',language:'English',rarity:'Illustration rare',parallel:'Base',finish:'holo',stamps:['test-stamp'],manufacturer:'Test manufacturer',subset:'Test subset',serialNumber:'12/99',autograph:false};
 const truth={status:'independently_reviewed',reviewer:'Offline fixture reviewer',reviewedAt:'2026-11-07',fields:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{status:'known',value}])),sources:[{kind:'manufacturer_checklist',url:'https://example.test/checklist',supports:Object.keys(values)}],catalogId:'test-133',catalogProvider:'tcgdex'};
 const card={id:'T-1',category,physicalCardId:'synthetic-physical-1',displayName:'Synthetic fixture',selection:'test_only',photos:{front:{status:'retained_and_reviewed',sha256:'a'.repeat(64)},back:{status:'not_retained',sha256:null}},groundTruth:truth,requiredExactFields:['language','rarity','parallel','finish','stamps'],gaps:[]};
 const manifest={version:1,baselineCommit:baseline,cohortId:'unit-only',categoryPlan:{[category]:1},cards:[card]};
 const observation={id:'O-1',cardId:'T-1',cohortId:'unit-only',attemptIndex:1,evidenceKind:'live_scan',photoHashes:{front:'a'.repeat(64)},technical:{validCompletedResponse:true,httpStatus:200},canonical:values,originalAI:values,catalog:{outcome:'supported',candidatesRetained:true,candidates:[{provider:'tcgdex',id:'test-133'}]},claims:{catalogVerified:true},usage:{outputTokens:405},cost:{actualUsd:null},latencyMs:null};
 return {manifest,card,truth,observation,values};
}
test('initial 12 slots preserve requested category mix without manufacturing owner inventory or reviewed labels',()=>{
 const target=load('benchmarks/identity/target-manifest.json');assert.equal(validateManifest(target),target);const m=load('benchmarks/identity/manifest.json');assert.equal(validateManifest(m),m);assert.equal(m.cards.length,12);assert.equal(m.cards.filter(c=>c.physicalCardId).length,12);assert.ok(m.cards.every(c=>c.groundTruth.status==='unreviewed'));assert.ok(m.excludedDisputedFixtures[0].label.includes('Konnor'));
});
test('historical repeated Zapdos observations are one card and never accuracy trials',()=>{
 const r=evaluateBenchmark(load('benchmarks/identity/manifest.json'),load('benchmarks/identity/historical-observations.json').observations);
 assert.equal(r.historical.observations,5);assert.equal(r.historical.physicalCards,2);assert.equal(r.completedAccuracyTests,0);assert.equal(r.metrics.coreAccuracy.denominator,0);assert.equal(r.metrics.coreAccuracy.rate,null);assert.equal(r.cost.actualUsd,null);
 const zap=r.rows.find(c=>c.cardId==='GP-ID-003');assert.equal(zap.historicalObservationIds.length,4);assert.equal(r.observations.find(o=>o.id==='H-ZAP-03').usage.outputTokens,405);assert.equal(r.observations.find(o=>o.id==='H-ZAP-03').deploymentCommit,null);
});
test('eligible independently labeled photographed scan measures core and exact separately',()=>{
 const {manifest,observation}=fixture();observation.canonical={...observation.canonical,rarity:'Special illustration rare'};const r=evaluateBenchmark(manifest,[observation]);
 assert.equal(r.metrics.coreAccuracy.numerator,1);assert.equal(r.metrics.exactPrintingAccuracy.numerator,0);assert.equal(r.rows[0].exact.fields.rarity,'incorrect');assert.equal(r.metrics.verificationPrecision.numerator,1);
});
test('missing photograph or unreviewed label cannot count as completed accuracy',()=>{
 for(const modify of [c=>c.photos.front.status='not_retained',c=>c.photos.front.sha256=null,c=>c.groundTruth.status='disputed',c=>c.groundTruth.reviewer=null,c=>c.groundTruth.sources=[]]){const f=fixture();modify(f.card);const r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.completedAccuracyTests,0);assert.equal(r.metrics.coreAccuracy.denominator,0);}
});
test('photo hashes bind observations to the reviewed front/back pair',()=>{
 const f=fixture();f.observation.photoHashes.back='b'.repeat(64);assert.equal(evaluateBenchmark(f.manifest,[f.observation]).rows[0].coreEligible,false);
 f.card.photos.back={status:'retained_and_reviewed',sha256:'b'.repeat(64)};assert.equal(evaluateBenchmark(f.manifest,[f.observation]).rows[0].coreEligible,true);
});
test('synthetic and historical evidence never enters measured live cohort even with labels',()=>{
 for(const evidenceKind of ['synthetic','owner_reported_summary']){const f=fixture();f.observation.evidenceKind=evidenceKind;const r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.metrics.technicalSuccess.denominator,0);assert.equal(r.completedAccuracyTests,0);}
});
test('first attempt remains primary; repeats cannot improve cross-card scores',()=>{
 const f=fixture();f.observation.canonical={...f.values,year:'2025'};const second={...f.observation,id:'O-2',attemptIndex:2,canonical:f.values};const r=evaluateBenchmark(f.manifest,[second,f.observation]);
 assert.equal(r.metrics.coreAccuracy.numerator,0);assert.equal(r.metrics.coreAccuracy.denominator,1);assert.equal(r.rows[0].repeatCount,1);assert.equal(r.repeatComparisons[0].canonicalSame,false);assert.equal(r.cost.requestsRecorded,2);
});
test('duplicate IDs, physical cards, photographs and attempt orders are rejected',()=>{
 for(const field of ['id','physicalCardId','photo']){const f=fixture();const other=structuredClone(f.card);other.id=field==='id'?'T-1':'T-2';other.physicalCardId=field==='physicalCardId'?f.card.physicalCardId:'physical-2';other.photos.front.sha256=field==='photo'?f.card.photos.front.sha256:'b'.repeat(64);f.manifest.cards.push(other);f.manifest.categoryPlan.pokemon_standard=2;assert.throws(()=>evaluateBenchmark(f.manifest,[]),/duplicate/);}
 const f=fixture();assert.throws(()=>evaluateBenchmark(f.manifest,[f.observation,{...f.observation,id:'O-2'}]),/attempt_order/);assert.throws(()=>evaluateBenchmark(f.manifest,[f.observation,f.observation]),/reference_invalid/);
 f.observation.attemptIndex=2;assert.throws(()=>evaluateBenchmark(f.manifest,[f.observation]),/attempt_order/);
});
test('incorrect collector denominator and sports prefix cannot be normalized away',()=>{
 const f=fixture();f.observation.canonical={...f.values,cardNumber:'133/129'};assert.equal(evaluateBenchmark(f.manifest,[f.observation]).rows[0].core.status,'incorrect');
 f.card.groundTruth.fields.cardNumber.value='BCP-86';f.observation.canonical.cardNumber='86';assert.equal(evaluateBenchmark(f.manifest,[f.observation]).rows[0].core.status,'incorrect');
});
test('missing output stays incomplete, while verified incorrect identity is counted false',()=>{
 const f=fixture();f.observation.canonical={...f.values,year:null};let r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.rows[0].core.status,'incomplete');assert.equal(r.metrics.falseVerificationCount,0);assert.equal(r.metrics.unassessableVerificationClaims,1);
 f.observation.canonical.year='2025';r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.metrics.falseVerificationCount,1);assert.equal(r.metrics.verificationPrecision.denominator,1);assert.equal(r.metrics.verificationPrecision.numerator,0);
});
test('an exact-printing verification claim is assessed against exact fields, not just matching core',()=>{
 const f=fixture();f.observation.claims={printingVerified:true};f.observation.canonical={...f.values,finish:'reverse'};const r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.metrics.falseVerificationCount,1);
});
test('not-applicable serial numbering cannot hide a fabricated numbered copy',()=>{
 const f=fixture();f.card.requiredExactFields.push('serialNumber');f.truth.fields.serialNumber={status:'not_applicable'};f.observation.canonical={...f.values,serialNumber:'12/99'};assert.equal(evaluateBenchmark(f.manifest,[f.observation]).rows[0].exact.fields.serialNumber,'incorrect');
});
test('candidate recall is unknown when retrieval list is not retained, not a false zero',()=>{
 const f=fixture();f.observation.catalog.candidatesRetained=false;let r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.metrics.candidateRecall.denominator,0);
 f.observation.catalog.candidatesRetained=true;r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.metrics.candidateRecall.numerator,1);f.observation.catalog.candidates=[];assert.equal(evaluateBenchmark(f.manifest,[f.observation]).metrics.candidateRecall.numerator,0);
 f.observation.catalog.candidates=Array.from({length:21},(_,i)=>({provider:'tcgdex',id:'candidate-'+i}));assert.equal(evaluateBenchmark(f.manifest,[f.observation]).metrics.candidateRecall.denominator,0);
});
test('sports AI correctness and manufacturer corroboration do not imply runtime independent verification',()=>{
 const f=fixture('sports_parallel');f.observation.claims={};f.observation.canonical={...f.values,parallel:null};let r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.rows[0].sportsStatus,'ai_correct_no_independent_runtime_catalog');assert.equal(r.rows[0].checklistCorroborated,true);assert.equal(r.rows[0].exactParallelUnresolved,true);
 f.observation.claims={catalogVerified:true};r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.metrics.unsupportedSportsVerificationClaims,1);
});
test('failed paid attempts remain in technical, cost and latency denominators without inventing missing bills',()=>{
 const f=fixture();f.observation.technical={validCompletedResponse:false,failureCode:'ANALYSIS_RESPONSE_INVALID'};f.observation.cost={actualUsd:0.01,basis:'billing_export'};f.observation.latencyMs=1234;const r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.metrics.technicalSuccess.numerator,0);assert.equal(r.cost.actualUsd,0.01);assert.equal(r.latency.meanMs,1234);assert.equal(r.observations[0].usage.inputTokens,null);
});
test('category plan can measure another TCG separately without claiming integration exists',()=>{
 const f=fixture('tcg_mtg');const r=evaluateBenchmark(f.manifest,[f.observation]);assert.equal(r.categories.tcg_mtg.slots,1);assert.equal(r.rows[0].sportsStatus,null);
});
test('importer strips credentials, raw response bodies, URLs and photographs while retaining supported metadata',()=>{
 const raw={stage:'identity',success:true,originalIdentityObservation:{identifiedSubject:'Zapdos',identifiedParallel:'Special Illustration Rare (full-art holo)',identityConfidence:72,identityReadings:[{field:'setCode',text:'J 30CEN',certainty:'uncertain',side:'front'}]},canonicalCard:{subject:'Zapdos',brandSet:'30th Celebration',cardNumber:'133/128'},sourceCatalogEvidence:{source:{revision:'a'.repeat(40),cardBlob:'b'.repeat(40)}},credentials:'SECRET_ROOT_KEY',rawModelResponse:'SECRET_RAW_BODY',image:'SECRET_PHOTO',marketplaceUrl:'https://secret.test/?key=SECRET_QUERY'};
 const o=importScanEvidence(raw,{id:'O-1',cardId:'T-1',cohortId:'test',attemptIndex:1});assert.equal(o.originalAI.subject,'Zapdos');assert.equal(o.printedReadings[0].text,'J 30CEN');assert.equal(o.printedReadings[0].certainty,'uncertain');assert.equal(o.catalog.candidatesRetained,false);assert.equal(o.cost.actualUsd,null);assert.equal(o.catalog.provenance.revision,'a'.repeat(40));assert.doesNotMatch(JSON.stringify(o),/SECRET|https?:/);
 assert.equal(sanitizeObservation({originalAI:{subject:'https://secret.test/?token=abc'}}).originalAI.subject,null);
});
test('failed Preview diagnostic import preserves validation rule, deployment revision and output usage',()=>{
 const o=importScanEvidence({version:1,environment:'preview',stage:'identity',commit:baseline,stages:{identity:'failed'},responseStatus:502,failureCode:'ANALYSIS_RESPONSE_INVALID',identityValidation:{phase:'json',rule:'json_syntax'},identityCompletion:{usage:{outputTokens:405}}},{id:'O-1',cardId:'T-1',cohortId:'test',attemptIndex:1});assert.equal(o.technical.validCompletedResponse,false);assert.equal(o.technical.rule,'json_syntax');assert.equal(o.deploymentCommit,baseline);assert.equal(o.usage.outputTokens,405);assert.equal(o.latencyMs,null);
 assert.throws(()=>importScanEvidence({content:[{text:'raw provider'}]},{}),/requires_identity/);
});
test('reproducible report command requires no network and imported output refuses overwrite',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'gp-benchmark-'));try{
  main(['report','--output',path.join(dir,'report')]);const r=JSON.parse(readFileSync(path.join(dir,'report/results.json')));assert.equal(r.completedAccuracyTests,0);assert.equal(readFileSync(path.join(dir,'report/REPORT.md'),'utf8'),benchmarkMarkdown(r));
  const raw=path.join(dir,'raw.json'),output=path.join(dir,'scan.json');writeFileSync(raw,JSON.stringify({stage:'identity',success:false}));const args=['import','--input',raw,'--output',output,'--id','O-1','--card','GP-ID-003','--cohort','test','--attempt','1'];main(args);assert.equal(JSON.parse(readFileSync(output)).evidenceDigest.length,64);assert.throws(()=>main(args),/EEXIST/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

// Controlled historical fixtures. No live market/model/device claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { liveReportScenario, title } from './helpers/liveReportFixture.mjs';
import { askingFixture } from './helpers/scanAcceptance.mjs';
const model = { psa9Value: 75, psa10Value: 180, psa10Probability: 30 };
test('scan acceptance: repeated copies of one source listing never become three comparables', async () => {
 const s = liveReportScenario(); const listing = askingFixture();
 const r = await runPipeline({ ...s, market: [listing, structuredClone(listing), { ...listing, itemId: 'v1|123456789012|1' }], model });
 assert.equal(r.report.marketData.marketSummary.rawUsedCount, 1);
 assert.equal(r.report.marketData.marketSummary.marketConfidence, 20);
 assert.equal(r.report.rawValue, 56.99); assert.equal(r.report.expectedNetValue, -30.49);
});
test('scan acceptance: ten controlled outputs preserve canonical identity despite recorded-style wrong AI sets', async () => {
 const projections = [], identities = [];
 const guesses = [['2023','Paldea Evolved',92],['2023','Obsidian Flames',90],['2024','Stellar Crown',88],['2024','Surging Sparks',91],['2024','Stellar Crown',89]];
 for (let i=0;i<10;i++) {
  const [year, brandSet, confidence] = guesses[i%guesses.length]; const s = liveReportScenario();
  const r = await runPipeline({ ...s, proposal: { ...s.proposal, year, brandSet }, vision: { ...s.vision, identifiedYear: year, identifiedBrandSet: brandSet, identityConfidence: confidence }, market: [askingFixture()], model });
  identities.push([r.report.canonicalCard.subject,r.report.canonicalCard.year,r.report.canonicalCard.brandSet,r.report.canonicalCard.cardNumber,r.report.canonicalCard.parallel,r.report.canonicalCard.language]);
  projections.push([r.report.rawValue,r.report.psa9Value,r.report.psa10Value,r.report.psa10Probability,r.report.expectedNetValue,r.report.verdict]);
  assert.equal(r.report.atlas,null); assert.equal(r.report.financialDecision.population.status,'unavailable');
  assert.doesNotMatch(r.report.analysis,/Paldea|Obsidian|Stellar|Surging/);
 }
 assert.equal(new Set(identities.map(JSON.stringify)).size,1); assert.equal(new Set(projections.map(JSON.stringify)).size,1);
 assert.deepEqual(projections[0],[56.99,75,180,30,-30.49,'provisional']);
});
test('scan acceptance: exact wrong year, set, number, language and printing never supply raw prices', async () => {
 for (const text of [title.replace('2026','2023'), title.replace('30th Celebration','Surging Sparks'),title.replace('149/128','149/198'),title.replace('English','Japanese'),title.replace('Holo Special Illustration Rare','Reverse Holo Special Illustration Rare')]) {
  const r=await runPipeline({...liveReportScenario(),market:[{...askingFixture(),title:text}],model});
  assert.equal(r.report.rawValue,null);assert.equal(r.report.atlas,null);
 }
});

test('scan acceptance: contradictory copies of a source quarantine the entire listing',async()=>{
 const listing=askingFixture();
 for(const patch of [{price:{value:'9999',currency:'USD'}},{title:listing.title.replace('2026','2023')},{localizedAspects:[{name:'Finish',value:'Reverse Holo'}]}]){
  const r=await runPipeline({...liveReportScenario(),market:[listing,{...listing,...patch}],model});
  assert.equal(r.report.rawValue,null);assert.equal(r.report.atlas,null);
  assert.equal(r.payload.marketData.marketDiagnostics.conflictingDuplicateCount,2);
 }
});

test('scan acceptance: varied modeled probabilities change only labeled scenarios, never fabricate a trusted decision',async()=>{
 const results=[];
 for(const probability of [30,31,60]){
  const r=await runPipeline({...liveReportScenario(),market:[askingFixture()],model:{...model,psa10Probability:probability}});
  results.push(r.report.expectedNetValue);assert.equal(r.report.verdict,'provisional');assert.equal(r.report.atlas,null);
  assert.ok(r.metrics.modelRequests.every(request=>request.temperature===0&&request.model==='claude-sonnet-4-6'));
  assert.doesNotMatch(r.metrics.predictionPrompt,/Current GemPredict Fair Market Value|authoritative raw market value/);
  assert.match(r.metrics.predictionPrompt,/Active asking median \(not completed sales\)/);
 }
 assert.deepEqual(results,[-30.49,-29.44,1.01]);
});

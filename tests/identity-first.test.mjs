import test from 'node:test';
import assert from 'node:assert/strict';
import { conditionPresentation, readVisualEvidence } from '../lib/visualEvidence.mjs';
import { visualConditionAnalysis, isMarketAnalysisAvailable, safeStoredReport } from '../lib/valuationProtection.mjs';
import { liveReportScenario, listings, title } from './helpers/liveReportFixture.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { verifiedIdentity } from './helpers/verifiedIdentity.mjs';
const card = { subject: 'Pikachu ex', year: '2026', brandSet: '30th Celebration', cardNumber: '149/128', parallel: 'Holo Special Art', language: 'English' };
const raw = { identifiedYear: '2023', identifiedBrandSet: 'Obsidian Flames', identifiedSubject: 'Pikachu ex', identityConfidence: 90,
  imageSummary: 'This Obsidian Flames Pikachu is a guaranteed PSA 10 candidate.', centeringNote: 'Obsidian Flames has superior centering.', cornersNote: 'Wrong set has a valuable print run.', gradingRisk: 'Obsidian Flames is easy to grade.', worthGradingReason: 'Grade Obsidian Flames for profit.',
  estimatedGrade: 'Guaranteed PSA 10', overallScore: 10, worthGrading: true,
  centering: 'good', corners: 'good', surface: 'fair', edges: 'good',
  visualObservations: [{ attribute: 'corners', code: 'whitening' }, { attribute: 'surface', code: 'scratches' }], imageLimitations: ['glare'],
};
test('all trusted condition strings are generated from canonical identity and validated observations, never model prose', () => {
  const verification = verifiedIdentity(card).identityVerification;
  for (const trusted of [false, true]) {
    const output = visualConditionAnalysis(raw, trusted, card, verification);
    const { unverifiedInterpretation, identifiedYear, identifiedBrandSet, identifiedSubject, identityConfidence, ...condition } = output;
    assert.doesNotMatch(JSON.stringify(condition), /Obsidian Flames|guaranteed|PSA 10 candidate|profit/);
    assert.match(output.imageSummary, /2026.*30th Celebration.*149\/128.*Visible corner whitening.*Visible surface scratches/);
    assert.equal(output.cornersNote, 'Visible corner whitening.'); assert.equal(output.estimatedGrade, null); assert.equal(output.overallScore, null);
    assert.equal(unverifiedInterpretation.imageSummary, raw.imageSummary); assert.equal(identifiedBrandSet, 'Obsidian Flames'); assert.equal(identityConfidence, 90);
    assert.deepEqual(visualConditionAnalysis(output, trusted, card, verification), output, 'rehydration is idempotent');
  }
});
test('unknown identity and missing visual ratings remain explicitly unverified/unassessed', () => {
  const output = visualConditionAnalysis({ imageSummary: 'Obsidian Flames is certain.', visualObservations: [] }, false, card, { catalog: { status: 'unavailable' } });
  assert.match(output.imageSummary, /^Card identity is unverified/); assert.doesNotMatch(output.imageSummary, /30th Celebration|Obsidian Flames/);
  assert.equal(output.centering, null); assert.equal(output.centeringNote, 'Not assessed from the photo.');
});
test('observation codes are bounded and allowlisted; unsupported identity/grade fields cannot become observations', () => {
  const evidence = readVisualEvidence({ visualObservations: [null, { attribute: '__proto__', code: 'toString' }, { attribute: 'corners', code: 'constructor' }, { attribute: 'identity', code: 'Obsidian Flames' }, { attribute: 'surface', code: 'PSA 10' }, { attribute: 'corners', code: 'whitening', note: 'Obsidian Flames guaranteed grade' }, { attribute: 'corners', code: 'whitening' }], imageLimitations: ['glare', 'glare', 'certain grade'] });
  assert.deepEqual(evidence, { findings: [{ attribute: 'corners', code: 'whitening' }], limitations: ['glare'] });
});
test('legacy visual extraction retains explicit defects without copying prose or reversing negation', () => {
  for (const note of ['No scratches visible.', 'Surface scratches are not visible.', 'Possible scratches.', 'Scratches may be hidden.']) assert.deepEqual(readVisualEvidence({ surfaceNote: note }).findings, []);
  const output = conditionPresentation({ surfaceNote: 'Obsidian Flames has visible surface scratches.', cornersNote: 'No whitening.' }, { card, identityVerified: true, trusted: true });
  assert.equal(output.surfaceNote, 'Visible surface scratches.'); assert.doesNotMatch(output.imageSummary, /Obsidian Flames/);
});
test('existing structural damage safety cannot be overridden by clean or missing structured observations', () => {
  const output = conditionPresentation({ worthGrading: true, visualSafetyFlags: { structuralDamage: true }, visualObservations: [] }, { card, identityVerified: true, trusted: true });
  assert.equal(output.worthGrading, false); assert.match(output.gradingRisk, /structural damage/); assert.equal(output.estimatedGrade, null);
});
test('actual Obsidian Flames 90% scan is corrected before retrieval; serialized search logs preserve every rejection count', async () => {
  const base = liveReportScenario();
  const result = await runPipeline({ ...base, proposal: { ...base.proposal, brandSet: 'Obsidian Flames' }, vision: raw, market: listings(title.replace('Holo Special Illustration Rare', 'Reverse Holo Special Illustration Rare')) });
  assert.equal(result.payload.valuationIdentityGate.allowed, true); assert.equal(result.report.canonicalCard.brandSet, '30th Celebration');
  assert.equal(result.report.rawValue, null); assert.equal(result.report.atlas, null); assert.equal(isMarketAnalysisAvailable(result.report), false);
  assert.doesNotMatch(result.report.imageAnalysis.imageSummary, /Obsidian Flames|PSA 10/);
  const logs = result.metrics.pricingLogs;
  assert.equal(logs.length, 1 + result.report.pricingDiagnostics.searches.length);
  assert.equal(logs[0].searches, undefined);
  assert.ok(logs.slice(1).every(log => log.requestId === logs[0].requestId && typeof log.rejectionCounts === 'object' && log.retrievalLimit === 100));
  assert.doesNotMatch(JSON.stringify(logs), /\[Object\]|Authorization|access_token|Obsidian Flames/);
  const restored = safeStoredReport(result.report); assert.doesNotMatch(restored.imageAnalysis.imageSummary, /Obsidian Flames/);
});

test('bounded retrieval restores prices for real matching test records ranked below the old twenty-result window', async () => {
  const good = listings();
  const wrong = Array.from({ length: 134 }, (_, i) => ({ ...listings(title.replace('Holo Special Illustration Rare', 'Reverse Holo Special Illustration Rare'))[0], itemId: `wrong-${i}` }));
  wrong[0] = { ...wrong[0], title: title + ' PSA 10', condition: 'Graded' };
  wrong[1] = { ...wrong[1], title: title + ' PSA 9', condition: 'Graded' };
  wrong.splice(66, 3, ...good);
  for (const cap of [20, 100]) {
    const base = liveReportScenario();
    const result = await runPipeline({ ...base, marketTotal: wrong.length, market: (query, metrics, options) => {
      assert.equal(options.limit, 100); assert.equal(options.offset, 0);
      return wrong.slice(0, Math.min(cap, options.limit));
    } });
    assert.equal(result.metrics.valuationBrowse, 6, 'same request budget; no additional provider requests or pages');
    assert.equal(isMarketAnalysisAvailable(result.report), cap === 100);
    assert.equal(result.report.marketData.marketSummary.rawUsedCount, cap === 100 ? 3 : 0);
    assert.equal(result.report.rawValue, cap === 100 ? 40 : null);
    assert.ok(result.report.pricingDiagnostics.searches.every(search => search.providerTotal === 134 && search.retrievedCount === cap && search.unexaminedProviderCount === 134 - cap));
    if (cap === 100) assert.deepEqual(result.report.marketData.rawComparableItems.map(item => item.itemId).sort(), good.map(item => item.itemId).sort());
    else assert.ok(result.report.pricingDiagnostics.searches.every(search => search.gradedCount === 2 && search.excludedCount === 18));
  }
});
test('expanded retrieval cannot turn a large wrong-variant pool into trusted pricing', async () => {
  const wrong = Array.from({ length: 100 }, (_, i) => ({ ...listings(title.replace('Holo Special Illustration Rare', 'Reverse Holo Special Illustration Rare'))[0], itemId: `reverse-${i}` }));
  const result = await runPipeline({ ...liveReportScenario(), market: [...wrong, ...listings()], marketTotal: 351 });
  assert.equal(result.report.rawValue, null); assert.equal(result.report.atlas, null);
  assert.ok(result.report.pricingDiagnostics.searches.every(search => search.excludedCount === 100 && search.eligibleRawCount === 0 && search.reasonCounts.variant_conflict_or_missing > 0));
});
test('valid-looking listings without verified language stay excluded; missing evidence is diagnosed separately from contradiction', async () => {
  const missing = listings(title.replace(' English', '')).map(item => ({ ...item, localizedAspects: [] }));
  const result = await runPipeline({ ...liveReportScenario(), market: missing });
  assert.equal(result.report.rawValue, null);
  assert.ok(result.report.pricingDiagnostics.searches.every(search => search.reasonCounts.language_missing === 3 && !search.reasonCounts.language_conflict));
});

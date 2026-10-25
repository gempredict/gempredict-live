import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
import { isValuationTrusted, safeStoredReport, requestVariantRevaluation } from '../lib/valuationProtection.mjs';

// B1–B5 desired behavior now runs as ordinary assertions.
const blockers = {
};
const results = [];
for (const scenario of scenarios) {
  const result = await runPipeline(scenario);
  results.push(result);
  test(`Stage A ${scenario.id}`, blockers[scenario.id] ? { todo: blockers[scenario.id] } : {}, () => {
    assert.equal(result.httpStatus, 200, JSON.stringify(result.errors));
    assert.equal(isValuationTrusted(result.report), scenario.expectedTrusted);
    if (scenario.expectedTrusted) {
      assert.equal(result.observed.usedCount, 3);
      assert.equal(result.observed.marketConfidence, 55);
      assert.equal(result.report.rawValue, result.observed.marketMedian);
      assert.equal(result.report.expectedNetValue, result.report.expectedGradedValue - result.observed.marketMedian - result.report.psaFee);
      assert.equal(result.report.gradingUpside, result.report.psa10Value - result.observed.marketMedian - result.report.psaFee);
      assert.ok(result.copied.includes(`Raw: $${result.observed.marketMedian}`));
    } else {
      assert.equal(result.report.rawValue, null);
      assert.equal(result.report.gradingUpside, null);
      assert.equal(result.report.action, null);
      assert.doesNotMatch(result.copied, /\$|Grade It|Skip It/);
    }
  });
}

test('Stage A preserves original vision identity and reconciles year/set before market queries', () => {
  for (const id of ['zamazenta-correction', 'ian-happ-correction']) {
    const result = results.find(item => item.id === id);
    assert.equal(result.payload.imageAnalysis.identifiedYear, result.observed.original.year);
    assert.equal(result.payload.identityVerification.year.status, 'corrected');
    assert.notEqual(result.observed.original.year, result.observed.reconciled.year);
    assert.ok(result.metrics.valuationQueries.every(query => !query.includes(result.observed.original.year)));
    assert.equal(result.payload.identityEvidenceItems.length, 3);
  }
});

test('Stage A measured mocked request counts preserve the six-query budget and separate neutral retrieval', () => {
  for (const result of results.filter(item => item.httpStatus === 200)) {
    const metrics = result.metrics;
    assert.ok(metrics.valuationQueries.length <= 6);
    assert.equal(new Set(metrics.valuationQueries).size, metrics.valuationQueries.length);
    assert.equal(metrics.valuationOAuth, metrics.valuationQueries.length);
    assert.equal(metrics.valuationBrowse, metrics.valuationQueries.length);
    assert.equal(metrics.neutralOAuth, metrics.neutralBrowse);
    assert.equal(metrics.claudePrediction, result.payload.valuationIdentityGate.allowed ? 1 : 0);
    if (!result.payload.valuationIdentityGate.allowed) assert.equal(metrics.valuationBrowse, 0);
    assert.equal(metrics.claudeVision, scenarios.find(scenario => scenario.id === result.id).textOnly ? 0 : 1);
    assert.equal(Boolean(metrics.neutralQuery?.includes(result.observed.original.year)), false);
  }
});

test('Stage A withheld variant/unrecognized results stay safe when saved or copied', () => {
  for (const id of ['kid-art-unresolved', 'unrecognized-fanmade']) {
    const result = results.find(item => item.id === id);
    const saved = safeStoredReport(result.report);
    assert.equal(saved.valuationVerification.status, 'untrusted');
    assert.equal(saved.marketData.marketSummary.valuationTrusted, false);
    assert.equal(saved.rawValue, null);
    assert.equal(saved.expectedNetValue, null);
    assert.equal(saved.atlas, null);
    assert.ok(saved.imageAnalysis);
    assert.match(result.copied, /withheld/);
  }
});

test('B1 no-image requests retain explicit identity and never fabricate image analysis or visual confidence', () => {
  for (const id of ['text-complete', 'text-subject-only', 'manual-variant-confirmation']) {
    const result = results.find(item => item.id === id);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.payload.imageAnalysis, null);
    assert.equal(result.payload.hasImageAnalysis, false);
    assert.equal(result.payload.atlasIdentityConfidence, null);
    assert.equal(result.metrics.claudeVision, 0);
    assert.deepEqual(result.errors, []);
  }
  const photo = results.find(item => item.id === 'pikachu-non-holo');
  assert.equal(photo.payload.hasImageAnalysis, true);
  assert.equal(photo.payload.atlasIdentityConfidence.score, 90);
  assert.equal(photo.metrics.claudeVision, 1);
  const complete = results.find(item => item.id === 'text-complete');
  assert.equal(complete.payload.canonicalCard.subject, 'Pikachu');
  assert.equal(complete.payload.canonicalCard.cardNumber, '28/73');
  assert.equal(complete.payload.variantVerification.status, 'verified');
  assert.equal(complete.payload.identityEvidenceItems.length, 3);
  assert.equal(complete.metrics.neutralQuery, 'Pikachu 28/73');
  const partial = results.find(item => item.id === 'text-subject-only');
  assert.equal(partial.payload.variantVerification.status, 'insufficient_evidence');
  assert.match(partial.payload.valuationVerification.explanation, /card number.*year.*set.*version/);
  assert.match(partial.payload.valuationVerification.explanation, /Verify Variant/);
  assert.equal(partial.metrics.neutralBrowse, 0);
  const confirmed = results.find(item => item.id === 'manual-variant-confirmation');
  assert.equal(confirmed.payload.variantVerification.status, 'user_confirmed');
  assert.equal(confirmed.payload.canonicalCard.parallel, 'Alternate Art');
  assert.equal(confirmed.observed.marketMedian, 80);
  assert.equal(confirmed.metrics.neutralBrowse, 1);
  assert.equal(confirmed.metrics.valuationBrowse, 6);
});

test('B1 subject-only manual completion invokes the actual handler with fresh identity evidence and valuation', async () => {
  const partial = results.find(item => item.id === 'text-subject-only');
  const template = scenarios.find(scenario => scenario.id === 'text-complete');
  let freshRequests = 0;
  const completed = await requestVariantRevaluation(partial.report, {
    identity: { subject: 'Pikachu', cardNumber: '28/73', year: '2017', brandSet: 'Shining Legends' },
    parallel: 'Common non-holo', autoOrRelic: 'none',
  }, async (url, request) => {
    freshRequests++;
    assert.equal(url, '/api/predict');
    const fields = JSON.parse(request.body);
    assert.equal(fields.confirmedCardIdentity.cardNumber, '28/73');
    assert.equal(fields.confirmedVariant.parallel, 'Common non-holo');
    assert.equal(fields.textOnlyIdentity, true);
    for (const key of ['rawValue', 'marketData', 'prediction', 'valuationVerification']) assert.equal(fields[key], undefined);
    const fresh = await runPipeline({ ...template, fields, market: template.market.map(item => ({ ...item, price: { value: '12', currency: 'USD' } })) });
    assert.equal(fresh.httpStatus, 200);
    assert.equal(fresh.metrics.neutralBrowse, 1);
    assert.equal(fresh.metrics.valuationBrowse, 6);
    assert.equal(fresh.payload.imageAnalysis, null);
    return { ok: true, json: async () => fresh.payload };
  });
  assert.equal(freshRequests, 1);
  assert.equal(isValuationTrusted(completed), true);
  assert.equal(completed.canonicalCard.cardNumber, '28/73');
  assert.equal(completed.marketData.marketSummary.rawMedian, 12);
  assert.equal(completed.rawValue, 12);
  assert.equal(completed.variantVerification.status, 'user_confirmed');
});

test('Stage A Atlas panel receives selected market evidence', () => {
  const result = results.find(item => item.id === 'pikachu-non-holo');
  assert.equal(result.payload.atlas.marketEvidence.comparableCount, result.observed.usedCount);
  assert.equal(result.payload.atlas.marketEvidence.confidence, result.observed.marketConfidence);
  assert.equal(result.payload.atlas.decision.label, 'Consider It');
});

// Only synthetic fixture data is written, never credentials or real user images.
if (process.env.PHASE1_VALIDATION_OUTPUT) writeFileSync(process.env.PHASE1_VALIDATION_OUTPUT, JSON.stringify(results, null, 2));

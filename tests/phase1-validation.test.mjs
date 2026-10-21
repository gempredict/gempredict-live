import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
import { isValuationTrusted, safeStoredReport } from '../lib/valuationProtection.mjs';

// TODO checks assert the desired behavior, and currently FAIL. They are kept
// visible as known Stage A blockers, not counted as successful validation.
// No application behavior is changed to make this validation suite green.
const blockers = {
  'dragalge-conflicting-sets': 'B2: conflicting sets are priced together; unresolved set still trusted',
  'fanmade-known-identity': 'B3: Fanmade listings/vision warning do not block valuation',
  'manual-variant-confirmation': 'B1: no-image confirmation also dereferences null image analysis',
  'text-complete': 'B1: real identity-confidence function dereferences null image analysis',
  'text-subject-only': 'B1: text-only error prevents manual identification path',
  'model-price-drift': 'B4: model raw/ROI/copy can contradict selected market evidence',
  'fractional-price': 'B4: integer normalization loses fractional market prices',
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
    assert.equal(metrics.claudePrediction, 1);
    assert.equal(metrics.claudeVision, 1);
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

test('Stage A Atlas panel receives selected market evidence', { todo: 'B5: Atlas still receives marketData:null and shows zero comparables' }, () => {
  const result = results.find(item => item.id === 'pikachu-non-holo');
  assert.equal(result.payload.atlas.marketEvidence.comparableCount, result.observed.usedCount);
});

// Only synthetic fixture data is written, never credentials or real user images.
if (process.env.PHASE1_VALIDATION_OUTPUT) writeFileSync(process.env.PHASE1_VALIDATION_OUTPUT, JSON.stringify(results, null, 2));

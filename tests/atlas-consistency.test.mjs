import { syntheticSales } from './helpers/soldFixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import marketEvidenceEngine from '../lib/marketEvidenceEngine.js';
import recommendationEngine from '../lib/recommendationEngine.js';
import { calculateMarketConfidence } from '../lib/marketConfidence.mjs';
import { safeStoredReport, isValuationTrusted, protectValuation, requestVariantRevaluation } from '../lib/valuationProtection.mjs';
import { runPipeline, atlasOrchestrator } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
const pika = scenarios.find(s => s.id === 'pikachu-non-holo');
test('Atlas mirrors final usable count and Checkpoint 5 confidence without metadata bonuses', () => {
  for (const count of [0, 1, 2, 3, 5, 10, 15]) {
    const summary = { rawUsedCount: count, rawComparableCount: count + 40, rawOutlierCount: 40, rawMedian: count ? 10 : null, rawTypicalRangeLow: 10, rawTypicalRangeHigh: 10, averageMatchScore: 100 };
    summary.marketConfidence = calculateMarketConfidence(summary);
    for (const metadata of [{}, { queryUsed: 'Pikachu #28/73', queryAttempts: ['q1', 'q2'], count: 1000, median: 99 }]) {
      const a = marketEvidenceEngine({ marketSummary: summary, ...metadata });
      assert.equal(a.comparableCount, count);
      assert.equal(a.confidence, summary.marketConfidence);
    }
  }
  const unavailable = marketEvidenceEngine({ count: 30, queryUsed: 'q', queryAttempts: ['q'], marketSummary: { rawComparableCount: 30, rawMedian: 10 } });
  assert.equal(unavailable.comparableCount, 0);
  assert.equal(unavailable.confidence, 0);
});

test('asking-only identities retain matched analysis and request budget but never Atlas endorsements', async () => {
  for (const scenario of scenarios.filter(s => s.expectedTrusted)) {
    const result = await runPipeline(scenario);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.payload.atlas, null);
    assert.equal(result.report.verdict, 'provisional');
    assert.equal(isValuationTrusted(result.report), false);
    assert.equal(result.metrics.valuationBrowse, result.metrics.valuationQueries.length);
    assert.ok(result.metrics.valuationBrowse <= 6);
    assert.equal(result.metrics.neutralBrowse, 1);
    assert.equal(safeStoredReport(result.report).atlas, null);
  }
});

test('positive and negative asking-only projections cannot become recommendations', async () => {
  for (const model of [{ psa9Value: 120, psa10Value: 200, psa10Probability: 60 }, { psa9Value: 20, psa10Value: 200, psa10Probability: 10 }]) {
    const result = await runPipeline({ ...pika, model });
    assert.equal(result.report.verdict, 'provisional');
    assert.equal(result.payload.atlas, null);
  }
});

test('qualified completed sales alone can support a robust negative financial decision and consistent Atlas', async () => {
  const initial = await runPipeline(pika);
  const sales = syntheticSales(initial.payload.canonicalCard, { raw: 100, psa9: 50, psa10: 70 });
  const result = await runPipeline({ ...pika, soldProvider: { id: sales.providerId, lookup: async () => sales } });
  assert.equal(isValuationTrusted(result.report), true);
  const a = result.payload.atlas;
  assert.ok(a);
  assert.equal(a.marketEvidence.comparableCount, 3);
  assert.equal(a.marketEvidence.median, 100);
  assert.equal(a.marketEvidence.evidenceType, 'verified_completed_transactions');
  assert.equal(a.marketEvidence.source, sales.providerId);
  assert.equal(a.marketEvidence.queryUsed, null);
  assert.equal(a.decision.label, 'Skip It');
  assert.equal(a.report.identity, result.payload.canonicalCard);
  assert.doesNotMatch(JSON.stringify(a.evidence), /asking-price|Realized sale prices are unavailable/);
  assert.ok(safeStoredReport(result.report).atlas);
  for (const mutate of [a => { a.marketEvidence.comparableCount = 30; }, a => { a.decision.label = 'Grade Candidate'; }, a => { a.report.identity.year = '2020'; }]) {
    const stale = structuredClone(result.report); mutate(stale.atlas);
    const restored = safeStoredReport(stale);
    assert.equal(restored.atlas, null);
  }
  for (const patch of [{ variantVerification: null }, { completedSales: null }, { rawValue: 999 }]) {
    const restored = safeStoredReport({ ...result.report, ...patch });
    assert.equal(isValuationTrusted(restored), false);
    assert.equal(restored.atlas, null);
  }
});

test('untrusted identities, variants and empty evidence never produce Atlas', async () => {
  for (const scenario of scenarios.filter(s => !s.expectedTrusted)) {
    const r = await runPipeline(scenario);
    assert.equal(r.payload.atlas, null, scenario.id);
  }
  const initial = await runPipeline(pika);
  const sales = syntheticSales(initial.payload.canonicalCard, { raw: 100, psa9: 50, psa10: 70 });
  const valid = await runPipeline({ ...pika, soldProvider: { id: sales.providerId, lookup: async () => sales } });
  for (const patch of [{ variantVerification: { status: 'needs_confirmation' } }, { authenticityWarnings: [{ text: 'Unofficial warning' }] }, { identityVerification: { set: { status: 'unresolved_conflict', value: 'Shining Legends' } } }]) {
    assert.equal(atlasOrchestrator(protectValuation({ ...valid.payload, ...patch })), null);
  }
});
test('sold-backed saved reports reject Atlas derived from superseded prose without discarding valid sales', async () => {
  const initial = await runPipeline(pika);
  const sales = syntheticSales(initial.payload.canonicalCard, { raw: 100, psa9: 50, psa10: 70 });
  const result = await runPipeline({ ...pika, soldProvider: { id: sales.providerId, lookup: async () => sales } });
  assert.ok(result.report.atlas);
  const stale = { ...result.report, imageAnalysis: { ...result.report.imageAnalysis, cornersNote: 'Rejected old set looks perfect. Corner whitening is visible.' } };
  const saved = safeStoredReport(stale);
  assert.equal(saved.atlas, null);
  assert.equal(saved.rawValue, 100);
  assert.equal(isValuationTrusted(saved), true);
});

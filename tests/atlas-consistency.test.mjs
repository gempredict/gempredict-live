import test from 'node:test';
import assert from 'node:assert/strict';
import marketEvidenceEngine from '../lib/marketEvidenceEngine.js';
import recommendationEngine from '../lib/recommendationEngine.js';
import { calculateMarketConfidence } from '../lib/marketConfidence.mjs';
import { safeStoredReport, isValuationTrusted, protectValuation, requestVariantRevaluation } from '../lib/valuationProtection.mjs';
import { runPipeline, atlasOrchestrator } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
const pika = scenarios.find(s => s.id === 'pikachu-non-holo');
const label = verdict => ({ grade: 'Grade It', maybe: 'Consider It', skip: 'Skip It' })[verdict];
function assertAtlas(result) {
  const { payload } = result;
  const a = payload.atlas, market = payload.marketData;
  assert.ok(a, result.id);
  for (const evidence of [a.marketEvidence, a.report.market]) {
    assert.equal(evidence.comparableCount, market.marketSummary.rawUsedCount);
    assert.equal(evidence.confidence, market.marketSummary.marketConfidence);
    assert.equal(evidence.median, market.marketSummary.rawMedian);
    assert.equal(evidence.queryUsed, market.queryUsed);
    assert.equal(evidence.evidenceType, 'active_asking_price_listings');
  }
  assert.equal(a.report.score.score, payload.prediction.gemPredictScore);
  assert.equal(a.decision.decision, payload.prediction.verdict);
  assert.equal(a.decision.label, label(payload.prediction.verdict));
  assert.equal(a.recommendation.label, label(payload.prediction.verdict));
  assert.equal(a.recommendation.reason, payload.prediction.action);
  assert.equal(a.gradingProbability, payload.prediction.psa10Probability);
  assert.deepEqual(a.searchCandidates, market.queryAttempts);
  assert.equal(a.report.identity, payload.canonicalCard);
  assert.equal(a.identityVerification, payload.identityVerification);
  assert.equal(a.variantVerification, payload.variantVerification);
  assert.doesNotMatch(JSON.stringify(a), /comparable sales|completed sales|completed transactions|search query validated/i);
}

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

test('all trusted Stage A identities use selected pool, final verdict, canonical corrections and unchanged request budget', async () => {
  for (const scenario of scenarios.filter(s => s.expectedTrusted)) {
    const result = await runPipeline(scenario);
    assert.equal(result.httpStatus, 200);
    assertAtlas(result);
    assert.equal(result.metrics.valuationBrowse, result.metrics.valuationQueries.length);
    assert.ok(result.metrics.valuationBrowse <= 6);
    assert.equal(result.metrics.neutralBrowse, 1);
    const saved = safeStoredReport(JSON.parse(JSON.stringify(result.report)));
    assert.ok(saved.atlas);
    assert.equal(saved.atlas.marketEvidence.confidence, result.observed.marketConfidence);
  }
});

test('positive modeled return stays Consider It despite high scores; negative expected ROI stays Skip It', async () => {
  for (const model of [{ psa9Value: 120, psa10Value: 200, psa10Probability: 60 }, { psa9Value: 20, psa10Value: 200, psa10Probability: 10 }]) {
    const result = await runPipeline({ ...pika, model });
    assertAtlas(result);
    assert.equal(result.payload.atlas.decision.label, result.report.expectedNetValue > 0 ? 'Consider It' : 'Skip It');
    assert.notEqual(result.payload.atlas.recommendation.label, 'Grade Candidate');
  }
  const rec = recommendationEngine({ score: { score: 100 }, prediction: { verdict: 'skip', expectedNetValue: -20, action: 'Keep raw.' }, valuationVerification: { status: 'trusted' } });
  assert.equal(rec.label, 'Skip It');
});

test('text/manual requests have no visual confidence; image and independent confidence remain distinct', async () => {
  const initial = await runPipeline(pika);
  assert.equal(initial.payload.atlas.identityConfidence.score, initial.payload.atlasIdentityConfidence.score);
  const text = await runPipeline(scenarios.find(s => s.id === 'text-complete'));
  assertAtlas(text);
  assert.equal(text.payload.atlas.identityConfidence, null);
  assert.equal(text.payload.atlas.report.confidence, null);
  assert.equal(text.payload.atlas.explanation, null);
  assert.doesNotMatch(text.payload.atlas.decision.blockers.join(' '), /image|identity confidence/i);
  let fresh;
  const report = await requestVariantRevaluation(initial.report, { identity: pika.proposal, parallel: 'Common non-holo', autoOrRelic: 'none' }, async (url, options) => {
    fresh = await runPipeline({ ...pika, textOnly: true, fields: JSON.parse(options.body) });
    return { ok: true, json: async () => fresh.payload };
  });
  assertAtlas(fresh);
  assert.equal(fresh.payload.atlas.identityConfidence, null);
  assert.ok(report.imageAnalysis); // Retained prior condition scan is not a new visual identification.
  assert.ok(report.atlas);
  const weakImage = await runPipeline({ ...pika, vision: { worthGrading: false, worthGradingReason: 'Visible condition risk.' } });
  assert.equal(weakImage.payload.atlas.decision.label, 'Consider It');
  assert.ok(weakImage.payload.atlas.decision.blockers.includes('Visible condition risk.'));
});

test('untrusted variants, conflicts, unofficial images and zero comparables never produce Atlas endorsements', async () => {
  for (const scenario of scenarios.filter(s => !s.expectedTrusted)) {
    const r = await runPipeline(scenario);
    assert.equal(r.payload.atlas, null, scenario.id);
  }
  const noPrices = await runPipeline({ ...pika, market: [] });
  assert.equal(noPrices.payload.valuationVerification.reason, 'no_comparable_listings');
  assert.equal(noPrices.payload.atlas, null);
  const valid = await runPipeline(pika);
  for (const patch of [{ variantVerification: { status: 'needs_confirmation' } }, { authenticityWarnings: [{ text: 'Unofficial warning' }] }, { identityVerification: { set: { status: 'unresolved_conflict', value: 'Shining Legends' } } }, { marketData: null }]) {
    const guarded = protectValuation({ ...valid.payload, ...patch });
    assert.equal(atlasOrchestrator(guarded), null);
  }
  assert.equal(atlasOrchestrator({ ...valid.payload, prediction: { ...valid.payload.prediction, rawValue: 999 } }), null);
});

test('saved reports hide stale Atlas only when financial evidence is sound; invalid financial reports withhold everything', async () => {
  const { report } = await runPipeline(pika);
  for (const mutate of [
    a => { a.marketEvidence.confidence = 0; },
    a => { a.marketEvidence.comparableCount = 30; },
    a => { a.decision.label = 'Grade Candidate'; },
    a => { a.report.market.median = 1000; },
    a => { a.report.identity.year = '2020'; },
    a => { delete a.valuationVerification; },
  ]) {
    const stale = JSON.parse(JSON.stringify(report)); mutate(stale.atlas);
    const saved = safeStoredReport(stale);
    assert.equal(saved.atlas, null);
    assert.equal(saved.rawValue, 10);
    assert.equal(isValuationTrusted(saved), true);
  }
  const invalid = safeStoredReport({ ...report, rawValue: 150 });
  assert.equal(invalid.atlas, null);
  assert.equal(invalid.rawValue, null);
  assert.equal(invalid.valuationVerification.reason, 'financial_inconsistent');
});

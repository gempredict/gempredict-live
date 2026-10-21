import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGradingEconomics, formatMoney } from '../lib/gradingEconomics.mjs';
import { safeStoredReport, isValuationTrusted, protectValuation, withheldSummary } from '../lib/valuationProtection.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
const template = scenarios.find(s => s.id === 'pikachu-non-holo');
const withPrice = price => template.market.map(item => ({ ...item, price: { value: String(price), currency: 'USD' } }));

test('selected $10 wins over model $150 before PSA safeguards and all downstream formulas', async () => {
  const result = await runPipeline({ ...template, model: { rawValue: 150 }, predictionReply: { gradingUpside: 99999, verdict: 'skip', analysis: 'Raw is $150. Never grade.', action: 'Sell for $150.' } });
  const r = result.report;
  assert.equal(result.httpStatus, 200);
  assert.equal(result.payload.prediction.rawValue, 10);
  assert.equal(r.psa9Value, 120); // Not incorrectly raised to Claude's $150 raw.
  assert.equal(r.psa10Value, 200);
  assert.equal(r.expectedGradedValue, 168);
  assert.equal(r.expectedNetValue, 78);
  assert.equal(r.gradingUpside, 110);
  assert.equal(r.decisionConfidence, 88);
  assert.equal(r.gemPredictScore, 99);
  assert.equal(r.verdict, 'maybe');
  assert.match(r.analysis, /raw \$10/);
  assert.doesNotMatch(r.analysis + r.action + result.copied, /\$150|99999|Never grade|Sell for/);
  assert.match(result.copied, /Raw: \$10.*Upside: \+\$110.*Expected net: \+\$78.*Consider It/);
  const reopened = safeStoredReport(JSON.parse(JSON.stringify(r)));
  assert.equal(isValuationTrusted(reopened), true);
  assert.deepEqual(reopened, JSON.parse(JSON.stringify(r)));
});

test('cent-valued raw and graded estimates survive real prediction normalization and copying', async () => {
  for (const [price, psa9, psa10, p, graded, net, upside] of [
    [2.50, 120, 200, 60, 168, 85.50, 117.50],
    [3.17, 8.37, 23.93, 37, 14.13, -69.04, -59.24],
    [0.99, 15.25, 200.99, 50, 108.12, 27.13, 120],
  ]) {
    const result = await runPipeline({ ...template, market: withPrice(price), model: { rawValue: 150, psa9Value: psa9, psa10Value: psa10, psa10Probability: p }, predictionReply: { gradingUpside: 9999, verdict: 'grade', analysis: 'Submit now for guaranteed profits.', action: 'Grade it immediately.' } });
    const r = result.report;
    assert.equal(r.rawValue, price);
    assert.equal(r.psa9Value, psa9);
    assert.equal(r.psa10Value, psa10);
    assert.equal(r.expectedGradedValue, graded);
    assert.equal(r.expectedNetValue, net);
    assert.equal(r.gradingUpside, upside);
    assert.equal(r.psaFee, 80);
    assert.equal(r.psa10Probability, p);
    assert.equal(r.verdict, net > 0 ? 'maybe' : 'skip');
    assert.ok(result.copied.includes(`Raw: $${formatMoney(price)}`));
    assert.ok(result.copied.includes(`Expected net: ${net < 0 ? '-' : '+'}$${formatMoney(Math.abs(net))}`));
    assert.doesNotMatch(r.analysis + r.action, /guaranteed profits|immediately|150|9999/);
    assert.equal(safeStoredReport(JSON.parse(JSON.stringify(r))).rawValue, price);
  }
  assert.equal(formatMoney(2.5), '2.50');
  assert.equal(formatMoney(1234.01), '1,234.01');
});

test('negative expected ROI cannot inherit grade recommendations even with positive PSA10 upside', async () => {
  const result = await runPipeline({ ...template, model: { psa9Value: 20, psa10Value: 200, psa10Probability: 10 }, predictionReply: { verdict: 'grade', gradingUpside: 999, analysis: 'Certain profit; submit.', action: 'Grade now.' } });
  assert.equal(result.report.expectedGradedValue, 38);
  assert.equal(result.report.expectedNetValue, -52);
  assert.equal(result.report.gradingUpside, 110);
  assert.equal(result.report.verdict, 'skip');
  assert.equal(result.report.decisionConfidence, 53);
  assert.equal(result.report.gemPredictScore, 73);
  assert.match(result.report.analysis, /expected net is -\$52/);
  assert.match(result.copied, /Expected net: -\$52.*Skip It/);
});

test('PSA value ordering, probability bounds and cent precision use the selected baseline', () => {
  const r = calculateGradingEconomics({ psa9Value: '1.23', psa10Value: '0.23', psa10Probability: 150 }, 2.50);
  assert.equal(r.psa9Value, 2.5);
  assert.equal(r.psa10Value, 2.5);
  assert.equal(r.psa10Probability, 100);
  assert.equal(r.expectedGradedValue, 2.5);
  assert.equal(r.expectedNetValue, -80);
  assert.equal(calculateGradingEconomics({ psa10Probability: 49.499 }, 2.5).psa10Probability, 49);
});

test('legacy trusted and tampered financial reports are invalidated without inventing new evidence', async () => {
  const { report } = await runPipeline(template);
  for (const mutation of [{ rawValue: 150 }, { gradingUpside: 999 }, { analysis: 'Grade for certain profit.' }, { verdict: 'grade' }, { financialBasis: undefined }, { expectedNetValue: 1000 }]) {
    const legacy = { ...report, ...mutation };
    assert.equal(isValuationTrusted(legacy), false);
    const restored = safeStoredReport(legacy);
    assert.equal(restored.valuationVerification.reason, 'financial_inconsistent');
    assert.equal(restored.rawValue, null);
    assert.equal(restored.expectedNetValue, null);
    assert.equal(restored.action, null);
    assert.equal(restored.marketData.marketSummary.rawMedian, null);
    assert.doesNotMatch(withheldSummary(restored), /\$|Grade It/);
  }
});

test('strong market prices never bypass unresolved variant, year/set, authenticity or absent-comparable gates', async () => {
  const { payload } = await runPipeline(template);
  for (const patch of [
    { variantVerification: { status: 'needs_confirmation' } },
    { identityVerification: { set: { status: 'unresolved_conflict', value: 'Shining Legends' } } },
    { authenticityWarnings: [{ text: 'Original image has unofficial markings.' }] },
    { marketData: { marketSummary: { rawUsedCount: 0, rawMedian: null } } },
  ]) {
    const result = protectValuation({ ...payload, ...patch });
    assert.equal(result.valuationVerification.status, 'untrusted');
    for (const key of ['rawValue', 'expectedNetValue', 'gradingUpside', 'verdict', 'analysis', 'action']) assert.equal(result.prediction[key], null, key);
    assert.equal(result.atlas, null);
  }
});

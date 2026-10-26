import test from 'node:test';
import assert from 'node:assert/strict';
import { predictionPricingReceipt } from '../lib/pricingDiagnostics.mjs';
import { protectValuation } from '../lib/valuationProtection.mjs';
import { verifiedIdentity, verifiedVariant } from './helpers/verifiedIdentity.mjs';
import { syntheticSales } from './helpers/soldFixtures.mjs';
import { liveReportScenario } from './helpers/liveReportFixture.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
const card = { subject: 'Pikachu ex', year: '2026', brandSet: '30th Celebration', cardNumber: '149/128', parallel: 'Holo Special Art', language: 'English', autoOrRelic: 'none' };
const base = sales => protectValuation({ ...verifiedIdentity(card), valuationIdentityGate: { allowed: true }, variantVerification: verifiedVariant(card),
  prediction: { psa9Value: 75, psa10Value: 180, psa10Probability: 30 }, completedSales: sales || { status: 'unavailable', reason: 'provider_not_configured' },
  marketData: { marketSummary: { rawUsedCount: 1, rawMedian: 56.99, marketConfidence: 20 } } });
const receipt = p => predictionPricingReceipt(p, { startedAt: Date.now(), privatePreview: true }).financialEvidence;
test('private Preview receipt distinguishes the exact asking-only case without logging card or listing text', () => {
  const r = receipt(base());
  assert.equal(r.canonicalIdentity.status, 'verified'); assert.equal(r.canonicalIdentity.allowed, true);
  assert.match(r.canonicalIdentity.fingerprint, /^[a-f0-9]{24}$/);
  for (const value of Object.values(r.soldSamples)) { assert.equal(value.qualifiedCount, 0); assert.equal(value.freshness, 'unavailable'); }
  assert.equal(r.providerState, 'provider_not_configured'); assert.equal(r.askingConfidence, 20);
  assert.equal(r.confidenceStatus, 'provisional_asking_signal'); assert.equal(r.verifiedFairMarketValueAvailable, false);
  assert.equal(r.recommendationsActionable, false); assert.equal(r.populationStatus, 'unavailable');
  assert.ok(r.withholdingReasons.includes('insufficient_recent_psa10_sales'));
  assert.doesNotMatch(JSON.stringify(r), /Pikachu|Celebration|56\.99|149\/128/);
});
test('qualified sold counts, low volume, stale and truncated evidence are independently diagnosed', () => {
  for (const [options, expected, freshness] of [[{ count: 3 }, 3, 'qualified_recent'], [{ count: 1 }, 0, 'recent_insufficient'], [{ date: '2026-09-01T12:00:00Z' }, 0, 'stale']]) {
    const r = receipt(base(syntheticSales(card, { raw: 100, psa9: 50, psa10: 70, ...options })));
    for (const group of Object.values(r.soldSamples)) { assert.equal(group.qualifiedCount, expected); assert.equal(group.freshness, freshness); }
    assert.equal(r.verifiedFairMarketValueAvailable, expected === 3); assert.equal(r.recommendationsActionable, expected === 3);
    if (expected === 3) assert.deepEqual(r.withholdingReasons, []);
  }
  const truncated = base({ ...syntheticSales(card), truncated: true });
  assert.equal(truncated.marketData.marketSummary.fairMarketValue, null);
  const r = receipt(truncated);
  assert.ok(r.withholdingReasons.includes('incomplete_sold_response'));
  assert.equal(r.soldCoverage, 'incomplete'); assert.equal(r.soldSamples.raw.qualifiedCount, 0); assert.equal(r.recommendationsActionable, false);
});
test('receipt strips hostile metadata and arbitrary reason/status strings; only a canonical hash is emitted', () => {
  const p = base(); p.canonicalCard.subject = 'private@example.invalid';
  p.completedSales.reason = 'secret'; p.financialDecision.reasons.push('secret');
  p.financialDecision.population = { status: 'secret', secret: 'private' };
  p.financialDecision.observedAsking.confidence = NaN;
  p.marketData.rawComparableItems = [{ title: 'private listing', url: 'private', image: 'private' }];
  const r = receipt(p); assert.equal(r.askingConfidence, null);
  assert.doesNotMatch(JSON.stringify(r), /private|secret|example|listing|https|headers/);
  p.valuationIdentityGate.allowed = false; assert.equal(receipt(p).canonicalIdentity.fingerprint, null);
});
test('financial receipt extension is absent without explicit private Preview context', () => {
  for (const options of [{}, { privatePreview: false }]) assert.equal(predictionPricingReceipt(base(), options).financialEvidence, undefined);
});
test('real private Preview scan emits compact financial receipt while Production omits diagnostics', async () => {
  const s = liveReportScenario();
  const preview = await runPipeline({ ...s, market: s.neutral.slice(0, 1), model: { psa9Value: 75, psa10Value: 180, psa10Probability: 30 },
    routingEnv: { VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production', VERCEL_URL: 'gempredict-live-prelive.vercel.app', NEXT_PUBLIC_SITE_URL: undefined }, requestHeaders: { 'x-vercel-oidc-token': 'mock.preview.signature' } });
  assert.equal(preview.httpStatus, 200); assert.equal(preview.metrics.preflightRequests, 2);
  assert.equal(preview.payload.pricingDiagnostics.usedRawCount, 1); assert.equal(preview.payload.pricingDiagnostics.variantStatus, 'corrected');
  assert.equal(preview.payload.pricingDiagnostics.financialDecisionStatus, 'provisional');
  assert.equal(preview.payload.pricingDiagnostics.financialEvidence.soldSamples.raw.qualifiedCount, 0);
  assert.equal(preview.payload.pricingDiagnostics.financialEvidence.canonicalIdentity.status, 'corrected');
  assert.equal(preview.payload.pricingDiagnostics.financialEvidence.canonicalIdentity.fingerprint, preview.metrics.pricingLogs[0].financialEvidence.canonicalIdentity.fingerprint);
  assert.doesNotMatch(JSON.stringify(preview.metrics.pricingLogs), /Pikachu|Paldea|mock\.preview|image|149\/128/);
  const production = await runPipeline({ ...s, market: s.neutral, routingEnv: { NODE_ENV: 'production' } });
  assert.equal(production.payload.pricingDiagnostics, undefined); assert.equal(production.metrics.pricingLogs.length, 0);
});
test('client-submitted sold records, calibration and population are ignored by real prediction handler', async () => {
  const s = liveReportScenario();
  const r = await runPipeline({ ...s, market: s.neutral.slice(0, 1), fields: { cardName: 'Pikachu ex', cardType: 'pokemon',
    completedSales: syntheticSales(card, { raw: 100, psa9: 50, psa10: 70 }), populationRecord: { psa10Population: 99999 }, probabilityEvidence: { status: 'validated' },
    financialDecision: { actionable: true }, valuationVerification: { status: 'trusted' }, atlas: { decision: 'Grade It' } } });
  assert.equal(r.httpStatus, 200); assert.equal(r.report.financialDecision.sales.status, 'unavailable'); assert.equal(r.report.financialDecision.population.status, 'unavailable');
  assert.equal(r.report.financialDecision.probability.qualified, false); assert.equal(r.report.verdict, 'provisional'); assert.equal(r.report.atlas, null);
  assert.equal(r.metrics.valuationBrowse, 6); assert.equal(r.report.marketData.marketSummary.rawUsedCount, 1);
});

test('duplicate and contradictory supplier records cannot inflate qualified counts in receipts', () => {
  const sales = syntheticSales(card);
  sales.records = sales.records.filter(r => r.grading.status === 'raw').slice(0, 2);
  sales.records.push(structuredClone(sales.records[0]));
  const r = receipt(base(sales)); assert.equal(r.soldSamples.raw.acceptedCount, 2); assert.equal(r.soldSamples.raw.qualifiedCount, 0);
  for (const patch of [{ soldAt: null }, { identity: { ...card, parallel: 'Reverse Holo Special Art' } }]) {
    const invalid = { ...sales, records: sales.records.map(record => ({ ...record, ...patch })) };
    assert.equal(receipt(base(invalid)).soldSamples.raw.acceptedCount, 0);
  }
});

import { verifiedVariant } from './helpers/verifiedIdentity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
import { isValuationTrusted, isVariantVerificationTrusted, safeStoredReport, protectValuation, withheldSummary, reportFromPrediction } from '../lib/valuationProtection.mjs';
const original = (await runPipeline(scenarios.find(s => s.id === 'pikachu-non-holo'))).report;
const clone = () => structuredClone(original);
const financial = ['rawValue', 'psa9Value', 'psa10Value', 'gradingUpside', 'expectedGradedValue', 'expectedNetValue', 'gemPredictScore', 'decisionConfidence', 'verdict', 'action', 'analysis', 'recommendation', 'financialBasis'];
function assertWithheld(variantVerification) {
  const report = { ...clone(), variantVerification };
  assert.equal(isVariantVerificationTrusted(variantVerification, report.canonicalCard), false);
  assert.equal(isValuationTrusted(report), false);
  const safe = safeStoredReport(report);
  assert.equal(safe.valuationVerification.status, 'untrusted');
  assert.equal(safe.valuationVerification.reason, 'variant_unresolved');
  assert.equal(safe.marketData.marketSummary.valuationTrusted, false);
  for (const field of financial) assert.equal(safe[field], null, field);
  for (const field of ['rawMedian', 'fairMarketValue', 'rawLowest', 'rawHighest', 'rawTypicalRangeLow', 'rawTypicalRangeHigh']) assert.equal(safe.marketData.marketSummary[field], null, field);
  assert.equal(safe.atlas, null);
  assert.doesNotMatch(withheldSummary(safe), /\$|Grade It|Consider It|Skip It/);
  const fresh = protectValuation({ ...report, prediction: report });
  assert.equal(fresh.valuationVerification.status, 'untrusted');
  assert.equal(fresh.prediction.rawValue, null); assert.equal(fresh.atlas, null);
  assert.equal(safeStoredReport(safe).rawValue, null);
  // Reapplying stored flags, amounts and economics cannot bypass missing or
  // downgraded variant evidence; trust must be checked again on every load.
  const forged = { ...clone(), ...safe, ...Object.fromEntries(financial.map(field => [field, original[field]])), valuationVerification: original.valuationVerification, marketData: original.marketData, atlas: original.atlas };
  assert.equal(isValuationTrusted(forged), false);
  assert.equal(safeStoredReport(forged).rawValue, null);
}

for (const [name, verification] of [
  ['missing', undefined], ['null', null], ['insufficient_evidence', { status: 'insufficient_evidence' }],
  ['needs_confirmation', { status: 'needs_confirmation', materialAmbiguity: true }],
  ['unavailable', { status: 'unavailable' }], ['invalid status', { status: 'unknown' }],
]) test(`saved trusted report loses prices and Atlas when variant verification is ${name}`, () => assertWithheld(verification));

test('malformed variant verification objects and contradictory descriptor values never inherit stored trust', () => {
  const valid = original.variantVerification;
  for (const verification of [
    '', 'verified', 1, true, [], {}, { status: 'verified' }, Object.assign([], { status: 'verified' }), { status: ['verified'] }, Object.create({ status: 'verified' }),
    { status: 'verified', materialAmbiguity: true }, { status: 'verified', materialAmbiguity: 'false' },
    { status: 'verified', value: null }, { status: 'verified', value: [] }, { status: 'verified', value: {} },
    { ...valid, value: { ...valid.value, ambiguous: true } }, { ...valid, value: { ...valid.value, ambiguous: 'false' } },
    { ...valid, value: { ...valid.value, unrecognized: true } }, { ...valid, value: { ...valid.value, finish: 'reverse-holo' } },
    { ...valid, value: { ...valid.value, finish: [] } }, { ...valid, value: { ...valid.value, kind: 'invented' } },
    { ...valid, evidenceReferences: [] }, { ...valid, evidenceReferences: [valid.evidenceReferences[0], valid.evidenceReferences[0], valid.evidenceReferences[0]] },
    { ...valid, fields: { ...valid.fields, finish: { ...valid.fields.finish, supportingListingCount: 0, consensus: 0 } } },
    { ...valid, fields: { ...valid.fields, finish: { ...valid.fields.finish, informativeEvidenceCount: 2 } } },
    { ...valid, fields: { ...valid.fields, finish: { ...valid.fields.finish, consensus: 0.7 } } },
    { ...valid, evidenceReferences: [{ itemId: ' ' }, { itemId: 'b' }, { itemId: 'c' }] },
    { ...valid, value: undefined }, { ...valid, fields: undefined }, { ...valid, evidenceReferences: undefined },
    { status: 'verified', fields: null }, { status: 'verified', fields: [] }, { status: 'verified', fields: { finish: 'verified' } },
    { status: 'verified', fields: { finish: { supportingListingCount: -1 } } },
    { status: 'verified', fields: { finish: { informativeEvidenceCount: '3' } } },
    { status: 'verified', fields: { finish: { consensus: 2 } } },
    { status: 'verified', evidenceReferences: {} }, { status: 'verified', conflicts: true },
  ]) assertWithheld(verification);
});

test('valid independently supported verification states retain legitimate financial outputs', () => {
  assert.equal(isValuationTrusted(original), true);
  for (const status of ['verified', 'corrected', 'user_confirmed']) {
    const report = { ...clone(), variantVerification: { ...original.variantVerification, status } };
    const restored = safeStoredReport(report);
    assert.equal(isValuationTrusted(restored), true);
    assert.equal(restored.rawValue, original.rawValue);
    assert.ok(restored.atlas);
    assert.equal(restored.action, original.action);
  }
});

test('applicable base/non-variant and numbered sports reports use the same eligibility rules without claiming a sports provider', async () => {
  for (const id of ['ian-happ-correction', 'shane-smith-99', 'manual-variant-confirmation', 'text-complete']) {
    const result = await runPipeline(scenarios.find(s => s.id === id));
    assert.equal(isValuationTrusted(result.report), true, id);
    assert.equal(isValuationTrusted(safeStoredReport(result.report)), true, id);
    assert.equal(safeStoredReport({ ...result.report, variantVerification: null }).rawValue, null, id);
  }
  // Base cards need their actual verification receipt, without inventing a
  // mandatory foil attribute or a new non-variant status.
  const base = { subject: 'Ian Happ', year: '2026', brandSet: 'Topps Series 1', cardNumber: '155', parallel: 'Base' };
  assert.equal(isVariantVerificationTrusted(verifiedVariant(base), base), true);
  assert.equal(isVariantVerificationTrusted({ status: 'verified' }, base), false);
  assert.equal(isVariantVerificationTrusted({ status: 'not_applicable' }, base), false);
});

test('response rehydration cannot reuse previous good variant verification when the new response omits it', () => {
  const data = { prediction: original, canonicalCard: original.canonicalCard, marketData: original.marketData, identityVerification: original.identityVerification, valuationVerification: original.valuationVerification, atlas: original.atlas };
  const restored = reportFromPrediction(data, original);
  assert.equal(restored.variantVerification, null);
  assert.equal(restored.rawValue, null);
  assert.equal(restored.atlas, null);
});

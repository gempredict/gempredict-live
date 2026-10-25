import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
import { isValuationTrusted, safeStoredReport, protectValuation, withheldSummary } from '../lib/valuationProtection.mjs';
import { catalogIdentityConflicts, identitySearchGate } from '../lib/catalogIdentity.mjs';

const original = (await runPipeline(scenarios.find(item => item.id === 'pikachu-non-holo'))).report;
const clone = () => structuredClone(original);
const money = ['rawValue', 'psa9Value', 'psa10Value', 'gradingUpside', 'expectedGradedValue', 'expectedNetValue', 'gemPredictScore', 'decisionConfidence'];
const summaries = ['rawMedian', 'rawLowest', 'rawHighest', 'fairMarketValue', 'rawTypicalRangeLow', 'rawTypicalRangeHigh'];
function withheld(report) {
  assert.equal(isValuationTrusted(report), false);
  const safe = safeStoredReport(report);
  assert.equal(safe.valuationVerification.status, 'untrusted');
  assert.equal(safe.valuationVerification.reason, 'identity_unresolved');
  assert.equal(safe.marketData.marketSummary.valuationTrusted, false);
  for (const field of money) assert.equal(safe[field], null, field);
  for (const field of ['verdict', 'action', 'analysis', 'recommendation', 'financialBasis']) assert.equal(safe[field], null, field);
  for (const field of summaries) assert.equal(safe.marketData.marketSummary[field], null, field);
  assert.equal(safe.atlas, null);
  assert.doesNotMatch(withheldSummary(safe), /\$|Grade It|Consider It|Skip It/);
  const guarded = protectValuation({ ...report, prediction: report });
  assert.equal(guarded.prediction.rawValue, null);
  assert.equal(guarded.atlas, null);
  // Reopening an invalidated report cannot resurrect cached prices.
  assert.equal(safeStoredReport(safe).rawValue, null);
}

for (const field of ['subject', 'cardNumber', 'year', 'brandSet']) {
  test(`saved trusted report: missing or invalid ${field} always withholds every financial output`, () => {
    for (const value of [undefined, null, '', '   ', 'unknown', 'UNKNOWN', 'unknown card from image', 'null', 'undefined', 'N/A', 'not specified', 'invalid', {}, [], 123, '???', ...(field === 'year' ? ['202x', '0000', '2026-27'] : field === 'cardNumber' ? ['abc', '/73', '28/', '28//73', '28/0', '28/73/99'] : [])]) {
      const report = clone(); report.canonicalCard[field] = value;
      assert.ok(catalogIdentityConflicts(report.canonicalCard, report.identityVerification.catalog.candidate).includes(field));
      assert.equal(identitySearchGate(report.identityVerification, report.canonicalCard).allowed, false);
      withheld(report);
    }
  });
}

test('the original reproduction with all four canonical fields erased is fixed', () => {
  const report = clone();
  for (const field of ['subject', 'cardNumber', 'year', 'brandSet']) report.canonicalCard[field] = null;
  withheld(report);
});

test('absent or malformed canonical objects cannot inherit a successful stored catalog flag', () => {
  for (const canonicalCard of [undefined, null, {}, '', [], { subject: 'Pikachu' }]) withheld({ ...clone(), canonicalCard });
});

test('altered valid-looking identities and partial collector numbers require fresh independent evidence', () => {
  for (const [field, value] of [['subject', 'Raichu'], ['cardNumber', '29/73'], ['cardNumber', '28'], ['year', '2018'], ['brandSet', 'Surging Sparks'], ['parallel', 'Holo']]) {
    const report = clone();
    if (field === 'parallel') report.identityVerification.catalog.candidate.parallel = report.canonicalCard.parallel;
    report.canonicalCard[field] = value;
    withheld(report);
  }
});

test('incomplete or malformed catalog records cannot certify a valid canonical card', () => {
  for (const field of ['subject', 'cardNumber', 'year', 'brandSet']) {
    for (const value of [undefined, null, '', 'unknown', {}, '???']) {
      const report = clone(); report.identityVerification.catalog.candidate[field] = value;
      withheld(report);
    }
  }
  for (const candidate of [undefined, null, {}, []]) {
    const report = clone(); report.identityVerification.catalog.candidate = candidate;
    withheld(report);
  }
  for (const field of ['source', 'referenceId']) {
    const report = clone(); delete report.identityVerification.catalog[field];
    withheld(report);
  }
  const report = clone(); delete report.identityVerification;
  withheld(report);
});

test('forged trusted summary and gate flags cannot bypass final identity validation', () => {
  const report = clone(); report.canonicalCard.brandSet = 'unknown';
  report.valuationIdentityGate = { allowed: true };
  report.valuationVerification = { status: 'trusted' };
  report.marketData.marketSummary.valuationTrusted = true;
  withheld(report);
});

test('an unchanged independently verified report retains legitimate prices, recommendations and Atlas', () => {
  assert.equal(isValuationTrusted(original), true);
  const restored = safeStoredReport(clone());
  assert.equal(isValuationTrusted(restored), true);
  assert.deepEqual(restored, clone());
  assert.equal(restored.rawValue, 10);
  assert.ok(restored.atlas);
  assert.ok(restored.action);
});


test('pending confirmation or declared unresolved conflicts cannot inherit verified status', () => {
  for (const patch of [{ requiresConfirmation: true }, { conflicts: ['year'] }]) {
    const report = clone(); Object.assign(report.identityVerification.catalog, patch);
    withheld(report);
  }
});

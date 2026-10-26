import { verifiedVariant } from './helpers/verifiedIdentity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { crossCheckCatalog, identitySearchGate } from '../lib/catalogIdentity.mjs';
import { resolveMarketIdentity } from '../lib/reconcileMarketIdentity.mjs';
import { matchIdentityEvidence } from '../lib/marketIdentityEvidence.mjs';
import { protectValuation, safeStoredReport } from '../lib/valuationProtection.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';

// Synthetic regression: no asserted real-world catalog mapping for 149/128.
const proposal = { subject: 'Pikachu ex', cardNumber: '149/128', year: '2024', brandSet: 'Surging Sparks', parallel: 'Special Art', autoOrRelic: 'none' };
const entry = { id: 'fixture-only:149', ...proposal, brandSet: 'Fixture Catalog Set' };
const lookup = records => ({ catalogSource: 'mock-independent-catalog', catalogLookup: async query => { assert.deepEqual(query, { subject: proposal.subject, cardNumber: proposal.cardNumber }); return records; } });
const fetchEvidence = titles => ({ clientId: 'mock', clientSecret: 'mock', fetchImpl: async url => ({ ok: true, json: async () => String(url).includes('/oauth2/token') ? { access_token: 'mock' } : { itemSummaries: titles.map((title, i) => ({ itemId: String(i), title })) } }) });

test('Pikachu regression: neutral seller wording cannot bless the original Surging Sparks proposal', async () => {
  const result = await resolveMarketIdentity(proposal, fetchEvidence(['Pikachu ex 149/128 NM Special Art', 'Pikachu ex 149/128 NM Special Art', 'Pikachu ex 149/128 NM Special Art']));
  assert.equal(result.canonicalCard.brandSet, 'Surging Sparks'); // retained as proposal, never trust
  assert.equal(result.identityVerification.set.status, 'insufficient_evidence');
  assert.equal(result.identityVerification.catalog.status, 'unavailable');
  assert.equal(result.valuationIdentityGate.allowed, false);
});

test('catalog contradicts wrong set even when misleading eBay sellers unanimously repeat it', async () => {
  const result = await resolveMarketIdentity(proposal, { ...fetchEvidence(Array(3).fill('2024 Pokemon Surging Sparks Pikachu ex 149/128 Special Art')), ...lookup([entry]) });
  assert.equal(result.identityVerification.set.status, 'verified');
  assert.equal(result.identityVerification.catalog.status, 'conflict');
  assert.deepEqual(result.identityVerification.catalog.conflicts, ['brandSet']);
  assert.equal(result.valuationIdentityGate.allowed, false);
  assert.equal(result.canonicalCard.brandSet, proposal.brandSet);
});

test('independent catalog supports exact identity without accepting partial numbers or different subjects', async () => {
  const exact = { ...entry, brandSet: proposal.brandSet };
  const result = await crossCheckCatalog(proposal, lookup([{ ...exact, id: 'partial', cardNumber: '149' }, { ...exact, id: 'wrong', subject: 'Other ex' }, exact]));
  assert.equal(result.status, 'verified');
  assert.deepEqual(result.diagnostics.map(d => d.accepted), [false, false, true]);
  assert.equal(identitySearchGate({ catalog: result }, proposal).allowed, true);
});

test('same collector number across sets, languages or variants stays ambiguous; duplicate records do not vote', async () => {
  for (const alternative of [{ brandSet: 'Other Set' }, { language: 'Japanese' }, { parallel: 'Base' }]) {
    const result = await crossCheckCatalog(proposal, lookup([entry, entry, { ...entry, id: 'other', ...alternative }]));
    assert.equal(result.status, 'ambiguous');
    assert.equal(identitySearchGate({ catalog: result }).allowed, false);
  }
});

test('catalog failures, empty or malformed records never fabricate a verified identity', async () => {
  assert.equal((await crossCheckCatalog(proposal)).status, 'unavailable');
  for (const records of [[], [{ ...entry, id: null }], [{ ...entry, year: null }], null]) {
    const result = await crossCheckCatalog(proposal, lookup(records));
    assert.notEqual(result.status, 'verified');
    assert.equal(identitySearchGate({ catalog: result }).allowed, false);
  }
  assert.equal((await crossCheckCatalog(proposal, { catalogSource: 'mock', catalogLookup: async () => { throw Error('offline'); } })).status, 'unavailable');
});

test('misleading multi-card listings and incidental collector numbers cannot enter independent votes', () => {
  for (const title of ['Pikachu ex 149/128 238/191 Special Art', 'Pikachu ex #238/191 serial 149/128', 'Pikachu ex 149 Special Art']) assert.equal(matchIdentityEvidence({ title }, proposal), null);
});

test('catalog conflict or ambiguity withholds prices, ROI and saved report trust despite resolved variant', async () => {
  for (const status of ['conflict', 'ambiguous', 'insufficient_evidence']) {
    const result = protectValuation({ canonicalCard: proposal, identityVerification: { catalog: { status } }, variantVerification: verifiedVariant(proposal), prediction: { rawValue: 100, gradingUpside: 300, verdict: 'grade' }, marketData: { marketSummary: { rawUsedCount: 3, rawMedian: 100 } } });
    assert.equal(result.valuationVerification.status, 'untrusted');
    assert.equal(result.prediction.rawValue, null);
    assert.equal(result.prediction.gradingUpside, null);
    assert.equal(safeStoredReport({ ...result, ...result.prediction }).rawValue, null);
  }
});

test('actual route blocks valuation retrieval and model pricing before unresolved identity, with development-only diagnostics', async () => {
  const scenario = { proposal, neutral: [], market: [], routingEnv: { NODE_ENV: 'development' } };
  const result = await runPipeline(scenario);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.metrics.claudePrediction, 0);
  assert.equal(result.payload.valuationIdentityGate.allowed, false);
  assert.ok(result.payload.identityDiagnostics);
  assert.equal(result.payload.prediction.rawValue, null);
  const production = await runPipeline({ ...scenario, routingEnv: { NODE_ENV: 'production' } });
  assert.equal(production.payload.identityDiagnostics, undefined);
  assert.equal(production.payload.identityVerification.catalog.diagnostics, undefined);
});

test('catalog conflict blocks the actual handler before queries even when neutral listings agree with Claude', async () => {
  const neutral = Array.from({ length: 3 }, (_, i) => ({ itemId: `seller-${i}`, title: '2024 Pokemon Surging Sparks Pikachu ex 149/128 Special Art', condition: 'Ungraded' }));
  const result = await runPipeline({ proposal, neutral, market: neutral, catalogOptions: lookup([entry]) });
  assert.equal(result.httpStatus, 200);
  assert.equal(result.payload.identityVerification.set.status, 'verified');
  assert.equal(result.payload.identityVerification.catalog.status, 'conflict');
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.metrics.claudePrediction, 0);
  assert.equal(result.payload.prediction.rawValue, null);
  assert.equal(result.payload.originalCanonicalCard.brandSet, 'Surging Sparks');
});

test('catalog verification cannot migrate to another variant or set after reconciliation or report restore', async () => {
  const catalog = await crossCheckCatalog(proposal, lookup([{ ...entry, brandSet: proposal.brandSet }]));
  assert.equal(catalog.status, 'verified');
  for (const change of [{ parallel: 'Base' }, { brandSet: 'Different Set' }, { cardNumber: '149/191' }]) {
    const card = { ...proposal, ...change };
    assert.equal(identitySearchGate({ catalog }, card).allowed, false);
    const result = protectValuation({ canonicalCard: card, identityVerification: { catalog }, variantVerification: verifiedVariant(card, 'user_confirmed'), marketData: { marketSummary: { rawUsedCount: 3, rawMedian: 100 } }, prediction: { rawValue: 100 } });
    assert.equal(result.prediction.rawValue, null);
  }
});

test('successful independent catalog cross-check can resolve missing seller metadata, but not contradictory sellers', async () => {
  const catalog = await crossCheckCatalog(proposal, lookup([{ ...entry, brandSet: proposal.brandSet }]));
  assert.equal(identitySearchGate({ catalog, set: { status: 'insufficient_evidence' } }, proposal).allowed, true);
  assert.equal(identitySearchGate({ catalog, set: { status: 'unresolved_conflict' } }, proposal).allowed, false);
  assert.equal(identitySearchGate({ catalog, set: { status: 'insufficient_evidence', ambiguousListingCount: 1 } }, proposal).allowed, false);
});

test('incomplete canonical identity cannot start pricing even with a catalog match', async () => {
  const catalog = await crossCheckCatalog(proposal, lookup([{ ...entry, brandSet: proposal.brandSet }]));
  assert.equal(identitySearchGate({ catalog }, { ...proposal, brandSet: null }).allowed, false);
});

test('missing catalog fails closed even when misleading eBay listings unanimously confirm the incorrect Pikachu set', async () => {
  const neutral = Array.from({ length: 3 }, (_, i) => ({ itemId: `misleading-${i}`, title: '2024 Pokemon Surging Sparks Pikachu ex 149/128 Special Art', condition: 'Ungraded', price: { value: '500', currency: 'USD' } }));
  const result = await runPipeline({ proposal, neutral, market: neutral });
  assert.equal(result.httpStatus, 200);
  assert.equal(result.payload.identityVerification.year.status, 'verified');
  assert.equal(result.payload.identityVerification.set.status, 'verified');
  assert.equal(result.payload.identityVerification.catalog.status, 'unavailable');
  assert.match(result.payload.valuationVerification.explanation, /Independent catalog verification is unavailable/);
  assert.equal(result.payload.valuationIdentityGate.allowed, false);
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.metrics.claudePrediction, 0);
  assert.equal(result.payload.valuationVerification.status, 'untrusted');
  assert.equal(result.payload.prediction.rawValue, null);
  assert.equal(result.payload.marketData.marketSummary.valuationTrusted, false);
  assert.equal(result.report.rawValue, null);
  assert.doesNotMatch(result.copied, /\$/);
  const restored = safeStoredReport({ ...result.report, rawValue: 500, valuationVerification: { status: 'trusted' }, valuationIdentityGate: { allowed: true } });
  assert.equal(restored.rawValue, null); // recomputed catalog gate beats stale trust
});

test('neither marketplace verification nor protected user fields substitute for a missing or failed catalog', async () => {
  for (const catalog of [await crossCheckCatalog(proposal), await crossCheckCatalog(proposal, { catalogSource: 'mock', catalogLookup: async () => { throw Error('unavailable'); } })]) {
    for (const status of ['verified', 'corrected', 'user_protected']) {
      const verification = { catalog, year: { status, value: proposal.year }, set: { status, value: proposal.brandSet } };
      assert.equal(identitySearchGate(verification, proposal).allowed, false);
      const result = protectValuation({ canonicalCard: proposal, identityVerification: verification, variantVerification: verifiedVariant(proposal), marketData: { marketSummary: { rawUsedCount: 3, rawMedian: 500 } }, prediction: { rawValue: 500, gradingUpside: 1000 } });
      assert.equal(result.prediction.rawValue, null);
      assert.equal(result.prediction.gradingUpside, null);
    }
  }
});

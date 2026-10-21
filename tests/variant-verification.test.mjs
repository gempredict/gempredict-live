import test from 'node:test';
import assert from 'node:assert/strict';
import { collectIdentityEvidence, buildNeutralIdentityQuery } from '../lib/marketIdentityEvidence.mjs';
import { reconcileVariant, describeVariant, matchesVariantValuation, parseVariantConfirmation } from '../lib/variantVerification.mjs';
import { protectValuation, safeStoredReport, withheldSummary, requestVariantRevaluation, isValuationTrusted } from '../lib/valuationProtection.mjs';
import { buildEbaySearchParams } from '../lib/ebayIdentityMatch.mjs';
import ebayHandler from '../pages/api/ebay-search.js';

const pikachu = { subject: 'Pikachu', year: '2017', brandSet: 'Shining Legends', cardNumber: '28/73', parallel: 'Common non-holo', autoOrRelic: 'none' };
const kid = { subject: 'Eustass "Captain" Kid', year: '2026', brandSet: 'One Piece', cardNumber: 'OP14-014', parallel: 'Standard Art', autoOrRelic: 'none' };
const smith = { subject: 'Shane Smith', year: '2025', brandSet: 'Topps Chrome', cardNumber: '175', parallel: 'Green Sand Glitter /99', autoOrRelic: 'none' };
function evidence(card, titles) {
  const items = titles.map((title, index) => typeof title === 'string' ? { itemId: String(index + 1), itemWebUrl: `https://www.ebay.com/itm/${index + 1}`, title } : title);
  return { search: { status: 'retrieved' }, identityEvidenceItems: collectIdentityEvidence(items, card, { query: buildNeutralIdentityQuery(card), retrievedAt: '2026-01-01T00:00:00.000Z' }) };
}
const repeat = (value, count = 3) => Array.from({ length: count }, () => value);
const prices = { marketSummary: { rawUsedCount: 1, rawComparableCount: 1, rawMedian: 20, fairMarketValue: 20 } };
const prediction = { cardTitle: 'Card', rawValue: 999, psa9Value: 1999, psa10Value: 2999, gradingUpside: 2000, expectedNetValue: 1000, gemPredictScore: 95, verdict: 'grade', action: 'Grade for profit.', analysis: 'Worth $2999.' };

test('Pikachu Common non-holo stays verified with Regular Non-Holo seller wording', () => {
  const original = structuredClone(pikachu);
  const result = reconcileVariant(pikachu, pikachu, evidence(pikachu, repeat('2017 Shining Legends Pikachu 28/73 Regular Non-Holo')));
  assert.equal(result.variantVerification.status, 'verified');
  assert.equal(result.variantVerification.materialAmbiguity, false);
  assert.equal(result.canonicalCard.parallel, 'Common non-holo');
  assert.deepEqual(pikachu, original);
  assert.equal(result.variantVerification.fields.finish.supportingListingCount, 3);
  assert.equal(result.variantVerification.fields.printRun.informativeEvidenceCount, 0);
  assert.equal(matchesVariantValuation('Pikachu 28/73 Regular Non-Holo', result.canonicalCard), true);
  assert.equal(matchesVariantValuation('Pikachu 28/73 Reverse Holo', result.canonicalCard), false);
});

test('Kid standard, alternate, special and manga art remain distinct; mixed evidence needs confirmation', () => {
  const titles = [
    ...repeat('One Piece Eustass Captain Kid OP14-014 Standard Art', 2),
    ...repeat('One Piece Eustass Captain Kid OP14-014 AA', 2),
  ];
  const result = reconcileVariant(kid, kid, evidence(kid, titles));
  assert.equal(result.variantVerification.status, 'needs_confirmation');
  assert.equal(result.variantVerification.materialAmbiguity, true);
  assert.ok(result.variantVerification.conflicts.some(conflict => conflict.field === 'art'));
  assert.equal(matchesVariantValuation('Eustass Captain Kid OP14-014 Alt Art', result.canonicalCard), false);
  assert.notEqual(describeVariant('Special Art').art, describeVariant('Alt Art').art);
  assert.notEqual(describeVariant('Manga').art, describeVariant('Special Art').art);
});

test('three neutral listings and 60% art consensus may correct the proposal', () => {
  const input = evidence(kid, [...repeat('One Piece Eustass Captain Kid OP14-014 Alternate Art'), ...repeat('One Piece Eustass Captain Kid OP14-014 Standard Art', 2)]);
  const result = reconcileVariant(kid, kid, input);
  assert.equal(result.variantVerification.status, 'corrected');
  assert.equal(result.variantVerification.value.art, 'alternate art');
  assert.equal(result.variantVerification.fields.art.consensus, 0.6);
  assert.match(result.canonicalCard.parallel, /Alternate Art/);
  const two = reconcileVariant(kid, kid, evidence(kid, repeat('Eustass Captain Kid OP14-014 AA', 2)));
  assert.equal(two.variantVerification.status, 'needs_confirmation');
  assert.equal(two.canonicalCard.parallel, 'Standard Art');
});

test('Shane Smith Green Sand Glitter /99 cannot use /49, wrong colors or missing serial details', () => {
  const good = '2025 Topps Chrome Shane Smith #175 Green Sand Glitter 12/99';
  const result = reconcileVariant(smith, smith, evidence(smith, repeat(good)));
  assert.equal(result.variantVerification.status, 'verified');
  for (const wrong of [good.replace('/99', '/49'), good.replace('Green', 'Blue'), good.replace(' 12/99', '')]) assert.equal(matchesVariantValuation(wrong, result.canonicalCard), false, wrong);
  const split = reconcileVariant(smith, smith, evidence(smith, [good, good, good.replace('/99', '/49'), good.replace('/99', '/49')]));
  assert.equal(split.variantVerification.status, 'needs_confirmation');
  assert.equal(split.variantVerification.fields.printRun.informativeEvidenceCount, 4);
});

test('colored sports parallels, inserts, autos and relics are material independent features', () => {
  const card = { subject: 'Jayden Daniels', cardNumber: '248', parallel: 'Purple Shock', autoOrRelic: 'none' };
  const title = 'Jayden Daniels #248 Purple Shock';
  const result = reconcileVariant(card, card, evidence(card, repeat(title)));
  assert.equal(result.variantVerification.status, 'verified');
  for (const wrong of [title.replace('Purple', 'Blue'), `${title} Auto`, `${title} Patch`, `${title} Insert`]) assert.equal(matchesVariantValuation(wrong, result.canonicalCard), false, wrong);
  const auto = { ...card, autoOrRelic: 'auto relic' };
  const autoResult = reconcileVariant(auto, auto, evidence(auto, repeat(`${title} Autograph Relic`)));
  assert.equal(autoResult.variantVerification.status, 'verified');
  assert.equal(matchesVariantValuation(title, autoResult.canonicalCard), false);
  assert.equal(matchesVariantValuation(`${title} Auto Relic`, autoResult.canonicalCard), true);
});

test('missing wording is not a conflict or independent corroboration; duplicates cannot vote repeatedly', () => {
  const result = reconcileVariant(smith, smith, evidence(smith, repeat('Shane Smith #175')));
  assert.equal(result.variantVerification.status, 'insufficient_evidence');
  assert.equal(result.variantVerification.conflicts.length, 0);
  assert.equal(result.variantVerification.materialAmbiguity, true);
  const same = { itemId: '1', title: 'Shane Smith #175 Green Sand Glitter /99' };
  const duplicate = reconcileVariant(smith, smith, evidence(smith, repeat(same, 5)));
  assert.equal(duplicate.variantVerification.fields.printRun.supportingListingCount, 1);
  assert.notEqual(duplicate.variantVerification.status, 'verified');
  const restricted = evidence(smith, repeat(same));
  restricted.identityEvidenceItems[0].observations[0].query += ' Green Sand Glitter /99';
  assert.equal(reconcileVariant(smith, smith, restricted).variantVerification.evidenceReferences.length, 0);
});

test('unresolved pricing is suppressed in API, atlas, stored reports and copied summaries', () => {
  const variantVerification = reconcileVariant(kid, kid, evidence(kid, [])).variantVerification;
  const guarded = protectValuation({ prediction, marketData: prices, variantVerification, atlas: { decision: { label: 'Grade' } }, imageAnalysis: { centering: 'good' } });
  assert.equal(guarded.valuationVerification.status, 'untrusted');
  assert.equal(guarded.valuationVerification.reason, 'variant_unresolved');
  assert.equal(guarded.marketData.marketSummary.valuationTrusted, false);
  assert.equal(guarded.prediction.rawValue, null);
  assert.equal(guarded.prediction.expectedNetValue, null);
  assert.equal(guarded.prediction.verdict, null);
  assert.equal(guarded.marketData.marketSummary.rawMedian, null);
  assert.equal(guarded.atlas, null);
  assert.equal(guarded.imageAnalysis.centering, 'good');
  const stored = safeStoredReport({ ...prediction, marketData: prices });
  assert.equal(stored.rawValue, null);
  assert.equal(stored.gradingUpside, null);
  assert.doesNotMatch(withheldSummary(stored), /\$|Grade It|2000/);
});

test('verified ordinary cards retain normal amounts; no comparable prices never grants trust', () => {
  const variantVerification = reconcileVariant(pikachu, pikachu, evidence(pikachu, repeat('Pikachu 28/73 Regular Non-Holo'))).variantVerification;
  const normal = protectValuation({ prediction, marketData: prices, variantVerification });
  assert.equal(normal.prediction.rawValue, 999);
  assert.equal(normal.marketData.marketSummary.valuationTrusted, true);
  assert.equal(isValuationTrusted(normal), true);
  const missing = protectValuation({ prediction, marketData: { marketSummary: { rawUsedCount: 0, rawMedian: null } }, variantVerification });
  assert.equal(missing.valuationVerification.status, 'untrusted');
  assert.equal(missing.valuationVerification.reason, 'no_comparable_listings');
});

test('user confirmation requests a new valuation and never submits or unlocks cached prices', async () => {
  const report = { ...prediction, canonicalCard: kid, originalCanonicalCard: kid, imageAnalysis: { corners: 'good' }, marketData: prices };
  let body;
  const fresh = await requestVariantRevaluation(report, { parallel: 'Alternate Art', autoOrRelic: 'none' }, async (url, options) => {
    assert.equal(url, '/api/predict');
    body = JSON.parse(options.body);
    assert.equal(body.confirmedVariant.parallel, 'Alternate Art');
    assert.equal(body.marketData, undefined);
    assert.equal(body.rawValue, undefined);
    const resolved = reconcileVariant(kid, kid, evidence(kid, []), body.confirmedVariant);
    assert.equal(resolved.variantVerification.status, 'user_confirmed');
    assert.equal(resolved.canonicalCard.variant.art, 'alternate art');
    const payload = protectValuation({ prediction: { ...prediction, rawValue: 80 }, canonicalCard: resolved.canonicalCard, variantVerification: resolved.variantVerification, marketData: { marketSummary: { rawUsedCount: 1, rawMedian: 80 } } });
    return { ok: true, json: async () => payload };
  });
  assert.equal(fresh.rawValue, 80);
  assert.equal(fresh.marketData.marketSummary.rawMedian, 80);
  assert.equal(fresh.imageAnalysis.corners, 'good');
  assert.equal(report.rawValue, 999);
  const noPrices = await requestVariantRevaluation(report, { parallel: 'Alternate Art' }, async () => ({ ok: true, json: async () => protectValuation({ prediction, variantVerification: { status: 'user_confirmed' }, marketData: null }) }));
  assert.equal(isValuationTrusted(noPrices), false);
  assert.equal(noPrices.rawValue, null);
  assert.equal(parseVariantConfirmation({ parallel: 'Special / Alternate Art' }), null);
});

test('eBay valuation uses confirmed art and print runs with fresh listings, not stale base matches', async () => {
  const previousFetch = globalThis.fetch;
  const previousId = process.env.EBAY_PROD_CLIENT_ID;
  const previousSecret = process.env.EBAY_PROD_CLIENT_SECRET;
  process.env.EBAY_PROD_CLIENT_ID = 'mock'; process.env.EBAY_PROD_CLIENT_SECRET = 'mock';
  const confirmed = reconcileVariant(kid, kid, evidence(kid, []), { parallel: 'Alternate Art', autoOrRelic: 'none' });
  const listings = [
    { title: '2026 One Piece Eustass Captain Kid OP14-014 AA', price: { value: '80', currency: 'USD' } },
    { title: '2026 One Piece Eustass Captain Kid OP14-014 Standard Art', price: { value: '1', currency: 'USD' } },
    { title: '2026 One Piece Eustass Captain Kid OP14-014 Special Art', price: { value: '200', currency: 'USD' } },
  ];
  globalThis.fetch = async url => String(url).includes('/oauth2/token') ? { ok: true, json: async () => ({ access_token: 'mock' }) } : { ok: true, json: async () => ({ itemSummaries: listings }) };
  try {
    let result;
    await ebayHandler({ query: Object.fromEntries(buildEbaySearchParams('Eustass Captain Kid OP14-014', confirmed.canonicalCard)) }, { status(code) { assert.equal(code, 200); return this; }, json(value) { result = value; } });
    assert.equal(result.marketSummary.rawComparableCount, 1);
    assert.equal(result.marketSummary.rawMedian, 80);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = previousSecret;
  }
});


test('ordinary explicit base cards verify without unnecessary confirmation', () => {
  const card = { subject: 'Ian Happ', cardNumber: '155', parallel: 'Base', autoOrRelic: 'none' };
  const result = reconcileVariant(card, card, evidence(card, repeat('Ian Happ #155 Base')));
  assert.equal(result.variantVerification.status, 'verified');
  assert.equal(result.variantVerification.materialAmbiguity, false);
});

test('independent per-field majorities cannot invent a combination not supported by three listings', () => {
  const card = { subject: 'Jayden Daniels', cardNumber: '248', parallel: 'Red Shock /99', autoOrRelic: 'none' };
  const result = reconcileVariant(card, card, evidence(card, [
    'Jayden Daniels #248 Green Shock /49',
    ...repeat('Jayden Daniels #248 Green Shock /99', 2),
    ...repeat('Jayden Daniels #248 Red Shock /49', 2),
  ]));
  assert.equal(result.variantVerification.status, 'needs_confirmation');
  assert.equal(result.canonicalCard.parallel, 'Red Shock /99');
});

test('unrecognized material labels and contradictory observations stay unresolved', () => {
  const card = { ...smith, parallel: 'Green Sand' };
  const unknown = reconcileVariant(card, card, evidence(card, repeat('Shane Smith #175 Green Sand')));
  assert.equal(unknown.variantVerification.status, 'needs_confirmation');
  const duplicate = evidence(pikachu, [
    { itemId: '1', title: 'Pikachu 28/73 Non-Holo' },
    { itemId: '1', title: 'Pikachu 28/73 Reverse Holo' },
  ]);
  assert.equal(reconcileVariant(pikachu, pikachu, duplicate).variantVerification.status, 'needs_confirmation');
  assert.equal(parseVariantConfirmation({ parallel: 'Autograph', autoOrRelic: 'none' }), null);
});

test('stored untrusted reports cannot promote stale prices even if their version was verified', () => {
  const stored = safeStoredReport({ ...prediction, variantVerification: { status: 'verified' }, valuationVerification: { status: 'untrusted', reason: 'no_comparable_listings' }, marketData: prices });
  assert.equal(stored.rawValue, null);
  assert.equal(stored.marketData.marketSummary.rawMedian, null);
  assert.equal(stored.marketData.marketSummary.valuationTrusted, false);
  assert.equal(isValuationTrusted(stored), false);
});


test('variant revaluation preserves reconciled year/set and retains the original vision proposal', async () => {
  const report = { ...prediction, canonicalCard: { ...kid, year: '2026', brandSet: 'One Piece' }, originalCanonicalCard: { ...kid, year: '2025', brandSet: 'Wrong Set' } };
  const result = await requestVariantRevaluation(report, { parallel: 'Alternate Art' }, async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.confirmedCardIdentity.year, '2026');
    assert.equal(body.confirmedIdentity.brandSet, 'One Piece');
    assert.equal(body.originalIdentityProposal.year, '2025');
    return { ok: true, json: async () => protectValuation({ prediction, canonicalCard: body.confirmedCardIdentity, originalCanonicalCard: body.originalIdentityProposal, variantVerification: { status: 'user_confirmed' }, marketData: null }) };
  });
  assert.equal(result.originalCanonicalCard.year, '2025');
  assert.equal(result.canonicalCard.year, '2026');
  assert.equal(result.rawValue, null);
});


test('variant corrections do not borrow support from an explicitly different year or product set', () => {
  const wrongProduct = evidence(pikachu, repeat('2020 Hidden Fates Pikachu 28/73 Reverse Holo'));
  const result = reconcileVariant(pikachu, pikachu, wrongProduct);
  assert.equal(result.variantVerification.status, 'insufficient_evidence');
  assert.equal(result.variantVerification.evidenceReferences.length, 0);
  assert.equal(result.variantVerification.excludedEvidenceReferences.length, 3);
  assert.equal(result.canonicalCard.parallel, 'Common non-holo');
});


test('valuation requires explicit base/standard identity and respects autograph metadata', () => {
  const standard = { ...kid, parallel: 'Standard Art' };
  assert.equal(matchesVariantValuation('Eustass Captain Kid OP14-014', standard), false);
  assert.equal(matchesVariantValuation('Eustass Captain Kid OP14-014 Base', standard), true);
  assert.equal(matchesVariantValuation({ title: 'Eustass Captain Kid OP14-014 Base', localizedAspects: [{ name: 'Autographed', value: 'Yes' }] }, { ...standard, variant: { ...describeVariant('Standard Art'), autograph: false, relic: false } }), false);
  assert.equal(describeVariant('No auto Autograph').ambiguous, true);
});


test('base and standard-art synonyms remain coherent when alternate art is independently established', () => {
  const base = { ...kid, parallel: 'Base' };
  const result = reconcileVariant(base, base, evidence(base, repeat('One Piece Eustass Captain Kid OP14-014 AA')));
  assert.equal(result.variantVerification.status, 'corrected');
  assert.equal(result.variantVerification.value.art, 'alternate art');
  assert.equal(result.variantVerification.value.kind, 'parallel');
});

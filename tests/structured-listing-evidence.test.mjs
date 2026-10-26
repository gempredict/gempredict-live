import test from 'node:test';
import assert from 'node:assert/strict';
import { createTcgDexCatalog } from '../lib/tcgdexCatalog.mjs';
import { structuredListingConflicts } from '../lib/listingStructuredEvidence.mjs';
import { matchesVariantValuation } from '../lib/variantVerification.mjs';
import { scoreListing } from '../lib/ebayIdentityMatch.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
import { isValuationTrusted, safeStoredReport } from '../lib/valuationProtection.mjs';
const proposal = { subject: 'Pikachu ex', year: '2024', brandSet: 'Stellar Crown', cardNumber: '149/128', parallel: 'Special Art', language: 'English', autoOrRelic: 'none' };
const set = { id: '30th', name: '30th Celebration', releaseDate: '2026-09-16', cardCount: { official: 128 }, tcgOnline: '30C' };
const hosted = { id: '30th-149', localId: '149', name: 'Pikachu ex', rarity: 'Special illustration rare', set, updated: '2026-09-17T00:45:22+02:00', variants: { firstEdition: false, holo: false, normal: true, reverse: false, wPromo: false }, variants_detailed: [{ type: 'normal', size: 'standard', variantId: 'generated' }] };
const title = '2026 Pokemon 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare';
const canonical = { ...proposal, year: '2026', brandSet: '30th Celebration', parallel: 'Holo Special Art' };
const aspect = (name, value) => ({ name, value });
const items = (attributes = [], prefix = 'good', price = 40) => Array.from({ length: 3 }, (_, i) => ({ itemId: `${prefix}-${i}`, title, condition: 'Ungraded', localizedAspects: [aspect('Language', 'English'), ...attributes], price: { value: String(price), currency: 'USD' } }));
function catalog() {
  return createTcgDexCatalog({ fetchImpl: async url => ({ ok: true, json: async () => structuredClone(new URL(url).pathname.endsWith('/cards') ? [{ id: hosted.id, localId: hosted.localId, name: hosted.name }] : new URL(url).pathname.includes('/cards/') ? hosted : set) }) });
}
const run = scenario => runPipeline({ proposal, neutral: items(), market: items(), catalogOptions: catalog(), ...scenario });
const contradictions = [
  ['year manufactured', [aspect('Year Manufactured', '2024')]],
  ['year alias', [aspect('Year', '2024')]],
  ['card number', [aspect('Card Number', '150/128')]],
  ['collector number', [aspect('Collector Number', '150')]],
  ['non-holo finish', [aspect('Finish', 'Non-Holo')]],
  ['reverse-holo printing', [aspect('Printing', 'Reverse Holo')]],
  ['normal printing', [aspect('Printing', 'Normal')]],
  ['base parallel', [aspect('Parallel', 'Base')]],
  ['different artwork', [aspect('Parallel/Variety', 'Alternate Art')]],
  ['extra color', [aspect('Parallel', 'Gold Special Art')]],
  ['set', [aspect('Set', 'Stellar Crown')]],
  ['product set alias', [aspect('Product Set', 'Surging Sparks')]],
];
contradictions.push(['combined', contradictions.flatMap(([, attrs]) => attrs)]);
for (const [label, attrs] of contradictions) {
  test(`structured ${label} contradiction cannot enter valuation, neutral votes, saved trust or Atlas`, async () => {
    const wrong = items(attrs, 'bad', 999);
    assert.equal(matchesVariantValuation(wrong[0], canonical), false);
    const valuation = await run({ market: wrong });
    assert.equal(valuation.httpStatus, 200, JSON.stringify(valuation.errors));
    assert.equal(valuation.payload.variantVerification.status, 'corrected');
    assert.equal(valuation.payload.marketData.rawComparableItems.length, 0);
    assert.equal(valuation.payload.marketData.excludedItems.length, 3);
    assert.equal(valuation.payload.marketData.marketSummary.marketConfidence, 0);
    assert.equal(valuation.report.rawValue, null); assert.equal(valuation.report.atlas, null);
    const neutral = await run({ neutral: wrong });
    assert.equal(neutral.report.rawValue, null); assert.equal(neutral.report.atlas, null);
    assert.equal(neutral.payload.variantVerification.evidenceReferences.length, 0);
    assert.equal(neutral.payload.identityEvidenceExclusions.length, 3);
    assert.equal(neutral.payload.identityEvidenceItems.length, 0);
    assert.equal(neutral.payload.identityVerification.independentListingCount, 0);
    assert.equal(neutral.payload.identityVerification.year.supportingListingCount, 0);
    assert.equal(neutral.payload.identityVerification.set.supportingListingCount, 0);
    for (const detail of Object.values(neutral.payload.variantVerification.fields)) assert.equal(detail.supportingListingCount, 0);
    const mixed = await run({ neutral: [...items(), ...wrong], market: [...items(), ...wrong] });
    assert.equal(mixed.report.rawValue, 40); assert.equal(isValuationTrusted(mixed.report), true);
    assert.equal(mixed.payload.marketData.rawComparableItems.length, 3);
    assert.equal(mixed.payload.marketData.excludedItems.length, 3);
    assert.equal(mixed.payload.marketData.marketSummary.marketConfidence, 55);
    assert.equal(mixed.payload.variantVerification.fields.art.supportingListingCount, 3);
    assert.equal(mixed.payload.identityVerification.year.supportingListingCount, 3);
    assert.equal(mixed.payload.identityVerification.set.supportingListingCount, 3);
    assert.equal(mixed.report.atlas.marketEvidence.comparableCount, 3);
    // Previously trusted reports must not retain a now-rejected listing pool.
    const stale = safeStoredReport({ ...mixed.report, marketData: { ...mixed.report.marketData, rawComparableItems: wrong } });
    assert.equal(stale.rawValue, null); assert.equal(stale.atlas, null);
  });
}

test('equivalent structured names, numeric padding, scalar numbers and variant aliases remain legitimate', async () => {
  const attrs = [aspect('year_manufactured', 2026), aspect('Collector-Number', ' # 00149 / 00128 '), aspect('Finish', 'Holographic'), aspect('Printing', 'Foil'), aspect('Parallel / Variety', 'SIR'), aspect('Set Name', '2026 Pokémon SV 30th Celebration')];
  const result = await run({ neutral: items(attrs), market: items(attrs) });
  assert.equal(result.httpStatus, 200, JSON.stringify(result.errors));
  assert.equal(isValuationTrusted(result.report), true);
  assert.equal(result.report.rawValue, 40);
  for (const cardNumber of [149, '#00149', '149/128', '00149 / 00128']) {
    assert.deepEqual(structuredListingConflicts({ title, localizedAspects: [aspect('CardNumber', cardNumber)] }, canonical), []);
  }
});

test('missing optional structured attributes and conventional absence markers do not fabricate or remove evidence', async () => {
  for (const attrs of [[], [aspect('Year', 'Not specified'), aspect('Set', 'Does not apply')]]) {
    const result = await run({ neutral: items(attrs), market: items(attrs) });
    assert.equal(isValuationTrusted(result.report), true);
    assert.equal(result.report.canonicalCard.parallel, 'Holo Special Art');
  }
});

test('ambiguous, unrecognized, malformed and mutually inconsistent recognized attributes are rejected', () => {
  for (const attr of [aspect('Year', '2024/2026'), aspect('Year', 'unknown'), aspect('Card Number', '149/128 or 150/128'), aspect('Card Number', {}), aspect('Finish', 'Holo / Non-Holo'), aspect('Finish', 'Holo Banana'), aspect('Parallel', 'Unknown'), aspect('Set', 'unknown'), aspect('Printing', null)]) {
    assert.ok(structuredListingConflicts({ title, localizedAspects: [attr] }, canonical).length, JSON.stringify(attr));
    const match = scoreListing(title, title, { player: canonical.subject, year: canonical.year, set: canonical.brandSet, cardNumber: canonical.cardNumber, parallel: canonical.parallel }, { localizedAspects: [attr] });
    assert.equal(match.comparable, false); assert.equal(match.score, 0);
  }
  const unknownFinish = { ...canonical, parallel: 'Special Art' };
  assert.ok(structuredListingConflicts({ title: 'Pikachu ex 149/128 Special Art', localizedAspects: [aspect('Finish', 'Holo'), aspect('Printing', 'Non-Holo')] }, unknownFinish).length);
  for (const localizedAspects of [{}, [null], [aspect('Year', [])]]) assert.ok(structuredListingConflicts({ title, localizedAspects }, canonical).length);
});

test('numbered sports parallels and supported non-variant base cases retain their existing behavior', async () => {
  for (const id of ['shane-smith-99', 'ian-happ-correction']) {
    const scenario = scenarios.find(s => s.id === id);
    const result = await runPipeline(scenario);
    assert.equal(isValuationTrusted(result.report), true, id);
  }
  const smith = { subject: 'Shane Smith', year: '2025', brandSet: 'Topps Chrome', cardNumber: '175', parallel: 'Green Sand Glitter /99' };
  const smithItem = { title: '2025 Topps Chrome Shane Smith #175 Green Sand Glitter 12/99', localizedAspects: [aspect('Year', '2025'), aspect('Card Number', '#00175'), aspect('Parallel', 'Green Sand Glitter /99'), aspect('Set', '2025 Topps Chrome')] };
  assert.deepEqual(structuredListingConflicts(smithItem, smith), []);
  assert.ok(structuredListingConflicts({ ...smithItem, localizedAspects: [aspect('Parallel', 'Blue Sand Glitter /49')] }, smith).length);
  const base = { subject: 'Ian Happ', year: '2026', brandSet: 'Topps Series 1', cardNumber: '155', parallel: 'Base' };
  assert.deepEqual(structuredListingConflicts({ title: '2026 Topps Series 1 Ian Happ #155 Base', localizedAspects: [aspect('Parallel', 'None'), aspect('Card Number', 155)] }, base), []);
  // No real sports provider is added by these matcher tests.
  const unsupported = await runPipeline({ ...scenarios.find(s => s.id === 'ian-happ-correction'), catalogOptions: { catalogSource: 'not-configured', catalogLookup: undefined } });
  assert.equal(unsupported.report.rawValue, null);
});

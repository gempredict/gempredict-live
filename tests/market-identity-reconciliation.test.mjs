import test from 'node:test';
import assert from 'node:assert/strict';
import { collectIdentityEvidence, buildNeutralIdentityQuery } from '../lib/marketIdentityEvidence.mjs';
import { reconcileMarketIdentity, resolveMarketIdentity, extractListingYear } from '../lib/reconcileMarketIdentity.mjs';
import { buildCanonicalCardFromImageAnalysis } from '../lib/cardIdentifier.js';
import { buildEbaySearchParams, scoreListing } from '../lib/ebayIdentityMatch.mjs';

const zamazenta = { subject: 'Zamazenta', cardNumber: '021/025', year: '2020', brandSet: 'Sword & Shield', parallel: 'Holo', displayName: '2020 Sword & Shield Zamazenta Holo #021/025' };
const listing = (id, title, extra = {}) => ({ itemId: String(id), itemWebUrl: `https://www.ebay.com/itm/${id}`, title, ...extra });
function evidence(card, titles) {
  const items = titles.map((title, i) => typeof title === 'string' ? listing(i + 1, title) : title);
  return { search: { status: 'retrieved' }, identityEvidenceItems: collectIdentityEvidence(items, card, { query: buildNeutralIdentityQuery(card), retrievedAt: '2026-01-01T00:00:00.000Z' }) };
}
const repeat = (value, count) => Array.from({ length: count }, () => value);

test('Zamazenta corrects 2020 to 2021 and Sword & Shield to independently named Celebrations', () => {
  const proposal = structuredClone(zamazenta);
  const result = reconcileMarketIdentity(proposal, evidence(proposal, repeat('2021 Pokemon Celebrations Zamazenta 021/025 Holo', 3)));
  assert.deepEqual(proposal, zamazenta);
  assert.equal(result.canonicalCard.year, '2021');
  assert.equal(result.canonicalCard.brandSet, 'Celebrations');
  assert.match(result.canonicalCard.displayName, /^2021 Celebrations/);
  for (const field of [result.identityVerification.year, result.identityVerification.set]) {
    assert.equal(field.status, 'corrected');
    assert.equal(field.supportingListingCount, 3);
    assert.equal(field.informativeEvidenceCount, 3);
    assert.equal(field.consensus, 1);
    assert.equal(field.evidenceReferences.length, 3);
  }
  assert.equal(result.identityVerification.year.originalValue, '2020');
});

test('Ian Happ uses explicit 2026 product evidence rather than presumed release-year knowledge', () => {
  const card = { subject: 'Ian Happ', cardNumber: '155', year: '2021', brandSet: 'Topps Series 1' };
  const result = reconcileMarketIdentity(card, evidence(card, [
    '2026 Topps Series 1 Ian Happ #155',
    '2026 Topps Series 1 Ian Happ #155 Raw',
    '2026 Topps Series 1 Ian Happ #155 NM',
  ]));
  assert.equal(result.canonicalCard.year, '2026');
  assert.equal(result.identityVerification.year.status, 'corrected');
  // Treatment words in a span are not guessed to be set evidence.
  assert.equal(result.identityVerification.set.status, 'verified');
});

test('Dragalge mixed set evidence remains unresolved, clear explicit set consensus may correct', () => {
  const card = { subject: 'Dragalge', cardNumber: '89/197', year: '2023', brandSet: 'Paldea Evolved' };
  const mixed = reconcileMarketIdentity(card, evidence(card, [
    ...repeat('2023 Pokemon Obsidian Flames Dragalge 89/197', 3),
    ...repeat('2023 Pokemon Paldea Evolved Dragalge 89/197', 3),
  ]));
  assert.equal(mixed.canonicalCard.brandSet, 'Paldea Evolved');
  assert.equal(mixed.identityVerification.set.status, 'unresolved_conflict');
  assert.equal(mixed.identityVerification.set.consensus, 0.5);
  const clear = reconcileMarketIdentity(card, evidence(card, repeat('2023 Pokemon Obsidian Flames Dragalge 89/197', 3)));
  assert.equal(clear.canonicalCard.brandSet, 'Obsidian Flames');
  assert.equal(clear.identityVerification.set.status, 'corrected');
});

test('Pikachu keeps stable 2017 Shining Legends with manufacturer and seller wording differences', () => {
  const card = { subject: 'Pikachu', cardNumber: '28/73', year: '2017', brandSet: 'Shining Legends', parallel: 'Common non-holo' };
  const result = reconcileMarketIdentity(card, evidence(card, [
    '2017 Pokemon Shining Legends Pikachu 28/73 Regular Non-Holo',
    '2017 Pokémon SM Shining Legends Pikachu 28/73 Non Holo',
    '2017 Shining Legends Pikachu #28/73 Non-Holo',
  ]));
  assert.deepEqual(result.canonicalCard, card);
  assert.equal(result.identityVerification.year.status, 'verified');
  assert.equal(result.identityVerification.set.status, 'verified');
  assert.equal(result.identityVerification.set.supportingListingCount, 3);
});

test('missing years do not dilute consensus, exact minimum of 3 and 60 percent is enforced', () => {
  const titles = [
    ...repeat('2021 Pokemon Celebrations Zamazenta 021/025', 3),
    ...repeat('2020 Pokemon Celebrations Zamazenta 021/025', 2),
    ...repeat('Pokemon Celebrations Zamazenta 021/025', 10),
  ];
  const result = reconcileMarketIdentity(zamazenta, evidence(zamazenta, titles));
  assert.equal(result.canonicalCard.year, '2021');
  assert.equal(result.identityVerification.year.informativeEvidenceCount, 5);
  assert.equal(result.identityVerification.year.missingListingCount, 10);
  assert.equal(result.identityVerification.year.consensus, 0.6);
  const two = reconcileMarketIdentity(zamazenta, evidence(zamazenta, titles.slice(0, 2)));
  assert.equal(two.canonicalCard.year, '2020');
  assert.equal(two.identityVerification.year.status, 'insufficient_evidence');
  const split = reconcileMarketIdentity(zamazenta, evidence(zamazenta, [...titles.slice(0, 5), '2022 Celebrations Zamazenta 021/025']));
  assert.equal(split.identityVerification.year.status, 'unresolved_conflict');
});

test('deduplication, missing stable IDs and conflicting duplicate observations cannot inflate votes', () => {
  const same = listing('1', '2021 Pokemon Celebrations Zamazenta 021/025');
  const repeated = evidence(zamazenta, [same, same, same]);
  assert.equal(reconcileMarketIdentity(zamazenta, repeated).identityVerification.year.supportingListingCount, 1);
  const changed = evidence(zamazenta, [same, { ...same, title: '2022 Pokemon Celebrations Zamazenta 021/025' }]);
  const result = reconcileMarketIdentity(zamazenta, changed);
  assert.equal(result.identityVerification.year.informativeEvidenceCount, 0);
  assert.equal(result.identityVerification.year.ambiguousListingCount, 1);
  const noId = evidence(zamazenta, repeat({ title: same.title }, 3));
  assert.equal(reconcileMarketIdentity(zamazenta, noId).identityVerification.independentListingCount, 0);
});

test('serial numbers, card IDs, calendar dates, ranges and sale years do not become product years', () => {
  for (const title of [
    'Zamazenta 021/025 serial 2026',
    'Zamazenta 021/025 2021/2026',
    '01/02/2026 Zamazenta 021/025',
    '2021-22 Pokemon Zamazenta 021/025',
    'Zamazenta 021/025 sold 2026',
    'Copyright 2021 Zamazenta 021/025',
    '2021 2026 Pokemon Zamazenta 021/025',
    'May 2026 Zamazenta 021/025',
    'June 12 2026 Zamazenta 021/025',
  ]) assert.equal(extractListingYear({ title }, zamazenta).value, null, title);
  assert.equal(extractListingYear({ title: 'Zamazenta #2021' }, { subject: 'Zamazenta', cardNumber: '2021' }).value, null);
  assert.equal(extractListingYear({ title: '2021 Pokemon Celebrations Zamazenta 021/025' }, zamazenta).value, '2021');
});

test('explicit eBay set attributes group abbreviations without depending on the vision proposal', () => {
  const card = { subject: 'Jayden Daniels', cardNumber: '248', year: '2024', brandSet: 'Select' };
  const input = ['Donruss Optic', 'Panini Donruss Optic', 'Optic'].map((set, i) => listing(i + 1, 'Jayden Daniels #248', {
    localizedAspects: [{ name: 'Set', value: set }, { name: 'Year Manufactured', value: '2024' }],
  }));
  const result = reconcileMarketIdentity(card, evidence(card, input));
  assert.equal(result.identityVerification.set.status, 'corrected');
  assert.equal(result.identityVerification.set.consensus, 1);
  assert.equal(result.canonicalCard.brandSet, 'Donruss Optic');
  assert.equal(result.identityVerification.year.status, 'verified');
});

test('unavailable, missing, constrained or synthetic evidence never verifies the proposal', () => {
  assert.equal(reconcileMarketIdentity(zamazenta, { search: { status: 'unavailable' } }).identityVerification.year.status, 'unavailable');
  assert.equal(reconcileMarketIdentity(zamazenta, evidence(zamazenta, [])).identityVerification.year.status, 'missing_evidence');
  const constrained = evidence(zamazenta, repeat('2021 Pokemon Celebrations Zamazenta 021/025', 3));
  for (const entry of constrained.identityEvidenceItems) entry.observations[0].query = '2021 Celebrations Zamazenta 021/025';
  assert.equal(reconcileMarketIdentity(zamazenta, constrained).identityVerification.independentListingCount, 0);
  const synthetic = { ...evidence(zamazenta, []), rawComparableItems: repeat(zamazenta, 5), identityEvidenceItems: repeat({ ...zamazenta, source: 'claude' }, 5) };
  assert.equal(reconcileMarketIdentity(zamazenta, synthetic).identityVerification.independentListingCount, 0);
});

test('user-protected fields report evidence but do not overwrite explicit identity', () => {
  const result = reconcileMarketIdentity(zamazenta, evidence(zamazenta, repeat('2021 Pokemon Celebrations Zamazenta 021/025', 3)), { protectedFields: ['year', 'set'] });
  assert.deepEqual(result.canonicalCard, zamazenta);
  assert.equal(result.identityVerification.year.status, 'user_protected');
  assert.equal(result.identityVerification.year.candidateValue, '2021');
});

test('mocked neutral retrieval preserves original identity and supplies corrected downstream valuation identity', async () => {
  const originalImageAnalysis = { identifiedYear: '2020', identifiedBrandSet: 'Sword & Shield', identifiedSubject: 'Zamazenta', identifiedCardNumber: '021/025', identifiedParallel: 'Holo' };
  const original = buildCanonicalCardFromImageAnalysis(originalImageAnalysis);
  const before = structuredClone(original);
  const calls = [];
  const result = await resolveMarketIdentity(original, {
    clientId: 'mock-client', clientSecret: 'mock-secret',
    fetchImpl: async url => {
      calls.push(String(url));
      return String(url).includes('/oauth2/token')
        ? { ok: true, json: async () => ({ access_token: 'mock-token' }) }
        : { ok: true, json: async () => ({ itemSummaries: repeat('2021 Pokemon Celebrations Zamazenta 021/025 Holo', 3).map((title, i) => listing(i + 1, title)) }) };
    },
  });
  assert.equal(new URL(calls[1]).searchParams.get('q'), 'Zamazenta 021/025');
  const downstream = buildEbaySearchParams(result.canonicalCard.displayName, result.canonicalCard);
  assert.equal(downstream.get('year'), '2021');
  assert.equal(downstream.get('set'), 'Celebrations');
  assert.doesNotMatch(downstream.get('q'), /2020|Sword/);
  assert.equal(scoreListing('2021 Celebrations Zamazenta 021/025 Holo', downstream.get('q'), Object.fromEntries(downstream)).comparable, true);
  assert.deepEqual(original, before);
  assert.equal(originalImageAnalysis.identifiedYear, '2020');
  assert.equal(result.canonicalCard.parallel, 'Holo');
});


test('set thresholds exclude missing product wording and reject ambiguous explicit attributes', () => {
  const input = [
    ...repeat('2021 Pokemon Celebrations Zamazenta 021/025 Holo', 3),
    ...repeat('2021 Pokemon Sword & Shield Zamazenta 021/025 Holo', 2),
    ...repeat('Zamazenta 021/025 Holo', 10),
  ];
  const result = reconcileMarketIdentity(zamazenta, evidence(zamazenta, input));
  assert.equal(result.identityVerification.set.status, 'corrected');
  assert.equal(result.identityVerification.set.informativeEvidenceCount, 5);
  assert.equal(result.identityVerification.set.missingListingCount, 10);
  assert.equal(result.identityVerification.set.consensus, 0.6);
  const ambiguous = evidence(zamazenta, [listing('1', 'Zamazenta 021/025', { localizedAspects: [{ name: 'Set', value: 'Celebrations' }, { name: 'Set', value: 'Sword & Shield' }] })]);
  assert.equal(reconcileMarketIdentity(zamazenta, ambiguous).identityVerification.set.ambiguousListingCount, 1);
});

test('missing proposals can be resolved without classifying missing values as conflicts', () => {
  const card = { ...zamazenta, year: null, brandSet: null };
  const result = reconcileMarketIdentity(card, evidence(card, repeat('2021 Pokemon Celebrations Zamazenta 021/025 Holo', 3)));
  assert.equal(result.canonicalCard.year, '2021');
  assert.equal(result.identityVerification.year.originalValueMissing, true);
  assert.equal(result.identityVerification.year.conflictingListingCount, 0);
});

test('stale unavailable evidence and unrelated originals cannot corroborate a proposal', () => {
  const stale = evidence(zamazenta, repeat('2021 Pokemon Celebrations Zamazenta 021/025', 3));
  stale.search.status = 'unavailable';
  assert.equal(reconcileMarketIdentity(zamazenta, stale).identityVerification.independentListingCount, 0);
  const wrong = evidence(zamazenta, repeat('2021 Pokemon Celebrations Zamazenta 021/025', 3));
  for (const item of wrong.identityEvidenceItems) item.observations[0].originalItem.title = '2021 Celebrations Zacian 021/025';
  assert.equal(reconcileMarketIdentity(zamazenta, wrong).identityVerification.independentListingCount, 0);
});


test('contradictory title and explicit item attributes are ambiguous rather than extra votes', () => {
  const entries = repeat('2021 Pokemon Celebrations Zamazenta 021/025', 3).map((title, i) => listing(i + 1, title, {
    localizedAspects: [{ name: 'Set', value: 'Sword & Shield' }, { name: 'Year Manufactured', value: '2020' }],
  }));
  const result = reconcileMarketIdentity(zamazenta, evidence(zamazenta, entries));
  assert.equal(result.identityVerification.year.informativeEvidenceCount, 0);
  assert.equal(result.identityVerification.set.informativeEvidenceCount, 0);
  assert.equal(result.identityVerification.set.ambiguousListingCount, 3);
  assert.equal(result.canonicalCard.year, '2020');
  assert.equal(result.canonicalCard.brandSet, 'Sword & Shield');
});

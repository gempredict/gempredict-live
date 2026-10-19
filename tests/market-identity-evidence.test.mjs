import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNeutralIdentityQuery, collectIdentityEvidence, fetchIdentityEvidence, mergeIdentityEvidence } from '../lib/marketIdentityEvidence.mjs';
import { scoreListing } from '../lib/ebayIdentityMatch.mjs';

const card = { subject: 'Zamazenta', cardNumber: '021/025', year: '2020', brandSet: 'Sword & Shield', parallel: 'Holo' };
const item = (itemId, title, extra = {}) => ({ itemId, title, itemWebUrl: `https://www.ebay.com/itm/${itemId}`, price: { value: '25', currency: 'USD' }, ...extra });
const retrieval = { query: 'Zamazenta 021/025', retrievedAt: '2026-01-01T00:00:00.000Z' };
function mockBrowse(listings, calls = []) {
  return async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'mock-token' }) };
    return { ok: true, json: async () => ({ total: listings.length, itemSummaries: listings }) };
  };
}
const fetchOptions = (fetchImpl) => ({ fetchImpl, clientId: 'mock-client', clientSecret: 'mock-secret' });

test('neutral Browse retrieval preserves 2021 Zamazenta evidence against a 2020 proposal', async () => {
  const listing = item('100', '2021 Pokemon Celebrations Zamazenta 021/025 Holo');
  const calls = [];
  const result = await fetchIdentityEvidence(card, fetchOptions(mockBrowse([listing], calls)));
  const query = new URL(calls[1].url).searchParams.get('q');
  assert.equal(query, 'Zamazenta 021/025');
  assert.doesNotMatch(query, /2020|Sword|Shield|Holo/i);
  assert.equal(result.search.status, 'retrieved');
  assert.equal(result.identityEvidenceItems.length, 1);
  const evidence = result.identityEvidenceItems[0];
  assert.equal(evidence.title, listing.title);
  assert.equal(evidence.itemWebUrl, listing.itemWebUrl);
  assert.deepEqual(evidence.observations[0].originalItem, listing);
  assert.deepEqual(evidence.matchReasons, ['Same subject in listing title', 'Exact card number in listing title']);
  assert.equal(evidence.observations[0].searchType, 'neutral_subject_card_number');
  assert.equal(scoreListing(listing.title, 'Zamazenta', { player: card.subject, cardNumber: card.cardNumber, year: card.year, set: card.brandSet, parallel: card.parallel }).comparable, false);
  assert.equal(card.year, '2020'); // Evidence does not correct the proposal.
});

test('fractional Pokemon IDs remain exact while sets and finishes may conflict', () => {
  const pikachu = { subject: 'Pikachu', cardNumber: '28/73', year: '2017', brandSet: 'Shining Legends', parallel: 'Common non-holo' };
  const listings = [
    item('1', '2017 Shining Legends Pikachu 28/73 Regular Non-Holo'),
    item('2', '2018 Hidden Fates Pikachu #28/73 Reverse Holo'),
    item('3', 'Pikachu #29/73'),
    item('4', 'Pikachu #28/74'),
    item('5', 'Pikachu #128/73'),
    item('6', 'Raichu #28/73'),
    item('7', 'Pikachu #28'),
  ];
  const pool = collectIdentityEvidence(listings, pikachu, retrieval);
  assert.deepEqual(pool.map(value => value.itemId), ['1', '2']);
  assert.equal(pool[1].observations[0].originalItem.title, listings[1].title);
});

test('One Piece alphanumeric IDs do not match prefixes, different sets or other numbers', async () => {
  const luffy = { subject: 'Monkey D. Luffy', cardNumber: 'OP14-014', year: '2026', brandSet: 'OP14', parallel: 'Base' };
  const listings = [
    item('1', 'Monkey D Luffy OP14-014 Alternate Art'),
    item('2', 'Monkey D. Luffy OP14-014 Gold PSA 10', { condition: 'Graded' }),
    item('3', 'Monkey D Luffy OP14-0140'),
    item('4', 'Monkey D Luffy OP13-014'),
    item('5', 'Monkey D Luffy OP14-015'),
    item('6', 'Roronoa Zoro OP14-014'),
  ];
  const calls = [];
  const result = await fetchIdentityEvidence(luffy, fetchOptions(mockBrowse(listings, calls)));
  assert.equal(new URL(calls[1].url).searchParams.get('q'), 'Monkey D. Luffy OP14-014');
  assert.deepEqual(result.identityEvidenceItems.map(value => value.itemId), ['1', '2']);
  assert.equal(result.identityEvidenceItems[1].listingType, 'graded');
});

test('graded evidence is retained; bundles, unrelated products and incidental numbers are excluded', () => {
  const target = { subject: 'Jayden Daniels', cardNumber: '248' };
  const listings = [
    item('1', 'Jayden Daniels #248 PSA 10'),
    item('2', 'Jayden Daniels #248', { condition: 'Graded' }),
    ...['Lot of 2', 'Bundle', 'x2', 'Box', 'Reprint', 'Digital', 'Sleeve', 'Poster', 'Code card'].map((suffix, i) => item(`bad${i}`, `Jayden Daniels #248 ${suffix}`)),
    item('3', 'Jayden Daniels #249 numbered /248'),
    item('4', 'Caleb Williams #248'),
    item('5', 'Jayden Daniels #1248'),
  ];
  const pool = collectIdentityEvidence(listings, target, retrieval);
  assert.deepEqual(pool.map(value => value.itemId), ['1', '2']);
  assert.ok(pool.every(value => value.listingType === 'graded'));
});

test('stable IDs deduplicate across neutral searches without losing original observations', async () => {
  const first = item('100', '2021 Zamazenta 021/025', { seller: { username: 'seller-a' } });
  const second = { ...first, title: '2021 Celebrations Zamazenta 021/025 PSA 10' };
  const a = await fetchIdentityEvidence(card, fetchOptions(mockBrowse([first, first])));
  const b = await fetchIdentityEvidence(card, fetchOptions(mockBrowse([second, item('101', first.title)])));
  assert.equal(a.identityEvidenceItems.length, 1);
  const pool = mergeIdentityEvidence(a.identityEvidenceItems, b.identityEvidenceItems);
  assert.equal(pool.length, 2);
  assert.equal(pool[0].observations.length, 2);
  assert.deepEqual(pool[0].observations[0].originalItem, first);
  assert.deepEqual(pool[0].observations[1].originalItem, second);
  assert.equal(a.identityEvidenceItems[0].observations.length, 1); // merge does not mutate inputs
});

test('URL fallback deduplicates tracking links but retains distinct listings with identical titles', () => {
  const a = item(null, 'Zamazenta 021/025', { itemWebUrl: 'https://www.ebay.com/itm/123?tracking=one' });
  const b = { ...a, itemWebUrl: 'https://www.ebay.com/itm/Zamazenta/123?tracking=two' };
  const c = { ...a, itemWebUrl: 'https://www.ebay.com/itm/456' };
  const withId = { ...a, itemId: 'v1|123|0' };
  const pool = collectIdentityEvidence([withId, a, b, c], card, retrieval);
  assert.equal(pool.length, 2);
  assert.equal(pool[0].observations.length, 3);
});

test('no listing results means no independent confirmation, regardless of query or AI identity', async () => {
  const result = await fetchIdentityEvidence(card, fetchOptions(mockBrowse([])));
  assert.equal(result.search.status, 'retrieved');
  assert.deepEqual(result.identityEvidenceItems, []);
  assert.equal(buildNeutralIdentityQuery({ subject: 'Zamazenta', year: '2021', displayName: 'Zamazenta #021/025' }), null);
  assert.equal(buildNeutralIdentityQuery({ cardNumber: '021/025', displayName: 'Zamazenta' }), null);
  assert.equal(buildNeutralIdentityQuery(null), null);
  assert.equal(buildNeutralIdentityQuery({ subject: 'unknown', cardNumber: '021/025' }), null);
  const skipped = await fetchIdentityEvidence(null, { fetchImpl: () => { throw Error('Should not fetch'); } });
  assert.equal(skipped.search.status, 'not_requested');
  assert.deepEqual(skipped.identityEvidenceItems, []);
});

test('credentials, OAuth, Browse and network failures remain distinct from an empty successful retrieval', async () => {
  const missing = await fetchIdentityEvidence(card, { clientId: '', clientSecret: '' });
  assert.equal(missing.search.status, 'unavailable');
  const auth = await fetchIdentityEvidence(card, fetchOptions(async () => ({ ok: false, status: 401 })));
  assert.equal(auth.search.httpStatus, 401);
  const browse = await fetchIdentityEvidence(card, fetchOptions(async url => String(url).includes('/oauth2/token')
    ? { ok: true, json: async () => ({ access_token: 'mock-token' }) }
    : { ok: false, status: 429 }));
  assert.equal(browse.search.httpStatus, 429);
  const network = await fetchIdentityEvidence(card, fetchOptions(async () => { throw Error('network'); }));
  assert.equal(network.search.status, 'unavailable');
  for (const result of [missing, auth, browse, network]) assert.deepEqual(result.identityEvidenceItems, []);
});

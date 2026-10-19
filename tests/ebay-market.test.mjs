import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEbaySearchParams, buildStructuredQuery, readMarketIdentity, scoreListing, getListingType } from '../lib/ebayIdentityMatch.mjs';
import handler from '../pages/api/ebay-search.js';

const identity = { player: 'Jayden Daniels', year: '2024', set: 'Donruss Optic', cardNumber: '248', parallel: 'Purple Shock', autoOrRelic: 'none' };
const title = '2024 Donruss Optic Jayden Daniels Rated Rookie #248 Purple Shock';
const match = (listing, card = identity, q = 'Jayden Daniels') => scoreListing(listing, q, card);

test('correct identity wins regardless of prototype keywords or broader query', () => {
  assert.equal(match(title).comparable, true);
  assert.ok(match(title).score >= 60);
  const other = { player: 'Victor Wembanyama', year: '2023', set: 'Select', cardNumber: '87', parallel: 'Blue' };
  assert.equal(match('2023 Select Victor Wembanyama #87 Blue', other).comparable, true);
  assert.equal(match(title, other).score, 0);
  assert.equal(match('2024 Topps Chrome Shohei Ohtani #17', { player: 'Shohei Ohtani', year: '2024', set: 'Chrome', cardNumber: '17' }).comparable, true);
});

test('exact numbers reject conflicting, substring, missing and alphanumeric numbers', () => {
  for (const value of ['249', '1248', '2480', 'RC-248']) assert.equal(match(title.replace('#248', `#${value}`)).comparable, false);
  assert.equal(match(title.replace('#248', '')).comparable, false);
  assert.equal(match(title.replace('#248', '248')).comparable, true);
  assert.equal(match(title.replace('#248', '# 248')).comparable, true);
  assert.equal(match(title.replace('#248', 'Card #248')).comparable, true);
  assert.equal(match(title.replace('#248', '#0248')).comparable, true);
  assert.equal(match(title.replace('#248', '#RC-12'), { ...identity, cardNumber: 'RC-12' }).comparable, true);
});

test('wrong subject, year, set and conflicting products cannot be valued', () => {
  for (const listing of [title.replace('Jayden Daniels', 'Caleb Williams'), title.replace('2024', '2023'), title.replace('Donruss Optic', 'Select'), `${title} Contenders`]) assert.equal(match(listing).comparable, false);
});

test('parallel identity and numbered print runs must match', () => {
  assert.equal(match(title.replace('Purple', 'Blue')).comparable, false);
  assert.equal(match(title.replace('Purple Shock', '')).comparable, false);
  assert.equal(match(`${title} Gold`).comparable, false);
  assert.equal(match(`${title} 12/99`, { ...identity, parallel: 'Purple Shock /99' }).comparable, true);
  assert.equal(match(`${title} 12/49`, { ...identity, parallel: 'Purple Shock /99' }).comparable, false);
  assert.equal(match(`${title} /99`).comparable, false);
  assert.equal(match(`${title} numbered to 99`, { ...identity, printRun: '99' }).comparable, true);
  assert.equal(match(title, { ...identity, parallel: 'base' }).comparable, false);
});

test('autographs and relics are valid only for the matching target', () => {
  assert.equal(match(`${title} Auto`).comparable, false);
  assert.equal(match(`${title} Patch`).comparable, false);
  assert.equal(match(`${title} Autograph`, { ...identity, autoOrRelic: 'autograph' }).comparable, true);
  assert.equal(match(title, { ...identity, autoOrRelic: 'autograph' }).comparable, false);
  assert.equal(match(`${title} Non-Auto`, { ...identity, autoOrRelic: 'autograph' }).comparable, false);
  assert.equal(match(`${title} Relic`, { ...identity, autoOrRelic: 'relic' }).comparable, true);
  assert.equal(match(`${title} Auto Patch`, { ...identity, autoOrRelic: 'auto relic' }).comparable, true);
});

test('graded cards, lots and non-card products are separated', () => {
  assert.equal(getListingType(`${title} PSA 10`), 'graded');
  assert.equal(getListingType(title, 'Graded'), 'graded');
  assert.equal(getListingType(title, 'Ungraded'), 'raw');
  for (const suffix of ['Lot of 2', 'x2', '2x', '3 cards', 'reprint', 'digital', 'box', 'you pick']) assert.equal(getListingType(`${title} ${suffix}`), 'excluded');
});

test('query-only searches match ordinary titles and protect requested variants', () => {
  for (const q of ['Michael Jordan', '2024 Donruss Optic Jayden Daniels #248 Purple Shock', 'Jayden Daniels Auto', 'Jayden Daniels /99']) {
    assert.equal(scoreListing(q, q).comparable, true, q);
    assert.ok(scoreListing(q, q).score >= 60, q);
  }
  assert.equal(scoreListing('Michael Jordan', 'Michael Jordan').score, 100);
  assert.equal(scoreListing('Michael Jordan PSA 10', 'Michael Jordan').comparable, true); // Route separately classifies graded cards.
  assert.equal(scoreListing('Michael Jordan Purple', 'Michael Jordan').comparable, false);
  assert.equal(scoreListing('2024 Jayden Daniels #249', '2024 Jayden Daniels #248').comparable, false);
  assert.equal(scoreListing('LeBron James', 'Michael Jordan').comparable, false);
});

test('fractional collector numbers are distinct from serial print runs', () => {
  const card = { player: 'Charizard', set: 'Base Set', cardNumber: '4/102' };
  assert.equal(match('Charizard Base Set #4/102', card).comparable, true);
  assert.equal(match('Charizard Base Set 4/102', card).comparable, true);
  assert.equal(match('Charizard Base Set #5/102', card).comparable, false);
  assert.equal(scoreListing('Charizard #4/102', 'Charizard #4/102').comparable, true);
});

test('canonical identity survives URL encoding and broad fallback queries', () => {
  const card = { subject: 'Jayden Daniels', year: '2024', brandSet: 'Donruss Optic', cardNumber: '248', parallel: 'Purple Shock /99', autoOrRelic: 'auto relic' };
  const params = buildEbaySearchParams('broad fallback', card);
  const decoded = readMarketIdentity(Object.fromEntries(params));
  assert.equal(params.get('q'), 'broad fallback');
  assert.equal(decoded.player, card.subject);
  assert.equal(decoded.set, card.brandSet);
  for (const field of ['year', 'cardNumber', 'parallel', 'autoOrRelic']) assert.equal(decoded[field], card[field]);
  assert.match(buildStructuredQuery(decoded), /Donruss Optic/);
  assert.equal(buildEbaySearchParams('Michael Jordan', null).toString(), 'q=Michael+Jordan');
});

test('API filters valuation, preserves query-only responses, and supports structured-only searches', async () => {
  const previousFetch = globalThis.fetch;
  const previousId = process.env.EBAY_PROD_CLIENT_ID;
  const previousSecret = process.env.EBAY_PROD_CLIENT_SECRET;
  process.env.EBAY_PROD_CLIENT_ID = 'test-client';
  process.env.EBAY_PROD_CLIENT_SECRET = 'test-secret';
  let listings = [];
  let searchedQuery;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'test-token' }) };
    searchedQuery = new URL(url).searchParams.get('q');
    return { ok: true, json: async () => ({ total: listings.length, itemSummaries: listings.map(([title, value, currency = 'USD']) => ({ title, price: { value, currency }, condition: 'Ungraded' })) }) };
  };
  const call = async query => {
    let status;
    let body;
    await handler({ query }, { status(value) { status = value; return this; }, json(value) { body = value; } });
    assert.equal(status, 200);
    return body;
  };
  try {
    listings = [[title, '20'], [title.replace('#248', '#249'), '900'], [`${title} PSA 10`, '1000'], [`${title} lot`, '500'], [title, '30'], [title, '200', 'CAD']];
    const structured = await call(identity);
    assert.match(searchedQuery, /Donruss Optic/);
    assert.equal(structured.marketSummary.rawComparableCount, 2);
    assert.equal(structured.marketSummary.rawMedian, 25);
    assert.equal(structured.gradedItems.length, 1);
    assert.equal(structured.excludedItems.length, 2);
    listings = [['Michael Jordan', '10'], ['LeBron James', '1000'], ['Michael Jordan Auto', '500']];
    const queryOnly = await call({ q: 'Michael Jordan' });
    assert.equal(queryOnly.query, 'Michael Jordan');
    assert.equal(queryOnly.marketSummary.rawMedian, 10);
    assert.equal(queryOnly.marketSummary.rawComparableCount, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = previousSecret;
  }
});

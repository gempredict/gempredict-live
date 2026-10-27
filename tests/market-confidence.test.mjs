import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMarketConfidence } from '../lib/marketConfidence.mjs';
import handler from '../pages/api/ebay-search.js';
import { protectValuation } from '../lib/valuationProtection.mjs';

const confidence = (count, low = 50, high = 125, median = 100) => calculateMarketConfidence({
  rawUsedCount: count, rawMedian: median, rawTypicalRangeLow: low, rawTypicalRangeHigh: high,
});

test('sample-size tiers use only usable counts and zero has no meaningful confidence', () => {
  for (const [count, expected] of [[0, 0], [1, 20], [2, 35], [3, 45], [4, 45], [5, 55], [9, 55], [10, 70], [14, 70], [15, 80], [100, 80]]) {
    assert.equal(confidence(count), expected, `${count} usable comparables`);
  }
});

test('dispersion boundaries apply only with at least three observations', () => {
  assert.equal(confidence(1, 100, 100), 20);
  assert.equal(confidence(2, 100, 100), 35);
  assert.equal(confidence(3, 100, 100), 55);
  assert.equal(confidence(5, 100, 125), 65); // exactly 25%
  assert.equal(confidence(5, 100, 126), 60);
  assert.equal(confidence(5, 100, 150), 60); // exactly 50%
  assert.equal(confidence(5, 100, 151), 55);
  assert.equal(confidence(5, 50, 150), 55); // exactly 100%
  assert.equal(confidence(5, 50, 151), 45);
  assert.equal(confidence(15, 100, 100), 90);
  assert.ok(confidence(1000, 100, 100) <= 95);
});

test('missing or invalid range data cannot award a dispersion bonus', () => {
  for (const [low, high, median] of [[null, null, null], [100, 100, 0], [100, 100, NaN], [100, Infinity, 100], [110, 100, 100], [-10, 100, 100]]) {
    assert.equal(confidence(5, low, high, median), 55);
  }
});

const identity = { player: 'Jayden Daniels', year: '2024', set: 'Donruss Optic', cardNumber: '248', parallel: 'Purple Shock', autoOrRelic: 'none' };
const title = '2024 Donruss Optic Jayden Daniels Rated Rookie #248 Purple Shock';
const listing = (price, index, changes = {}) => ({ itemId: String(index), title, condition: 'Ungraded', price: { value: String(price), currency: 'USD' }, ...changes });

// Exercise the actual route: eligibility, price validation and outlier filtering
// must happen before the helper sees a count or price summary.
test('route confidence follows exactly the final raw valuation observations and never grants valuation trust', async () => {
  const previousFetch = globalThis.fetch;
  const previousId = process.env.EBAY_PROD_CLIENT_ID;
  const previousSecret = process.env.EBAY_PROD_CLIENT_SECRET;
  let listings = [];
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('/oauth2/token') ? { access_token: 'mock' } : { itemSummaries: listings, total: listings.length } });
  process.env.EBAY_PROD_CLIENT_ID = 'mock';
  process.env.EBAY_PROD_CLIENT_SECRET = 'mock';
  async function search(query = identity) {
    let code, result;
    await handler({ query: { q: 'Jayden Daniels', ...query } }, { status(value) { code = value; return this; }, json(value) { result = value; } });
    assert.equal(code, 200);
    return result;
  }
  try {
    for (const [count, expected] of [[0, 0], [1, 20], [2, 35], [3, 55], [5, 65], [10, 80], [15, 90]]) {
      listings = Array.from({ length: count }, (_, i) => listing(10, i));
      const result = await search();
      const summary = result.marketSummary;
      assert.equal(summary.rawComparableCount, count);
      assert.equal(summary.rawUsedCount, count);
      assert.equal(summary.rawOutlierCount, 0);
      assert.equal(summary.rawMedian, count ? 10 : null);
      assert.equal(summary.marketConfidence, expected);
      assert.equal(summary.valuationTrusted, false);
      if (count) assert.ok(summary.averageMatchScore >= 150); // never increases confidence
    }

    listings = [10, 20, 50, 100, 150].map((price, i) => listing(price, i));
    const dispersed = (await search()).marketSummary;
    assert.equal(dispersed.rawUsedCount, 5);
    assert.equal(dispersed.rawMedian, 50);
    assert.equal(dispersed.rawTypicalRangeLow, 20);
    assert.equal(dispersed.rawTypicalRangeHigh, 100);
    assert.equal(dispersed.marketConfidence, 45);

    listings = [1, 10, 11, 12, 13, 14, 15, 1000].map((price, i) => listing(price, i));
    const filtered = (await search()).marketSummary;
    assert.equal(filtered.rawComparableCount, 8);
    assert.equal(filtered.rawUsedCount, 6);
    assert.equal(filtered.rawOutlierCount, 2);
    assert.equal(filtered.rawMedian, 12.5);
    assert.equal(filtered.fairMarketValue, null); // Browse prices remain active asking evidence.
    assert.equal(filtered.rawTypicalRangeLow, 11);
    assert.equal(filtered.rawTypicalRangeHigh, 14);
    assert.equal(filtered.marketConfidence, 65); // post-filter range is <=25%, pre-filter is >25%

    listings = [...Array.from({ length: 9 }, (_, i) => listing(10, i)), listing(1000, 9)];
    assert.equal((await search()).marketSummary.marketConfidence, 65); // nine, not ten

    listings = [listing(10, 1), listing(10, 2),
      listing(10, 3, { title: `${title} PSA 10` }),
      listing(10, 4, { title: title.replace('Purple', 'Blue') }),
      listing(10, 5, { title: `${title} Auto` }),
      listing(10, 6, { title: `${title} Relic` }),
      listing(10, 7, { title: `${title} Lot of 2` }),
      listing(0, 8), listing(-5, 9), listing('NaN', 10), listing('Infinity', 11),
      listing(10, 12, { price: { value: '10', currency: 'EUR' } })];
    const excluded = (await search()).marketSummary;
    assert.equal(excluded.rawComparableCount, 2);
    assert.equal(excluded.rawUsedCount, 2);
    assert.equal(excluded.gradedCount, 1);
    assert.equal(excluded.marketConfidence, 35);

    // Strong/weak title evidence changes diagnostics, not price reliability.
    listings = Array.from({ length: 5 }, (_, i) => listing(10, i));
    const strong = (await search()).marketSummary;
    listings = listings.map(item => ({ ...item, title: 'Jayden Daniels Optic #248 Purple Shock' }));
    const abbreviated = (await search()).marketSummary;
    assert.notEqual(strong.averageMatchScore, abbreviated.averageMatchScore);
    assert.equal(strong.marketConfidence, abbreviated.marketConfidence);

    listings = Array.from({ length: 15 }, (_, i) => listing(10, i));
    const marketData = await search();
    const protectedResult = protectValuation({ prediction: { rawValue: 10, gradingUpside: 100 }, marketData,
      variantVerification: { status: 'needs_confirmation', materialAmbiguity: true, explanation: 'Variant unresolved.' } });
    assert.equal(protectedResult.marketData.marketSummary.marketConfidence, 90);
    assert.equal(protectedResult.marketData.marketSummary.valuationTrusted, false);
    assert.equal(protectedResult.valuationVerification.reason, 'variant_unresolved');
    assert.equal(protectedResult.prediction.rawValue, null);
    assert.equal(protectedResult.prediction.gradingUpside, null);
    assert.equal(protectedResult.marketData.marketSummary.fairMarketValue, null);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = previousSecret;
  }
});

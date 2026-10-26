import { verifiedVariant } from './helpers/verifiedIdentity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import buildSearchCandidates, { MARKET_QUERY_BUDGET } from '../lib/buildSearchCandidates.js';
import { buildMarketQueryFromCanonicalCard, marketVariantKeywords } from '../lib/cardIdentifier.js';
import { selectMarketQuery } from '../lib/marketQuerySelection.mjs';
import { buildEbaySearchParams } from '../lib/ebayIdentityMatch.mjs';
import { variantFromCard } from '../lib/variantVerification.mjs';
import { collectIdentityEvidence, buildNeutralIdentityQuery } from '../lib/marketIdentityEvidence.mjs';
import { reconcileMarketIdentity } from '../lib/reconcileMarketIdentity.mjs';
import { protectValuation } from '../lib/valuationProtection.mjs';
import ebayHandler from '../pages/api/ebay-search.js';

const pikachu = { subject: 'Pikachu', year: '2017', brandSet: 'Shining Legends', cardNumber: '28/73', parallel: 'Common non-holo', autoOrRelic: 'none' };
const kid = { subject: 'Eustass "Captain" Kid', year: '2026', brandSet: 'One Piece', cardNumber: 'OP14-014', parallel: 'Standard Art', autoOrRelic: 'none' };
const smith = { subject: 'Shane Smith', year: '2025', brandSet: 'Topps Chrome', cardNumber: '175', parallel: 'Green Sand Glitter /99', printRun: '99', autoOrRelic: 'none' };
const sports = { subject: 'Jayden Daniels', year: '2024', brandSet: 'Donruss Optic', cardNumber: '248', parallel: 'Purple Shock', autoOrRelic: 'none' };
const listing = (title, id, price = 10) => ({ itemId: String(id), title, condition: 'Ungraded', price: { value: String(price), currency: 'USD' } });

function assertCandidates(card) {
  const queries = buildSearchCandidates(card);
  assert.ok(queries.length > 1 && queries.length <= MARKET_QUERY_BUDGET);
  assert.equal(new Set(queries.map(query => query.toLowerCase())).size, queries.length);
  assert.ok(queries.some(query => query.includes('#' + card.cardNumber)));
  assert.ok(queries.some(query => query.includes(card.cardNumber) && !query.includes('#')));
  for (const query of queries) {
    assert.equal(query.split(card.subject).length - 1, 1, query);
    assert.equal(query.split(card.cardNumber).length - 1, 1, query);
    assert.ok(!query.includes('unknown') && !query.includes('undefined'), query);
  }
  return queries;
}

test('bounded compact candidates use canonical fields once with and without hash, never displayName duplication', () => {
  for (const card of [pikachu, kid, smith, sports]) {
    const queries = assertCandidates({ ...card, displayName: 'WRONG obsolete identity Pikachu Pikachu' });
    assert.ok(!queries.join(' ').includes('WRONG'));
    assert.equal(queries[0], buildMarketQueryFromCanonicalCard(card));
    assert.ok(queries[0].includes(card.year));
    assert.ok(queries[0].includes(card.brandSet));
    assert.ok(queries[0].includes(card.parallel));
  }
  assert.ok(buildSearchCandidates(pikachu).includes('Pikachu 28/73 non-holo'));
  assert.ok(buildSearchCandidates(sports).includes('Optic Jayden Daniels 248 Purple Shock'));
  assert.equal(marketVariantKeywords(smith).split('/99').length - 1, 1);
  assert.equal(marketVariantKeywords({ ...sports, autoOrRelic: 'auto relic' }), 'Purple Shock Autograph Relic');
  assert.deepEqual(buildSearchCandidates({ subject: 'Pikachu' }), ['Pikachu']);
  assert.deepEqual(buildSearchCandidates({}), []);
  assert.equal(buildMarketQueryFromCanonicalCard(null), '');
  assert.ok(!buildSearchCandidates({ ...sports, year: null, brandSet: null }).join(' ').includes('2024'));
  const vision = Object.fromEntries(Object.entries({ identifiedSubject: pikachu.subject, identifiedYear: pikachu.year, identifiedBrandSet: pikachu.brandSet, identifiedCardNumber: pikachu.cardNumber, identifiedParallel: pikachu.parallel, identifiedAutoOrRelic: pikachu.autoOrRelic }));
  assert.deepEqual(buildSearchCandidates(vision), buildSearchCandidates(pikachu));
});

function mockResponse(count, confidence = 55, averageMatchScore = 100, extras = {}) {
  return { ok: true, json: async () => ({ success: true, marketSummary: { rawUsedCount: count, rawComparableCount: count, rawMedian: count ? 10 : null, marketConfidence: confidence, averageMatchScore, valuationTrusted: false, ...extras }, rawComparableItems: [] }) };
}

test('later stronger pool wins over one early match; count outranks confidence and no pools are merged', async () => {
  const queries = buildSearchCandidates(pikachu);
  const calls = [];
  let active = 0, maxActive = 0;
  const result = await selectMarketQuery(pikachu, { baseUrl: 'http://mock.local', fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    const q = parsed.searchParams.get('q');
    calls.push(q);
    assert.ok(options.signal instanceof AbortSignal);
    for (const [key, value] of buildEbaySearchParams(q, pikachu)) assert.equal(parsed.searchParams.get(key), value);
    active++; maxActive = Math.max(active, maxActive);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    if (q === queries[0]) return mockResponse(1, 95, 200);
    if (q === queries[2]) return mockResponse(10, 70, 100);
    return mockResponse(3, 55, 150);
  } });
  assert.equal(result.queryUsed, queries[2]);
  assert.equal(result.marketSummary.rawUsedCount, 10); // no aggregation
  assert.equal(result.querySelection.selectedCount, 10);
  assert.equal(result.querySelection.selectedConfidence, 70);
  assert.equal(result.marketSummary.valuationTrusted, false);
  assert.match(result.querySelection.selectionReason, /usable raw count/);
  assert.equal(calls.length, queries.length);
  assert.equal(new Set(calls).size, calls.length);
  assert.deepEqual(result.queryAttempts, calls);
  assert.ok(maxActive <= 3 && maxActive > 1);
});

test('ties use confidence, variant specificity, evidence quality and stable candidate order', async () => {
  const queries = buildSearchCandidates(pikachu);
  const run = responseFor => selectMarketQuery(pikachu, { baseUrl: 'http://mock.local', fetchImpl: async url => responseFor(new URL(url).searchParams.get('q')) });
  let result = await run(q => mockResponse(5, q === queries[1] ? 65 : 55));
  assert.equal(result.queryUsed, queries[1]);
  // The no-variant candidate has higher title score; specific query wins tie.
  result = await run(q => mockResponse(5, 65, q === queries[4] ? 200 : 100));
  assert.equal(result.queryUsed, queries[0]);
  result = await run(q => mockResponse(5, 65, q === queries[1] ? 150 : 100));
  assert.equal(result.queryUsed, queries[1]);
  result = await run(() => mockResponse(5, 65, 100));
  assert.equal(result.queryUsed, queries[0]);
});

test('failed, malformed, timed-out and empty queries do not retry or discard later useful evidence', async () => {
  const queries = buildSearchCandidates(pikachu);
  const calls = [];
  const result = await selectMarketQuery(pikachu, { baseUrl: 'http://mock.local', fetchImpl: async url => {
    const q = new URL(url).searchParams.get('q'); calls.push(q);
    switch (queries.indexOf(q)) {
      case 0: return { ok: false, status: 503 };
      case 1: throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
      case 2: return { ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } };
      case 3: return mockResponse(0, 0);
      case 4: return { ok: true, json: async () => ({ success: false }) };
      default: return mockResponse(5, 65);
    }
  } });
  assert.equal(calls.length, queries.length);
  assert.equal(result.queryUsed, queries[5]);
  assert.deepEqual(result.querySelection.attempts.map(attempt => attempt.status), ['failed', 'failed', 'failed', 'empty', 'failed', 'usable']);
  assert.equal(result.querySelection.attempts[1].error, 'Search timed out');

  let emptyCalls = 0;
  const empty = await selectMarketQuery(pikachu, { baseUrl: 'http://mock.local', fetchImpl: async () => { emptyCalls++; return mockResponse(0, 0); } });
  assert.equal(emptyCalls, queries.length); // no duplicate fallback fetch
  assert.equal(empty.marketSummary.rawUsedCount, 0);
  assert.match(empty.querySelection.selectionReason, /No usable raw comparables/);
  const failed = await selectMarketQuery(pikachu, { baseUrl: 'http://mock.local', fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(failed.success, false);
  assert.equal(failed.queryUsed, null);
  assert.equal(failed.marketSummary.valuationTrusted, false);
  const noQueries = await selectMarketQuery(null, { baseUrl: 'http://mock.local', fetchImpl: async () => assert.fail('No request without subject') });
  assert.equal(noQueries.queryAttempts.length, 0);
});

// Integration through the actual eBay route: retrieval wording may broaden but
// every request still applies exactly the same identity and variant filters.
test('strictly filtered ranking covers Pokémon, corrected year/set, One Piece art, numbered and sports parallels', async () => {
  const originalFetch = globalThis.fetch;
  const originalId = process.env.EBAY_PROD_CLIENT_ID;
  const originalSecret = process.env.EBAY_PROD_CLIENT_SECRET;
  process.env.EBAY_PROD_CLIENT_ID = 'mock'; process.env.EBAY_PROD_CLIENT_SECRET = 'mock';
  try {
    const proposal = { subject: 'Zamazenta', cardNumber: '021/025', year: '2020', brandSet: 'Sword & Shield', parallel: 'Holo', autoOrRelic: 'none' };
    const neutral = Array.from({ length: 3 }, (_, i) => listing('2021 Pokemon Celebrations Zamazenta 021/025 Holo', i));
    const evidence = { search: { status: 'retrieved' }, identityEvidenceItems: collectIdentityEvidence(neutral, proposal, { query: buildNeutralIdentityQuery(proposal) }) };
    const reconciled = reconcileMarketIdentity(proposal, evidence);
    const evidenceBefore = structuredClone(evidence);
    const corrected = reconciled.canonicalCard;
    assert.equal(corrected.year, '2021');
    assert.equal(corrected.brandSet, 'Celebrations');
    const fixtures = [
      [pikachu, '2017 Shining Legends Pikachu 28/73 Regular Non-Holo', ['2017 Shining Legends Pikachu 28/73 Holo', '2017 Shining Legends Pikachu 28/73 Reverse Holo', '2017 Shining Legends Pikachu 29/73 Regular Non-Holo']],
      [corrected, '2021 Celebrations Zamazenta 021/025 Holo', ['2020 Sword & Shield Zamazenta 021/025 Holo', '2021 Celebrations Zacian 021/025 Holo']],
      [kid, '2026 One Piece Eustass Captain Kid OP14-014 Standard Art', ['2026 One Piece Eustass Captain Kid OP14-014 Alternate Art', '2026 One Piece Eustass Captain Kid OP14-014 Special Art']],
      [{ ...kid, parallel: 'Alternate Art' }, '2026 One Piece Eustass Captain Kid OP14-014 AA', ['2026 One Piece Eustass Captain Kid OP14-014 Standard Art', '2026 One Piece Eustass Captain Kid OP14-014 Special Art']],
      [{ ...kid, parallel: 'Special Art' }, '2026 One Piece Eustass Captain Kid OP14-014 Special Art', ['2026 One Piece Eustass Captain Kid OP14-014 AA', '2026 One Piece Eustass Captain Kid OP14-014 Base']],
      [smith, '2025 Topps Chrome Shane Smith #175 Green Sand Glitter 12/99', ['2025 Topps Chrome Shane Smith #175 Green Sand Glitter 12/49', '2025 Topps Chrome Shane Smith #175 Blue Sand Glitter 12/99']],
      [sports, 'Jayden Daniels Optic #248 Purple Shock', ['2024 Donruss Optic Jayden Daniels #248 Blue Shock', '2024 Donruss Optic Jayden Daniels #248 Purple Shock Auto', '2024 Donruss Optic Jayden Daniels #248 Purple Shock Relic']],
    ];
    for (const [identity, good, wrong] of fixtures) {
      const card = { ...identity, variant: variantFromCard(identity) };
      const before = structuredClone(card);
      const queries = assertCandidates(card);
      const urls = [];
      globalThis.fetch = async url => {
        if (String(url).includes('/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'mock' }) };
        const q = new URL(url).searchParams.get('q');
        let listings;
        if (q === queries[0]) listings = [listing(good, 'early', 10)];
        else if (q === queries[2]) listings = Array.from({ length: 10 }, (_, i) => listing(good, 'best' + i, 20));
        else if (q === queries[4]) listings = Array.from({ length: 20 }, (_, i) => listing(wrong[i % wrong.length], 'wrong' + i, 1000));
        else listings = [listing(good, 'outlier1', 1), ...Array.from({ length: 9 }, (_, i) => listing(good, 'other' + i, 30)), listing(good, 'outlier2', 1000)];
        // A huge graded price must never help any candidate's usable pool.
        listings.push(listing(good + ' PSA 10', 'graded', 10000));
        return { ok: true, json: async () => ({ itemSummaries: listings }) };
      };
      const selected = await selectMarketQuery(card, { baseUrl: 'http://mock.local', fetchImpl: async url => {
        urls.push(url);
        const parsed = new URL(url);
        const params = parsed.searchParams;
        assert.equal(params.get('year'), card.year);
        assert.equal(params.get('set'), card.brandSet);
        assert.equal(params.get('parallel'), card.parallel);
        assert.equal(params.get('variantIdentity'), JSON.stringify(card.variant));
        let code, payload;
        await ebayHandler({ query: Object.fromEntries(params) }, { status(value) { code = value; return this; }, json(value) { payload = value; } });
        return { ok: code === 200, json: async () => payload };
      } });
      assert.equal(selected.queryUsed, queries[2], good);
      assert.equal(selected.marketSummary.rawUsedCount, 10, good);
      assert.equal(selected.marketSummary.marketConfidence, 80, good);
      assert.equal(selected.marketSummary.rawMedian, 20, good);
      assert.equal(selected.rawComparableItems.length, 10); // no cross-query merge
      assert.equal(selected.marketSummary.valuationTrusted, false);
      assert.equal(selected.querySelection.attempts[4].rawUsedCount, 0); // wrong variant pool loses despite more retrieved results
      assert.equal(selected.querySelection.attempts[1].rawUsedCount, 9); // removed outliers never help rank
      assert.equal(urls.length, queries.length);
      assert.deepEqual(card, before);
      const protectedResult = protectValuation({ prediction: { rawValue: 20, gradingUpside: 100 }, marketData: selected, variantVerification: { status: 'needs_confirmation' } });
      assert.equal(protectedResult.marketData.marketSummary.valuationTrusted, false);
      assert.equal(protectedResult.prediction.rawValue, null);
      const noMarket = protectValuation({ marketData: { ...selected, marketSummary: { rawUsedCount: 0, rawMedian: null } }, variantVerification: verifiedVariant(card) });
      assert.equal(noMarket.valuationVerification.status, 'untrusted');
    }
    assert.deepEqual(evidence, evidenceBefore); // valuation results never vote on identity
    assert.equal(proposal.year, '2020');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = originalSecret;
  }
});

test('prediction prompt consumes selected market evidence without a duplicate prefetch', async () => {
  const source = readFileSync(new URL('../pages/api/predict.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('async function fetchPrediction('), source.indexOf('// ─── Vision analysis'));
  const prompts = [];
  const prediction = vm.runInNewContext(`${body}\nfetchPrediction;`, {
    anthropic: { messages: { create: async request => { prompts.push(request.messages[0].content); return { content: [{ type: 'text', text: '{}' }] }; } } },
    CARD_TYPE_LABELS: { pokemon: 'Pokemon' }, CONDITION_LABELS: { strong: 'Strong' },
    extractJSON: () => ({}), normaliseCard: () => ({ rawValue: 20 }),
    fetch: () => assert.fail('Prediction must reuse selected evidence, never prefetch again'),
  });
  await prediction('Pikachu', 'pokemon', '2017 Shining Legends', 'strong', pikachu, { marketSummary: { rawUsedCount: 10, rawMedian: 20 } });
  assert.match(prompts[0], /Fair Market Value: \$20/);
  await prediction('Pikachu', 'pokemon', '2017 Shining Legends', 'strong', pikachu, { marketSummary: { rawUsedCount: 0, rawMedian: null } });
  assert.doesNotMatch(prompts[1], /LIVE MARKET DATA:/);
});

import { verifiedIdentity } from './helpers/verifiedIdentity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolveMarketBaseUrl } from '../lib/internalMarketRouting.mjs';
import { selectMarketQuery } from '../lib/marketQuerySelection.mjs';
import { protectValuation } from '../lib/valuationProtection.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
const prod = 'https://gempredict-live.vercel.app';
const card = { subject: 'Pikachu', year: '2017', brandSet: 'Shining Legends', cardNumber: '28/73', parallel: 'Common non-holo', autoOrRelic: 'none' };
const authorized = { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', GEMPREDICT_ALLOW_PRODUCTION_MARKET_ROUTING: 'true' };

test('missing and invalid origins fail closed without emitting configured secrets or making requests', async () => {
  for (const baseUrl of [undefined, null, '', '  ', 'not-a-url', '/relative', '//gempredict-live.vercel.app', 'ftp://localhost', 'http://localhost:bad', 'http://user:password@localhost:3000', 'http://localhost:3000/app', 'http://localhost:3000?token=private', 'http://localhost:3000/#fragment']) {
    const r = await selectMarketQuery(card, { baseUrl, routingEnv: authorized, fetchImpl: () => assert.fail('No fetch for invalid routing') });
    assert.equal(r.success, false);
    assert.ok(['missing_internal_base_url', 'invalid_internal_base_url'].includes(r.routingError));
    assert.equal(r.marketSummary.rawUsedCount, 0);
    assert.equal(r.marketSummary.rawMedian, null);
    assert.equal(r.marketSummary.marketConfidence, 0);
    assert.equal(r.marketSummary.valuationTrusted, false);
    assert.deepEqual(r.queryAttempts, []);
    assert.deepEqual(r.querySelection.attempts, []);
    assert.doesNotMatch(JSON.stringify(r), /password|token=private/);
    const protectedResult = protectValuation({ ...verifiedIdentity(card), marketData: r, prediction: { rawValue: 10, verdict: 'grade' }, variantVerification: { status: 'verified' } });
    assert.equal(protectedResult.valuationVerification.reason, 'no_comparable_listings');
    assert.equal(protectedResult.prediction.rawValue, null);
    assert.equal(protectedResult.atlas, null);
  }
});

test('localhost, loopback and explicitly configured preview origins retain ordinary market requests', async () => {
  for (const [baseUrl, routingEnv] of [
    ['http://127.0.0.1:3000', { NODE_ENV: 'development' }],
    ['http://localhost:3000/', { NODE_ENV: 'production' }],
    ['http://[::1]:3000', { NODE_ENV: 'production' }],
    ['https://gempredict-live-git-test.vercel.app/', { VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' }],
  ]) {
    let calls = 0;
    const origin = new URL(baseUrl).origin;
    const result = await selectMarketQuery(card, { baseUrl, routingEnv, fetchImpl: async (url, options) => {
      calls++;
      assert.equal(new URL(url).origin, origin);
      assert.equal(new URL(url).pathname, '/api/ebay-search');
      assert.equal(new URL(url).searchParams.get('cardNumber'), '28/73');
      assert.equal(options.redirect, 'error');
      return { ok: true, json: async () => ({ success: true, marketSummary: { rawUsedCount: 3, rawMedian: 10, marketConfidence: 55 } }) };
    } });
    assert.ok(calls > 1 && calls <= 6);
    assert.equal(result.marketSummary.rawUsedCount, 3);
    assert.equal(result.marketSummary.marketConfidence, 55);
    assert.equal(result.marketSummary.valuationTrusted, false);
  }
});

test('production hostname is blocked locally and in previews even with NODE_ENV=production or a stray opt-in', async () => {
  for (const routingEnv of [{}, { NODE_ENV: 'development' }, { NODE_ENV: 'production' }, { ...authorized, NODE_ENV: 'development' }, { ...authorized, VERCEL_ENV: 'preview' }, { ...authorized, VERCEL_ENV: 'development' }, { ...authorized, VERCEL: undefined }, { ...authorized, GEMPREDICT_ALLOW_PRODUCTION_MARKET_ROUTING: undefined }]) {
    for (const baseUrl of [prod, prod + '/', 'https://GEMPREDICT-LIVE.VERCEL.APP.', 'https://%67empredict-live.vercel.app', 'https://www.gempredict-live.vercel.app']) {
      const r = await selectMarketQuery(card, { baseUrl, routingEnv, fetchImpl: () => assert.fail('Production must never be contacted') });
      assert.equal(r.routingError, 'production_host_blocked');
      assert.deepEqual(r.queryAttempts, []);
      assert.equal(r.querySelection.selectedQuery, null);
    }
  }
});

test('explicit authorized production deployment preserves production routing, with no implicit default', async () => {
  assert.deepEqual(resolveMarketBaseUrl(prod, authorized), { ok: true, baseUrl: prod });
  assert.equal(resolveMarketBaseUrl(undefined, authorized).reason, 'missing_internal_base_url');
  for (const url of ['http://gempredict-live.vercel.app', prod + ':444']) assert.equal(resolveMarketBaseUrl(url, authorized).reason, 'production_host_blocked');
  let calls = 0;
  await selectMarketQuery(card, { baseUrl: prod, routingEnv: authorized, fetchImpl: async url => {
    calls++;
    assert.equal(new URL(url).origin, prod);
    return { ok: true, json: async () => ({ success: true, marketSummary: { rawUsedCount: 0, rawMedian: null, marketConfidence: 0 } }) };
  } });
  assert.ok(calls > 0 && calls <= 6);
});

test('internal market requests never follow a redirect to a different origin', async () => {
  let destinationCalls = 0;
  const destination = createServer((req, res) => { destinationCalls++; res.end('{}'); });
  await new Promise(resolve => destination.listen(0, '127.0.0.1', resolve));
  const server = createServer((req, res) => { res.writeHead(302, { Location: `http://127.0.0.1:${destination.address().port}/api/ebay-search` }); res.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await selectMarketQuery(card, { baseUrl: `http://127.0.0.1:${server.address().port}`, routingEnv: {} });
    assert.equal(destinationCalls, 0);
    assert.equal(result.success, false);
    assert.ok(result.querySelection.attempts.every(a => a.status === 'failed'));
    assert.equal(result.marketSummary.valuationTrusted, false);
  } finally {
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => destination.close(resolve))]);
  }
});

test('actual prediction handler cannot fall back or call production from a local production build', async () => {
  const template = scenarios.find(s => s.id === 'text-complete');
  for (const [routingEnv, reason] of [
    [{ NEXT_PUBLIC_SITE_URL: undefined }, 'missing_internal_base_url'],
    [{ NEXT_PUBLIC_SITE_URL: '/invalid' }, 'invalid_internal_base_url'],
    [{ NEXT_PUBLIC_SITE_URL: prod, NODE_ENV: 'production' }, 'production_host_blocked'],
    [{ ...authorized, NEXT_PUBLIC_SITE_URL: prod, VERCEL_ENV: 'preview', NODE_ENV: 'production' }, 'production_host_blocked'],
  ]) {
    const result = await runPipeline({ ...template, routingEnv });
    assert.equal(result.httpStatus, 200);
    assert.equal(result.metrics.valuationBrowse, 0);
    assert.equal(result.metrics.valuationOAuth, 0);
    assert.deepEqual(result.metrics.valuationQueries, []);
    assert.equal(result.payload.marketData.routingError, reason);
    assert.equal(result.payload.valuationVerification.status, 'untrusted');
    assert.equal(result.payload.prediction.rawValue, null);
    assert.equal(result.payload.prediction.action, null);
    assert.equal(result.payload.atlas, null);
  }
});

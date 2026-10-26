import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMarketBaseUrl } from '../lib/internalMarketRouting.mjs';
import { internalMarketContext, TRUSTED_OIDC_HEADER } from '../lib/internalMarketAuth.mjs';
import { verifyPreviewIntegration } from '../lib/previewIntegration.mjs';
import { verifyRuntimeCatalogAssets } from '../lib/runtimeCatalogAssets.mjs';
import { selectMarketQuery } from '../lib/marketQuerySelection.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
const host = 'gempredict-live-immutable123.vercel.app';
const origin = `https://${host}`;
const env = { VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production', VERCEL_URL: host, VERCEL_BRANCH_URL: 'gempredict-live-git-restore.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'gempredict-live.vercel.app' };
const token = 'mock.preview.signature';
const requestHeaders = { 'x-vercel-oidc-token': token, cookie: 'private-browser-cookie', host: 'attacker.example', 'x-forwarded-host': 'attacker.example', authorization: 'private-browser-auth' };
const card = { subject: 'Pikachu', year: '2017', brandSet: 'Shining Legends', cardNumber: '28/73', parallel: 'Common non-holo', autoOrRelic: 'none' };
const template = scenarios.find(s => s.id === 'text-complete');

test('Preview trusts only its immutable platform origin, with no Host-header inference', () => {
  for (const value of [undefined, '', origin, origin + '/']) assert.deepEqual(resolveMarketBaseUrl(value, env), { ok: true, baseUrl: origin });
  for (const value of ['https://gempredict-live.vercel.app', `https://${env.VERCEL_BRANCH_URL}`, 'https://gempredict-live-other.vercel.app', 'https://gempredict.com', 'http://127.0.0.1:3000', origin + ':444', 'http://' + host]) assert.equal(resolveMarketBaseUrl(value, env).ok, false, value);
  assert.equal(internalMarketContext(undefined, env, requestHeaders).baseUrl, origin);
});

test('missing, alias-shaped or malformed platform origin fails before authentication or any request', async () => {
  for (const VERCEL_URL of [undefined, '', 'https://' + host, host + '/path', host + ':443', 'user:password@' + host, 'gempredict-live.vercel.app', env.VERCEL_BRANCH_URL, 'attacker.example']) {
    const result = await selectMarketQuery(card, { routingEnv: { ...env, VERCEL_URL }, requestHeaders, fetchImpl: () => assert.fail('No fetch for invalid origin') });
    assert.equal(result.success, false);
    assert.equal(result.marketSummary.valuationTrusted, false);
    assert.deepEqual(result.queryAttempts, []);
    assert.doesNotMatch(JSON.stringify(result), /password|private-browser|mock\.preview/);
  }
});

test('Preview forwards only the runtime OIDC token to the exact validated marketplace origin', async () => {
  let calls = 0;
  const result = await selectMarketQuery(card, { baseUrl: origin, routingEnv: env, requestHeaders, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, origin); assert.equal(new URL(url).pathname, '/api/ebay-search');
    assert.deepEqual(options.headers, { [TRUSTED_OIDC_HEADER]: token });
    assert.equal(options.redirect, 'manual');
    assert.ok(!url.includes(token));
    return { ok: true, json: async () => ({ success: true, marketSummary: { rawUsedCount: 3, rawMedian: 10, marketConfidence: 55 } }) };
  } });
  assert.ok(calls > 0 && calls <= 6);
  assert.equal(result.marketSummary.rawMedian, 10);
  assert.doesNotMatch(JSON.stringify(result), /mock\.preview|private-browser/);
});

test('missing and malformed runtime tokens fail closed with no cookie or secret fallback', async () => {
  for (const value of [undefined, '', [], 'not-a-jwt', 'header.payload.signature\r\nInjected: bad', 'a'.repeat(20000)]) {
    const headers = { cookie: 'private-cookie', 'x-vercel-oidc-token': value, 'x-vercel-protection-bypass': 'must-not-use' };
    const result = await selectMarketQuery(card, { routingEnv: { ...env, VERCEL_OIDC_TOKEN: token, VERCEL_AUTOMATION_BYPASS_SECRET: 'must-not-use' }, requestHeaders: headers, fetchImpl: () => assert.fail('No unauthenticated fallback') });
    assert.equal(result.routingError, 'preview_protection_token_unavailable');
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(result), /private-cookie|must-not-use|header\.payload/);
  }
});

test('development and explicitly authorized production preserve routing without forwarding Preview tokens', () => {
  for (const [url, routingEnv] of [
    ['http://127.0.0.1:3000', { NODE_ENV: 'development' }],
    ['https://gempredict-live.vercel.app', { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', GEMPREDICT_ALLOW_PRODUCTION_MARKET_ROUTING: 'true' }],
  ]) assert.deepEqual(internalMarketContext(url, routingEnv, requestHeaders), { ok: true, baseUrl: url, headers: {} });
});

test('runtime prediction assets verify real bytes and reject absence, corruption and forged source revisions', () => {
  assert.deepEqual(verifyRuntimeCatalogAssets(), { snapshot: true, license: true });
  for (const broken of ['snapshot-missing', 'snapshot-corrupt', 'snapshot-revision', 'license-missing', 'license-corrupt']) {
    const result = verifyRuntimeCatalogAssets({ readFile: (file, encoding) => {
      if (file.endsWith('upstream-snapshot.json') && broken.startsWith('snapshot')) {
        if (broken === 'snapshot-missing') throw new Error('private filesystem path and secret');
        if (broken === 'snapshot-corrupt') return '{';
        const data = JSON.parse(readFileSync(file, 'utf8')); data.revisions.snapshot.sha = '0'.repeat(40); return JSON.stringify(data);
      }
      if (file.endsWith('/LICENSE') && broken.startsWith('license')) {
        if (broken === 'license-missing') throw new Error('private path');
        return Buffer.from('not the original license');
      }
      return readFileSync(file, encoding);
    } });
    assert.equal(result[broken.startsWith('snapshot') ? 'snapshot' : 'license'], false);
    assert.doesNotMatch(JSON.stringify(result), /private|data\/|tcgdex\/|sha|secret/);
  }
});

test('preflight proves anonymous denial and OIDC method-guard access without scanning or following redirects', async () => {
  const calls = [];
  const result = await verifyPreviewIntegration({ env, requestHeaders, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    assert.equal(url, origin + '/api/predict'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual'); assert.equal(options.cache, 'no-store');
    return { status: options.headers ? 405 : 401, json: async () => ({ error: 'Method not allowed.' }) };
  } });
  assert.equal(result.integrationReady, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers, undefined);
  assert.deepEqual(calls[1].options.headers, { [TRUSTED_OIDC_HEADER]: token });
  assert.doesNotMatch(JSON.stringify(result), /private|mock\.preview|data\/|filesystem/);
});

for (const mode of ['public', 'denied', 'redirected', 'wrong-response', 'unavailable']) test(`preflight refuses ${mode} protection without provider or credential leakage`, async () => {
  const result = await verifyPreviewIntegration({ env, requestHeaders, fetchImpl: async (url, options) => {
    if (mode === 'unavailable') throw new Error('mock.preview.signature private-path');
    const signed = !!options.headers;
    return { status: mode === 'public' ? 405 : !signed ? 401 : mode === 'denied' ? 403 : mode === 'redirected' ? 307 : 405, json: async () => ({ error: mode === 'wrong-response' ? 'wrong' : 'Method not allowed.' }) };
  } });
  assert.equal(result.integrationReady, false); assert.equal(result.checks.protection, false);
  assert.doesNotMatch(JSON.stringify(result), /mock\.preview|private-path/);
});

test('protected GET preflight is opt-in and unavailable in Production or ordinary development', async () => {
  for (const routingEnv of [{}, { VERCEL: '1', VERCEL_ENV: 'production', GEMPREDICT_PREVIEW_PREFLIGHT_ENABLED: 'true' }, env]) {
    const r = await runPipeline({ ...template, method: 'GET', query: { preflight: '1' }, routingEnv, requestHeaders });
    assert.equal(r.httpStatus, 405); assert.equal(r.metrics.preflightRequests, 0);
  }
  const r = await runPipeline({ ...template, method: 'GET', query: { preflight: '1' }, routingEnv: { ...env, NEXT_PUBLIC_SITE_URL: undefined, GEMPREDICT_PREVIEW_PREFLIGHT_ENABLED: 'true' }, requestHeaders });
  assert.equal(r.httpStatus, 200, JSON.stringify(r.errors));
  assert.equal(r.payload.integrationReady, true);
  assert.equal(r.metrics.responseHeaders['Cache-Control'], 'private, no-store');
  for (const key of ['neutralBrowse', 'neutralOAuth', 'valuationBrowse', 'valuationOAuth', 'claudeVision', 'claudePrediction']) assert.equal(r.metrics[key], 0);
});

test('Preview POST stops before parsing, logging or paid providers when integration is incomplete', async () => {
  for (const extra of [
    { requestHeaders: {} }, { routingEnv: { ...env, NEXT_PUBLIC_SITE_URL: 'https://another.vercel.app' } },
    { assetCheck: () => ({ snapshot: false, license: true }) }, { assetCheck: () => ({ snapshot: true, license: false }) },
    { previewProtection: 'public' }, { previewProtection: 'denied' },
  ]) {
    const r = await runPipeline({ ...template, routingEnv: { ...env, NEXT_PUBLIC_SITE_URL: undefined }, requestHeaders, ...extra });
    assert.equal(r.httpStatus, 503);
    for (const key of ['neutralBrowse', 'neutralOAuth', 'valuationBrowse', 'valuationOAuth', 'claudeVision', 'claudePrediction']) assert.equal(r.metrics[key], 0);
    assert.equal(r.metrics.parseCalls, 0); assert.equal(r.metrics.logCalls, 0);
    assert.deepEqual(Object.keys(r.payload), ['error']);
    assert.doesNotMatch(JSON.stringify(r.payload), /mock\.preview|secret|filesystem|data\//);
  }
});

test('valid Preview integration retains the actual Phase 1 prediction and saved-report safeguards', async () => {
  const baseline = await runPipeline(template);
  const preview = await runPipeline({ ...template, routingEnv: { ...env, NEXT_PUBLIC_SITE_URL: undefined }, requestHeaders });
  assert.equal(preview.httpStatus, 200, JSON.stringify(preview.errors));
  assert.equal(preview.metrics.preflightRequests, 2);
  assert.equal(preview.report.rawValue, baseline.report.rawValue);
  assert.equal(preview.report.variantVerification.status, baseline.report.variantVerification.status);
  assert.equal(preview.report.valuationVerification.status, baseline.report.valuationVerification.status);
  assert.equal(preview.metrics.valuationBrowse, baseline.metrics.valuationBrowse);
  assert.ok(preview.metrics.valuationQueries.every(q => typeof q === 'string'));
  assert.doesNotMatch(JSON.stringify(preview.payload), /mock\.preview|private-browser/);
});


test('marketplace protection failures cannot trigger cookie fallback or trusted pricing', async () => {
  for (const status of [401, 403, 307]) {
    const result = await selectMarketQuery(card, { routingEnv: env, requestHeaders, fetchImpl: async (url, options) => {
      assert.equal(new URL(url).origin, origin);
      assert.deepEqual(options.headers, { [TRUSTED_OIDC_HEADER]: token });
      assert.equal(options.redirect, 'manual');
      return { ok: false, status };
    } });
    assert.equal(result.success, false);
    assert.equal(result.marketSummary.rawUsedCount, 0);
    assert.equal(result.marketSummary.valuationTrusted, false);
    assert.doesNotMatch(JSON.stringify(result), /mock\.preview|private-browser/);
  }
});


test('unverified protection never exposes diagnostic details even when the Preview preflight flag is on', async () => {
  for (const extra of [{ previewProtection: 'public' }, { requestHeaders: {} }]) {
    const r = await runPipeline({ ...template, method: 'GET', query: { preflight: '1' }, routingEnv: { ...env, NEXT_PUBLIC_SITE_URL: undefined, GEMPREDICT_PREVIEW_PREFLIGHT_ENABLED: 'true' }, requestHeaders, ...extra });
    assert.equal(r.httpStatus, 503);
    assert.deepEqual(Object.keys(r.payload), ['integrationReady']);
    assert.equal(r.payload.integrationReady, false);
    assert.equal(r.metrics.responseHeaders['Cache-Control'], 'private, no-store');
    assert.equal(r.metrics.logCalls, 0); assert.equal(r.metrics.parseCalls, 0);
  }
});

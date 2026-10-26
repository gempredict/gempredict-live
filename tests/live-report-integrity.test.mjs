import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { liveReportScenario, catalog, listings, title } from './helpers/liveReportFixture.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { isMarketAnalysisAvailable, safeStoredReport, requestVariantRevaluation, visualConditionAnalysis } from '../lib/valuationProtection.mjs';
import { loggingFailure, supabaseConfigStatus } from '../lib/supabaseDiagnostics.mjs';
import { listingDiagnostics, safeListingDiagnostics, predictionPricingReceipt } from '../lib/pricingDiagnostics.mjs';
import ebayHandler from '../pages/api/ebay-search.js';
const options = liveReportScenario();
function assertBlocked(report) {
  assert.equal(isMarketAnalysisAvailable(report), false); assert.equal(report.rawValue, null); assert.equal(report.atlas, null);
  for (const field of ['estimatedGrade', 'gradeCeiling', 'mostLikelyGradeRange', 'psa10Upside', 'overallScore', 'confidenceLevel']) assert.equal(report.imageAnalysis[field], null, field);
  assert.match(report.imageAnalysis.imageSummary, /Catalog-supported identity: 2026.*30th Celebration.*Visible corner whitening/);
  assert.doesNotMatch(report.imageAnalysis.imageSummary, /Paldea Evolved|Obsidian Flames|PSA 8/);
  assert.equal(report.imageAnalysis.primaryLimiter, 'Visible corner whitening.');
}
test('live Paldea 92% proposal is corrected; no-market result withholds grade projections and stale prose on save/reopen', async () => {
  const result = await runPipeline(options);
  assert.equal(result.payload.valuationIdentityGate.allowed, true);
  assert.match(result.report.cardTitle, /2026.*30th Celebration.*149\/128/);
  assert.doesNotMatch(result.report.cardMeta, /Paldea/);
  assertBlocked(result.report); assertBlocked(safeStoredReport(result.report));
  assert.equal(result.report.imageAnalysis.identityConfidence, 92);
  assert.equal(result.report.imageAnalysis.identifiedBrandSet, options.vision.identifiedBrandSet);
  assert.equal(result.report.pricingDiagnostics.outcome, 'no_usable_comparables');
  assert.ok(result.report.pricingDiagnostics.searches.every(s => s.outcome === 'zero_results'));
  assert.ok(result.metrics.valuationBrowse > 0);
});
test('numeric years, decorated set names, incomplete catalog states and stale stored display names cannot leak as facts', () => {
  const card = { ...options.proposal, year: '2026', brandSet: '30th Celebration' };
  for (const status of ['corrected', 'conflict', 'unavailable', undefined]) {
    const safe = visualConditionAnalysis({ ...options.vision, identifiedYear: 2023, imageSummary: '2023 card. Paldea Evolved card. Corners show whitening.' }, false, card, { catalog: { status, corrections: {} } });
    assert.match(safe.imageSummary, /Card identity is unverified/);
    assert.doesNotMatch(safe.imageSummary, /Paldea Evolved|2023/); assert.equal(safe.estimatedGrade, null);
  }
});
test('confirmation fetches fresh prices and reports a fresh withheld outcome; legitimate new comparables can restore trust', async () => {
  const initial = await runPipeline(options);
  const confirmation = { parallel: 'Holo Special Art', autoOrRelic: 'none', identity: initial.report.canonicalCard };
  for (const market of [[], listings()]) {
    const fresh = await requestVariantRevaluation(initial.report, confirmation, async (url, request) => {
      assert.equal(url, '/api/predict'); assert.equal(request.credentials, 'same-origin'); assert.equal(request.redirect, 'manual');
      const fields = JSON.parse(request.body); assert.equal(fields.rawValue, undefined); assert.equal(fields.marketData, undefined);
      const next = await runPipeline({ ...options, textOnly: true, fields, market, catalogOptions: catalog() });
      return Response.json(next.payload);
    });
    assert.equal(isMarketAnalysisAvailable(fresh), market.length > 0);
    assert.notEqual(fresh.pricingDiagnostics.requestId, initial.report.pricingDiagnostics.requestId);
    assert.equal(fresh.canonicalCard.brandSet, '30th Celebration');
    if (!market.length) assertBlocked(fresh); else assert.equal(fresh.rawValue, 40);
  }
});
test('wrong year/set/number/finish results are retrieved but excluded, not mislabeled as zero API results', async () => {
  for (const wrong of [title.replace('2026', '2023'), title.replace('30th Celebration', 'Paldea Evolved'), title.replace('149/128', '149/198'), title.replace('Holo Special Illustration Rare', 'Reverse Holo Special Illustration Rare')]) {
    const result = await runPipeline({ ...options, market: listings(wrong), catalogOptions: catalog() });
    assertBlocked(result.report);
    const searches = result.report.pricingDiagnostics.searches;
    assert.ok(searches.length); assert.ok(searches.every(s => s.retrievedCount === 3 && s.outcome === 'no_eligible_listings' && s.usedRawCount === 0));
    assert.ok(searches.every(s => s.excludedCount === 3));
  }
});
test('trusted report prose and stale display names use canonical identity while legitimate pricing survives', async () => {
  const result = await runPipeline({ ...options, market: listings(), predictionReply: { cardTitle: 'Paldea Evolved Pikachu', analysis: 'Paldea Evolved is valuable. Review condition.', action: '2023 card should grade. Review condition.' }, catalogOptions: catalog() });
  assert.equal(isMarketAnalysisAvailable(result.report), true);
  assert.doesNotMatch(result.report.analysis || '', /Paldea/); assert.doesNotMatch(result.report.action || '', /2023/);
  const restored = safeStoredReport({ ...result.report, canonicalCard: { ...result.report.canonicalCard, displayName: 'Paldea Evolved 2023' }, cardTitle: 'Paldea Evolved 2023' });
  assert.match(restored.cardTitle, /2026.*30th Celebration/); assert.equal(restored.rawValue, 40);
});
test('provider authentication/search/malformed failures have redacted codes, never upstream bodies', async () => {
  const original = globalThis.fetch, oldId = process.env.EBAY_PROD_CLIENT_ID, oldSecret = process.env.EBAY_PROD_CLIENT_SECRET;
  try {
    process.env.EBAY_PROD_CLIENT_ID = 'mock'; process.env.EBAY_PROD_CLIENT_SECRET = 'mock';
    for (const mode of ['oauth', 'browse', 'malformed']) {
      globalThis.fetch = async url => String(url).includes('/oauth2/') && mode !== 'oauth' ? Response.json({ access_token: 'mock' }) : mode === 'malformed' ? Response.json({ unexpected: 'private upstream body' }) : Response.json({ error: 'private upstream credential detail' }, { status: 401 });
      let payload;
      await ebayHandler({ query: { q: title } }, { status() { return this; }, json(value) { payload = value; } });
      assert.equal(payload.errorCode, mode === 'oauth' ? 'provider_authentication' : mode === 'browse' ? 'provider_search' : 'upstream_malformed');
      assert.doesNotMatch(JSON.stringify(payload), /private upstream|access_token|Authorization/);
    }
  } finally { globalThis.fetch = original; if (oldId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = oldId; if (oldSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = oldSecret; }
});
test('diagnostic receipts strip arbitrary strings/fields and never grant trust', () => {
  const safe = safeListingDiagnostics({ stage: 'complete', outcome: 'secret', retrievedCount: -1, headers: 'secret', rejectionCounts: { set: 2, secret: 4 } });
  assert.equal(safe.outcome, 'unverified'); assert.equal(safe.retrievedCount, 0); assert.deepEqual(safe.rejectionCounts, { set: 2 });
  const receipt = predictionPricingReceipt({ valuationIdentityGate: { allowed: false }, marketData: { querySelection: { attempts: [{ status: 'failed', failure: 'secret', query: 'private', marketDiagnostics: { stage: 'secret' } }] } } });
  assert.doesNotMatch(JSON.stringify(receipt), /secret|private/); assert.equal(receipt.valuationTrusted, false);
  const bundle = listingDiagnostics([{ listingType: 'excluded', matchScore: 90, matchReasons: ['Year match', 'Same card language'] }], [], 0);
  assert.deepEqual(bundle.rejectionCounts, { other_identity_or_listing: 1 });
});
test('RLS 42501 is diagnosed without credentials, raw SQL/messages or authorization changes', async () => {
  const key = role => `mock.${Buffer.from(JSON.stringify({ role, ref: 'testproject' })).toString('base64url')}.signature`;
  const env = { VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'https://testproject.supabase.co', SUPABASE_SERVICE_ROLE_KEY: key('anon') };
  const diagnostic = loggingFailure({ code: '42501', message: 'secret row contents' }, env);
  assert.equal(diagnostic.outcome, 'authorization_denied'); assert.equal(diagnostic.credentialClass, 'non_service_role'); assert.equal(diagnostic.projectBinding, 'matches');
  assert.doesNotMatch(JSON.stringify(diagnostic), /secret|signature|testproject|https|row contents/);
  assert.equal(supabaseConfigStatus({ ...env, SUPABASE_SERVICE_ROLE_KEY: key('service_role') }).credentialClass, 'legacy_service_role');
  assert.equal(supabaseConfigStatus({ ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' }).projectBinding, 'mismatch');
  assert.equal(supabaseConfigStatus({ ...env, SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_mock' }).credentialClass, 'publishable');
  const src = readFileSync(new URL('../pages/api/predict.js', import.meta.url), 'utf8');
  const logs = [];
  const log = vm.runInNewContext(`${src.slice(src.indexOf('async function logRequest('), src.indexOf('// ─── Request parsing'))}\nlogRequest`, { supabase: { from: table => { assert.equal(table, 'prediction_logs'); return { insert: async () => ({ error: { code: '42501', message: 'private database contents' } }) }; } }, loggingFailure: e => loggingFailure(e, env), console: { error: (...args) => logs.push(args) } });
  await log({ cardName: 'Pikachu', status: 'success' });
  assert.doesNotMatch(JSON.stringify(logs), /private database|signature|Pikachu/); assert.equal(logs.length, 1);
});

test('stale revaluation targets fail explicitly instead of silently leaving an old result on screen', async () => {
  const { replaceRevaluedReport } = await import('../lib/valuationProtection.mjs');
  const previous = { cardTitle: 'Pikachu' }, current = { cardTitle: 'Other card' }, fresh = { cardTitle: '2026 30th Celebration Pikachu ex' };
  assert.throws(() => replaceRevaluedReport([current], previous, fresh), /report changed/);
  assert.deepEqual(replaceRevaluedReport([current, previous], previous, fresh), [current, fresh]);
});

test('logging client is isolated from session persistence without forcing authorization or database policy', () => {
  const source = readFileSync(new URL('../lib/supabaseServer.js', import.meta.url), 'utf8').replace(/^import .*;$/mg, '').replace('export default supabase;', 'globalThis.client = supabase;');
  let options;
  const context = { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'mock-server-key' } }, console: { warn() {} }, createClient: (url, key, config) => { assert.equal(url, 'https://test.supabase.co'); assert.equal(key, 'mock-server-key'); options = config; return {}; } };
  vm.runInNewContext(source, context);
  assert.equal(options.auth.persistSession, false); assert.equal(options.auth.autoRefreshToken, false); assert.equal(options.auth.detectSessionInUrl, false);
  assert.equal(options.global, undefined); assert.equal(options.headers, undefined);
});

test('a saved Atlas narrative derived from superseded visual prose is withheld without invalidating legitimate prices', async () => {
  const result = await runPipeline({ ...liveReportScenario(), market: listings() });
  assert.equal(result.report.atlas, null);
  assert.equal(safeStoredReport(result.report).atlas, null);
  const stale = safeStoredReport({ ...result.report, imageAnalysis: { ...result.report.imageAnalysis, cornersNote: 'Paldea Evolved looks sharp. Corner whitening is visible.' } });
  assert.equal(stale.atlas, null); assert.equal(stale.rawValue, 40); assert.equal(isMarketAnalysisAvailable(stale), true);
  assert.equal(stale.imageAnalysis.cornersNote, 'Visible corner whitening.');
});

test('internal protection redirects, provider auth failures and network failures remain distinct without following redirects', async () => {
  const { selectMarketQuery } = await import('../lib/marketQuerySelection.mjs');
  for (const [failure, response] of [
    ['internal_redirect', new Response('', { status: 307, headers: { location: 'https://vercel.com/login' } })],
    ['internal_authentication', new Response('', { status: 401 })],
    ['provider_authentication', Response.json({ errorCode: 'provider_authentication' }, { status: 401 })],
    ['network', null],
  ]) {
    const result = await selectMarketQuery(options.proposal, { baseUrl: 'http://local.test', routingEnv: {}, fetchImpl: async (url, config) => {
      assert.equal(config.redirect, 'manual');
      if (!response) throw new TypeError('private transport details');
      return response.clone();
    } });
    assert.ok(result.querySelection.attempts.length > 0);
    assert.ok(result.querySelection.attempts.every(attempt => attempt.failure === failure));
    assert.equal(result.marketSummary.valuationTrusted, false);
    assert.doesNotMatch(JSON.stringify(result), /private transport|vercel.com\/login/);
  }
});

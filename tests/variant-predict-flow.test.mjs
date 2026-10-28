import {hybridSeed,hybridLookup,identityOnlyReport} from '../lib/hybridIdentification.mjs';
import { VISION_MODEL_CONFIGURATION, VALUATION_MODEL_CONFIGURATION } from '../lib/modelConfiguration.mjs';
import { fetchCompletedSales } from "../lib/completedSales.mjs";
import { isVariantVerificationTrusted } from "../lib/valuationProtection.mjs";
import { predictionPricingReceipt } from "../lib/pricingDiagnostics.mjs";
import { isVercelPreview, verifyPreviewIntegration } from '../lib/previewIntegration.mjs';
import { mockCatalog } from './helpers/catalogFixtures.mjs';
import { identitySearchGate } from '../lib/catalogIdentity.mjs';
import { selectMarketQuery } from '../lib/marketQuerySelection.mjs';
import { buildCanonicalCardFromText, missingTextIdentityFields } from '../lib/textCardIdentity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { reconcileVariant, parseVariantConfirmation } from '../lib/variantVerification.mjs';
import { resolveMarketIdentity as resolve } from '../lib/reconcileMarketIdentity.mjs';
import { getUserIdentityProtection } from '../lib/userIdentityProtection.mjs';
import { protectValuation, reportFromPrediction, requestVariantRevaluation } from '../lib/valuationProtection.mjs';
import { buildCanonicalCardFromImageAnalysis, buildMarketQueryFromCanonicalCard } from '../lib/cardIdentifier.js';
import buildSearchCandidates from '../lib/buildSearchCandidates.js';
import { buildEbaySearchParams } from '../lib/ebayIdentityMatch.mjs';
import ebayHandler from '../pages/api/ebay-search.js';

const source = readFileSync(new URL('../pages/api/predict.js', import.meta.url), 'utf8');
const handlerSource = source.slice(source.indexOf('export default async function handler(')).replace('export default ', '');
const identity = { subject: 'Eustass Captain Kid', year: '2026', brandSet: 'One Piece', cardNumber: 'OP14-014', parallel: 'Special Art', autoOrRelic: 'none' };
const listing = (id, art, price) => ({ itemId: String(id), title: `2026 One Piece Eustass Captain Kid OP14-014 ${art}`, price: { value: String(price), currency: 'USD' }, condition: 'Ungraded' });
const marketListings = [listing(1, 'Base', 1), listing(2, 'AA', 80), listing(3, 'Special Art', 200)];
const neutralListings = [listing(10, 'Standard Art', 1), listing(11, 'Standard Art', 1), listing(12, 'AA', 80), listing(13, 'AA', 80)];
const browse = async url => String(url).includes('/oauth2/token') ? { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ access_token: 'mock' }) } : { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ itemSummaries: marketListings }) };

async function predict(fields, imageAnalysis = null, evidence = neutralListings) {
  const captured = [];
  const capturedMarkets = [];
  const marketUrls = [];
  const neutralQueries = [];
  const context = {hybridSeed,hybridLookup,identityOnlyReport,identifyUploadedCard:async()=>null,
    VISION_MODEL_CONFIGURATION, VALUATION_MODEL_CONFIGURATION, isVariantVerificationTrusted, fetchCompletedSales, predictionPricingReceipt, isVercelPreview, verifyPreviewIntegration,
    console: { log() {}, error() {} }, Buffer,
    CARD_NAME_MIN: 2, CARD_NAME_MAX: 80, CARD_SET_MAX: 60, IMAGE_MAX_BYTES: 10485760,
    RATE_LIMIT_MAX: 5, VALID_CARD_TYPES: new Set(['onepiece', 'pokemon']), supabase: null,
    checkRateLimit: () => ({ allowed: true, remaining: 4 }), logRequest: async () => {},
    sanitiseString: value => typeof value === 'string' ? value.trim() : '', looksLikeJunk: () => false, isValidEmail: () => true,
    parseRequest: async () => ({ fields, imageBuffer: imageAnalysis ? Buffer.from('mock-image') : null }),
    fetchImageAnalysis: async () => imageAnalysis,
    calculateIdentityConfidence: () => ({ score: 90 }),
    identitySearchGate, selectMarketQuery, parseVariantConfirmation, reconcileVariant, protectValuation, getUserIdentityProtection, buildCanonicalCardFromText, missingTextIdentityFields,
    buildCanonicalCardFromImageAnalysis, buildMarketQueryFromCanonicalCard, buildSearchCandidates, buildEbaySearchParams,
    resolveMarketIdentity: (proposal, options) => resolve(proposal, { ...options, ...mockCatalog(), clientId: 'mock', clientSecret: 'mock', fetchImpl: async url => { if (String(url).includes('/oauth2/token')) return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ access_token: 'mock' }) }; neutralQueries.push(new URL(url).searchParams.get('q')); return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ itemSummaries: evidence }) }; } }),
    fetchPrediction: async (name, type, set, condition, card, market) => {
      captured.push(card);
      capturedMarkets.push(market);
      return { cardTitle: card.subject, rawValue: 999999, gradingUpside: 999999, expectedNetValue: 999999, verdict: 'grade', action: 'Grade it.', analysis: 'Market upside.' };
    },
    atlasOrchestrator: () => ({ decision: { label: 'Grade Candidate' } }),
    process: { env: { NEXT_PUBLIC_SITE_URL: 'http://mock.local' } },
    fetch: async url => {
      marketUrls.push(url);
      let code, payload;
      await ebayHandler({ query: Object.fromEntries(new URL(url).searchParams) }, { status(value) { code = value; return this; }, json(value) { payload = value; } });
      return { ok: code === 200, json: async () => payload };
    },
  };
  const handler = vm.runInNewContext(`${handlerSource}\nhandler;`, context);
  let code, payload;
  await handler({ method: 'POST', headers: {}, socket: { remoteAddress: 'test' } }, { status(value) { code = value; return this; }, json(value) { payload = value; } });
  assert.equal(code, 200);
  return { payload, captured, capturedMarkets, marketUrls, neutralQueries };
}

test('real prediction handler revalues selected art and withholds ROI if ambiguity or no exact comparables remain', async () => {
  const previousFetch = globalThis.fetch;
  const previousId = process.env.EBAY_PROD_CLIENT_ID;
  const previousSecret = process.env.EBAY_PROD_CLIENT_SECRET;
  globalThis.fetch = browse;
  process.env.EBAY_PROD_CLIENT_ID = 'mock'; process.env.EBAY_PROD_CLIENT_SECRET = 'mock';
  try {
    const incomplete = await predict({ cardName: 'Pikachu', cardType: 'onepiece' });
    assert.equal(incomplete.payload.valuationVerification.status, 'untrusted');
    assert.equal(incomplete.payload.prediction.rawValue, null);
    assert.match(incomplete.payload.variantVerification.explanation, /card number/);
    assert.match(incomplete.payload.variantVerification.explanation, /no photo is required/);
    const specified = await predict({ cardName: 'Eustass Captain Kid OP14-014 Standard Art', cardSet: '2026 One Piece', cardType: 'onepiece' });
    assert.equal(specified.captured[0].subject, identity.subject);
    assert.equal(specified.captured[0].cardNumber, identity.cardNumber);
    assert.notEqual(specified.payload.variantVerification.status, 'user_confirmed');
    assert.equal(specified.payload.valuationVerification.status, 'untrusted');
    const incompleteKid = await predict({ cardName: identity.subject, cardType: 'onepiece' });
    let freshCalls = 0;
    const completed = await requestVariantRevaluation(reportFromPrediction(incompleteKid.payload), { identity, parallel: 'Alternate Art', autoOrRelic: 'none' }, async (url, request) => {
      freshCalls++;
      const input = JSON.parse(request.body);
      assert.equal(input.prediction, undefined);
      const fresh = await predict(input);
      assert.equal(fresh.captured[0].parallel, 'Alternate Art');
      return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => fresh.payload };
    });
    assert.equal(freshCalls, 1);
    assert.equal(completed.valuationVerification.status, 'provisional');
    assert.equal(completed.marketData.marketSummary.rawMedian, 80);
    const verifiedText = await predict({ cardName: 'Eustass Captain Kid OP14-014 Standard Art', cardSet: '2026 One Piece', cardType: 'onepiece' }, null, [listing(20, 'Standard Art', 1), listing(21, 'Standard Art', 1), listing(22, 'Base', 1)]);
    assert.equal(verifiedText.payload.variantVerification.status, 'verified');
    assert.equal(verifiedText.payload.valuationVerification.status, 'provisional');
    assert.equal(verifiedText.payload.marketData.marketSummary.rawMedian, 1);
    for (const [parallel, price] of [['Standard Art', 1], ['Alternate Art', 80]]) {
      const result = await predict({ cardName: identity.subject, cardType: 'onepiece', confirmedCardIdentity: identity, confirmedVariant: { parallel, autoOrRelic: 'none' } });
      assert.equal(result.captured[0].parallel, parallel);
      assert.equal(result.payload.variantVerification.status, 'user_confirmed');
      assert.equal(result.payload.marketData.marketSummary.rawMedian, price);
      assert.equal(result.payload.valuationVerification.status, 'provisional');
      assert.equal(result.payload.originalCanonicalCard.parallel, 'Special Art');
    }
    const noPrices = await predict({ cardName: identity.subject, cardType: 'onepiece', confirmedCardIdentity: identity, confirmedVariant: { parallel: 'Manga', autoOrRelic: 'none' } });
    assert.equal(noPrices.payload.valuationVerification.reason, 'no_comparable_listings');
    assert.equal(noPrices.payload.prediction.gradingUpside, null);
    // Year/set correction happens before every ranked valuation request; the
    // chosen pool is supplied once to prediction and returned unchanged.
    const zamazentaImage = { identifiedSubject: 'Zamazenta', identifiedYear: '2020', identifiedBrandSet: 'Sword & Shield', identifiedCardNumber: '021/025', identifiedParallel: 'Holo', identifiedAutoOrRelic: 'none' };
    const zamazentaListings = Array.from({ length: 3 }, (_, i) => ({ itemId: 'z' + i, title: '2021 Celebrations Zamazenta 021/025 Holo', price: { value: '20', currency: 'USD' }, condition: 'Ungraded' }));
    globalThis.fetch = async url => String(url).includes('/oauth2/token')
      ? { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ access_token: 'mock' }) }
      : { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ itemSummaries: new URL(url).searchParams.get('q').includes('#') ? zamazentaListings.slice(0, 1) : zamazentaListings }) };
    const corrected = await predict({ cardName: 'Unknown card from image', cardType: 'pokemon' }, zamazentaImage, zamazentaListings);
    assert.equal(corrected.payload.canonicalCard.year, '2021');
    assert.equal(corrected.payload.canonicalCard.brandSet, 'Celebrations');
    assert.equal(corrected.payload.imageAnalysis.identifiedYear, '2020');
    assert.deepEqual(corrected.neutralQueries, ['Zamazenta 021/025']);
    assert.equal(corrected.payload.identityEvidenceItems.length, 3);
    assert.equal(corrected.payload.marketData.marketSummary.rawUsedCount, 3);
    assert.equal(corrected.payload.marketData.querySelection.attempts.length, corrected.marketUrls.length);
    assert.ok(corrected.marketUrls.length <= 6);
    for (const url of corrected.marketUrls) {
      const params = new URL(url).searchParams;
      assert.equal(params.get('year'), '2021');
      assert.equal(params.get('set'), 'Celebrations');
      assert.ok(!params.get('q').includes('2020') && !params.get('q').includes('Sword'));
    }
    assert.equal(corrected.capturedMarkets[0].queryUsed, corrected.payload.marketData.queryUsed);
    assert.equal(corrected.capturedMarkets[0].marketSummary.rawMedian, corrected.payload.marketData.marketSummary.rawMedian);
    globalThis.fetch = browse;
    const imageAnalysis = { identifiedSubject: identity.subject, identifiedYear: identity.year, identifiedBrandSet: identity.brandSet, identifiedCardNumber: identity.cardNumber, identifiedParallel: 'Standard Art', identifiedAutoOrRelic: 'none' };
    const ambiguous = await predict({ cardName: identity.subject, cardType: 'onepiece' }, imageAnalysis);
    assert.equal(ambiguous.payload.variantVerification.status, 'needs_confirmation');
    assert.equal(ambiguous.payload.valuationVerification.reason, 'variant_unresolved');
    assert.equal(ambiguous.payload.prediction.rawValue, null);
    assert.equal(ambiguous.payload.prediction.action, null);
    assert.equal(ambiguous.payload.marketData.marketSummary.rawMedian, null);
    assert.equal(ambiguous.payload.atlas, null);
    for (const [field, value] of Object.entries(imageAnalysis)) assert.equal(ambiguous.payload.imageAnalysis[field], value);
    assert.equal(ambiguous.payload.imageAnalysis.worthGrading, null);
    assert.match(ambiguous.payload.imageAnalysis.worthGradingReason, /withheld/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = previousSecret;
  }
});

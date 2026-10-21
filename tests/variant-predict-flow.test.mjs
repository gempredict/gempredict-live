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
const browse = async url => String(url).includes('/oauth2/token') ? { ok: true, json: async () => ({ access_token: 'mock' }) } : { ok: true, json: async () => ({ itemSummaries: marketListings }) };

async function predict(fields, imageAnalysis = null, evidence = neutralListings) {
  const captured = [];
  const context = {
    console: { log() {}, error() {} }, Buffer,
    CARD_NAME_MIN: 2, CARD_NAME_MAX: 80, CARD_SET_MAX: 60, IMAGE_MAX_BYTES: 10485760,
    RATE_LIMIT_MAX: 5, VALID_CARD_TYPES: new Set(['onepiece']), supabase: null,
    checkRateLimit: () => ({ allowed: true, remaining: 4 }), logRequest: async () => {},
    sanitiseString: value => typeof value === 'string' ? value.trim() : '', looksLikeJunk: () => false, isValidEmail: () => true,
    parseRequest: async () => ({ fields, imageBuffer: imageAnalysis ? Buffer.from('mock-image') : null }),
    fetchImageAnalysis: async () => imageAnalysis,
    calculateIdentityConfidence: () => ({ score: 90 }),
    parseVariantConfirmation, reconcileVariant, protectValuation, getUserIdentityProtection, buildCanonicalCardFromText, missingTextIdentityFields,
    buildCanonicalCardFromImageAnalysis, buildMarketQueryFromCanonicalCard, buildSearchCandidates, buildEbaySearchParams,
    resolveMarketIdentity: (proposal, options) => resolve(proposal, { ...options, clientId: 'mock', clientSecret: 'mock', fetchImpl: async url => String(url).includes('/oauth2/token') ? { ok: true, json: async () => ({ access_token: 'mock' }) } : { ok: true, json: async () => ({ itemSummaries: evidence }) } }),
    fetchPrediction: async (name, type, set, condition, card) => {
      captured.push(card);
      return { cardTitle: card.subject, rawValue: 999999, gradingUpside: 999999, expectedNetValue: 999999, verdict: 'grade', action: 'Grade it.', analysis: 'Market upside.' };
    },
    atlasOrchestrator: () => ({ decision: { label: 'Grade Candidate' } }),
    process: { env: { NEXT_PUBLIC_SITE_URL: 'http://mock.local' } },
    fetch: async url => {
      let code, payload;
      await ebayHandler({ query: Object.fromEntries(new URL(url).searchParams) }, { status(value) { code = value; return this; }, json(value) { payload = value; } });
      return { ok: code === 200, json: async () => payload };
    },
  };
  const handler = vm.runInNewContext(`${handlerSource}\nhandler;`, context);
  let code, payload;
  await handler({ method: 'POST', headers: {}, socket: { remoteAddress: 'test' } }, { status(value) { code = value; return this; }, json(value) { payload = value; } });
  assert.equal(code, 200);
  return { payload, captured };
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
      return { ok: true, json: async () => fresh.payload };
    });
    assert.equal(freshCalls, 1);
    assert.equal(completed.valuationVerification.status, 'trusted');
    assert.equal(completed.marketData.marketSummary.rawMedian, 80);
    const verifiedText = await predict({ cardName: 'Eustass Captain Kid OP14-014 Standard Art', cardSet: '2026 One Piece', cardType: 'onepiece' }, null, [listing(20, 'Standard Art', 1), listing(21, 'Standard Art', 1), listing(22, 'Base', 1)]);
    assert.equal(verifiedText.payload.variantVerification.status, 'verified');
    assert.equal(verifiedText.payload.valuationVerification.status, 'trusted');
    assert.equal(verifiedText.payload.marketData.marketSummary.rawMedian, 1);
    for (const [parallel, price] of [['Standard Art', 1], ['Alternate Art', 80]]) {
      const result = await predict({ cardName: identity.subject, cardType: 'onepiece', confirmedCardIdentity: identity, confirmedVariant: { parallel, autoOrRelic: 'none' } });
      assert.equal(result.captured[0].parallel, parallel);
      assert.equal(result.payload.variantVerification.status, 'user_confirmed');
      assert.equal(result.payload.marketData.marketSummary.rawMedian, price);
      assert.equal(result.payload.valuationVerification.status, 'trusted');
      assert.equal(result.payload.originalCanonicalCard.parallel, 'Special Art');
    }
    const noPrices = await predict({ cardName: identity.subject, cardType: 'onepiece', confirmedCardIdentity: identity, confirmedVariant: { parallel: 'Manga', autoOrRelic: 'none' } });
    assert.equal(noPrices.payload.valuationVerification.reason, 'no_comparable_listings');
    assert.equal(noPrices.payload.prediction.gradingUpside, null);
    const imageAnalysis = { identifiedSubject: identity.subject, identifiedYear: identity.year, identifiedBrandSet: identity.brandSet, identifiedCardNumber: identity.cardNumber, identifiedParallel: 'Standard Art', identifiedAutoOrRelic: 'none' };
    const ambiguous = await predict({ cardName: identity.subject, cardType: 'onepiece' }, imageAnalysis);
    assert.equal(ambiguous.payload.variantVerification.status, 'needs_confirmation');
    assert.equal(ambiguous.payload.valuationVerification.reason, 'variant_unresolved');
    assert.equal(ambiguous.payload.prediction.rawValue, null);
    assert.equal(ambiguous.payload.prediction.action, null);
    assert.equal(ambiguous.payload.marketData.marketSummary.rawMedian, null);
    assert.equal(ambiguous.payload.atlas, null);
    assert.equal(ambiguous.payload.imageAnalysis, imageAnalysis);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = previousSecret;
  }
});

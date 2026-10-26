import { fetchCompletedSales } from "../../lib/completedSales.mjs";
import { isVariantVerificationTrusted } from "../../lib/valuationProtection.mjs";
import { predictionPricingReceipt } from "../../lib/pricingDiagnostics.mjs";
import { isVercelPreview, verifyPreviewIntegration } from '../../lib/previewIntegration.mjs';
import { MAX_IMAGE_BYTES } from '../../lib/mobileImages.mjs';
import { identitySearchGate } from '../../lib/catalogIdentity.mjs';
import { calculateGradingEconomics, formatMoney } from '../../lib/gradingEconomics.mjs';
// Stage A: real route control flow, Claude parsing/normalization, identity/variant
// reconciliation, eBay eligibility, confidence, ranking and valuation protection.
// Only transport/image bytes, external SDK replies and database writes are mocked.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { buildCanonicalCardFromImageAnalysis } from '../../lib/cardIdentifier.js';
import { buildCanonicalCardFromText, missingTextIdentityFields } from '../../lib/textCardIdentity.mjs';
import { getUserIdentityProtection } from '../../lib/userIdentityProtection.mjs';
import { resolveMarketIdentity } from '../../lib/reconcileMarketIdentity.mjs';
import { reconcileVariant, parseVariantConfirmation } from '../../lib/variantVerification.mjs';
import { selectMarketQuery } from '../../lib/marketQuerySelection.mjs';
import { marketAnalysisSummary, protectValuation, isValuationTrusted, withheldSummary, reportFromPrediction, safeStoredReport } from '../../lib/valuationProtection.mjs';
import ebayHandler from '../../pages/api/ebay-search.js';
import buildSearchCandidates from '../../lib/buildSearchCandidates.js';
import calculateIdentityConfidence from '../../lib/calculateIdentityConfidence.js';
import marketEvidenceEngine from '../../lib/marketEvidenceEngine.js';
import recommendationEngine from '../../lib/recommendationEngine.js';
import atlasDecisionEngine from '../../lib/atlasDecisionEngine.js';
import atlasReportBuilder from '../../lib/atlasReportBuilder.js';
import atlasEvidenceEngine from '../../lib/atlasEvidenceEngine.js';
import atlasGradeExplanation from '../../lib/atlasGradeExplanation.js';
import atlasVersion from '../../lib/atlasVersion.js';

const source = readFileSync(new URL('../../pages/api/predict.js', import.meta.url), 'utf8');
const config = source.slice(source.indexOf('const RATE_LIMIT_MAX'), source.indexOf('// ─── Supabase logging'));
const helpers = source.slice(source.indexOf('function safeInt('), source.indexOf('// ─── Anthropic client'));
const claudeFunctions = source.slice(source.indexOf('async function fetchPrediction('), source.indexOf('// ─── Main handler'));
const handlerSource = source.slice(source.indexOf('export default async function handler(')).replace('export default ', '');
const atlasSource = readFileSync(new URL('../../lib/atlasOrchestrator.js', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace('export default ', '');
export const atlasOrchestrator = vm.runInNewContext(`${atlasSource}\natlasOrchestrator;`, { isValuationTrusted, buildSearchCandidates, calculateIdentityConfidence, marketEvidenceEngine, recommendationEngine, atlasDecisionEngine, atlasReportBuilder, atlasEvidenceEngine, atlasGradeExplanation, atlasVersion });
const app = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
const copySource = app.slice(app.indexOf('function buildCopySummary('), app.indexOf('// ─── CSS'));
const copySummary = vm.runInNewContext(`${copySource}\nbuildCopySummary;`, {
  marketAnalysisSummary, isValuationTrusted, withheldSummary, safeStoredReport,
  safeMoney: formatMoney,
  VERDICTS: { grade: { label: 'Grade It' }, skip: { label: 'Skip It' }, maybe: { label: 'Consider It' } },
});

export async function runPipeline(scenario) {
  const originalFetch = globalThis.fetch;
  const originalId = process.env.EBAY_PROD_CLIENT_ID;
  const originalSecret = process.env.EBAY_PROD_CLIENT_SECRET;
  const metrics = { pricingLogs: [], preflightRequests: 0, logCalls: 0, parseCalls: 0, responseHeaders: {}, neutralOAuth: 0, neutralBrowse: 0, valuationOAuth: 0, valuationBrowse: 0, valuationQueries: [], claudeVision: 0, claudePrediction: 0 };
  const errors = [];
  const model = { cardTitle: scenario.proposal?.subject || scenario.fields?.cardName || 'Unrecognized card', cardMeta: 'Mock model proposal', psa9Value: 120, psa10Value: 200, psa10Probability: 60, ...scenario.model };
  const context = {
    isVariantVerificationTrusted, fetchCompletedSales: card => fetchCompletedSales(card, { provider: scenario.soldProvider || null }), predictionPricingReceipt, isVercelPreview, verifyPreviewIntegration: options => verifyPreviewIntegration({ ...options, ...(scenario.assetCheck ? { verifyAssets: scenario.assetCheck } : {}) }),
    MAX_IMAGE_BYTES, Buffer, console: { log(label, data) { if (String(label).startsWith('[GemPredict] Pricing')) metrics.pricingLogs.push(JSON.parse(data)); }, error(...args) { errors.push(args.map(value => String(value)).join(" ")); } }, supabase: null,
    process: { env: { NEXT_PUBLIC_SITE_URL: 'http://stage-a.local', ...scenario.routingEnv } },
    logRequest: async () => { metrics.logCalls++; },
    buildCanonicalCardFromImageAnalysis, buildCanonicalCardFromText, missingTextIdentityFields,
    identitySearchGate, calculateGradingEconomics, getUserIdentityProtection, reconcileVariant, parseVariantConfirmation, protectValuation, selectMarketQuery,
    atlasOrchestrator, calculateIdentityConfidence,
    parseRequest: async () => { metrics.parseCalls++; return { fields: scenario.fields || { cardName: 'Unknown card from image', cardType: scenario.type || 'pokemon' }, imageBuffer: scenario.textOnly ? null : Buffer.from('mock card image'), imageMimeType: 'image/png' }; },
    resolveMarketIdentity: (card, options) => resolveMarketIdentity(card, { ...options, catalogSource: 'mock-unconfigured', ...scenario.catalogOptions, clientId: 'mock', clientSecret: 'mock', fetchImpl: async url => {
      if (String(url).includes('/oauth2/token')) { metrics.neutralOAuth++; return { ok: true, json: async () => ({ access_token: 'mock' }) }; }
      metrics.neutralBrowse++;
      metrics.neutralQuery = new URL(url).searchParams.get('q');
      return { ok: true, json: async () => ({ itemSummaries: scenario.neutral || [] }) };
    } }),
    fetch: async (url, options) => {
      if (new URL(url).pathname === '/api/predict') {
        metrics.preflightRequests++;
        const authenticated = options.headers?.['x-vercel-trusted-oidc-idp-token'] === scenario.requestHeaders?.['x-vercel-oidc-token'];
        if (scenario.previewProtection === 'unavailable') throw new Error('Mock protection unavailable');
        const reached = scenario.previewProtection === 'public' || authenticated && scenario.previewProtection !== 'denied';
        return { status: reached ? 405 : 401, json: async () => ({ error: 'Method not allowed.' }) };
      }
      metrics.valuationQueries.push(new URL(url).searchParams.get('q'));
      assert.ok(options.signal instanceof AbortSignal);
      let code, payload;
      await ebayHandler({ query: Object.fromEntries(new URL(url).searchParams) }, { status(value) { code = value; return this; }, json(value) { payload = value; } });
      return { ok: code === 200, status: code, json: async () => payload };
    },
    anthropic: { messages: { create: async request => {
      const vision = Array.isArray(request.messages[0].content);
      let reply;
      if (vision) {
        metrics.claudeVision++;
        const card = scenario.proposal || {};
        reply = { identifiedSubject: card.subject, identifiedLanguage: card.language || null, identifiedYear: card.year, identifiedBrandSet: card.brandSet, identifiedCardNumber: card.cardNumber, identifiedParallel: card.parallel, identifiedAutoOrRelic: card.autoOrRelic || 'none', identityConfidence: 90, identityNotes: scenario.notes || 'Mock visible identifiers; not independently verified.', centering: 'good', corners: 'good', edges: 'good', surface: 'good', overallScore: 8, cornersNote: 'Visible corner whitening.', imageSummary: 'Condition remains available.', worthGrading: true, worthGradingReason: 'Visible condition is suitable for grading consideration; economics unassessed.', ...scenario.vision };
      } else {
        metrics.claudePrediction++;
        metrics.predictionPrompt = request.messages[0].content;
        const baseline = Number(metrics.predictionPrompt.match(/Fair Market Value: \$([\d.]+)/)?.[1] || 999);
        const rawValue = scenario.model?.rawValue ?? baseline;
        const upside = model.psa10Value - rawValue - 80;
        const net = model.psa10Value * 0.6 + model.psa9Value * 0.4 - rawValue - 80;
        reply = { ...model, rawValue, gradingUpside: upside, verdict: net > 0 ? 'grade' : 'skip', analysis: `Model used raw $${rawValue}.`, action: net > 0 ? 'Consider grading.' : 'Keep raw.', ...scenario.predictionReply };
      }
      return { content: [{ type: 'text', text: JSON.stringify(reply) }] };
    } } },
  };
  try {
    process.env.EBAY_PROD_CLIENT_ID = 'mock'; process.env.EBAY_PROD_CLIENT_SECRET = 'mock';
    globalThis.fetch = async url => {
      if (String(url).includes('/oauth2/token')) { metrics.valuationOAuth++; return { ok: true, json: async () => ({ access_token: 'mock' }) }; }
      metrics.valuationBrowse++;
      const query = new URL(url).searchParams.get('q');
      const items = typeof scenario.market === 'function' ? scenario.market(query, metrics, { limit: Number(new URL(url).searchParams.get('limit')), offset: Number(new URL(url).searchParams.get('offset') || 0) }) : scenario.market || [];
      return { ok: true, json: async () => ({ itemSummaries: items, total: scenario.marketTotal ?? items.length }) };
    };
    const handler = vm.runInNewContext(`${config}\n${helpers}\n${claudeFunctions}\n${handlerSource}\nhandler;`, context);
    let code, payload;
    await handler({ method: scenario.method || 'POST', query: scenario.query || {}, headers: scenario.requestHeaders || {}, socket: { remoteAddress: 'stage-a' } }, { status(value) { code = value; return this; }, setHeader(key, value) { metrics.responseHeaders[key] = value; }, json(value) { payload = value; } });
    if (code !== 200) return { id: scenario.id, expectedTrusted: scenario.expectedTrusted, httpStatus: code, payload, metrics, errors,
      observed: { original: scenario.proposal || scenario.fields?.originalIdentityProposal || scenario.fields?.confirmedCardIdentity || buildCanonicalCardFromText(scenario.fields), reconciled: null, yearStatus: null, setStatus: null, variantStatus: null, comparableCount: null, usedCount: null, marketConfidence: null, valuationStatus: 'no_result', marketMedian: null, modelRaw: null, expectedNet: null, upside: null } };
    if (scenario.method === 'GET') return { httpStatus: code, payload, metrics, errors };
    const report = reportFromPrediction(payload);
    const copied = copySummary(report);
    const summary = payload.marketData.marketSummary;
    return { id: scenario.id, expectedTrusted: scenario.expectedTrusted, httpStatus: code, payload, report, copied, metrics, errors,
      observed: { original: payload.originalCanonicalCard, reconciled: payload.canonicalCard, yearStatus: payload.identityVerification?.year?.status, setStatus: payload.identityVerification?.set?.status, variantStatus: payload.variantVerification.status, comparableCount: summary.rawComparableCount ?? 0, usedCount: summary.rawUsedCount, marketConfidence: summary.marketConfidence, valuationStatus: payload.valuationVerification.status, marketMedian: summary.rawMedian, modelRaw: payload.prediction.rawValue, expectedNet: payload.prediction.expectedNetValue, upside: payload.prediction.gradingUpside } };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalId === undefined) delete process.env.EBAY_PROD_CLIENT_ID; else process.env.EBAY_PROD_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.EBAY_PROD_CLIENT_SECRET; else process.env.EBAY_PROD_CLIENT_SECRET = originalSecret;
  }
}

import { resolveMarketBaseUrl } from './internalMarketRouting.mjs';
import buildSearchCandidates, { MARKET_QUERY_BUDGET } from './buildSearchCandidates.js';
import { marketVariantKeywords } from './cardIdentifier.js';
import { buildEbaySearchParams } from './ebayIdentityMatch.mjs';

const QUERY_TIMEOUT_MS = 12000;
const QUERY_CONCURRENCY = 3;
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : 0;

function variantSpecificity(query, card) {
  const words = normalize(marketVariantKeywords(card)).split(' ').filter(word => word && !['common', 'regular'].includes(word));
  const queryWords = new Set(normalize(query).split(' '));
  return words.length ? words.filter(word => queryWords.has(word)).length / words.length : 0;
}

// All queries use the SAME final canonical identity parameters. Broader query
// wording changes retrieval, never the strict eBay eligibility/variant filters.
// This pool is valuation-only and is never fed to identity reconciliation.
export async function selectMarketQuery(card, { baseUrl, fetchImpl = globalThis.fetch, routingEnv = process.env } = {}) {
  const routing = resolveMarketBaseUrl(baseUrl, routingEnv);
  const queries = routing.ok ? buildSearchCandidates(card || {}) : [];
  const results = [];
  async function search(query) {
    const diagnostic = { query, status: 'failed', rawUsedCount: 0, marketConfidence: 0, variantSpecificity: variantSpecificity(query, card || {}) };
    try {
      const response = await fetchImpl(`${routing.baseUrl}/api/ebay-search?${buildEbaySearchParams(query, card)}`, { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS), redirect: 'error' });
      if (!response.ok) return { diagnostic: { ...diagnostic, error: `HTTP ${response.status}` } };
      const data = await response.json();
      const summary = data?.marketSummary;
      if (!data?.success || !summary || !Number.isInteger(summary.rawUsedCount) || summary.rawUsedCount < 0 ||
          (summary.rawUsedCount > 0 && !(finite(summary.rawMedian) > 0))) {
        return { diagnostic: { ...diagnostic, error: 'Unavailable or invalid market response' } };
      }
      diagnostic.status = summary.rawUsedCount > 0 ? 'usable' : 'empty';
      diagnostic.rawUsedCount = summary.rawUsedCount;
      diagnostic.rawComparableCount = finite(summary.rawComparableCount);
      diagnostic.marketConfidence = finite(summary.marketConfidence);
      diagnostic.averageMatchScore = finite(summary.averageMatchScore);
      diagnostic.usableFraction = summary.rawComparableCount > 0 ? summary.rawUsedCount / summary.rawComparableCount : 0;
      return { data, diagnostic };
    } catch (error) {
      return { diagnostic: { ...diagnostic, error: /timeout|abort/i.test(error?.name || '') ? 'Search timed out' : 'Search unavailable' } };
    }
  }
  // Bounded parallelism avoids a long sequential tail while keeping API usage
  // fixed. A failed query cannot discard other useful results.
  for (let index = 0; index < queries.length; index += QUERY_CONCURRENCY) {
    results.push(...await Promise.all(queries.slice(index, index + QUERY_CONCURRENCY).map(search)));
  }
  const usable = results.filter(result => result.diagnostic.status === 'usable');
  const criteria = ['rawUsedCount', 'marketConfidence', 'variantSpecificity', 'usableFraction', 'averageMatchScore'];
  usable.sort((a, b) => {
    for (const key of criteria) {
      const difference = b.diagnostic[key] - a.diagnostic[key];
      if (difference) return difference;
    }
    return queries.indexOf(a.diagnostic.query) - queries.indexOf(b.diagnostic.query);
  });
  const selected = usable[0] || results.find(result => result.diagnostic.status === 'empty');
  const reason = !routing.ok ? `Internal market requests blocked: ${routing.reason}. Configure a permitted development origin; no fallback is used.` : usable.length
    ? 'Selected by usable raw count, then market confidence, variant specificity and evidence quality; prices are not merged.'
    : selected ? 'No usable raw comparables; retained an empty successful response for diagnostics.' : 'No usable market response was available.';
  const querySelection = {
    searchType: 'valuation_exact_identity', requestBudget: MARKET_QUERY_BUDGET,
    attempts: results.map(result => result.diagnostic),
    selectedQuery: selected?.diagnostic.query || null,
    selectedCount: selected?.diagnostic.rawUsedCount || 0,
    selectedConfidence: selected?.diagnostic.marketConfidence || 0,
    selectionReason: reason,
  };
  return {
    ...(!routing.ok ? { routingError: routing.reason } : {}),
    ...(selected?.data || { success: false, error: 'Market data unavailable', marketSummary: { rawUsedCount: 0, rawMedian: null, marketConfidence: 0 } }),
    // Ranking can never independently grant valuation trust.
    marketSummary: { ...selected?.data.marketSummary, ...(selected ? {} : { rawUsedCount: 0, rawMedian: null, marketConfidence: 0 }), valuationTrusted: false },
    queryUsed: querySelection.selectedQuery,
    queryAttempts: queries,
    querySelection,
  };
}

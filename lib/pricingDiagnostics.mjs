// Counts and fixed codes only: never seller text, URLs, request headers, tokens,
// image data or upstream error bodies. This module cannot grant valuation trust.
import { randomUUID } from 'node:crypto';
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export const failureCodes = ['configuration', 'provider_authentication', 'provider_search', 'upstream_malformed', 'network', 'internal_authentication', 'internal_redirect', 'internal_http', 'invalid_response', 'timeout'];
export function safeListingDiagnostics(value) {
  if (!value || value.stage !== 'complete') return null;
  const safe = { stage: 'complete', outcome: ['zero_results', 'no_eligible_listings', 'no_used_prices', 'usable'].includes(value.outcome) ? value.outcome : 'unverified' };
  for (const key of ['providerTotal', 'retrievedCount', 'eligibleRawCount', 'usedRawCount', 'gradedCount', 'excludedCount', 'priceOrCurrencyRejectedCount', 'belowMatchThresholdCount', 'outlierCount']) safe[key] = count(value[key]);
  safe.rejectionCounts = {};
  for (const key of ['year', 'number', 'set', 'variant', 'language', 'subject', 'other_identity_or_listing']) {
    if (count(value.rejectionCounts?.[key])) safe.rejectionCounts[key] = count(value.rejectionCounts[key]);
  }
  return safe;
}
export function listingDiagnostics(items, raw, usedCount, providerTotal = 0) {
  const reasons = {};
  for (const item of items.filter(item => item.listingType === 'excluded')) {
    // Positive identity scores on excluded products describe matches, not
    // conflicts (for example a matching card offered as a bundle).
    const categories = new Set((item.matchScore > 0 ? [] : item.matchReasons || []).map(reason => {
      const text = String(reason).toLowerCase();
      return /year/.test(text) ? 'year' : /number/.test(text) ? 'number' : /set|product/.test(text) ? 'set' : /variant|finish|holo|art|parallel|treatment/.test(text) ? 'variant' : /language/.test(text) ? 'language' : /subject|player|name/.test(text) ? 'subject' : 'other_identity_or_listing';
    }));
    if (!categories.size) categories.add('other_identity_or_listing');
    for (const category of categories) reasons[category] = (reasons[category] || 0) + 1;
  }
  return { stage: 'complete', outcome: !items.length ? 'zero_results' : !raw.length ? 'no_eligible_listings' : !usedCount ? 'no_used_prices' : 'usable', providerTotal: count(providerTotal), retrievedCount: items.length, eligibleRawCount: raw.length, usedRawCount: count(usedCount), gradedCount: items.filter(i => i.listingType === 'graded').length, excludedCount: items.filter(i => i.listingType === 'excluded').length, priceOrCurrencyRejectedCount: items.filter(i => i.listingType === 'raw' && (!(typeof i.priceValue === 'number' && i.priceValue > 0) || i.price?.currency !== 'USD')).length, belowMatchThresholdCount: items.filter(i => i.listingType === 'raw' && i.matchScore < 60).length, outlierCount: raw.length - count(usedCount), rejectionCounts: reasons };
}
export function predictionPricingReceipt(result, { startedAt, mode } = {}) {
  const attempts = result.marketData?.querySelection?.attempts || [];
  return { requestId: randomUUID(), mode: ['scan', 'revaluation', 'text'].includes(mode) ? mode : 'text', elapsedMs: Math.max(0, Date.now() - startedAt || 0), identityAllowed: result.valuationIdentityGate?.allowed === true, variantStatus: ['verified', 'corrected', 'user_confirmed', 'needs_confirmation', 'insufficient_evidence'].includes(result.variantVerification?.status) ? result.variantVerification.status : 'unresolved', valuationTrusted: result.valuationVerification?.status === 'trusted', valuationReason: ['authenticity_unresolved', 'variant_unresolved', 'identity_unresolved', 'no_comparable_listings'].includes(result.valuationVerification?.reason) ? result.valuationVerification.reason : null, outcome: result.valuationVerification?.status === 'trusted' ? 'trusted' : result.valuationIdentityGate?.allowed !== true ? 'identity_blocked' : attempts.some(a => a.status === 'empty') ? 'no_usable_comparables' : attempts.some(a => a.status === 'usable') ? 'verification_blocked' : 'market_unavailable', attemptCount: attempts.length, usableAttemptCount: attempts.filter(a => a.status === 'usable').length, emptyAttemptCount: attempts.filter(a => a.status === 'empty').length, failures: attempts.filter(a => a.status === 'failed').map(a => failureCodes.includes(a.failure) ? a.failure : 'invalid_response'), usedRawCount: count(result.marketData?.marketSummary?.rawUsedCount), searches: attempts.map(a => safeListingDiagnostics(a.marketDiagnostics)).filter(Boolean) };
}

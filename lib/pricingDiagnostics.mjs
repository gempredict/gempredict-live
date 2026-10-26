// Counts and fixed codes only: never seller text, URLs, request headers, tokens,
// image data or upstream error bodies. This module cannot grant valuation trust.
import { randomUUID } from 'node:crypto';
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export const failureCodes = ['configuration', 'provider_authentication', 'provider_search', 'upstream_malformed', 'network', 'internal_authentication', 'internal_redirect', 'internal_http', 'invalid_response', 'timeout'];
export function safeListingDiagnostics(value) {
  if (!value || value.stage !== 'complete') return null;
  const safe = { stage: 'complete', outcome: ['zero_results', 'no_eligible_listings', 'no_used_prices', 'usable'].includes(value.outcome) ? value.outcome : 'unverified' };
  for (const key of ['providerTotal', 'retrievedCount', 'eligibleRawCount', 'usedRawCount', 'gradedCount', 'excludedCount', 'priceOrCurrencyRejectedCount', 'belowMatchThresholdCount', 'outlierCount', 'retrievalLimit', 'unexaminedProviderCount']) safe[key] = count(value[key]);
  safe.rejectionCounts = {};
  safe.reasonCounts = {};
  for (const key of ['language_missing', 'language_conflict', 'year_conflict', 'number_mismatch', 'set_conflict', 'variant_conflict_or_missing', 'subject_mismatch', 'other_identity_or_listing']) {
    if (count(value.reasonCounts?.[key])) safe.reasonCounts[key] = count(value.reasonCounts[key]);
  }
  for (const key of ['year', 'number', 'set', 'variant', 'language', 'subject', 'other_identity_or_listing']) {
    if (count(value.rejectionCounts?.[key])) safe.rejectionCounts[key] = count(value.rejectionCounts[key]);
  }
  return safe;
}
export function listingDiagnostics(items, raw, usedCount, providerTotal = 0, retrievalLimit = 100) {
  const reasons = {};
  const detailReasons = {};
  for (const item of items.filter(item => item.listingType === 'excluded')) {
    // Positive identity scores on excluded products describe matches, not
    // conflicts (for example a matching card offered as a bundle).
    const categories = new Set((item.matchScore > 0 ? [] : item.matchReasons || []).map(reason => {
      const text = String(reason).toLowerCase();
      return /year/.test(text) ? 'year' : /number/.test(text) ? 'number' : /set|product/.test(text) ? 'set' : /variant|finish|holo|art|parallel|treatment/.test(text) ? 'variant' : /language/.test(text) ? 'language' : /subject|player|name/.test(text) ? 'subject' : 'other_identity_or_listing';
    }));
    const details = new Set((item.matchScore > 0 ? [] : item.matchReasons || []).map(reason => {
      const text = String(reason).toLowerCase();
      return /language not verified/.test(text) ? 'language_missing' : /language/.test(text) ? 'language_conflict' : /year/.test(text) ? 'year_conflict' : /number/.test(text) ? 'number_mismatch' : /set|product/.test(text) ? 'set_conflict' : /variant|finish|holo|art|parallel|treatment/.test(text) ? 'variant_conflict_or_missing' : /subject|player|name/.test(text) ? 'subject_mismatch' : 'other_identity_or_listing';
    }));
    if (!details.size) details.add('other_identity_or_listing');
    for (const key of details) detailReasons[key] = (detailReasons[key] || 0) + 1;
    if (!categories.size) categories.add('other_identity_or_listing');
    for (const category of categories) reasons[category] = (reasons[category] || 0) + 1;
  }
  return { stage: 'complete', retrievalLimit: count(retrievalLimit), unexaminedProviderCount: Math.max(0, count(providerTotal) - items.length), reasonCounts: detailReasons, outcome: !items.length ? 'zero_results' : !raw.length ? 'no_eligible_listings' : !usedCount ? 'no_used_prices' : 'usable', providerTotal: count(providerTotal), retrievedCount: items.length, eligibleRawCount: raw.length, usedRawCount: count(usedCount), gradedCount: items.filter(i => i.listingType === 'graded').length, excludedCount: items.filter(i => i.listingType === 'excluded').length, priceOrCurrencyRejectedCount: items.filter(i => i.listingType === 'raw' && (!(typeof i.priceValue === 'number' && i.priceValue > 0) || i.price?.currency !== 'USD')).length, belowMatchThresholdCount: items.filter(i => i.listingType === 'raw' && i.matchScore < 60).length, outlierCount: raw.length - count(usedCount), rejectionCounts: reasons };
}
export function predictionPricingReceipt(result, { startedAt, mode } = {}) {
  const attempts = result.marketData?.querySelection?.attempts || [];
  return { requestId: randomUUID(), mode: ['scan', 'revaluation', 'text'].includes(mode) ? mode : 'text', elapsedMs: Math.max(0, Date.now() - startedAt || 0), identityAllowed: result.valuationIdentityGate?.allowed === true, variantStatus: ['verified', 'corrected', 'user_confirmed', 'needs_confirmation', 'insufficient_evidence'].includes(result.variantVerification?.status) ? result.variantVerification.status : 'unresolved', valuationTrusted: result.valuationVerification?.status === 'trusted', valuationReason: ['authenticity_unresolved', 'variant_unresolved', 'identity_unresolved', 'no_comparable_listings', 'insufficient_qualified_financial_evidence'].includes(result.valuationVerification?.reason) ? result.valuationVerification.reason : null, soldDataStatus: ['available', 'insufficient_evidence', 'unavailable'].includes(result.financialDecision?.sales?.status) ? result.financialDecision.sales.status : 'unavailable', financialDecisionStatus: ['actionable', 'provisional', 'unavailable', 'withheld'].includes(result.financialDecision?.status) ? result.financialDecision.status : 'withheld', outcome: result.valuationVerification?.status === 'trusted' ? 'trusted' : result.valuationVerification?.status === 'provisional' ? 'provisional_analysis' : result.valuationIdentityGate?.allowed !== true ? 'identity_blocked' : attempts.some(a => a.status === 'empty') ? 'no_usable_comparables' : attempts.some(a => a.status === 'usable') ? 'verification_blocked' : 'market_unavailable', attemptCount: attempts.length, usableAttemptCount: attempts.filter(a => a.status === 'usable').length, emptyAttemptCount: attempts.filter(a => a.status === 'empty').length, failures: attempts.filter(a => a.status === 'failed').map(a => failureCodes.includes(a.failure) ? a.failure : 'invalid_response'), usedRawCount: count(result.marketData?.marketSummary?.rawUsedCount), searches: attempts.map(a => safeListingDiagnostics(a.marketDiagnostics)).filter(Boolean) };
}

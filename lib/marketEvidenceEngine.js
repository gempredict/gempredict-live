// Presentation of the selected pool, never another confidence calculation.
export default function marketEvidenceEngine(market = {}) {
  const summary = market.marketSummary || {};
  const comparableCount = Number.isInteger(summary.rawUsedCount) && summary.rawUsedCount > 0 ? summary.rawUsedCount : 0;
  const confidence = comparableCount && Number.isFinite(summary.marketConfidence) ? summary.marketConfidence : 0;
  const median = Number.isFinite(summary.rawMedian) && summary.rawMedian > 0 ? summary.rawMedian : null;
  const level = confidence >= 85 ? 'Very High' : confidence >= 70 ? 'High' : confidence >= 50 ? 'Moderate' : 'Low';
  return {
    confidence, level, comparableCount, median,
    evidenceType: 'active_asking_price_listings',
    source: 'ebay_browse',
    queryUsed: market.queryUsed || null,
    querySelection: market.querySelection || null,
    reasons: [
      `${comparableCount} usable raw asking-price listings in the selected pool.`,
      'Active asking prices are not evidence of realized sale prices.',
    ],
  };
}

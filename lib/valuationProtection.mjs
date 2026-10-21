const amounts = ['rawValue', 'psa9Value', 'psa10Value', 'gradingUpside', 'expectedGradedValue', 'expectedNetValue', 'gemPredictScore', 'decisionConfidence'];
const summaryAmounts = ['rawLowest', 'rawHighest', 'rawMedian', 'fairMarketValue', 'rawTypicalRangeLow', 'rawTypicalRangeHigh'];

export function isValuationTrusted(report) {
  return report?.valuationVerification?.status === 'trusted' && report?.marketData?.marketSummary?.valuationTrusted === true;
}

export function protectValuation(payload) {
  const variant = payload.variantVerification;
  const summary = payload.marketData?.marketSummary || {};
  const variantResolved = ['verified', 'corrected', 'user_confirmed'].includes(variant?.status);
  const hasPrices = summary.rawUsedCount > 0 && typeof summary.rawMedian === 'number' && Number.isFinite(summary.rawMedian) && summary.rawMedian > 0;
  const trusted = variantResolved && hasPrices;
  const reason = !variantResolved ? 'variant_unresolved' : !hasPrices ? 'no_comparable_listings' : null;
  const explanation = !variantResolved ? variant?.explanation || 'The card version has not been verified. Valuation and grading ROI are withheld.' : !hasPrices ? 'No usable raw comparables were found for this version. Valuation and grading ROI are withheld.' : 'Fresh raw comparables match the resolved version.';
  const marketSummary = { ...summary, valuationTrusted: trusted };
  const prediction = { ...payload.prediction };
  if (!trusted) {
    for (const field of amounts) prediction[field] = null;
    for (const field of ['verdict', 'action', 'analysis']) prediction[field] = null;
    for (const field of summaryAmounts) marketSummary[field] = null;
  }
  return {
    ...payload,
    prediction,
    atlas: trusted ? payload.atlas : null,
    marketData: { ...payload.marketData, marketSummary },
    valuationVerification: { status: trusted ? 'trusted' : 'untrusted', reason, explanation, evaluatedAt: new Date().toISOString() },
  };
}

// Apply the same boundary to restored/local reports, including older reports
// that predate valuation verification. Missing verification never grants trust.
export function safeStoredReport(report) {
  if (isValuationTrusted(report)) return report;
  const safe = protectValuation({ ...report, prediction: report, variantVerification: { ...report.variantVerification, status: "insufficient_evidence" } });
  return { ...report, ...safe.prediction, marketData: safe.marketData, atlas: null, valuationVerification: { ...safe.valuationVerification, ...report.valuationVerification, status: 'untrusted' } };
}

export function withheldSummary(report) {
  return `GemPredict Report — ${report.canonicalCard?.displayName || report.cardTitle || 'Card'} | Valuation and grading ROI withheld: ${report.valuationVerification?.explanation || 'This version needs a fresh valuation.'}`;
}

export function reportFromPrediction(data, previous = null) {
  return safeStoredReport({
    ...data.prediction,
    marketData: data.marketData || null,
    imageAnalysis: data.imageAnalysis || previous?.imageAnalysis || null,
    originalCanonicalCard: previous?.originalCanonicalCard || data.originalCanonicalCard || null,
    canonicalCard: data.canonicalCard || null,
    variantVerification: data.variantVerification || null,
    valuationVerification: data.valuationVerification || null,
    identityVerification: data.identityVerification || null,
    identityEvidenceItems: data.identityEvidenceItems || [],
    atlas: data.atlas || null,
  });
}

export async function requestVariantRevaluation(report, confirmation, fetchImpl = globalThis.fetch) {
  const card = { ...(report.canonicalCard || report.originalCanonicalCard), ...confirmation.identity };
  if (!card?.subject || !card?.cardNumber) throw new Error('Enter the card subject and card number to request fresh prices.');
  // No cached market summary, prediction or prices are submitted for unlocking.
  const response = await fetchImpl('/api/predict', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textOnlyIdentity: !report.imageAnalysis, cardName: card.subject, cardType: report.inputContext?.cardType || 'tcg', condition: report.inputContext?.condition || 'strong', confirmedCardIdentity: card, originalIdentityProposal: report.originalCanonicalCard || card, confirmedIdentity: { year: card.year, brandSet: card.brandSet }, confirmedVariant: confirmation }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not revalue this version. Try again or rescan.');
  return { ...reportFromPrediction(data, report), inputContext: report.inputContext };
}

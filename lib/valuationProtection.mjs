import { calculateGradingEconomics, consistentFinancialReport } from './gradingEconomics.mjs';
import { authenticityWarnings, authenticityExplanation } from './cardAuthenticity.mjs';
import { readValuationSetEvidence, normalizeValuationSet } from './listingIdentityEvidence.mjs';

const amounts = ['rawValue', 'psa9Value', 'psa10Value', 'gradingUpside', 'expectedGradedValue', 'expectedNetValue', 'gemPredictScore', 'decisionConfidence'];
const summaryAmounts = ['rawLowest', 'rawHighest', 'rawMedian', 'fairMarketValue', 'rawTypicalRangeLow', 'rawTypicalRangeHigh'];

function unresolvedIdentityFields(verification) {
  return ['year', 'set'].filter(field => {
    const detail = verification?.[field];
    if (!detail) return false; // Legacy/query-only callers have no reconciliation metadata.
    const missingValue = detail.value == null || !String(detail.value).trim() || /^(unknown|null|none|n\/a)$/i.test(String(detail.value).trim());
    if (detail.status === 'user_protected') return missingValue || (detail.userValues || []).length > 1;
    if (['verified', 'corrected'].includes(detail.status) && !missingValue) return false;
    return detail.status === 'unresolved_conflict' || detail.conflictingListingCount > 0 || detail.ambiguousListingCount > 0 || missingValue;
  });
}

function unresolvedValuationFields(report) {
  const fields = unresolvedIdentityFields(report.identityVerification);
  const card = report.canonicalCard;
  if (card?.brandSet && Array.isArray(report.marketData?.rawComparableItems)) {
    const expected = normalizeValuationSet(card.brandSet, card);
    // Recheck recorded evidence when restoring an older report. A previous
    // trusted flag cannot bless a pool that explicitly mixes different sets.
    if (report.marketData.rawComparableItems.some(item => readValuationSetEvidence(item, card).some(reading => reading.key !== expected)) && !fields.includes('set')) fields.push('set');
  }
  return fields;
}

function identityExplanation(fields) {
  return `Year/set identity is unresolved: ${fields.join(', ')}. Conflicting or missing identity details make pricing unreliable. Use Verify Variant to confirm the year and set and request fresh matching prices. Valuation and grading ROI are withheld.`;
}

export function isValuationTrusted(report) {
  return report?.valuationVerification?.status === 'trusted' && report?.marketData?.marketSummary?.valuationTrusted === true && !unresolvedValuationFields(report).length && !authenticityWarnings(report).length && consistentFinancialReport(report);
}

export function protectValuation(payload) {
  const warnings = authenticityWarnings(payload);
  const variant = payload.variantVerification;
  const summary = payload.marketData?.marketSummary || {};
  const variantResolved = ['verified', 'corrected', 'user_confirmed'].includes(variant?.status);
  const hasPrices = summary.rawUsedCount > 0 && typeof summary.rawMedian === 'number' && Number.isFinite(summary.rawMedian) && summary.rawMedian > 0;
  const identityFields = unresolvedValuationFields(payload);
  const trusted = !warnings.length && variantResolved && hasPrices && !identityFields.length;
  const reason = warnings.length ? 'authenticity_unresolved' : !variantResolved ? 'variant_unresolved' : identityFields.length ? 'identity_unresolved' : !hasPrices ? 'no_comparable_listings' : null;
  const explanation = warnings.length ? authenticityExplanation : !variantResolved ? variant?.explanation || 'The card version has not been verified. Valuation and grading ROI are withheld.' : identityFields.length ? identityExplanation(identityFields) : !hasPrices ? 'No usable raw comparables were found for this version. Valuation and grading ROI are withheld.' : 'Fresh raw comparables match the resolved version.';
  const marketSummary = { ...summary, valuationTrusted: trusted };
  const prediction = { ...payload.prediction };
  if (trusted) {
    Object.assign(prediction, calculateGradingEconomics(prediction, summary.rawMedian));
    prediction.financialBasis = { version: 1, rawSource: 'selected_market_median', rawMedian: summary.rawMedian };
  }
  if (!trusted) {
    for (const field of amounts) prediction[field] = null;
    for (const field of ['verdict', 'action', 'analysis']) prediction[field] = null;
    for (const field of summaryAmounts) marketSummary[field] = null;
  }
  return {
    ...payload,
    authenticityWarnings: warnings,
    prediction,
    atlas: trusted ? payload.atlas : null,
    marketData: { ...payload.marketData, marketSummary },
    valuationVerification: { status: trusted ? 'trusted' : 'untrusted', reason, explanation, ...(identityFields.length ? { unresolvedIdentityFields: identityFields } : {}), evaluatedAt: new Date().toISOString() },
  };
}

// Old Atlas snapshots may predate selected-pool wiring even when their B4
// financial report is sound. Hide inconsistent Atlas data; do not invent fresh
// evidence or invalidate the otherwise safe recorded financial calculations.
function atlasMatchesReport(report) {
  const atlas = report.atlas;
  const summary = report.marketData?.marketSummary;
  const label = { grade: 'Grade It', maybe: 'Consider It', skip: 'Skip It' }[report.verdict];
  const markets = [atlas.marketEvidence, atlas.report?.market];
  return atlas.valuationVerification?.status === 'trusted' &&
    markets.every(market => market?.evidenceType === 'active_asking_price_listings' &&
      market.comparableCount === summary.rawUsedCount && market.confidence === summary.marketConfidence &&
      market.median === summary.rawMedian && market.queryUsed === (report.marketData.queryUsed || null)) &&
    [atlas.recommendation, atlas.report?.recommendation].every(rec => rec?.verdict === report.verdict && rec.label === label && rec.reason === report.action) &&
    [atlas.decision, atlas.report?.decision].every(dec => dec?.decision === report.verdict && dec.label === label) &&
    atlas.report?.score?.score === report.gemPredictScore && atlas.gradingProbability === report.psa10Probability &&
    (report.imageAnalysis || (atlas.identityConfidence === null && atlas.report?.confidence === null)) &&
    ['subject', 'cardNumber', 'year', 'brandSet', 'parallel', 'autoOrRelic', 'printRun'].every(key => atlas.report?.identity?.[key] === report.canonicalCard?.[key]);
}

// Apply the same boundary to restored/local reports, including older reports
// that predate valuation verification. Missing verification never grants trust.
export function safeStoredReport(report) {
  if (isValuationTrusted(report)) return !report.atlas || atlasMatchesReport(report) ? report : { ...report, atlas: null };
  const identityBlocked = unresolvedValuationFields(report).length > 0 || authenticityWarnings(report).length > 0;
  const financialBlocked = !identityBlocked && report?.valuationVerification?.status === 'trusted' && !consistentFinancialReport(report);
  const safe = protectValuation({ ...report, prediction: report, variantVerification: identityBlocked ? report.variantVerification : { ...report.variantVerification, status: "insufficient_evidence" } });
  return { ...report, ...safe.prediction, marketData: safe.marketData, atlas: null, valuationVerification: financialBlocked ? { status: 'untrusted', reason: 'financial_inconsistent', explanation: 'This saved report has missing or inconsistent financial calculations. Use Verify Variant to request fresh matching evidence and recalculated prices; cached recommendations are withheld.' } : identityBlocked ? safe.valuationVerification : { ...safe.valuationVerification, ...report.valuationVerification, status: 'untrusted' } };
}

export function withheldSummary(report) {
  const identityFields = unresolvedValuationFields(report);
  const explanation = authenticityWarnings(report).length ? authenticityExplanation : identityFields.length && ['verified', 'corrected', 'user_confirmed'].includes(report.variantVerification?.status) ? identityExplanation(identityFields) : report.valuationVerification?.explanation;
  return `GemPredict Report — ${report.canonicalCard?.displayName || report.cardTitle || 'Card'} | Valuation and grading ROI withheld: ${explanation || 'This version needs a fresh valuation.'}`;
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
    identityEvidenceExclusions: data.identityEvidenceExclusions || [],
    authenticityWarnings: [...authenticityWarnings(previous || {}), ...authenticityWarnings(data)],
    atlas: data.atlas || null,
  });
}

export async function requestVariantRevaluation(report, confirmation, fetchImpl = globalThis.fetch) {
  const card = { ...(report.canonicalCard || report.originalCanonicalCard), ...confirmation.identity };
  if (!card?.subject || !card?.cardNumber) throw new Error('Enter the card subject and card number to request fresh prices.');
  // No cached market summary, prediction or prices are submitted for unlocking.
  const response = await fetchImpl('/api/predict', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authenticityWarnings: authenticityWarnings(report), textOnlyIdentity: !report.imageAnalysis, cardName: card.subject, cardType: report.inputContext?.cardType || 'tcg', condition: report.inputContext?.condition || 'strong', confirmedCardIdentity: card, originalIdentityProposal: report.originalCanonicalCard || card, confirmedIdentity: { year: card.year, brandSet: card.brandSet }, confirmedVariant: confirmation }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not revalue this version. Try again or rescan.');
  return { ...reportFromPrediction(data, report), inputContext: report.inputContext };
}

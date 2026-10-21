// The existing two-outcome probability model and $80 fee, with USD precision.
export const PSA_FEE = 80;
export function money(value, fallback = 0) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : fallback;
}
export function formatMoney(value) {
  const n = money(value);
  return n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}
export function calculateGradingEconomics(raw, baseline = raw.rawValue) {
  const rawValue = Math.max(0, money(baseline));
  const psa9Value = Math.max(rawValue, money(raw.psa9Value));
  const psa10Value = Math.max(rawValue, psa9Value, money(raw.psa10Value));
  const probability = typeof raw.psa10Probability === 'string' ? parseFloat(raw.psa10Probability) : raw.psa10Probability;
  const psa10Probability = Math.min(100, Math.max(0, Math.round(typeof probability === 'number' && Number.isFinite(probability) ? probability : 50)));
  const p = psa10Probability / 100;
  const expectedGradedValue = money(psa10Value * p + psa9Value * (1 - p));
  const expectedNetValue = money(expectedGradedValue - rawValue - PSA_FEE);
  const gradingUpside = money(psa10Value - rawValue - PSA_FEE);
  const decisionConfidence = Math.max(1, Math.min(99, 50 + Math.round(psa10Probability * 0.3) + (expectedNetValue > 0 ? 20 : 0)));
  const gemPredictScore = Math.max(1, Math.min(99, 50 + Math.round(psa10Probability * 0.25) + (expectedNetValue > 0 ? 20 : 0) + (expectedNetValue > 50 ? 10 : 0) + (gradingUpside > 0 ? 10 : 0) + (gradingUpside > 100 ? 10 : 0)));
  // Graded prices and probability remain estimates. Positive modeled economics
  // alone do not establish a confident submission recommendation.
  const verdict = expectedNetValue > 0 ? 'maybe' : 'skip';
  const signed = n => `${n < 0 ? '-' : '+'}$${formatMoney(Math.abs(n))}`;
  const analysis = `Using raw $${formatMoney(rawValue)}, estimated probability-weighted graded value $${formatMoney(expectedGradedValue)} and the $${PSA_FEE} grading fee, modeled expected net is ${signed(expectedNetValue)}. PSA 10 upside is ${signed(gradingUpside)}; graded prices and grade probability are estimates, not verified sales or guaranteed returns.`;
  const action = expectedNetValue > 0 ? 'Verify graded-sale estimates and physical condition before considering submission; a positive modeled return is not guaranteed.' : 'Keep raw for financial purposes; modeled expected proceeds do not exceed the raw value and grading fee.';
  return { rawValue, psa9Value, psa10Value, psa10Probability, psaFee: PSA_FEE, expectedGradedValue, expectedNetValue, gradingUpside, decisionConfidence, gemPredictScore, verdict, analysis, action };
}

// Negative check only. An old trusted flag is not enough to repair stale
// recommendations or PSA estimates that may have been clamped to a wrong raw.
export function consistentFinancialReport(report) {
  const prediction = report.prediction || report;
  const summary = report.marketData?.marketSummary;
  if (!(summary?.rawUsedCount > 0) || !(summary.rawMedian > 0) || !Number.isFinite(summary.rawMedian)) return false;
  if (prediction.financialBasis?.version !== 1 || prediction.financialBasis.rawSource !== 'selected_market_median' || prediction.financialBasis.rawMedian !== summary.rawMedian) return false;
  const expected = calculateGradingEconomics(prediction, summary.rawMedian);
  return Object.entries(expected).every(([key, value]) => prediction[key] === value);
}

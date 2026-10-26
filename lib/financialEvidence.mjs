import { analyzeCompletedSales, validEvidenceDate, exactEvidenceIdentity } from './completedSales.mjs';
import { calculateGradingEconomics, money } from './gradingEconomics.mjs';
import { analyzePopulation, unavailablePopulation } from './gradingPopulation.mjs';
export const PROVISIONAL_ACTION = 'Provisional analysis only. Qualified completed sales and defensible grade probabilities are required before an actionable grading recommendation.';
export function financialEvidence(payload, { now = Date.now() } = {}) {
  const sales = analyzeCompletedSales(payload.completedSales, payload.canonicalCard, { now });
  const raw = sales.groups.raw, nine = sales.groups['PSA 9'], ten = sales.groups['PSA 10'];
  const asking = payload.marketData?.marketSummary;
  const baseline = raw?.median ?? (asking?.rawUsedCount > 0 && Number.isFinite(asking.rawMedian) && asking.rawMedian > 0 ? asking.rawMedian : null);
  const source = raw ? 'completed_sales' : baseline != null ? 'active_asking_price_listings' : 'unavailable';
  const model = payload.prediction || payload;
  // Never clamp observed PSA transactions to the raw price or to each other.
  // Inconsistent model scenarios can still use the existing economics helper;
  // actual sales must preserve their values even when grading loses money.
  const inputs = { ...model, psa9Value: nine?.median ?? model.psa9Value, psa10Value: ten?.median ?? model.psa10Value };
  const population = payload.populationRecord ? analyzePopulation(payload.populationRecord, payload.canonicalCard, { now }) : unavailablePopulation();
  let projection = baseline == null ? null : calculateGradingEconomics(inputs, baseline);
  if (projection) {
    const psa9Value = nine?.median ?? projection.psa9Value, psa10Value = ten?.median ?? projection.psa10Value;
    const p = projection.psa10Probability/100;
    projection = { ...projection, psa9Value, psa10Value, expectedGradedValue: money(psa10Value*p+psa9Value*(1-p)), expectedNetValue: money(psa10Value*p+psa9Value*(1-p)-baseline-projection.psaFee), gradingUpside: money(psa10Value-baseline-projection.psaFee) };
  }
  const allQualified = !sales.truncated && [raw,nine,ten].every(group => group?.qualified === true);
  const probability = payload.probabilityEvidence;
  const probabilityQualified = probability?.kind === 'calibrated_model' && probability.status === 'validated' && typeof probability.reference === 'string' && probability.reference.trim() && validEvidenceDate(probability.observedAt,now) && now-Date.parse(probability.observedAt) <= 90*86400000 && exactEvidenceIdentity(payload.canonicalCard,probability.identity) && [probability.lowerPercent,probability.valuePercent,probability.upperPercent].every(n => Number.isFinite(n) && n>=0 && n<=100) && probability.lowerPercent <= probability.valuePercent && probability.valuePercent <= probability.upperPercent && probability.valuePercent === projection?.psa10Probability;
  const pLow = probabilityQualified ? probability.lowerPercent/100 : 0, pHigh = probabilityQualified ? probability.upperPercent/100 : 1;
  const nets = allQualified ? [pLow,pHigh].flatMap(p => [nine.low*(1-p)+ten.low*p-raw.high-80,nine.high*(1-p)+ten.high*p-raw.low-80]) : [];
  const netRange = nets.length ? { low: money(Math.min(...nets)), high: money(Math.max(...nets)), assumption: 'Observed sale ranges; two PSA outcomes; $80 fee; excludes shipping, marketplace fees, tax, turnaround and lower grades.' } : null;
  const blockedByCondition = payload.imageAnalysis?.worthGrading === false || payload.imageAnalysis?.visualSafetyFlags?.structuralDamage === true;
  const verdict = allQualified && netRange.high < 0 ? 'skip' : allQualified && probabilityQualified && !blockedByCondition && netRange.low > 0 ? 'grade' : 'provisional';
  const actionable = verdict !== 'provisional';
  if (projection) Object.assign(projection, { verdict, gemPredictScore: null, decisionConfidence: null,
    analysis: `${actionable ? 'Evidence-supported' : 'Provisional'} scenario: raw baseline $${baseline.toFixed(2)} (${source === 'completed_sales' ? 'observed completed sales' : 'active asking prices, not realized value'}); PSA 9 $${projection.psa9Value.toFixed(2)} (${nine ? 'observed sales' : 'modeled estimate'}), PSA 10 $${projection.psa10Value.toFixed(2)} (${ten ? 'observed sales' : 'modeled estimate'}). Probability ${projection.psa10Probability}% is ${probabilityQualified ? 'a calibrated model input' : 'an uncalibrated model estimate'}, not a population-derived forecast. Expected net $${projection.expectedNetValue.toFixed(2)} is conditional on the two-outcome model and $80 grading fee; other costs and lower grades are excluded.`,
    action: actionable ? (verdict==='skip' ? 'Qualified completed-sale evidence supports avoiding grading for financial purposes under the stated cost/outcome assumptions.' : 'Qualified sales and calibrated probability support considering grading under the stated assumptions; returns and grades are not guaranteed.') : PROVISIONAL_ACTION });
  return { version: 1, status: baseline == null ? 'unavailable' : actionable ? 'actionable' : 'provisional', actionable, verdict, rawSource: source, observedRaw: raw || null, observedAsking: asking?.rawUsedCount > 0 ? { median: asking.rawMedian, count: asking.rawUsedCount, confidence: asking.marketConfidence || 0, evidenceType: 'active_asking_price_listings' } : null,
    graded: { 'PSA 9': { source: nine ? 'completed_sales' : 'modeled_estimate', evidence: nine || null }, 'PSA 10': { source: ten ? 'completed_sales' : 'modeled_estimate', evidence: ten || null } },
    probability: { source: probabilityQualified ? 'calibrated_model' : 'modeled_estimate', valuePercent: projection?.psa10Probability ?? null, qualified: Boolean(probabilityQualified), historicalPopulationRateUsed: false },
    sales, population, netRange, projection,
    reasons: [...(!raw?.qualified ? ['insufficient_recent_raw_sales'] : []), ...(!nine?.qualified ? ['insufficient_recent_psa9_sales'] : []), ...(!ten?.qualified ? ['insufficient_recent_psa10_sales'] : []), ...(!probabilityQualified ? ['uncalibrated_individual_grade_probability'] : []), ...(blockedByCondition ? ['visible_condition_risk'] : []), ...(allQualified && !actionable ? ['outcome_not_robust_under_uncertainty'] : [])], evaluatedAt: new Date(now).toISOString() };
}
export const financialFields = ['rawValue','psa9Value','psa10Value','psa10Probability','psaFee','expectedGradedValue','expectedNetValue','gradingUpside','gemPredictScore','decisionConfidence','verdict','analysis','action'];
export function consistentEvidenceFinancials(report) {
  const model = report.prediction || report;
  if (model.financialBasis?.version !== 2) return false;
  const decision = financialEvidence({ ...report, prediction: model });
  return decision.projection && decision.rawSource === model.financialBasis.rawSource && decision.projection.rawValue === model.financialBasis.rawMedian && financialFields.every(key => model[key] === decision.projection[key]);
}

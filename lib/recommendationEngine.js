// The financial verdict is finalized by the valuation boundary, not by Atlas.
export default function recommendationEngine({ prediction, valuationVerification } = {}) {
  const labels = { grade: 'Grade It', maybe: 'Consider It', skip: 'Skip It' };
  const verdict = prediction?.verdict;
  if (valuationVerification?.status !== 'trusted' || !labels[verdict] || !Number.isFinite(prediction?.expectedNetValue)) {
    return { action: 'verify', label: 'Valuation Withheld', priority: 'high', verdict: null, reason: 'A trusted finalized valuation is required.' };
  }
  return {
    action: verdict === 'grade' ? 'grade' : verdict === 'skip' ? 'skip' : 'review',
    label: labels[verdict], verdict,
    priority: verdict === 'maybe' ? 'medium' : 'high',
    reason: prediction.action,
    source: 'finalized_prediction',
  };
}

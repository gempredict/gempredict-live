export default function atlasDecisionEngine({ identityConfidence, marketEvidence, recommendation, prediction, imageAnalysis } = {}) {
  const blockers = [];
  const strengths = [];
  // Image completeness is a distinct diagnostic; no photo is not a failed scan.
  if (identityConfidence) {
    if (identityConfidence.score < 60) blockers.push('Visible image identifiers are limited; review the scan.');
    else strengths.push('Image identifiers are available; this is not independent identity verification.');
  }
  if (imageAnalysis?.worthGrading === false) blockers.push(imageAnalysis.worthGradingReason || 'Visible condition raises grading risk; inspect the card before submission.');
  if (marketEvidence?.evidenceType === 'verified_completed_transactions') strengths.push('Qualified independently matched completed raw sales support the conditional analysis.');
  else if (marketEvidence?.confidence < 50) blockers.push('The selected asking-price sample has limited price reliability.');
  else strengths.push('The selected raw asking-price pool supports the reported market estimate.');
  if (Number.isFinite(prediction?.expectedNetValue)) {
    if (prediction.expectedNetValue <= 0) blockers.push('Modeled expected net does not exceed the raw value and grading fee.');
    else strengths.push('Modeled expected net is positive; graded prices and probability remain estimates.');
  }
  return {
    decision: recommendation?.verdict || 'review',
    label: recommendation?.label || 'Valuation Withheld',
    blockers, strengths,
    source: 'finalized_prediction',
  };
}

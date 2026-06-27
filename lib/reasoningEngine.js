export function buildGemPredictReasoning(report) {
  if (!report) return null;

  const card = report.canonicalCard || null;
  const market = report.marketData?.marketSummary || null;
  const image = report.imageAnalysis || null;

  const identityReason =
    card && card.displayName
      ? `Identified as ${card.displayName}${card.confidence != null ? ` with ${card.confidence}% confidence` : ""}.`
      : "Card identity could not be confidently determined.";

  const marketReason =
    market && market.rawComparableCount > 0
      ? `Market value is based on ${market.rawUsedCount || 0} of ${market.rawComparableCount || 0} comparable listings, with ${market.rawOutlierCount || 0} outliers removed.`
      : "Market comps were not found or confidence was too low.";

  const conditionReason =
    image
      ? `Photo analysis estimates ${image.mostLikelyGradeRange || image.estimatedGrade || "an uncertain grade range"} with ${image.confidenceLevel || "moderate"} image confidence.`
      : "No photo condition analysis was available.";

  const roiReason =
    report.expectedNetValue != null
      ? `Expected net is ${report.expectedNetValue >= 0 ? "+$" : "-$"}${Math.abs(report.expectedNetValue)} after estimated raw value and grading cost.`
      : "ROI could not be fully calculated.";

  return {
    identityReason,
    marketReason,
    conditionReason,
    roiReason,
  };
}
export default function atlasEvidenceEngine({
    imageAnalysis,
    canonicalCard,
    identityConfidence,
    marketEvidence,
  } = {}) {
    const evidence = [];
  
    if (canonicalCard?.subject) {
      evidence.push({
        category: "Identity",
        strength: "high",
        message: `Subject identified as ${canonicalCard.subject}.`,
      });
    }
  
    if (canonicalCard?.cardNumber) {
      evidence.push({
        category: "Identity",
        strength: "high",
        message: `Collector number ${canonicalCard.cardNumber} identified.`,
      });
    }
  
    if (canonicalCard?.parallel) {
      evidence.push({
        category: "Identity",
        strength: "medium",
        message: `Parallel identified as ${canonicalCard.parallel}.`,
      });
    }
  
    if (identityConfidence?.score >= 90) {
      evidence.push({
        category: "Confidence",
        strength: "high",
        message: "Atlas has very high confidence in the card identity.",
      });
    }
  
    if (marketEvidence?.comparableCount > 10) {
      evidence.push({
        category: "Market",
        strength: "high",
        message: `${marketEvidence.comparableCount} comparable listings support valuation.`,
      });
    }
  
    if (imageAnalysis?.worthGrading) {
      evidence.push({
        category: "Condition",
        strength: "medium",
        message: imageAnalysis.worthGradingReason,
      });
    }
  
    return evidence;
  }
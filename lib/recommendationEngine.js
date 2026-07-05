export default function recommendationEngine({
    score,
    identityConfidence,
    marketEvidence,
    imageAnalysis,
    prediction,
  } = {}) {
    const gpScore = score?.score || 0;
    const identityScore = identityConfidence?.score || 0;
    const marketScore = marketEvidence?.confidence || 0;
    const worthGrading = imageAnalysis?.worthGrading;
    const verdict = prediction?.verdict || "maybe";
  
    if (identityScore > 0 && identityScore < 60) {
      return {
        action: "verify_identity",
        label: "Verify Identity First",
        priority: "high",
        reason: "GemPredict does not have enough identity confidence to recommend grading yet.",
      };
    }
  
    if (marketScore > 0 && marketScore < 50) {
      return {
        action: "verify_market",
        label: "Verify Market First",
        priority: "medium",
        reason: "Comparable sales are limited, so grading ROI should be double-checked.",
      };
    }
  
    if (worthGrading === false) {
      return {
        action: "keep_raw",
        label: "Keep Raw",
        priority: "high",
        reason: imageAnalysis?.worthGradingReason || "Visible condition risk makes grading unattractive.",
      };
    }
  
    if (gpScore >= 90 || verdict === "grade") {
      return {
        action: "grade",
        label: "Grade Candidate",
        priority: "high",
        reason: "The card shows strong grading upside based on current score, market, and condition signals.",
      };
    }
  
    if (gpScore >= 70 || verdict === "maybe") {
      return {
        action: "review",
        label: "Review Before Grading",
        priority: "medium",
        reason: "The card has potential, but identity, market, or condition risk should be reviewed first.",
      };
    }
  
    return {
      action: "skip",
      label: "Skip Grading",
      priority: "low",
      reason: "The current signals do not support a strong grading opportunity.",
    };
  }
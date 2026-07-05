export default function atlasExplainDecision({
    identityConfidence,
    marketEvidence,
    recommendation,
    decision,
  } = {}) {
    const explanations = [];
  
    if (identityConfidence?.score >= 90) {
      explanations.push("High confidence card identification.");
    } else if (identityConfidence?.score >= 70) {
      explanations.push("Card identity appears reliable.");
    } else {
      explanations.push("Card identity should be verified.");
    }
  
    if (marketEvidence?.confidence >= 70) {
      explanations.push("Comparable market data is strong.");
    } else {
      explanations.push("Market evidence is limited.");
    }
  
    if (recommendation?.label) {
      explanations.push(`Recommendation: ${recommendation.label}.`);
    }
  
    if (decision?.label) {
      explanations.push(`Final Atlas decision: ${decision.label}.`);
    }
  
    return explanations;
  }
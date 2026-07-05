export default function atlasDecisionEngine({
    identityConfidence,
    marketEvidence,
    recommendation,
    score,
  } = {}) {
    const identityScore = identityConfidence?.score || 0;
    const marketScore = marketEvidence?.confidence || 0;
    const gemScore = score?.score || 0;
    const action = recommendation?.action || "review";
  
    const blockers = [];
    const strengths = [];
  
    if (identityScore < 60) blockers.push("Identity confidence is too low");
    else strengths.push("Identity confidence is acceptable");
  
    if (marketScore < 50) blockers.push("Market evidence is limited");
    else strengths.push("Market evidence supports the analysis");
  
    if (gemScore >= 80) strengths.push("GemPredict Score is strong");
    if (action === "keep_raw" || action === "skip") blockers.push("Recommendation does not support grading");
  
    const decision =
      blockers.length > 0 ? "review" :
      gemScore >= 90 ? "grade" :
      gemScore >= 70 ? "consider" :
      "skip";
  
    const label =
      decision === "grade" ? "Grade Candidate" :
      decision === "consider" ? "Worth Considering" :
      decision === "skip" ? "Skip Grading" :
      "Needs Review";
  
    return {
      decision,
      label,
      blockers,
      strengths,
    };
  }
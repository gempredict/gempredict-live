import buildSearchCandidates from "./buildSearchCandidates";
import calculateIdentityConfidence from "./calculateIdentityConfidence";
import marketEvidenceEngine from "./marketEvidenceEngine";
import recommendationEngine from "./recommendationEngine";
import atlasDecisionEngine from "./atlasDecisionEngine";
import atlasReportBuilder from "./atlasReportBuilder";
import atlasEvidenceEngine from "./atlasEvidenceEngine";
import atlasGradeExplanation from "./atlasGradeExplanation";
import atlasVersion from "./atlasVersion";

export default function atlasOrchestrator({
  imageAnalysis = null,
  canonicalCard = null,
  marketData = null,
  gpScore = null,
  prediction = null,
} = {}) {
  const searchCandidates = buildSearchCandidates(imageAnalysis || {});

  const identityConfidence = calculateIdentityConfidence(imageAnalysis || {});

  const marketEvidence = marketEvidenceEngine(marketData || {});

  const recommendation = recommendationEngine({
    score: gpScore,
    identityConfidence,
    marketEvidence,
    imageAnalysis,
    prediction,
  });

  const decision = atlasDecisionEngine({
    identityConfidence,
    marketEvidence,
    recommendation,
    score: gpScore,
  });

  const evidence = atlasEvidenceEngine({
    imageAnalysis,
    canonicalCard,
    identityConfidence,
    marketEvidence,
  });

  const explanation = atlasGradeExplanation(imageAnalysis || {});

  const report = atlasReportBuilder({
    canonicalCard,
    identityConfidence,
    marketEvidence,
    score: gpScore,
    recommendation,
    decision,
  });

  return {
    atlas: atlasVersion,

    searchCandidates,
    identityConfidence,
    marketEvidence,
    recommendation,
    decision,
    evidence,
    explanation,
    report,
};
}
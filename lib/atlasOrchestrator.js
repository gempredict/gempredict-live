import calculateIdentityConfidence from "./calculateIdentityConfidence";
import marketEvidenceEngine from "./marketEvidenceEngine";
import recommendationEngine from "./recommendationEngine";
import atlasDecisionEngine from "./atlasDecisionEngine";
import atlasReportBuilder from "./atlasReportBuilder";
import atlasEvidenceEngine from "./atlasEvidenceEngine";
import atlasGradeExplanation from "./atlasGradeExplanation";
import atlasVersion from "./atlasVersion";
import { isValuationTrusted } from "./valuationProtection.mjs";

export default function atlasOrchestrator(input = {}) {
  const { imageAnalysis = null, canonicalCard = null, marketData = null, gpScore = null, prediction = null,
    identityVerification = null, variantVerification = null, valuationVerification = null } = input;
  if (!isValuationTrusted(input) || !['verified', 'corrected', 'user_confirmed'].includes(variantVerification?.status)) return null;

  const identityConfidence = imageAnalysis ? calculateIdentityConfidence(imageAnalysis) : null;
  const marketEvidence = marketEvidenceEngine(marketData);
  const recommendation = recommendationEngine({ prediction, valuationVerification });
  const decision = atlasDecisionEngine({ identityConfidence, marketEvidence, recommendation, prediction, imageAnalysis });
  const evidence = atlasEvidenceEngine({ imageAnalysis, canonicalCard, identityConfidence, identityVerification, marketEvidence });
  const explanation = imageAnalysis ? atlasGradeExplanation(imageAnalysis) : null;
  const score = { ...gpScore, score: prediction.gemPredictScore };
  const report = atlasReportBuilder({ canonicalCard, identityConfidence, identityVerification, variantVerification, valuationVerification, marketEvidence, score, recommendation, decision, prediction });
  return {
    atlas: atlasVersion,
    searchCandidates: marketData.queryAttempts || [],
    identityConfidence, identityVerification, variantVerification, valuationVerification,
    gradingProbability: prediction.psa10Probability,
    marketEvidence, recommendation, decision, evidence, explanation, report,
  };
}

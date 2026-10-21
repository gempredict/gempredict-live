export default function atlasReportBuilder({
    canonicalCard,
    identityConfidence,
    identityVerification,
    variantVerification,
    valuationVerification,
    prediction,
    marketEvidence,
    score,
    recommendation,
    decision,
  } = {}) {
    return {
      identity: canonicalCard || null,
      confidence: identityConfidence || null,
      identityVerification: identityVerification || null,
      variantVerification: variantVerification || null,
      valuationVerification: valuationVerification || null,
      gradingProbability: prediction?.psa10Probability ?? null,
      market: marketEvidence || null,
      score: score || null,
      recommendation: recommendation || null,
      decision: decision || null,
      generatedAt: new Date().toISOString(),
      atlasVersion: "0.1",
    };
  }
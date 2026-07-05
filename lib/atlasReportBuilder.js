export default function atlasReportBuilder({
    canonicalCard,
    identityConfidence,
    marketEvidence,
    score,
    recommendation,
    decision,
  } = {}) {
    return {
      identity: canonicalCard || null,
      confidence: identityConfidence || null,
      market: marketEvidence || null,
      score: score || null,
      recommendation: recommendation || null,
      decision: decision || null,
      generatedAt: new Date().toISOString(),
      atlasVersion: "0.1",
    };
  }
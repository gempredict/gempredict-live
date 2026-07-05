export default function atlasConfidenceBreakdown({
    identityConfidence,
    marketEvidence,
  } = {}) {
    return [
      {
        category: "Identity",
        score: identityConfidence?.score || 0,
        level: identityConfidence?.level || "Unknown",
      },
      {
        category: "Market",
        score: marketEvidence?.confidence || 0,
        level: marketEvidence?.level || "Unknown",
      },
    ];
  }
export function buildGemPredictReport({
  prediction,
  canonicalCard,
  imageAnalysis,
  marketData,
  confidence,
  reasoning,
}) {
  return {
    // Core report
    prediction,

    // Canonical identity
    canonicalCard,

    // Image grading
    imageAnalysis,

    // Market intelligence
    marketData,

    // AI confidence
    confidence,

    // Explainability
    reasoning,

    // Metadata
    generatedAt: new Date().toISOString(),
    version: "2.0",
  };
}
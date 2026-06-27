export function buildIdentityConfidence(imageAnalysis) {
  if (!imageAnalysis) return null;

  const score = imageAnalysis.identityConfidence || 0;

  return {
    overall: score,

    subject:
      imageAnalysis.identifiedSubject
        ? Math.min(100, score + 5)
        : 0,

    set:
      imageAnalysis.identifiedBrandSet
        ? score
        : 0,

    cardNumber:
      imageAnalysis.identifiedCardNumber
        ? 100
        : 0,

    parallel:
      imageAnalysis.identifiedParallel
        ? Math.max(80, score - 5)
        : 0,

    language:
      imageAnalysis.identifiedLanguage
        ? 95
        : 60,
  };
}
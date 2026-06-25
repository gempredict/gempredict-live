export function buildCanonicalCardFromImageAnalysis(imageAnalysis, fallbackCardName, fallbackCardSet) {
  if (!imageAnalysis) return null;

  const subject = imageAnalysis.identifiedSubject || null;
  const year = imageAnalysis.identifiedYear || null;
  const brandSet = imageAnalysis.identifiedBrandSet || fallbackCardSet || null;
  const parallel = imageAnalysis.identifiedParallel || null;
  const cardNumber = imageAnalysis.identifiedCardNumber || null;
  const autoOrRelic = imageAnalysis.identifiedAutoOrRelic || "unknown";
  const confidence = imageAnalysis.identityConfidence || 0;

  const displayName = [
    year,
    brandSet,
    subject,
    parallel,
    cardNumber ? "#" + cardNumber : null,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    subject,
    year,
    brandSet,
    parallel,
    cardNumber,
    autoOrRelic,
    confidence,
    displayName: displayName || fallbackCardName || "Unknown Card",
    notes: imageAnalysis.identityNotes || null,
  };
}

export function buildMarketQueryFromCanonicalCard(card) {
  if (!card) return "";

  return [
    card.subject,
    card.cardNumber ? "#" + card.cardNumber : null,
    card.parallel,
    card.displayName,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
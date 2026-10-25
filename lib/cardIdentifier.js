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
    language: imageAnalysis.identifiedLanguage || null,
    confidence,
    displayName: displayName || fallbackCardName || "Unknown Card",
    notes: imageAnalysis.identityNotes || null,
  };
}

const cleanQueryPart = value => value == null || /^(unknown|null)$/i.test(String(value).trim()) ? "" : String(value).replace(/,/g, " ").replace(/\s+/g, " ").trim();

export function marketVariantKeywords(card = {}) {
  const parts = [cleanQueryPart(card.parallel)];
  if (!parts[0] && card.variant) {
    parts.push(card.variant.color, card.variant.treatment, card.variant.art, card.variant.finish);
    if (card.variant.kind === "base" && !card.variant.art) parts.push("Base");
  }
  const run = cleanQueryPart(card.printRun || card.variant?.printRun).replace(/^\//, "");
  if (run && ![...parts.join(" ").matchAll(/\/\s*(\d+)\b/g)].some(match => match[1] === run)) parts.push("/" + run);
  const features = cleanQueryPart(card.autoOrRelic);
  const combined = parts.join(" ");
  if ((/\b(?:auto|autograph|autographed)\b/i.test(features) || card.variant?.autograph === true) && !/\b(?:auto|autograph|autographed)\b/i.test(combined)) parts.push("Autograph");
  if ((/\b(?:relic|patch|memorabilia)\b/i.test(features) || card.variant?.relic === true) && !/\b(?:relic|patch|memorabilia)\b/i.test(combined)) parts.push("Relic");
  return parts.map(cleanQueryPart).filter(Boolean).join(" ").trim();
}

// Use identity fields once; displayName already contains these and must not be
// appended again. Options broaden retrieval only, never the matching identity.
export function buildMarketQueryFromCanonicalCard(card, { withHash = true, includeYear = true, includeSet = true, includeVariant = true, setOverride } = {}) {
  if (!card || !cleanQueryPart(card.subject)) return "";
  const number = cleanQueryPart(card.cardNumber).replace(/^#\s*/, "");
  const parts = [
    includeYear ? card.year : null,
    includeSet ? (setOverride ?? card.brandSet) : null,
    card.subject,
    number && ((withHash ? "#" : "") + number),
    includeVariant ? marketVariantKeywords(card) : null,
  ].map(cleanQueryPart).filter(Boolean);
  return [...new Map(parts.map(part => [part.toLowerCase(), part])).values()].join(" ").trim();
}

// Deterministic identity checks; no external catalog is connected yet.
// AI-reported fields are observations, not proof that the card exists as named.
function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function assessIdentityEvidence(imageAnalysis, supplied = {}) {
  if (!imageAnalysis || typeof imageAnalysis !== "object") {
    return { status: "unverified", verified: false, contradictions: [], missing: ["photo analysis"], note: "Photo identity could not be established." };
  }
  const subject = clean(imageAnalysis.identifiedSubject);
  const number = clean(imageAnalysis.identifiedCardNumber);
  const set = clean(imageAnalysis.identifiedBrandSet);
  const year = clean(imageAnalysis.identifiedYear);
  const parallel = clean(imageAnalysis.identifiedParallel);
  const userName = clean(supplied.cardName);
  const userSet = clean(supplied.cardSet);
  const contradictions = [];
  // A supplied set is a user assertion, so conflicting AI output deserves review.
  if (userSet && set && userSet.toLowerCase() !== set.toLowerCase()) {
    contradictions.push("Supplied set differs from the visually inferred set.");
  }
  // Do not assume matching collector numbers imply identical artwork or variations.
  const missing = [];
  if (!subject) missing.push("subject");
  if (!set) missing.push("set");
  if (!number) missing.push("collector number");
  if (!year) missing.push("year");
  if (!parallel) missing.push("variation / treatment");
  const candidatesComplete = Boolean(subject && set && number);
  return {
    status: contradictions.length ? "conflicting" : "unverified",
    verified: false, // Only an independent catalog match can set this to true.
    contradictions,
    missing,
    observed: { subject: subject || null, set: set || null, number: number || null, year: year || null, parallel: parallel || null },
    supplied: { cardName: userName || null, cardSet: userSet || null },
    candidatesComplete,
    note: contradictions.length
      ? "Card identification has conflicting evidence; confirm identity before trusting pricing."
      : candidatesComplete
        ? "Photo fields are provisional until verified against a catalog and card artwork."
        : "Card identity is incomplete; a collector number alone cannot verify a card."
  };
}

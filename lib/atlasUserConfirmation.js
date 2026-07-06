export default function atlasUserConfirmation({
    recognitionConfidence = null,
    conflicts = null,
  } = {}) {
    const score = recognitionConfidence?.score || 0;
    const status = recognitionConfidence?.status || "unable_to_identify";
    const hasConflicts = !!conflicts?.hasConflicts;
  
    const requiresConfirmation =
      hasConflicts ||
      status === "needs_verification" ||
      status === "unable_to_identify" ||
      score < 80;
  
    return {
      stage: "user_confirmation",
      requiresConfirmation,
      reason: buildReason({ score, status, hasConflicts }),
      suggestedAction: requiresConfirmation
        ? "Ask the user to confirm the card identity before valuation."
        : "Proceed without user confirmation.",
    };
  }
  
  function buildReason({ score, status, hasConflicts }) {
    if (hasConflicts) return "Recognition evidence contains conflicting claims.";
    if (status === "unable_to_identify") return "Atlas could not identify the card with enough evidence.";
    if (status === "needs_verification") return "Atlas needs user verification before proceeding.";
    if (score < 80) return "Recognition confidence is below the safe threshold.";
    return "Recognition confidence is sufficient.";
  }
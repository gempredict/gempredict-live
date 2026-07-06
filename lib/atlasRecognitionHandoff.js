export default function atlasRecognitionHandoff({
  recognitionConfidence = null,
  userConfirmation = null,
  conflicts = null,
} = {}) {
  const topCandidate = recognitionConfidence?.topCandidate || null;
  const requiresConfirmation =
    userConfirmation?.requiresConfirmation || false;

  return {
    stage: "recognition_handoff",
    readyForAtlas: !!topCandidate && !requiresConfirmation,
    identityStatus: recognitionConfidence?.status || "unable_to_identify",
    recognitionConfidence: recognitionConfidence?.score || 0,
    selectedCandidate: topCandidate,
    conflicts: conflicts?.conflicts || [],
    requiresUserConfirmation: requiresConfirmation,
    nextStep: requiresConfirmation
      ? "Confirm identity before valuation."
      : "Proceed to Atlas valuation and recommendation.",
  };
}
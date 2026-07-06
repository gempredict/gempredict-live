export default function atlasRecognitionHealthCheck(recognition = {}) {
    const warnings = [];
    const blockers = [];
  
    if (!recognition.imageIntake?.frontImageAvailable) {
      blockers.push("Missing front image.");
    }
  
    if (!recognition.imageNormalization?.readyForRecognition) {
      blockers.push("Image is not ready for recognition.");
    }
  
    if ((recognition.evidence?.length || 0) === 0) {
      blockers.push("No recognition evidence available.");
    }
  
    if ((recognition.candidateGeneration?.candidateCount || 0) === 0) {
      blockers.push("No recognition candidates generated.");
    }
  
    if (recognition.conflicts?.hasConflicts) {
      warnings.push("Recognition evidence has conflicts.");
    }
  
    if (recognition.userConfirmation?.requiresConfirmation) {
      warnings.push("User confirmation required before valuation.");
    }
  
    return {
      stage: "recognition_health_check",
      healthy: blockers.length === 0,
      usable: blockers.length === 0 && !recognition.userConfirmation?.requiresConfirmation,
      blockers,
      warnings,
    };
  }
export default function atlasRecognitionDebugSnapshot(recognition = {}) {
    return {
      stage: recognition.stage || "unknown",
  
      image: {
        frontAvailable: recognition.imageIntake?.frontImageAvailable || false,
        backAvailable: recognition.imageIntake?.backImageAvailable || false,
        frontType: recognition.imageIntake?.frontImageType || null,
        frontSizeBytes: recognition.imageIntake?.frontSizeBytes || 0,
        warnings: recognition.imageIntake?.warnings || [],
      },
  
      normalization: {
        ready: recognition.imageNormalization?.readyForRecognition || false,
        qualityFlags: recognition.imageNormalization?.qualityFlags || [],
        recommendations: recognition.imageNormalization?.recommendations || [],
      },
  
      evidence: {
        total: recognition.evidence?.length || 0,
        ocr: recognition.ocr?.evidence?.length || 0,
        vision: recognition.vision?.evidence?.length || 0,
      },
  
      candidates: {
        count: recognition.candidateGeneration?.candidateCount || 0,
        top:
          recognition.recognitionConfidence?.topCandidate?.displayName ||
          null,
        topEbayEvidence:
          recognition.recognitionConfidence?.topCandidate?.validation
            ?.ebayIdentity?.evidence?.length || 0,
      },
  
      confidence: {
        score: recognition.recognitionConfidence?.score || 0,
        level: recognition.recognitionConfidence?.level || "Unknown",
        status: recognition.recognitionConfidence?.status || "unable_to_identify",
        reasons: recognition.recognitionConfidence?.reasons || [],
      },
  
      conflicts: {
        count: recognition.conflicts?.conflictCount || 0,
        hasConflicts: recognition.conflicts?.hasConflicts || false,
      },
  
      handoff: {
        readyForAtlas: recognition.handoff?.readyForAtlas || false,
        nextStep: recognition.handoff?.nextStep || null,
      },
    };
  }
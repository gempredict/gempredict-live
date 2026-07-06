import atlasImageIntake from "./atlasImageIntake";
import atlasImageNormalization from "./atlasImageNormalization";
import atlasOcrEvidence from "./atlasOcrEvidence";
import atlasVisionEvidence from "./atlasVisionEvidence";
import atlasRecognitionCandidates from "./atlasRecognitionCandidates";
import atlasCandidateValidation from "./atlasCandidateValidation";
import atlasRecognitionConfidence from "./atlasRecognitionConfidence";
import atlasRecognitionConflicts from "./atlasRecognitionConflicts";
import atlasUserConfirmation from "./atlasUserConfirmation";
import atlasRecognitionHandoff from "./atlasRecognitionHandoff";

export default function atlasRecognitionOrchestrator({
  imageBuffer = null,
  imageMimeType = null,
  backImageBuffer = null,
  backImageMimeType = null,
  imageAnalysis = null,
  ocrText = "",
  userInput = {},
  marketData = null,
} = {}) {
  const imageIntake = atlasImageIntake({
    imageBuffer,
    imageMimeType,
    backImageBuffer,
    backImageMimeType,
  });

  const imageNormalization = atlasImageNormalization(imageIntake);

  const ocr = atlasOcrEvidence({
    ocrText,
  });

  const vision = atlasVisionEvidence({
    imageAnalysis,
  });

  const evidence = [
    ...ocr.evidence,
    ...vision.evidence,
  ];

  const candidateGeneration = atlasRecognitionCandidates({
    ocrEvidence: ocr.evidence,
    visionEvidence: vision.evidence,
    userInput,
  });

  const candidateValidation = atlasCandidateValidation({
    candidates: candidateGeneration.candidates,
    marketData,
  });

  const recognitionConfidence = atlasRecognitionConfidence({
    candidates: candidateValidation.validatedCandidates,
    evidence,
  });

  const conflicts = atlasRecognitionConflicts(evidence);

  const userConfirmation = atlasUserConfirmation({
    recognitionConfidence,
    conflicts,
  });

  const handoff = atlasRecognitionHandoff({
    recognitionConfidence,
    userConfirmation,
    conflicts,
  });

  return {
    stage: "recognition_orchestrator",
    imageIntake,
    imageNormalization,
    ocr,
    vision,
    evidence,
    candidateGeneration,
    candidateValidation,
    recognitionConfidence,
    conflicts,
    userConfirmation,
    handoff,
  };
}
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
import atlasRecognitionDebugSnapshot from "./atlasRecognitionDebugSnapshot";
import atlasRecognitionHealthCheck from "./atlasRecognitionHealthCheck";
import atlasRecognitionProviderManager from "./atlasRecognitionProviderManager";

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

  const providerManager = atlasRecognitionProviderManager({
    imageAnalysis,
    ocrText,
  });
  
  const ocr =
    providerManager.providerResults.find(function (item) {
      return item.provider === "ocr";
    })?.result || { evidence: [] };
  
  const vision =
    providerManager.providerResults.find(function (item) {
      return item.provider === "vision";
    })?.result || { evidence: [] };
  
  const evidence = providerManager.evidence;

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

  const recognitionResult = {
    stage: "recognition_orchestrator",
    imageIntake,
    imageNormalization,
    providerManager,
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
  
  const debug = atlasRecognitionDebugSnapshot(recognitionResult);
  const health = atlasRecognitionHealthCheck(recognitionResult);

  return {
    ...recognitionResult,
    debug,
    health,
  };
}

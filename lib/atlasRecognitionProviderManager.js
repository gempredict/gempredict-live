import atlasVisionEvidence from "./atlasVisionEvidence";
import atlasOcrEvidence from "./atlasOcrEvidence";

export default function atlasRecognitionProviderManager({
  imageAnalysis = null,
  ocrText = "",
  enabledProviders = null,
mode = "standard",
} = {}) {
    const providersToRun =
    enabledProviders ||
    selectProvidersForMode(mode, {
      hasBackImage: !!imageAnalysis,
      identityConfidence:
        imageAnalysis?.identityConfidence || 0,
      userProvidedCardName: false,
    });

  const providerResults = [];

  if (providersToRun.includes("vision")) {
    providerResults.push({
      provider: "vision",
      result: atlasVisionEvidence({
        imageAnalysis,
        provider: "claude_vision",
      }),
    });
  }

  if (providersToRun.includes("ocr")) {
    providerResults.push({
      provider: "ocr",
      result: atlasOcrEvidence({
        ocrText,
        provider: "ocr_stub",
      }),
    });
  }

  const evidence = providerResults.flatMap(function (item) {
    return item.result?.evidence || [];
  });

  const providerSummary = providerResults.map(function (item) {
    return {
      provider: item.provider,
      ready: !!item.result?.ready,
      evidenceCount: item.result?.evidence?.length || 0,
      confidence: item.result?.confidence || 0,
    };
  });

  return {
    stage: "recognition_provider_manager",
    enabledProviders: providersToRun,
    mode,
    providerResults,
    providerSummary,
    evidence,
    evidenceCount: evidence.length,
    ready: evidence.length > 0,
  };

  function selectProvidersForMode(mode, context = {}) {
    const {
      hasBackImage = false,
      identityConfidence = 0,
      userProvidedCardName = false,
    } = context;
  
    if (mode === "cheap") {
      return ["vision"];
    }
  
    if (mode === "full") {
      return ["vision", "ocr"];
    }
  
    // Adaptive mode
  
    if (identityConfidence >= 90) {
      return ["vision"];
    }
  
    if (userProvidedCardName) {
      return ["vision", "ocr"];
    }
  
    if (hasBackImage) {
      return ["vision", "ocr"];
    }
  
    return ["vision", "ocr"];
 }
}

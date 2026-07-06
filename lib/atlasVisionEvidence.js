export default function atlasVisionEvidence({
    imageAnalysis = null,
    provider = "claude_vision",
  } = {}) {
    const evidence = [];
  
    addEvidence(evidence, provider, "identity.subject", imageAnalysis?.identifiedSubject, imageAnalysis?.identityConfidence || 70);
    addEvidence(evidence, provider, "identity.franchise", imageAnalysis?.identifiedFranchise, 70);
    addEvidence(evidence, provider, "identity.manufacturer", imageAnalysis?.identifiedManufacturer, 65);
    addEvidence(evidence, provider, "identity.set", imageAnalysis?.identifiedBrandSet, 60);
    addEvidence(evidence, provider, "identity.cardNumber", imageAnalysis?.identifiedCardNumber, 60);
    addEvidence(evidence, provider, "identity.parallel", imageAnalysis?.identifiedParallel, 55);
    addEvidence(evidence, provider, "identity.language", imageAnalysis?.identifiedLanguage, 65);
    addEvidence(evidence, provider, "identity.year", imageAnalysis?.identifiedYear, 60);
  
    return {
      stage: "vision_evidence",
      provider,
      evidence,
      confidence: evidence.length > 0 ? averageConfidence(evidence) : 0,
      ready: evidence.length > 0,
    };
  }
  
  function addEvidence(list, source, type, claim, confidence) {
    if (!claim) return;
  
    const text = String(claim).trim();
    if (!text || text.toLowerCase() === "unknown" || text.toLowerCase() === "null") return;
  
    list.push({
      source,
      type,
      claim: text,
      confidence,
    });
  }
  
  function averageConfidence(evidence) {
    if (!evidence.length) return 0;
  
    const total = evidence.reduce(function(sum, item) {
      return sum + (item.confidence || 0);
    }, 0);
  
    return Math.round(total / evidence.length);
  }
export default function atlasOcrEvidence({
    ocrText = "",
    provider = "ocr_stub",
  } = {}) {
    const evidence = [];
  
    const cleanText = String(ocrText || "").trim();
  
    if (!cleanText) {
      return {
        stage: "ocr_evidence",
        provider,
        evidence,
        extractedText: "",
        confidence: 0,
        ready: false,
      };
    }
  
    const cardNumber = extractCardNumber(cleanText);
  
    if (cardNumber) {
      evidence.push({
        source: provider,
        type: "identity.cardNumber",
        claim: cardNumber,
        confidence: 90,
        metadata: {
          rawText: cleanText,
        },
      });
    }
  
    return {
      stage: "ocr_evidence",
      provider,
      evidence,
      extractedText: cleanText,
      confidence: evidence.length > 0 ? 70 : 30,
      ready: evidence.length > 0,
    };
  }
  
  function extractCardNumber(text) {
    const match = text.match(/\b\d{1,4}\s*\/\s*\d{1,4}\b/);
    return match ? match[0].replace(/\s+/g, "") : null;
  }
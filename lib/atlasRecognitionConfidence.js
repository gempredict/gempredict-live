export default function atlasRecognitionConfidence({
    candidates = [],
    evidence = [],
  } = {}) {
    const topCandidate = safeArray(candidates)[0] || null;
    const allEvidence = safeArray(evidence);
  
    let score = 0;
    const reasons = [];
  
    if (!topCandidate) {
      return {
        stage: "recognition_confidence",
        score: 0,
        level: "Unknown",
        status: "unable_to_identify",
        reasons: ["No recognition candidate available."],
        topCandidate: null,
      };
    }
  
    if (topCandidate.subject) {
      score += 25;
      reasons.push("Subject identified.");
    }
  
    if (topCandidate.cardNumber) {
      score += 30;
      reasons.push("Card number identified.");
    }
  
    if (topCandidate.set) {
      score += 15;
      reasons.push("Set identified.");
    }
  
    if (topCandidate.parallel) {
      score += 10;
      reasons.push("Parallel identified.");
    }
  
    if (topCandidate.validation?.marketSupportsCandidate) {
      score += topCandidate.validation.confidenceBoost || 10;
      reasons.push("Market validation supports candidate.");
    }
  
    if (allEvidence.length >= 4) {
      score += 10;
      reasons.push("Multiple evidence points available.");
    }
  
    score = Math.min(100, score);
  
    let level = "Unknown";
    let status = "unable_to_identify";
  
    if (score >= 95) {
      level = "Confirmed";
      status = "confirmed_identity";
    } else if (score >= 80) {
      level = "Likely";
      status = "likely_identity";
    } else if (score >= 60) {
      level = "Needs Verification";
      status = "needs_verification";
    }
  
    return {
      stage: "recognition_confidence",
      score,
      level,
      status,
      reasons,
      topCandidate,
    };
  }
  
  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }
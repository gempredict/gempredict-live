/*
Atlas Candidate Generator

Purpose:

Generate multiple plausible identities from available evidence.

Candidate generation should maximize recall.

Validation and confidence will maximize precision.

The generator should never assume the first candidate is correct.
*/

export default function atlasRecognitionCandidates({
    ocrEvidence = [],
    visionEvidence = [],
    userInput = {},
  } = {}) {
    const candidates = [];
  
    const allEvidence = [
      ...safeArray(ocrEvidence),
      ...safeArray(visionEvidence),
    ];
  
    const subject = bestClaim(allEvidence, "identity.subject") || userInput.cardName || null;
    const cardNumber = bestClaim(allEvidence, "identity.cardNumber") || null;
    const set = bestClaim(allEvidence, "identity.set") || userInput.cardSet || null;
    const parallel = bestClaim(allEvidence, "identity.parallel") || null;
    const franchise = bestClaim(allEvidence, "identity.franchise") || userInput.cardType || null;
    const manufacturer = bestClaim(allEvidence, "identity.manufacturer") || null;
    const year = bestClaim(allEvidence, "identity.year") || null;
    const language = bestClaim(allEvidence, "identity.language") || null;
  
    addCandidate(candidates, {
      subject,
      cardNumber,
      set,
      parallel,
      franchise,
      manufacturer,
      year,
      language,
      reason: "Best combined OCR and vision evidence.",
      evidence: allEvidence,
    });
  
    addCandidate(candidates, {
      subject,
      cardNumber,
      franchise,
      reason: "Subject plus card number.",
      evidence: filterEvidence(allEvidence, ["identity.subject", "identity.cardNumber"]),
    });
  
    addCandidate(candidates, {
      subject,
      set,
      parallel,
      reason: "Subject plus set and parallel.",
      evidence: filterEvidence(allEvidence, ["identity.subject", "identity.set", "identity.parallel"]),
    });

    candidates.sort(function(a, b) {
        return scoreCandidate(b) - scoreCandidate(a);
    });

 
    
    if (userInput.cardName || userInput.cardSet) {
      addCandidate(candidates, {
        subject: userInput.cardName || subject,
        set: userInput.cardSet || set,
        franchise,
        reason: "User supplied identity details.",
        evidence: [],
      });
    }
  
    return {
      stage: "recognition_candidates",
      candidates,
      candidateCount: candidates.length,
      ready: candidates.length > 0,
    };
  }
  
  function addCandidate(list, candidate) {
    const displayName = buildDisplayName(candidate);
    if (!displayName) return;
  
    if (list.some(function(existing) { return existing.displayName === displayName; })) {
      return;
    }
  
    list.push({
      candidateId: "candidate_" + (list.length + 1),
      displayName,
      subject: clean(candidate.subject),
      cardNumber: clean(candidate.cardNumber),
      set: clean(candidate.set),
      parallel: clean(candidate.parallel),
      franchise: clean(candidate.franchise),
      manufacturer: clean(candidate.manufacturer),
      year: clean(candidate.year),
      language: clean(candidate.language),
      reason: candidate.reason || "Generated from available evidence.",
      evidence: candidate.evidence || [],
    });
  }

  function scoreCandidate(candidate) {
    let score = 0;
  
    if (candidate.subject) score += 30;
    if (candidate.cardNumber) score += 35;
    if (candidate.set) score += 15;
    if (candidate.parallel) score += 10;
    if (candidate.year) score += 5;
    if (candidate.language) score += 5;
  
    return score;
  }
  
  function buildDisplayName(candidate) {
    return [
      candidate.year,
      candidate.set,
      candidate.subject,
      candidate.parallel,
      candidate.cardNumber ? "#" + candidate.cardNumber : null,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function bestClaim(evidence, type) {
    const matches = evidence
      .filter(function(item) { return item.type === type && item.claim; })
      .sort(function(a, b) { return (b.confidence || 0) - (a.confidence || 0); });
  
    return matches[0]?.claim || null;
  }
  
  function filterEvidence(evidence, types) {
    return evidence.filter(function(item) {
      return types.includes(item.type);
    });
  }
  
  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }
  
  function clean(value) {
    if (!value) return null;
    const text = String(value).trim();
    return text && text.toLowerCase() !== "unknown" ? text : null;
  }
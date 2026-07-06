export default function atlasRecognitionConflicts(evidence = []) {
    const conflicts = [];
  
    checkType(conflicts, evidence, "identity.subject");
    checkType(conflicts, evidence, "identity.cardNumber");
    checkType(conflicts, evidence, "identity.set");
    checkType(conflicts, evidence, "identity.parallel");
    checkType(conflicts, evidence, "identity.language");
    checkType(conflicts, evidence, "identity.year");
  
    return {
      stage: "recognition_conflicts",
      conflicts,
      conflictCount: conflicts.length,
      hasConflicts: conflicts.length > 0,
    };
  }
  
  function checkType(conflicts, evidence, type) {
    const claims = safeArray(evidence)
      .filter(function(item) {
        return item.type === type && item.claim;
      })
      .map(function(item) {
        return {
          claim: normalizeClaim(item.claim),
          source: item.source || "unknown",
          confidence: item.confidence || 0,
        };
      })
      .filter(function(item) {
        return item.claim;
      });
  
    const uniqueClaims = Array.from(new Set(claims.map(function(item) {
      return item.claim;
    })));
  
    if (uniqueClaims.length > 1) {
      conflicts.push({
        type,
        claims,
        message: "Multiple conflicting claims found for " + type + ".",
      });
    }
  }
  
  function normalizeClaim(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
  
  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }
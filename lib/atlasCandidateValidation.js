import atlasEbayIdentityEvidence from "./atlasEbayIdentityEvidence";

export default function atlasCandidateValidation({
    candidates = [],
    marketData = null,
  } = {}) {
    const validatedCandidates = safeArray(candidates).map(function(candidate) {
      const marketSummary = marketData?.marketSummary || {};
      const comparableCount =
        marketSummary.rawComparableCount ||
        marketSummary.comparableCount ||
        0;
  
      const marketSupportsCandidate =
        comparableCount > 0 &&
        marketData?.queryUsed &&
        candidate.displayName;
  
        const ebayIdentity = atlasEbayIdentityEvidence({
            marketData,
            candidate,
          });
        
        const ebayEvidenceCount = ebayIdentity.evidence?.length || 0;

        const confidenceBoost = marketSupportsCandidate
          ? Math.min(25, comparableCount) + ebayEvidenceCount * 5
          : ebayEvidenceCount * 5;

  
      return {
        ...candidate,   
        validation: {
           ebayIdentity,
          marketSupportsCandidate,
          comparableCount,
          queryUsed: marketData?.queryUsed || null,
          confidenceBoost,
          notes: marketSupportsCandidate
            ? "Market data supports this candidate."
            : "No market validation available for this candidate yet.",
        },
      };
    });
  
    return {
      stage: "candidate_validation",
      validatedCandidates,
      ready: validatedCandidates.length > 0,
    };
  }
  
  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }
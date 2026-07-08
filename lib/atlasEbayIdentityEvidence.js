export default function atlasEbayIdentityEvidence({
    marketData = null,
    candidate = null,
    provider = "ebay_identity",
  } = {}) {
    const evidence = [];
    const summary = marketData?.marketSummary || {};
    const queryUsed = marketData?.queryUsed || "";
  
    const comparableCount =
      summary.rawComparableCount ||
      summary.comparableCount ||
      0;
  
    if (!marketData || !marketData.success) {
      return {
        stage: "ebay_identity_evidence",
        provider,
        evidence,
        ready: false,
        comparableCount: 0,
        notes: "No successful eBay market data available.",
      };
    }
  
    if (candidate?.subject && queryContains(queryUsed, candidate.subject)) {
      evidence.push({
        source: provider,
        type: "identity.subject",
        claim: candidate.subject,
        confidence: 80,
        metadata: {
          queryUsed,
          comparableCount,
        },
      });
    }
  
    if (candidate?.cardNumber && queryContains(queryUsed, candidate.cardNumber)) {
      evidence.push({
        source: provider,
        type: "identity.cardNumber",
        claim: candidate.cardNumber,
        confidence: 85,
        metadata: {
          queryUsed,
          comparableCount,
        },
      });
    }
  
    if (candidate?.set && queryContains(queryUsed, candidate.set)) {
      evidence.push({
        source: provider,
        type: "identity.set",
        claim: candidate.set,
        confidence: 70,
        metadata: {
          queryUsed,
          comparableCount,
        },
      });
    }
  
    if (candidate?.parallel && queryContains(queryUsed, candidate.parallel)) {
      evidence.push({
        source: provider,
        type: "identity.parallel",
        claim: candidate.parallel,
        confidence: 70,
        metadata: {
          queryUsed,
          comparableCount,
        },
      });
    }
  
    return {
      stage: "ebay_identity_evidence",
      provider,
      evidence,
      ready: evidence.length > 0,
      comparableCount,
      notes:
        evidence.length > 0
          ? "eBay query supports parts of the candidate identity."
          : "eBay query did not strongly validate candidate identity fields.",
    };
  }
  
  function queryContains(query, value) {
    if (!query || !value) return false;
  
    return normalize(query).includes(normalize(value));
  }
  
  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[#:/()-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
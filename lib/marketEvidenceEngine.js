export default function marketEvidenceEngine(market = {}) {
    const summary = market.marketSummary || {};
  
    const comparableCount =
      summary.rawComparableCount ||
      summary.comparableCount ||
      0;
  
    const median =
      summary.rawMedian ||
      summary.median ||
      null;
  
    let confidence = 0;
    const reasons = [];
  
    if (comparableCount >= 20) {
      confidence += 45;
      reasons.push("Large number of comparable sales");
    } else if (comparableCount >= 10) {
      confidence += 35;
      reasons.push("Good number of comparable sales");
    } else if (comparableCount >= 5) {
      confidence += 20;
      reasons.push("Limited comparable sales");
    } else {
      reasons.push("Very few comparable sales");
    }
  
    if (median) {
      confidence += 25;
      reasons.push("Median market value established");
    }
  
    if (market.queryUsed) {
      confidence += 15;
      reasons.push("Search query validated");
    }
  
    if (market.queryAttempts) {
      confidence += 15;
      reasons.push("Multiple search strategies evaluated");
    }
  
    confidence = Math.min(confidence, 100);
  
    let level = "Low";
    if (confidence >= 85) level = "Very High";
    else if (confidence >= 70) level = "High";
    else if (confidence >= 50) level = "Moderate";
  
    return {
      confidence,
      level,
      comparableCount,
      reasons,
    };
  }
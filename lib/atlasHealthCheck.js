export default function atlasHealthCheck(report = {}) {
    const warnings = [];
  
    if (!report.identity) {
      warnings.push("Missing identity.");
    }
  
    if (!report.market) {
      warnings.push("Missing market evidence.");
    }
  
    if (!report.confidence) {
      warnings.push("Missing identity confidence.");
    }
  
    if (!report.score) {
      warnings.push("Missing GemPredict Score.");
    }
  
    if (!report.decision) {
      warnings.push("Missing Atlas decision.");
    }
  
    return {
      healthy: warnings.length === 0,
      warnings,
      warningCount: warnings.length,
    };
  }
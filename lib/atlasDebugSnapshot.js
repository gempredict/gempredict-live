export default function atlasDebugSnapshot(atlasReport = {}) {
    return {
      atlasVersion: atlasReport.atlasVersion || "unknown",
      generatedAt: atlasReport.generatedAt || null,
  
      identity: {
        displayName: atlasReport.identity?.displayName || null,
        subject: atlasReport.identity?.subject || null,
        set: atlasReport.identity?.brandSet || null,
        number: atlasReport.identity?.cardNumber || null,
        parallel: atlasReport.identity?.parallel || null,
        confidence: atlasReport.identity?.confidence || null,
      },
  
      confidence: {
        score: atlasReport.confidence?.score || 0,
        level: atlasReport.confidence?.level || "Unknown",
        reasons: atlasReport.confidence?.reasons || [],
      },
  
      market: {
        confidence: atlasReport.market?.confidence || 0,
        level: atlasReport.market?.level || "Unknown",
        comparableCount: atlasReport.market?.comparableCount || 0,
        reasons: atlasReport.market?.reasons || [],
      },
  
      score: {
        value: atlasReport.score?.score || 0,
        recommendation: atlasReport.score?.recommendation || null,
        stars: atlasReport.score?.stars || 0,
      },
  
      decision: {
        decision: atlasReport.decision?.decision || "review",
        label: atlasReport.decision?.label || "Needs Review",
        blockers: atlasReport.decision?.blockers || [],
        strengths: atlasReport.decision?.strengths || [],
      },
    };
  }
export default function atlasTelemetry(atlas = {}) {
    return {
      timestamp: new Date().toISOString(),
  
      version: atlas.atlas?.version || "unknown",
  
      identityScore:
        atlas.identityConfidence?.score ?? null,
  
      marketConfidence:
        atlas.marketEvidence?.confidence ?? null,
  
      decision:
        atlas.decision?.decision ?? null,
  
      recommendation:
        atlas.recommendation?.label ?? null,
    };
  }
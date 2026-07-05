export default function atlasGradeExplanation(imageAnalysis = {}) {
    const strengths = [];
    const limiters = [];
  
    check("Centering", imageAnalysis.centering, imageAnalysis.centeringNote);
    check("Corners", imageAnalysis.corners, imageAnalysis.cornersNote);
    check("Edges", imageAnalysis.edges, imageAnalysis.edgesNote);
    check("Surface", imageAnalysis.surface, imageAnalysis.surfaceNote);
  
    function check(name, rating, note) {
      if (!rating) return;
  
      if (rating === "excellent") {
        strengths.push(`${name}: ${note || "No significant visible issues."}`);
      } else {
        limiters.push(`${name}: ${note || "Potential grading limiter."}`);
      }
    }
  
    return {
      strengths,
      limiters,
      primaryLimiter:
        imageAnalysis.primaryLimiter ||
        imageAnalysis.majorGradeCap ||
        "No primary limiter identified.",
    };
  }
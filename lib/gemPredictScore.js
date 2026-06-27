export function buildGemPredictScore(report) {
    if (!report) return null;
  
    const expectedNet =
      report.expectedNetValue ||
      report.prediction?.expectedNetValue ||
      0;
  
    const psa10Prob =
      report.psa10Probability ||
      report.prediction?.psa10Probability ||
      0;
  
    const marketConfidence =
      report.marketData?.marketSummary?.marketConfidence || 0;
  
    const identityConfidence =
      report.canonicalCard?.confidence || 0;
  
    const imageScore =
      report.imageAnalysis?.overallScore || 0;
  
    const roiPoints =
      expectedNet >= 150 ? 35 :
      expectedNet >= 75 ? 30 :
      expectedNet >= 25 ? 24 :
      expectedNet >= 0 ? 18 :
      expectedNet >= -25 ? 10 : 4;
  
    const conditionPoints =
      imageScore >= 9 ? 25 :
      imageScore >= 8 ? 20 :
      imageScore >= 7 ? 14 :
      imageScore >= 6 ? 8 : 3;
  
    const marketPoints =
      marketConfidence >= 85 ? 15 :
      marketConfidence >= 70 ? 12 :
      marketConfidence >= 50 ? 8 : 3;
  
    const identityPoints =
      identityConfidence >= 90 ? 10 :
      identityConfidence >= 75 ? 8 :
      identityConfidence >= 50 ? 5 : 2;
  
    const probabilityPoints =
      psa10Prob >= 60 ? 15 :
      psa10Prob >= 40 ? 11 :
      psa10Prob >= 25 ? 7 : 3;
  
    const score = Math.max(
      1,
      Math.min(
        100,
        roiPoints +
        conditionPoints +
        marketPoints +
        identityPoints +
        probabilityPoints
      )
    );
  
    const stars =
      score >= 90 ? 5 :
      score >= 80 ? 4 :
      score >= 65 ? 3 :
      score >= 50 ? 2 : 1;
  
    const recommendation =
      score >= 90 ? "Elite Submission Candidate" :
      score >= 80 ? "Strong Grade Candidate" :
      score >= 65 ? "Worth Considering" :
      score >= 50 ? "Borderline Candidate" :
      "Keep Raw";
  
    return {
      score,
      stars,
      recommendation,
      breakdown: {
        roi: roiPoints,
        condition: conditionPoints,
        market: marketPoints,
        identity: identityPoints,
        probability: probabilityPoints,
      },
    };
  }
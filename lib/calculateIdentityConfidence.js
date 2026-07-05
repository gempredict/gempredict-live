export default function calculateIdentityConfidence(card = {}) {
    let score = 0;
    const reasons = [];
  
    if (exists(card.identifiedSubject)) {
      score += 30;
      reasons.push("Subject identified");
    }
  
    if (exists(card.identifiedBrandSet)) {
      score += 20;
      reasons.push("Set identified");
    }
  
    if (exists(card.identifiedCardNumber)) {
      score += 25;
      reasons.push("Collector number identified");
    }
  
    if (exists(card.identifiedParallel)) {
      score += 10;
      reasons.push("Parallel identified");
    }
  
    if (exists(card.identifiedManufacturer)) {
      score += 5;
      reasons.push("Manufacturer identified");
    }
  
    if (exists(card.identifiedLanguage)) {
      score += 5;
      reasons.push("Language identified");
    }
  
    if (exists(card.identifiedYear)) {
      score += 5;
      reasons.push("Year identified");
    }
  
    score = Math.min(score, 100);
  
    let level = "Low";
    if (score >= 90) level = "Very High";
    else if (score >= 75) level = "High";
    else if (score >= 60) level = "Moderate";
  
    return { score, level, reasons };
  }
  
  function exists(value) {
    if (!value) return false;
    const text = String(value).trim().toLowerCase();
    return text !== "" && text !== "unknown" && text !== "null";
  }
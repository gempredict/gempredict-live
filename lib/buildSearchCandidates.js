export default function buildSearchCandidates(card = {}) {
    const candidates = [];
  
    const franchise = clean(card.identifiedFranchise);
    const manufacturer = clean(card.identifiedManufacturer);
    const subject = clean(card.identifiedSubject);
    const set = clean(card.identifiedBrandSet);
    const number = clean(card.identifiedCardNumber);
    const parallel = clean(card.identifiedParallel);
    const year = clean(card.identifiedYear);
  
    add(candidates, [subject, number, parallel]);
    add(candidates, [subject, "#"+number, parallel]);
  
    add(candidates, [subject, number]);
    add(candidates, [subject, "#"+number]);
  
    add(candidates, [set, subject, number]);
  
    add(candidates, [manufacturer, subject, number]);
  
    add(candidates, [franchise, subject, number]);
  
    add(candidates, [subject, parallel]);
  
    add(candidates, [subject]);
  
    add(candidates, [year, manufacturer, subject]);
  
    return candidates;
  }
  
  function add(list, parts) {
    const value = parts
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  
    if (!value) return;
  
    if (!list.includes(value)) {
      list.push(value);
    }
  }
  
  function clean(value) {
    if (!value) return null;
  
    if (value === "unknown") return null;
  
    if (value === "null") return null;
  
    return String(value).trim();
  }
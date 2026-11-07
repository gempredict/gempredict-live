// Negative evidence only: absence of these warnings never authenticates a card.
export function unofficialReasons(item = {}) {
  const readings = [{ source: 'title', value: item.title || '' }];
  for (const aspect of item.localizedAspects || item.aspects || []) {
    if (/^(authenticity|original.*reprint|licensed.*reprint|features|manufacturer|type|card type)$/i.test(aspect.name || '')) {
      readings.push({ source: `aspect:${aspect.name}`, value: [aspect.value, ...(aspect.values || [])].filter(Boolean).join(' ') });
    }
  }
  return readings.flatMap(({ source, value }) => {
    let text = String(value).toLowerCase();
    // Seller cautions and protective accessories are not descriptions of the card.
    text = text.replace(/\b(?:not (?:a |an )?|no |never )(?:fake|counterfeit|reprint|replica|proxy|proxies)\b/g, '')
      .replace(/\b(?:anti[ -]counterfeit|counterfeit protection|proxy (?:shipping|bidding|payment))\b/g, '')
      .replace(/\b(?:custom|replica) (?:sleeve|holder|label|display|protective case)\b/g, '');
    const explicit = /\b(?:fan[ -]?made|unofficial|not (?:an? )?official|unlicensed|counterfeit|fake card|custom[ -](?:made|created)|custom card|proxy|replica)\b/.test(text);
    // Explicit manufacturer-authorized reissues are legitimate products, not
    // evidence of an unofficial copy. This exception never cancels fanmade etc.
    const productContext = `${item.title || ''} ${text}`;
    const officialReissue = /\b(?:official|licensed|manufacturer[ -]authorized|authorized)\b/i.test(productContext) && !/\b(?:unlicensed|unofficial|not (?:an? )?official)\b/i.test(productContext);
    const reprint = /\breprint\b/.test(text) && !officialReissue;
    const custom = /\bcustom\s*$/.test(text);
    return explicit || reprint || custom ? [{ source, text: String(value), reason: 'unofficial_card' }] : [];
  });
}

export function authenticityWarnings(report = {}) {
  const warnings = [...(Array.isArray(report.authenticityWarnings) ? report.authenticityWarnings.filter(w => w && typeof w.text === 'string').map(w => ({ source: 'prior_observation', text: w.text.slice(0, 1000), reason: 'authenticity_unresolved' })) : [])];
  const notes = [report.imageAnalysis?.identityNotes, report.imageAnalysis?.authenticityWarning, report.originalCanonicalCard?.notes];
  if (report.imageAnalysis?.isUnofficial === true) warnings.push({ source: 'original_image_flag', text: 'Vision explicitly flagged the card as unofficial.', reason: 'authenticity_unresolved' });
  for (const value of notes) {
    if (typeof value !== 'string') continue;
    const text = value.replace(/\b(?:no (?:visible )?evidence of|not (?:a |an )?|no) (?:counterfeit|fan[ -]?made|unofficial|replica|proxy|reprint)\b/gi, '');
    if ((value === report.imageAnalysis?.authenticityWarning && value.trim() && !/^(none|no warning|not flagged)$/i.test(value.trim())) || unofficialReasons({ title: text }).length) warnings.push({ source: 'original_identity_observation', text: value, reason: 'authenticity_unresolved' });
  }
  for (const item of report.marketData?.rawComparableItems || []) warnings.push(...unofficialReasons(item));
  return [...new Map(warnings.map(w => [w.text, w])).values()];
}
export const authenticityExplanation = 'The original card or listing evidence indicates a potentially unofficial, fanmade or copied card. Official-card valuation, grading ROI and recommendations are withheld. Confirming a year, set or variant does not authenticate it. Request independent authentication or rescan clear publisher/copyright and authenticity details; do not rely on matching market titles as proof.';

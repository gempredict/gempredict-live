// Observable condition vocabulary only. No model prose, identity, price or grade
// enters the trusted narrative. Codes remain AI observations, not catalog facts.
const attributes = ['centering', 'corners', 'edges', 'surface'];
const phrases = {
  centering: { off_center: 'Visible off-centering.', miscut: 'Possible miscut visible; inspect the physical card.' },
  corners: { whitening: 'Visible corner whitening.', softening: 'Visible corner softening.', bend: 'Visible corner bend.', crease: 'Visible corner crease.' },
  edges: { whitening: 'Visible edge whitening.', chipping: 'Visible edge chipping.', wear: 'Visible edge wear.', peeling: 'Visible edge peeling.' },
  surface: { scratches: 'Visible surface scratches.', print_lines: 'Visible print lines.', dent: 'Visible surface dent.', crease: 'Visible surface crease.', bend: 'Visible surface bend.', staining: 'Visible surface staining.' },
};
const limitationPhrases = { glare: 'Glare limits surface inspection.', blur: 'Blur limits inspection.', sleeve: 'A sleeve may obscure defects.', back_not_visible: 'The back is not visible; assessment is incomplete.', limited_resolution: 'Image resolution limits inspection.' };
const ratings = new Set(['excellent', 'good', 'fair', 'poor']);
export function readVisualEvidence(analysis = {}) {
  const findings = [];
  if (Array.isArray(analysis.visualObservations)) {
    for (const item of analysis.visualObservations.slice(0, 32)) {
      if (item && attributes.includes(item.attribute) && Object.hasOwn(phrases[item.attribute], item.code) && !findings.some(f => f.attribute === item.attribute && f.code === item.code)) findings.push({ attribute: item.attribute, code: item.code });
    }
  } else {
    // Legacy reports: extract only explicit defect phrases from the matching
    // attribute note. Never copy its arbitrary sentences into condition output.
    const patterns = { whitening: /whitening/, softening: /soft(?:ening| corners)/, bend: /\bbend\b/, crease: /\bcrease\b/, chipping: /chipping/, wear: /\bwear\b/, peeling: /peeling/, scratches: /scratch(?:es|ing)?/, print_lines: /print lines?/, dent: /\bdent\b/, staining: /stain(?:ing)?/, off_center: /off[- ]center/, miscut: /miscut/ };
    for (const attribute of attributes) {
      const note = analysis[`${attribute}Note`];
      if (typeof note !== 'string') continue;
      for (const sentence of note.split(/[.!?\n]+/)) {
        if (/\b(no|not|without|none|uncertain|unclear|possible|possibly|might|may|cannot|could|hidden)\b/i.test(sentence)) continue;
        for (const code of Object.keys(phrases[attribute])) if (patterns[code].test(sentence.toLowerCase()) && !findings.some(f => f.attribute === attribute && f.code === code)) findings.push({ attribute, code });
      }
    }
  }
  const limitations = Array.isArray(analysis.imageLimitations) ? [...new Set(analysis.imageLimitations.filter(code => Object.hasOwn(limitationPhrases, code)))].slice(0, 5) : [];
  return { findings, limitations };
}
export function conditionPresentation(analysis, { card, identityVerified, trusted } = {}) {
  const { findings, limitations } = readVisualEvidence(analysis);
  const notes = Object.fromEntries(attributes.map(attribute => {
    const observed = findings.filter(f => f.attribute === attribute).map(f => phrases[attribute][f.code]);
    const rating = ratings.has(analysis[attribute]) ? analysis[attribute] : null;
    return [`${attribute}Note`, observed.join(' ') || (rating ? `Photo assessment: ${rating}. No specific defect was recorded; this does not establish absence of defects.` : 'Not assessed from the photo.')];
  }));
  const detail = findings.map(f => phrases[f.attribute][f.code]);
  const identity = identityVerified ? [card?.year, card?.brandSet, card?.subject, card?.parallel, card?.cardNumber && `#${card.cardNumber}`].filter(Boolean).join(' · ') : null;
  const structural = analysis.visualSafetyFlags?.structuralDamage === true || findings.some(f => ['bend', 'crease', 'dent', 'peeling'].includes(f.code));
  return {
    visualEvidenceVersion: 1, visualObservations: findings, imageLimitations: limitations,
    ...notes,
    ...Object.fromEntries(attributes.map(attribute => [attribute, ratings.has(analysis[attribute]) ? analysis[attribute] : null])),
    imageSummary: `${identity ? `Catalog-supported identity: ${identity}.` : 'Card identity is unverified.'} Photo observations: ${detail.join(' ') || 'No specific defects were recorded; consult the attribute assessments.'} ${limitations.map(code => limitationPhrases[code]).join(' ')} These observations do not establish a PSA grade.`,
    gradingRisk: structural ? 'Visible structural damage requires physical inspection.' : 'Photo inspection can miss defects; inspect the physical card.',
    primaryLimiter: detail[0] || 'No specific visible limiter was recorded; this is not a defect-free finding.',
    majorGradeCap: structural ? 'Visible structural damage requires physical inspection.' : 'A grade ceiling cannot be established from these observations.',
    minorConcerns: detail.join(' ') || 'No specific concern was recorded; defects may remain unseen.',
    gemRiskFactors: [...detail, ...limitations.map(code => limitationPhrases[code])],
    // Do not convert arbitrary model grade prose into authoritative estimates.
    estimatedGrade: null, gradeCeiling: null, mostLikelyGradeRange: null, psa10Upside: null, overallScore: null, confidenceLevel: null,
    worthGrading: structural || analysis.worthGrading === false ? false : null,
    worthGradingReason: !trusted ? 'Grading recommendations are withheld until identity, version and matching market evidence are verified. Visual condition observations remain available.' : 'Photo observations alone do not establish a grade or submission recommendation. Review verified market evidence and physical condition separately.',
  };
}

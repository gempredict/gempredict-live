import marketEvidenceEngine from './marketEvidenceEngine.js';
import { financialEvidence, consistentEvidenceFinancials, financialFields } from "./financialEvidence.mjs";
import { conditionPresentation } from "./visualEvidence.mjs";
import { requestPrediction } from "./predictionTransport.mjs";
import { structuredListingConflicts } from './listingStructuredEvidence.mjs';
import { variantFromCard, hasVariantConsensus } from './variantVerification.mjs';
import { catalogNameKey } from './catalogNormalization.mjs';
import { identitySearchGate, catalogIdentityConflicts } from './catalogIdentity.mjs';
import { consistentFinancialReport } from './gradingEconomics.mjs';
import { authenticityWarnings, authenticityExplanation } from './cardAuthenticity.mjs';
import { readValuationSetEvidence, normalizeValuationSet } from './listingIdentityEvidence.mjs';

const amounts = ['rawValue', 'psa9Value', 'psa10Value', 'gradingUpside', 'expectedGradedValue', 'expectedNetValue', 'gemPredictScore', 'decisionConfidence'];
const summaryAmounts = ['rawLowest', 'rawHighest', 'rawMedian', 'fairMarketValue', 'rawTypicalRangeLow', 'rawTypicalRangeHigh'];

// Vision prose is not market evidence. Keep visual observations while removing
// financial assertions, including from restored reports that predate this rule.
export function visualConditionAnalysis(analysis, trusted = false, card = null, verification = null, identityOnly = false) {
  if (!analysis) return analysis;
  const safe = { ...analysis };
  if (!identityOnly) {
    const unverifiedInterpretation = analysis.unverifiedInterpretation || {
      imageSummary: analysis.imageSummary || null,
      estimatedGrade: analysis.estimatedGrade || null,
      identityNotes: analysis.identityNotes || null,
    };
    return { ...safe, unverifiedInterpretation, ...conditionPresentation(analysis, { card, identityVerified: identitySearchGate(verification, card).allowed, trusted }) };
  }
  // Known superseded proposals cannot become facts even when catalog trust is
  // incomplete. Normalize numeric years and decorated set labels independently.
  const corrections = Array.isArray(verification?.catalog?.corrections) ? verification.catalog.corrections.filter(Boolean) : [];
  const superseded = ['subject', 'cardNumber', 'year', 'brandSet', 'parallel'].flatMap(field => {
    const initial = analysis[({ subject: 'identifiedSubject', cardNumber: 'identifiedCardNumber', year: 'identifiedYear', brandSet: 'identifiedBrandSet', parallel: 'identifiedParallel' })[field]];
    const values = [initial, ...corrections.filter(change => change.field === field).map(change => change.originalValue)];
    return values.filter(value => value != null && catalogNameKey(value) !== catalogNameKey(card?.[field])).flatMap(value => {
      const key = catalogNameKey(value);
      if (!key || /^(unknown|none|null|n a)$/.test(key)) return [];
      const stripped = field === 'brandSet' ? key.replace(/\b(?:19|20)\d{2}\b/g, '').replace(/\b(?:pokemon|pok mon|tcg|scarlet|violet)\b/g, '').replace(/\s+/g, ' ').trim() : '';
      return [key, ...(stripped.length > 3 ? [stripped] : [])];
    });
  });
  const staleIdentity = sentence => superseded.some(value =>
    ` ${catalogNameKey(sentence)} `.includes(` ${value} `));
  const projection = /\b(?:psa|bgs|cgc|sgc|candidate|gem mint|grade[sd]?\s*[0-9]|grading recommendation)\b/i;
  const financial = /(?:[$€£]|\b(?:value|valuable|market|price|pricing|profit|investment|invest|roi|return|resale|sell|selling|buy|buying|worth|recommend|should grade|should submit|grade it|submit it|grading cost|grading fee|financial|economics)\b)/i;
  for (const field of ['imageSummary', 'centeringNote', 'cornersNote', 'edgesNote', 'surfaceNote', 'worthGradingReason', 'gradingRisk', 'gradeCeiling', 'primaryLimiter', 'majorGradeCap', 'psa10Upside', 'minorConcerns', 'estimatedGrade', 'mostLikelyGradeRange']) {
    if (typeof safe[field] === 'string') safe[field] = safe[field].split(/(?<=[.!?])\s+|\n+/).filter(sentence => (identityOnly || !financial.test(sentence)) && !staleIdentity(sentence) && (trusted || !projection.test(sentence))).join(' ');
  }
  if (Array.isArray(safe.gemRiskFactors)) safe.gemRiskFactors = safe.gemRiskFactors.filter(item => typeof item === 'string' && !financial.test(item) && !staleIdentity(item) && (trusted || !projection.test(item)));
  if (!trusted) {
    for (const field of ["estimatedGrade", "gradeCeiling", "mostLikelyGradeRange", "psa10Upside", "overallScore", "confidenceLevel"]) safe[field] = null;
    safe.worthGrading = null;
    safe.worthGradingReason = 'Grading recommendations are withheld until identity, version and matching market evidence are verified. Visual condition observations remain available.';
  }
  return safe;
}

export function canonicalDisplayName(card) {
  return card ? [card.year, card.brandSet, card.subject, card.parallel, card.cardNumber && `#${card.cardNumber}`].filter(Boolean).join(' ') : '';
}
function canonicalPrediction(prediction, card, analysis, verification, original = null) {
  analysis = analysis || (original ? Object.fromEntries(Object.entries({ subject: "identifiedSubject", cardNumber: "identifiedCardNumber", year: "identifiedYear", brandSet: "identifiedBrandSet", parallel: "identifiedParallel" }).map(([key, field]) => [field, original[key]])) : null);
  const safe = { ...prediction };
  if (card) {
    safe.cardTitle = canonicalDisplayName(card);
    safe.cardMeta = [card.year, card.brandSet, card.parallel].filter(Boolean).join(' · ');
  }
  // Reuse the same superseded-identity filter for model-written report prose.
  for (const field of ['analysis', 'action', 'recommendation']) {
    if (typeof safe[field] !== 'string' || !analysis) continue;
    safe[field] = visualConditionAnalysis({ ...analysis, imageSummary: safe[field] }, true, card, verification, true).imageSummary || null;
  }
  return safe;
}

function unresolvedIdentityFields(verification) {
  return ['year', 'set'].filter(field => {
    const detail = verification?.[field];
    if (!detail) return false; // Legacy/query-only callers have no reconciliation metadata.
    const missingValue = detail.value == null || !String(detail.value).trim() || /^(unknown|null|none|n\/a)$/i.test(String(detail.value).trim());
    if (detail.status === 'user_protected') return missingValue || (detail.userValues || []).length > 1;
    if (['verified', 'corrected'].includes(detail.status) && !missingValue) return false;
    return detail.status === 'unresolved_conflict' || detail.conflictingListingCount > 0 || detail.ambiguousListingCount > 0 || missingValue;
  });
}

function unresolvedValuationFields(report) {
  const fields = unresolvedIdentityFields(report.identityVerification);
  const gate = identitySearchGate(report.identityVerification, report.canonicalCard);
  if (report.valuationIdentityGate?.allowed === false || !gate.allowed || catalogIdentityConflicts(report.canonicalCard, report.identityVerification?.catalog?.candidate).length) fields.push('independent_identity');
  if (!gate.allowed) return fields; // Never parse listing evidence using a malformed identity.
  const card = report.canonicalCard;
  if (card?.brandSet && Array.isArray(report.marketData?.rawComparableItems)) {
    const expected = normalizeValuationSet(card.brandSet, card);
    // Recheck recorded evidence when restoring an older report. A previous
    // trusted flag cannot bless a pool that explicitly mixes different sets.
    if (report.marketData.rawComparableItems.some(item => readValuationSetEvidence(item, card).some(reading => reading.key !== expected)) && !fields.includes('set')) fields.push('set');
    if (report.marketData.rawComparableItems.some(item => structuredListingConflicts(item, card).length)) fields.push('listing_evidence');
  }
  return fields;
}

function identityExplanation(fields, verification) {
  if (verification?.catalog?.status === 'unavailable') {
    return 'Independent catalog verification is unavailable. Valuation and grading ROI are withheld until an independent catalog source is available; seller listings and manual confirmation cannot replace this check.';
  }
  if (['conflict', 'ambiguous', 'insufficient_evidence'].includes(verification?.catalog?.status)) {
    return 'Independent catalog evidence does not establish a single matching card identity. Resolve the conflicting or incomplete identity evidence before requesting valuation; prices and grading ROI are withheld.';
  }
  return `Year/set identity is unresolved: ${fields.join(', ')}. Conflicting or missing identity details make pricing unreliable. Use Verify Variant to confirm the year and set and request fresh matching prices. Valuation and grading ROI are withheld.`;
}

const objectRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const variantFields = ['kind', 'finish', 'art', 'color', 'treatment', 'printRun', 'autograph', 'relic'];
// One eligibility rule for fresh predictions, restored reports, Atlas and UI.
// Verified/corrected states come from reconciliation; manual confirmation still
// needs fresh matching prices and the independent identity gate.
export function isVariantVerificationTrusted(verification, card) {
  if (!objectRecord(verification) || !Object.hasOwn(verification, 'status') ||
      !['verified', 'corrected', 'user_confirmed'].includes(verification.status)) return false;
  if (verification.materialAmbiguity !== false || !Object.hasOwn(verification, 'value') ||
      !Object.hasOwn(verification, 'fields') || !Array.isArray(verification.evidenceReferences)) return false;
  if (card?.variant != null && (!objectRecord(card.variant) || ['ambiguous', 'unrecognized'].some(field => Object.hasOwn(card.variant, field) && card.variant[field] !== false))) return false;
  if (Object.hasOwn(verification, 'value')) {
    const value = verification.value;
    if (!objectRecord(value) || !variantFields.every(field => Object.hasOwn(value, field)) ||
        ['ambiguous', 'unrecognized'].some(field => Object.hasOwn(value, field) && value[field] !== false)) return false;
    const canonical = card?.variant || variantFromCard(card || {});
    for (const field of variantFields) {
      if (!Object.hasOwn(value, field)) continue;
      if (value[field] != null && (field === 'kind' && !['base', 'parallel', 'insert'].includes(value[field]) || field === 'finish' && !['holo', 'non-holo', 'reverse-holo'].includes(value[field]) || field === 'art' && !['standard art', 'alternate art', 'special art', 'manga'].includes(value[field]))) return false;
      if (value[field] != null && (['autograph', 'relic'].includes(field) ? typeof value[field] !== 'boolean' : typeof value[field] !== 'string' || !value[field].trim())) return false;
      if ((card?.parallel || card?.variant) && value[field] !== canonical[field]) return false;
    }
  }
  if (Object.hasOwn(verification, 'fields')) {
    if (!objectRecord(verification.fields) || !variantFields.every(field => Object.hasOwn(verification.fields, field))) return false;
    for (const detail of Object.values(verification.fields)) {
      if (!objectRecord(detail)) return false;
      for (const field of ['supportingListingCount', 'informativeEvidenceCount']) {
        if (!Number.isInteger(detail[field]) || detail[field] < 0) return false;
      }
      if (!Number.isFinite(detail.consensus) || detail.consensus < 0 || detail.consensus > 1 || detail.supportingListingCount > detail.informativeEvidenceCount) return false;
      const expectedConsensus = detail.informativeEvidenceCount ? detail.supportingListingCount / detail.informativeEvidenceCount : 0;
      if (Math.abs(detail.consensus - expectedConsensus) > 1e-9) return false;
    }
  }
  if (verification.status !== 'user_confirmed') {
    const references = verification.evidenceReferences;
    if (references.some(ref => !objectRecord(ref))) return false;
    const keys = references.map(ref => (typeof ref.itemId === 'string' && ref.itemId.trim()) || (typeof ref.itemWebUrl === 'string' && ref.itemWebUrl.trim()));
    if (keys.some(key => !key)) return false;
    const independent = new Set(keys);
    if (!hasVariantConsensus(independent.size, 1)) return false;
    for (const field of variantFields) {
      const value = verification.value[field];
      if (value !== null && value !== false &&
          (verification.fields[field].value !== value || !hasVariantConsensus(verification.fields[field].supportingListingCount, verification.fields[field].consensus))) return false;
    }
  }
  for (const field of ['evidenceReferences', 'conflicts', 'excludedEvidenceReferences']) {
    if (Object.hasOwn(verification, field) && !Array.isArray(verification[field])) return false;
  }
  return true;
}

function identityEligible(report) {
  return isVariantVerificationTrusted(report?.variantVerification, report?.canonicalCard) && !unresolvedValuationFields(report).length && !authenticityWarnings(report).length;
}
export function isMarketAnalysisAvailable(report) {
  return identityEligible(report) && consistentEvidenceFinancials(report);
}
export function isValuationTrusted(report) {
  return isMarketAnalysisAvailable(report) && financialEvidence(report).actionable === true && report?.valuationVerification?.status === 'trusted' && report?.marketData?.marketSummary?.valuationTrusted === true;
}
export function protectValuation(payload) {
  const warnings = authenticityWarnings(payload);
  const identityFields = unresolvedValuationFields(payload);
  const variantResolved = isVariantVerificationTrusted(payload.variantVerification, payload.canonicalCard);
  const eligible = !warnings.length && variantResolved && !identityFields.length;
  const summary = payload.marketData?.marketSummary || {};
  const prediction = canonicalPrediction(payload.prediction, payload.canonicalCard, payload.imageAnalysis, payload.identityVerification, payload.originalCanonicalCard);
  const decision = eligible ? financialEvidence({ ...payload, prediction }) : { version: 1, status: 'withheld', actionable: false, projection: null, reasons: ['identity_or_variant_unresolved'] };
  const available = eligible && decision.projection !== null;
  const trusted = available && decision.actionable;
  const reason = warnings.length ? 'authenticity_unresolved' : !variantResolved ? 'variant_unresolved' : identityFields.length ? 'identity_unresolved' : !available ? 'no_comparable_listings' : !trusted ? 'insufficient_qualified_financial_evidence' : null;
  const explanation = warnings.length ? authenticityExplanation : !variantResolved ? payload.variantVerification?.explanation || 'The card version has not been verified.' : identityFields.length ? identityExplanation(identityFields,payload.identityVerification) : !available ? 'No eligible raw sold or asking-price evidence is available. Valuation and recommendations are withheld.' : !trusted ? 'Provisional analysis only: asking prices and modeled estimates do not establish verified fair market value or authorize actionable grading recommendations.' : 'Qualified completed sales support the stated conditional financial decision; returns and grades are not guaranteed.';
  if (available) {
    Object.assign(prediction, decision.projection);
    prediction.recommendation = trusted ? decision.projection.action : null;
    prediction.financialBasis = { version: 2, rawSource: decision.rawSource, rawMedian: decision.projection.rawValue, gradedSources: decision.graded, probabilitySource: decision.probability.source };
  } else {
    for (const field of [...amounts, 'psa10Probability']) prediction[field] = null;
    for (const field of ['verdict','action','analysis','recommendation','financialBasis']) prediction[field] = null;
  }
  prediction.psa9Pop = decision.population?.status === 'available' ? decision.population.psa9Population : null;
  prediction.psa10Pop = decision.population?.status === 'available' ? decision.population.psa10Population : null;
  prediction.populationInsight = 'Historical population rates are not an individual card grade probability. Unavailable counts are not estimated by the model.';
  const marketSummary = { ...summary, valuationTrusted: trusted, fairMarketValue: decision.observedRaw?.qualified ? decision.observedRaw.median : null, evidenceType: 'active_asking_price_listings' };
  if (!eligible || !available) for (const field of summaryAmounts) marketSummary[field] = null;
  return { ...payload, canonicalCard: payload.canonicalCard ? { ...payload.canonicalCard, displayName: canonicalDisplayName(payload.canonicalCard) } : payload.canonicalCard, authenticityWarnings: warnings, prediction,
    financialDecision: decision, imageAnalysis: visualConditionAnalysis(payload.imageAnalysis, trusted, payload.canonicalCard, payload.identityVerification), atlas: trusted ? payload.atlas : null,
    marketData: { ...payload.marketData, marketSummary, completedSalesAnalysis: decision.sales || null },
    valuationVerification: { status: trusted ? 'trusted' : available ? 'provisional' : 'untrusted', reason, explanation, ...(identityFields.length ? { unresolvedIdentityFields: identityFields } : {}), evaluatedAt: new Date().toISOString() } };
}

// Old Atlas snapshots may predate selected-pool wiring even when their B4
// financial report is sound. Hide inconsistent Atlas data; do not invent fresh
// evidence or invalidate the otherwise safe recorded financial calculations.
function atlasMatchesReport(report) {
  const atlas = report.atlas;
  const expected = marketEvidenceEngine(report.marketData);
  const label = { grade: 'Grade It', maybe: 'Consider It', skip: 'Skip It' }[report.verdict];
  const markets = [atlas.marketEvidence, atlas.report?.market];
  return atlas.valuationVerification?.status === 'trusted' &&
    markets.every(market => ['evidenceType', 'comparableCount', 'confidence', 'median', 'queryUsed', 'source'].every(key => market?.[key] === expected[key])) &&
    [atlas.recommendation, atlas.report?.recommendation].every(rec => rec?.verdict === report.verdict && rec.label === label && rec.reason === report.action) &&
    [atlas.decision, atlas.report?.decision].every(dec => dec?.decision === report.verdict && dec.label === label) &&
    atlas.report?.score?.score === report.gemPredictScore && atlas.gradingProbability === report.psa10Probability &&
    (report.imageAnalysis || (atlas.identityConfidence === null && atlas.report?.confidence === null)) &&
    ['subject', 'cardNumber', 'year', 'brandSet', 'parallel', 'autoOrRelic', 'printRun'].every(key => atlas.report?.identity?.[key] === report.canonicalCard?.[key]);
}

// Apply the same boundary to restored/local reports, including older reports
// that predate valuation verification. Missing verification never grants trust.
export function safeStoredReport(report) {
  const model = report.prediction || report;
  const consistent = model.financialBasis?.version === 2 ? consistentEvidenceFinancials(report) : consistentFinancialReport(report);
  const safe = protectValuation({ ...report, prediction: model });
  if (report.valuationVerification?.reason === 'financial_inconsistent' || identityEligible(report) && (model.financialBasis || model.rawValue != null) && !consistent) {
    for (const field of [...financialFields, 'recommendation', 'financialBasis']) safe.prediction[field] = null;
    safe.financialDecision = { version: 1, status: 'withheld', actionable: false, projection: null, reasons: ['financial_inconsistent'] };
    safe.valuationVerification = { status: 'untrusted', reason: 'financial_inconsistent', explanation: 'Saved financial values are stale or inconsistent. Request fresh evidence; cached recommendations are withheld.' };
    safe.marketData.marketSummary.valuationTrusted = false;
    for (const field of summaryAmounts) safe.marketData.marketSummary[field] = null;
    safe.atlas = null;
  }
  const result = { ...report, ...safe.prediction, canonicalCard: safe.canonicalCard, imageAnalysis: safe.imageAnalysis, financialDecision: safe.financialDecision, marketData: safe.marketData, valuationVerification: safe.valuationVerification, atlas: null };
  const unchangedVisual = JSON.stringify(safe.imageAnalysis) === JSON.stringify(report.imageAnalysis);
  const noVisualAtlas = report.atlas?.explanation === null && report.atlas?.identityConfidence === null && report.atlas?.report?.confidence === null && Array.isArray(report.atlas?.evidence) && !report.atlas.evidence.some(item => item?.category === 'Condition');
  if (isValuationTrusted(result) && report.atlas && (unchangedVisual || noVisualAtlas) &&
      atlasMatchesReport({ ...result, atlas: report.atlas }) &&
      (!report.atlas.report?.identity?.displayName || report.atlas.report.identity.displayName === result.canonicalCard.displayName)) result.atlas = report.atlas;
  return result;
}

export function marketAnalysisSummary(report) {
  const safe = safeStoredReport(report), decision = safe.financialDecision;
  if (!isMarketAnalysisAvailable(safe)) return withheldSummary(safe);
  return `GemPredict Report — ${canonicalDisplayName(safe.canonicalCard)} | ${decision.actionable ? 'Qualified completed-sale analysis' : 'Provisional analysis; recommendation withheld'} | Raw baseline: $${safe.rawValue} (${decision.rawSource}) | PSA 9: $${safe.psa9Value} (${decision.graded['PSA 9'].source}) | PSA 10: $${safe.psa10Value} (${decision.graded['PSA 10'].source}) | Probability: ${safe.psa10Probability}% (${decision.probability.source}; not historical population rate) | Conditional net: $${safe.expectedNetValue}; $80 fee, excludes other costs and lower grades. ${decision.actionable ? safe.action : 'No actionable grading recommendation is authorized.'}`;
}

export function withheldSummary(report) {
  const identityFields = unresolvedValuationFields(report);
  const explanation = authenticityWarnings(report).length ? authenticityExplanation : identityFields.length && ['verified', 'corrected', 'user_confirmed'].includes(report.variantVerification?.status) ? identityExplanation(identityFields, report.identityVerification) : report.valuationVerification?.explanation;
  return `GemPredict Report — ${canonicalDisplayName(report.canonicalCard) || report.cardTitle || 'Card'} | Valuation and grading ROI withheld: ${explanation || 'This version needs a fresh valuation.'}`;
}

export function reportFromPrediction(data, previous = null) {
  return safeStoredReport({
    ...data.prediction,
    marketData: data.marketData || null,
    imageAnalysis: data.imageAnalysis || previous?.imageAnalysis || null,
    originalCanonicalCard: previous?.originalCanonicalCard || data.originalCanonicalCard || null,
    canonicalCard: data.canonicalCard || null,
    variantVerification: data.variantVerification || null,
    valuationVerification: data.valuationVerification || null,
    identityVerification: data.identityVerification || null,
    valuationIdentityGate: data.valuationIdentityGate || null,
    identityEvidenceItems: data.identityEvidenceItems || [],
    identityEvidenceExclusions: data.identityEvidenceExclusions || [],
    authenticityWarnings: [...authenticityWarnings(previous || {}), ...authenticityWarnings(data)],
    atlas: data.atlas || null,
    pricingDiagnostics: data.pricingDiagnostics || null,
    completedSales: data.completedSales || null,
    populationRecord: data.populationRecord || null,
    probabilityEvidence: data.probabilityEvidence || null,
    financialDecision: data.financialDecision || null,
  });
}

export async function requestVariantRevaluation(report, confirmation, fetchImpl = globalThis.fetch) {
  const card = { ...(report.canonicalCard || report.originalCanonicalCard), ...confirmation.identity };
  if (!card?.subject || !card?.cardNumber) throw new Error('Enter the card subject and card number to request fresh prices.');
  // No cached market summary, prediction or prices are submitted for unlocking.
  const { response, data } = await requestPrediction({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authenticityWarnings: authenticityWarnings(report), textOnlyIdentity: !report.imageAnalysis, cardName: card.subject, cardType: report.inputContext?.cardType || 'tcg', condition: report.inputContext?.condition || 'strong', confirmedCardIdentity: card, originalIdentityProposal: report.originalCanonicalCard || card, confirmedIdentity: { year: card.year, brandSet: card.brandSet }, confirmedVariant: confirmation }),
  }, fetchImpl);
  if (!response.ok) throw new Error(data.error || 'Could not revalue this version. Try again or rescan.');
  return { ...reportFromPrediction(data, report), inputContext: report.inputContext };
}

export function replaceRevaluedReport(reports, previous, fresh) {
  if (!reports.includes(previous)) throw new Error('The report changed while checking prices. Open the current report and retry; no stale result was applied.');
  return reports.map(report => report === previous ? fresh : report);
}

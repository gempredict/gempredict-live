export default function atlasEvidenceEngine({ imageAnalysis, canonicalCard, identityConfidence, identityVerification, marketEvidence } = {}) {
  const evidence = [];
  if (marketEvidence?.comparableCount > 0) evidence.push({
    category: 'Market', strength: marketEvidence.confidence >= 70 ? 'high' : 'medium',
    message: `${marketEvidence.comparableCount} usable raw asking-price listings; selected market confidence ${marketEvidence.confidence}%. Realized sale prices are unavailable.`,
  });
  if (canonicalCard?.subject) evidence.push({ category: 'Identity', strength: 'medium', message: `Canonical subject: ${canonicalCard.subject}.` });
  if (canonicalCard?.cardNumber) evidence.push({ category: 'Identity', strength: 'medium', message: `Canonical collector number: ${canonicalCard.cardNumber}.` });
  if (canonicalCard?.parallel) evidence.push({ category: 'Identity', strength: 'medium', message: `Canonical version: ${canonicalCard.parallel}.` });
  for (const field of ['year', 'set']) {
    const detail = identityVerification?.[field];
    if (detail) evidence.push({ category: 'Independent identity', strength: ['verified', 'corrected'].includes(detail.status) ? 'high' : 'medium', message: `${field}: ${detail.status}; ${detail.supportingListingCount || 0} supporting independent listings. User-protected choices are not market confirmation.` });
  }
  if (identityConfidence) evidence.push({ category: 'Image identity', strength: 'medium', message: `Image identifier score ${identityConfidence.score}%; separate from independent identity verification and price reliability.` });
  if (imageAnalysis?.worthGradingReason) evidence.push({ category: 'Condition', strength: 'medium', message: imageAnalysis.worthGradingReason });
  return evidence;
}

import { variantFromCard } from '../../lib/variantVerification.mjs';
// Test-only independent catalog record. Callers choose explicit fixture facts;
// these are not production records and do not grant trust in application code.
export function verifiedIdentity(canonicalCard) {
  return {
    canonicalCard,
    identityVerification: {
      year: { status: 'verified', value: canonicalCard.year },
      set: { status: 'verified', value: canonicalCard.brandSet },
      catalog: { status: 'verified', source: 'mock-independent-catalog', referenceId: 'mock:verified-identity', candidate: { ...canonicalCard } },
    },
  };
}

// Explicit test-only evidence receipt, replacing bare status tags in focused
// boundary tests. Real pipeline tests continue using actual reconciliation.
export function verifiedVariant(card = {}, status = 'verified') {
  const value = variantFromCard(card);
  const fields = ['kind', 'finish', 'art', 'color', 'treatment', 'printRun', 'autograph', 'relic'];
  return { status, materialAmbiguity: false, value,
    fields: Object.fromEntries(fields.map(field => [field, { originalValue: value[field], value: value[field], supportingListingCount: 3, informativeEvidenceCount: 3, consensus: 1 }])),
    evidenceReferences: [1, 2, 3].map(id => ({ itemId: `mock-variant-${id}`, title: [card.subject, card.cardNumber, card.parallel].filter(Boolean).join(' ') })),
  };
}

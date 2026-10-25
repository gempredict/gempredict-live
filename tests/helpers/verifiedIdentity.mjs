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

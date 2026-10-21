import { buildNeutralIdentityQuery, fetchIdentityEvidence, matchIdentityEvidence, mergeIdentityEvidence } from './marketIdentityEvidence.mjs';

import { extractListingYear, extractListingSet, normalizeMarketSet as setKey } from './listingIdentityEvidence.mjs';

const text = value => typeof value === 'string' ? value.trim() : '';
const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function reference(item) {
  return { itemId: item.itemId, itemWebUrl: item.itemWebUrl, title: item.title };
}

function fieldResult(field, originalValue, pool, card, locked, unavailable) {
  const extract = field === 'year' ? extractListingYear : extractListingSet;
  const keyOf = field === 'year' ? value => value : setKey;
  const votes = new Map();
  let missingListingCount = 0;
  let ambiguousListingCount = 0;
  const evidenceReferences = [];
  const nonInformativeEvidenceReferences = [];
  for (const listing of pool) {
    const readings = listing.observations.map(observation => extract(observation.originalItem, card));
    const informative = readings.filter(reading => reading.value);
    const keys = [...new Set(informative.map(reading => reading.key || reading.value))];
    if (keys.length !== 1 || readings.some(reading => reading.reason === 'ambiguous')) {
      const ambiguous = keys.length > 0 || readings.some(reading => reading.reason === 'ambiguous');
      if (ambiguous) ambiguousListingCount++;
      else missingListingCount++;
      nonInformativeEvidenceReferences.push({ ...reference(listing), reason: ambiguous ? 'ambiguous' : 'missing' });
      continue;
    }
    const value = informative[0].value;
    const ref = { ...reference(listing), value };
    evidenceReferences.push(ref);
    const group = votes.get(keys[0]) || { value, count: 0, references: [] };
    group.count++;
    group.references.push(ref);
    votes.set(keys[0], group);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1].count - a[1].count);
  const informativeEvidenceCount = evidenceReferences.length;
  const winner = ranked[0]?.[1];
  const supportingListingCount = winner?.count || 0;
  const consensus = informativeEvidenceCount ? supportingListingCount / informativeEvidenceCount : 0;
  const sufficient = supportingListingCount >= 3 && consensus >= 0.6;
  const agrees = winner && keyOf(text(originalValue)) === ranked[0][0];
  const status = locked ? 'user_protected' : unavailable ? 'unavailable' : !pool.length ? 'missing_evidence' : sufficient ? (agrees ? 'verified' : 'corrected') : votes.size > 1 ? 'unresolved_conflict' : 'insufficient_evidence';
  return {
    originalValue: originalValue ?? null,
    originalValueMissing: !text(originalValue),
    value: status === 'corrected' ? winner.value : originalValue ?? null,
    candidateValue: winner?.value || null,
    status,
    supportingListingCount,
    informativeEvidenceCount,
    consensus,
    missingListingCount,
    ambiguousListingCount,
    conflictingListingCount: text(originalValue) ? evidenceReferences.filter(ref => keyOf(ref.value) !== keyOf(text(originalValue))).length : 0,
    evidenceReferences,
    nonInformativeEvidenceReferences,
    supportingEvidenceReferences: winner?.references || [],
  };
}

export function reconcileMarketIdentity(proposal, evidence, { protectedFields = [], userIdentity = {}, userChoices = {} } = {}) {
  if (!proposal) return { canonicalCard: null, identityVerification: null };
  const neutralQuery = normalize(buildNeutralIdentityQuery(proposal));
  // Revalidate provenance and subject/number against original fetched listings.
  // Constrained searches, cached AI fields and valuation matches cannot vote.
  const independent = (evidence?.search?.status === 'retrieved' ? evidence.identityEvidenceItems || [] : []).filter(item => item.source === 'ebay_browse' && (item.itemId || item.itemWebUrl)).map(item => ({
    ...item,
    observations: (item.observations || []).filter(observation => observation.searchType === 'neutral_subject_card_number' && neutralQuery && normalize(observation.query) === neutralQuery && matchIdentityEvidence(observation.originalItem, proposal)),
  })).filter(item => item.observations.length);
  const pool = mergeIdentityEvidence(independent);
  const unavailable = evidence?.search?.status !== 'retrieved';
  const year = fieldResult('year', proposal.year, pool, proposal, protectedFields.includes('year'), unavailable);
  const set = fieldResult('set', proposal.brandSet, pool, proposal, protectedFields.includes('set'), unavailable);
  // Explicit user values take precedence over the vision proposal, independently
  // for each field. Keep the original values and all user choices inspectable.
  for (const [field, detail, chosen] of [['year', year, userIdentity.year], ['set', set, userIdentity.brandSet]]) {
    if (protectedFields.includes(field)) {
      if (chosen) detail.value = chosen;
      if (userChoices[field]) detail.userValues = [...userChoices[field]];
    }
  }
  const canonicalCard = { ...proposal, year: year.value, brandSet: set.value };
  if (canonicalCard.year !== proposal.year || canonicalCard.brandSet !== proposal.brandSet) {
    canonicalCard.displayName = [canonicalCard.year, canonicalCard.brandSet, canonicalCard.subject, canonicalCard.parallel, canonicalCard.cardNumber && `#${canonicalCard.cardNumber}`].filter(Boolean).join(' ');
  }
  return { canonicalCard, identityVerification: { year, set, independentListingCount: pool.length } };
}

export async function resolveMarketIdentity(proposal, { protectedFields = [], userIdentity = {}, userChoices = {}, ...fetchOptions } = {}) {
  const evidence = await fetchIdentityEvidence(proposal, fetchOptions);
  return { ...reconcileMarketIdentity(proposal, evidence, { protectedFields, userIdentity, userChoices }), ...evidence };
}

// Shared equivalence rules for evidence relevance; no additional set inference.
export { extractListingYear, extractListingSet, setKey as normalizeMarketSet };

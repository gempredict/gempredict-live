import { normalizeValuationSet } from './listingIdentityEvidence.mjs';

const text = v => typeof v === 'string' ? v.trim() : '';
const key = v => text(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = v => text(v).toLowerCase().replace(/^#\s*/, '').replace(/\s+/g, '').split(/([/-])/).map(p => /^\d+$/.test(p) ? String(Number(p)) : p).join('');

// Adapter contract: lookup receives ONLY subject and full collector number.
// Records must come from a configured independent catalog, never seller titles,
// model output, user request metadata, or valuation-search results. No default
// network connection or embedded card facts are invented here.
export async function crossCheckCatalog(card, { catalogLookup, catalogSource } = {}) {
  const query = { subject: text(card?.subject), cardNumber: text(card?.cardNumber) };
  const diagnostics = [];
  if (!catalogLookup || !text(catalogSource)) return { status: 'unavailable', reason: 'No independent catalog adapter configured', diagnostics };
  if (!query.subject || !query.cardNumber) return { status: 'insufficient_evidence', reason: 'Subject and full collector number required', diagnostics };
  let records;
  try { records = await catalogLookup(query); }
  catch { return { status: 'unavailable', reason: 'Independent catalog lookup failed', diagnostics }; }
  if (!Array.isArray(records)) return { status: 'unavailable', reason: 'Invalid catalog response', diagnostics };
  const accepted = new Map();
  for (const record of records) {
    let reason = !record?.id ? 'missing_catalog_reference' : key(record.subject) !== key(query.subject) ? 'different_subject' : number(record.cardNumber) !== number(query.cardNumber) ? 'different_or_partial_collector_number' : !text(record.brandSet) || !/^(19|20)\d{2}$/.test(text(record.year)) ? 'incomplete_catalog_identity' : null;
    diagnostics.push({ source: catalogSource, id: record?.id || null, accepted: !reason, reason });
    if (!reason) {
      const identityKey = JSON.stringify([key(record.subject), number(record.cardNumber), record.year, normalizeValuationSet(record.brandSet, record), key(record.parallel), key(record.language)]);
      accepted.set(identityKey, record);
    }
  }
  if (accepted.size !== 1) return { status: accepted.size ? 'ambiguous' : 'insufficient_evidence', reason: accepted.size ? 'Collector number has multiple catalog identities or variants' : 'No exact catalog identity', diagnostics };
  const record = [...accepted.values()][0];
  const conflicts = catalogIdentityConflicts(card, record);
  // Conflicts are not silently overwritten: require explicit resolution/rescan.
  return { status: conflicts.length ? 'conflict' : 'verified', source: catalogSource, referenceId: record.id, conflicts, candidate: { subject: record.subject, cardNumber: record.cardNumber, year: record.year, brandSet: record.brandSet, parallel: record.parallel || null, language: record.language || null }, diagnostics };
}

export function identitySearchGate(verification, card) {
  const catalog = verification?.catalog;
  const unresolvedFields = ['year', 'set'].filter(field => !['verified', 'corrected', 'user_protected'].includes(verification?.[field]?.status));
  const explicitConflict = ['year', 'set'].some(field => verification?.[field]?.status === 'unresolved_conflict' || (verification?.[field]?.status !== 'user_protected' && !['verified', 'corrected'].includes(verification?.[field]?.status) && (verification?.[field]?.conflictingListingCount > 0 || verification?.[field]?.ambiguousListingCount > 0)));
  const missingCanonical = card && ['subject', 'cardNumber', 'year', 'brandSet'].some(field => !text(card[field]));
  const blocked = missingCanonical || catalogIdentityConflicts(card, catalog?.candidate).length > 0 || explicitConflict || catalog?.status !== 'verified';
  return { allowed: !blocked, reason: blocked ? 'identity_unresolved' : null, unresolvedFields, catalogStatus: catalog?.status || 'unavailable' };
}

// Recheck the final (possibly variant-reconciled or restored) card, not just the
// earlier proposal. Catalog verification cannot migrate to another identity.
export function catalogIdentityConflicts(card, record) {
  return ['subject', 'cardNumber', 'year', 'brandSet', 'parallel', 'language'].filter(field => {
    if (!text(card?.[field]) || !text(record?.[field])) return false;
    if (field === 'cardNumber') return number(card[field]) !== number(record[field]);
    if (field === 'brandSet') return normalizeValuationSet(card[field], card) !== normalizeValuationSet(record[field], record);
    return key(card[field]) !== key(record[field]);
  });
}

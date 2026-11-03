import { invalidCatalogIdentityFields, validCatalogReference } from './catalogIdentityValidation.mjs';
import { catalogVariantParts, catalogLanguageKey, catalogNameKey } from './catalogNormalization.mjs';
import { normalizeValuationSet } from './listingIdentityEvidence.mjs';

const text = v => typeof v === 'string' ? v.trim() : '';
const key = v => text(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = v => text(v).toLowerCase().replace(/^#\s*/, '').replace(/\s+/g, '').split(/([/-])/).map(p => /^\d+$/.test(p) ? String(Number(p)) : p).join('');

// Adapter contract: identity fields plus optional bounded server-side candidate queries.
// Records must come from a configured independent catalog, never seller titles,
// model output, user request metadata, or valuation-search results. No default
// network connection or embedded card facts are invented here.
export async function crossCheckCatalog(card, { catalogLookup, catalogSource, investigation = null } = {}) {
  const query = { subject: text(card?.subject), cardNumber: text(card?.cardNumber), ...(card?.language ? { language: card.language } : {}) };
  const diagnostics = [];
  if (!catalogLookup || !text(catalogSource)) return { status: 'unavailable', reason: 'No independent catalog adapter configured', diagnostics };
  if (investigation?.blocked) return { status: 'ambiguous', reason: investigation.reason, diagnostics, candidateInvestigation: investigation };
  if ((!query.subject || !query.cardNumber) && !investigation?.queries?.length) return { status: 'insufficient_evidence', reason: 'Subject and full collector number required', diagnostics };
  let records;
  try {
    records = await catalogLookup({ ...query, ...(investigation?.queries?.length ? { candidateQueries: investigation.queries } : {}) });
    if (records && !Array.isArray(records) && Array.isArray(records.records)) {
      diagnostics.push(...(records.diagnostics || []));
      if (records.complete !== true) return { source: catalogSource, status: ['ambiguous', 'insufficient_evidence'].includes(records.status) ? records.status : 'unavailable', reason: records.reason || 'Incomplete catalog response', diagnostics };
      records = records.records;
    }
  }
  catch { return { status: 'unavailable', reason: 'Independent catalog lookup failed', diagnostics }; }
  if (!Array.isArray(records)) return { status: 'unavailable', reason: 'Invalid catalog response', diagnostics };
  const accepted = new Map();
  const queries = investigation?.queries?.length ? investigation.queries : [query];
  for (const record of records) {
    let reason = investigation?.language && catalogLanguageKey(record?.language) !== catalogLanguageKey(investigation.language) ? 'printed_language_conflict' : investigation?.setCode && ![record?.setCode,record?.setId].some(v=>key(v)===key(investigation.setCode)) ? 'printed_set_code_conflict' : !record?.id ? 'missing_catalog_reference' : !queries.some(q => catalogNameKey(record.subject) === catalogNameKey(q.subject)) ? 'different_subject' : !queries.some(q => number(record.cardNumber) === number(q.cardNumber) || record.provider === 'tcgdex' && !q.cardNumber.includes('/') && number(record.localId) === number(q.cardNumber)) ? 'different_or_partial_collector_number' : invalidCatalogIdentityFields(record).length > 0 ? 'incomplete_catalog_identity' : null;
    diagnostics.push({ source: catalogSource, id: record?.id || null, accepted: !reason, reason });
    if (!reason) {
      const identityKey = JSON.stringify([catalogNameKey(record.subject), number(record.cardNumber), record.year, record.provider === 'tcgdex' ? record.setId + ':' + catalogNameKey(record.brandSet) : normalizeValuationSet(record.brandSet, record), key(record.parallel), key(record.language)]);
      accepted.set(identityKey, record);
    }
  }
  if (accepted.size !== 1) return { source: catalogSource, status: accepted.size ? 'ambiguous' : 'insufficient_evidence', ...(investigation ? { candidateInvestigation: investigation } : {}), reason: accepted.size ? 'Collector number has multiple catalog identities or variants' : 'No exact catalog identity', diagnostics };
  const record = [...accepted.values()][0];
  const conflicts = catalogIdentityConflicts(card, record);
  // Conflicts are not silently overwritten: require explicit resolution/rescan.
  return { ...(investigation ? { candidateInvestigation: investigation, requiresNumberConfirmation: investigation.requiresNumberConfirmation && number(record.cardNumber) !== number(card?.cardNumber), requiresConfirmation: investigation.requiresNumberConfirmation && number(record.cardNumber) !== number(card?.cardNumber) } : {}), status: conflicts.length ? 'conflict' : 'verified', source: catalogSource, referenceId: record.id, conflicts, candidate: { subject: record.subject, cardNumber: record.cardNumber, year: record.year, brandSet: record.brandSet, parallel: record.parallel || null, language: record.language || null, ...(record.provider === 'tcgdex' ? { provider: record.provider, setId: record.setId, setCode: record.setCode, localId: record.localId, officialCount: record.officialCount, releaseDate: record.releaseDate, rarity: record.rarity, variants: record.variants, ...(record.printingProvenance ? { printingProvenance: record.printingProvenance } : {}) } : {}) }, diagnostics };
}

export function identitySearchGate(verification, card) {
  const catalog = verification?.catalog;
  const unresolvedFields = ['year', 'set'].filter(field => !['verified', 'corrected', 'user_protected'].includes(verification?.[field]?.status));
  const explicitConflict = ['year', 'set'].some(field => verification?.[field]?.status === 'unresolved_conflict' || (verification?.[field]?.status !== 'user_protected' && !['verified', 'corrected'].includes(verification?.[field]?.status) && (verification?.[field]?.conflictingListingCount > 0 || verification?.[field]?.ambiguousListingCount > 0)));
  const invalidFields = invalidCatalogIdentityFields(card);
  const missingCanonical = invalidFields.length > 0 || invalidCatalogIdentityFields(catalog?.candidate).length > 0 || !validCatalogReference(catalog);
  const finalConflicts = catalogIdentityConflicts(card, catalog?.candidate);
  const blocked = catalog?.requiresConfirmation === true || catalog?.conflicts?.length > 0 || catalog?.requiresLanguageConfirmation === true || missingCanonical || finalConflicts.length > 0 || explicitConflict || !['verified', 'corrected'].includes(catalog?.status);
  return { allowed: !blocked, reason: blocked ? 'identity_unresolved' : null, unresolvedFields, invalidFields, catalogStatus: catalog?.status || 'unavailable', conflicts: finalConflicts };
}

// Recheck the final (possibly variant-reconciled or restored) card, not just the
// earlier proposal. Catalog verification cannot migrate to another identity.
export function catalogIdentityConflicts(card, record) {
  const invalidFields = new Set([...invalidCatalogIdentityFields(card), ...invalidCatalogIdentityFields(record)]);
  const conflicts = ['subject', 'cardNumber', 'year', 'brandSet', 'parallel', 'language'].filter(field => {
    if (invalidFields.has(field)) return true;
    if (!text(card?.[field]) || !text(record?.[field])) return record?.provider === 'tcgdex' && !!text(record?.[field]);
    if (field === 'subject') return catalogNameKey(card[field]) !== catalogNameKey(record[field]);
    if (field === 'cardNumber') return number(card[field]) !== number(record[field]);
    if (record.provider === 'tcgdex') {
      if (field === 'brandSet' && catalogNameKey(card[field]) === catalogNameKey(record[field])) return false;
      if (field === 'brandSet' && [record.setId, record.setCode].filter(Boolean).some(alias => key(alias) === key(card[field]))) return false;
      if (field === 'brandSet' && /[^\x00-\x7f]/.test(card[field] + record[field])) return catalogNameKey(card[field]) !== catalogNameKey(record[field]);
      if (field === 'parallel') return catalogVariantParts(card[field]).artwork !== catalogVariantParts(record[field]).artwork;
      if (field === 'language') return catalogLanguageKey(card[field]) !== catalogLanguageKey(record[field]);
    }
    if (field === 'brandSet') {
      const proposed = normalizeValuationSet(card[field], card);
      const observed = normalizeValuationSet(record[field], record);
      return !proposed || !observed ? catalogNameKey(card[field]) !== catalogNameKey(record[field]) : proposed !== observed;
    }
    return key(card[field]) !== key(record[field]);
  });
  if (record?.provider === 'tcgdex') {
    const proposed = catalogVariantParts(card?.parallel);
    const catalog = catalogVariantParts(record.parallel);
    const structured = catalogVariantParts(card?.variant?.finish).finishes;
    const finishes = [...new Set([...proposed.finishes, ...structured])];
    // An explicit finish needs positive catalog support, never absence of a
    // negative flag. Conflicting label/structured finishes cannot hide each other.
    if (card?.variant?.finish && structured.length !== 1 || finishes.length > 1 || catalog.finishes.length > 1 ||
        finishes.some(finish => record.variants?.[finish] !== true ||
          catalog.finishes.length && !catalog.finishes.includes(finish)) ||
        catalog.finishes.length && !finishes.length) conflicts.push('finish');
    if (card?.variant?.ambiguous || card?.variant?.art &&
        catalogVariantParts(card.variant.art).artwork !== catalog.artwork) conflicts.push('parallel');
  }
  return conflicts;
}

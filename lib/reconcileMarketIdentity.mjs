import { buildNeutralIdentityQuery, fetchIdentityEvidence, matchIdentityEvidence, mergeIdentityEvidence } from './marketIdentityEvidence.mjs';

const text = value => typeof value === 'string' ? value.trim() : '';
const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unusable = reason => ({ value: null, reason });
const aspects = (item, names) => (item.localizedAspects || []).filter(aspect => names.includes(normalize(aspect.name))).map(aspect => text(aspect.value)).filter(Boolean);

function titleWithoutNumbers(item, card) {
  return text(item.title)
    .replace(new RegExp(`(?<![a-z0-9])#?\\s*${escape(card.cardNumber)}(?![a-z0-9])`, 'gi'), ' ')
    .replace(/\b\d{1,4}\s*[/.-]\s*\d{1,4}(?:\s*[/.-]\s*\d{1,4})?\b/g, ' ')
    .replace(/(?:#|\b(?:no\.?|card(?: number)?|serial(?: number)?|numbered|copyright|printed|graded|listed|sold|sale|auction|expires?|ends?))\s*(?:on|in|to)?\s*\d{4}\b/gi, ' ')
    .replace(/\b[a-z]+\d+(?:-\d+)+\b/gi, ' ');
}

export function extractListingYear(item, card) {
  const explicit = aspects(item, ['year manufactured', 'year', 'season']);
  if (explicit.some(value => !/^(19|20)\d{2}$/.test(value))) return unusable('ambiguous');
  const title = titleWithoutNumbers(item, card);
  const years = [...new Set(title.match(/\b(?:19|20)\d{2}\b/g) || [])];
  if (years.length > 1) return unusable('ambiguous');
  const beforeSubject = normalize(title).split(normalize(card.subject))[0];
  const calendarDate = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:\d{1,2}\s+)?(?:19|20)\d{2}\b/i.test(title);
  const titleYear = !calendarDate && years.length === 1 && beforeSubject.includes(years[0]) && !/\b(sold|sale|auction|listed|copyright|printed|graded|expires?|ends?)\b/i.test(title) ? years[0] : null;
  const candidates = [...new Set([...explicit, ...(titleYear ? [titleYear] : [])])];
  return candidates.length === 1 ? { value: candidates[0], reason: 'informative' } : unusable(candidates.length > 1 || years.length ? 'ambiguous' : 'missing');
}

function setKey(value) {
  // Manufacturer/franchise labels and common series prefixes may be omitted.
  let key = normalize(value).replace(/\b(pokemon|tcg|panini|topps|sm|swsh|sv)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\boptic\b/.test(key)) key = key.replace(/\bdonruss\b/g, '').trim();
  return key;
}

function titleSet(item, card) {
  const title = normalize(titleWithoutNumbers(item, card)).replace(/\b(?:19|20)\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim();
  const subject = normalize(card.subject);
  if (!title.includes(subject)) return '';
  const [before, after] = title.split(subject);
  const candidate = before || after;
  // Require a clean product span, not a grab bag of treatment/condition words.
  if (/\b(holo|non|reverse|regular|common|rare|ultra|secret|rainbow|gold|silver|blue|red|purple|green|auto|autograph|patch|relic|psa|bgs|sgc|cgc|mint|nm|raw|graded|card|cards|promo|refractor|parallel|rookie|rc|art|artwork|alternate|alt|special|standard|aa|sp|manga|sand|glitter|english|japanese|german|french|spanish|italian|korean|chinese|new|used|sale|shipping|free|authentic|genuine|original)\b/.test(candidate)) return '';
  const key = setKey(candidate);
  if (!key || key.split(' ').length > 6 || /\b\d{4}\b/.test(key)) return '';
  return candidate.replace(/\b(pokemon|tcg|sm|swsh|sv)\b/g, '').replace(/\s+/g, ' ').trim();
}

export function extractListingSet(item, card) {
  const explicit = aspects(item, ['set', 'product', 'product set']);
  const derived = titleSet(item, card);
  const values = [...explicit, ...(derived ? [derived] : [])];
  const keys = [...new Set(values.map(setKey).filter(Boolean))];
  if (keys.length !== 1) return unusable(keys.length ? 'ambiguous' : 'missing');
  return { value: explicit.length ? values[0] : values[0].replace(/\b[a-z]/g, letter => letter.toUpperCase()), key: keys[0], reason: 'informative' };
}

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
export { setKey as normalizeMarketSet };

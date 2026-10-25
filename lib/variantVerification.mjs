import { extractListingYear, extractListingSet, normalizeMarketSet } from "./listingIdentityEvidence.mjs";
import { buildNeutralIdentityQuery, matchIdentityEvidence, mergeIdentityEvidence } from './marketIdentityEvidence.mjs';

const clean = value => typeof value === 'string' ? value.trim() : '';
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’'“”"]/g, '').replace(/[^a-z0-9/]+/g, ' ').trim();
const fields = ['kind', 'finish', 'art', 'color', 'treatment', 'printRun', 'autograph', 'relic'];
const colors = /\b(black|blue|bronze|gold|green|orange|pink|purple|red|silver|white|yellow|aqua|teal|ruby|sapphire|copper)\b/g;
const treatments = /\b(sand glitter|refractor|shimmer|sparkle|wave|shock|velocity|mojo|cracked ice|disco|camo|rainbow|tiger|zebra|genesis|pulsar|checkerboard|laser|hyper|atomic|xfractor|superfractor|textured|etched|glitter|prizm)\b/g;
const unique = values => [...new Set(values)];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function describeVariant(value, card = {}) {
  let t = normalize(value);
  // Subject/set words are identity, not treatment labels (e.g. White Dragon).
  for (const part of [card.subject, card.brandSet, card.set, card.player]) if (clean(part)) t = t.replace(new RegExp(`\\b${escape(normalize(part))}\\b`, 'g'), ' ');
  t = t.replace(/\b(?:special illustration rare|sir)\b/g, 'special art').replace(/\b(?:special\s*\/\s*(?:alternate|alt)|(?:alternate|alt)\s*\/\s*special)\s*art\b/g, 'special art alternate art')
    .replace(/\b(?:alt(?:ernate)?\s*(?:art(?:work)?)|aa)\b/g, 'alternate art')
    .replace(/\b(?:special\s*art(?:work)?|sp)\b/g, 'special art')
    .replace(/\bstandard\s*(?:art(?:work)?)\b/g, 'standard art')
    .replace(/\bnon\s*(?:holo(?:graphic|foil)?|foil)\b/g, 'nonholo')
    .replace(/\breverse\s*(?:holo(?:graphic|foil)?|foil)\b/g, 'reverseholo')
    .replace(/\b(?:holographic|holofoil|foil)\b/g, 'holo');
  const finishes = unique(t.match(/\b(nonholo|reverseholo|holo)\b/g) || []);
  const arts = unique(t.match(/\b(standard art|alternate art|special art|manga)\b/g) || []);
  const color = unique(t.match(colors) || []).sort().join(' ') || null;
  const treatment = unique(t.match(treatments) || []).filter(token => token !== 'prizm' || !/\bprizm\b/.test(normalize(card.brandSet || card.set))).sort().join(' ') || null;
  // A fractional collector number is never a numbered print run.
  const numberless = clean(card.cardNumber) ? t.replace(new RegExp(escape(normalize(card.cardNumber)), 'g'), '') : t;
  const runs = unique([...numberless.matchAll(/\/\s*(\d+)\b|\b(?:numbered|serial|print run)\s*(?:to|of)?\s*(\d+)\b/g)].map(match => String(Number(match[1] || match[2]))));
  const noAuto = /\b(?:no|non)\s*(?:auto|autograph|signature)\b/.test(t);
  const noRelic = /\b(?:no|non)\s*(?:patch|relic|jersey|memorabilia)\b/.test(t);
  const positiveAuto = /\b(auto|autograph(?:ed|s)?|signature(?:s)?|signed)\b/.test(t.replace(/\b(?:no|non)\s*(?:auto|autograph|signature)\b/g, ''));
  const autograph = noAuto ? false : positiveAuto ? true : null;
  const positiveRelic = /\b(patch|relic|jersey|memorabilia)\b/.test(t.replace(/\b(?:no|non)\s*(?:patch|relic|jersey|memorabilia)\b/g, ''));
  const relic = noRelic ? false : positiveRelic ? true : null;
  const kind = /\binsert\b/.test(t) ? 'insert' : color || treatment || arts.some(art => art !== 'standard art') || /\bparallel\b/.test(t) ? 'parallel' : /\bbase\b/.test(t) || arts.includes('standard art') ? 'base' : null;
  return {
    kind,
    finish: finishes.length === 1 ? ({ nonholo: 'non-holo', reverseholo: 'reverse-holo', holo: 'holo' })[finishes[0]] : null,
    art: arts.length === 1 ? arts[0] : kind === 'base' ? 'standard art' : null,
    color, treatment,
    printRun: runs.length === 1 ? runs[0] : null,
    autograph, relic,
    ambiguous: finishes.length > 1 || arts.length > 1 || runs.length > 1 || noAuto && positiveAuto || noRelic && positiveRelic,
  };
}

function listingVariant(item, card) {
  if (typeof item === 'string') return describeVariant(item, card);
  const attributes = (item.localizedAspects || []).flatMap(aspect => {
    const name = normalize(aspect.name);
    if (name === 'autographed') return /^yes$/i.test(aspect.value) ? ['auto'] : /^no$/i.test(aspect.value) ? ['no auto'] : [];
    if (name === 'memorabilia') return /^yes$/i.test(aspect.value) ? ['relic'] : /^no$/i.test(aspect.value) ? ['no relic'] : [aspect.value];
    if (name === 'print run') return /^\d+$/.test(aspect.value) ? [`/${aspect.value}`] : [aspect.value];
    return ['parallel/variety', 'parallel variety', 'features'].includes(name) ? [aspect.value] : [];
  });
  return describeVariant([item.title, ...attributes].join(' '), card);
}

export function variantFromCard(card) {
  const result = describeVariant(card?.parallel, card || {});
  const residual = normalize(card?.parallel).replace(colors, '').replace(treatments, '')
    .replace(/\b(non\s*holo(?:graphic|foil)?|reverse\s*holo(?:graphic|foil)?|holo(?:graphic|foil)?|foil|common|regular|normal|base|parallel|insert|standard|special|alternate|alt|artwork|art|aa|sp|manga|auto|autograph|relic|patch|none|unknown|no|non)\b/g, '')
    .replace(/\d+|[\s/]+/g, '');
  result.unrecognized = Boolean(residual);
  if (card?.printRun) result.printRun = String(card.printRun).replace(/^\//, '');
  const features = describeVariant(card?.autoOrRelic);
  if (features.autograph !== null) result.autograph = features.autograph;
  if (features.relic !== null) result.relic = features.relic;
  if (/^(none|base|no|false)$/i.test(clean(card?.autoOrRelic))) { result.autograph = false; result.relic = false; }
  return result;
}

function variantLabel(variant) {
  const label = [variant.kind === 'insert' ? 'Insert' : variant.kind === 'base' ? 'Base' : null, variant.color, variant.treatment, variant.finish, variant.art, variant.printRun && `/${variant.printRun}`].filter(Boolean).join(' ');
  return label.replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

export function parseVariantConfirmation(value) {
  let input = value;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch { return null; } }
  if (!input || typeof input !== 'object' || !clean(input.parallel) || input.parallel.length > 140) return null;
  const label = describeVariant(input.parallel);
  const result = variantFromCard(input);
  if (label.autograph === true && result.autograph === false || label.relic === true && result.relic === false) return null;
  if (result.ambiguous || result.unrecognized || !fields.some(field => result[field] !== null)) return null;
  return { ...input, variant: result };
}

export function reconcileVariant(original, canonical, evidence, confirmation = null) {
  const proposal = variantFromCard(original || canonical);
  const query = normalize(buildNeutralIdentityQuery(original || canonical));
  const excludedEvidenceReferences = [];
  const independent = evidence?.search?.status === 'retrieved' ? (evidence.identityEvidenceItems || []).filter(item => item.source === 'ebay_browse' && (item.itemId || item.itemWebUrl)).map(item => ({
    ...item,
    observations: (item.observations || []).filter(observation => {
      if (observation.searchType !== 'neutral_subject_card_number' || !query || normalize(observation.query) !== query || !matchIdentityEvidence(observation.originalItem, original || canonical)) return false;
      const year = extractListingYear(observation.originalItem, canonical || original);
      const set = extractListingSet(observation.originalItem, canonical || original);
      if (year.value && canonical?.year && year.value !== canonical.year || set.value && canonical?.brandSet && normalizeMarketSet(set.value) !== normalizeMarketSet(canonical.brandSet)) {
        excludedEvidenceReferences.push({ itemId: item.itemId, itemWebUrl: item.itemWebUrl, title: observation.originalItem.title, reason: 'Conflicts with reconciled year/set' });
        return false;
      }
      return true;
    }),
  })).filter(item => item.observations.length) : [];
  const pool = mergeIdentityEvidence(independent);
  const evidenceItems = pool.map(item => {
    const readings = item.observations.map(observation => {
      return listingVariant(observation.originalItem, canonical || original || {});
    });
    const details = {};
    let changedObservation = false;
    for (const field of fields) {
      const values = unique(readings.filter(reading => !reading.ambiguous && reading[field] !== null).map(reading => reading[field]));
      details[field] = values.length === 1 ? values[0] : null;
      if (values.length > 1) changedObservation = true;
    }
    return { itemId: item.itemId, itemWebUrl: item.itemWebUrl, title: item.title, details, ambiguous: changedObservation || readings.some(reading => reading.ambiguous) };
  });
  const resolved = { ...proposal };
  const verification = {};
  const conflicts = [];
  let changed = false;
  let unresolved = proposal.ambiguous || proposal.unrecognized;
  let required = 0;
  let supported = 0;
  for (const field of fields) {
    const informative = evidenceItems.filter(item => !item.ambiguous && item.details[field] !== null);
    const votes = new Map();
    for (const item of informative) {
      const value = item.details[field];
      const group = votes.get(value) || [];
      group.push(item); votes.set(value, group);
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1].length - a[1].length);
    const candidate = ranked[0]?.[0] ?? null;
    const count = ranked[0]?.[1].length || 0;
    const consensus = informative.length ? count / informative.length : 0;
    const sufficient = count >= 3 && consensus >= 0.6;
    const contradicting = informative.filter(item => proposal[field] !== null && item.details[field] !== proposal[field]);
    conflicts.push(...contradicting.map(item => ({ field, proposedValue: proposal[field], observedValue: item.details[field], itemId: item.itemId, itemWebUrl: item.itemWebUrl, title: item.title })));
    const material = proposal[field] !== null && proposal[field] !== false || informative.some(item => item.details[field] !== false);
    if (material) {
      required++;
      if (sufficient) {
        supported++;
        resolved[field] = candidate;
        if (proposal[field] !== candidate) changed = true;
      } else if (contradicting.length || votes.size > 1 || proposal[field] === null && informative.some(item => item.details[field] !== false)) unresolved = true;
    }
    verification[field] = { originalValue: proposal[field], value: sufficient && material ? candidate : proposal[field], supportingListingCount: count, informativeEvidenceCount: informative.length, consensus, evidenceReferences: ranked[0]?.[1] || [] };
  }
  // Do not synthesize a multi-attribute correction from unrelated majorities.
  const changedFields = fields.filter(field => resolved[field] !== proposal[field]);
  const jointlyInformative = evidenceItems.filter(item => !item.ambiguous && changedFields.every(field => item.details[field] !== null));
  const jointSupport = jointlyInformative.filter(item => changedFields.every(field => item.details[field] === resolved[field]));
  if (changed && (jointSupport.length < 3 || jointSupport.length / Math.max(1, jointlyInformative.length) < 0.6)) {
    unresolved = true;
    Object.assign(resolved, proposal);
    changed = false;
  }
  const confirmed = confirmation && parseVariantConfirmation(confirmation);
  if (confirmed) Object.assign(resolved, confirmed.variant);
  const incomplete = !required || supported < required;
  const materialAmbiguity = unresolved || evidenceItems.some(item => item.ambiguous) || incomplete && (conflicts.length > 0 || proposal.color || proposal.treatment || proposal.printRun || proposal.art && proposal.art !== 'standard art' || proposal.autograph || proposal.relic);
  const status = confirmed ? 'user_confirmed' : unresolved || evidenceItems.some(item => item.ambiguous) || incomplete && conflicts.length > 0 ? 'needs_confirmation' : incomplete ? 'insufficient_evidence' : changed ? 'corrected' : 'verified';
  const explanation = confirmed ? 'Version confirmed by the user. Fresh comparable listings are required before valuation.' : status === 'verified' ? 'Neutral listing evidence supports the proposed version.' : status === 'corrected' ? 'At least three neutral listings and 60% consensus support the updated version.' : materialAmbiguity ? 'Variant evidence is mixed or incomplete. Check the foil, artwork, parallel, print run and autograph/relic details before pricing.' : 'Not enough informative neutral listings to independently verify the version.';
  const card = canonical ? { ...canonical } : null;
  if (card) {
    card.variant = resolved;
    if (changed && status === 'corrected' || confirmed) {
      card.parallel = confirmed ? confirmed.parallel : variantLabel(resolved);
      card.printRun = resolved.printRun;
      card.autoOrRelic = resolved.autograph === true && resolved.relic === true ? 'auto relic' : resolved.autograph === true ? 'auto' : resolved.relic === true ? 'relic' : 'none';
      card.displayName = [card.year, card.brandSet, card.subject, card.parallel, card.cardNumber && `#${card.cardNumber}`].filter(Boolean).join(' ');
    }
  }
  return { canonicalCard: card, variantVerification: { status, originalProposal: { parallel: original?.parallel ?? null, autoOrRelic: original?.autoOrRelic ?? null, printRun: original?.printRun ?? null }, value: resolved, fields: verification, materialAmbiguity: Boolean(materialAmbiguity && !confirmed), explanation, conflicts, excludedEvidenceReferences, evidenceReferences: evidenceItems } };
}

// Additional valuation protection; this never promotes an already rejected match.
export function matchesVariantValuation(title, card) {
  const expected = card.variant || variantFromCard(card);
  const actual = listingVariant(title, card);
  if (expected.ambiguous || actual.ambiguous) return false;
  for (const field of fields) {
    if (expected[field] === null || expected[field] === undefined) {
      if (actual[field] !== null && actual[field] !== false && !['base', 'standard art', 'non-holo'].includes(actual[field])) return false;
      continue;
    }
    if (field === 'art' && expected.art === 'standard art' && actual.art === null && actual.kind === 'base') continue;
    if (field === 'kind' && expected.kind === 'base' && actual.kind === null && actual.art === 'standard art') continue;
    if (actual[field] !== null && actual[field] !== expected[field]) return false;
    if (['kind', 'art', 'color', 'treatment', 'printRun', 'finish'].includes(field) || expected[field] === true) {
      if (actual[field] !== expected[field]) return false;
    }
  }
  return true;
}

export function expandVariantAliases(title) {
  return title.replace(/\b(?:special illustration rare|sir)\b/gi, 'Special Art').replace(/\b(?:alt(?:ernate)?\s*art(?:work)?|AA)\b/gi, 'Alternate Art').replace(/\b(?:special\s*art(?:work)?|SP)\b/gi, 'Special Art').replace(/\bnonholo\b/gi, 'Non-Holo');
}

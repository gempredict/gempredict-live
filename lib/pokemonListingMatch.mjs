import { structuredListingConflicts } from './listingStructuredEvidence.mjs';
import { catalogLanguageKey } from './catalogNormalization.mjs';
import { unofficialReasons } from './cardAuthenticity.mjs';
import { readValuationSetEvidence, normalizeValuationSet } from './listingIdentityEvidence.mjs';

// Conservative title matching for raw-card asking-price comparables.
const clean = value => value == null || /^(unknown|null|n\/a|none)$/i.test(String(value).trim()) ? '' : String(value).trim();
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const words = value => normalize(value).split(' ').filter(Boolean);
const contains = (title, value) => words(value).every(word => words(title).includes(word));
const variants = /\b(black|blue|bronze|gold|green|orange|pink|purple|red|silver|white|yellow|aqua|teal|ruby|sapphire|refractor|prizm|holo|holographic|shimmer|sparkle|wave|shock|velocity|mojo|cracked ice|crackle|disco|camo|copper|rainbow|tiger|zebra|genesis|pulsar|checkerboard|laser|hyper|atomic|xfractor|superfractor)\b/g;
const autoPattern = /\b(auto|autos|autograph(?:ed|s)?|signature(?:s)?|signed)\b/i;
const relicPattern = /\b(patch|patches|relic|relics|jersey|memorabilia)\b/i;
const hasAuto = value => autoPattern.test(clean(value).replace(/\b(?:no|non)[ -]?(?:auto(?:graph)?|signature)\b/gi, ''));
const hasRelic = value => relicPattern.test(clean(value).replace(/\b(?:no|non)[ -]?(?:relic|patch|jersey|memorabilia)\b/gi, ''));
const runOf = value => clean(value).match(/\/\s*(\d+)\b/)?.[1] || clean(value).match(/\b(?:numbered|serial|print run)\s*(?:to|of)?\s*(\d+)\b/i)?.[1] || '';
const numberKey = value => normalize(value).split(' ').map(part => /^\d+$/.test(part) ? String(Number(part)) : part).join('');

// Treat finish negation as identity information, not a positive holo keyword.
const finishPattern = /\b(non\s*(?:holo(?:graphic|foil)?|foil)|reverse\s*(?:holo(?:graphic|foil)?|foil)|holo(?:graphic|foil)?|foil)\b/g;
const finishesOf = value => [...normalize(value).matchAll(finishPattern)].map(([finish]) =>
  finish.startsWith('non') ? 'non-holo' : finish.startsWith('reverse') ? 'reverse-holo' : 'holo');
const withoutFinish = value => normalize(value).replace(finishPattern, '');
const products = /\b(optic|prizm|select|mosaic|contenders|chronicles|chrome|finest|heritage|stadium club|bowman|shining legends|shining fates|hidden fates|base set|jungle|fossil|team rocket|evolving skies|lost origin|crown zenith|silver tempest|brilliant stars|paldean fates|scarlet violet)\b/g;
const productNames = value => new Set(normalize(value).match(products) || []);

function matchSet(title, set, exactCard, card, listing) {
  const observed = readValuationSetEvidence({ ...listing, title }, { ...card, brandSet: set });
  const expectedKey = normalizeValuationSet(set, { ...card, brandSet: set });
  if (observed.some(reading => reading.key !== expectedKey)) return 'conflict';
  if (observed.some(reading => reading.key === expectedKey)) return 'match';
  const expected = productNames(set);
  const actual = productNames(title);
  if ([...actual].some(product => !expected.has(product))) return 'conflict';
  if (contains(title, set)) return 'match';
  // Optic is the identifying product name; Panini/Donruss are often omitted.
  const requiredWords = words(set).filter(word => !['panini', 'pokemon', 'tcg'].includes(word) && !(word === 'donruss' && expected.has('optic')));
  if (requiredWords.length && requiredWords.every(word => words(title).includes(word))) return 'match';
  return exactCard ? 'missing' : 'unconfirmed';
}

export function getListingType(title, condition = '', listing = {}) {
  if (unofficialReasons({ ...listing, title }).length) return 'excluded';
  if (/\b(lot|bundle|set of|pack|packs|box|boxes|case|cases|digital|repack|break)\b|\bx\s*\d+\b|\b\d+\s*x\b|\b\d+\s+cards\b|\byou (?:pick|choose)\b/i.test(title)) return 'excluded';
  if (/graded/i.test(condition) && !/ungraded/i.test(condition) || /\b(psa|bgs|sgc|cgc|csg|hga|slab|slabbed|graded)\b/i.test(title)) return 'graded';
  return 'raw';
}

export function readMarketIdentity(params = {}) {
  const identity = {};
  for (const key of ['game', 'language', 'year', 'brand', 'set', 'player', 'cardName', 'cardNumber', 'parallel', 'autoOrRelic', 'printRun', 'variantIdentity']) {
    identity[key] = typeof params[key] === 'string' ? clean(params[key]) || null : null;
  }
  return identity;
}

export function buildEbaySearchParams(query, card) {
  const params = new URLSearchParams({ q: query });
  if (card) {
    const fields = { language: card.language, player: card.subject, year: card.year, set: card.brandSet, cardNumber: card.cardNumber, parallel: card.parallel, autoOrRelic: card.autoOrRelic, printRun: card.printRun, variantIdentity: card.variant ? JSON.stringify(card.variant) : null };
    for (const [key, value] of Object.entries(fields)) if (clean(value)) params.set(key, clean(value));
  }
  return params;
}

export function buildStructuredQuery(identity) {
  return [identity.year, identity.brand, identity.set, identity.player || identity.cardName, identity.cardNumber && `#${identity.cardNumber}`, identity.parallel, identity.printRun && `/${identity.printRun}`, identity.autoOrRelic && !/^(unknown|none|no|false|base)$/i.test(identity.autoOrRelic) && identity.autoOrRelic].filter(Boolean).join(' ');
}

export function scoreListing(title, query, identity = {}, listing = {}) {
  const reasons = [];
  const conflicts = structuredListingConflicts({ ...listing, title }, identity);
  if (conflicts.length) return { score: 0, reasons: conflicts, comparable: false };
  const t = normalize(title);
  const q = normalize(query);
  const structured = Object.values(identity).some(value => clean(value));
  const subject = clean(identity.player || identity.cardName);
  const year = clean(identity.year) || clean(query).match(/\b(?:19|20)\d{2}(?:-\d{2})?\b/)?.[0];
  const cardNumber = clean(identity.cardNumber) || clean(query).match(/#\s*([a-z0-9]+(?:[-/][a-z0-9]+)*)/i)?.[1];
  const set = [identity.brand, identity.set].filter(Boolean).join(' ');
  // A canonical identity takes precedence over a broader fallback query.
  const variantSource = identity.parallel ? normalize(identity.parallel) : (structured ? '' : q);
  const expectedVariants = new Set(withoutFinish(variantSource).match(variants) || []);
  const actualVariants = new Set(withoutFinish(t).match(variants) || []);
  // Product names such as Prizm are not automatically parallel labels.
  for (const token of words([set, subject].filter(Boolean).join(" "))) { expectedVariants.delete(token); actualVariants.delete(token); }
  const autoRelic = clean(identity.autoOrRelic);
  const featureSource = autoRelic && !/^(unknown|no|false|base)$/i.test(autoRelic) ? `${autoRelic} ${identity.parallel || ''}` : (structured ? identity.parallel || '' : query);
  const expectedAuto = hasAuto(featureSource);
  const expectedRelic = hasRelic(featureSource);
  const queryWithoutCardFraction = cardNumber?.includes('/') ? query.replace(cardNumber, '') : query;
  const expectedRun = clean(identity.printRun).replace(/^\//, '') || runOf(identity.parallel) || (!structured ? runOf(queryWithoutCardFraction) : '');
  const expectedProducts = productNames(set || query);
  const titleProducts = productNames(title);
  if (expectedProducts.size && [...titleProducts].some(product => !expectedProducts.has(product))) conflicts.push('Conflicting product');
  if (identity.language) {
    const titleLanguages = clean(title).match(/\b(?:English|Japanese|French|German|Spanish|Italian|Portuguese|Korean|Chinese|Thai|Indonesian)\b/gi) || [];
    const structuredLanguages = (listing.localizedAspects || []).filter(aspect => /^language$/i.test(aspect.name || '')).map(aspect => aspect.value);
    const observed = [...titleLanguages, ...structuredLanguages].filter(Boolean).map(catalogLanguageKey);
    if (!observed.length) conflicts.push('Listing language not verified');
    else if (observed.some(value => value !== catalogLanguageKey(identity.language))) conflicts.push('Conflicting card language');
    else reasons.push('Same card language');
  }
  let score = 0;
  const check = (ok, match, mismatch, weight) => {
    if (ok) { score += weight; reasons.push(match); } else conflicts.push(mismatch);
  };
  if (subject) check(contains(title, subject), 'Same subject', 'Subject mismatch', 40);
  if (year) {
    const listedYears = clean(title).match(/\b(?:19|20)\d{2}(?:-\d{2})?\b/g) || [];
    if (listedYears.length) check(listedYears.every(listed => normalize(listed) === normalize(year)), 'Same year', 'Year mismatch', 15);
    else reasons.push('Year not stated');
  }
  if (set) {
    const setMatch = matchSet(title, set, Boolean(subject && cardNumber && contains(title, subject)), { subject, cardNumber, year }, listing);
    if (setMatch === 'missing') reasons.push('Product/set not fully stated');
    else if (setMatch === 'conflict') conflicts.push('Conflicting product/set evidence');
    else check(setMatch === 'match', 'Same product/set', 'Product/set mismatch or unconfirmed', 20);
  }
  if (cardNumber) {
    const expected = numberKey(cardNumber);
    const explicit = [...clean(title).matchAll(/(?:#\s*|\bno\.?\s*|\bcard(?:\s+number)?\s*#?\s+)((?=[a-z0-9/-]*\d)[a-z0-9]+(?:[-/][a-z0-9]+)*)\b/gi)].map(match => numberKey(match[1]));
    // Remove dates and serial fractions before checking an unmarked card number.
    const remaining = clean(title).replace(/\b(?:19|20)\d{2}(?:-\d{2})?\b/g, '').replace(cardNumber.includes('/') ? /$^/ : /\b\d*\s*\/\s*\d+\b/g, '');
    const tokens = remaining.match(/[a-z0-9]+(?:[-/][a-z0-9]+)*/gi) || [];
    check(explicit.length ? explicit.every(value => value === expected) : tokens.some(value => numberKey(value) === expected), 'Same card number', 'Card number mismatch or missing', 30);
  }
  if (identity.parallel && !/^(base|normal|regular)$/i.test(identity.parallel)) {
    const parallelName = withoutFinish(identity.parallel.replace(/\d*\s*\/\s*\d+/g, '')).trim();
    // Common describes rarity here; the non-holo treatment is checked below.
    const commonNonHolo = parallelName === 'common' && finishesOf(identity.parallel).every(finish => finish === 'non-holo') && finishesOf(identity.parallel).length > 0;
    if (parallelName && !commonNonHolo) check(contains(title, parallelName), 'Parallel match', 'Parallel mismatch or missing', 20);
  }
  const expectedFinishes = finishesOf(structured ? identity.parallel : query);
  const actualFinishes = finishesOf(title);
  if (expectedFinishes.length) {
    if (!actualFinishes.length || actualFinishes.some(finish => !expectedFinishes.includes(finish)) || expectedFinishes.some(finish => !actualFinishes.includes(finish))) conflicts.push('Holo finish mismatch');
  } else if (actualFinishes.some(finish => finish !== 'non-holo')) {
    conflicts.push('Unexpected holo finish');
  }
  if ([...actualVariants].some(value => !expectedVariants.has(value)) || [...expectedVariants].some(value => !actualVariants.has(value))) conflicts.push('Conflicting parallel');
  if (hasAuto(title) !== expectedAuto) conflicts.push('Autograph mismatch');
  else if (expectedAuto) { score += 20; reasons.push('Autograph match'); }
  if (hasRelic(title) !== expectedRelic) conflicts.push('Relic mismatch');
  else if (expectedRelic) { score += 20; reasons.push('Relic match'); }
  const titleWithoutCardFraction = cardNumber?.includes('/') ? title.replace(new RegExp(cardNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '') : title;
  if (runOf(titleWithoutCardFraction) !== expectedRun) conflicts.push('Numbered print run mismatch');
  else if (expectedRun) { score += 20; reasons.push('Numbered print run match'); }
  // Query-only calls still require strong token coverage, rather than rewarding
  // unrelated prototype keywords. Repeated words never inflate the score.
  const titleHasYear = /\b(?:19|20)\d{2}\b/.test(title);
  const queryWords = [...new Set(words(query))].filter(word => {
    if (!titleHasYear && year && words(year).includes(word)) return false;
    if (expectedProducts.has('optic') && ['panini', 'donruss'].includes(word)) return false;
    return true;
  });
  const coverage = queryWords.length ? queryWords.filter(word => words(title).includes(word)).length / queryWords.length : 0;
  if (!subject && !set && !cardNumber) {
    check(coverage === 1, 'Search query match', 'Search query mismatch', 100);
  } else if (!subject) {
    check(coverage === 1, 'Search query match', 'Search query mismatch', 60);
  } else {
    score += Math.round(coverage * 40);
  }
  conflicts.push(...unofficialReasons({ ...listing, title }).map(reason => `Unofficial card: ${reason.source}`));
  if (getListingType(title, '', listing) === 'excluded') conflicts.push('Lot or irrelevant product');
  if (conflicts.length) return { score: 0, reasons: [...new Set(conflicts)], comparable: false };
  return { score, reasons: [...new Set(reasons)], comparable: true };
}

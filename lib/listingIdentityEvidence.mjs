// Pure listing observations shared by reconciliation and strict valuation.
const text = value => typeof value === 'string' ? value.trim() : '';
const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unusable = reason => ({ value: null, reason });
const aspects = (item, names) => (item.localizedAspects || []).filter(aspect => names.includes(normalize(aspect.name))).map(aspect => text(aspect.value)).filter(Boolean);

function titleWithoutNumbers(item, card) {
  return (card.cardNumber ? text(item.title).replace(new RegExp(`(?<![a-z0-9])#?\\s*${escape(card.cardNumber)}(?![a-z0-9])`, 'gi'), ' ') : text(item.title))
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

export function normalizeMarketSet(value) {
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
  const key = normalizeMarketSet(candidate);
  if (!key || key.split(' ').length > 6 || /\b\d{4}\b/.test(key)) return '';
  return candidate.replace(/\b(pokemon|tcg|sm|swsh|sv)\b/g, '').replace(/\s+/g, ' ').trim();
}

export function extractListingSet(item, card) {
  const explicit = aspects(item, ['set', 'product', 'product set']);
  const derived = titleSet(item, card);
  const values = [...explicit, ...(derived ? [derived] : [])];
  const keys = [...new Set(values.map(normalizeMarketSet).filter(Boolean))];
  if (keys.length !== 1) return unusable(keys.length ? 'ambiguous' : 'missing');
  return { value: explicit.length ? values[0] : values[0].replace(/\b[a-z]/g, letter => letter.toUpperCase()), key: keys[0], reason: 'informative' };
}

// Valuation must retain individual observations: a correct structured value
// cannot erase an explicitly contradictory title (or vice versa).
export function normalizeValuationSet(value, card = {}) {
  const expectedSport = /\b(?:baseball|football|basketball|soccer|hockey)\b/i.test(card.brandSet);
  return normalizeMarketSet(text(value)
    .replace(/^(?:set|product(?: set)?)\s*:\s*/i, '')
    .replace(card.year ? new RegExp(`^${escape(String(card.year))}\\s+`) : /$^/, '')
    .replace(/\b(?:trading card game|card game|trading cards?|sports cards?|cards?)\b/gi, ' ')
    .replace(expectedSport ? /$^/ : /\b(?:baseball|football|basketball|soccer|hockey)\b/gi, ' '))
    // Expanded wording of the SM/SWSH/SV series prefixes already accepted by
    // reconciliation. Keep a standalone series name as a meaningful product.
    .replace(/^(?:sun moon|sword shield|scarlet violet)\s+(?=\S)/, '');
}

export function readValuationSetEvidence(item, card) {
  const keyOf = value => normalizeValuationSet(value, card);
  const uncertain = /\b(?:sale|shipping|free|price|deal|beautiful|best|invest|investment|hot|error|misprint|limited|edition|look|read)\b/;
  const readings = aspects(item, ['set', 'product', 'product set']).filter(value =>
    !/^(?:unknown|n\/?a|none|not (?:specified|applicable)|does not apply|other|various|mixed|see description)$/i.test(value)
  ).map(value => ({ value, key: keyOf(value), source: 'structured' }));
  const expectedKey = keyOf(card.brandSet);
  const withoutTreatment = value => {
    const protectedSpan = expectedKey ? value.replace(new RegExp(`\\b${escape(expectedKey)}\\b`, 'g'), 'expectedsetplaceholder') : value;
    return protectedSpan.replace(/\b(?:non|reverse)?\s*(?:holo(?:graphic|foil)?|foil)\b/g, ' ')
      .replace(/\brated rookie\b|\b(?:english|japanese|german|french|spanish|italian|korean|chinese)\b/g, ' ')
      .replace(/\bexpectedsetplaceholder\b/g, expectedKey).replace(/\s+/g, ' ').trim();
  };
  const derived = withoutTreatment(titleSet(item, card)).replace(/^(?:product set|product|set)\s+/, '');
  const title = text(item.title);
  const context = /\b(?:19|20)\d{2}\b|\b(?:pokemon|panini|topps|donruss)\b|\b(?:set|product)\s*:/i.test(title);
  const defensible = value => {
    const key = keyOf(value);
    return key && (key === expectedKey || key.split(' ').length >= 2 || context || /\b(?:optic|prizm|select|mosaic|chrome|bowman)\b/.test(key));
  };
  if (derived && !uncertain.test(derived) && defensible(derived)) readings.push({ value: derived, key: keyOf(derived), source: 'title' });

  // Also support a set after the collector ID followed by common condition /
  // treatment wording. Refuse marketing/ambiguous spans rather than guessing a
  // product from arbitrary seller prose. This does not create independent votes.
  if (!derived) {
    const subject = normalize(card.subject);
    const normalizedTitle = normalize(titleWithoutNumbers(item, card)).replace(/\b(?:19|20)\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (subject && normalizedTitle.includes(subject)) {
      for (const span of normalizedTitle.split(subject)) {
        if (uncertain.test(span)) continue;
        const candidate = withoutTreatment(span).replace(/^(?:product set|product|set)\s+/, '')
          .replace(/\b(?:regular|common|rare|ultra|secret|nm|lp|mp|hp|mint|near|raw|ungraded|graded|psa|bgs|sgc|cgc|rookie|rc|standard|alternate|special|alt|art|artwork|base(?!\s+set)|parallel)\b/g, ' ')
          .replace(/\s+/g, ' ').trim();
        if (!candidate || /\b(?:\d+|auto|autograph|patch|relic|green|blue|purple|red|gold|silver|sand|glitter|shock|refractor)\b/.test(candidate) || candidate.split(' ').length > 6 || !defensible(candidate)) continue;
        readings.push({ value: candidate, key: keyOf(candidate), source: 'title' });
      }
    }
  }
  return readings.filter(reading => reading.key);
}

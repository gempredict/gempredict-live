// Pure variant-label parsing shared by listing evidence and reconciliation.
const clean = value => typeof value === 'string' ? value.trim() : '';
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’'“”"]/g, '').replace(/[^a-z0-9/]+/g, ' ').trim();
export const colors = /\b(black|blue|bronze|gold|green|orange|pink|purple|red|silver|white|yellow|aqua|teal|ruby|sapphire|copper)\b/g;
export const treatments = /\b(sand glitter|refractor|shimmer|sparkle|wave|shock|velocity|mojo|cracked ice|disco|camo|rainbow|tiger|zebra|genesis|pulsar|checkerboard|laser|hyper|atomic|xfractor|superfractor|textured|etched|glitter|prizm)\b/g;
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

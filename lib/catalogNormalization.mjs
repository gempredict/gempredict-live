export const catalogNameKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function catalogVariantKey(value) {
  const valueKey = key(value);
  return ['sir', 'special illustration rare', 'special art'].includes(valueKey) ? 'special art' : valueKey;
}
export function catalogLanguageKey(value) {
  const valueKey = key(value);
  return ({ english: 'en', french: 'fr', german: 'de', spanish: 'es', italian: 'it', portuguese: 'pt', japanese: 'ja', indonesian: 'id', thai: 'th', 'traditional chinese': 'zh tw', chinese: 'zh tw' })[valueKey] || valueKey;
}

// Keep artwork and finish separate. Removing a finish from a label is only
// safe when the caller independently checks the catalog's finish capabilities.
export function catalogVariantParts(value) {
  const normalized = key(value);
  const finishes = [];
  const artwork = normalized.replace(/\b(non\s*holo(?:graphic|foil)?|reverse\s*holo(?:graphic|foil)?|holo(?:graphic|foil)?|foil)\b/g, token => {
    finishes.push(/^non/.test(token) ? 'normal' : /^reverse/.test(token) ? 'reverse' : 'holo');
    return ' ';
  });
  return { artwork: catalogVariantKey(artwork), finishes: [...new Set(finishes)] };
}

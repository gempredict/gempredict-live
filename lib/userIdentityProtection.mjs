const text = value => typeof value === 'string' ? value.trim() : '';
const yearPattern = /(?<![a-z0-9/#-])(?:19|20)\d{2}(?:[-/](?:\d{4}|\d{2}))?(?![a-z0-9/-])/gi;
const distinct = values => [...new Map(values.filter(Boolean).map(value => [value.toLowerCase(), value])).values()];

function yearsIn(value) {
  // Card IDs and serial fractions are not explicit year choices.
  return text(typeof value === 'number' && Number.isInteger(value) ? String(value) : value).replace(/#\s*[a-z0-9]+(?:[-/][a-z0-9]+)*/gi, '').match(yearPattern) || [];
}

export function getUserIdentityProtection({ cardName, cardSet, year, set, confirmedIdentity } = {}) {
  let confirmed = confirmedIdentity;
  if (typeof confirmed === 'string') {
    try { confirmed = JSON.parse(confirmed); } catch { confirmed = null; }
  }
  if (!confirmed || typeof confirmed !== 'object' || Array.isArray(confirmed)) confirmed = {};
  const yearValues = distinct([
    ...yearsIn(cardName), ...yearsIn(cardSet), ...yearsIn(year), ...yearsIn(confirmed.year),
  ]);
  const setText = text(cardSet).replace(yearPattern, '').replace(/^[\s,;:-]+|[\s,;:-]+$/g, '').trim();
  const setValues = distinct([setText, text(set), text(confirmed.brandSet || confirmed.set)]);
  return {
    protectedFields: [...(yearValues.length ? ['year'] : []), ...(setValues.length ? ['set'] : [])],
    // Preserve conflicting explicit inputs for review instead of choosing one.
    userIdentity: {
      year: yearValues.length === 1 ? yearValues[0] : null,
      brandSet: setValues.length === 1 ? setValues[0] : null,
    },
    userChoices: { year: yearValues, set: setValues },
  };
}

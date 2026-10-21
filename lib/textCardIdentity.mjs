import { getUserIdentityProtection } from './userIdentityProtection.mjs';

const text = value => typeof value === 'string' ? value.trim().slice(0, 140) : '';

// Parse only explicit number syntax. Text after the number is a seller/user
// version label, never a model-derived identity or independent confirmation.
export function buildCanonicalCardFromText(fields = {}) {
  const name = text(fields.cardName);
  const number = name.match(/(?:#\s*([a-z0-9]+(?:[-/][a-z0-9]+)*)|\b(\d+\/\d+|[a-z]+\d+-\d+)\b)/i);
  const { userIdentity } = getUserIdentityProtection(fields);
  let subject = text(fields.subject) || (number ? name.slice(0, number.index).trim() : name);
  if (userIdentity.year) subject = subject.replace(userIdentity.year, '').trim();
  if (userIdentity.brandSet) subject = subject.replace(userIdentity.brandSet, '').trim();
  const card = {
    subject: subject || null,
    cardNumber: text(fields.cardNumber) || number?.[1] || number?.[2] || null,
    year: userIdentity.year,
    brandSet: userIdentity.brandSet,
    parallel: text(fields.parallel) || (number ? name.slice(number.index + number[0].length).replace(/^[\s,;:-]+/, '').trim() : '') || null,
    autoOrRelic: text(fields.autoOrRelic) || 'unknown',
    confidence: 0,
    provenance: 'explicit_user_text',
    notes: 'Parsed from explicit user input; not independent market verification.',
  };
  card.displayName = [card.year, card.brandSet, card.subject, card.cardNumber && `#${card.cardNumber}`, card.parallel].filter(Boolean).join(' ');
  return card;
}

export function missingTextIdentityFields(card) {
  return [['subject', 'card subject'], ['cardNumber', 'card number'], ['year', 'year'], ['brandSet', 'set / product'], ['parallel', 'version / parallel (including base or non-holo)']]
    .filter(([field]) => !card?.[field]).map(([, label]) => label);
}

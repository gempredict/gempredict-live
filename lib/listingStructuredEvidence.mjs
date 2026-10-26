// Shared negative checks, not an alternative source of canonical identity.
import { describeVariant, colors, treatments } from './variantDescriptor.mjs';
import { normalizeValuationSet } from './listingIdentityEvidence.mjs';
import { catalogLanguageKey } from './catalogNormalization.mjs';
const text = value => typeof value === 'string' ? value.normalize('NFKC').trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const key = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const nameKey = value => key(value).replace(/ /g, '');
const yearNames = ['yearmanufactured', 'year', 'yearofmanufacture'];
const numberNames = ['cardnumber', 'collectornumber', 'cardno', 'collectorno'];
const setNames = ['set', 'setname', 'product', 'productset', 'expansion'];
const variantNames = ['finish', 'printing', 'parallel', 'parallelvariety'];
const fields = ['kind', 'finish', 'art', 'color', 'treatment', 'printRun', 'autograph', 'relic'];
export const isStructuredVariantAttribute = name => variantNames.includes(nameKey(name));
export function structuredVariantLabel(name, value) {
  const label = key(value);
  if (['finish', 'printing'].includes(nameKey(name)) && ['normal', 'regular', 'non foil', 'nonfoil'].includes(label)) return 'Non-Holo';
  if (['parallel', 'parallelvariety'].includes(nameKey(name)) && ['none', 'no parallel', 'normal', 'regular', 'standard'].includes(label)) return 'Base';
  return text(value);
}
function numberKey(value) {
  const id = text(value).replace(/^(?:#\s*|no\.?\s+)/i, '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\/[A-Z0-9]+(?:-[A-Z0-9]+)*)?$/.test(id) || !/\d/.test(id)) return null;
  return id.split(/([/-])/).map(part => /^\d+$/.test(part) ? String(Number(part)) : part).join('');
}
function variantReading(label, card) {
  const descriptor = describeVariant(label, card);
  const remainder = key(label).replace(/\b(?:sir|special illustration rare)\b/g, 'special art')
    .replace(colors, '').replace(treatments, '')
    .replace(/\b(?:non\s*holo(?:graphic|foil)?|reverse\s*holo(?:graphic|foil)?|holo(?:graphic|foil)?|foil|common|regular|normal|base|parallel|insert|standard|special|alternate|alt|artwork|art|aa|sp|manga|auto|autograph|relic|patch|none|no|non|rare)\b/g, '')
    .replace(/\d+|[\s/]+/g, '');
  return !remainder && !descriptor.ambiguous && fields.some(field => descriptor[field] !== null) ? descriptor : null;
}
export function structuredListingConflicts(item, identity = {}) {
  const aspects = item?.localizedAspects;
  if (aspects == null) return [];
  if (!Array.isArray(aspects)) return ['Malformed structured listing evidence'];
  const card = { ...identity, subject: identity.subject || identity.player || identity.cardName, brandSet: identity.brandSet || identity.set };
  const expectedNumber = numberKey(card.cardNumber);
  const expectedVariant = card.variant || describeVariant(card.parallel, card);
  const titleVariant = describeVariant(item.title, card);
  const conflicts = [];
  const variantValues = new Map();
  for (const aspect of aspects) {
    if (!aspect || typeof aspect !== 'object' || typeof aspect.name !== 'string') { conflicts.push('Malformed structured listing evidence'); continue; }
    const name = nameKey(aspect.name);
    const value = text(aspect.value);
    // Conventional absence markers are not affirmative identity evidence.
    if (/^(?:n\/?a|not (?:specified|applicable)|does not apply)$/i.test(value)) continue;
    if (yearNames.includes(name)) {
      if (!/^(?:19|20)\d{2}$/.test(value) || !card.year || value !== text(card.year)) conflicts.push('Structured year mismatch or unverified');
    } else if (numberNames.includes(name)) {
      const observed = numberKey(aspect.value);
      // A bare local number can agree with a full title number but cannot
      // independently establish its denominator. Existing full-title checks stay.
      const titleNumbers = text(item.title).match(/[a-z0-9]+(?:\s*[-/]\s*[a-z0-9]+)*/gi) || [];
      const partialAgreement = observed && expectedNumber?.includes('/') && !observed.includes('/') && observed === expectedNumber.split('/')[0] && titleNumbers.some(token => numberKey(token) === expectedNumber);
      if (!observed || !expectedNumber || observed !== expectedNumber && !partialAgreement) conflicts.push('Structured card number mismatch or unverified');
    } else if (setNames.includes(name)) {
      const expected = normalizeValuationSet(card.brandSet, card);
      if (!value || !expected || normalizeValuationSet(value, card) !== expected) conflicts.push('Structured set mismatch or unverified');
    } else if (variantNames.includes(name)) {
      const reading = variantReading(structuredVariantLabel(aspect.name, aspect.value), card);
      if (!reading) { conflicts.push('Structured variant ambiguous or unrecognized'); continue; }
      for (const field of fields) {
        if (reading[field] === null) continue;
        const values = variantValues.get(field) || new Set();
        values.add(reading[field]); variantValues.set(field, values);
        if (values.size > 1) conflicts.push(`Conflicting structured variant ${field}`);
        if (card.parallel && ['color', 'treatment', 'printRun'].includes(field) && expectedVariant[field] !== reading[field]) conflicts.push(`Structured variant ${field} mismatch`);
        if (expectedVariant[field] != null && expectedVariant[field] !== reading[field] || titleVariant[field] != null && titleVariant[field] !== reading[field]) conflicts.push(`Structured variant ${field} mismatch`);
      }
    } else if (name === 'language' && card.language && (!value || catalogLanguageKey(value) !== catalogLanguageKey(card.language))) {
      conflicts.push('Structured language mismatch or unverified');
    }
  }
  return [...new Set(conflicts)];
}

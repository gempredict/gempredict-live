import { stableListingKeys } from './ebayListingProvenance.mjs';
import { unofficialReasons } from './cardAuthenticity.mjs';
import { getListingType } from './ebayIdentityMatch.mjs';

const clean = value => typeof value === 'string' && !/^(unknown|null|none)$/i.test(value.trim()) ? value.trim() : '';
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '');
const words = value => normalize(value).match(/[a-z0-9]+/g) || [];
const numberKey = value => normalize(value).replace(/^#\s*/, '').replace(/\s+/g, '').split(/([/-])/).map(part => /^\d+$/.test(part) ? String(Number(part)) : part).join('');

export function buildNeutralIdentityQuery(card) {
  const subject = clean(card?.subject);
  const number = clean(card?.cardNumber).replace(/^#\s*/, '');
  if (!subject || !/^[a-z0-9]+(?:\s*[-/]\s*[a-z0-9]+)*$/i.test(number) || !/\d/.test(number)) return null;
  return `${subject} ${number}`;
}

// This deliberately does not call the valuation scorer or compare year/set/variant.
export function matchIdentityEvidence(item, card) {
  const title = clean(item?.title);
  if (!buildNeutralIdentityQuery(card) || !title) return null;
  const listingType = getListingType(title, item.condition, item);
  if (listingType === 'excluded' || /\b(sleeves?|toploaders?|protectors?|playmats?|binders?|stickers?|posters?|coins?|code cards?|online codes?)\b/i.test(title)) return null;
  const titleWords = new Set(words(title));
  if (!words(card.subject).every(word => titleWords.has(word))) return null;

  const expected = numberKey(card.cardNumber);
  const tokens = normalize(title).match(/[a-z0-9]+(?:\s*[-/]\s*[a-z0-9]+)*/g) || [];
  if (!tokens.some(token => numberKey(token) === expected)) return null;
  // Multiple full collector IDs in one title may be a choice/lot/keyword bait.
  // Never let the presence of one expected number legitimize another card.
  if (expected.includes('/') && tokens.some(token => /\d+\s*\/\s*\d+/.test(token) && numberKey(token) !== expected)) return null;
  // An incidental serial number cannot override an explicitly different card ID.
  const explicit = [...normalize(title).matchAll(/(?:#\s*|\bno\.?\s*|\bcard(?:\s+number)?\s*#?\s+)((?=[a-z0-9/-]*\d)[a-z0-9]+(?:[-/][a-z0-9]+)*)\b/g)];
  if (explicit.some(match => numberKey(match[1]) !== expected)) return null;
  return { listingType, matchReasons: ['Same subject in listing title', 'Exact card number in listing title'] };
}

export function mergeIdentityEvidence(...pools) {
  const result = [];
  const seen = new Map();
  for (const item of pools.flat()) {
    const keys = stableListingKeys(item);
    const previous = keys.map(key => seen.get(key)).find(Boolean);
    if (previous) {
      for (const key of keys) seen.set(key, previous);
      for (const observation of item.observations) {
        if (!previous.observations.some(existing => JSON.stringify(existing) === JSON.stringify(observation))) previous.observations.push(observation);
      }
    } else {
      const copy = { ...item, observations: [...item.observations] };
      result.push(copy);
      for (const key of keys) seen.set(key, copy);
    }
  }
  return result;
}

export function collectIdentityEvidence(items, card, retrieval) {
  return mergeIdentityEvidence(items.flatMap(item => {
    const match = matchIdentityEvidence(item, card);
    if (!match) return [];
    return [{
      source: 'ebay_browse',
      itemId: item.itemId || null,
      title: item.title,
      itemWebUrl: item.itemWebUrl || null,
      condition: item.condition || null,
      ...match,
      observations: [{ ...retrieval, searchType: 'neutral_subject_card_number', originalItem: item }],
    }];
  }));
}

// Only actual Browse results enter the pool. Queries, AI proposals and the
// canonical identity are never synthesized into evidence or confirmation scores.
export async function fetchIdentityEvidence(card, {
  fetchImpl = globalThis.fetch,
  clientId = process.env.EBAY_PROD_CLIENT_ID,
  clientSecret = process.env.EBAY_PROD_CLIENT_SECRET,
} = {}) {
  const query = buildNeutralIdentityQuery(card);
  const result = { identityEvidenceItems: [], identityEvidenceExclusions: [], search: { query, status: 'not_requested' } };
  if (!query) return { ...result, search: { ...result.search, reason: 'Subject and card number are required' } };
  if (!clientId || !clientSecret) return { ...result, search: { ...result.search, status: 'unavailable', reason: 'Missing eBay production credentials' } };
  try {
    const tokenRes = await fetchImpl('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
    });
    if (!tokenRes.ok) return { ...result, search: { ...result.search, status: 'unavailable', reason: 'eBay token request failed', httpStatus: tokenRes.status } };
    const token = await tokenRes.json();
    const url = 'https://api.ebay.com/buy/browse/v1/item_summary/search?' + new URLSearchParams({ q: query, limit: '50' });
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token.access_token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
    if (!response.ok) return { ...result, search: { ...result.search, status: 'unavailable', reason: 'eBay identity evidence search failed', httpStatus: response.status } };
    const data = await response.json();
    const retrievedAt = new Date().toISOString();
    return {
      identityEvidenceItems: collectIdentityEvidence(data.itemSummaries || [], card, { query, retrievedAt }),
      identityEvidenceExclusions: (data.itemSummaries || []).flatMap(item => {
        const exclusionReasons = unofficialReasons(item);
        if (!matchIdentityEvidence(item, card) && !exclusionReasons.length) exclusionReasons.push('Subject/card number mismatch, ambiguous collector IDs, or non-card listing');
        return exclusionReasons.length ? [{ source: 'ebay_browse', itemId: item.itemId || null, title: item.title, itemWebUrl: item.itemWebUrl || null, exclusionReasons, observations: [{ query, retrievedAt, searchType: 'neutral_subject_card_number', originalItem: item }] }] : [];
      }),
      search: { query, status: 'retrieved', retrievedAt, returnedCount: (data.itemSummaries || []).length, total: data.total ?? null },
    };
  } catch {
    return { ...result, search: { ...result.search, status: 'unavailable', reason: 'eBay identity evidence request failed' } };
  }
}

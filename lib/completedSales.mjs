import { invalidCatalogIdentityFields } from './catalogIdentityValidation.mjs';
import { catalogNameKey, catalogLanguageKey } from './catalogNormalization.mjs';
import { scoreListing, getListingType } from './ebayIdentityMatch.mjs';
import { matchesVariantValuation, expandVariantAliases, variantFromCard } from './variantVerification.mjs';
export const EVIDENCE_TYPES = Object.freeze({ auction: 'verified_completed_auction', fixed: 'verified_fixed_price_sale', offer: 'confirmed_accepted_best_offer', ambiguous: 'sold_final_consideration_unverified', asking: 'active_asking_price', modeled: 'modeled_valuation' });
export const SALES_POLICY = Object.freeze({ version: 1, maxAgeDays: 90, minimumSample: 3, currency: 'USD', maximumRecords: 500 });
const text = v => typeof v === 'string' && v.trim().length > 0;
export function validEvidenceDate(value, now = Date.now()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  const date = Date.parse(value);
  return Number.isFinite(date) && date <= now && new Date(Date.UTC(Number(value.slice(0,4)), Number(value.slice(5,7))-1, Number(value.slice(8,10)))).toISOString().slice(0,10) === value.slice(0,10);
}
export function exactEvidenceIdentity(card, other) {
  const valid = value => !invalidCatalogIdentityFields(value).filter(field => field !== 'year').length && /^(?:19|20)\d{2}(?:-\d{2}(?:\d{2})?)?$/.test(value?.year || '');
  if (!valid(card) || !valid(other)) return false;
  for (const field of ['manufacturer', 'product', 'subset']) if (card[field] && catalogNameKey(card[field]) !== catalogNameKey(other[field])) return false;
  const number = v => String(v || '').replace(/^#\s*/, '').replace(/\s/g, '').toLowerCase();
  if (catalogNameKey(card.subject) !== catalogNameKey(other.subject) || number(card.cardNumber) !== number(other.cardNumber) || card.year !== other.year || catalogNameKey(card.brandSet) !== catalogNameKey(other.brandSet)) return false;
  if (card.language && catalogLanguageKey(card.language) !== catalogLanguageKey(other.language)) return false;
  const expected = card.variant || variantFromCard(card), actual = other.variant || variantFromCard(other);
  if ([expected, actual].some(v => !v || v.ambiguous || v.unrecognized)) return false;
  // A supplied parsed descriptor cannot conceal a contradictory printable label.
  for (const value of [card, other]) {
    if (!value.variant || !value.parallel) continue;
    const parsed = variantFromCard({ ...value, variant: undefined });
    if (parsed.ambiguous || parsed.unrecognized || ['kind', 'finish', 'art', 'color', 'treatment', 'printRun', 'autograph', 'relic'].some(key => parsed[key] != null && parsed[key] !== value.variant[key])) return false;
  }
  return ['kind', 'finish', 'art', 'color', 'treatment', 'printRun', 'autograph', 'relic'].every(key => (expected[key] ?? null) === (actual[key] ?? null));
}
export function licensedEnvelope(envelope) {
  return envelope?.status === 'available' && text(envelope.providerId) && text(envelope.rights?.reference) && envelope.rights.commercialDisplay === true && envelope.rights.transactionRecords === true && Array.isArray(envelope.records);
}
function sourceValid(record, envelope, now) {
  const p = record?.provenance;
  return p?.providerId === envelope.providerId && p.rightsReference === envelope.rights.reference && text(p.marketplace) && text(p.sourceItemId) && text(p.transactionId) && validEvidenceDate(p.observedAt, now) && ['licensed_api', 'official_api'].includes(p.delivery);
}
export function analyzeCompletedSales(envelope, card, { now = Date.now() } = {}) {
  const excluded = [], accepted = [], groups = {}, candidates = [];
  if (!licensedEnvelope(envelope)) return { version: 1, status: 'unavailable', reason: 'authorized_provider_unavailable', providerId: envelope?.providerId || null, currency: 'USD', groups, accepted, excluded, evaluatedAt: new Date(now).toISOString() };
  for (const [index, record] of envelope.records.slice(0, SALES_POLICY.maximumRecords).entries()) {
    let reason = !sourceValid(record, envelope, now) ? 'missing_provenance' : !exactEvidenceIdentity(card, record.identity) ? 'identity_or_variant_mismatch' : !Object.values(EVIDENCE_TYPES).slice(0, 3).includes(record.evidenceType) || record.amountBasis !== 'actual_transaction' ? 'unverified_final_consideration' : !validEvidenceDate(record.soldAt, now) ? 'invalid_transaction_date' : now - Date.parse(record.soldAt) > SALES_POLICY.maxAgeDays * 86400000 ? 'stale_transaction' : !['completed', 'settled'].includes(record.transactionStatus) ? 'unconfirmed_transaction_status' : record.currency !== 'USD' ? 'unsupported_currency' : !(typeof record.amount === 'number' && Number.isFinite(record.amount) && record.amount > 0) ? 'invalid_amount' : null;
    const group = record?.grading?.status === 'raw' && record.grading.company == null && record.grading.grade == null ? 'raw' : record?.grading?.status === 'graded' && ['PSA','BGS','CGC','SGC','TAG'].includes(record.grading.company) && /^(?:[1-9](?:\.5)?|10)$/.test(record.grading.grade) && !record.grading.designation ? `${record.grading.company} ${record.grading.grade}` : null;
    if (!reason && !group) reason = 'unsupported_or_ambiguous_grade';
    if (reason) { excluded.push({ index, reason }); continue; }
    const kind = getListingType(record.title || '', record.condition || '', record);
    const descriptor = { player: card.subject, year: card.year, set: card.brandSet, cardNumber: card.cardNumber, parallel: expandVariantAliases(card.parallel || ''), autoOrRelic: card.autoOrRelic, printRun: card.printRun, language: card.language };
    if (!reason && (!text(record.title) || !scoreListing(expandVariantAliases(record.title), '', descriptor, record).comparable || !matchesVariantValuation(record, card) || kind !== (group === 'raw' ? 'raw' : 'graded'))) reason = 'listing_evidence_conflict';
    if (!reason && group !== 'raw') {
      const labels = [...record.title.matchAll(/\b(PSA|BGS|CGC|SGC|TAG)\s*(\d+(?:\.\d+)?)\b/gi)];
      if (/\b(?:pristine|black label|perfect)\b/i.test(record.title) || !labels.length || labels.some(match => match[1].toUpperCase() !== record.grading.company || match[2] !== record.grading.grade)) reason = 'grade_label_conflict';
    }
    if (reason) excluded.push({ index, reason }); else candidates.push({ record, group, index });
  }
  // Duplicate source records are not independent sales. Contradictory copies
  // quarantine the entire transaction, regardless of provider or input order.
  const duplicates = new Map();
  for (const candidate of candidates) {
    const p = candidate.record.provenance;
    const key = `${p.marketplace.toLowerCase()}:${p.transactionId}`;
    const list = duplicates.get(key) || []; list.push(candidate); duplicates.set(key, list);
  }
  for (const list of duplicates.values()) {
    const fingerprint = c => JSON.stringify([c.record.amount, c.record.currency, c.record.soldAt, c.group, c.record.evidenceType]);
    if (list.some(c => fingerprint(c) !== fingerprint(list[0]))) { list.forEach(c => excluded.push({ index: c.index, reason: 'contradictory_duplicate' })); continue; }
    accepted.push(list[0].record);
    list.slice(1).forEach(c => excluded.push({ index: c.index, reason: 'duplicate_transaction' }));
    const group = groups[list[0].group] ||= { prices: [], dates: [] };
    group.prices.push(list[0].record.amount); group.dates.push(list[0].record.soldAt);
  }
  for (const [name, group] of Object.entries(groups)) {
    const prices = group.prices.sort((a,b) => a-b), dates = group.dates.sort((a,b) => Date.parse(a)-Date.parse(b));
    const median = prices.length % 2 ? prices[(prices.length-1)/2] : (prices[prices.length/2-1]+prices[prices.length/2])/2;
    groups[name] = { median: Math.round(median * 100)/100, low: prices[0], high: prices.at(-1), count: prices.length, oldest: dates[0], newest: dates.at(-1), daysSinceNewest: Math.floor((now-Date.parse(dates.at(-1)))/86400000), qualified: prices.length >= SALES_POLICY.minimumSample && now-Date.parse(dates.at(-1)) <= 30*86400000, currency: 'USD', evidenceType: 'verified_completed_transactions' };
  }
  return { version: 1, status: accepted.length ? 'available' : 'insufficient_evidence', providerId: envelope.providerId, rightsReference: envelope.rights.reference, currency: 'USD', groups, accepted, excluded, truncated: envelope.truncated === true || envelope.records.length > SALES_POLICY.maximumRecords, evaluatedAt: new Date(now).toISOString() };
}
// No approved supplier is configured. This does not inspect credentials, scrape,
// call a speculative URL, or convert Browse results into transactions.
export async function fetchCompletedSales(card, { provider = null, timeoutMs = 4000 } = {}) {
  if (!provider || typeof provider.lookup !== 'function' || !text(provider.id)) return { status: 'unavailable', providerId: null, reason: 'provider_not_configured', records: [] };
  let timer;
  const controller = new AbortController();
  try {
    const result = await Promise.race([provider.lookup(card, { signal: controller.signal }), new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs); })]);
    if (!licensedEnvelope(result) || result.providerId !== provider.id) throw new Error('invalid_provider_response');
    return { ...result, truncated: result.truncated === true || result.records.length > SALES_POLICY.maximumRecords, records: result.records.slice(0, SALES_POLICY.maximumRecords) };
  } catch { return { status: 'unavailable', providerId: provider.id, reason: 'provider_unavailable_or_invalid', records: [] }; }
  finally { clearTimeout(timer); }
}

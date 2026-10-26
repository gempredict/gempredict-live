import { verifiedVariant } from './helpers/verifiedIdentity.mjs';
import test, { mock } from 'node:test';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { createTcgDexCatalog } from '../lib/tcgdexCatalog.mjs';
import { resolveMarketIdentity } from '../lib/reconcileMarketIdentity.mjs';
import { crossCheckCatalog, identitySearchGate } from '../lib/catalogIdentity.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { isValuationTrusted, safeStoredReport } from '../lib/valuationProtection.mjs';

// Documented V2 response shapes, with facts checked in the public upstream
// 30th Celebration and 149.ts records. Live delivery is policy-blocked.
const proposal = { subject: 'Pikachu ex', cardNumber: '149/128', year: '2024', brandSet: 'Surging Sparks', parallel: 'Special Art', autoOrRelic: 'none', language: 'English' };
const set = { id: '30th', name: '30th Celebration', releaseDate: '2026-09-16', cardCount: { official: 128, total: 161 }, tcgOnline: '30C' };
const card = { id: '30th-149', localId: '149', name: 'Pikachu ex', rarity: 'Special illustration rare', set: { id: '30th', name: '30th Celebration', cardCount: { official: 128, total: 161 } }, variants: { normal: false, holo: true, reverse: false } };
const brief = ({ id, localId, name }) => ({ id, localId, name });
function transport({ cards = [card], sets = [set], mutate, ...options } = {}) {
  const calls = [];
  const fetchImpl = async (url, request) => {
    calls.push(String(url));
    assert.ok(request.signal instanceof AbortSignal);
    assert.equal(request.redirect, 'error');
    assert.equal(new URL(url).origin, 'https://api.tcgdex.net');
    assert.deepEqual(Object.keys(request.headers), ['Accept']);
    let data;
    const path = new URL(url).pathname.split('/');
    if (path.at(-1) === 'cards') {
      const q = new URL(url).searchParams;
      assert.ok(!String(q).includes('Surging'));
      assert.equal(q.get('pagination:itemsPerPage'), '5');
      data = cards.map(brief);
    } else if (path.at(-2) === 'cards') data = cards.find(item => item.id === path.at(-1));
    else data = sets.find(item => item.id === path.at(-1));
    return { ok: true, json: async () => structuredClone(mutate ? mutate(data, url) : data) };
  };
  return { ...createTcgDexCatalog({ fetchImpl, ...options }), calls };
}
const noMarket = { clientId: '', clientSecret: '' };
const resolve = (p, catalog, options = {}) => resolveMarketIdentity(p, { ...noMarket, ...catalog, ...options });
const listings = title => Array.from({ length: 3 }, (_, i) => ({ itemId: `${title}-${i}`, title, condition: 'Ungraded', localizedAspects: [{ name: 'Language', value: 'English' }], price: { value: title.includes('Surging') ? '500' : '40', currency: 'USD' } }));

test('unique TCGdex identity corrects Pikachu set/year before valuation rather than just flagging it', async () => {
  const catalog = transport();
  const result = await resolve(proposal, catalog);
  assert.equal(result.canonicalCard.brandSet, '30th Celebration');
  assert.equal(result.canonicalCard.year, '2026');
  assert.equal(result.canonicalCard.cardNumber, '149/128');
  assert.equal(result.canonicalCard.setId, '30th');
  assert.equal(result.canonicalCard.setCode, '30C');
  assert.equal(result.canonicalCard.language, 'en');
  assert.equal(result.identityVerification.catalog.status, 'corrected');
  assert.ok(result.identityVerification.catalog.originalConflicts.includes('brandSet'));
  assert.equal(result.valuationIdentityGate.allowed, true);
  assert.equal(proposal.brandSet, 'Surging Sparks');
  assert.equal(catalog.calls.length, 3);
});

test('actual prediction pipeline searches only the corrected identity and retains strict comparables', async () => {
  const market = [...listings('2026 Pokemon 30th Celebration Pikachu ex 149/128 Special Art'), ...listings('2024 Pokemon Surging Sparks Pikachu ex 149/128 Special Art')];
  const result = await runPipeline({ proposal, vision: { identifiedLanguage: 'English' }, neutral: listings('Pikachu ex 149/128 Special Art'), market, catalogOptions: transport(), routingEnv: { NODE_ENV: 'development' } });
  assert.equal(result.httpStatus, 200, JSON.stringify(result.errors));
  assert.equal(result.payload.originalCanonicalCard.brandSet, 'Surging Sparks');
  assert.equal(result.payload.canonicalCard.brandSet, '30th Celebration');
  assert.equal(result.payload.canonicalCard.year, '2026');
  assert.equal(result.payload.identityVerification.catalog.status, 'corrected');
  assert.equal(result.metrics.valuationBrowse, 6);
  assert.ok(result.metrics.valuationQueries.every(q => !/Surging|2024/.test(q)));
  assert.equal(result.payload.marketData.rawComparableItems.length, 3);
  assert.ok(result.payload.marketData.rawComparableItems.every(item => item.title.includes('30th Celebration')));
  assert.equal(result.payload.marketData.excludedItems.length, 3);
  assert.equal(result.report.rawValue, 40);
  assert.equal(isValuationTrusted(result.report), true);
  assert.ok(result.payload.identityDiagnostics.catalog.diagnostics.some(item => item.endpoint?.includes('/cards/30th-149')));
});

test('catalog overrides misleading seller consensus without erasing its original observations', async () => {
  const neutral = listings('2024 Pokemon Surging Sparks Pikachu ex 149/128 Special Art');
  const result = await runPipeline({ proposal, neutral, market: [], catalogOptions: transport() });
  assert.equal(result.payload.canonicalCard.brandSet, '30th Celebration');
  assert.equal(result.payload.identityVerification.set.verificationSource, 'tcgdex');
  assert.equal(result.payload.identityEvidenceItems.length, 3);
  assert.equal(result.payload.valuationVerification.status, 'untrusted'); // no matching prices
});

test('protected conflicting user choices require confirmation instead of silent replacement', async () => {
  const result = await resolve(proposal, transport(), { protectedFields: ['set'], userIdentity: { brandSet: 'Surging Sparks' } });
  assert.equal(result.canonicalCard.brandSet, 'Surging Sparks');
  assert.equal(result.identityVerification.catalog.status, 'conflict');
  assert.equal(result.identityVerification.catalog.requiresConfirmation, true);
  assert.equal(result.valuationIdentityGate.allowed, false);
});

test('set IDs and printed abbreviations canonicalize; SIR and special-art aliases agree', async () => {
  for (const brandSet of ['30C', '30th', '30th Celebration']) {
    const result = await resolve({ ...proposal, year: '2026', brandSet, parallel: 'SIR' }, transport(), { protectedFields: ['set'] });
    assert.equal(result.canonicalCard.brandSet, '30th Celebration');
    assert.equal(result.canonicalCard.parallel, 'Special Art');
    assert.equal(result.valuationIdentityGate.allowed, true);
  }
});

test('official denominator, not total including secret cards, establishes collector-number identity', async () => {
  const result = await resolve({ ...proposal, cardNumber: '149/161' }, transport());
  assert.equal(result.identityVerification.catalog.status, 'insufficient_evidence');
  assert.equal(result.valuationIdentityGate.allowed, false);
  assert.ok(result.catalogDiagnostics.some(item => item.reason === 'official_count_mismatch'));
});

test('number padding is normalized and a unique bare local number can be completed', async () => {
  for (const cardNumber of ['00149/00128', '149']) {
    const result = await resolve({ ...proposal, cardNumber }, transport());
    assert.equal(result.canonicalCard.cardNumber, '149/128');
    assert.equal(result.valuationIdentityGate.allowed, true);
  }
});

test('collector numbers reused across sets remain ambiguous; a proposed set cannot pick the winner', async () => {
  const otherSet = { ...set, id: 'other', name: 'Other Set' };
  const other = { ...card, id: 'other-149', set: { id: 'other', name: 'Other Set' } };
  const result = await resolve(proposal, transport({ cards: [card, other], sets: [set, otherSet] }));
  assert.equal(result.identityVerification.catalog.status, 'ambiguous');
  assert.equal(result.canonicalCard.brandSet, 'Surging Sparks');
  assert.equal(result.valuationIdentityGate.allowed, false);
});

test('different names and numbers are rejected, not treated as partial confirmation', async () => {
  const wrong = [{ ...card, id: '30th-150', localId: '150' }, { ...card, id: '30th-149x', name: 'Raichu ex' }];
  const result = await resolve(proposal, transport({ cards: wrong }));
  assert.equal(result.identityVerification.catalog.status, 'insufficient_evidence');
  assert.equal(result.catalogDiagnostics.filter(item => item.reason === 'different_name_or_collector_number').length, 2);
});

test('language selection is explicit; localized punctuation aliases match and unsupported languages do not request English', async () => {
  const french = { ...card, name: 'Pikachu-ex', set: { ...card.set, name: '30ᵉ Anniversaire' } };
  const catalog = transport({ cards: [french], sets: [{ ...set, name: '30ᵉ Anniversaire' }] });
  const result = await resolve({ ...proposal, subject: 'Pikachu-ex', language: 'French' }, catalog);
  assert.equal(result.canonicalCard.language, 'fr');
  assert.ok(catalog.calls.every(url => url.includes('/v2/fr/')));
  const unsupported = transport();
  const unavailable = await resolve({ ...proposal, language: 'Korean' }, unsupported);
  assert.equal(unavailable.valuationIdentityGate.allowed, false);
  assert.equal(unsupported.calls.length, 0);
});

test('cached successful responses expire and cache size remains bounded', async () => {
  let clock = 0;
  const catalog = transport({ now: () => clock, ttlMs: 100 });
  await resolve(proposal, catalog); await resolve(proposal, catalog);
  assert.equal(catalog.calls.length, 3);
  clock = 101; await resolve(proposal, catalog);
  assert.equal(catalog.calls.length, 6);
  const small = transport({ maxCacheEntries: 1 });
  await resolve(proposal, small); await resolve(proposal, small);
  assert.ok(small.calls.length > 3);
});

test('candidate limits cannot certify a truncated result set', async () => {
  const catalog = transport({ cards: Array.from({ length: 5 }, (_, i) => ({ ...card, id: `set${i}-149` })) });
  const result = await resolve(proposal, catalog);
  assert.equal(result.identityVerification.catalog.status, 'ambiguous');
  assert.equal(catalog.calls.length, 1);
  assert.equal(result.valuationIdentityGate.allowed, false);
});

test('malformed schema and unavailable responses fail closed without caching a false match', async () => {
  for (const mutate of [() => null, data => Array.isArray(data) ? data : { ...data, id: 'wrong' }, data => data?.releaseDate ? { ...data, cardCount: { total: 161 } } : data]) {
    const result = await resolve(proposal, transport({ mutate }));
    assert.equal(result.identityVerification.catalog.status, 'unavailable');
    assert.equal(result.valuationIdentityGate.allowed, false);
  }
  for (const status of [403, 404, 429, 500]) {
    const catalog = createTcgDexCatalog({ fetchImpl: async () => ({ ok: false, status }) });
    assert.equal((await resolve(proposal, catalog)).identityVerification.catalog.status, 'unavailable');
  }
});

test('timeout bounds even a transport that does not honor abort signals', async () => {
  const catalog = createTcgDexCatalog({ timeoutMs: 5, deadlineMs: 20, fetchImpl: async () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => [] }), 50)) });
  const result = await resolve(proposal, catalog);
  assert.equal(result.identityVerification.catalog.status, 'unavailable');
  assert.ok(result.catalogDiagnostics.some(item => item.reason === 'catalog_timeout'));
});

test('non-Pokemon categories do not claim or request TCGdex verification', async () => {
  const result = await resolveMarketIdentity({ ...proposal, subject: 'Sports Player' }, { ...noMarket, cardType: 'sports' });
  assert.equal(result.identityVerification.catalog.status, 'unavailable');
  assert.equal(result.valuationIdentityGate.allowed, false);
});

test('catalog-backed identity cannot migrate to a different restored set or finish', async () => {
  const result = await resolve(proposal, transport());
  assert.equal(identitySearchGate(result.identityVerification, { ...result.canonicalCard, brandSet: 'Surging Sparks' }).allowed, false);
  const stale = safeStoredReport({ canonicalCard: { ...result.canonicalCard, parallel: 'Base' }, identityVerification: result.identityVerification, valuationVerification: { status: 'trusted' }, variantVerification: verifiedVariant({ ...result.canonicalCard, parallel: 'Base' }), rawValue: 500, marketData: { marketSummary: { rawUsedCount: 3, rawMedian: 500, valuationTrusted: true } } });
  assert.equal(stale.rawValue, null);
});

test('worst-case lookup stays within nine requests and does not infer missing printed abbreviations', async () => {
  const sets = Array.from({ length: 4 }, (_, i) => ({ ...set, id: `set${i}`, name: `Set ${i}`, cardCount: { official: i ? 130 + i : 128 }, tcgOnline: null }));
  const cards = sets.map(s => ({ ...card, id: `${s.id}-149`, set: { id: s.id, name: s.name } }));
  const catalog = transport({ cards, sets });
  const result = await resolve(proposal, catalog);
  assert.equal(catalog.calls.length, 9);
  assert.equal(result.canonicalCard.brandSet, 'Set 0');
  assert.equal(result.canonicalCard.setCode, undefined);
});

test('numeric localId schema is supported; inconsistent official counts or invalid dates cannot certify a card', async () => {
  const result = await resolve(proposal, transport({ cards: [{ ...card, localId: 149 }] }));
  assert.equal(result.canonicalCard.cardNumber, '149/128');
  for (const sets of [[{ ...set, cardCount: { official: 191 } }], [{ ...set, releaseDate: '2026-02-31' }]]) {
    assert.equal((await resolve(proposal, transport({ sets }))).identityVerification.catalog.status, 'unavailable');
  }
});

test('catalog corrections are inspectable but production responses omit response-level diagnostics', async () => {
  const result = await runPipeline({ proposal, neutral: [], market: [], catalogOptions: transport(), routingEnv: { NODE_ENV: 'production' } });
  assert.equal(result.payload.canonicalCard.brandSet, '30th Celebration');
  assert.ok(result.payload.identityVerification.catalog.corrections.some(change => change.field === 'brandSet'));
  assert.equal(result.payload.identityDiagnostics, undefined);
  assert.equal(result.payload.identityVerification.catalog.diagnostics, undefined);
  assert.equal(result.payload.valuationVerification.status, 'untrusted'); // variant evidence absent
});

test('explicitly impossible catalog finish cannot be blessed by seller verification or a manual confirmation', async () => {
  const result = await resolve({ ...proposal, parallel: 'Non-Holo' }, transport());
  const candidate = result.identityVerification.catalog.candidate;
  assert.equal(identitySearchGate(result.identityVerification, { ...result.canonicalCard, parallel: 'Non-Holo', variant: { finish: 'nonholo' } }).allowed, false);
  assert.equal(candidate.variants.normal, false);
});

test('ambiguous catalog identity requests confirmation in the actual handler and skips all valuation retrieval', async () => {
  const other = { ...card, id: 'other-149', set: { id: 'other', name: 'Other Set' } };
  const result = await runPipeline({ proposal, neutral: listings('Pikachu ex 149/128 Special Art'), market: [], catalogOptions: transport({ cards: [card, other], sets: [set, { ...set, id: 'other', name: 'Other Set' }] }) });
  assert.equal(result.payload.variantVerification.status, 'needs_confirmation');
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.metrics.claudePrediction, 0);
  assert.equal(result.payload.prediction.rawValue, null);
});

test('valuation matching preserves the catalog language and rejects unstated or conflicting listing languages', async () => {
  const good = listings('2026 Pokemon 30th Celebration Pikachu ex 149/128 Special Art');
  const foreign = good.map(item => ({ ...item, itemId: item.itemId + '-ja', localizedAspects: [{ name: 'Language', value: 'Japanese' }], price: { value: '500', currency: 'USD' } }));
  const missing = good.map(item => ({ ...item, itemId: item.itemId + '-missing', localizedAspects: [] }));
  const result = await runPipeline({ proposal, neutral: listings('Pikachu ex 149/128 Special Art'), market: [...good, ...foreign, ...missing], catalogOptions: transport() });
  assert.equal(result.report.rawValue, 40);
  assert.equal(result.payload.marketData.rawComparableItems.length, 3);
  assert.equal(result.payload.marketData.excludedItems.length, 6);
  assert.ok(result.payload.marketData.rawComparableItems.every(item => item.localizedAspects[0].value === 'English'));
});

test('production Pokemon wiring selects TCGdex without injection, while native HTTPS remains fully mocked', async () => {
  const calls = [];
  const get = mock.method(https, 'get', (url, options, callback) => {
    calls.push(String(url));
    assert.equal(options.headers.Accept, 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      const path = new URL(url).pathname;
      const body = path.endsWith('/cards') ? [brief(card)] : path.endsWith('/cards/30th-149') ? card : set;
      callback(response);
      response.emit('data', Buffer.from(JSON.stringify(body)));
      response.emit('end');
      request.emit('close');
    });
    return request;
  });
  try {
    const result = await resolveMarketIdentity(proposal, { ...noMarket, cardType: 'pokemon' });
    assert.equal(result.identityVerification.catalog.source, 'tcgdex');
    assert.equal(result.canonicalCard.brandSet, '30th Celebration');
    assert.equal(result.identityVerification.catalog.status, 'corrected');
    assert.equal(calls.length, 3);
  } finally { get.mock.restore(); }
});

test('documented SIR rarity aliases match the corrected artwork without accepting base versions', async () => {
  for (const alias of ['SIR', 'Special Illustration Rare']) {
    const good = listings(`2026 Pokemon 30th Celebration Pikachu ex 149/128 ${alias}`);
    const base = listings('2026 Pokemon 30th Celebration Pikachu ex 149/128 Base');
    const result = await runPipeline({ proposal, neutral: listings(`Pikachu ex 149/128 ${alias}`), market: [...good, ...base], catalogOptions: transport() });
    assert.equal(result.payload.canonicalCard.parallel, 'Special Art');
    assert.equal(result.payload.variantVerification.status, 'verified');
    assert.equal(result.payload.marketData.rawComparableItems.length, 3);
    assert.equal(result.payload.marketData.excludedItems.length, 3);
    assert.equal(isValuationTrusted(result.report), true);
  }
});

test('non-Latin names stay distinct and are preserved in localized discovery queries', async () => {
  const subject = 'ピカチュウex';
  const japanese = { ...card, name: subject, set: { ...card.set, name: '30周年' } };
  const wrong = { ...japanese, id: 'other-149', name: 'ライチュウex' };
  const catalog = transport({ cards: [japanese, wrong], sets: [{ ...set, name: '30周年' }] });
  const result = await resolve({ ...proposal, subject, language: 'Japanese' }, catalog);
  assert.equal(result.canonicalCard.subject, subject);
  assert.equal(result.canonicalCard.brandSet, '30周年');
  assert.equal(identitySearchGate(result.identityVerification, { ...result.canonicalCard, brandSet: '30別のセット' }).allowed, false);
  assert.equal(new URL(catalog.calls[0]).searchParams.get('name'), subject);
  assert.ok(result.catalogDiagnostics.some(item => item.id === 'other-149' && item.reason === 'different_name_or_collector_number'));
  const other = { ...japanese, id: 'other-149', set: { id: 'other', name: '別のセット' } };
  const ambiguous = await resolve({ ...proposal, subject, language: 'Japanese' }, transport({ cards: [japanese, other], sets: [{ ...set, name: '30周年' }, { ...set, id: 'other', name: '別のセット' }] }));
  assert.equal(ambiguous.identityVerification.catalog.status, 'ambiguous');
});

test('default English lookup scope does not silently certify a physical card language', async () => {
  const result = await resolve({ ...proposal, language: null }, transport());
  assert.equal(result.canonicalCard.brandSet, '30th Celebration');
  assert.equal(result.canonicalCard.language, null);
  assert.equal(result.identityVerification.catalog.requiresLanguageConfirmation, true);
  assert.equal(result.valuationIdentityGate.allowed, false);
  const route = await runPipeline({ proposal: { ...proposal, language: null }, neutral: listings('Pikachu ex 149/128 Special Art'), market: [], catalogOptions: transport() });
  assert.equal(route.payload.variantVerification.status, 'needs_confirmation');
  assert.equal(route.metrics.valuationBrowse, 0);
  const chosen = { ...proposal, brandSet: '30th Celebration', year: '2026', language: 'English' };
  const completed = await runPipeline({ proposal, textOnly: true, fields: { cardType: 'pokemon', cardName: proposal.subject, confirmedCardIdentity: chosen, originalIdentityProposal: proposal, confirmedIdentity: { brandSet: chosen.brandSet, year: chosen.year }, confirmedVariant: { parallel: 'Special Art', autoOrRelic: 'none' } }, neutral: listings('2026 Pokemon 30th Celebration Pikachu ex 149/128 Special Art'), market: listings('2026 Pokemon 30th Celebration Pikachu ex 149/128 Special Art'), catalogOptions: transport() });
  assert.equal(completed.payload.canonicalCard.language, 'en');
  assert.equal(isValuationTrusted(completed.report), true);
});

test('live English Pikachu SIR gains a catalog-supported holo finish after Stellar Crown correction', async () => {
  const result = await runPipeline({ proposal: { ...proposal, brandSet: 'Stellar Crown' },
    neutral: listings('2026 Pokemon 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare'),
    market: listings('2026 Pokemon 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare'), catalogOptions: transport(), routingEnv: { NODE_ENV: 'development' } });
  assert.equal(result.payload.canonicalCard.parallel, 'Holo Special Art');
  assert.equal(result.payload.canonicalCard.variant.finish, 'holo');
  assert.equal(result.payload.identityVerification.catalog.candidate.parallel, 'Special Art');
  assert.equal(result.payload.variantVerification.status, 'corrected');
  assert.equal(result.payload.valuationIdentityGate.allowed, true, JSON.stringify(result.payload.valuationIdentityGate));
  assert.equal(isValuationTrusted(result.report), true);
});

test('catalog artwork equivalence requires positively supported and internally consistent finishes', async () => {
  const result = await resolve(proposal, transport());
  const verification = result.identityVerification;
  for (const parallel of ['Holo Special Art', 'Holographic Special Illustration Rare', 'Foil SIR']) {
    const canonical = { ...result.canonicalCard, parallel, variant: { finish: 'holo', art: 'special art' } };
    assert.equal(identitySearchGate(verification, canonical).allowed, true, parallel);
    for (const variants of [null, {}, { holo: false }, { holo: 'true' }]) {
      const incomplete = { ...verification, catalog: { ...verification.catalog, candidate: { ...verification.catalog.candidate, variants } } };
      const gate = identitySearchGate(incomplete, canonical);
      assert.equal(gate.allowed, false);
      assert.ok(gate.conflicts.includes('finish'));
    }
  }
  for (const parallel of ['Reverse-Holo Special Art', 'Non-Holo Special Art', 'Base', 'Holo Alternate Art', 'Holo Standard Art', 'Holo Special Art Gold']) {
    assert.equal(identitySearchGate(verification, { ...result.canonicalCard, parallel }).allowed, false, parallel);
  }
  for (const finish of ['reverse-holo', 'non-holo', 'reverseholo', 'nonholo']) {
    assert.equal(identitySearchGate(verification, { ...result.canonicalCard, parallel: 'Holo Special Art', variant: { finish } }).allowed, false, finish);
  }
  assert.equal(identitySearchGate(verification, { ...result.canonicalCard, parallel: 'Holo Special Art', variant: { finish: 'holo', art: 'alternate art' } }).allowed, false);
});

test('live corrected identity does not turn sparse variant evidence or unrelated variants into trusted prices', async () => {
  const title = '2026 Pokemon 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare';
  const market = [...listings(title), ...['Reverse-Holo Special Art', 'Non-Holo Special Art', 'Base', 'Holo Alternate Art'].flatMap(label => listings(`2026 Pokemon 30th Celebration Pikachu ex 149/128 English ${label}`))];
  for (const count of [0, 1, 2, 3]) {
    const result = await runPipeline({ proposal: { ...proposal, brandSet: 'Stellar Crown' }, neutral: listings(title).slice(0, count), market, catalogOptions: transport() });
    assert.equal(result.payload.canonicalCard.brandSet, '30th Celebration');
    assert.equal(isValuationTrusted(result.report), count === 3);
    if (count < 3) assert.equal(result.report.rawValue, null);
    else {
      assert.equal(result.payload.marketData.rawComparableItems.length, 3);
      assert.equal(result.payload.marketData.excludedItems.length, 12);
    }
  }
});

test('withheld live photo reports remove unsupported financial prose and retain visual condition', async () => {
  const result = await runPipeline({ proposal: { ...proposal, brandSet: 'Stellar Crown' }, neutral: [], market: [], catalogOptions: transport(),
    vision: { worthGrading: true, worthGradingReason: 'Worth grading because of its high market value.', imageSummary: 'Corners show whitening. This valuable card should be graded for profit.', surfaceNote: 'Light scratches visible. Market value supports grading.' } });
  assert.equal(result.report.rawValue, null);
  for (const analysis of [result.payload.imageAnalysis, result.report.imageAnalysis, safeStoredReport({ ...result.report, imageAnalysis: { ...result.report.imageAnalysis, worthGrading: true, worthGradingReason: 'High resale price makes grading worthwhile.' } }).imageAnalysis]) {
    assert.equal(analysis.worthGrading, null);
    assert.doesNotMatch(analysis.worthGradingReason, /high market value|resale price|worthwhile/i);
    assert.match(analysis.imageSummary, /30th Celebration.*Visible corner whitening/);
    assert.equal(analysis.surfaceNote, 'Visible surface scratches.');
    assert.equal(analysis.cornersNote, 'Visible corner whitening.');
    assert.equal(analysis.estimatedGrade, result.payload.imageAnalysis.estimatedGrade);
  }
});

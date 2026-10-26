import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { validateCatalogSnapshot, parseCatalogLiteral, reconcileHostedPrinting } from '../lib/tcgdexSnapshot.mjs';
import { createTcgDexCatalog } from '../lib/tcgdexCatalog.mjs';
import { identitySearchGate } from '../lib/catalogIdentity.mjs';
import { isValuationTrusted, safeStoredReport } from '../lib/valuationProtection.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
function persist(name, report) {
  const file = process.env.FRESHNESS_VALIDATION_OUTPUT;
  if (!file) return;
  const value = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  value[name] = report; writeFileSync(file, JSON.stringify(value));
}
const snapshot = createRequire(import.meta.url)('../data/tcgdex/upstream-snapshot.json');
const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const blob = content => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
const proposal = { subject: 'Pikachu ex', cardNumber: '149/128', year: '2024', brandSet: 'Stellar Crown', parallel: 'Special Art', language: 'English', autoOrRelic: 'none' };
const set = { id: '30th', name: '30th Celebration', releaseDate: '2026-09-16', cardCount: { official: 128 }, tcgOnline: '30C' };
const hosted = { id: '30th-149', localId: '149', name: 'Pikachu ex', rarity: 'Special illustration rare', set, updated: '2026-09-17T00:45:22+02:00', variants: { firstEdition: false, holo: false, normal: true, reverse: false, wPromo: false }, variants_detailed: [{ type: 'normal', size: 'standard', variantId: 'generated' }] };
const record = { id: hosted.id, provider: 'tcgdex', localId: '149', subject: hosted.name, cardNumber: '149/128', setId: '30th', brandSet: set.name, officialCount: 128, releaseDate: set.releaseDate, year: '2026', language: 'en', rarity: hosted.rarity, parallel: 'Special Art', variants: hosted.variants };
const apply = (h = hosted, r = record) => { const diagnostics = []; return { record: reconcileHostedPrinting(r, h, diagnostics), diagnostics }; };
const transport = (data = hosted) => {
  const calls = [];
  return { ...createTcgDexCatalog({ fetchImpl: async url => {
    const u = new URL(url); calls.push(u.href); assert.equal(u.origin, 'https://api.tcgdex.net');
    return { ok: true, json: async () => structuredClone(u.pathname.endsWith('/cards') ? [{ id: data.id, localId: data.localId, name: data.name }] : u.pathname.includes('/cards/') ? data : set) };
  } }), calls };
};
const title = '2026 Pokemon 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare';
const listings = (t = title, count = 3) => Array.from({ length: count }, (_, i) => ({ itemId: `${t}-${i}`, title: t, condition: 'Ungraded', localizedAspects: [{ name: 'Language', value: 'English' }], price: { value: '40', currency: 'USD' } }));

test('packaged snapshot validates exact blobs and explicit printing for more than one subject', () => {
  assert.deepEqual(validateCatalogSnapshot(snapshot).map(r => [r.id, r.names.en, r.type]), [['30th-149', 'Pikachu ex', 'holo'], ['30th-148', 'Greninja ex', 'holo']]);
});

test('tampered artifact and mismatched source revision cannot be trusted', () => {
  const changed = structuredClone(snapshot); changed.sources[1].content += '\n';
  assert.throws(() => validateCatalogSnapshot(changed), /snapshot_digest/);
  assert.throws(() => validateCatalogSnapshot(changed, digest(changed)), /snapshot_blob/);
  const wrong = structuredClone(snapshot); wrong.sources[1].revision = 'previous';
  assert.throws(() => validateCatalogSnapshot(wrong, digest(wrong)), /snapshot_source_revision/);
  const repo = { ...snapshot, repository: 'untrusted/catalog' };
  assert.throws(() => validateCatalogSnapshot(repo, digest(repo)), /snapshot_provenance/);
  const order = structuredClone(snapshot); order.revisions.correction.committedAt = '2026-09-15T00:00:00Z';
  assert.throws(() => validateCatalogSnapshot(order, digest(order)), /snapshot_revision_order/);
});

test('restricted source parser rejects executable code, duplicate keys and incomplete printing evidence', () => {
  const source = snapshot.sources.find(s => s.id === 'card149');
  for (const content of [source.content.replace('hp: 190', 'hp: process.exit()'), source.content + '\nprocess.exit()', source.content.replace('hp: 190', 'hp: 190, hp: 200')]) assert.throws(() => parseCatalogLiteral(content), /source_/);
  for (const replacement of ['variants: []', 'variants: [{type: "holo"}, {type: "normal"}]', 'variants: [{stamp: ["30th-anniversary"]}]']) {
    const data = structuredClone(snapshot), file = data.sources.find(s => s.id === 'card149');
    file.content = file.content.replace(/variants: \[[\s\S]*?\n\t\],/, replacement + ','); file.blobSha = blob(file.content);
    assert.throws(() => validateCatalogSnapshot(data, digest(data)), /snapshot_(incomplete_printing|printing)/);
  }
});

test('older generated hosted default is corrected with immutable source provenance', () => {
  const result = apply();
  assert.deepEqual(result.record.variants, { normal: false, holo: true, reverse: false });
  assert.equal(result.record.printingProvenance.revision, snapshot.revisions.snapshot.sha);
  assert.equal(result.record.printingProvenance.correctionRevision, snapshot.revisions.correction.sha);
  assert.deepEqual(result.record.printingProvenance.stamp, ['30th-anniversary']);
  assert.equal(result.record.printingProvenance.hostedUpdated, '2026-09-17T00:45:22+02:00');
  assert.deepEqual(result.record.printingProvenance.hostedDetailed, [{ type: 'normal', size: 'standard', variantId: 'generated' }]);
  assert.deepEqual(hosted.variants, { firstEdition: false, holo: false, normal: true, reverse: false, wPromo: false });
  assert.ok(result.diagnostics.some(d => d.accepted));
  result.record.printingProvenance.stamp.length = 0;
  assert.deepEqual(apply().record.printingProvenance.stamp, ['30th-anniversary']);
});

test('current hosted printing is preserved; old snapshots cannot override newer contrary evidence', () => {
  const current = { ...hosted, updated: '2026-10-01T00:00:00Z', variants: { normal: false, holo: true, reverse: false }, variants_detailed: [{ type: 'holo' }] };
  const currentRecord = { ...record, variants: current.variants };
  assert.equal(apply(current, currentRecord).record, currentRecord);
  const laterConflict = apply({ ...hosted, updated: '2026-10-01T00:00:00Z' });
  assert.equal(laterConflict.record, record);
  assert.equal(laterConflict.diagnostics[0].reason, 'hosted_revision_not_proven_older');
});

test('missing dates, ambiguous or explicit printings and incomplete evidence fail safely', () => {
  for (const patch of [
    { updated: null }, { updated: 'invalid' }, { updated: '2026-02-31' }, { updated: '2026-09-15' }, { updated: '2026-09-20T08:47:23Z' },
    { variants_detailed: null }, { variants_detailed: [] }, { variants_detailed: [{ type: 'normal', variantId: 'explicit' }] },
    { variants_detailed: [{ type: 'normal', variantId: 'generated' }, { type: 'holo' }] },
    { variants_detailed: [{ type: 'normal', variantId: 'generated', stamp: ['promo'] }] },
    { variants: { normal: true, holo: false } }, { variants: { normal: false, holo: false, reverse: true } },
  ]) {
    const result = apply({ ...hosted, ...patch });
    assert.equal(result.record, record, JSON.stringify(patch));
    assert.ok(result.diagnostics.some(d => !d.accepted));
  }
});

test('same subject, wrong collector/set/count/language/artwork and unrelated cards never inherit correction', () => {
  for (const patch of [{ subject: 'Raichu ex' }, { localId: '150' }, { cardNumber: '150/128' }, { cardNumber: '149/191' }, { setId: 'sv08' }, { brandSet: 'Surging Sparks' }, { officialCount: 191 }, { language: 'ja' }, { releaseDate: '2024-09-13' }, { rarity: 'Common' }]) {
    assert.equal(apply(hosted, { ...record, ...patch }).record.printingProvenance, undefined, JSON.stringify(patch));
  }
  for (const patch of [{ id: 'other-149' }, { name: 'Raichu ex' }, { localId: '150' }, { set: { ...set, id: 'sv08' } }]) assert.equal(apply({ ...hosted, ...patch }).record.printingProvenance, undefined);
  assert.equal(apply({ ...hosted, id: 'other-149' }, { ...record, id: 'other-149' }).record.printingProvenance, undefined);
  // A second real upstream subject follows the same mechanism, without a code exception.
  const greninja = { ...record, id: '30th-148', localId: '148', cardNumber: '148/128', subject: 'Greninja ex' };
  assert.equal(apply({ ...hosted, id: greninja.id, localId: '148', name: greninja.subject }, greninja).record.variants.holo, true);
});

test('actual handler corrects stale catalog printing before valuation and retains strict comparable matching', async () => {
  const catalog = transport();
  const wrong = ['Reverse-Holo Special Art', 'Non-Holo Special Art', 'Base', 'Holo Alternate Art'].flatMap(v => listings(title.replace('Holo Special Illustration Rare', v)));
  const result = await runPipeline({ proposal, neutral: listings(), market: [...listings(), ...wrong], catalogOptions: catalog, routingEnv: { NODE_ENV: 'development' },
    vision: { imageSummary: 'This Stellar Crown card has strong eye appeal. Corner whitening is visible.', psa10Upside: 'Stellar Crown is difficult to grade. Light surface marks may limit the grade.', gemRiskFactors: ['2024 Stellar Crown surface texture.', 'Minor edge whitening.'] } });
  assert.equal(result.httpStatus, 200, JSON.stringify(result.errors));
  assert.equal(result.payload.canonicalCard.parallel, 'Holo Special Art');
  assert.equal(result.payload.canonicalCard.brandSet, '30th Celebration');
  assert.equal(result.payload.valuationIdentityGate.allowed, true);
  assert.equal(isValuationTrusted(result.report), true);
  assert.equal(result.payload.marketData.rawComparableItems.length, 3);
  assert.equal(result.payload.marketData.excludedItems.length, 12);
  assert.equal(catalog.calls.length, 3); // No GitHub request per scan.
  assert.equal(result.report.rawValue, 40);
  assert.ok(result.payload.identityDiagnostics.catalog.diagnostics.some(d => d.source === 'tcgdex_upstream_snapshot' && d.accepted));
  assert.equal(result.report.imageAnalysis.identifiedBrandSet, 'Stellar Crown'); // explicitly labelled initial interpretation
  assert.equal(result.report.imageAnalysis.imageSummary, 'Corner whitening is visible.');
  assert.equal(result.report.imageAnalysis.psa10Upside, 'Light surface marks may limit the grade.');
  assert.deepEqual([...result.report.imageAnalysis.gemRiskFactors], ['Minor edge whitening.']);
  for (const finish of ['Reverse-Holo Special Art', 'Non-Holo Special Art', 'Base', 'Holo Alternate Art']) {
    assert.equal(identitySearchGate(result.report.identityVerification, { ...result.report.canonicalCard, parallel: finish }).allowed, false);
  }
  persist('corrected', result.report);
  const restored = safeStoredReport({ ...result.report, imageAnalysis: { ...result.report.imageAnalysis, imageSummary: 'Stellar Crown has sharp edges. Surface scratches visible.' } });
  assert.equal(isValuationTrusted(restored), true);
  assert.equal(restored.imageAnalysis.imageSummary, 'Surface scratches visible.');
  for (const field of ['subject', 'cardNumber', 'year', 'brandSet']) {
    const invalid = safeStoredReport({ ...result.report, canonicalCard: { ...result.report.canonicalCard, [field]: null } });
    assert.equal(invalid.rawValue, null); assert.equal(invalid.atlas, null);
  }
});

test('fallback cannot bypass sparse variants, protected identity choices or genuinely newer hosted contradictions', async () => {
  for (const neutral of [[], listings(title, 2)]) {
    const result = await runPipeline({ proposal, neutral, market: listings(), catalogOptions: transport() });
    assert.equal(isValuationTrusted(result.report), false);
    assert.equal(result.report.rawValue, null);
  }
  const protectedResult = await runPipeline({ proposal, fields: { cardType: 'pokemon', cardName: 'Unknown card from image', confirmedIdentity: { year: '2024', brandSet: 'Stellar Crown' } }, neutral: listings(), market: listings(), catalogOptions: transport() });
  assert.equal(protectedResult.payload.identityVerification.catalog.requiresConfirmation, true);
  assert.equal(protectedResult.metrics.valuationBrowse, 0);
  assert.equal(protectedResult.report.rawValue, null);
  const result = await runPipeline({ proposal, neutral: listings(), market: listings(), catalogOptions: transport({ ...hosted, updated: '2026-10-01T00:00:00Z' }) });
  assert.equal(result.payload.valuationIdentityGate.allowed, false);
  persist('blocked', result.report);
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.report.rawValue, null);
});


test('generated-default compatibility accepts only absent or standard size', () => {
  const legacy = { ...hosted, variants_detailed: [{ type: 'normal', variantId: 'generated' }] };
  assert.equal(apply(legacy).record.variants.holo, true);
  for (const size of ['jumbo', 'oversized', 'Standard', '', null, 1, {}, undefined]) {
    const result = apply({ ...hosted, variants_detailed: [{ ...hosted.variants_detailed[0], size }] });
    assert.equal(result.record, record);
    assert.equal(result.diagnostics[0].reason, 'hosted_not_generated_default');
  }
});

test('standard-size metadata cannot disguise arbitrary fields or contradictory printing claims', () => {
  for (const printing of [
    null, [], { ...hosted.variants_detailed[0], stamp: ['promo'] },
    { ...hosted.variants_detailed[0], extra: false },
    { ...hosted.variants_detailed[0], type: 'holo' },
    { ...hosted.variants_detailed[0], type: 'reverse' },
    { ...hosted.variants_detailed[0], variantId: 'explicit' },
  ]) assert.equal(apply({ ...hosted, variants_detailed: [printing] }).record, record);
  for (const patch of [
    { firstEdition: true }, { wPromo: true }, { firstEdition: null },
    { wPromo: 'false' }, { unknownPrinting: false }, { holo: true }, { reverse: true }, { normal: false },
  ]) assert.equal(apply({ ...hosted, variants: { ...hosted.variants, ...patch } }).record, record);
});


test('the exact trusted Pikachu fixture is preserved through protected same-deployment Preview routing', async () => {
  const result = await runPipeline({ proposal, neutral: listings(), market: listings(), catalogOptions: transport(),
    routingEnv: { VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production', VERCEL_URL: 'gempredict-live-immutable123.vercel.app', NEXT_PUBLIC_SITE_URL: undefined },
    requestHeaders: { 'x-vercel-oidc-token': 'mock.preview.signature' },
  });
  assert.equal(result.httpStatus, 200, JSON.stringify(result.errors));
  assert.equal(result.metrics.preflightRequests, 2);
  assert.equal(result.payload.canonicalCard.brandSet, '30th Celebration');
  assert.equal(result.payload.canonicalCard.parallel, 'Holo Special Art');
  assert.equal(result.payload.valuationIdentityGate.allowed, true);
  assert.equal(isValuationTrusted(result.report), true);
  assert.equal(result.report.rawValue, 40);
});

import { verifiedIdentity, verifiedVariant } from './helpers/verifiedIdentity.mjs';
import { mockCatalog } from './helpers/catalogFixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreListing } from '../lib/ebayIdentityMatch.mjs';
import { protectValuation, isValuationTrusted, safeStoredReport, withheldSummary, requestVariantRevaluation } from '../lib/valuationProtection.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';

const identity = { player: 'Dragalge', year: '2023', set: 'Paldea Evolved', cardNumber: '89/197', parallel: 'Common non-holo', autoOrRelic: 'none' };
const title = '2023 Pokemon Paldea Evolved Dragalge 89/197 Regular Non-Holo';
const match = (value, aspects) => scoreListing(value, 'Dragalge 89/197', identity, { localizedAspects: aspects });
const aspect = value => [{ name: 'Set', value }];

test('explicit unfamiliar title sets are contradictions, including set after collector number and treatment wording', () => {
  assert.equal(match(title).comparable, true);
  for (const value of [
    title.replace('Paldea Evolved', 'Obsidian Flames'),
    '2023 Dragalge #89/197 Obsidian Flames Regular Non-Holo NM',
    'Dragalge 89/197 Obsidian Flames Non Holo',
    '2023 Pokemon Set: Obsidian Flames Dragalge 89/197 Non-Holo',
  ]) {
    assert.equal(match(value).comparable, false, value);
    assert.ok(match(value).reasons.includes('Conflicting product/set evidence'));
  }
  assert.equal(match('2023 Pokemon Set: Paldea Evolved Dragalge 89/197 Non-Holo').comparable, true);
  assert.equal(match('Dragalge #89/197 Paldea Evolved Pokemon Card Non-Holo').comparable, true);
  assert.equal(match('Dragalge #89/197 Obsidian Flames Pokemon Card Non-Holo').comparable, false);
});

test('structured set/product aspects are checked alongside titles and matching metadata never erases a contradiction', () => {
  for (const name of ['Set', 'Product', 'Product Set']) {
    assert.equal(match(title, [{ name, value: 'Obsidian Flames' }]).comparable, false);
    assert.equal(match('Dragalge #89/197 Non-Holo', [{ name, value: '2023 Pokemon SV Paldea Evolved' }]).comparable, true);
  }
  assert.equal(match(title.replace('Paldea Evolved', 'Obsidian Flames'), aspect('Paldea Evolved')).comparable, false);
  assert.equal(match(title, [...aspect('Paldea Evolved'), ...aspect('Obsidian Flames')]).comparable, false);
  assert.equal(match(title, aspect('2024 Pokemon Paldea Evolved')).comparable, false);
  assert.equal(match(title, aspect('2023 Pokemon Scarlet & Violet Paldea Evolved')).comparable, true);
  assert.equal(scoreListing(title, 'Dragalge 89/197', { ...identity, set: '2023 Paldea Evolved' }, { localizedAspects: aspect('2023 Pokemon SV Paldea Evolved') }).comparable, true);
  assert.equal(match(title, aspect('Does not apply')).comparable, true);
});

test('missing and ambiguous seller prose stay uncertain, not falsely confirmed or rejected as a named different set', () => {
  for (const value of ['Dragalge #89/197 Non-Holo', 'NM Dragalge #89/197 Regular Non-Holo', 'Amazing Dragalge #89/197 Non-Holo', 'Best Deal Dragalge #89/197 Non-Holo']) {
    const result = match(value);
    assert.equal(result.comparable, true, value);
    assert.ok(result.reasons.includes('Product/set not fully stated'), value);
    assert.ok(!result.reasons.includes('Same product/set'), value);
  }
  const optic = { player: 'Jayden Daniels', cardNumber: '248', year: '2024', set: 'Donruss Optic', parallel: 'Purple Shock' };
  assert.equal(scoreListing('Jayden Daniels Optic #248 Purple Shock', 'Jayden Daniels', optic, { localizedAspects: aspect('Panini Optic') }).comparable, true);
  assert.equal(scoreListing('2024 Panini Optic Football Rated Rookie Jayden Daniels #248 Purple Shock', 'Jayden Daniels', optic).comparable, true);
  assert.equal(match('2023 Pokemon Paldea Evolved English Dragalge #89/197 Non-Holo').comparable, true);
  assert.equal(match('2023 Pokemon Obsidian Flames English Dragalge #89/197 Non-Holo').comparable, false);
  const holoSet = { player: 'Pikachu', cardNumber: '28/73', set: 'Holo Phantoms', parallel: 'Holo' };
  assert.equal(scoreListing('Pikachu #28/73 Holo Phantoms Holographic', 'Pikachu', holoSet).comparable, true);
});

const protectedCard = { subject: 'Dragalge', cardNumber: '89/197', year: '2023', brandSet: 'Paldea Evolved', parallel: 'Common non-holo' };
const payload = { ...verifiedIdentity(protectedCard), prediction: { rawValue: 55, gradingUpside: 100, expectedNetValue: 100, verdict: 'grade', action: 'Grade it.' }, variantVerification: verifiedVariant(protectedCard), marketData: { marketSummary: { rawUsedCount: 3, rawMedian: 10, marketConfidence: 55, valuationTrusted: false } } };
const field = (status, value, conflictingListingCount = 0) => ({ status, value, conflictingListingCount });

test('unresolved year/set conflicts withhold every financial recommendation despite verified variant and prices', () => {
  for (const name of ['year', 'set']) {
    for (const status of ['unresolved_conflict', 'insufficient_evidence']) {
      const result = protectValuation({ ...payload, identityVerification: { ...payload.identityVerification, [name]: field(status, name === 'year' ? '2023' : 'Paldea Evolved', 2) } });
      assert.equal(result.valuationVerification.reason, 'identity_unresolved');
      assert.ok(result.valuationVerification.unresolvedIdentityFields.includes(name));
      assert.equal(result.marketData.marketSummary.rawMedian, null);
      assert.equal(result.marketData.marketSummary.marketConfidence, 55);
      for (const key of ['rawValue', 'gradingUpside', 'expectedNetValue', 'verdict', 'action']) assert.equal(result.prediction[key], null);
      assert.equal(result.atlas, null);
    }
  }
});

test('missing listing wording does not become a conflict; missing canonical set is unresolved; explicit choices remain protected', () => {
  assert.equal(protectValuation({ ...payload, identityVerification: { ...payload.identityVerification, set: field('insufficient_evidence', 'Paldea Evolved') } }).valuationVerification.status, 'trusted');
  for (const value of [null, '', 'unknown', 'N/A']) assert.equal(protectValuation({ ...payload, identityVerification: { ...payload.identityVerification, set: field('insufficient_evidence', value) } }).valuationVerification.status, 'untrusted');
  for (const status of ['verified', 'corrected', 'user_protected']) {
    assert.equal(protectValuation({ ...payload, identityVerification: { ...payload.identityVerification, set: field(status, 'Paldea Evolved', 3) } }).valuationVerification.status, 'trusted');
  }
  assert.equal(protectValuation({ ...payload, identityVerification: { ...payload.identityVerification, year: { ...field('user_protected', '2023'), userValues: ['2023', '2024'] } } }).valuationVerification.reason, 'identity_unresolved');
});

test('previously trusted saved mixed-set reports are demoted before display/copy/share', () => {
  const report = { ...payload.prediction, variantVerification: payload.variantVerification, marketData: { marketSummary: { ...payload.marketData.marketSummary, valuationTrusted: true } }, identityVerification: { ...payload.identityVerification, set: field('unresolved_conflict', 'Paldea Evolved', 3) }, valuationVerification: { status: 'trusted', reason: null, explanation: 'Old prices matched.' } };
  assert.equal(isValuationTrusted(report), false);
  const saved = safeStoredReport(report);
  assert.equal(saved.valuationVerification.reason, 'identity_unresolved');
  assert.equal(saved.rawValue, null);
  assert.equal(saved.gradingUpside, null);
  assert.equal(saved.marketData.marketSummary.rawMedian, null);
  assert.match(withheldSummary(saved), /Year\/set identity is unresolved/);
  assert.doesNotMatch(withheldSummary(report), /\$|Grade it|Old prices matched/);
});

test('real Dragalge pipeline blocks all valuation searches while mixed identity is unresolved', async () => {
  const result = await runPipeline(scenarios.find(item => item.id === 'dragalge-conflicting-sets'));
  assert.equal(result.httpStatus, 200);
  assert.equal(result.observed.setStatus, 'unresolved_conflict');
  assert.equal(result.observed.variantStatus, 'verified');
  assert.equal(result.observed.usedCount, 0);
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.observed.marketConfidence, 0);
  assert.equal(result.payload.marketData.excludedItems.length, 0);
  assert.equal(result.payload.marketData.querySelection.attempts.length, 0);
  assert.ok(result.payload.marketData.rawComparableItems.every(item => item.title.includes('Paldea Evolved')));
  assert.equal(result.payload.valuationVerification.reason, 'identity_unresolved');
  assert.doesNotMatch(result.copied, /\$|Grade It/);
  assert.equal(result.payload.imageAnalysis.identifiedBrandSet, 'Paldea Evolved');
  assert.equal(result.payload.identityEvidenceItems.length, 6);
});

test('manual year/set selection uses fresh matching, honors protected identity and never unlocks the mixed median', async () => {
  const template = scenarios.find(item => item.id === 'dragalge-conflicting-sets');
  const unresolved = await runPipeline(template);
  for (const [set, price] of [['Paldea Evolved', 10], ['Obsidian Flames', 100]]) {
    let calls = 0;
    const confirmed = await requestVariantRevaluation(unresolved.report, { identity: { subject: 'Dragalge', cardNumber: '89/197', year: '2023', brandSet: set }, parallel: 'Common non-holo', autoOrRelic: 'none' }, async (url, request) => {
      calls++;
      const fields = JSON.parse(request.body);
      assert.equal(fields.confirmedIdentity.brandSet, set);
      assert.equal(fields.confirmedIdentity.year, '2023');
      for (const key of ['rawValue', 'marketData', 'prediction']) assert.equal(fields[key], undefined);
      const fresh = await runPipeline({ ...template, textOnly: true, fields, catalogOptions: mockCatalog([{ id: 'mock:selected-set', subject: 'Dragalge', cardNumber: '89/197', year: '2023', brandSet: set }]) });
      assert.equal(fresh.payload.identityVerification.year.status, 'user_protected');
      assert.equal(fresh.payload.identityVerification.set.status, 'user_protected');
      assert.equal(fresh.payload.canonicalCard.brandSet, set);
      assert.equal(fresh.metrics.neutralBrowse, 1);
      assert.equal(fresh.metrics.valuationBrowse, 6);
      assert.equal(fresh.payload.marketData.marketSummary.rawUsedCount, 3);
      assert.equal(fresh.payload.marketData.marketSummary.rawMedian, price);
      return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => fresh.payload };
    });
    assert.equal(calls, 1);
    assert.equal(isValuationTrusted(confirmed), true);
    assert.equal(confirmed.rawValue, price);
    assert.notEqual(confirmed.rawValue, 55);
    assert.equal(confirmed.originalCanonicalCard.brandSet, 'Paldea Evolved');
  }
});


test('conflicting neutral sets block valuation before structured-aspect price pools are fetched', async () => {
  const template = scenarios.find(item => item.id === 'dragalge-conflicting-sets');
  const market = template.market.map(item => ({ ...item, title: 'Dragalge #89/197 Non-Holo', localizedAspects: aspect(item.title.includes('Paldea Evolved') ? 'Paldea Evolved' : 'Obsidian Flames') }));
  const result = await runPipeline({ ...template, market });
  assert.equal(result.observed.usedCount, 0);
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.observed.marketConfidence, 0);
  assert.equal(result.payload.marketData.excludedItems.length, 0);
  assert.equal(result.payload.valuationVerification.reason, 'identity_unresolved');
});

test('material year conflicts remain untrusted; manually selected year triggers fresh exact-year pricing', async () => {
  const template = scenarios.find(item => item.id === 'pikachu-non-holo');
  const old = template.market.filter(item => item.title.includes('Non-Holo'));
  const later = old.map(item => ({ ...item, itemId: 'later-' + item.itemId, itemWebUrl: item.itemWebUrl + '-later', title: item.title.replace('2017', '2018'), price: { value: '100', currency: 'USD' } }));
  const scenario = { ...template, neutral: [...old, ...later], market: [...old, ...later] };
  const unresolved = await runPipeline(scenario);
  assert.equal(unresolved.payload.identityVerification.year.status, 'unresolved_conflict');
  assert.equal(unresolved.payload.variantVerification.status, 'verified');
  assert.equal(unresolved.payload.valuationVerification.reason, 'identity_unresolved');
  assert.equal(unresolved.observed.usedCount, 0);
  assert.equal(unresolved.metrics.valuationBrowse, 0);
  const confirmed = await requestVariantRevaluation(unresolved.report, { identity: { subject: 'Pikachu', year: '2018', brandSet: 'Shining Legends', cardNumber: '28/73' }, parallel: 'Common non-holo', autoOrRelic: 'none' }, async (url, request) => {
    const fields = JSON.parse(request.body);
    const fresh = await runPipeline({ ...scenario, textOnly: true, fields, catalogOptions: mockCatalog([{ id: 'mock:selected-year', subject: 'Pikachu', cardNumber: '28/73', year: '2018', brandSet: 'Shining Legends' }]) });
    assert.equal(fresh.payload.identityVerification.year.status, 'user_protected');
    assert.equal(fresh.payload.canonicalCard.year, '2018');
    assert.equal(fresh.metrics.neutralBrowse, 1);
    assert.equal(fresh.metrics.valuationBrowse, 6);
    assert.equal(fresh.payload.marketData.marketSummary.rawUsedCount, 3);
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => fresh.payload };
  });
  assert.equal(isValuationTrusted(confirmed), true);
  assert.equal(confirmed.rawValue, 100);
  assert.equal(confirmed.originalCanonicalCard.year, '2017');
});


test('inconsistent structured/title set evidence is unresolved even if no single alternate set wins a vote', async () => {
  const template = scenarios.find(item => item.id === 'dragalge-conflicting-sets');
  const correct = template.market.filter(item => item.title.includes('Paldea Evolved'));
  const neutral = correct.map(item => ({ ...item, localizedAspects: aspect('Obsidian Flames') }));
  const result = await runPipeline({ ...template, neutral, market: correct });
  assert.equal(result.payload.identityVerification.set.status, 'insufficient_evidence');
  assert.equal(result.payload.identityVerification.set.ambiguousListingCount, 3);
  assert.equal(result.payload.variantVerification.status, 'insufficient_evidence');
  assert.equal(result.payload.variantVerification.evidenceReferences.length, 0);
  assert.equal(result.payload.identityEvidenceExclusions.length, 3);
  assert.equal(result.observed.usedCount, 0);
  assert.equal(result.metrics.valuationBrowse, 0);
  assert.equal(result.payload.valuationVerification.reason, 'variant_unresolved');
  assert.ok(result.payload.valuationVerification.unresolvedIdentityFields.includes('set'));
  assert.equal(result.payload.prediction.gradingUpside, null);
});


test('resolved canonical metadata cannot bless an older mixed-set comparable pool', () => {
  const canonicalCard = { subject: 'Dragalge', cardNumber: '89/197', year: '2023', brandSet: 'Paldea Evolved', parallel: 'Common non-holo' };
  const marketData = { ...payload.marketData, rawComparableItems: [{ title }, { title: title.replace('Paldea Evolved', 'Obsidian Flames') }], marketSummary: { ...payload.marketData.marketSummary, rawMedian: 55, valuationTrusted: true } };
  const report = { ...payload.prediction, canonicalCard, variantVerification: payload.variantVerification, marketData, identityVerification: { ...payload.identityVerification, set: field('verified', 'Paldea Evolved') }, valuationVerification: { status: 'trusted' } };
  assert.equal(isValuationTrusted(report), false);
  assert.equal(safeStoredReport(report).rawValue, null);
  assert.equal(safeStoredReport(report).valuationVerification.reason, 'identity_unresolved');
  assert.doesNotMatch(withheldSummary(report), /\$|Grade it/);
  const guarded = protectValuation({ ...payload, canonicalCard, marketData, identityVerification: { ...payload.identityVerification, set: field('user_protected', 'Paldea Evolved') } });
  assert.equal(guarded.valuationVerification.reason, 'identity_unresolved');
  assert.equal(guarded.prediction.gradingUpside, null);
});

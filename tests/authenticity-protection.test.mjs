import test from 'node:test';
import assert from 'node:assert/strict';
import { unofficialReasons } from '../lib/cardAuthenticity.mjs';
import { scoreListing, getListingType } from '../lib/ebayIdentityMatch.mjs';
import { matchIdentityEvidence } from '../lib/marketIdentityEvidence.mjs';
import { requestVariantRevaluation, safeStoredReport, isMarketAnalysisAvailable, withheldSummary } from '../lib/valuationProtection.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
const pika = scenarios.find(s => s.id === 'pikachu-non-holo');
const fan = scenarios.find(s => s.id === 'fanmade-known-identity');
const identity = { player: pika.proposal.subject, set: pika.proposal.brandSet, year: '2017', cardNumber: '28/73', parallel: 'Common non-holo', autoOrRelic: 'none' };

test('explicit unofficial title and aspect evidence cannot enter either official-card pool', () => {
  for (const word of ['Fanmade', 'Fan-made', 'Unofficial', 'Proxy', 'Replica', 'Counterfeit', 'Reprint', 'Custom-created card', 'Custom']) {
    const item = { ...pika.market[0], title: `${pika.market[0].title} ${word}` };
    assert.equal(getListingType(item.title), 'excluded', word);
    assert.equal(scoreListing(item.title, 'Pikachu 28/73', identity, item).comparable, false, word);
    assert.equal(matchIdentityEvidence(item, pika.proposal), null, word);
  }
  for (const [name, value] of [['Authenticity', 'Unofficial'], ['Original/Licensed Reprint', 'Unlicensed Reprint'], ['Features', 'Fan-made']]) {
    const item = { ...pika.market[0], localizedAspects: [{ name, value }] };
    assert.equal(scoreListing(item.title, 'Pikachu 28/73', identity, item).comparable, false);
    assert.equal(matchIdentityEvidence(item, pika.proposal), null);
  }
});

test('official promos, authorized reissues, negations and accessory wording are not counterfeit evidence', () => {
  for (const title of ['Official Pokemon Promo', 'Official Topps Archives Reprint', 'Manufacturer-authorized reissue', 'Original card, not a reprint', 'Custom protective case included', 'Official licensed commemorative card']) assert.deepEqual(unofficialReasons({ title }), [], title);
  assert.deepEqual(unofficialReasons({ title: pika.market[0].title, localizedAspects: [{ name: 'Custom Bundle', value: 'No' }] }), []);
  assert.equal(getListingType('Official Topps Archives Reprint'), 'raw');
  assert.deepEqual(unofficialReasons({ title: 'Official Topps Archives Reprint', localizedAspects: [{ name: 'Features', value: 'Reprint' }] }), []);
  const title = pika.market[0].title + ' not a reprint';
  assert.equal(scoreListing(title, 'Pikachu 28/73', identity).comparable, true);
  assert.ok(matchIdentityEvidence({ title }, pika.proposal));
});

test('actual fanmade fixture excludes all prices/votes and retains excluded original evidence', async () => {
  const result = await runPipeline(fan);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.observed.usedCount, 0);
  assert.equal(result.observed.marketConfidence, 0);
  assert.equal(result.payload.identityEvidenceItems.length, 0);
  assert.equal(result.payload.identityEvidenceExclusions.length, 3);
  assert.ok(result.payload.identityEvidenceExclusions.every(e => e.observations[0].originalItem.title.includes('Fanmade')));
  assert.equal(result.payload.valuationVerification.reason, 'authenticity_unresolved');
  assert.equal(result.payload.atlas, null);
  assert.equal(result.report.rawValue, null);
  assert.doesNotMatch(result.copied, /\$/);
});

test('original image warning blocks even clean matching listings and survives fresh manual year/set/version confirmation', async () => {
  const result = await runPipeline({ ...pika, notes: fan.notes });
  assert.equal(result.observed.usedCount, 3);
  assert.equal(result.payload.valuationVerification.reason, 'authenticity_unresolved');
  assert.ok(result.report.imageAnalysis);
  let fresh;
  const confirmed = await requestVariantRevaluation(result.report, { identity: pika.proposal, parallel: 'Common non-holo', autoOrRelic: 'none' }, async (url, options) => {
    const fields = JSON.parse(options.body);
    assert.ok(fields.authenticityWarnings.length);
    assert.equal(fields.marketData, undefined);
    fresh = await runPipeline({ ...pika, textOnly: true, fields });
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => fresh.payload };
  });
  assert.ok(fresh.metrics.valuationBrowse > 0);
  assert.equal(fresh.payload.variantVerification.status, 'user_confirmed');
  assert.equal(fresh.payload.valuationVerification.reason, 'authenticity_unresolved');
  assert.equal(isMarketAnalysisAvailable(confirmed), false);
  assert.equal(confirmed.rawValue, null);
  const reopened = safeStoredReport({ ...confirmed, rawValue: 999, valuationVerification: { status: 'trusted' }, marketData: { ...confirmed.marketData, marketSummary: { ...confirmed.marketData.marketSummary, valuationTrusted: true } } });
  assert.equal(reopened.rawValue, null);
  assert.doesNotMatch(withheldSummary(reopened), /\$/);
});

test('explicit vision authenticity flags survive normalization without changing condition analysis', async () => {
  for (const vision of [{ isUnofficial: true }, { authenticityWarning: 'Authenticity requires independent examination.' }]) {
    const result = await runPipeline({ ...pika, vision });
    assert.equal(result.payload.valuationVerification.reason, 'authenticity_unresolved');
    assert.equal(result.payload.atlas, null);
    assert.equal(result.payload.imageAnalysis.centering, null);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalCardFromText, missingTextIdentityFields } from '../lib/textCardIdentity.mjs';
import { requestVariantRevaluation } from '../lib/valuationProtection.mjs';

test('fully specified text uses explicit subject, fractional number, year, set and version only', () => {
  const card = buildCanonicalCardFromText({ cardName: 'Pikachu #28/73 Common non-holo', cardSet: '2017 Shining Legends' });
  assert.equal(card.subject, 'Pikachu');
  assert.equal(card.cardNumber, '28/73');
  assert.equal(card.year, '2017');
  assert.equal(card.brandSet, 'Shining Legends');
  assert.equal(card.parallel, 'Common non-holo');
  assert.equal(card.autoOrRelic, 'unknown');
  assert.deepEqual(missingTextIdentityFields(card), []);
});

test('subject-only input never invents missing identity', () => {
  const card = buildCanonicalCardFromText({ cardName: 'Pikachu' });
  assert.equal(card.subject, 'Pikachu');
  assert.equal(card.parallel, null);
  assert.equal(card.year, null);
  assert.equal(card.brandSet, null);
  assert.ok(missingTextIdentityFields(card).includes('card number'));
});

test('manual completion sends exact identity for fresh valuation without cached prices', async () => {
  const identity = { subject: 'Pikachu', cardNumber: '28/73', year: '2017', brandSet: 'Shining Legends' };
  let calls = 0;
  const result = await requestVariantRevaluation({ canonicalCard: buildCanonicalCardFromText({ cardName: 'Pikachu' }), rawValue: 999999 }, { identity, parallel: 'Common non-holo', autoOrRelic: 'none' }, async (url, request) => {
    calls++;
    const body = JSON.parse(request.body);
    assert.equal(url, '/api/predict');
    assert.equal(body.confirmedCardIdentity.subject, identity.subject);
    assert.equal(body.confirmedCardIdentity.cardNumber, '28/73');
    assert.equal(body.confirmedIdentity.year, '2017');
    assert.equal(body.rawValue, undefined);
    assert.equal(body.textOnlyIdentity, true);
    return { ok: true, json: async () => ({ prediction: { rawValue: 2 }, canonicalCard: identity, variantVerification: { status: 'user_confirmed' }, valuationVerification: { status: 'trusted' }, marketData: { marketSummary: { valuationTrusted: true, rawMedian: 2, rawUsedCount: 3 } } }) };
  });
  assert.equal(calls, 1);
  assert.equal(result.rawValue, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserIdentityProtection } from '../lib/userIdentityProtection.mjs';
import { resolveMarketIdentity } from '../lib/reconcileMarketIdentity.mjs';
import { buildEbaySearchParams } from '../lib/ebayIdentityMatch.mjs';

const proposal = { subject: 'Pikachu', cardNumber: '28/73', year: '2016', brandSet: 'Hidden Fates', parallel: 'Common non-holo', displayName: '2016 Hidden Fates Pikachu 28/73' };
async function resolve(input) {
  return resolveMarketIdentity(proposal, {
    ...getUserIdentityProtection(input),
    clientId: 'mock-client', clientSecret: 'mock-secret',
    fetchImpl: async url => String(url).includes('/oauth2/token')
      ? { ok: true, json: async () => ({ access_token: 'mock-token' }) }
      : { ok: true, json: async () => ({ itemSummaries: [1, 2, 3].map(id => ({ itemId: String(id), title: '2017 Pokemon Shining Legends Pikachu 28/73 Regular Non-Holo' })) }) },
  });
}

test('typed subject alone allows independently supported year and set correction', async () => {
  assert.deepEqual(getUserIdentityProtection({ cardName: 'Pikachu' }).protectedFields, []);
  const result = await resolve({ cardName: 'Pikachu' });
  assert.equal(result.identityVerification.year.status, 'corrected');
  assert.equal(result.identityVerification.set.status, 'corrected');
  assert.equal(result.canonicalCard.year, '2017');
  assert.equal(result.canonicalCard.brandSet, 'Shining Legends');
  const params = buildEbaySearchParams('Pikachu', result.canonicalCard);
  assert.equal(params.get('year'), '2017');
  assert.equal(params.get('set'), 'Shining Legends');
  assert.equal(proposal.year, '2016');
});

test('a year in card-name text protects only the explicit year, not the proposed set', async () => {
  const result = await resolve({ cardName: '2015 Pikachu' });
  assert.equal(result.identityVerification.year.status, 'user_protected');
  assert.equal(result.identityVerification.year.originalValue, '2016');
  assert.deepEqual(result.identityVerification.year.userValues, ['2015']);
  assert.equal(result.canonicalCard.year, '2015');
  assert.equal(result.identityVerification.set.status, 'corrected');
  assert.equal(result.canonicalCard.brandSet, 'Shining Legends');
});

test('a set without a year protects only the explicit set and allows year correction', async () => {
  const result = await resolve({ cardName: 'Pikachu', cardSet: 'Lost Origin' });
  assert.equal(result.canonicalCard.year, '2017');
  assert.equal(result.identityVerification.year.status, 'corrected');
  assert.equal(result.canonicalCard.brandSet, 'Lost Origin');
  assert.equal(result.identityVerification.set.status, 'user_protected');
  assert.equal(result.identityVerification.set.originalValue, 'Hidden Fates');
});

test('a year-only set/year field does not protect the set', async () => {
  assert.deepEqual(getUserIdentityProtection({ cardSet: '2015' }).protectedFields, ['year']);
  const result = await resolve({ cardName: 'Pikachu', cardSet: '2015' });
  assert.equal(result.canonicalCard.year, '2015');
  assert.equal(result.canonicalCard.brandSet, 'Shining Legends');
  assert.equal(result.identityVerification.set.status, 'corrected');
});

test('combined set/year text preserves both supplied values rather than the vision values', async () => {
  const result = await resolve({ cardName: 'Pikachu', cardSet: '2015, Lost Origin' });
  assert.equal(result.canonicalCard.year, '2015');
  assert.equal(result.canonicalCard.brandSet, 'Lost Origin');
  assert.equal(result.identityVerification.year.status, 'user_protected');
  assert.equal(result.identityVerification.set.status, 'user_protected');
  assert.match(result.canonicalCard.displayName, /^2015 Lost Origin/);
});

test('structured year/set and per-field confirmations remain independently protected', async () => {
  for (const input of [
    { year: '2015', set: 'Lost Origin' },
    { year: 2015, set: 'Lost Origin' },
    { confirmedIdentity: { year: '2015', brandSet: 'Lost Origin' } },
    { confirmedIdentity: JSON.stringify({ year: '2015', set: 'Lost Origin' }) },
  ]) {
    const result = await resolve({ cardName: 'Pikachu', ...input });
    assert.equal(result.canonicalCard.year, '2015');
    assert.equal(result.canonicalCard.brandSet, 'Lost Origin');
  }
  const setOnly = await resolve({ confirmedIdentity: { set: 'Lost Origin' } });
  assert.equal(setOnly.identityVerification.year.status, 'corrected');
  const yearOnly = await resolve({ confirmedIdentity: { year: '2015' } });
  assert.equal(yearOnly.identityVerification.set.status, 'corrected');
});

test('card numbers are not year choices and conflicting explicit years stay inspectable', () => {
  for (const cardName of ['Pikachu #2017', 'Pikachu # 2017', 'Pikachu 28/2017', 'Pikachu OP2017-014']) {
    assert.deepEqual(getUserIdentityProtection({ cardName }).protectedFields, [], cardName);
  }
  const conflict = getUserIdentityProtection({ cardName: '2015 Pikachu', cardSet: '2017 Shining Legends' });
  assert.deepEqual(conflict.userChoices.year, ['2015', '2017']);
  assert.equal(conflict.userIdentity.year, null);
  assert.ok(conflict.protectedFields.includes('year'));
});

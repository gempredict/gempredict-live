import { mockCatalog } from './catalogFixtures.mjs';
export const card = (subject, year, brandSet, cardNumber, parallel) => ({ subject, year, brandSet, cardNumber, parallel, autoOrRelic: 'none' });
export function listings(title, count = 3, price = 10, prefix = 'a') {
  return Array.from({ length: count }, (_, i) => ({ itemId: `${prefix}-${i}`, title, condition: 'Ungraded', itemWebUrl: `https://www.ebay.com/itm/${prefix}-${i}`, price: { value: String(price), currency: 'USD' } }));
}
const pikachu = card('Pikachu', '2017', 'Shining Legends', '28/73', 'Common non-holo');
const pikaGood = listings('2017 Shining Legends Pikachu 28/73 Regular Non-Holo');
const pikaBad = listings('2017 Shining Legends Pikachu 28/73 Holo', 2, 100, 'holo');
const kid = card('Eustass Captain Kid', '2026', 'One Piece', 'OP14-014', 'Standard Art');
const kidListings = parallel => listings(`2026 One Piece Eustass Captain Kid OP14-014 ${parallel}`, 3, parallel === 'Standard Art' ? 10 : parallel === 'Alternate Art' ? 80 : 200, parallel);
const dragalge = card('Dragalge', '2023', 'Paldea Evolved', '89/197', 'Common non-holo');
const dragalgeListings = [...listings('2023 Pokemon Paldea Evolved Dragalge 89/197 Regular Non-Holo', 3, 10, 'pe'), ...listings('2023 Pokemon Obsidian Flames Dragalge 89/197 Regular Non-Holo', 3, 100, 'of')];
const shane = card('Shane Smith', '2025', 'Topps Chrome', '175', 'Green Sand Glitter /99');
const shaneGood = listings('2025 Topps Chrome Shane Smith #175 Green Sand Glitter 12/99');
const shaneBad = listings('2025 Topps Chrome Shane Smith #175 Green Sand Glitter 12/49', 2, 100, '49');
const fanmade = listings('2017 Shining Legends Pikachu 28/73 Regular Non-Holo Fanmade');
export const scenarios = [
  { id: 'pikachu-non-holo', proposal: pikachu, neutral: [...pikaGood, ...pikaBad], market: [...pikaGood, ...pikaBad], expectedTrusted: true },
  { id: 'zamazenta-correction', proposal: card('Zamazenta', '2020', 'Sword & Shield', '021/025', 'Holo'), neutral: listings('2021 Celebrations Zamazenta 021/025 Holo'), market: [...listings('2021 Celebrations Zamazenta 021/025 Holo'), ...listings('2020 Sword & Shield Zamazenta 021/025 Holo', 2, 100, 'old')], expectedTrusted: true },
  { id: 'ian-happ-correction', type: 'sports', proposal: card('Ian Happ', '2021', 'Topps Series 1', '155', 'Base'), neutral: listings('2026 Topps Series 1 Ian Happ #155 Base'), market: [...listings('2026 Topps Series 1 Ian Happ #155 Base'), ...listings('2021 Topps Series 1 Ian Happ #155 Base', 2, 100, 'old')], expectedTrusted: true },
  { id: 'dragalge-conflicting-sets', proposal: dragalge, neutral: dragalgeListings, market: dragalgeListings, expectedTrusted: false },
  ...['Standard Art', 'Alternate Art', 'Special Art'].map(parallel => ({ id: 'kid-' + parallel.toLowerCase().replaceAll(' ', '-'), type: 'onepiece', proposal: { ...kid, parallel }, neutral: kidListings(parallel), market: [...kidListings('Standard Art'), ...kidListings('Alternate Art'), ...kidListings('Special Art')], expectedTrusted: true })),
  { id: 'kid-art-unresolved', type: 'onepiece', proposal: kid, neutral: [...kidListings('Standard Art').slice(0, 2), ...kidListings('Alternate Art').slice(0, 2)], market: [...kidListings('Standard Art'), ...kidListings('Alternate Art')], expectedTrusted: false },
  { id: 'manual-variant-confirmation', confirmation: true, textOnly: true, fields: { cardName: kid.subject, cardType: 'onepiece', confirmedCardIdentity: kid, originalIdentityProposal: kid, confirmedIdentity: { year: kid.year, brandSet: kid.brandSet }, confirmedVariant: { parallel: 'Alternate Art', autoOrRelic: 'none' } }, neutral: kidListings('Alternate Art'), market: kidListings('Alternate Art'), expectedTrusted: true },
  { id: 'shane-smith-99', type: 'sports', proposal: shane, neutral: [...shaneGood, ...shaneBad.slice(0, 1)], market: [...shaneGood, ...shaneBad], expectedTrusted: true },
  { id: 'unrecognized-fanmade', proposal: { subject: 'Mystery Fanmade Character', year: null, brandSet: null, cardNumber: null, parallel: null }, neutral: [], market: [], expectedTrusted: false },
  { id: 'fanmade-known-identity', proposal: pikachu, notes: 'Visible Fanmade / unofficial marking. This is not an official release.', neutral: fanmade, market: fanmade, expectedTrusted: false },
  { id: 'text-complete', textOnly: true, fields: { cardName: 'Pikachu #28/73 Common non-holo', cardSet: '2017 Shining Legends', cardType: 'pokemon' }, neutral: pikaGood, market: [...pikaGood, ...pikaBad], expectedTrusted: true },
  { id: 'text-subject-only', textOnly: true, fields: { cardName: 'Pikachu', cardType: 'pokemon' }, neutral: [], market: [...pikaGood, ...pikaBad], expectedTrusted: false },
  { id: 'model-price-drift', proposal: pikachu, neutral: pikaGood, market: pikaGood, model: { rawValue: 150, psa9Value: 160, psa10Value: 200 }, expectedTrusted: true },
  { id: 'fractional-price', proposal: pikachu, neutral: pikaGood, market: listings('2017 Shining Legends Pikachu 28/73 Regular Non-Holo', 3, 2.5), expectedTrusted: true },
].map(scenario => ({ ...scenario, catalogOptions: mockCatalog() }));

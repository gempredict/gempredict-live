import { buildMarketQueryFromCanonicalCard, marketVariantKeywords } from './cardIdentifier.js';

export const MARKET_QUERY_BUDGET = 6;

export default function buildSearchCandidates(input = {}) {
  // Retain the vision-shaped calling convention used by Atlas. Prediction
  // ranking passes only the final reconciled canonical identity.
  const card = {
    ...input,
    subject: input.subject ?? input.identifiedSubject,
    year: input.year ?? input.identifiedYear,
    brandSet: input.brandSet ?? input.identifiedBrandSet,
    cardNumber: input.cardNumber ?? input.identifiedCardNumber,
    parallel: input.parallel ?? input.identifiedParallel,
    autoOrRelic: input.autoOrRelic ?? input.identifiedAutoOrRelic,
  };
  const conciseVariant = marketVariantKeywords(card).replace(/\b(?:common|regular)\s+(?=non[- ]?holo)/gi, '');
  const conciseCard = { ...card, parallel: conciseVariant };
  // These optional brand prefixes are already equivalent in strict matching.
  const shortSet = String(card.brandSet || '').replace(/\bPanini\s+/gi, '').replace(/\bDonruss\s+(?=Optic\b)/gi, '').trim();
  const queries = [
    buildMarketQueryFromCanonicalCard(card),
    buildMarketQueryFromCanonicalCard(card, { withHash: false }),
    buildMarketQueryFromCanonicalCard(conciseCard, { includeYear: false, includeSet: false, withHash: false }),
    buildMarketQueryFromCanonicalCard(conciseCard, { includeYear: false, includeSet: false }),
    buildMarketQueryFromCanonicalCard(card, { withHash: false, includeVariant: false }),
    buildMarketQueryFromCanonicalCard(conciseCard, { includeYear: false, withHash: false, setOverride: shortSet }),
  ];
  return [...new Map(queries.filter(Boolean).map(query => [query.toLowerCase(), query])).values()].slice(0, MARKET_QUERY_BUDGET);
}

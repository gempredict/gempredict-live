# Milestone 1D — isolated completed-sales adapter

Implemented in `lib/providers/theCardApiAdapter.mjs`; focused tests in
`tests/the-card-api-adapter.test.mjs`. No runtime entrypoint, workflow registration,
network transport, credentials, environment reads, storage, scanner import, or
Production integration is added. Importing or calling the adapter is offline.

## Existing contracts preserved

The adapter imports `exactEvidenceIdentity`, `validEvidenceDate`, `EVIDENCE_TYPES`,
`SALES_POLICY` and `analyzeCompletedSales` from the existing completed-sales
engine. It uses the existing catalog name/language/rarity normalization and
canonical identity validation. The unchanged market evidence presentation engine
remains behind the unchanged licensed completed-sales analysis. It references
the existing grading economics fee; no new economics model, PSA probability,
raw-to-graded multiplier, recommendation or UI is created.

The normalized transactions can be translated to the existing completed-sales
envelope fields: identity, evidenceType, amountBasis, soldAt, transactionStatus,
currency, amount, grading and provenance, retaining the original source title.
For this milestone the envelope is ALWAYS unavailable, commercialDisplay and
transactionRecords are false, rightsReference is null, and coverage is not
asserted complete. Caller-supplied rights cannot enable it. The existing engine
therefore returns unavailable; marketPresentation is null and valuationApproved
is false. Even qualifying evaluation-only sample medians cannot unlock grading
recommendations or live valuation. Existing evidence scoring may impose further
source-title/variant constraints before any future integration; its checks have
not been bypassed or replaced with invented catalog-enriched titles.

## Reviewed identity boundary

PIKACHU_TARGET is the requested canonical target specification, not a claim that
an independent transaction catalog match has been established. The reviewed
naming alias list contains `30th Celebration` and `ME: 30th Celebration`, with
the previously inspected official TCGplayer catalog search as its reference:
https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=Pikachu-ex

The default product/language/printing mapping registry is intentionally EMPTY.
There is no verified SKU-level mapping available from the retained observations.
In particular, no product ID is decoded from an opaque transaction ID, and
Holofoil is never promoted to SIR by a global string replacement. An exact
reviewed mapping requires a review reference, reviewer/date, complete canonical
identity, provider product ID, subject, full number, set, language, rarity and
printing. The configured crosswalk must match actual row evidence. The registry
is a trusted offline configuration boundary, never client-submitted evidence.
Synthetic reviewed mappings in the tests are explicitly labelled NOT REAL and
are never embedded as default mappings.

Conflicting structured fields and title evidence reject the identity; missing
positive support stays unresolved. Set aliases require explicit approval.
Partial collector numbers cannot replace the full fraction. Languages, rarity,
finish, parallel and ambiguous structured variants are checked separately.
Original titles need not contain a literal year or rarity when an independently
reviewed crosswalk positively establishes them. A source printing label by
itself cannot establish language or rarity.

## Normalization and provenance

Provider confirmation and independently verified settlement are distinct.
Only finite positive numeric `price` with `price_confirmed=true` and a recognized
sale type becomes a confirmed amount. Unknown Best Offer consideration remains
unknown. Asking observations remain asks; original_price is only askingAmount.
Source dates are validated against the supplied clock. Date-only observations
retain day precision; no midnight or ID-derived timestamp is fabricated. The
existing evidence timestamp requirement blocks those records from eligibility.

Raw grade needs positive reviewed raw evidence. Explicit PSA 9 and PSA 10 stay
separate, conflicts/qualifiers and other/missing grades remain unknown. No raw
status is inferred from a null grade. Shipping, quantity and amount units remain
unknown unless provided or positively reviewed. Evidence requires a reviewed
per-card amount basis and transaction provenance, so price-per-order ambiguity
cannot silently enter a per-card median.

Source URLs are never constructed. The pure URL inspector only recognizes
credential-free HTTPS TCGplayer product routes without query strings/fragments;
it labels them syntax_and_host_only and catalog_product_not_transaction.
Unknown routes/hosts are withheld. No link is fetched or treated as settlement
proof. Review metadata must establish the provider observation's source item,
source transaction, observation time and reference. The adapter does not claim
that this metadata or a public transaction link already exists for these sales.

Duplicate provider observations are excluded; distinct provider IDs sharing a
reviewed source transaction also cannot inflate samples. Contradictory copies
quarantine the entire transaction, independent of input ordering. A unique opaque
provider ID is explicitly NOT proof of unique underlying source settlement.

## Recency-aware evaluation evidence

Default windows: 7 days recent activity, 30 days primary current window, 90 days
historical support. They are configurable within the existing 90-day ceiling;
minimumSample can increase but cannot fall below the existing minimum of 3.
Raw, PSA 9, PSA 10 and unknown groups remain separate. Only eligible, deduplicated,
dated, identity-verified USD observations with an established unit basis contribute.
Unknown grades do not contribute to medians. Insufficient samples produce null,
not a modeled replacement. The 90-day fallback is labelled historical support,
not silently treated as a current market price.

Each window reports count, date range, freshness, low/high, median absolute
deviation, variability flags and gaps. Outliers remain in the observed median;
no release-day transaction is automatically discarded. Window labels do not
create history: caller-supplied coverage is reported separately, completeness
is always unproven, and the evaluation fixture explicitly records the known
three-day free-plan lookback. A 30/90-day window can therefore contain available
observations while clearly stating that the requested history is not established.
No extra pages or history are fetched.

## Three observed candidates: normalized example

The committed tests contain only hand-authored facts supplied by the owner for
three observations, not stored provider response payloads. IDs, exact timestamps,
structured identity, grade, shipping, quantity and raw URLs were deliberately
not copied from API bodies or inferred. A null below means not established in
this minimum-fact fixture, NOT proof the upstream API lacks that field.

| Field | Observation 1 | Observation 2 | Observation 3 |
| --- | --- | --- | --- |
| provider | the-card-api | the-card-api | the-card-api |
| transactionId | null | null | null |
| saleDate / precision | 2026-10-29 / day | 2026-10-29 / day | 2026-10-29 / day |
| amount / currency | 27.99 USD | 47.99 USD | 43.49 USD |
| amountConfirmation | provider_confirmed | provider_confirmed | provider_confirmed |
| identity.status | unresolved | unresolved | unresolved |
| identity.canonical | null | null | null |
| grading.group | unknown | unknown | unknown |
| timestamp / shipping / quantity | null | null | null |
| provenance.status | unresolved | unresolved | unresolved |
| sourceUrl.status / url | not_available / null | not_available / null | not_available / null |
| deduplication.status | missing_identifier | missing_identifier | missing_identifier |
| settlement.providerConfirmed | true | true | true |
| settlement.independentlyVerified | false | false | false |
| status | blocked | blocked | blocked |

All three retain the intended target separately from verified identity. Blockers
include the missing reviewed product/language/printing mapping, timestamp,
fixture transaction ID, grade, source provenance and unit basis. The group has
3 unknown-grade candidates, 0 eligible evidence samples, null 7/30/90-day
valuation medians, unavailable licensed completed-sales analysis, blocked grading
economics, and valuationApproved=false. No mean or price estimate is substituted.

## Licensing and remaining integration gaps

No commercial entitlement, TCGplayer upstream rights or persistent-response
storage rights are asserted. The free tier is evaluation/noncommercial only.
Terms reference: https://www.thecardapi.com/terms (previously inspected, Sections
4a, 5 and 7). This milestone neither subscribes nor persists provider responses.
No response cache, bulk dataset, capture, image store or transaction URL archive
is added. The fixture is a minimal authored regression case from owner-supplied
facts; all other transactions, identifiers, licenses and reviews in tests are
explicitly synthetic counterexamples or contract examples.

Before live integration:

1. Establish and review the actual product/SKU, language, rarity and printing
   crosswalk, using independently sourced catalog evidence.
2. Establish transaction provenance, source uniqueness/refund semantics, units,
   quantity, shipping, condition and grade coverage from lawful existing evidence.
3. Verify existing commercial, caching and upstream marketplace rights; no new
   subscription is created or authorized by this milestone.
4. Test the exact provider-to-existing-engine bridge with legitimate reviewed
   metadata; preserve original source text and resolve any legacy scorer mismatch
   without inventing title details or weakening scanner gates.
5. Evaluate enough recent raw and graded transactions and, separately, calibrated
   condition/probability evidence before any grading recommendation.
6. Separately authorize transport, storage/retention, production wiring and live
   end-to-end checks. None are part of this implementation.

## Offline validation

    node --test tests/the-card-api-adapter.test.mjs

14 focused tests cover owner-observed candidates, crosswalk ambiguity and aliases,
wrong numbers/sets/languages/variants, amounts/asks/offers, grades, duplicate and
conflicting transactions, recency/history limitations, sample minimums, variability,
source URL boundaries, license gating and the unchanged completed-sales engine.
All pass. The 32 existing Card API and 13 CardSight offline tests also pass.
No GitHub Actions run, deployment, live request, paid AI call, credential operation,
Production change or scanner/UI modification was performed.

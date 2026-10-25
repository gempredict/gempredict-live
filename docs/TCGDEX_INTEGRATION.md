# TCGdex independent Pokémon identity integration

## Scope and baseline

Work starts from `2d0c64c1c15bb3fb4033d29cdd3bd218941d192a` on
`restore/phase1-identity-market-matching`. The checkout was clean. Changes are
uncommitted. This supersedes the no-provider readiness limitation in the earlier
identity audit for the Pokémon category only; sports and other categories still
have no real catalog adapter.

## Delivery and data contract

`resolveMarketIdentity` selects the server-only TCGdex adapter for
`cardType: "pokemon"`. Tests can inject their own transport or catalog. No API
key, additional dependency, credential change, or provider pricing feed is needed.
The native HTTPS transport preserves configured proxy and TLS defaults and does
not follow redirects. The API origin and supported language paths are fixed.

The documented V2 flow is:

1. `/v2/{language}/cards` with name/local-number filters and explicit pagination.
   Discovery never includes the AI-proposed set, release year, or variant.
2. Fetch a matching `/cards/{id}` detail and `/sets/{setId}` record.
3. Recheck the exact localized name, local number, set ID/name consistency,
   official denominator, valid release date, and complete candidate set.
4. Return independent identity records and diagnostics. Bundled API prices are
   discarded from the card cache and never enter comparables or pricing.

Collector numbers use `localId` plus `set.cardCount.official`, not `total` (which
includes secret cards). Numeric IDs and zero padding are normalized. A unique
bare local number can be completed; multiple matching sets remain ambiguous.
Set IDs and available `tcgOnline`/abbreviation metadata are retained and used as
aliases, without hardcoding a 30C mapping. Missing abbreviations are not invented.

Language names/codes are normalized; English is the default lookup locale when
no language was observed, but that lookup scope does not establish the physical
card language: confirmation is required before valuation. The confirmation form
now accepts card language. Unsupported languages fail closed instead of silently
switching to English. The vision-normalization and text-input paths retain
language. Exact names tolerate accents/punctuation but do not equate unrelated
Pokémon names. Supported rarity aliases include SIR, Special Illustration Rare,
and Special Art; they do not imply base, reverse, or other physical printings.
Explicitly impossible finish flags remain conflicts. Unknown finish details do
not independently certify a variant.

## Corrections and safeguards

A complete, unique TCGdex record may correct an AI-proposed set/year, complete a
collector number and canonicalize known aliases before any valuation query.
Explicit conflicting user year/set choices require confirmation. Candidate-limit
truncation, multiple identities, malformed data, unsupported languages, HTTP
errors, and timeouts cannot certify an identity or unlock pricing.

Neutral eBay evidence remains a separate source with its original observations.
A catalog correction does not erase contrary seller evidence or recast it as
catalog support. Subsequent variant checks use the corrected canonical identity.
Material unresolved variant or identity conflicts request confirmation and keep
trusted pricing withheld. Final and restored-report guards recheck the exact
catalog candidate against the current identity.

Comparable filters retain exact subject, number, set, year and variant checks.
When a catalog language is known, comparables must explicitly state a matching
language in their title or structured Language aspect. Conflicting or missing
language is excluded. Recognized SIR aliases identify the same artwork and do
not permit base cards into the price pool. No unrelated results are accepted to
create a valuation.

Development-only `identityDiagnostics` contains requested endpoints, retrieval or
cache status, normalized accepted records, rejected candidates/reasons, catalog
corrections, original conflicts, and the final valuation gate. Production retains
verification references and corrections but excludes response-level diagnostics.
Server transport code is isolated from client-side variant utilities.

## Bounds

- At most four candidate details, with a fifth search result forcing ambiguity.
- At most nine requests per lookup (one search, four cards, four sets).
- 2.5-second per-request timeout and 8-second overall lookup deadline.
- Successful validated responses cached for five minutes, at most 128 entries
  per server process. No stale data is used after expiry; failures are not cached.
- One-megabyte transport response limit; redirects are not followed.
- No retries or exhaustive scans of the full catalog.

## Pikachu regression outcome

The mocked V2 regression **corrects**, rather than merely flags, the incorrect
Surging Sparks/2024 proposal to:

- Pikachu ex, **149/128**
- **30th Celebration**, set ID **30th**, printed code **30C** when available
- Release **2026-09-16**, release year **2026**
- Special Illustration Rare / Special Art

The route regression verifies that all valuation queries use the corrected
identity. With three exact mocked English comparables, the price pool contains
only those cards, rejects Surging Sparks listings, and becomes trusted through
the existing variant and financial safeguards. No real price is asserted. Other
regressions verify no trusted pricing with ambiguous identity, unavailable data,
explicit user conflicts, wrong languages, wrong denominators, or stale variants.

These fixtures use facts checked in the upstream TCGdex set/card records; they
are not a hardcoded production correction.

## Live verification limit

One authorized unauthenticated request to
`https://api.tcgdex.net/v2/en/cards/30th-149` was attempted. The configured proxy
returned **403 Forbidden**. Further live requests stopped immediately. All
integration testing uses mocked API responses; live TCGdex delivery and exact
hosted response schema remain unverified in this environment. The documented
V2 schema and upstream data informed implementation. Do not treat a successful
mock as evidence that the host policy permits production or local API access.

Sources:
- https://tcgdex.dev/rest/filtering-sorting-pagination
- https://tcgdex.dev/reference/card
- https://tcgdex.dev/reference/set
- https://github.com/tcgdex/cards-database/blob/master/data/Mega%20Evolution/30th%20Celebration.ts
- https://github.com/tcgdex/cards-database/blob/master/data/Mega%20Evolution/30th%20Celebration/149.ts

Commercial rollout still needs the service/image-use terms clarified as recorded
in the prior assessment. This change uses catalog metadata only, not images or
TCGdex marketplace pricing. No Anthropic/eBay API calls, deployment, merge,
commit, or push are part of this implementation.

## Verification results

- Complete automated suite: **183 passed, 0 failed, 0 skipped**, including **26 TCGdex regressions** and all **7 Anthropic proxy tests**.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: **passed** (lint/type checks, compilation, and static generation).
- `git diff --check`: **passed**.
- Browser smoke scripts: **3/3 passed** — variant UI, both financial-consistency cases, and all 16 Stage A scenarios. External browser requests were mocked or aborted.

The default production adapter wiring is tested by mocking native HTTPS, not by
calling TCGdex. Positive pipeline tests use the real adapter and route code with
mocked V2 responses and mocked eBay/Anthropic transports. Missing-language
confirmation and a fresh revaluation are exercised through the actual handler.

# Milestone 1G — broad retrieval, strict local screening

This is an aggregate-only evaluation benchmark, not an adapter approval,
commercial activation or customer valuation feature. It uses the existing
Private vision benchmark workflow and THE_CARD_API_KEY repository secret.
Implementation preparation made no live sales/catalog calls or Actions dispatches.

The prior narrow-query run returned zero for all three cases. The current plan
uses subject-only retrieval and local screening; see
[search-strategy investigation](THE_CARD_API_SEARCH_STRATEGY.md).

## Fixed cards and queries

| Test | Intended reference | Sales query (`q`) | Additional filters |
| --- | --- | --- | --- |
| A — high-volume Pokémon | Charizard ex #006/165, Scarlet & Violet—151 (Double Rare reference) | `"Charizard ex"` | None |
| B — SIR reference | Pikachu ex #149/128, ME: 30th Celebration | `"Pikachu ex"` | None |
| C — PSA 10 coverage | Pikachu ex #238/191, SV08: Surging Sparks | `"Pikachu ex"` | `graded=true`, `grader=PSA`, `grade=10` |

Each uses the fixed endpoint
`https://www.thecardapi.com/api/v1/market/sales`, `limit=25`, `page=1`,
`sort=date_desc`, and x-market-api-key header authentication.
No caller-controlled query, endpoint, row limit or additional fallback is accepted.

References checked as public documentation on October 29, 2026:

- [API search syntax and GET /sales parameters](https://www.thecardapi.com/docs).
  Quoted phrases and parenthesized comma-separated OR terms are documented.
  graded and grader are documented filters. grade is documented as a single
  grade value; no grade=9,10 union filter is invented. C uses one documented scalar
  grade=10 filter and independently inspects returned grade fields. There is no
  additional grade=9 request or title-grade expression. Query matching does
  not establish exact PSA grade, qualification, language or physical printing.
- [TCGplayer's Charizard ex 006/165 catalog entry](https://www.tcgplayer.com/product/502558/pokemon-sv-scarlet-and-violet-151-charizard-ex-006-165?Condition=Near+Mint&Language=English)
  establishes the A reference; public sales activity/listing information supports
  choosing it as a high-volume test, not a guaranteed current API sample size.
- [TCGplayer's Surging Sparks card reference](https://www.tcgplayer.com/content/article/robot/983c50b8-8920-4548-8843-6c23b62e6814/)
  identifies the C reference and its full number. These references are NOT
  product/SKU-to-transaction crosswalk approvals.
- B uses the previously retained owner observations and reviewed set naming.

The broad queries omit collector number, set, year and rarity constraints.
Exact subject, set aliases and full collector number are screened locally;
conflicting language/printing evidence is rejected and missing positive identity
evidence remains unverified. Broad first pages do not establish exhaustive coverage.
A's matching also excludes the separate Japanese 151 release, wrong numbers,
conflicting sets, language evidence and unrelated printings when present.

## Request, spending and secrecy boundaries

A complete successful run performs exactly three GETs, one per fixed case. There
are never more than three attempts or 75 accepted returned rows. Requests ask for
at most 25 rows; a provider response exceeding that bound is rejected rather than
silently truncated. A missing key makes zero requests. HTTP/network/JSON/schema
failures stop early with an explicit failed result; there is no retry, compensating
query, redirect, cursor follow, quota probe, health request or extra detail lookup.
The benchmark does not create plans, upgrades, subscriptions or paid AI calls.

The native HTTPS transport retains its endpoint restriction, TLS checks,
20-second timeout and 1 MiB response bound. Optional quota reporting adds only
numeric X-RateLimit-Limit, X-RateLimit-Remaining and X-RateLimit-Reset values;
arbitrary headers, Location and provider errors are never echoed. Header data
is not treated as evidence of a particular paid/free account entitlement.

Only the final coverage step receives the existing secret. It repeats the
repository, restoration branch, owner-ID, workflow_dispatch, mode, unique phrase
and first-attempt checks in code before transport. The existing exclusive per-run
sentinel is shared with other Card API diagnostics. The job has contents:read,
SHA-pinned actions, persist-credentials:false, the existing protected environment,
a 3-minute timeout and the existing noncancelling workflow concurrency group.

No raw response, row title, transaction ID, seller, price value, product ID,
source URL or opaque cursor is written to files, artifacts, summaries or logs.
Bodies exist only transiently in memory for bounded validation. The run emits
sanitized aggregate JSON; credential redaction remains a final output safeguard.
The small runner sentinel contains no response data. Existing licensing and
upstream-rights uncertainties remain; this is evaluation-only aggregate output.

## Report interpretation

Every attempted case reports its static card/query/filters, HTTP status and
numeric quota counters when provided. Missing quota is null, never unlimited.
A non-JSON HTTP 200 failure still retains the observed HTTP status.

Successful cases report:

- Returned count and provider-reported total query matches. A total is not the
  number of verified target-card sales or guaranteed independent settlements.
- Validated actual sale-date and chronological sale-timestamp ranges, observation counts by date, invalid
  completion-date count, and currency counts. These are sample observations,
  not an extrapolated daily trading-volume estimate.
- Candidate exact-card count from agreeing subject, full fraction and set evidence.
  Ambiguous variants have a separate pool; unrelated/conflicting rows are counted separately. Independently verified exact
  matches remain zero; no language, rarity or physical printing is inferred.
- Separate all-returned, candidate, ambiguous and unmatched pools. Each has confirmed-price
  versus unconfirmed counts, confirmed and unknown-amount offer counts, and known
  original-asking-price field counts. Asking amounts never become sale amounts.
- Raw, PSA 9, PSA 10 and unknown grade counts. providerStructured means provider
  fields, NOT independently verified grading. Inferred means an explicit source
  title/condition label, NOT verified status. Null grade does not imply raw.
  Qualifier/autograph flags, conflicting labels and unsupported grades stay unknown.
  Field availability and classification-basis counts allow grader coverage review.
  C separately counts matching, missing and conflicting provider grade/grader
  fields rather than assuming structured filters establish the returned grade.
- Source URL availability and public product/listing route counts without exposing
  links. Safe URL syntax is not transaction or settlement verification. Repeated
  provider IDs are counted in memory without inferring unique source transactions.
- Pagination evidence: nonempty cursor means another page is available; absent
  evidence stays unknown. No cursor is printed or followed; completeness is false
  (not established). Reported pages are not an instruction to fetch more.
- Provider-reported coverage dates, if valid, separately from effective plan
  lookback, which remains unknown. The documented free lookback is 3 days; no
  30/90-day coverage is fabricated or inferred from the first page.

Price range and median are currently withheld (null), validatedComparableCount=0.
The benchmark deliberately supplies no fabricated product/language/printing
crosswalk, raw verification, per-card-unit or transaction-provenance reviews.
It reuses the 1D adapter's disabled commercial envelope; valuationApproved and
commercialDisplayEnabled remain false. Aggregate provider price-confirmation
counts therefore do not become a first-page market value. Static rarity labels
in the test plan describe the intended references, not verified returned sales.
No normalized records or grading recommendations are published.

## Exact owner authorization

1. Open [Private vision benchmark](https://github.com/gempredict/gempredict-live/actions/workflows/vision-benchmark.yml).
2. Choose **Run workflow**, branch **restore/phase1-identity-market-matching**.
   Confirm that the branch contains the delivered commit.
3. Set **mode** to **dry-run**.
4. Set **confirmation** to exactly:
   `AUTHORIZE_THE_CARD_API_BROAD_THREE_SEARCHES_75_ROWS`
5. Dispatch as the account matching the existing numeric VISION_BENCH_OWNER_ID.
6. If prompted, approve the existing **vision-benchmark** environment for
   **The Card API three-card coverage (maximum three GETs, 75 rows)**.
7. Read aggregate JSON from **Run owner-authorized three-search coverage benchmark**.
   Do not rerun a failed job: attempt 2+ is blocked. A fresh dispatch is a separate
   authorization; inspect the first result before authorizing another.

The old two-request sales diagnostic, CardSight diagnostic and paid vision job
are skipped with these exact inputs. No secret, variable, environment or input
schema change is needed. mode=dry-run keeps paid vision disabled; the unique
confirmation explicitly authorizes only this new coverage job.

## Offline validation

    node scripts/the-card-api/coverage.mjs dry-run
    node --test tests/the-card-api-coverage.test.mjs tests/the-card-api.test.mjs tests/cardsight-access.test.mjs tests/the-card-api-adapter.test.mjs tests/the-card-api-compatibility-audit.test.mjs

18 coverage tests plus the 64 existing focused tests pass (82 total).
They cover the successful three-search/75-row plan, empty results, schema/row
limits, failures, no retries/redirects, conflicting variants, grade evidence,
withheld valuations, privacy, quota sanitization, native header transport,
owner authorization, first-attempt sentinel and workflow boundaries.
Syntax checks and credential-free dry-run pass. No live requests or workflow
runs were executed during implementation. Main, Production, scanner and live
valuation behavior are unchanged.

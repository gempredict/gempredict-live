# Milestone 1C: owner-run The Card API sales diagnostic

Prepared against restoration head `9c8f9a53e926a0c7cecd8ff34522f901259b5980`.
No live API requests were executed while preparing this change.

## Documented contract (checked 2026-10-29)

Source: https://www.thecardapi.com/docs — Authentication, GET /sales,
Response schema, Best Offer price states, and Rate limits.

The configured sales REST endpoint is `https://www.thecardapi.com/api/v1/market/sales`.
Authentication is the `x-market-api-key` request header, using the existing
`THE_CARD_API_KEY` repository secret. Catalog documentation also mentions
`x-api-key`; this diagnostic uses the sales-specific authentication section.
Do not paste the secret into workflow inputs or logs.

The response envelope has `data`, `pagination`, and `meta`. This diagnostic
checks the bounded data array, page/limit/total/has_more, and the sale fields
it consumes: id, platform, title, listing_type, sale_date, sold_at, price,
original_price, currency, price_confirmed. It stops on incompatible schema.
Only positive confirmed amounts with valid nonfuture completion dates are
reported as final prices. `fixed_price` here describes a sold listing, unlike
an active asking-price feed. `best_offer` is reported separately, including
completed observations with unknown accepted consideration. `original_price`
always remains a separate asking-price field; it never fills a missing final
price. Currency remains explicit; no conversion or valuation is performed.

Exact query: `2026 "Pikachu ex" "30th Celebration" "149/128" (SIR,"special illustration rare")`.
Only if the first response has no exact dated title candidate, one broader
query, `"Pikachu ex"`, is permitted. Each requests page 1, limit 25, sort
`date_desc`. Neither pagination nor a second API, catalog, quota, health,
listing-detail or authentication probe is allowed. Errors stop immediately.
Native HTTPS has no retries and does not follow redirects. A redirect can
therefore fail safely rather than silently consume another request.

The target is 2026 Pokémon 30th Celebration Pikachu ex #149/128 SIR.
Returned variants lacking complete title evidence, or with conflicting
structured identity or variant labels, are explicitly unmatched. Even full
title candidates require owner review of the printing, language and source.
Provider observations do not independently prove settlement. Source eBay links
are canonicalized; other URLs and unknown provider fields are omitted.

Maximum: two GETs and 50 returned sales rows. The documented allowance is
row-based; the key's current plan/lookback and remaining allowance apply.
No purchases, plan upgrades, AI calls or monetary billing-cap claim are made.
No exact result on these pages does not establish global absence of sales.

## Browser authorization — owner only

1. Open https://github.com/gempredict/gempredict-live/actions/workflows/vision-benchmark.yml
   (the existing **Private vision benchmark** workflow).
2. Click **Run workflow** and select branch
   **restore/phase1-identity-market-matching**. Check it contains the delivered
   commit before dispatch; do not select main.
3. Set **mode** to **dry-run**.
4. Set **confirmation** to exactly
   **AUTHORIZE_THE_CARD_API_MAX_2_GETS_50_ROWS**.
5. Click **Run workflow** using the account whose numeric actor ID matches the
   existing **VISION_BENCH_OWNER_ID** Actions variable. The account running this
   workflow must be that owner; another account's dispatch is skipped.
6. If the existing **vision-benchmark** environment requires approval, review
   and approve only the **The Card API sales verification** job on that branch.
   Existing environment protection and allowed-branch rules remain in force.
7. Read the job's sanitized JSON output and run summary. Confirm revision,
   request count, result categories, exact candidates and coverage limits.
   No raw response artifact is uploaded. Do not rerun failed jobs: attempt 2+
   is blocked. A fresh dispatch is a separate authorization and can consume
   another allowance; review the first result before deciding.

The ordinary credential-free dry-run prerequisite still runs. With these exact
inputs the paid vision job and CardSight job are skipped. The vision live-enable
variable is not needed for this separate read-only sales job and should not be
changed. Only this job's final step receives THE_CARD_API_KEY. It has read-only
repository permissions, SHA-pinned actions, a 3-minute timeout, an exclusive
per-run sentinel, and shares the existing noncancelling concurrency group.
Main, Vercel Production and scanner/application files are not modified.

## Offline checks

Run from the restoration checkout:

    node --test tests/the-card-api.test.mjs tests/cardsight-access.test.mjs
    node scripts/the-card-api/verify.mjs dry-run

These tests use synthetic fixtures and mocked HTTPS only. The 11 new tests and
13 existing CardSight tests passed locally. The existing vision suites could
not load because this runtime's preinstalled dependency tree lacks a resolvable
`sharp` package; dependency installation is also unavailable through its failed
shell proxy. Their existing GitHub Actions prerequisite is retained unchanged.

## One-request redirect inspection

The failed run 40889260704 recorded HTTP 307 but did not preserve Location.
A separate inspection mode now requires exactly
`AUTHORIZE_THE_CARD_API_ONE_GET_REDIRECT_HEADERS_ONLY` in **confirmation**,
with **mode=dry-run** and the same restoration branch, owner ID and environment
approval. Use a fresh **Run workflow**, not a rerun of the failed job.

This mode makes at most one authenticated GET to the configured endpoint,
using the exact public search with limit=1. It immediately destroys the response
at the headers for every HTTP status, never reads a response body, never follows
Location, never retries, and never forwards the key. Diagnostic output contains
only `httpStatus` and sanitized `location`. A missing status is null and fails
the step. The existing sales mode and its two-request/50-row cap are unchanged.

Location retains the HTTP(S) origin and known `/api/v1/market/sales` route.
Userinfo and fragments are removed. Unknown paths become `[REDACTED_PATH]`;
only q/limit/page/sort values identical to this public request are retained.
Other query parameters are replaced by a `_redacted=1` marker, without their
names or values. Invalid Location values become null. API key values are also
redacted from final output. No Location is treated as an approved destination.
The owner subsequently verified the 307 destination as the official www hostname,
with unchanged path and query; the configured endpoint now uses www directly.

Offline verification for this change: 16 sales/redirect boundary tests and
13 existing CardSight tests passed; script syntax check passed. No live request
was executed during implementation.

## Canonical hostname correction

Based on the owner-authorized redirect inspection, the endpoint now uses
`https://www.thecardapi.com/api/v1/market/sales` directly. The x-market-api-key
header, two-GET/50-row sales limit, no-redirect/no-retry transport and existing
authorization controls are unchanged. Use the original sales authorization
phrase `AUTHORIZE_THE_CARD_API_MAX_2_GETS_50_ROWS`, mode `dry-run`, and the
restoration branch for one fresh owner-dispatched sales run.
Offline verification: 17 sales/redirect tests and 13 CardSight tests passed,
plus syntax check and credential-free dry-run. No live API requests executed.

## One-request schema-only diagnostic

The owner reported HTTP 200 / schema_unrecognized at revision
`d14ec22a671115f555d9c0c60ccc188de6c8749d`. The response values were not logged;
the cause is not yet established. The official documentation (rechecked
2026-10-29, https://www.thecardapi.com/docs, Response schema and Best Offer price
states) still describes data/pagination/meta and price_confirmed. Its pagination
example includes total, page, limit and has_more. No undocumented defaults or
missing fields are synthesized in this change.

For one schema diagnostic, use the existing Private vision benchmark workflow:
branch `restore/phase1-identity-market-matching`, mode `dry-run`, confirmation
`AUTHORIZE_THE_CARD_API_ONE_GET_SCHEMA_ONLY`. Dispatch a fresh run as the
configured owner, and approve the existing vision-benchmark environment if
required. The sales and redirect authorization phrases cannot authorize this
mode. Owner, branch, first-attempt and exclusive per-run sentinel checks remain.

This mode requests only the first exact-search page (25-row limit), once.
There is no broader search, pagination, retry or redirect following. It uses
the existing x-market-api-key header only at the fixed www endpoint. The normal
sales mode retains its two-request/50-row maximum.

Live diagnostic output contains only top-level JSON type and field names/types,
presence/types of data/pagination/meta, returned data array length, first-record
type and field names/types, and the first failed validator requirement (null if
none). Field descriptions are bounded to 64 entries. Documented field names are
retained; unknown names are replaced with numbered unknown_field placeholders,
since arbitrary JSON keys could themselves contain credentials or private data.
No field values, titles, seller details, prices, URLs or raw responses are
printed. Credential redaction still applies. Request/JSON failures produce only
a fixed failure requirement, never provider errors. The diagnostic does not
claim successful sales validation or valuation.

The existing validator predicates were extracted into named checks shared by
sales and diagnostic modes. Identity, dated-completion and confirmed-price
processing remains unchanged; asks never fill final-price gaps. Offline checks:
21 sales/diagnostic tests plus 13 CardSight tests passed, syntax check and
credential-free dry-run passed. No live requests executed during implementation.

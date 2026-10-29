> Current live test: use the final one-request diagnostic at the end of this document.
> Earlier two-request instructions below describe the historical e77d768c test only.

# CardSight access test — two requests, no scanner integration

This reuses `.github/workflows/vision-benchmark.yml`, which is already registered
on `main`. GitHub lets the owner select a branch when dispatching that registered
workflow. Only the restoration-branch version is changed. No new workflow, main
registration commit, Vercel setting, environment or subscription is needed.

The existing `mode` and free-text `confirmation` inputs are reused so the input
schema already registered on main also works in the browser. `mode=dry-run`
prevents the paid vision job from executing. A separate job requires the exact
CardSight confirmation, repository, restoration ref, first attempt and actor ID
matching the existing `VISION_BENCH_OWNER_ID` variable. It reuses the branch-restricted
`vision-benchmark` environment. Do not enable/change `VISION_BENCH_LIVE_ENABLED`.
Only the final CardSight step receives the repository `CARDSIGHT_API_KEY` secret.

## Owner action (browser only)

1. Open https://github.com/gempredict/gempredict-live/actions/workflows/vision-benchmark.yml
   and click **Run workflow**. Select **restore/phase1-identity-market-matching**,
   set **mode = dry-run**, and enter **AUTHORIZE_CARDSIGHT_TWO_FREE_REQUESTS** in
   the existing confirmation text field. Click **Run workflow once**.
2. Approve the existing environment if GitHub requests it. Read the
   **CardSight read-only access (maximum two requests)** job summary/logs.
   The paid vision job must be skipped. Do not rerun after a failed request;
   bring the sanitized result back for review first.

No new owner variable is required. A missing/mismatched owner ID skips the live
CardSight job. A missing secret reports MISSING with zero requests. Existing
free-tier allowance must cover the two calls; the script does not purchase quota.

## Requests and evidence policy

Official authentication: HTTPS to `api.cardsight.ai`, `X-API-Key` header.
1. `GET /v1/catalog/cards?name=Pikachu+ex&year=2026&releaseName=30th+Celebration&take=100`
2. Only after exactly one complete match:
   `GET /v1/pricing/{card_id}?period=90d&listing_type=both`

Catalog matching requires Pikachu ex, local number 149 or full 149/128, 2026,
30th Celebration, explicit English language and SIR rarity fields. Missing fields,
other denominators, ambiguity, pagination/truncation or schema drift stop before
request two. A local-only number is reported as such, not as provider proof of
the official denominator. It does not invent language or rarity from the set.

The native HTTPS transport sends GET only, does not follow redirects, retries
nothing, bounds responses to 2 MiB, and times out after 20 seconds per request.
A runner-temporary exclusive sentinel prevents invoking it twice in the same run;
GitHub rerun attempts are rejected. There are no health, quota, image or AI calls.

Auction rows are labeled **provider-reported completed auctions**. Fixed/BIN rows
are asking prices; unknown types are unclassified. Raw, PSA 9 and PSA 10 remain
separate from other graders. Counts, count mismatches and advisory presence are
reported; at most five sanitized samples per group show actual returned prices,
dates and approved public source links. No seller information, images, listing
text, raw responses, HTTP headers, key values or artifacts are published.

Pricing is intentionally unfiltered across parallels for inspection. Variant
matching, paid/settled status and commercial delivery rights are NOT verified by
an HTTP success or by this script; accepted-for-valuation remains zero. No
medians, modeled estimates or substitute/lookalike cards are generated. A failure
to establish a complete match is not proof the card is absent from the provider.

## Official references reviewed October 29, 2026

- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- https://play.cardsight.ai/endpoints/search-cards
- https://play.cardsight.ai/endpoints/pricing
- https://github.com/CardSightAI/cardsightai-sdk-node/tree/6613ebc616c0276bbf20b820cda9d457f2a865ef
  (`src/client.ts`: header and endpoint transport; `src/generated/types.ts`:
  getCards, CardSummary, PricingRecord, PricingResponse schemas).

No downloaded SDK/TypeScript is executed or added as an application dependency.
Offline tests explicitly mock transports; dry-run attempts zero API requests.
Live findings may only be claimed from a completed owner-triggered Actions run.

## Final catalog discovery after the owner's e77d768c live result

The owner reports HTTP 200, zero catalog records, one request and no pricing.
The prior filters were documented: name is a case-insensitive partial subject
match, year is an exact release-year filter, and releaseName is a case-insensitive
partial release-name filter. The conjunction was valid; zero results does not
identify which field or catalog/index coverage caused the miss. No indexing delay
or alternate release spelling has been demonstrated.

One final owner-dispatched diagnostic is available using the SAME registered
workflow and restoration branch, `mode=dry-run`, confirmation:
**AUTHORIZE_CARDSIGHT_ONE_CATALOG_REQUEST**.

It sends exactly one GET:
`/v1/catalog/cards?name=Pikachu+ex&sort=year&order=desc&take=100`.
There is no year or release filter, pagination, retry or pricing call, including
when a match is found. The original two-request confirmation is now rejected by the live entry point
and no longer enables the workflow job. The legacy two-request helper remains
covered by offline mocks but is not called by the live workflow. The separate approval preserves
owner/repository/branch/first-attempt guards and the existing one-invocation sentinel.

Only allowlisted catalog metadata is reported: IDs, names, numbers, release names,
set names, years, language/rarity fields, total/returned counts and truncation.
Any catalog price fields are discarded. Unknown language/rarity remain unknown.
A zero result is an observed query miss, not proof that every possible alias is
absent. A truncated first page cannot establish full coverage absence either.

If the target still cannot be established, stop CardSight investigation and move
to a bounded The Card API evaluation under separately authorized access; do not
add more catalog-discovery infrastructure or keep trying filters. No live request
was made while preparing this change.

# Milestone 1G — retrieval strategy investigation

## What the retained evidence establishes

The [1F run 40943705178](https://github.com/gempredict/gempredict-live/actions/runs/40943705178)
returned HTTP 200 and total=0/data.length=0 for all three narrow searches. Its
B query was `"Pikachu ex" "149/128" "30th Celebration"`. It did not require a
literal year or rarity. The C query additionally combined number/set phrases
with an OR of PSA title labels and structured grader filters.

The earlier [successful broad run 40912268117](https://github.com/gempredict/gempredict-live/actions/runs/40912268117)
used `"Pikachu ex"` and returned 25 observations, including three titles naming
149/128 and ME: 30th Celebration. Those titles lack literal year/SIR labels, but
they DO contain the number and set phrase used by the later narrow B search.
The known candidate amounts remain the owner-reported 27.99, 47.99 and 43.49 USD.

This is evidence of a retrieval problem, not proof of an empty card market or
an adapter identity rejection: no rows reached local screening in the narrow
run. It does not isolate the provider's backend root cause. The public docs
support quoted phrases, but do not specify fraction tokenization or combined
phrase-index behavior sufficiently to explain this counterexample. Search
normalization/indexing or phrase combination semantics are possible causes;
time, coverage and lookback changes also prevent a controlled comparison.
No parser defect, unsupported syntax or account-wide card absence is claimed.
No new live request was made to test those hypotheses.

## Current three-request plan

| Case | Target retained for local screening | Broad q | Structured filters |
| --- | --- | --- | --- |
| A | Charizard ex, SV: Scarlet & Violet 151, full 006/165 | `"Charizard ex"` | None |
| B | Pikachu ex, ME: 30th Celebration, full 149/128 | `"Pikachu ex"` | None |
| C | Pikachu ex, SV08: Surging Sparks, full 238/191 | `"Pikachu ex"` | graded=true, grader=PSA, grade=10 |

The [REST documentation](https://www.thecardapi.com/docs), checked October 29,
2026, documents scalar graded/grader/grade filters. C now uses a single grade
value, not a title-label OR or an undocumented grade=9,10 union. PSA 9 remains
separately classified if unexpectedly returned, but is not requested through
a fourth GET. A future PSA 9 run would need separate owner authorization.
Filters narrow retrieval; they never establish the exact card or settlement.

The endpoint, newest-first date_desc sort, page=1 and limit=25 are unchanged.
A normal successful run makes three GETs; failures stop early without retries,
redirects, automatic pagination, fallbacks, compensation searches or detail calls.
At most 75 rows are accepted for bounded analysis. There is no client query input.

## Strict local checks and honest reporting

The intended card identities are unchanged. Candidate screening requires the
exact canonical subject from the standardized title segment or supplied name
fields, agreeing reviewed set naming and the full collector fraction. It does
not accept wrong denominators or conflicting structured fields. Explicit foreign
language, alternate printing, unrelated variant and unofficial/lot evidence stay
excluded. Ambiguous variants and multi-number bundles have their own pool.

Missing language, rarity, product or printing evidence is not filled from a
query, title assumption, Holofoil label, null grade, intended target or a filter.
The existing offline adapter still has no verified product/language/printing
mappings for these transactions. It retains strict canonical identity and
provenance checks and its disabled commercial envelope. No existing adapter,
scorer, grade economics or scanner rule is relaxed by this change.

All counts have distinct meanings:

- reportedTotalMatches: provider's broad query total, subject to its coverage;
  NOT exact-card sales or independent transactions.
- returned / acceptedRows: bounded sample/schema counts, NOT valuation approvals.
- candidateExactCardMatches / localIdentityStatus.candidateUnverified: local
  subject/set/number candidates, NOT verified language/printing.
- ambiguousVariantRecords: rows requiring ambiguity resolution, kept separate.
- independentlyVerifiedExactMatches / localIdentityStatus.verified: zero until
  independent required evidence exists.

Pagination availability and reported pages are reported separately from these
counts. A nonempty cursor means more results may be retrieved under a separately
authorized plan; this benchmark never follows it. Missing indicators stay
unknown. A 25-row newest-first page may omit the target entirely, even when the
broad reported total is large. Neither zero candidates on a page nor zero returned
rows proves global absence. No broad search is claimed exhaustive.

Actual supplied sale timestamps are validated and preserved in aggregate oldest/
newest ranges, ordered by parsed chronology. Retrieval time and opaque ID
components never replace transaction dates. Price confirmation, grade fields,
query-filter compliance, source metadata, quota and lookback limitations remain
reported without raw records, transaction URLs or cursor values. Price statistics
remain withheld; no first-page median becomes a current market value.

## Offline regression and validation

The three owner-observed 149/128 records are represented only by previously
provided observation facts. Tests show the B retrieval query is exactly the
previously successful broad query and all three pass candidate screening when
present in the retrieved page. The tests do not emulate or claim proof of the
provider's full-text engine. They do not fabricate missing IDs, timestamps,
language, SKU, grading or transaction provenance. All remain identity-unresolved,
independent settlement remains false, and the valuation median stays null.

Additional regressions cover strict wrong-subject/number/set/language/printing
rejection, separate ambiguity pools, sample versus total versus verified counts,
actual timestamp ranges, and independent inspection of returned grade fields.
The unique old narrow benchmark phrase no longer authorizes the broadened job.

18 coverage tests and 64 existing focused tests pass (82 total), along with
syntax and credential-free dry-run checks. Only coverage retrieval/reporting,
its isolated tests, workflow phrase and documentation are changed. No provider
API calls, workflow dispatch, new subscription, Production deployment, main
change, commercial activation or scanner modification was performed.

## Exact owner instructions

Open [Private vision benchmark](https://github.com/gempredict/gempredict-live/actions/workflows/vision-benchmark.yml),
choose a fresh Run workflow with:

- Branch: `restore/phase1-identity-market-matching`
- mode: `dry-run`
- confirmation: `AUTHORIZE_THE_CARD_API_BROAD_THREE_SEARCHES_75_ROWS`

Dispatch as the configured owner matching VISION_BENCH_OWNER_ID and approve the
existing vision-benchmark environment if prompted. Inspect the delivered commit
before running. The old narrow phrase is intentionally rejected/skipped, reruns
are blocked by first-attempt checks, and paid vision/CardSight/old sales jobs do
not execute under these inputs. No secret or repository variable change is needed.

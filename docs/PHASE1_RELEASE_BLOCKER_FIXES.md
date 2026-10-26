# Phase 1: structured listing contradictions and saved variant trust

Baseline: `258fc682e3c03825ecdbb07e7efbf51386cb4604`, branch
`restore/phase1-identity-market-matching`.

## Structured listing evidence

`listingStructuredEvidence.mjs` supplies the same negative checks to the eBay
scorer, neutral variant-observation filtering, direct variant matcher, and saved
comparable-pool validation. Final identity-evidence diagnostics and supporting
counts are filtered after canonical reconciliation, so an incorrect initial AI
proposal cannot censor valid correction evidence. Existing negative conflict
flags remain intact. Recognized year, collector-number, set, finish,
printing and parallel attributes cannot contradict canonical or explicit title
variant facts. Conflicting duplicate attributes and unrecognized/ambiguous
recognized values are rejected. Exclusions are retained in neutral diagnostics
and cannot add supporting votes or usable pricing observations.

Attribute names ignore case, punctuation and spacing. Numeric padding and normal
SIR/foil aliases normalize without discarding identity distinctions. A bare local
collector attribute can agree only when the title still supplies the correct
full collector number. Missing optional attributes and conventional absence
markers (`N/A`, `Not specified`, `Does not apply`) are not affirmative facts and
do not override otherwise verified title evidence. Arbitrary unknown values are
not interpreted as support. Unknown unrelated attribute names remain ignored.

The existing pure variant-label parser was moved intact to
`variantDescriptor.mjs` so both paths use the same artwork/finish interpretation
without circular imports. Existing query budgets, ranking, confidence formulas,
USD-only raw pools, outlier rules, catalog snapshots and identity gates remain
unchanged. Structured `Finish`, `Printing` and `Parallel` aliases now participate
in neutral variant reading as well as contradiction rejection.

## Saved variant verification

Fresh predictions and restored reports use `isVariantVerificationTrusted()`.
An accepted status alone is insufficient: a complete, well-formed variant value,
field receipt and evidence-reference array must be present; material ambiguity
and unrecognized variants cannot pass. Canonical descriptors must agree with the
verified value. Independently verified/corrected material fields use the same
three-listing/60% consensus predicate as reconciliation, with at least three
independent evidence references. Explicit user confirmation retains its existing
exception to neutral consensus, but still requires the complete confirmation
receipt, independent catalog identity and fresh exact comparable pricing.

Base/non-variant identities do not acquire a synthetic foil requirement or a new
`not_applicable` trust state. Their real verified receipts remain valid. Sports
matcher regressions use explicit test catalog adapters; no sports catalog
provider is implemented or claimed.

Missing, malformed, removed or downgraded receipts invalidate stored valuation
trust, financial outputs, recommendations and Atlas. Reopening or replaying old
price/trust flags cannot bypass failed variant eligibility. Previously saved
status-only/incomplete receipts require fresh verification; no missing evidence
is invented during migration. Sound complete reports retain their values and
Atlas. This remains application evidence validation, not cryptographic signing
of client-side storage.

## Regression coverage and verification

The exact hosted Pikachu `149/128` fixture (including the offset timestamp,
`size: "standard"` and five variant flags) remains covered by the original
freshness regressions and actual mocked handler tests. New cases independently
inject contradictory year, collector number, finish, printing, artwork and set
attributes; combine all contradictions; and mix rejected high-price listings
with valid listings. They check neutral counts, raw counts, median, confidence,
Atlas, saved reports, normalized aliases, missing attributes and other protected
identities. Saved-state tests erase/downgrade receipts, corrupt their shape or
material support, replay old flags, and retain legitimate verified/corrected,
manual and base/numbered sports test cases.

Focused older unit/browser fixtures that used bare trust tags now carry explicit
test-only variant receipts. Actual end-to-end pipeline tests still obtain their
receipts through real reconciliation. One older set-conflict assertion now also
expects the newly excluded neutral variant evidence to remain insufficient.

All providers remain mocked. Validation commands:

- `FRESHNESS_VALIDATION_OUTPUT=/tmp/gp-freshness-reports.json PHASE1_VALIDATION_OUTPUT=/tmp/gp-freshness-phase1.json node --test --test-reporter=tap tests/*.test.mjs`
- `NEXT_TELEMETRY_DISABLED=1 npm run build`
- `npm run check:catalog-packaging`
- `node scripts/validate-tcgdex-snapshot.mjs`
- The four existing `*.smoke.mjs` browser scripts, with the same report-output environment variables.

No architecture redesign, provider integration, credential or production
configuration change is included. Live iPhone/provider validation remains a
separately authorized next step after review.

Final validation: 239 automated tests passed, 0 failed/skipped; production build,
catalog snapshot validation, snapshot/LICENSE packaging check and all four browser
smoke scripts passed. The browser audit includes all 16 existing Stage A
scenarios and new stale-report receipt/structured-evidence probes. The exact
Pikachu fixture remains trusted only with supported variant and comparable
evidence. No live provider API calls or deployments were made.

# Manual grading economics foundation

Route: `/grading-economics`. The Phase 3E collector interface is PSA-first; the
underlying isolated calculator still supports PSA, Beckett/BGS, CGC, SGC and TAG.
See phase3e-psa-collector-experience.md for the three-step workflow. Provider names identify scenarios, not interchangeable
grades or endorsements. The optional Phase 3D dated public fee reference supplies submission fees only after
explicit submission eligibility checks. No turnaround guarantee, market price or
probability is supplied. Inputs start blank. A deliberate example
button supplies explicitly assumed synthetic values. Manual edits are user-supplied,
not verified. Arbitrary verified-schedule claims remain rejected. Published references are bound
to the bundled reviewed tier, date, revision, currency and eligibility; manual fee
overrides remain user-supplied. See grading-service-reference.md. No state is persisted or passed to scan reports.
Identity, condition, report authorization and financialSafety remain unchanged.

## Arithmetic and scope

All amounts use integer cents in a single selected two-decimal currency (USD, EUR,
GBP, CAD, AUD); changing currency does not perform FX conversion. Percentages use
basis points. Selling percentage fees apply to gross price, rounded half up to a
cent. Fixed and other selling expenses are deducted separately. Enter buyer-delivery
costs and taxes explicitly where applicable; fee tax bases, FX, time value, and
unentered expenses are not inferred. Blank is unknown; explicit zero is distinct.
Negative or over-precision input is rejected. Prices are bounded to $99,999,999.99
(or the selected currency equivalent). Turnaround is an optional assumption only.

For each card, submission fee and surcharge are per-card; outbound/return shipping,
insurance and handling are batch totals. Each batch total divides into whole cents,
with remainder cents assigned to the lowest 1-based card indices. Use each index
once when aggregating a batch. Changing batch size requires reviewing allocations.

Let A = acquisition basis; G = grading costs including allocated batch expenses;
P = hypothetical graded sale price; S(P) = rounded percentage fee + fixed fee +
other selling expenses; R = hypothetical net raw-sale proceeds.

- Upfront investment = A + G.
- All-in total investment = A + G + S(P).
- Net graded proceeds = P - S(P).
- Lifetime profit/loss = P - S(P) - A - G.
- ROI = lifetime profit / all-in investment. Zero denominator means unavailable.
- Incremental benefit of grading versus selling raw = P - S(P) - G - R.
- Lifetime break-even is the smallest cent P satisfying P - S(P) >= A + G.
- Grade-versus-raw break-even instead requires P - S(P) >= G + R.

Break-even uses integer binary search with the actual rounded fee function, not an
approximation. At 100% selling fees a positive-cost break-even is unavailable.
Acquisition is sunk for today's decision; it affects lifetime profit but not the
incremental comparison. Missing acquisition does not erase a computable incremental
comparison. Missing sale price does not prevent a cost-based break-even calculation.
No expected value, grade probabilities or automatic submission recommendation is
computed, even if extraneous confidence/probability fields are supplied.

## Independently checkable synthetic example

Identical example assumptions for all five providers are for arithmetic only:
acquisition 100; graded sale 250; raw sale 120; submission 25; surcharge 0;
batch size 3/index 1; batch outbound 9, return 12, insurance 3, handling 6;
both sales have a 10% selling fee, fixed fee 1 and other expenses 4.

| Result | Amount |
|---|---:|
| Allocated batch expenses | 3 + 4 + 1 + 2 = 10 |
| Grading cash cost | 25 + 10 = 35 |
| Upfront investment | 100 + 35 = 135 |
| Selling expenses | 25 + 1 + 4 = 30 |
| All-in investment | 165 |
| Net graded proceeds | 220 |
| Lifetime profit | 85 |
| ROI | 85 / 165 = 51.515151…% |
| Net raw alternative | 120 - 12 - 1 - 4 = 103 |
| Incremental benefit | 220 - 35 - 103 = 82 |
| Lifetime break-even | 155.56 |
| Grade-versus-raw break-even | 158.89 |

Independent cent checks: at 155.55, percentage fee 15.56, net 134.99 (short
of 135); at 155.56, fee 15.56, net 135.00. At 158.88, fee 15.89,
net 137.99 (short of 35+103); at 158.89, net 138.00. At sale price 50,
net is 40, lifetime loss 95, and grading loses 98 versus selling raw.

## Required future completed-sales evidence contract

This is a specification, not a new provider integration or authorization path.
Before evidence-backed economics can be enabled, independently reviewed records
must establish all of the following:

| Dimension | Required evidence / rejection rule |
|---|---|
| Card identity | Canonical card reference and reviewed provider crosswalk; exact subject(s), set/product/subset, full collector number, language, rarity, printing/parallel, relevant stamps/autograph/serial attributes. Missing or conflicting variants stay unresolved. Catalog identity does not verify a transaction. |
| Grading | Provider, numeric grade, scale, qualifiers, label/holder evidence where relevant. Raw and unknown remain separate. No automatic PSA/BGS/CGC/SGC/TAG equivalence. |
| Completion and deduplication | Stable provider record ID and supported underlying transaction identity; transaction type, completion status, cancellation/refund/correction handling, duplicate disposition. Do not invent source transaction IDs. |
| Amount | Confirmed final amount, currency, explicit major/minor units and per-card versus total basis, sold quantity, condition, shipping/tax allocation. Exclude lots, asking prices and unconfirmed accepted offers. Never substitute original asking price. |
| Time | Actual sale timestamp with timezone/precision and retrieval date. Distinguish ingestion/listing date from sale date. |
| Provenance | Source reference and safely validated URL status, provider provenance, provider-confirmed versus independently verified settlement. Catalog URL is not a transaction URL. |
| Rights | Explicit commercial calculation/display permissions, derivative-data rights, caching/retention/deletion terms, source-data coverage and dated plan/license evidence. Free-plan evaluation rights do not authorize commercial use or persistent storage. |
| Comparability/statistics | Separate provider/grade/qualifiers/currency/condition/quantity cohorts; predeclared minimum sample count and comparable-selection rules; actual sample count, date range, recency, dispersion/outliers and coverage gaps. |
| Windows/completeness | Configurable 7/30/90-day evidence windows; report accessible lookback, pagination and selection bias. Three days of access cannot establish 30/90-day history. A first page is not an exhaustive market sample. |

No new market call, provider subscription or response persistence is introduced.
The existing Card API transaction identity, amount-unit, provenance and commercial
licensing gaps remain blockers. Exact printing verification and calibrated grading
probabilities also remain separate prerequisites. The manual calculator cannot
satisfy or bypass these requirements or authorize protected report economics.

## Offline validation

Pure arithmetic tests cover all five providers, negative/zero outcomes, missing
costs, acquisition versus opportunity cost, fee rounding, first profitable cent,
shipping conservation, invalid provenance and unsupported currencies. Actual JSX
callbacks/rendering cover blank defaults, explicit synthetic loading, edits and
clearing values. Existing identity/condition/report tests remain authoritative.
Synthetic fixtures measure software behavior, not real grading or market accuracy.

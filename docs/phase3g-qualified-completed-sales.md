# Phase 3G — qualified completed-sales foundation

## Status and existing integration audit

Offline only. **No provider is commercially approved.** There are no new credentials,
requests, SDKs, endpoints, subscriptions, response stores or automatic valuations.
`pages/api/ebay-search.js` and `lib/marketIdentityEvidence.mjs` use eBay Buy Browse
`item_summary/search`, providing active asking listings. They do not establish
completed transactions or accepted-offer settlement. Existing listing matchers remain
unchanged. The earlier Card API observations and unresolved commercial correspondence
are not sufficient to authorize a commercial adapter. No hosted API schema or
transaction mapping is guessed here. See also the existing evidence requirements in
`docs/grading-economics-scenarios.md`.

## Normalized record contract

The contract consumes normalized records from a separately reviewed adapter, NOT raw
provider responses. `tests/helpers/completedSalesFixture.mjs` demonstrates the exact
shape using wholly synthetic IDs, records, crosswalks and permissions. Its amounts
are invented test inputs even where they resemble previously observed amounts.

| Field | Meaning / unknown handling |
|---|---|
| `provider`, `providerRecordId` | Original provider and record identifier, bounded stable IDs. |
| `source` | Original marketplace, actual transaction ID where available, listing ID separately, bounded safe provenance reference and optional supplied URL. A listing ID is never invented into a transaction ID. |
| `saleDate`, `retrievedAt` | Actual sale date (ISO day precision), explicit UTC retrieval instant. No listing-date substitution. Unknown/future/invalid/stale values quarantine. Intraday ordering is not claimed. |
| `status`, `transactionType` | Completed versus active/ended/canceled/refunded/unknown; fixed price, auction or accepted offer. |
| `priceConfirmed`, `finalOfferPriceConfirmed` | Confirmed final transaction amount; final accepted-offer confirmation is independently mandatory. `original_price` is never used. |
| `settlement`, `settlementReference` | Provider-confirmed versus independently verified, with independent reference required for the latter. Confirmation is not proof of independent settlement. |
| `amount` | Explicit value, `major` decimal string or integer `minor` units, two-decimal currency, `per_card` basis. USD/EUR/GBP/CAD/AUD only; no FX. Unknown semantics quarantine. |
| `shipping`, `tax` | Explicit included/excluded. Unknown remains unknown and cannot enter the initial aggregation. Different bases never mix. No missing charge defaults to zero. |
| `quantity`, `lotStatus` | Initial conservative support: quantity one, single card only. Even documented multi-quantity sales remain quarantined pending a reviewed allocation/event-counting policy. |
| `identity`, `identityEvidence` | Provider-supplied identity facts plus reviewed provider/product/catalog crosswalk ID, pinned revision and product ID. Null provider facts can be established only by that reviewed mapping; contradictory supplied facts cannot be overwritten. |
| `grading`, `condition` | Explicit verified raw classification or PSA numeric 8/9/10, no qualifiers. Unknown grade never becomes raw. Raw reported condition must be established and separately partitioned; it is not an authenticated physical condition grade. |
| `copySerial` | Optional actual copy stamp, distinct from collector number and parallel print run. Supplied stamp must agree with the independently mapped print-run denominator; `/99` alone does not establish a green parallel. |

The retained qualified model includes canonical mapped identity, mapping provenance,
raw/PSA grade, completion and amount semantics, source references, copy serial when
provided, inclusion basis, freshness and rights reference. Unknown copy serial/source
URL/listing ID/independent settlement remain null. No provider response is persisted.

### Identity requirements

Reviewed mapping must independently establish category, exact subject(s), release year,
set/product, complete collector number, language, parallel, finish, variation, stamp,
autograph and print run. Pokémon also requires rarity and regulation mark. Subset and
printed title are separate fields. Explicit `none`/`unlimited` is a reviewed assertion,
not a normalization default. Sports rarity/regulation mark may remain inapplicable.
Full fractions and alphanumeric numbers are compared without numeric truncation.
Only case/whitespace normalization is allowed; no new fuzzy aliases or AI-confidence
shortcut. Reviewed adapter crosswalks must resolve provider aliases before this boundary.

A catalog match alone does not establish the sale-to-product link. Server policy must
independently approve sale/product-link semantics and raw/PSA classification semantics.
There is **no actual product-ID availability or transaction mapping claim** for The Card
API, eBay or any other provider in this implementation.

### Permissions, provenance and duplication

Independent server policies, not record/client booleans, must approve commercial
calculation and summary display, provide a dated license reference and expiry, and
verify source transaction-ID semantics. A provider-record fallback is allowed only
when its uniqueness as an underlying transaction has been separately established.
Missing identity semantics quarantine. Same transaction across providers deduplicates
by original marketplace/transaction ID, not listing ID. Identical duplicates count
once; contradictory economic facts/copy stamps, or a canceled/refunded/invalid update
for the same known transaction, quarantine the group. Records from different
transactions sharing one listing remain distinct. Later cancellation discovery still
requires provider correction/update capability; no offline algorithm can discover it.

Source URLs are optional and never fabricated. HTTPS, no credentials/query/fragment,
reviewed host AND a server-reviewed transaction-to-path validator are required.
Transaction display additionally requires explicit rights. Summary-only policies omit
all supporting transaction rows from report presentation. Retention, caching,
derivative-data and underlying-marketplace rights require separate written approval;
this milestone stores none and does not infer those rights from a plan name.

## Qualification and aggregation

`qualifyCompletedSales(records, context)` is pure and bounded to 75 normalized rows,
a requested window of 1–90 days (30 default), a fresh retrieval within three days and
a configurable minimum sample of at least three. Explicit clock input makes tests
reproducible. This sample minimum is a product safeguard, not statistical calibration.
The four cohorts are Raw, PSA 8, PSA 9, PSA 10. Currency, raw condition and shipping/tax
bases partition each cohort further. No cross-currency or raw-to-graded pooling.

Each comparable sample reports count, actual sale-date range, latest retrieval,
median, low/high range and provenance references. Sparse samples show dates/count but
no price aggregate. Even medians retain a half-cent exactly rather than silently rounding.
An unsupported half-cent cannot be sent as a whole-cent economics input. No outlier
is automatically discarded; the observed price range is descriptive dispersion.
Provider lookback, reported total and completeness are separate from requested window
and qualified count. Missing completeness remains unknown. Three accessible days do
not manufacture a 30/90-day history. A first page is not an exhaustive market valuation.

## Adapter and report interface

`readLiveCompletedSales()` always returns `provider_disabled`, zero requests. Client
flags, environment variables and supplied credentials cannot activate it.
`evaluateOfflineSalesAdapter(adapter, context)` accepts only `mode: offline_fixture`;
`adapter.read({target, cohorts, maxRequests: 0, maxRows: 75, windowDays})` supplies
normalized records and coverage. There is no implicit retry or pagination. The fixture
adapter lives under tests only and has no network implementation.

`CompletedSalesSection` is used in the actual unified `ResultCard`. It consumes only
an in-process immutable qualifier result through a separate evidence prop. It never
trusts `report.completedSales`, cached JSON or manual calculator inputs. Without an
approved feed the shipped report shows **Insufficient qualified sales data** for all
four cohorts. The fixture-rendering tests exercise actual JSX with qualified samples
and license-permitted transaction details; no fixture data is shipped in the application.

The in-process brand deliberately fails closed after JSON serialization. A future
server-to-browser bridge must validate and authorize a fresh display DTO (including
rights and identity binding) rather than accepting cached report values. That transport
bridge and approved server adapter registry are deferred; the collector-facing section
already supports the required cohorts and permitted detail display. Server integration
will require adapter/configuration/transport work, not a report-layout redesign.

`completedSalesEconomicsReference()` supplies a frozen, read-only historical sample
price and cohort/currency for eventual deterministic economics wiring. It never invokes
or modifies the existing engine. Whole-cent samples only; caller must select an exact
price basis. Historical median is not a prediction or verified future proceeds.
`automaticEconomicsAllowed` remains false. No automatic prices flow into the isolated
manual calculator. Existing formulas, PSA fee eligibility and `financialSafety.mjs`
are unchanged. Saving/copying retains protected report behavior, never the transient
fixture evidence or unlicensed response data.

## Activation prerequisites / remaining blockers

1. Owner approves a specific commercial provider/plan with written rights for original
   source coverage, commercial calculations, customer display, derived values and
   explicit cache/retention/deletion limits. Separate detail display permission.
2. Verified API documentation and secure server credentials; documented final amount,
   quantity, grade, product IDs, transaction uniqueness, corrections/refunds and dates.
3. Independently reviewed, revision-pinned exact-printing crosswalks, source provenance
   and transaction URL mappings. No model-only printing verification.
4. Implement approved server adapter/registry and privacy-safe fresh display transport;
   independently validate real normalized mapping using owner-authorized bounded runs.
5. Adequate recent comparable samples and applicable cost inputs. Any future automatic
   economics enablement requires a separate reviewed change to the existing financial
   gate. This checkpoint does not authorize that change or predict grades.

## Validation and synthetic review

Phase 3G adds 11 focused tests spanning Pokémon/sports identity and print-run conflicts,
raw/PSA 8/9/10 separation, price/offer/unit/quantity gates, cancellations and duplicate
updates, rights/expiry, URL safety, sparse and half-cent medians, bounded disabled
adapters, rendered report details and saved/copied financial isolation. All examples
are synthetic software tests, not measured model/market accuracy.

Synthetic example: USD 27.99, 47.99, 43.49 yields count 3, median 43.49, low 27.99,
high 47.99. Two sales yield no median. Four values 1.00, 1.01, 2.00, 2.01 yield median
1.505, displayed exactly and unavailable as a whole-cent economics input.

Screenshots are local review artifacts outside Git. Each fixture screenshot is explicitly
labeled synthetic; normal application screenshots show the live feed disabled. No paid
scan or marketplace request is made in rendering/browser validation.

Validation checkpoint: full offline suite **505 passed, zero failed/skipped**;
production build and all four TCGdex asset tracing/packaging checks passed. Desktop
1440px and mobile 390px synthetic report checks found no overflow or browser errors,
issued zero network requests and exercised permitted transaction detail expansion.
The built application was additionally checked with intercepted synthetic scan data:
all four completed-sales groups stayed disabled, submitted image digests matched,
and saving excluded the session photo buffers. No paid or live provider request.

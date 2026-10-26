# Sold-market intelligence checkpoint

Reviewed 2026-10-26. Baseline `227c8dc247b578a6b73d300abaa345f5418a5fa0`.
No supplier account, paid request, subscription, production change or deployment was made.

## Historical finding: Browse was asking-price retrieval, not completed sales

Inspected the full non-shallow repository history (203 reachable commits before
fetching the existing feature branch), local references and GitHub's main,
restoration and feature/atlas-recognition branch heads. The feature branch was
fetched for inspection only. Searches included completed-item APIs, Marketplace
Insights, sold-record properties, third-party APIs and scraper names.

| Revision | Evidence |
| --- | --- |
| `292c5c7` | Original `pages/api/predict.js`, `fetchPrediction`: prompt-generated raw/PSA values and estimated population counts; no eBay integration. |
| `9afe526` | First `pages/api/ebay-search.js`: sandbox OAuth plus `/buy/browse/v1/item_summary/search`, limit 10. This retrieves active inventory. |
| `411bc0d` | Same endpoint switches to production eBay Browse; no transaction endpoint is added. |
| `e1e47ea` | `pages/api/ebay-search.js` calculates market summaries from listing `item.price`. |
| `3f14071` | `pages/api/predict.js` consumes the internal Browse endpoint and raw median. |
| `f5f90ac` | `lib/marketEvidenceEngine.js` calls Browse-derived listings “comparable sales” and describes market value. This is inaccurate labeling, not evidence of a transaction integration. |
| `227c8dc` | Explicit asking-price provenance, 100-item windows, exact identity/variant matching and safe diagnostic receipts. |

**No authorized automated completed-sales implementation was found to recover.**
Code/history cannot establish historical live success, account entitlements, or
anything in deleted/unreachable history. No credential contents were inspected.
The working Browse integration is retained, not replaced.

Current coverage already uses up to six distinct targeted queries, 100 results
per query, independent neutral retrieval, and rejection diagnostics. More active
inventory cannot turn an asking price into a sale. Without new authorized live
observations, there is no evidence justifying further retrieval changes here.

## Legitimate access strategy

Public documentation is not proof of GemPredict's contractual access. Vendor
claims below are discovery evidence, not independent certification of upstream
rights or exact Pikachu coverage. Dollar prices are advertised USD and may change.

| Option | What is available / terms and blockers |
| --- | --- |
| eBay Marketplace Insights | Official historical sold-item API, historically a 90-day window. eBay currently says it is restricted and **not open to new users**. Browse credentials do not confer this scope. Existing entitlement was not established. Obtain written eBay confirmation before any integration. [Official notice](https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html). |
| eBay Product Research / Terapeak | Seller UI provides up to three years and actual accepted Best Offer prices. A seller subscription/UI entitlement does not establish a commercial redistribution API license. No suitable generally available programmatic license was established. Do not automate the UI. [Help](https://www.ebay.com/help/selling/selling-tools/research?id=4853), [agreement](https://www.ebay.com/help/policies/member-behavior-policies/user-agreement?id=4259). |
| CardSight | Pricing docs distinguish historical auction results from active Buy It Now offers; raw/grader/grade pricing and multiple card categories. Commercial app/caching claims, but terms disclaim third-party rights; upstream authorization and retention rights need written verification. Beta/coverage/freshness and exact-card transaction dates/IDs need a sample contract. Best Offer final consideration is not established. Advertised free 750 calls/4 rps; $14.95/5k/6 rps, $74.95/30k/8 rps, $199.95/100k/10 rps. [Pricing schema](https://play.cardsight.ai/endpoints/pricing), [commercial use](https://cardsight.ai/solutions/price-data), [terms](https://cardsight.ai/terms), [plans](https://cardsight.ai/pricing). |
| Card Hedge | Public schema includes sale date, source URL, sale type, grade and individual comp rows. Search sales requires commercial/Enterprise authorization; newest-N search up to 20, comp rows up to 100; completeness matters. Sports/TCG advertised, exact variants and raw/PSA9/10 must be proven. Best Offer flag alone does not certify amount actually paid. Personal developer starts $49/month; customer-facing commercial/Enterprise quote, rates/history/caching/retention and upstream rights require agreement. [Schema](https://api.cardhedger.com/openapi.json), [access](https://ai.cardhedger.com/signup?target=developer). |
| Hobby Card Index | Documented transaction endpoint `/prices/:cardId/sales`, latest 100, days 1–365; distinguishes accepted sale price and askingPrice. Commercial customer-app plan required; internal-use $49.99 plan is not GemPredict permission. Commercial pricing behind sign-in; advertised 10–50 rps depending plan. Subscription-limited retention, deletion within 30 days after termination; no standalone/raw bulk sales database. Exact sports/Pokémon coverage and upstream rights still require validation. Ambiguous BGS grade keys must not become PSA10. [Developer terms/docs](https://hobbycardindex.com/developers). |
| Complementary auction venues | Fanatics Collect displays sales history and removes unpaid sales, but website visibility is not a data redistribution license. Seek a written licensed feed, not scraping. [History](https://sales-history.fanaticscollect.com/), [terms](https://support.fanaticscollect.com/en_us/terms-of-use-r11C70QTge). Other venues need equivalent agreements. |

Other products are not substitutes for a transaction feed: PriceCharting and
SportsCardsPro public APIs supply current grade values, not individual historical
sales; written commercial permission is needed ([API](https://www.pricecharting.com/api-documentation),
[sports](https://www.sportscardspro.com/api-documentation)). JustTCG V2 offers
aggregate prices/counts, blending store sales and inventory, not independently
referenced transactions ([docs](https://justtcg.com/docs/api/cards-v2)). TCGplayer
is not granting new API access ([notice](https://docs.tcgplayer.com/docs/getting-started)).
A Card Ladder consumer subscription is not a redistribution license
([terms](https://www.cardladder.com/terms)).

**Recommended acquisition sequence:** check official eBay account eligibility;
if unavailable, obtain a transaction sample and written commercial proposal from
Card Hedge and/or Hobby Card Index first, with CardSight an auction-data candidate.
Choose only after verifying source authorization, exact-card coverage, actual
consideration, dates, currencies, transaction IDs, refunds/unpaid handling,
update SLA, quotas, cache/report retention, attribution and termination rules.
They supplement eBay's own market signal. None is configured or represented as a
working supplier. No vendor has been contacted on GemPredict's behalf.

## Implemented evidence contract

`lib/completedSales.mjs` contains no speculative endpoint or configured provider.
`fetchCompletedSales` accepts a server-owned adapter (`id`, `lookup(card,{signal})`),
uses a timeout and record bound, and fails unavailable without one. The prediction
handler currently configures **none**. It ignores client-supplied sales, population
and calibration evidence. Adding a real adapter requires approved access, a
supplier-specific parser and tests, and contractual storage/display policy.

Evidence classes: verified completed auction; verified fixed-price sale; confirmed
accepted Best Offer; sold listing with unknown final consideration; active asking
price; modeled valuation. Only the first three with `amountBasis: actual_transaction`
and completed/settled status can contribute to sold statistics. A displayed
struck-through price or an offer indicator alone is insufficient.

Envelope: status/providerId, rights reference and explicit commercial display and
transaction-record permissions, records, optional truncation. Each record requires
exact identity, printing/parallel, language where known, title, condition,
raw/graded metadata (company and numeric grade), amount/currency/sale time, and
provenance (provider/license references, marketplace, original item ID, transaction
ID, observation time, official/licensed delivery). These are validation receipts
from a trusted server adapter, **not cryptographic proof of a vendor's rights**.
A user-controlled flag cannot establish provider authorization at the API boundary.
No synthetic test supplier or prices are imported into production.

Identity checks preserve required subject/full number/year/set, optional known
manufacturer/product/subset, variant dimensions including finish/art/parallel,
serial run, autograph and memorabilia, language, and the existing strict title
and structured-attribute matcher. No Pokémon source is claimed to verify sports.
Provider-specific card mapping remains necessary, using the sports identity
contract in `SPORTS_IDENTITY_CONTRACT.md`.

Policy v1: USD only (no invented FX), positive finite amounts, real timestamps not
in the future, transactions within 90 days, maximum 500 records. No shipping/tax
normalization is fabricated. Raw and each company's numeric grade remain separate;
PSA9, PSA10 and BGS9.5 never merge. Special designations such as Black Label,
Pristine or Perfect are rejected pending an explicit supported contract. Existing
raw/graded title and structured-fact checks apply to both sales and Browse.

Deduplicate by original marketplace + transaction ID, not by provider or title.
Identical copies count once; materially contradictory copies of the same accepted
transaction quarantine all copies. A future adapter must provide the stable
original transaction ID, not a new provider-specific random ID. Per-group median,
observed range, sample count, oldest/newest and age are deterministic. At least
three transactions with the newest within 30 days qualify the group. These are
conservative policy defaults, not statistically certified FMV accuracy. A truncated
response cannot authorize recommendations; coverage/completeness must be solved
by a real provider contract. Unavailable, malformed, ambiguous, stale, non-USD,
wrong-card and unlicensed inputs cannot establish sold values.

## Financial authorization and saved reports

`financialEvidence.mjs` wraps, and does not replace, the existing $80, two-outcome
PSA9/PSA10 economics calculation. Priority is observed raw sold median, then
observed active asking median. Low-volume sales can inform a labeled provisional
scenario but not a final recommendation. Actual graded sale medians override
modeled values **without upward clamping** to raw or another grade. Model-only
inputs remain modeled; no population counts are invented.

The live regression ($56.99 ask, confidence20, modeled PSA9 $75 / PSA10 $180 /
probability30%) has conditional expected proceeds $106.50 and net **-$30.49**.
It now shows provisional analysis, unset verified FMV, modeled grade inputs,
missing sold/population data, no GP/decision confidence, no definitive Skip/Grade
and no Atlas endorsement. Active listings and their original confidence remain
visible as a separate signal; they do not become transaction confidence.

Both recommendations require qualified raw, PSA9 and PSA10 groups. A negative
recommendation is allowed only when even the optimistic observed-price range
loses money across the full probability range 0–100%. A positive recommendation
additionally needs independently validated exact-identity calibration evidence
and a positive conservative outcome range, with no visible condition-risk veto.
No calibrated probability service/model is configured. Historical gem rate is
never used as its substitute. The configured cost/outcome assumptions exclude
shipping, selling fees, taxes, turnaround, grades below9 and physical inspection;
all recommendations remain conditional, never guaranteed proceeds.

`isMarketAnalysisAvailable` means identity/variant-safe, consistent provisional
or qualified analysis. `isValuationTrusted` now additionally requires actionable
qualified evidence. Atlas only runs for the latter and uses completed-sale
provenance, not a relabeled asking sample. No artificial sold confidence score is
assigned. Financial basis v2 records sources. Rehydration recomputes evidence and
formulas, invalidates mutated/stale values and Atlas, preserves valid cases, and
migrates consistent v1 asking reports to provisional. Missing identity/variant
receipts still clear financial outputs. These checks are not signatures proving
an entirely forged local-storage document originated from GemPredict.

Existing identity regressions now assert provisional analysis eligibility where
they previously asserted asking-derived valuation trust. This is intentional;
separate new tests exercise actual qualified sold trust and no-trust cases.
Synthetic transaction/calibration fixtures are explicitly labeled under tests/.

## Population foundation and prospective access

`gradingPopulation.mjs` accepts exact card and
variant, PSA grader, full numeric grade distribution, total, observation date and
provider/source/license references. It derives PSA9/10 counts, total and historical
PSA10/total, checks sums/nonnegative integers, reports low sample (<30), stale
observations (>30 days) and a descriptive Wilson interval. The interval does not
correct for selection, resubmissions, crossovers, reclassification or repeated
physical cards. Missing counts remain null; zero denominators have no gem rate.
It never emits an individual physical card grade probability. Other grader
population mappings and production adapters are deliberately not implemented.

[GemRate Partner API](https://www.gemrate.com/partner) advertises daily PSA/BGS/
SGC/CGC populations, exact-card search and grade distributions/history. It requires
partner access, pricing quote, commercial display/cache/retention rights and exact
parallel mapping; no credentials or API calls were used. Their [FAQ](https://www.gemrate.com/faq)
explains source-snapshot and classification limitations.

[PSA's own current API documentation](https://www.psacard.com/publicapi/documentation)
says available public access is single-cert verification. Secondary sites making
population endpoint claims are not proof of entitlement. The public Swagger
resource was inaccessible during this check. Seek PSA's written population-data
license and endpoint/scope confirmation; do not scrape the population report.
Neither PSA cert access nor a population ratio establishes photo-adjusted grade
probability. Future sports integration needs the same exact manufacturer/year/
product/player/number/parallel/serial/auto/memorabilia identity contract.

## Remaining blockers and smallest validation

1. Sold provider licensing/access and documented actual transaction semantics.
2. Proven raw/PSA9/PSA10 exact-variant coverage, stable original IDs, dates, USD
   price basis, freshness and completeness for representative Pokémon/sports.
3. Provider-specific commercial retention policy, including saved/shared reports.
4. Population partner agreement and mapping; calibrated individual-grade
   probabilities remain unavailable and separate from population ratios.

After code review, an explicitly authorized **replacement private Preview** can
reuse the existing Pikachu image to verify corrected identity, the asking signal,
provisional labels and saved/copy/share consistency. No scan or deployment is
performed here. Until a licensed transaction supplier is approved, it must report
sold data unavailable. The next sold-data validation should use a provider-approved
sample offline first, then a separately authorized small live request comparing
original transaction identifiers, dates and accepted-offer consideration. No
production deployment or broad grading engine work is required for that test.

## Final validation

- `node --test tests/*.test.mjs`: **326 passed, 0 failed, 0 skipped/todo**.
  Baseline was 304. New coverage includes the exact live Pikachu correction plus
  $56.99/20% asking case, no-active-inventory sold analysis, actual losing graded
  sales without clamping, qualified positive/negative decisions, unchanged saved
  sold trust, removal/downgrade of proofs, sticky financial invalidation, legacy
  migration, population/probability separation, and sports variant exclusions.
- `npm run build`: passed, including the mandatory packaging check. Existing
  optional Google Fonts stylesheet optimization failed to download; this was
  non-blocking. Node also reports the repository's existing module-type warning
  when tests directly import ES-module `.js` files; no package-mode change made.
- `npm run check:catalog-packaging`: snapshot and unchanged MIT LICENSE traced
  and present. This verifies local function packaging, not a deployed artifact.
- `node scripts/validate-tcgdex-snapshot.mjs`: two pinned printing records valid
  at `a211f11f3ba57d56c65c5ac33be35b77d3280757`.
- All six browser scripts passed against the stable final production build:
  variant-ui (default and text-only), financial-consistency (three scenarios,
  including exact live Pikachu values), tcgdex-freshness (corrected/blocked),
  phase1-validation (16 scenarios), mobile-upload (iPhone13/Pixel7), and
  live-report-integrity (Paldea and Obsidian modes, both persistence outcomes).
  External transports were mocked/blocked; no live paid provider calls.
- `git diff --check` clean; reviewed changed source/tests/docs for credentials,
  stale trusted outputs and unintended scope. No environment, deployment,
  dependency, matching, snapshot or license-file changes. Function trace contains
  **zero test fixture files**. No synthetic supplier is connected at runtime.

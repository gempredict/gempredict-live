# Complete scan acceptance — restoration checkpoint

Starting code: `342df370fd7af9323b0624c8d7f7363e2f77ce17`.
**Not launch-ready.** Offline integration is executable; real-card/live-provider
acceptance remains blocked. No physical iPhone, original Pikachu photograph,
paid model, live eBay request, catalog request, subscription or deployment was
used. Existing architecture, financial assumptions and security boundaries remain.

## Reproduce

From the repository root:

```sh
node --test tests/*.test.mjs
npm run build
npm run check:catalog-packaging
node scripts/validate-tcgdex-snapshot.mjs
node tests/scan-acceptance.smoke.mjs
```

The last command writes `/tmp/gp-scan-acceptance.json` (override with
`SCAN_ACCEPTANCE_OUTPUT`). Its component scorecard uses PASS/FAIL/BLOCKED;
asserted offline regressions are separate from unavailable real capabilities.
Any regression fails the command. BLOCKED live components do **not** become PASS
because the software safely withholds a result. The report's scope remains
`OFFLINE_ONLY_NOT_LAUNCH_READY` even when the command exits successfully.

The built browser decodes a padded 2.1 MB **libheif example**, uploads actual
front/back multipart bytes, runs the production Formidable parser and Sharp
validation, then the actual prediction-handler functions, prompts, reconciliation,
pinned printing fallback, eBay handler/filtering, economics, rehydration and UI.
Only external transports/SDK replies and database writes are mocked. This joins
previously separate codec and prediction tests. The private original image is
not in the repository; its absence is documented in the mobile fixture README.
The sample image is not a Pokémon card and does not prove visual recognition.
The handler harness creates isolated worker state per request; production rate
limits are unchanged, and the suite does not claim multi-worker rate-limit proof.

## A. Component scorecard

| # | Capability | Status | Supporting evidence / exact remaining requirement |
| --- | --- | --- | --- |
| 1 | Upload, conversion, orientation | BLOCKED for real card | Actual codec/parser integration and existing iPhone/Pixel emulation pass on licensed/generated fixtures. Original HEIF + physical-device execution still required. |
| 2 | Claude interpretation | BLOCKED | Mock response normalization/prompt boundaries pass. No current live proposal accuracy or repeated-output measurements. |
| 3 | Independent canonical identity | BLOCKED for live delivery | Controlled catalog responses + hash-pinned upstream printing produce the correct canonical card. Current live catalog delivery and original-photo scan remain unverified. |
| 4 | Exact set/year/number/language/variant | BLOCKED for real card | Known Pikachu fixture and wrong-identity rejection regressions pass; no current physical-card/provider acceptance. |
| 5 | Visual condition observations | BLOCKED for accuracy | Structured observations reach the UI; rejected model prose cannot become canonical facts or grades. No original-photo observations independently assessed. |
| 6 | Active eBay comparables/source links | BLOCKED for live service | Mocked Browse, 100-item windows, exact rejection, source deduplication and URL navigation pass. No actual current listing ID, reachability or availability verified. |
| 7 | Completed sales | BLOCKED | No configured approved supplier or documented account-specific Marketplace Insights entitlement. Safe unavailable behavior is not sold-data functionality. |
| 8 | Raw/PSA9/PSA10 values | BLOCKED for realized values | Historical ask and labeled model inputs exercise the full pipeline. No actual realized grade-specific sales available. |
| 9 | Probability/population provenance | BLOCKED | Population unavailable; no licensed population source or calibrated physical-card probability source. No modeled population counts are fabricated. |
| 10 | Conditional financial arithmetic | PASS (conditional scope) | $75×70% + $180×30% = $106.50; minus $56.99 and $80 = −$30.49. Preserved equations, source labels and withheld definitive decision. This is not verified FMV. |
| 11 | Grade/Sell/Hold/Inspect and Atlas | BLOCKED for full capability | Provisional withholding/Inspect guidance works; actionable financial outputs need qualified sales/calibration. A general Sell/Hold strategy engine is not implemented or claimed. No new strategy feature was invented. |
| 12 | Save/reopen/refresh/revalue | PASS (mock provider scope) | Actual built UI and handler reuse canonical identity, source classes and conditional calculations; revaluation does not submit cached financial proof. Existing tamper/variant protections pass. |
| 13 | Real physical-card repeatability | BLOCKED | Controlled sample replay passes, not actual repeated iPhone/Claude scans. Original image and separately authorized live calls required. |

## B. Repeatability controls and measurements

- **5 identical sample-image scans** in one browser session, same prepared front
  and back bytes, same code/source fingerprint, prompts/configuration and external
  market fixture. Every actual mocked vision request's image-byte fingerprint is
  checked against the bytes decoded by the production server parser.
- **3 additional sample-image scans:** 90-degree rotation, 640-pixel re-encoding,
  and 0.65 brightness. Real image processing is exercised; fixed mocked model
  replies do not establish recognition robustness under these transformations.
- **1 confirmation/revaluation** follows saving, refreshing and reopening.
- **10 additional handler replays:** recorded-style proposals Paldea Evolved,
  Obsidian Flames, Stellar Crown and Surging Sparks, confidence 88–92. These are
  deliberately varied synthetic proposals, not measured current live responses.
  Canonical identity/version and fixed-input financial outputs remain identical.
- Separate probability sensitivity replay: 30%, 31%, 60% produces **−$30.49,
  −$29.44, +$1.01** with unchanged market/PSA prices. All remain provisional and
  Atlas-null. Different model inputs are never disguised as market changes.

Known canonical answer: **2026 30th Celebration Pikachu ex 149/128, English,
Holo Special Art**. Controlled asking count is one, asking confidence20, raw
baseline56.99, modeled PSA9=75, PSA10=180, probability30%, net−30.49. No actual
current price or future live response is promised by those historical fixtures.

The executable artifact records source/code revision, dirty-tree status, source
fingerprint, fixture fingerprint, model IDs/temperature/max_tokens, actual prompt
fingerprints, processed image fingerprints (synthetic test artifacts only), market
fingerprint, pinned catalog revision, outputs and assertions. Private Preview
receipts additionally contain code/model/catalog/market/financial-input version
fingerprints, not raw images, prompts, prices, listing data or credentials.

Both calls still use **claude-sonnet-4-6**. Temperature is explicitly zero to
reduce avoidable sampling variation; this is **not a determinism guarantee**.
No cache conceals changed model outputs. Live numeric/proposal variance remains
unmeasured and BLOCKED, even though deterministic calculations on fixed inputs
pass. A provider alias can change behind an unchanged model name; the next live
benchmark must also record provider-returned model/version when available.

## C. Confirmed failures and boundary fixes

| Failure | Root cause | Fix and regression |
| --- | --- | --- |
| One listing counted three times | Browse response rows were scored without source deduplication. Existing cross-query selection did not merge pools, but within-response duplicates inflated counts/confidence. | Deduplicate original listing IDs/variation IDs and eBay URL aliases before matching/statistics. Contradictory copies quarantine the whole source. `scan-acceptance.test.mjs`, `listing-provenance.test.mjs`: original failure 3 vs1; confidence55 vs20; now one source20%. |
| Provisional report lacks source navigation | Source links existed in the older trusted-result view; current provisional financial view omitted them. | Show up to10 matched asking source links, never invented search links; validate HTTPS eBay US host, original item ID and path; remove tracking; no arbitrary navigation. Missing/unsafe links are explicitly unavailable. Integrated browser clicks a locally mocked source URL—actual listing availability stays BLOCKED. |
| Asking evidence called FMV internally | Prediction prompt said “authoritative raw market value” and “Current GemPredict Fair Market Value”; Browse endpoint also populated an FMV field from inventory prices. | Prompt uses conditional asking baseline, explicitly not realized sales; endpoint FMV is null. Source labeling changes, not economics/threshold changes. Request/route confidence and scan regressions enforce the boundary. |
| Excess competing identity/narrative text | Rejected AI interpretation was fully expanded; long financial methodology repeated the concise answer. | Native disclosures keep original AI provenance and complete assumptions accessible but secondary. Correct canonical answer, labeled prices/probability, conditional net and Inspect guidance remain visible. The photo section now agrees that visible prices are provisional rather than calling all pricing withheld. No new prose-filter layer. Rendered disclosure and trusted-output tests cover this. |
| No reproducibility metadata | Model sampling default and missing evidence fingerprints obscured whether inputs changed. | Shared explicit model configuration and private version fingerprints; test artifact captures actual request controls and unchanged/changed inputs. Variation remains visible, not cached away. |

Exact matching, language, raw/graded separation, saved-report security, $80 fee,
two-outcome model, catalog hashes/license and Preview isolation are preserved.
Missing source identifiers are not invented, and identical titles alone are not
a deduplication key: distinct source IDs remain distinct. Duplicate/conflicting
row counts appear in safe diagnostics; actual retrieval counts still reflect the
100-row window, not the reduced unique pool. Neutral evidence uses the same source
keys, preserving observation/conflict handling.

The final malformed-cache regression also reproduced a non-iterable evidence traversal crash
when saved comparable data was an object rather than an array. Saved-report
validation now invalidates financial evidence before traversing that malformed
container. Source rendering also validates arrays and monetary rows. Canonical
identity and variant facts survive; stale prices and recommendations are withheld. The
integrated test mutates the cache, refreshes and reopens it with zero page errors.
This does not grant trust to the malformed evidence or fabricate source details.

## D. Remaining blockers: internal versus external

**Internal confirmed defects above are corrected and regression-tested.** A full
Sell/Hold strategy product is an existing unsupported scope, not implemented here.
No defensible broad strategy can be claimed from the currently available data.

**External/data/access blockers:** current code requests only eBay's standard
Browse OAuth scope. Neither eBay credential variable is present in this execution
runtime; there is no connected eBay account/developer-portal tool. Consequently,
account-specific existing sold entitlement could not be checked. No conclusion
that the owner's approved account lacks entitlement is drawn from that absence.
The account owner must provide approval/scope evidence or authorize a suitable
read-only account inspection; a Browse key alone proves no Marketplace Insights
access. No token/sold endpoint was probed and no new vendor survey was performed.
If no existing entitlement is documented, an approved licensed transaction source
is required. Supplier commercial display/cache/retention and actual Best Offer
consideration still must be established before connecting the existing adapter.
Population licensing and calibrated individual grade probability are separate
unavailable dependencies. No synthetic supplier is configured at runtime.

**Unavailable evidence:** original private Pikachu image, actual iPhone execution,
current model accuracy/variance, current catalog delivery and real listing URL
reachability. The supplied request contains text only. No hardware test or actual
price is fabricated to replace these missing inputs.

## Measurable replacement-model benchmark plan (not executed)

Freeze this code, prompt, SDK configuration, catalog evidence and market snapshot.
Use 20 independently labeled holdout Pokémon identities (including the exact
Pikachu), separate from prompt-development examples, with front/back original,
rotation, lower resolution and dim-light views. Obtain image rights/permission
and independently checked exact set/year/full number/language/finish labels.
Test baseline Sonnet plus two **explicitly approved** candidate vision endpoints,
five repeats per image variant: **20×4×5×3 = 1,200 calls maximum**, only after model,
privacy and cost-budget authorization. No candidate is selected speculatively.

Record exact model/response versions, prompts, sampling, input/output hashes,
latency p50/p95, token cost, null/missing details, field accuracy, full exact-match
rate, high-confidence wrong rate, calibration/Brier score and within-image
variation. Separately score catalog-corrected identity and trusted narrative
contamination; neutral listing evidence cannot count as independent ground truth.
Release criteria proposed for review: ≥95% exact proposals on the held-out set,
<1% confidently wrong proposals, **zero** wrong trusted identities or unsupported
variant overrides, and zero rejected-identity/grade contamination. Abstention is
reported, not scored as successful identification. Physical grade accuracy is not
inferred from these tests. Adopt a replacement only on reviewed held-out evidence,
with equal/no-worse latency/cost budgets; retain catalog authority regardless.

## E. Smallest next real acceptance

1. Supply the original HEIF for private regression retention (with permission),
   then explicitly authorize a protected replacement Preview from the final SHA.
   Verify immutable deployment URL/source SHA, four existing preflight checks,
   runtime catalog assets/license and Preview database isolation. No production
   deployment or configuration change is part of this checkpoint.
2. Separately authorize **two identical-file iPhone scans** within the existing
   rate limit, with no UI identity edits between them. Use actual provider data;
   don't force the historical $56.99 listing. Save/refresh/reopen one result.
3. Compare canonical identity/finish, configuration/catalog/market fingerprints,
   model-input fingerprints, labeled calculations, receipt IDs/durations and real
   listing links. If market fingerprints differ, do not claim fixed-market
   repeatability. If only model inputs differ, report that variance, not a market
   change. Capture only permitted/redacted evidence for subsequent offline replay.
4. With no supplier, sold/population capabilities remain BLOCKED. A passing
   upload/provisional report is not a launch or completed-sales acceptance.
   Revaluation is an additional provider request and needs explicit scan-budget
   authorization. Any wrong trusted identity or unqualified definitive decision
   is a release blocker; do not proceed to production.

## F. Final validation and review

- **342 automated tests passed; 0 failed, skipped or todo.** Includes nine new
  node regressions for source URLs/deduplication, controlled proposal consistency,
  negative exact matches, contradictory copies and model-input sensitivity.
- Production build passed. Existing optional Google Fonts optimization download
  warning and Node module-type warnings remain non-blocking; no dependency,
  framework, deployment-mode or environment changes.
- Snapshot/license packaging passed; both assets traced and present. Provenance
  validator passed both pinned printing records at
  `a211f11f3ba57d56c65c5ac33be35b77d3280757`. This is local packaging validation,
  not a claim of a deployed artifact.
- All **seven browser scripts** passed (nine script modes including text-only
  and Obsidian). Existing Stage A's16 scenarios, two mobile emulations, financial
  cases, saved/variant protections and both live-report persistence outcomes pass.
- New integrated acceptance: **13 assertions PASS, 0 FAIL**, nine controlled
  browser requests; the five identical-input requests have one unique captured
  model-request configuration/prompt/image fingerprint. Product scorecard:
  **2 conditional/offline PASS, 11 BLOCKED, 0 remaining confirmed FAIL**.
  Blocked capabilities have not been relabeled as successful functionality.
- Complete diff reviewed: no exposed credentials, production config changes,
  paid calls, hidden provider or test-catalog connection. Prediction trace has
  zero test fixture files. `git diff --check` passed.

The machine report is reproducible in `/tmp/gp-scan-acceptance.json`; images and
raw provider responses are not embedded. Test artifacts use synthetic/public
fixtures only. Re-run the acceptance command after saving the commit to capture
its exact clean code revision. The source fingerprint distinguishes a tested
working tree from its pre-commit baseline SHA.

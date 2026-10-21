# Phase 1 validation — Stage A / Stage B Repair 1

**Readiness: FAIL — B1 repaired; B2–B5 remain blocked. No authenticated live testing or deployment authorized or performed.**

Date: 2026-10-21. Branch: `restore/phase1-identity-market-matching`. Stage A validation baseline: `8384dee` (application revision `d8bb9b8`). Stage B Repair 1 changes only the null-image confidence call in `pages/api/predict.js`, plus regression tests and this report. B2–B5 behavior, confidence formulas, grading mathematics and the request budget are unchanged.

## Stage B Repair 1 — current B1 results

The three committed B1 fixtures were reproduced at baseline: each returned HTTP 500 with `Cannot read properties of null (reading 'identifiedSubject')`. The handler now calls image-identity confidence calculation only when an actual image analysis exists; otherwise `atlasIdentityConfidence` stays **null**. Downstream Atlas already handles absent image analysis, and the real parsing, reconciliation, matching, ranking and valuation-protection functions complete without further null failures.

| B1 scenario | Actual repaired result | Identity / valuation evidence | Outcome |
| --- | --- | --- | --- |
| Fully specified text: 2017 Shining Legends Pikachu #28/73 Common non-holo | HTTP 200; explicit identity preserved; variant `verified`; raw $10 | Neutral subject/number retrieval; 3 exact usable listings; 55% confidence; trusted valuation | **B1 PASS**; separate stale Atlas display remains B5 |
| Subject-only text: Pikachu | HTTP 200; missing number/year/set/version remain null; `insufficient_evidence`; valuation untrusted | No neutral retrieval without a card number; 0 usable listings / 0% in this fixture; no raw/ROI/recommendation exposed; missing-details explanation and Verify Variant action | **B1 PASS**; browser manual completion submits the completed identity, retrieves fresh evidence and new $12 pricing; completed report still has B5 |
| No-image manual confirmation: Kid Standard proposal → user-confirmed Alternate Art | HTTP 200; `user_confirmed`; canonical version Alternate Art; original Standard proposal retained; raw $80 | Fresh neutral retrieval plus strictly filtered valuation searches; 3 usable listings; 55% confidence; no cached-price fields submitted | **B1 PASS**; separate stale Atlas display remains B5 |

All three repaired API responses have `imageAnalysis: null`, `hasImageAnalysis: false`, and `atlasIdentityConfidence: null`; no vision call is made. Explicit text is not presented as a visual observation. The photo control retains its real image analysis, 90% image identity confidence in the fixture, and its vision call. A previous photo's condition analysis may remain visible in the client after manual confirmation; the fresh API response does not fabricate a new scan.

Validation commands are unchanged from the reproduction section below. Current unit/integration result: **101 checks, 96 PASS and 5 still-failing TODO assertions** (B2, B3, two B4 probes, B5). The three B1 TODO markers are removed; the actual assertions now execute as required passing checks. Two added regression checks cover absent visual confidence/photo preservation and subject-only completion through the actual request helper and handler with fresh $12 evidence. The existing request-count test now expects zero vision calls for no-image scenarios.

`npm run build`: **PASS**. Both previous browser smoke scenarios: **2/2 PASS**. The rerun Stage A browser matrix completes all **16 scenarios: 2 fully PASS, 14 readiness/UI failures**, intentionally exiting 1. All three B1 workflows have passing functional checks, including successful fresh manual completion in the browser. The overall totals remain unchanged because each repaired B1 path now reaches a priced report with the separate B5 Atlas defect; the subject-only report is safely withheld initially, and B5 appears after its successful manual completion. There are no browser page exceptions.

The remaining five executed TODO assertions still reproduce **B2** (trusted mixed-set pricing), **B3** (trusted Fanmade listings), **B4** (model/raw-price and fractional-price drift), and **B5** (Atlas's missing market data). Observed identities, variant statuses, counts, confidence, trust and economics for all 13 photo scenarios were also compared against the pre-repair baseline and are unchanged. Their baseline results below remain unchanged. Phase 1 is **not ready**, and the browser's failing readiness exit must not be presented as a fully passing validation.

Request-budget audit remains unchanged: fully specified text and manual confirmation each now reach 1 neutral OAuth + 1 neutral Browse + 6 valuation OAuth + 6 valuation Browse + 1 Claude prediction, with **zero vision calls**. Subject-only input makes 1 valuation OAuth/Browse pair and 1 prediction, then withholds pricing. Its completed identity starts a fresh neutral/valuation pass. These are mocked call counts, not live latency or integration verification. Live eBay/Anthropic tests remain **NOT TESTED**; no credentials were provisioned and no live external tests were performed.

## Stage A baseline (historical; before B1 repair)

The following original findings and matrix are retained as the source-of-truth baseline. Their B1 HTTP 500 results describe `8384dee`, not the repaired branch.

## Results and scope

- Existing automated regressions: **79/79 PASS**. `npm run build`: **PASS**.
- Full suite with Stage A validation: **99 checks: 91 PASS, 8 known failing assertions marked TODO**. Those eight assertions actually execute and fail; TODO suppresses their exit-code failure, not the readiness failure. They cover five blocker categories below. Do not interpret a zero exit code as readiness approval.
- Stage A production-build Chromium audit: **16 scenarios; 2 fully PASS, 14 FAIL UI/readiness checks**. Seven failure cases concern identity/workflow/pricing; seven otherwise-correct pricing cases have stale Atlas output. The browser command intentionally exits 1 for readiness failures.
- Existing photo and text-mode variant UI smoke tests: **2/2 PASS**. These are narrower transport-mocked checks; they do not invalidate the Stage A failures.
- Tests run the real prediction handler, Claude JSON parsing/normalization, Atlas modules, reconciliation, eBay route/filtering, market confidence, query ranking, protection and copy formatter. Only request/image transport, external SDK replies, eBay network responses and database writes are replaced. Synthetic images do not test actual visual recognition. Browser submissions consume these actual handler payloads, then save, reload, copy and share them.
- Live eBay OAuth/Browse and Anthropic vision/prediction: **NOT TESTED**. No mocked result is evidence of live integration success. Actual server-to-server HTTP routing, multipart decoding, provider latency/quotas and real image interpretation remain untested.

## Blockers observed before fixes

| ID | Failure and reproduction | Source |
| --- | --- | --- |
| B1 (repaired above) | Fully specified text, subject-only text and no-image variant-confirmation requests return HTTP 500: `Cannot read properties of null (reading 'identifiedSubject')`. No reconciliation/market evidence is produced. Initial text searches show a generic error rather than manual completion. Confirmation retains the old withheld result but cannot revalue. Earlier API tests stubbed the confidence function; earlier UI tests supplied mocked successful API responses. | `pages/api/predict.js:926`, `lib/calculateIdentityConfidence.js:6` |
| B2 | Dragalge's set vote is split 3/3 and remains `unresolved_conflict`, but pricing accepts all six Paldea Evolved/Obsidian Flames listings. The $10 and $100 pools produce a trusted $55 median and a grading recommendation. An explicit unfamiliar set contradiction is treated as missing set wording; the final safety boundary checks variant resolution, not unresolved year/set identity. | `lib/ebayIdentityMatch.mjs:22`, `lib/valuationProtection.mjs:11` |
| B3 | Three titles explicitly ending in `Fanmade`, with an original vision note warning of an unofficial card, verify the variant and produce a trusted value. The subject/number match is insufficient to establish an authentic release. The unrecognized card with missing identity is safely withheld, but that does not cover this masquerading case. | `lib/ebayIdentityMatch.mjs:33`, `lib/marketIdentityEvidence.mjs:18`, `lib/valuationProtection.mjs:13` |
| B4 | The selected median is only a prompt instruction. Model `rawValue` and supplied upside survive normalization. With selected raw **$10**, the probe retains model raw **$150**, upside **-$30**, expected net **-$46**, and `Skip It`. Keeping the same graded estimates but using the selected raw gives upside **+$110** and expected net **+$94**. UI raw/current-cost shows $10 while copy/share says $150 and saved economics retain the contradiction. Separately, a compliant $2.50 raw baseline is rounded to $3, with copy and ROI drift. These are mocked response-handling failures, not claims that a live model returned these values. | `pages/api/predict.js:234`, `pages/api/predict.js:452`, `src/App.jsx:95`, `src/App.jsx:966`, `src/App.jsx:996` |
| B5 | Trusted reports send `marketData: null` to Atlas. The browser shows Atlas **0% / zero comparables / Needs Review**, beside **55% / three usable comparables** and sometimes `Grade It`. Atlas's older confidence engine also treats query metadata as evidence and labels asking-price listings “sales”; it should not be assumed equivalent to Checkpoint 5. No formula was changed in Stage A. | `pages/api/predict.js:973`, `lib/marketEvidenceEngine.js`, `src/components/AtlasPanel.jsx` |

## Scenario matrix

All prices, identities and listing populations below are controlled fixtures, not assertions about real card catalogs. `=` means unchanged from the original proposal. Counts are **reported eligible / final used**, after route filtering and outlier removal; they are not verified sales. `n/a` means the request failed before producing a result. “Atlas fail” means identity/price/ROI/copy checks pass but the separate displayed market panel is stale.

| Scenario / original identity | Reconciled identity | Variant status | Counts | Confidence | Valuation trust | Resulting UI |
| --- | --- | --- | --- | --- | --- | --- |
| Pikachu; 2017 Shining Legends #28/73 Common non-holo | = | verified | 3 / 3 | 55% | trusted | Raw $10; holo listings excluded; **FAIL Atlas (B5)** |
| Zamazenta; 2020 Sword & Shield #021/025 Holo | **2021 Celebrations**; other fields unchanged | verified | 3 / 3 | 55% | trusted | Corrected identity; original vision retained; **FAIL Atlas (B5)** |
| Ian Happ; 2021 Topps Series 1 #155 Base | **2026**; other fields unchanged | verified | 3 / 3 | 55% | trusted | Corrected year; 2021 valuations excluded; **FAIL Atlas (B5)** |
| Dragalge; 2023 Paldea Evolved #89/197 Common non-holo | =; set **unresolved_conflict** | verified | **6 / 6** | 45% | **trusted (unsafe)** | **FAIL B2**: mixed-set $55 price/recommendation; also B5 |
| Eustass Captain Kid; 2026 One Piece OP14-014 Standard Art | = | verified | 3 / 3 | 55% | trusted | $10; Alternate/Special excluded; **FAIL Atlas (B5)** |
| Kid; 2026 One Piece OP14-014 Alternate Art | = | verified | 3 / 3 | 55% | trusted | $80; Standard/Special excluded; **FAIL Atlas (B5)** |
| Kid; 2026 One Piece OP14-014 Special Art | = | verified | 3 / 3 | 55% | trusted | $200; Standard/Alternate excluded; **FAIL Atlas (B5)** |
| Kid; Standard Art proposal; split Standard/Alternate evidence | =; art unresolved | needs_confirmation | 3 / 3 | 55% | untrusted | **PASS withholding**: no FMV/ROI/recommendation; condition, manual fields, safe saved/copy/share available; completion blocked by B1 |
| Manual confirmation: Kid Standard proposal, user chooses Alternate Art | n/a — HTTP 500 | n/a | n/a | n/a | no result | **FAIL B1**: fresh confirmation submitted; error shown; old price stays withheld |
| Shane Smith; 2025 Topps Chrome #175 Green Sand Glitter /99 | = | verified | 3 / 3 | 55% | trusted | /49 excluded; $10; **FAIL Atlas (B5)** |
| Mystery Fanmade Character; year/set/number/version absent | =; unresolved | insufficient_evidence | 0 / 0 | 0% | untrusted | **PASS withholding**: condition and manual identification available; no pricing |
| Pikachu; same full non-holo identity, explicit Fanmade warning/listings | = | verified | **3 / 3** | 55% | **trusted (unsafe)** | **FAIL B3**: fanmade asking prices/recommendation exposed; also B5 |
| Text: Pikachu #28/73 Common non-holo; 2017 Shining Legends | n/a — HTTP 500 | n/a | n/a | n/a | no result | **FAIL B1**: no successful exact-card workflow |
| Text: Pikachu only; other fields absent | n/a — HTTP 500 | n/a | n/a | n/a | no result | **FAIL B1**: no explanatory withheld report/manual action |
| Pikachu full non-holo identity; model raw $150 vs selected $10 | = | verified | 3 / 3 | 55% | trusted | **FAIL B4**: displayed raw differs from saved/copied raw and ROI; also B5 |
| Pikachu full non-holo identity; selected $2.50 | = | verified | 3 / 3 | 55% | trusted | **FAIL B4**: copied raw $3; fractional ROI mismatch; also B5 |

For B2, only three titles support the proposed set; the other three explicitly support the conflicting set. The six reported comparables are not six exact-set matches. For B3, zero listings should qualify as authentic comparables. Neither unsafe pool is presented here as validated exact-card evidence. In safe cases, counts and confidence come from the selected individual query, not a merge. Missing years, deduplication, ranking, exclusions, no-market results and provenance protections also retain the existing regression coverage.

## Price, recommendation and persistence checks

- Cooperative whole-dollar model replies: selected median, displayed raw/current cost, copied raw, expected net and upside agree. Corrected year/set reaches every valuation search; original vision remains inspectable.
- Unresolved Kid and unrecognized-card reports: financial fields and Atlas are withheld through save/reload/copy/share; condition analysis remains visible. Manual fields are available even for `insufficient_evidence`. B1 blocks actual no-image completion.
- B2/B3 unsafe trust persists into saved reports and copied recommendations because those paths correctly obey an incorrect upstream trust decision.
- B4 drift persists through save/reload/share. The live-raw component reads `marketSummary.rawMedian`; copying reads `rawValue`; economics use normalized model raw. The fractional-price probe demonstrates this without requiring model disregard of the baseline instruction.
- B5 is independently visible even when prices are otherwise consistent. The scenario matrix therefore does not call those UIs fully correct.

## Request-performance audit

Measured mock call counts on each fully identified image scenario: **1 neutral OAuth + 1 neutral Browse + 6 valuation OAuth + 6 valuation Browse + 1 vision + 1 prediction**. This is **14 eBay operations and 2 Claude calls**, plus six internal `/api/ebay-search` HTTP requests in a real deployment, excluding optional database/logging work. No credentials are used by these measurements. Incomplete text currently makes zero provider calls because B1 fails first. The unknown-number image skips neutral retrieval but still makes one valuation search and a text prediction before withholding.

| Area | Finding / risk |
| --- | --- |
| Budget/concurrency | Fixed maximum six deduplicated valuation queries, three concurrently, in two batches. No duplicate fallback or old prediction prefetch remains. Budget **unchanged**. Best individual result selected; no cross-query price aggregation. |
| Token overhead | No shared OAuth token cache: up to seven token grants per scan. Three simultaneous grants per valuation batch can amplify provider quota/429 risk. Every public eBay route invocation can incur fresh token/Browse costs. |
| Timeouts | Neutral OAuth and Browse each have 15-second signals (up to ~30 seconds sequentially). Each internal valuation request has a 12-second signal; two batches can consume ~24 seconds. These are code-derived client-wait bounds, **not measured live latency**. |
| Upstream cancellation | The eBay route's own OAuth/Browse fetches have no explicit timeout or forwarded cancellation. Aborting the internal caller may leave upstream work running. There is no unified request deadline. |
| Claude | Installed SDK defaults are 600,000 ms per attempt and two retries; route supplies no tighter timeout/retry policy. In pathological timeout cases this can mean ~30 minutes per call, excluding backoff, far beyond likely function limits. Actual platform duration settings are not available in this repo. Vision and prediction are sequential. |
| Failure/rate limits | Ranking preserves usable results when other queries fail, but still exhausts remaining candidates after common credential/429 failures. No eBay backoff or shared rate limiter. Prediction's five-per-IP/hour limiter is in-memory, not shared across instances. Manual confirmation consumes another prediction allowance. |
| Unnecessary work | Six valuation calls still run for an unresolved variant; their prices are subsequently withheld. Unknown subject/version can still invoke valuation/Claude before protection. Missing Anthropic configuration is not preflighted ahead of all market work. These are audit findings, not silently optimized here. |
| Coverage/data limits | Browse asking prices only: 20 returned listings per valuation query, 50 for neutral evidence. Not completed sales, not a real-time SLA or quota measurement. Repeated overlapping results do not become additional independent votes. |
| Deployment routing | `NEXT_PUBLIC_SITE_URL` is configured to loopback here; default source fallback is a hosted production URL. No production URL was called in these tests. Real same-environment routing must be verified before future authenticated testing. |

## Integration configuration and execution

Presence-only inspection found **no nonempty `EBAY_PROD_CLIENT_ID`, `EBAY_PROD_CLIENT_SECRET`, or `CLAUDE_API_KEY`** in this cloud process, and no `.env`, `.env.local`, `.env.production` or `.env.production.local` files. `ANTHROPIC_API_KEY` is also absent; the application explicitly binds `CLAUDE_API_KEY`. No secret values were printed or written. This does not establish whether separate production/Vercel configuration exists; it was not accessed.

Reproduce locally (Chromium + Playwright required for browser checks):

```sh
node --test tests/*.test.mjs
NEXT_TELEMETRY_DISABLED=1 npm run build
PHASE1_VALIDATION_OUTPUT=/tmp/gp-phase1-stage-a.json node --test tests/phase1-validation.test.mjs
node tests/phase1-validation.smoke.mjs
node tests/variant-ui.smoke.mjs
TEXT_ONLY_SMOKE=1 node tests/variant-ui.smoke.mjs
```

The Stage A browser audit intentionally returns failure while the documented blockers reproduce. Fixture output and browser observations are written under `/tmp`, contain synthetic data only, and are not tracked. Earlier smoke tests use mocked successful confirmations and must not be mistaken for a successful real-handler text/confirmation integration test.

## Recommended next action

Stage A remains blocked overall. B1 is now repaired and its TODO markers are removed. Address B2–B5 in separately scoped fixes, replacing their TODO markers only when the desired assertions pass; rerun this matrix and performance audit. Then obtain explicit approval and provision nonproduction integration configuration before any live authenticated testing. Do not merge or deploy on the basis of the existing green regressions alone.

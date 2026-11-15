# Phase 3L.5 — controlled category routing

Starting revision `dc795e8444491b5cbef538abecf6961cf9d58394`, reconciliation branch. No real paid AI scan or marketplace request was run. The existing report renderer, Phase 3K design, condition algorithms, prompts, model configuration, token/retry budgets and financial economics are unchanged.

## Root-cause findings

Confirmed by source tracing and offline behavior:

- App initializes Card Type to Pokémon. That React state is appended as `cardType` to the multipart submission; selecting/preparing iPhone photos does not classify them or change category.
- Previously, ControlledValidation received front/back/busy/selection epoch but no category. Its frozen manifest and one-use spending authorization could survive a category-only change. There was no explicit category acknowledgment or server binding between category and frozen evidence.
- The server normalizes ordinary cardType values, with an unknown/missing fallback to tcg. It routes Pokémon through Pokémon reconciliation and sports through the sports prompt/normalizer and `auditSportsIdentity`. Diagnostic category reflects the parsed request, not independent visual classification.
- This explains how leaving the Pokémon default unchanged could route a sports photo to Pokémon. It is a demonstrated preflight protection gap, not proof of an iOS state mutation or sports-engine failure.

For the owner's reported Topps dual-player scan, the summary states category=pokemon, Sparkle Foil proposed instead of Celebration Confetti, no completed sports audit, unassessable condition and financial withholding. No complete private diagnostic, multipart body or UI event trace was supplied in this phase. We cannot determine whether the default was left unchanged, deliberately selected, or changed through another interaction. We do not reconstruct a response, infer a sports-engine defect or claim the expected parallel/clean condition has been independently validated.

## Minimal safeguards

Ordinary scans retain their existing Pokémon default and category behavior. Controlled testing now requires a deliberate choice in the existing owner panel's small category selector, initially blank even while the main scanner defaults to Pokémon. It synchronizes the main Card Type; no new identity fields or automatic photograph classification are introduced. The selected category is prominently displayed before freezing and payment authorization.

The prepared controller captures the exact selected category together with immutable File references, selection epoch, attempt ID and revision. The downloaded manifest's additive `category` field records that choice. Choosing a different category invalidates the frozen attempt. Changing photos, preparation state, authorization or the selected category clears category acknowledgment and spending authorization. A fresh freeze also requires fresh acknowledgment. Cancellation/focus behavior and exact JPEG byte/dimension/SHA-256 checks remain intact.

After verifying all three saved files, the owner must check **Confirm selected category**, naming the current category. Only then can the separate unknown-cost paid-scan authorization be used. The controller requires the confirmed category when consuming the one-use attempt. App independently rejects stale callbacks/current-category mismatches before submitting and sends the frozen category, its confirmation and the bound attempt ID. Category selection or acknowledgment alone never requests analysis.

## Server and diagnostics

Only controlled validation is tightened. After existing owner authorization, the server requires an exact supported category and agreement across submitted `cardType`, selected-category field, confirmed-category field, frozen manifest category and confirmation attempt ID. Missing/invalid/unconfirmed/mismatched/stale values fail before provider or marketplace boundaries. New controlled requests cannot reuse a legacy category-less preparation. Historical diagnostics and manifests remain readable by the existing offline importer; no old private evidence is changed.

The encrypted owner diagnostic now adds bounded `categoryRouting` fields:

- `selected`: category reported by the UI submission.
- `confirmed`: category acknowledgment reported by the submission.
- `accepted`: category accepted after owner/manifest/category checks; null on rejection.
- `executed`: category supplied at the actual full-analysis request start; null if no analysis request started.
- `sportsAuditRan` and `sportsAuditStatus`: whether the server's sports audit result was produced, with its bounded status.

These are enums/booleans, not credentials, images or raw provider responses. Existing diagnostic expiry, encryption, owner-session/deployment binding, local download controls and redaction remain unchanged. Selected/confirmed fields attest to the submitted UI contract, not proof of a human gesture or independent recognition of the photograph. An authorized owner can still deliberately choose the wrong category or manually construct requests; the server enforces structural agreement, not optical category correctness. Existing one-use UI/in-flight protection is not a distributed exactly-once quota.

## Verification

562 complete offline tests passed; 0 failed, cancelled or skipped. Production build and four catalog packaging checks plus owner-demo packaging check passed. New tests cover the untouched default, explicit sports choice, category changes after freeze/acknowledgment, stale callbacks and confirmation attempt IDs, missing/invalid/mismatched server inputs, sports audit execution, both category routes, financial withholding and preserved no-retry/image/privacy controls. Existing fixtures were updated to supply explicit category evidence for controlled mock requests; ordinary-request tests remain unchanged in behavior.

The built-App browser check used synthetic JPEGs and a mocked sports provider response: untouched default blocked freezing; explicit Sports Card synchronized state; all saved files were verified; separate category and spending acknowledgments were required; selected/confirmed/accepted/executed all became sports; the sports audit ran; financial outputs stayed withheld; diagnostic export/cancellation/expiry controls remained functional. No live provider or marketplace call occurred. Chromium with iPhone 13 emulation is not native Safari; synthetic audit execution establishes routing, not real-card identity/parallel or clean-card accuracy.

## Simple iPhone procedure — after review and separate scan authorization

1. Open the new immutable protected Preview. Authorize Preview Scan Diagnostics and refresh the owner control.
2. In **Owner-only controlled card validation**, choose **Sports Card** in **Category for this controlled test**. Check that **Selected card category: Sports Card** is displayed and the main Card Type also shows sports.
3. Upload/prepare the real front and back. Freeze a new pair, save both prepared JPEGs plus manifest to Files/Downloads, and verify all three exact saved files. Do not reuse files from a prior attempt/revision.
4. Check **Confirm selected category** only after checking it names Sports Card. Category/photo changes require re-preparation and fresh acknowledgment. Do not select the spending checkbox or submit during this review.
5. For a later explicitly authorized paid test, acknowledge the unknown cost and initiate the controlled Full Analysis once. Use the prominent evidence panel immediately: first tap prepares diagnostics, second tap starts download, then confirm the JSON exists in Files/Downloads.
6. Check diagnostic selected/confirmed/accepted/executed=sports and sportsAuditRan=true. A complete_unverified audit is not catalog or parallel verification. If category/audit evidence disagrees or a request fails, retain the evidence and stop; do not retry the paid scan automatically.

No changes to report design, clean/defect evidence thresholds, parallel mappings, grading probabilities or financial recommendations. No Production deployment or PR #2 merge. Stop for review.

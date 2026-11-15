# Phase 3L.11 — Useful sports evidence recovery

Starting/rollback revision: `8a7d922b0e327fb4e57e2da22cafb2fb7bbd67cc` on `reconcile/iphone-upload-2026-11-03`. All 293 baseline tracked blobs were verified before editing. No model/prompt/schema activation, extra AI request, retry/fallback, grading economics, catalog mapping, prepared-file verifier, owner security or Phase 3K styling change is included.

## Root cause → correction

### Condition evidence

`lib/visualEvidence.mjs`: `unlocatedLimitations`, `sideWideLimitations`, `readInspectionCoverage`, `readVisualEvidence`, `conditionObservationText`, `conditionPresentation`.

Previously a global glare/perspective warning limited every attribute on both photos, even with an explicit regional declaration. Valid scope declarations now constrain the same warning. Missing, invalid or overflowed scope remains global uncertainty. Null limitation coordinates mean the entire stated side, matching the existing prompt: they cannot clear other attributes on that same side. Unlocated warning provenance survives report revalidation so rejecting an invalid declaration cannot make a saved report more optimistic.

Rejected localized evidence now retains `reportedSide` with `reportedSideVerified:false`, separately from accepted evidence; the trusted observation side stays null. Unsupported unknown-location duplicates no longer invalidate independently localized observations. Genuine overlapping same-side contradictions still downgrade clean claims. Broad damage-box rejection, cue/confidence checks, photograph presence and centering requirements are unchanged.

An observation status distinguishes supported regional evidence, tentative visible-area evidence and unassessable regions. A tentative clean observation requires valid supplied-side localized support, confidence at least 0.4 and only incomplete coverage/support reasons. It remains `certainty:unassessable`, never a confirmed clean claim. Global/scoped obstruction, outside scope, unseen photographs, contradictions and evidence overflow cannot become tentative clean. Every attribute remains `wholeAttributeVerified:false`, with `completeness:partial_or_unknown`; grading fields remain null.

`lib/collectorPresentation.mjs`: `collectorConditions`, `collectorLimitations`; `lib/unifiedReportPresentation.mjs`: `conditionSnapshot`; `src/components/ConditionSnapshot.jsx`: existing component text only. Useful front/back/regional evidence is shown alongside uncertainty, including tentative observations and rejected-side provenance. Repeated warning phrases are grouped by code with all supplied side/attribute/region scopes retained. Existing report layout, sections, hierarchy, CSS and colors are unchanged.

Risk: model-proposed scope is not independently measured geometry. Explicit scope can be wrong, and absence of visible damage is never defect-free proof. Unknown locations remain conservative; actual physical condition and grade remain unresolved.

### Sports identity

`lib/sportsIdentityEvidence.mjs`: `sportsSubjectNames`, `sportsIdentityEvidence`.

Comparison supports up to four bounded names, equivalent slash/comma/ampersand/plus/“and” separators, Unicode-width normalization and independent athlete order. Name content still uses existing catalog name normalization, without fuzzy matching, guessed references or hard-coded athletes. Empty/malformed groups and duplicate names cannot become supported.

Matching clear names with absent/invalid attribution are unresolved. An actual extra clear athlete, mismatched proposed group or reference pointing at a different clear athlete remains conflict. Supported observations are still unverified. Product, subset, title, collector number, serial and foil remain separate; Sparkle Foil is not mapped to Celebration Confetti.

Risk: punctuation can be ambiguous, especially surname-first spellings or suffixes. No fuzzy-name expansion is included. Multi-athlete listing matches require each full name phrase; ambiguous one-word splits remain rejected there.

### Active listings

`lib/ebayIdentityMatch.mjs`: `productKey`, `hasProduct`, `hasSubjects`, `matchListing`; `lib/reportListings.mjs`: `reportListings`; `pages/api/predict.js`: sports lookup identity; `pages/api/ebay-search.js`: bounded subset query field.

Every expected athlete name must occur as a full bounded phrase; group order need not match. The reviewed product spelling alias is only **Topps Series One ↔ Topps Series 1**. Missing/mismatched subset is rejected when an explicit subset proposal is available; that separate field now reaches initial screening and report re-screening. Conflicting Series 1/2/Update products cannot hide alongside an expected product.

Wrong year/number, missing/wrong athlete/product/subset/parallel, serial mismatch, slabs in raw cohorts, lots (including “pair”), unauthorized autograph/relic, unsafe URLs, duplicate conflicts and variant incompatibilities remain excluded. No speculative parallel aliases are introduced. Passing title matching yields at most an unverified active candidate, never an exact-printing comparable, completed sale or financial value.

Risk: conservative titles/unknown subset or finish can still cause false negatives. A matching title is seller wording, not independent catalog or physical evidence. The historical eight candidates remain unexplained without their actual records/rejection codes.

### Owner diagnostics

`lib/scanDiagnostics.mjs`: response wrapper; `lib/scanDiagnosticClient.mjs`: `rememberScanDiagnostic`; `lib/diagnosticExport.mjs`: `prepareDiagnosticExport`; `src/components/ScanDiagnostics.jsx`: `OrdinaryDiagnostics`, reused `ControlledCapture`; `src/App.jsx`: retain existing identity-stage export context.

Ordinary successful and failed Full Analysis now use the existing two-step prepare/save capture UI. First tap fetches and validates sanitized JSON into memory; a fresh second tap initiates download synchronously. It explicitly does not confirm filesystem saving. The capture is keyed by scan ID so a new scan cannot inherit another scan's prepared buffer.

Missing handles and bounded generation/size failures produce visible reasons rather than a hidden download control. Server failure metadata is only `size_limit` or `generation_failed`, never unrestricted exception text. Authorization-check failures can be checked again without scanning. The fresh-paid-scan recovery instruction is removed.

Transient handles remain in the existing WeakMap associated with live capture/report objects; no ticket enters report serialization or persistent storage. Saved/reloaded reports intentionally cannot restore them. The common exporter validates scan/stage for ordinary requests and still enforces attempt/prepared hashes/no-marketplace for controlled diagnostics (including legacy handles identified by their pair fields or diagnostic content). Existing identity-stage exports remain stage-bound.

Owner authentication at scan start, same-session/origin/commit encryption, 24,576-byte JSON and 6,000-character ticket limits, five-minute maximum expiry, earlier owner-session expiry, page-leave buffer clearing and no reauthorization of old tickets remain unchanged. No raw provider response, photo, credentials, personal owner information or persistent server record is added.

Risk: actual iPhone/Safari filesystem saving has not been tested on a physical device. Offline hook/DOM simulation verifies prepare versus fresh-tap initiation, repeat-tap locking, canceled-save retries, expiry and no extra scan. Missing historical diagnostics cannot be reconstructed.

## Regression coverage

`tests/evidence-recovery.test.mjs` adds 19 acceptance tests covering explicit regional glare, unknown/invalid/overflow scope, whole-side null scope, tentative clean limits, rejected provenance, independent sides, genuine contradictions, grouped warnings, equivalent athlete formatting, incomplete versus contradictory attribution, strict positive/negative listing screening, actual report candidates, mocked end-to-end Sports and Pokémon, successful/failed owner exports, bounded generation/size errors, unauthorized/expired/missing access and two-step Safari simulation. Synthetic JPEGs and provider/marketplace mocks only; no paid or live marketplace request.

`tests/scan-diagnostics.test.mjs` updates assertions for visible unavailable states; `tests/helpers/renderReports.mjs` supplies the reused capture's hooks. `package.json` includes the new acceptance file in the existing build's benchmark test group. Existing safety/regression tests continue to run.

Validation commands:

- `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs`
- Targeted condition/sports/listings/diagnostics tests, including the new acceptance file.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` (existing build test groups, production Next build and both packaging scripts).
- `node scripts/check-tcgdex-packaging.mjs` and `node scripts/check-demo-packaging.mjs` against the final build.

Telemetry is disabled only for this workspace command because its default config directory is read-only. No Vercel environment variable is changed.

## Synthetic before/after (not historical evidence)

Identical synthetic inputs: localized front-corner clean observation with inspected coverage; tentative front-edge clean observation with partial coverage; glare scoped to a front-surface region; unassessable back-surface observation; agreeing two-player group with comma formatting and missing references; reversed-name listing using Series 1 spelling.

- Before: corners/edges/surface all unassessable; group conflict; listing rejected for player/product strings.
- After: no visible defect in inspected front-corner regions only; tentative visible-area front-edge observation, not verified clean; surface uncertainty and unverified back-side provenance retained; identity unresolved pending attribution; listing may be an unverified candidate.
- Both: unknown overall card condition, unverified physical printing, no grade or financial recommendation. No fabricated card photographs or completed sales.

Owner review artifacts outside the repository include the actual component before/after HTML, JSON, complete diff, exact file inventory and test/build logs.

## Deployment and rollback

Push only this scoped commit to the reconciliation branch and verify its protected Preview's exact SHA and READY state. Experimental structured outputs stay disabled. Do not merge PR #2, deploy Production or run a real-card scan.

Rollback reference is the starting commit above: revert the Phase 3L.11 commit on the reconciliation branch and let its protected Preview workflow rebuild, or block/delete this exact Preview. No Production rollback or environment configuration change is necessary. Do not force-update another branch.

Historical response, exact listing exclusions, original diagnostic failure, independent named parallel, physical defect severity and actual model cost remain unresolved. Owner review is required before another paid controlled test.

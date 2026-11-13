# Phase 1B: dedicated identification action

Base: c3e29f61a1df472c49d6a1e181c4bc9af475fbca.
No identity/condition chaining or separate paid condition stage is implemented.

## Interaction and API

The existing upload preparation remains unchanged: a validated/oriented front
photo is required, and a back photo is optional. Select **Identify Card** after
preparation. **Analyze My Card** remains the existing combined full scan; it does
not silently become an identity-only action. Identification has its own result
view rather than rendering an empty condition/financial report. A synchronous
in-flight ref protects both actions from double submission.

`POST /api/predict`, existing multipart format, adds `mode=identity` with `image`,
optional `backImage`, and existing `cardType`, `cardName`, `cardSet` fields. Omitted
mode or `mode=full` preserves the existing flow. Unknown modes are rejected. An
identity action without a validated front photo stops before any paid request.
The same five-per-hour in-memory/IP rate limiter covers both actions; this is the
existing per-instance protection, not a new distributed quota guarantee. Preview
deployment protection and same-origin/manual-redirect transport are unchanged.
Identity mode returns before email writes, full photo analysis, text prediction,
marketplace discovery, financial estimation and grading recommendations.

Successful identity responses contain `stage=identity`,
`stages={identity:completed,condition:not_requested,marketplace:not_requested}`,
`originalIdentityObservation`, `printedIdentityEvidence`, provisional/verified
`canonicalCard`, the existing Pokémon `identityVerification`/catalog outcome and
reason codes, user conflicts, source references, and separate rarity, variant,
artwork and physical-printing results. `imageAnalysis` and `marketData` are null.
`financialSafety.mjs` still supplies the authoritative withheld financial result.
Catalog-supported rarity does not authenticate the physical printing.

The result view labels an unsupported identity **Unverified proposal** and renders
its original observation and printed readings; an unavailable catalog never turns
the proposal into a verified identity. On an unexpected catalog runtime exception,
the successful observation survives with an explicit runtime notice, no compared
candidate and no fabricated conflicts. Provider errors return the existing safe
provider classification. Copy/save use the existing protected-report boundary;
no diagnostic capability or photo bytes are attached to stored reports.

## Request and schema

`lib/identityStage.mjs` builds one identity-only Sonnet 4.6 vision request. It reads
name, full collector number (including sports prefixes), set/language markings,
copyright text, separate proposed release year, visually supported rarity/printing,
confidence and uncertainty. Up to twelve attributed readings retain verbatim text,
certainty, photograph side, printed area and bounded alternative readings.
Copyright is never used as automatic release-year proof. No condition measurements,
PSA estimates, price fields or grading instructions are requested.

The schema requires explicit nullable identity fields, bounded strings/arrays and
valid field/type/side enumerations. Unknown fields, missing keys, malformed JSON,
non-object output, unsupported photograph attribution, empty output and any
`max_tokens` stop are rejected. The existing complete-JSON parser is reused;
there is no regex extraction, repair, unsupported JSON-mode parameter, paid token
count request, automatic retry or fallback provider. The call overrides timeout
to 45 seconds and maxRetries to zero on the existing no-retry client.

Phase 1A catalog reconciliation is reused with an explicit internal
`skipMarketplace` option. Even configured eBay credentials cannot cause a neutral
listing search during this action. Existing catalog budgets, reviewed 30C mapping,
provenance, ambiguity, denominator, language, user-protection and narrow snapshot
correction rules are unchanged. Sports uses its existing alphanumeric card mapper
and remains independently unverified; the hardened full-scan sports matcher is
unchanged.

## Budget and estimated cost

| Action | Output-token cap | Estimated maximum text-output charge at the previously documented $15/MTok assumption |
| --- | ---: | ---: |
| New identity-only, front or front/back | 2,000 | $0.030 |
| Existing full scan, front | 3,200 (unchanged) | $0.048 |
| Existing full scan, front/back | 4,800 (unchanged) | $0.072 |

The identity cap is 37.5% below the front full-scan cap and 58.3% below the dual-photo
full-scan cap. Removing condition evidence, localized defect arrays, photo notes
and grading forecasts reduces output requirements. A synthetic twelve-reading
front/back fixture serializes to 1,750 UTF-8 bytes; this is not an actual provider
token count or a guarantee that every multilingual/verbose response fits. Overflow
still fails closed without another paid attempt. Real success rate/latency remains
unmeasured because no paid requests were made.

These are output-only estimates using the existing pricing assumption, not a
newly obtained provider quote. Actual output is billed by tokens generated; photo
input costs remain, prompt input is shorter, and both depend on provider pricing.
The action makes one paid call; deliberately choosing the separate full scan later
makes its own paid call, without caching/reusing an identity result to claim that
the second action is free. No new subscription, credentials or provider is added.

## Diagnostics and tests

Existing owner-authorized encrypted Preview diagnostics add a fixed stage name,
not-requested condition/marketplace markers, a verification-runtime boolean and an
allowlisted rejection code. Existing summaries retain evidence disposition and
catalog outcomes without exporting raw responses, photos, arbitrary provider prose,
credentials or URLs. Authorization, expiry, encryption and Production exclusion
are unchanged. Ordinary users receive no diagnostic tickets.

Fifteen new offline tests exercise real multipart handlers, the actual JSX result
view and actual App upload/action callbacks. They cover Zapdos 133/128/30C EN with
2025 -> independently supported 2026, Pikachu/provenance, Konnor BCP-86, ambiguous,
missing, unavailable, incomplete and conflicting catalog data, uncertain/front-only
readings, twelve-reading responses, truncation/malformed/empty/extra-field output,
provider failure, runtime partial success, no retries, Preview diagnostic privacy,
copy/save normalization and duplicate-click suppression. Actual SDK fetch is mocked
for the no-retry assertion. Catalog responses and photographs are explicit offline
fixtures, not claimed real scans.

Run `node --test --test-isolation=none tests/*.test.mjs` for individual test totals;
`npm run build` also runs configured suites and TCGdex runtime-asset tracing checks.
In this managed runtime, use `XDG_CONFIG_HOME=/tmp/gempredict-next-config
NEXT_TELEMETRY_DISABLED=1` to avoid Next telemetry writing to a read-only home.

## Changed files

- `lib/identityStage.mjs`: isolated prompt, strict response contract, bounded paid
  request, reused catalog adapter and safe partial-success result.
- `pages/api/predict.js`: explicit early identity-mode branch after shared guards.
- `lib/reconcileMarketIdentity.mjs`: internal skip-marketplace branch; default flow
  and all consensus/verification thresholds unchanged.
- `lib/catalogResolution.mjs`: one fixed verification-runtime rejection code.
- `lib/scanDiagnostics.mjs`: fixed stage/runtime markers; existing privacy gates.
- `src/components/IdentityResult.jsx`: canonical/proposal identity, printed evidence,
  verification dimensions and protected copy/save actions.
- `src/App.jsx`: separate identity action/state, pending guard and result rendering.
- `tests/identity-stage.test.mjs`: isolated end-to-end and failure regressions.
- `tests/helpers/reconciliationPipeline.mjs`: inject real stage into handler harness.
- `tests/helpers/renderReports.mjs`: real identity JSX renderer and callback harness.
- `package.json`: include new suite in build validation.
- This document.

## Remaining limitations

No actual iPhone/model request, deployed Preview authentication or hosted catalog
coverage was tested. Reviewed set metadata cannot create a missing card. Physical
printing/artwork remain unverified, and there is no trusted sports catalog or
qualified completed-sales bridge. The existing TCGdex MIT license and traced assets
remain unchanged; no marketplace commercial/retention rights are assumed. Condition
analysis remains only the separate existing full scan; Phase 2 is not implemented.
No HEIC code, condition thresholds, financial gate, sports matcher, Production
configuration, model selection or full-scan output budget is changed.

## Validation result

All 263 individual offline tests passed (0 failed, 0 skipped), including the 248
pre-existing tests and 15 new identity-stage tests. The production build passed,
and both TCGdex snapshot and MIT license were traced and present in the prediction
function bundle. Final source-scope checks preserve all unchanged base files,
including mobile conversion license/notice assets.

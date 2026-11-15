# Phase 3L.12 — Pre-scan diagnostics and collector condition copy

Required starting commit: `66059e29f4df1033bc95bf858191eea303be5163`, branch `reconcile/iphone-upload-2026-11-03`. HEAD and all 295 tracked source blobs matched before editing. Owner-specified rollback: `8a7d922b0e327fb4e57e2da22cafb2fb7bbd67cc`; the immediate previous behavior is also available at the starting commit.

## Diagnostic protection

The existing prepared-pair controlled path already required an owner diagnostic session on the server. A regular Full Analysis request did not encode owner validation intent, so an owner could use that button without the diagnostic session required to mint an export.

The existing Preview diagnostic control now offers an explicit, unchecked-by-default **Owner validation — require diagnostics before Full Analysis** option. It displays capability/authorization status and expiration, with existing manual authorization and a refresh button. The choice is volatile React state; no owner key or mode is persisted. Losing capability or authorization never silently turns that choice off.

When opted in, `App.handleSubmit` runs a free, same-origin, no-store status check before calling the scan endpoint. Missing/expired authorization, unavailable capability, network failure, or photos/category changing during the check produce an actionable error and **no scan submission**. This check also applies to the existing prepared-pair controlled callback. Authorization is never triggered automatically and a blocked check does not create a fictitious failed scan/report.

The opt-in adds only `ownerValidation:true` to the existing Full Analysis form. It does not introduce a new analysis mode. `requireValidationDiagnostics` checks the current Preview diagnostic session and active request-local observer before proceeding. It checks again after image preparation, immediately before the existing SDK request. This protects callers bypassing the UI and expiry between initial verification and the provider boundary. Malformed intent and photo-free/identification-only misuse are rejected without a provider request.

The ordinary opt-in is a diagnostic requirement for the existing Full Analysis route, **not** a claim that a prepared-pair manifest was supplied. The existing `condition-validation` route still independently requires exact JPEG bytes, manifest, matching category confirmation and its one-use client preparation; none is bypassed. That route also blocks if the diagnostic observer could not initialize.

An ordinary customer who has not explicitly selected owner validation has no new authorization check, flag or diagnostic requirement. Production cannot use the owner-validation feature under the existing diagnostic deployment policy. The Preview option is not shown when diagnostics are disabled; a previously selected intent remains visibly blocked if capability disappears.

The existing manual key prompt, cookie/session binding, same-origin/commit encryption, export bounds and five-minute maximum export lifetime are unchanged. Expiration during a long scan/export and missing historical exports remain subject to the original security policy. Reauthorizing cannot restore an old ticket. No server persistence or raw provider response retention was added.

## Collector condition summary

The Phase 3L.11 presentation repeated support/coverage caveats in each tile, in finding text and in limitation disclosures. The presentation now:

- Leads with useful supported or tentative observations and suspected problems, labeled by front/back; absent assessments and unverified reported-side provenance remain explicit.
- Groups repeated observations/locations and describes each issue once; distinct sides, certainty, cues, reasons and provenance are preserved.
- Uses short finding text in existing expanded findings. Full original reason text, assessments, coverage, model notes and rejected provenance remain in the existing **Inspection coverage & original evidence** disclosure.
- Shows one primary regional-cleanliness/unknown-area disclaimer and compact limitation names, with complete warning scopes in Detailed Condition Findings.
- Keeps an explicit physical-confirmation warning for suspected defects and measured-geometry requirement for centering.

This is presentation only: `lib/visualEvidence.mjs` and `src/components/ReportStyle.jsx` remain byte-for-byte unchanged. No condition state, observation certainty, inspection coverage, geometry or defect localization is inferred or modified. Tentative clean observations remain tentative/unassessable; suspected defects remain suspected; contradictory overlapping evidence remains conservative.

The request references two latest real Mets screenshot sets, but those files were not supplied with this pasted request. No screenshot was treated as raw model evidence. Synthetic before/after examples use identical existing validated evidence and the actual unified report components for both Sports and Pokémon. They are not reconstructed owner reports or physical condition benchmarks.

## Changed functions

- `lib/scanDiagnosticClient.mjs`: `requireOwnerDiagnosticAccess`, a free status check only.
- `lib/conditionValidationServer.mjs`: `requireValidationDiagnostics`.
- `pages/api/predict.js`: owner-validation intent validation in `handler`; optional guard context in `fetchImageAnalysis` immediately before the existing provider call.
- `src/App.jsx`: `handleSubmit`, explicit Preview validation state/diagnostic control props.
- `src/components/ScanDiagnostics.jsx`: `ScanDiagnostics`, `OrdinaryDiagnostics` status, opt-in and refresh controls; manual authorization preserves existing capability metadata.
- `src/components/ControlledValidation.jsx`: `requireOwner` capability guard and visible authorization expiry.
- `lib/collectorPresentation.mjs`: `collectorConditions` supplies uploaded-side context; `collectorLimitations` adds compact labels without dropping full scoped warnings.
- `lib/unifiedReportPresentation.mjs`: `collectorFindingText`, `conditionSnapshot` concise, grouped, side-specific collector copy.
- `src/components/ConditionSnapshot.jsx`: existing tiles/details/technical disclosure text only; no report styles/sections/hierarchy changed.
- `tests/prescan-condition-quality.test.mjs`: new acceptance coverage.
- `tests/helpers/reconciliationPipeline.mjs`: binds the actual server guard in existing route mocks.
- `tests/helpers/renderReports.mjs`: mocks the free authorization check in existing App tests and allows diagnostic-control props in SSR tests.
- `tests/unified-card-report.test.mjs`: asserts the concise suspected-scratch summary plus shared physical-confirmation warning separately.
- `package.json`: existing benchmark test group includes the new acceptance file.

## Offline validation and safety review

Run the full test suite, including complete blocked/authorized App and route paths, ordinary opt-out, prepared-pair callback, absent/expired/disabled owner authorization, inert observer, malformed intent, one prompt-JSON SDK call with zero retries, successful sanitized diagnostic export, and financial withholding. Presentation tests cover supported/tentative regions, side provenance, unknown areas, grouped warnings, contradictions, unchanged evidence through save/restore, and Sports/Pokémon reports. Fixed baseline hashes protect the certainty engine and approved report CSS from unintended edits in this phase.

Commands:

- `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs`
- `NEXT_TELEMETRY_DISABLED=1 npm run build`
- Existing catalog/demo packaging scripts against the resulting build.

All photos and model responses used by tests are synthetic; external services are mocked. There are no live marketplace or paid model tests. Telemetry is disabled only for the local command because the runtime config directory is read-only; no Vercel setting changes.

Claude Sonnet 4.6, one Full Analysis prompt-JSON call, zero automatic retries/fallbacks, experimental schema default-off, existing category confirmation, prepared-byte verification, printing/sales qualifications, all grade/probability restrictions and financial withholding remain unchanged. Owner keys are not logged, stored or automatically requested. Provider-call payload fields are unchanged; only a pre-call authorization check is added for explicit validation intent.

## Deployment and owner checkpoint

Commit scoped changes only to the reconciliation branch; let its Git workflow build the protected Preview. Verify exact SHA, READY state, existing SSO protection and the absent experimental enable variable. Do not deploy Production, merge PR #2 or submit a real scan.

For a future owner-authorized validation, explicitly select Owner validation, manually authorize Preview Scan Diagnostics, confirm the displayed expiry, then use the appropriate Full Analysis or existing prepared-pair path. The status check is free; it does not authorize a paid request or guarantee a successful filesystem save. This phase ends before any real scan.

Rollback: revert the Phase 3L.12 commit on this branch to restore the immediate prior checkpoint, or restore the owner-specified `8a7d922b0e327fb4e57e2da22cafb2fb7bbd67cc` through a reviewed reconciliation-branch change and rebuild its protected Preview. Do not reset another branch or touch Production. Rollback instructions are documentation, not an executed rollback.

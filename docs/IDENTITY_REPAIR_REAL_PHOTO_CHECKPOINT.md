# Identity repair: controlled real-photo checkpoint

Base: 91fa6d04ae830f24adb9777e4285108f660b2ea0.
Scope: existing Identify Card action; no new AI stage, provider or catalog.

## Concrete repair

- Strict response rejection now records the exact phase, rule and allowlisted
  field path. Valid JSON failing schema is `schema_rejected`, not `invalid_json`.
  Missing nullable fields, numeric release years, wrong types, unexpected fields,
  unsupported labels/sides, bounds, syntax and output truncation stay distinct.
- The prompt includes an explicit root JSON template to reduce omitted fields and
  type ambiguity. It does not manufacture missing evidence or coerce responses.
- The normal UI displays safe specific failure wording. Authorized encrypted
  Preview exports additionally retain the same requirement, actual JSON type and
  bounded counts. Unknown key names, field values, raw model output/photos,
  arbitrary parser/provider messages, credentials and URLs are never added.
- Valid alphanumeric collector readings survive normalization: examples include
  TG01/TG30, SV49/SV94, SWSH020, 001/SV-P and sports BCP-86. This is evidence
  preservation, not new TCGdex coverage. Unsupported Pokémon discovery formats
  return an explicit incomplete result, without inventing a denominator/record.
- Catalog agreement and clear printed-photo support are separate. Identity-only
  photo support requires clear name, complete collector number, set marking and
  language that agree with a supported independent catalog identity. These remain
  model-read observations, not a second OCR engine or physical authentication.
- Missing/uncertain readings do not erase the useful canonical catalog result or
  original proposal, but cannot establish photo support. Contradictory sports
  readings are flagged rather than silently choosing the model's number/name.
- Saved/copy/restore paths recompute photo status. Catalog rows/copies say record
  support, not physical verification. Artwork, printing, variants and finance
  remain separate; all monetary estimates/recommendations remain withheld.

Full scan matching thresholds, sports marketplace matching, HEIC conversion,
financialSafety.mjs, diagnostic authorization/encryption, production configuration,
provider model, request count, retry policy and 2,000-token identity budget are
unchanged. No live AI or catalog calls were made. No new provider licensing or
sports catalog is asserted. The disputed Konnor fixture remains a regression input,
not independently verified ground truth; there is no player-specific correction.

## Offline verification

Regression fixtures cover the existing independently sourced/mock-wrapped Zapdos
133/128 correction from AI 2025 to catalog 2026, Pikachu 149/128 correction/provenance,
missing and uncertain printed fields, contradictory name/number readings,
alphanumeric evidence, unsupported catalog formats, schema/JSON/completion errors,
privacy sentinels, protected transport/UI wording and saved-report rechecks.
Existing cross-category, HEIC, full-scan, financial and provenance tests also run.
These are synthetic tests; they do not establish live accuracy or hosted coverage.

## One owner-controlled Preview test

1. Use the Preview built from this repair commit on
   `reconcile/iphone-upload-2026-11-03`; confirm READY and the matching commit.
   Do not use Production or an older bookmarked deployment.
2. Select Pokémon. Leave optional typed name/set fields blank for this controlled
   photo-identification test; explicit typed choices are protected and can block
   a contradictory automatic correction.
3. Reuse the known Zapdos front photograph and its matching back if available.
   Wait for preparation to finish. Click **Identify Card once**. Do not click the
   separate Analyze My Card action or automatically repeat a failed request.
4. If the existing owner diagnostic control is available, authorize it before the
   scan using the existing owner diagnostic key, then download the scan export
   immediately. The session lasts 15 minutes; no new credentials are required.
   If diagnostics are unavailable, the on-screen field/rule error still works.
5. Collect screenshots of: the full identity heading; catalog and printed-evidence
   statuses/reasons; expanded printed readings; original AI observation; or the
   exact failure message/reference if no result was produced. Record which photos
   were supplied and the deployment commit. Do not share keys/cookies or raw
   provider responses.

Expected success: original AI observation stays unchanged; clear 30C EN and 133/128
readings support an independently returned 2026 30th Celebration Zapdos identity.
Artwork/physical printing and financial recommendations remain unverified/withheld.
If the provider omits/type-mismatches a field, the exact rule is visible. If catalog
coverage is missing, the proposal remains useful and unresolved with the actual
catalog outcome. Neither case is presented as proof of a wrong photographed card.

A second Pikachu scan should be a separate owner decision after reviewing this
first result, not an automatic paid call. The historical real Phase 1B failure's
exact field remains unknown; this repair makes the next failure actionable.

## Final automated result and file inventory

276 tests passed, 0 failed, 0 skipped (263 existing plus 13 new). Production build
and TCGdex snapshot/license tracing checks passed. Both existing positive Zapdos
and Pikachu identity-stage regressions now explicitly assert printed-photo support.

Changed paths:
- lib/identityValidation.mjs
- lib/identityStage.mjs
- lib/collectorReading.mjs
- lib/visionIdentityEvidence.mjs
- lib/photoIdentity.mjs
- lib/catalogIdentity.mjs
- lib/catalogResolution.mjs
- lib/pokemonReportIdentity.mjs
- lib/reportVerification.mjs
- lib/predictionTransport.mjs
- lib/scanDiagnostics.mjs
- pages/api/predict.js
- src/components/IdentityResult.jsx
- tests/identity-repair.test.mjs
- tests/identity-stage.test.mjs
- tests/helpers/reconciliationPipeline.mjs
- docs/IDENTITY_REPAIR_REAL_PHOTO_CHECKPOINT.md

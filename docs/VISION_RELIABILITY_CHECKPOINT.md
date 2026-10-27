# Vision identification and condition reliability checkpoint

Baseline: `2b6ade579c8876930da535d6f69aea645c2f7dd9`, restoration branch.
Scope: evidence-first Pokémon candidate investigation, defensible photo observations,
rarity/printing labels, and an explicitly opt-in cross-model evaluation harness.
No production deployment or paid provider request was performed.

## Actual private Preview evidence

Read-only Vercel runtime receipts were retrieved for the three supplied IDs from
Preview deployment `dpl_D2MYMr3xQxekAVhUJH7qhDoFoxvJ`, baseline revision above.
These are actual runtime counters, not mocked results. Times below are October 27,
2026 UTC (New York was EDT, UTC−4).

| Receipt | Receipt time | Elapsed | Independent identity | Variant | Marketplace attempts | Outcome |
| --- | --- | ---: | --- | --- | ---: | --- |
| `3b7dfae2-d545-4950-a9a3-753521c6981a` | 14:14:44.395 | 25,409 ms | insufficient_evidence; blocked | needs_confirmation | 0 | identity_blocked |
| `b5d82e8d-ad6b-4dab-a8d8-7dd3d602f1a5` | 14:17:06.141 | 24,492 ms | insufficient_evidence; blocked | needs_confirmation | 0 | identity_blocked |
| `b330d552-0e9f-44a2-9aed-5f0574f84354` | 14:25:06.398 | 40,383 ms | corrected; allowed | corrected | 6 | provisional_analysis |

The first two share model-configuration fingerprint
`0f1c2e88b56464afda707618` and catalog fingerprint
`95bf24333eadbe834c2e033b`. The third has catalog fingerprint
`888d376267ffe8d14acd49e8`: each search retrieved 100 listings, with one
used raw comparable in each attempt's selected pool; asking confidence was 20%.
Those six counts do not mean six independent sales. Sold groups were empty,
provider_not_configured, historical population unavailable, verified FMV false
and actionable recommendation false. Existing rejection categories included
language_missing, set and variant mismatches; no provider failure was reported.

The user's 151 / 149/165 identification descriptions and disputed scratches and
soft corners are user-provided evidence. The retained receipts do not contain
raw OCR, image bytes, original AI prose or localized defect evidence. They cannot
prove whether glare, sleeve, compression or hallucination caused a particular
claim. Original and improved Pikachu photos were not available in this workspace.
The owner reporting pack-fresh condition is not independent PSA 10 ground truth.

## Confirmed implementation mechanisms and corrections

1. **Collector-number anchoring.** The old TCGdex adapter searched by name/local
   number but then discarded a candidate when its official set denominator
   differed from the model proposal. A guessed 149/165 therefore excluded an
   otherwise valid 149/128 record. This mechanism is reproduced with the actual
   adapter and controlled catalog transport. Missing historical raw catalog
   responses mean we cannot prove it was the sole cause of both live failures.
2. **Candidate investigation.** Actual image responses now separate bounded,
   localized printed-text readings from speculative identity fields. Clear full
   collector readings constrain the search; clear contradictory numbers/set
   codes block it. Uncertain readings generate bounded alternatives; without a
   clear denominator, a local-number search can surface an independent candidate.
   Up to four name/number combinations share the existing nine-request/eight-second
   budget and cache. Truncation, outages and incomplete searches fail closed.
   A discovered different full number requires physical/user confirmation when
   no clear printed full number supports it. Explicit confirmed/typed full-number
   requests disable discovery; text-only confirmations retain exact matching. This is reusable, not a Pikachu lookup exception.
3. **Unsupported damage became facts.** Previously an allowlisted bare defect
   code became a categorical “Visible…” statement. Legacy prose extraction and
   raw ratings also let speculative condition text imply a supported assessment.
   V2 requires side, normalized bounding region, code-specific visible cue,
   certainty and model support. Off-centering additionally requires border-ratio
   evidence. Bare/invalid/unseen-side findings are unassessable; localized but
   uncertain/obscured findings are suspected. Only qualified high-support findings
   become confirmed photo observations. Contradictions and duplicates downgrade.
   Evidence-derived ratings agree with explanations; missing/clean partial areas
   do not imply mint, PSA 10, or a grade projection. No new prose keyword filter
   is used to manufacture acceptable findings.
4. **Narrative authority.** Condition explanations are generated from the validated
   vocabulary and final catalog-supported identity. An unresolved proposal is
   labeled unverified, not displayed or copied/shared as a current factual card title. Raw AI
   interpretation stays in the labeled unverified disclosure. Candidate records
   are explicit and require confirmation before pricing. Saved/rehydrated reports
   use the same condition presentation and existing financial trust protection.
5. **Financial separation.** Unsupported photo defects do not change numeric gem
   probability/economics. Existing scenario probability is explicitly collector-
   input, uncalibrated modeling (`visionDefectsUsed: false`), not population data
   or a photo grade. Existing structural-risk vetoes, identity/variant gates,
   asking/sold distinction, comparable filters and Atlas withholding remain.

The upload pipeline is unchanged: browser HEIF/HEIC decode, orientation, bounded
resize/quality compression and front/back handling; server signature/Sharp
validation before model calls. A conversion can limit fine-detail visibility;
without the actual photos no quantitative before/after text/detail claim is made.

## Rarity versus artwork/printing

The bundled hash-pinned TCGdex source record
`data/Mega Evolution/30th Celebration/149.ts` at revision
`a211f11f3ba57d56c65c5ac33be35b77d3280757` explicitly has
`rarity: "Special illustration rare"` and a holo variant with the 30th-anniversary
stamp. Earlier holo correction is pinned to
`9f90a62ec32ec00cd4ca3059f5ee9d61eae85a1c` (prior
`46e7d514d534d38257914a5ffee54c17849f72c3`). Existing freshness/provenance
checks still independently validate these records; no snapshot/license changed.

“SIR” is the rarity; “Special Art” is normalized artwork; “Holo” needs explicit
printing metadata. The UI now labels catalog rarity separately from printing /
artwork. Rarity never supplies holo evidence. Reverse, normal, base, other art
and unsupported finish remain blocked. No physical rarity symbol/stamp on the
owner's card was inspected here; physical markings remain to be confirmed.

Official context (public documentation, not paid model calls):
- [Pokémon rarity-symbol explanation](https://www.pokemon.com/uk/news/pokemon-tcg-scarlet-and-violet-revamps-pokemon-tcg-card-aesthetic)
- [Official 30th Celebration Pikachu card article](https://www.pokemon.com/us/news/look-at-electrifying-pikachu-cards-from-pokemon-tcg-30th-celebration)

## Runnable cross-model benchmark

Production remains Claude Sonnet 4.6, temperature 0. Alternatives selected from
current official image-input documentation: OpenAI GPT-4.1 snapshot
`gpt-4.1-2025-04-14` and Google `gemini-3.1-pro-preview` (preview, temperature 1).
Model availability, quality and region/account access still require live checks.
No provider routing/replacement was added to the production application.

- [OpenAI GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1)
- [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision)
- [Gemini 3.1 Pro Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)

Default safe preflight (exit 2 / BLOCKED is expected):

```sh
node scripts/benchmark-vision.mjs --manifest benchmarks/vision.example.json --output /tmp/gp-vision-benchmark.json
```

The two example entries intentionally contain no photos, labels, consent or
prices. Supply an outside-repository private manifest with original/improved
images and independently reviewed labels; never relabel synthetic unit fixtures
as real. Additional real Pokémon/sports fixtures use the same schema. Sports
model proposals are benchmarkable; Pokémon catalog integration does not verify
sports cards. Each fixture needs image rights/consent reference, front file path
and SHA-256 (optional back), reviewed identity labels, reviewed image-visible
condition labels, assessable attributes and ground-truth reference. Identity
labels include subject/year/set/full number/language/printing/rarity.

Future execution requires separate explicit paid-call approval, dedicated
`VISION_BENCH_ANTHROPIC_KEY`, `VISION_BENCH_OPENAI_KEY`,
`VISION_BENCH_GEMINI_KEY`, allowed provider hosts, reviewed input/output token
rates and date, request limit and estimated-cost limit. Never print credentials.
Then, only after authorization:

```sh
npm run build
node scripts/benchmark-vision.mjs --manifest /private/reviewed-vision.json --live --authorize-paid-calls --output /private/vision-results.json
```

Requires local Playwright/Chromium. Preparation uses the actual built mobile
normalizer/HEIF handling and server image validation, blocks API/nonlocal browser
traffic, checks original hashes, and gives each model identical prepared image
bytes and the same production prompt without ground-truth hints. No image
bytes/raw provider responses are written to the result. Results contain selected
identity assertions, hashes, defect metrics, repeated-input versions, latency,
usage and token-rate cost estimates. Output permissions are 0600.

Measures exact identity fields, rarity separate from printing, raw false-positive
and missed defects, unsupported confirmed claims, condition/support consistency,
per-image repeat stability, confidence calibration, latency and cost. Raw false
claims are counted even when the application downgrades them. Mock transports
are always marked HARNESS_TEST_ONLY_NOT_MODEL_ACCURACY. Malformed/failing calls
are not counted as accuracy successes. Cost limits are post-response estimates
and can overshoot by one request; use provider account spend caps as well.

**Current result: BLOCKED, 18 requests planned, zero attempted, no model accuracy
result.** Original/improved photos, independent labels, consent, dedicated
credentials, rates/budget and explicit paid-call authorization are absent. A model
can still hallucinate coordinates/cues; this contract improves traceability and
abstention, not proof of physical damage. Changed-photo differences must be
reviewed against actual localized visual evidence. Synthetic tests cannot prove
that the same physical card is now reliably recognized in real photographs.

## Validation

Commands (no paid/provider traffic):

```sh
PHASE1_VALIDATION_OUTPUT=/tmp/gp-vision-phase1.json FRESHNESS_VALIDATION_OUTPUT=/tmp/gp-vision-freshness.json node --test tests/*.test.mjs
npm run build
npm run check:catalog-packaging
node tests/vision-reliability.smoke.mjs
node tests/variant-ui.smoke.mjs
TEXT_ONLY_SMOKE=1 node tests/variant-ui.smoke.mjs
node tests/live-report-integrity.smoke.mjs
IDENTITY_FIRST_SMOKE=1 node tests/live-report-integrity.smoke.mjs
node tests/mobile-upload.smoke.mjs
node tests/financial-consistency.smoke.mjs
node tests/scan-acceptance.smoke.mjs
PHASE1_VALIDATION_OUTPUT=/tmp/gp-vision-phase1.json node tests/phase1-validation.smoke.mjs
FRESHNESS_VALIDATION_OUTPUT=/tmp/gp-vision-freshness.json node tests/tcgdex-freshness.smoke.mjs
```

New tests cover wrong-denominator discovery, clear/uncertain/contradictory printed
readings, set-code conflicts, protected identity, bounded incomplete lookups,
unsupported/localized/obscured findings, off-centering measurements, unseen sides,
conflicting observations, rarity/finish separation, stable modeled financial
outputs, and rendered candidate/condition/rarity states. Existing synthetic positive
condition fixtures now supply explicit localized support; legacy bare-code/prose
cases test abstention rather than being silently treated as supported damage.

Final offline validation: **365 tests passed, 0 failed/skipped; production build
passed; pinned catalog/provenance regressions and snapshot/MIT-license trace
checks passed; all eight browser scripts plus text-only and identity-first modes
passed.** The benchmark's actual front/back HEIF preparation was also exercised
with the existing public libheif codec sample (not a Pikachu/model-accuracy test).
The integrated scan smoke made nine controlled mocked requests and retains its
OFFLINE_ONLY_NOT_LAUNCH_READY qualification. The build's optional external font
fetch warning does not invalidate the successful build.

Security review: no credential values found; no environment/dependency/deployment
configuration, Supabase setting, snapshot or license edits. Prediction trace has
no test/benchmark fixtures or benchmark provider code. Existing catalog hashes,
variant/market/saved-report trust and Preview authentication/isolation tests pass.
Trace inclusion is not a verified deployed artifact; no deployment was performed.
Real-photo accuracy/consistency, actual localized damage, physical markings,
current provider availability/response completeness and real cost remain unverified.

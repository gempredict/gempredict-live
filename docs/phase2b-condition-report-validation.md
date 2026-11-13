# Phase 2B: condition report validation

Base: e44ae4ab41dcf8352fdbb4ffaa4bb536c01357a9 on reconcile/iphone-upload-2026-11-03. No paid scan was repeated.

## Historical evidence preserved

The owner references Yamask scan b9a0cf4e-5222-4db5-a19d-b343a2f2a87d and reports three suspected back corner-whitening findings, one suspected back edge-whitening finding, unassessable front/back surface and front centering, resolution/perspective limitations, and financial recommendations withheld. This is retained in benchmarks/identity/supplemental/YAMASK-CONDITION-summary.json as an owner-reported historical diagnostic summary, not a retained raw diagnostic import.

The diagnostic file, photographs, literal coordinates, confidence values, raw model response, exact surface/centering defect codes and inspection coverage are not supplied here. None were reconstructed. Counts of unassessable findings not explicitly quantified by the owner remain unknown. Historical outcomes are not changed, independently verified or counted as accuracy results. Base/context revision is not claimed as the scan's deployment revision.

## Synthetic validation

The reusable tests/helpers/conditionReportFixture.mjs models only the requested categories/states. All coordinates, confidence values, cues, placeholder identity and unassessable surface/centering codes are synthetic test inputs. These values must never be attributed to the historical scan. No inspectionCoverage is supplied. The helper is explicitly separate from the historical summary.

Actual handler tests and React server rendering verify:

- Three separate suspected back corner findings and one suspected back edge finding survive, with distinct synthetic photo boxes.
- Front/back attribution remains explicit. Possible defect labels never become confirmed damage.
- Surface on both sides and front centering remain unassessable; no clean/pristine state is inferred.
- Resolution and perspective explanations appear in the report. Coverage remains unestablished with empty inspection regions.
- Unsupported legacy PSA estimates, numeric scores, PSA probabilities and submission advice are suppressed. Identity/printing status and financial withholding are unchanged.
- Save/JSON restore/revalidation retains all findings, sides, limitations and unknown coverage. Copy retains three corner entries, unassessable front/back entries, locations qualified as model proposals, and withholding.

The synthetic scenario is tested for both Pokémon and sports. It does not establish visual detector accuracy or authenticate any real defect location.

## One demonstrated presentation defect

Before this checkpoint, protectedCopySummary preserved scoped coverage limitations but omitted global imageLimitations. Therefore resolution and perspective appeared in the UI and saved JSON but vanished from copied reports. A regression first failed on this omission.

The only application change appends normalized global photo-limitation labels to the copied summary. It uses the already sanitized conditionPresentation result. No condition engine, deduplication, identification, financial eligibility, prompts, request counts, token limits, retries, authorization or UI layout were changed. Existing report rendering otherwise passed, so no other presentation changes were made.

## Representative rendered example

A standalone HTML review artifact is generated with the actual ImageAnalysisCard component and actual protection/restore functions:

/workspace/artifacts/gempredict-phase2b-synthetic-report.html

Its banner says OFFLINE SYNTHETIC EXAMPLE and explicitly disclaims reconstruction of Yamask. The report title is Synthetic condition fixture, not an invented exact Yamask identity. Companion files:

- /workspace/artifacts/gempredict-phase2b-synthetic-copy.txt
- /workspace/artifacts/gempredict-phase2b-synthetic-report.json

The HTML is static and requests no scripts, images, provider resources or external styles. Inline presentation styles give a readable representative two-column layout with a single-column mobile breakpoint; this is an offline review wrapper, not a production UI change. The synthetic JSON/copy are review artifacts outside the source repository. The committed helper and regressions retain reproducible inputs and assertions.

## Validation and limits

29 focused condition/report tests pass, zero failures/skips. The full suite passes 416 tests, zero failures/skips (413 prior plus three scenario regressions). Production build and all four snapshot/reviewed-source/reviewed-set/license packaging checks passed.

No new provider/marketplace request, paid service, production change, merge, force push or deployment. Handler tests replace external services with mocks, and the review example uses empty marketplace fixtures. No private benchmark files or raw diagnostic/photos are committed.

This validates normalization, rendering, copying and persistence contracts using synthetic input. It does not establish real-model accuracy, actual Yamask defect locations, complete photographic coverage, geometric measurements or a professional grade. The existing model-proposal/physical-verification distinction and fail-closed finance remain. Stop for review.

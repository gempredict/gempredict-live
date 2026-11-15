# Phase 2C: clean-region evidence investigation

Base 24afd423ed061cd327395c65c8806fe97fab20ae; historical Bryce Harper scan 7d06a979-d50a-4c29-8427-a3b7eb83afc6 ran revision e44ae4ab41dcf8352fdbb4ffaa4bb536c01357a9. No scan was rerun.

## Evidence and confirmed root-cause findings

The owner reports five no_defect_observed findings (front/back corners, front edges, front/back surface), all accepted into normalization but downgraded to unassessable with the old generic conflicting_or_insufficient_evidence reason; front centering had invalid localization/cue/measurement support, global perspective was present and financial outputs were withheld. Acceptance means accepted as an observation, not supported cleanliness or independently verified coordinates. The supplied summary does not contain the original JSON, exact locations, coverage, support confidence or individual causes. Preserve it in supplemental/HARPER-CLEAN-summary.json, without filling those gaps.

GitHub tree comparisons verify that lib/visualEvidence.mjs, lib/scanDiagnostics.mjs and lib/visionPromptContract.mjs are identical between the scan revision and investigation base. Thus reproductions against the unmodified base apply to the historical software path; they do not reconstruct the model response.

Before any edits, a synthetic valid localized clean observation produced:

- no coverage: confirmed;
- explicit valid coverage: confirmed;
- valid coverage plus global perspective: unassessable.

The global perspective rule is therefore a sufficient explanation for all five reported downgrades, even if other support was valid. It does not establish whether coverage was missing, rejected, outside scope, low support or another issue also existed in this scan. The retained diagnostic cannot distinguish those possibilities. No claim is made that Harper should have passed, that perspective was incorrectly reported, or that the card is actually clean.

Two additional reproducible software issues were established:

1. Clean observations lacked a mandatory explicit inspection-scope check. The old outside-scope condition applied only if any coverage region existed; zero coverage did not block a positive clean result. This is tightened, not relaxed.
2. A scoped limitation touching a large inspection region changed that entire region's status. Requiring inspected scope without retaining the original inspection proposal would wrongly invalidate clean findings outside the actual limitation mask. The correction separates reported region status from effectiveStatus, and still evaluates limitations against each finding's box. Reports/copies show the effective qualification. Partial inspection claims themselves do not become inspected coverage.

Diagnostics also matched the first same-attribute/code/side finding, irrespective of region and support. With mixed valid/limited clean regions this could attribute one region's disposition to another. Matching now includes sanitized evidence and reported certainty. The old generic code conflated true contradictions, missing coverage and photo limitations.

## Complete path

| Stage | Actual behavior and boundary |
| --- | --- |
| Prompt/transport | Existing full-scan visionPromptContract requests bounded visualObservations, inspectionCoverage, cues, confidence and global/scoped limitations. Claude fields are observations, not measured probabilities. JSON parse/truncation protections and request budgets unchanged. |
| Observation support | observationSupport validates supplied side label, bounded normalized image box, cue, confidence and conditional centering ratio. It does not authenticate physical corner position or geometry. Missing/invalid support is unassessable. |
| Coverage | readInspectionCoverage accepts only bounded rows/regions/statuses for supplied photos. Missing, rejected and partial-only scope cannot establish a clean region. No scope is inferred from absence of damage. |
| Limitations | Global quality flags conservatively constrain all findings; perspective is not silently restricted to centering. Scoped limitations constrain overlapping regions on the indicated side/attribute. Reported inspected scope is retained separately from its effective partial/unassessable qualification. |
| Clean decision | Confirmed model proposal, support >=0.8, explicit containing inspected region, valid localization, supplied photo, no relevant limitation, no conflicting evidence and no evidence overflow are required. Thresholds are unchanged. Clean proposals failing a requirement remain unassessable, with fixed reason codes. |
| Contradictions | Overlapping same-side clean/damage observations stay uncertain; independent front/back or nonoverlapping regions do not conflict just because their attribute matches. Distinct locations are retained. |
| Aggregation | Any unassessable finding keeps the category conservative. A category can remain Unable to assess while individual supported regional observations remain displayed; this is not loss of the original finding. |
| Rendering/persistence | Existing components list each qualified observation, side and proposed location, then coverage/limitations. Positive text applies only to the documented area and explicitly rejects mint inference. Save/restore and copy revalidate the same evidence. Financial/PSA/score suppression is unchanged. |

## Minimal changes and diagnostics

lib/visualEvidence.mjs enforces explicit clean scope and attaches fixed reasonCodes to retained findings. reportedCertainty remains separate from derived certainty. Region status remains the reported inspection proposal; effectiveStatus adds limitation/overflow qualification without discarding that original proposal. Old saved partial-only coverage is not reconstructed into an inspected region.

New reasons distinguish inspection_coverage_missing, inspection_coverage_rejected, inspection_region_not_inspected, outside_inspection_scope, global_photo_limitation, scoped_photo_limitation, invalid_localization_cue_or_measurement, photo_not_provided, support_confidence_insufficient, contradictory_observations and evidence-limit/unsupported-duplicate conditions. Privacy-safe owner exports retain these codes and bounded coverage field/type/count/scope summaries, not original coordinates, cues, photos, provider prose or confidence numbers. A field being returned is not proof its regions were accepted. Raw invalid coverage is not retained.

The existing App and copied summary use effectiveStatus where present, retaining legacy status compatibility. No new engine, model prompt, paid stage, identity/catalog/printing logic, financial eligibility, provider, probability, threshold or retry was added.

## Before / after synthetic behavior

| Case | Before | After |
| --- | --- | --- |
| Valid clean location, explicit containing inspected coverage, no limitation | Qualified regional clean | Same qualified regional clean |
| Valid clean location, no coverage | Could become confirmed clean | Unassessable; explicit missing-coverage reason |
| Invalid coverage rows | Could behave like absent coverage and accept clean | Unassessable; rejected-coverage reason |
| Explicitly partial-only coverage | Could accept clean when no limitation listed | Unassessable; region not inspected |
| Small inspected clean region | Could produce a clean label; not whole-card proof | Still only regional; aggregate coverage partial, wholeAttributeVerified false |
| Finding outside accepted scope | Unassessable | Same; specific outside-scope reason |
| Global perspective | All clean findings unassessable | Same conservative rule, explicit global-limitation reason |
| Scoped glare overlaps first box but not second | Scope qualification could obscure which part was inspected | First unassessable; second may remain regional clean with explicitly reported inspected support; exact mask applied |
| Overlapping suspected scratch / clean assertion | Clean unassessable | Same; contradiction code distinguished from missing evidence |
| Clean front, damaged back | Independent observations | Same, provided the clean front has explicit coverage |
| Missing/invalid location or cue | Unassessable | Same; explicit invalid-support reason |
| Multiple same-type findings with different results | Diagnostic could report the first region's result for each | Individual matching dispositions, findings retained |

No historical coordinates, full response, coverage or clean result were fabricated. Fixture coordinates and support confidence are explicitly synthetic; no real model accuracy is measured.

## Regression coverage and validation

Seven new tests group all requested scenarios: explicit valid scope, missing/rejected/partial scope, small-region/whole-card boundary, outside scope, global perspective vs localized glare, overlapping clean/damage, opposite sides, invalid/missing localization, multiple clean regions, both category handlers, rendered/saved/restored/copied results, diagnostic privacy/attribution, and withholding of grades/probabilities/scores/financial recommendations.

Earlier positive-clean tests now explicitly provide inspected scope instead of relying on its absence. Their rejection assertions remain; the existing generic glare diagnostic assertion now expects global_photo_limitation. The scoped-glare coverage test verifies effectiveStatus rather than conflating it with the original proposed status.

Full tests and production build/packaging results are recorded after validation. No paid AI or marketplace request, new deployment, merge, Production change or force push.

## Remaining risks and foil/glare recommendation

Keep global perspective conservative until independently retained photographs/diagnostics establish its scope. Do not declare that perspective affects only centering or that glare cannot hide corner whitening. Coordinates and cues remain model proposals; whole-card coverage, physical finish and authenticity are unverified. A clean result is never scratch-free surface, all-corners inspected, mint, or likely PSA 10. Old diagnostics cannot retrospectively recover per-region causes.

Next, validate the scoped masking contract offline on synthetic foil/reflection patterns and independently labeled photo regions: front/back separated, glare across/away from a finding, sleeve reflection vs print line/scratch, angled/cropped cards, and explicit unknown coverage. Require abstention for masked/unknown areas and no upgrade caused by foil appearance, confidence or catalog identity. Any later physical-photo trial needs separate owner authorization, retained prepared-image linkage and independent region review; it is not authorized or run here. Stop for review.

Validation completed: 46 focused tests passed; full offline suite 423 passed, zero failed, zero skipped (416 previous plus seven new). Production build passed with all four catalog/snapshot/reviewed-source/reviewed-set/license packaging checks. All identification, sports, HEIC, owner authorization, structured-output, printing/provenance and financial regressions remain in the passing suite.

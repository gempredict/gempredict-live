# Phase 2D: offline foil/glare evidence validation

Base 74b09cc0259d1c4d893041cb64842522e3cbb203, reconcile/iphone-upload-2026-11-03. No physical-card scan, paid call, marketplace request or deployment occurred.

## Evidence scope

All cases use synthetic observation/coverage records, synthetic coordinates, self-reported support confidence and mocked JPEG/provider transport. No independently annotated real foil photographs are available for this milestone. Existing private card packages do not establish independent optical annotations and were not repurposed as ground truth. These tests validate software decisions and presentation, not whether a model can detect scratches, distinguish foil patterns or see defects through reflections. No historical scan output was rewritten.

## Masking audit

1. Existing prompts request bounded observation codes, sides, boxes, cue/support and inspection coverage. Full scan still uses the existing bounded JSON parser and evidence sanitizer; no new optical detector or model pipeline.
2. visualEvidence.readInspectionCoverage accepts only supported photos, valid normalized image boxes, bounded inspected/partial/unassessable proposals and known limitation codes. Original region status and effective limitation-qualified status remain distinct. Whole-attribute verification stays false.
3. readVisualEvidence applies a scoped limitation only to overlapping finding boxes on the same side and attribute. Null limitation region constrains the whole indicated side/attribute. A scoped surface mask is not automatically a mask for all other attributes: the evidence producer must identify affected scopes, or use a conservative global limitation when extent is unknown.
4. Global perspective, blur, glare, sleeves, resolution, cropped and occluded flags remain conservative across supplied photographs. No global flag is silently downgraded to a local mask or ignored because the model is confident.
5. Qualified regional clean observations require explicit containing inspected scope, accepted localization/cue, unchanged support threshold, no relevant limitation and no contradiction. They establish no whole-card cleanliness, scratch-free face, authenticity or professional grade.
6. A suspected scratch inside glare remains a possible, unconfirmed observation, not established damage; the scoped limitation remains in evidence/report. A clean assertion overlapping glare is unassessable. Findings outside an explicitly visible inspection region are unassessable. No new certainty threshold was introduced.
7. Reports retain source side, proposed boxes, coverage, limitations, original reported certainty and final disposition. Saved/restored/copied reports revalidate the same records. An aggregate Unable to assess badge may coexist with a possible-damage observation where overlapping clean evidence is unresolved; this preserves uncertainty rather than erasing the observation.
8. Geometry and physical-printing verification remain false. Model support confidence is not an authenticated scratch detector or calibrated grade probability. If a model mislabels a reflection with a valid scratch cue and high support, these consistency checks alone cannot independently detect that visual error.

## Synthetic matrix: observed results

The matrix is implemented in tests/helpers/foilGlareFixtures.mjs and tests/foil-glare-evidence.test.mjs. Each case is checked through direct normalization and both Pokémon/sports handlers, actual report SSR, JSON save/restore and copy. Distinct findings retain their own locations.

| Case | Result | Qualification |
| --- | --- | --- |
| Reflective foil with no established scratch; clean proposal inside reflection mask | Unassessable | scoped_photo_limitation; no scratch invented from foil/reflection note |
| Suspected scratch inside glare | Suspected | Scoped limitation retained; possible scratch only, not confirmed damage |
| Suspected scratch in visible region away from glare | Suspected | Unrelated mask does not attach a limitation to this finding |
| Two suspected scratches, only first overlapping reflection | Both retained as suspected | Only first has scoped_photo_limitation; both locations survive |
| Clear back; front clean proposal obscured by glare | Front unassessable, back qualified regional clean | Back needs its own explicit coverage; no entire-card clean inference |
| Sleeve reflection / possible print line | Suspected print line | Sleeve mask retained; no scratch or authenticity inferred |
| Angled card / uncertain centering | Suspected off-centering proposal | Global perspective retained, geometry unverified, no independent measurement |
| Cropped corner | Suspected whitening | Cropped-area limitation retained; corner location is a model proposal |
| Obscured corner outside visible inspected scope | Unassessable | outside_inspection_scope plus scoped limitation |
| Missing clean inspection coverage | Unassessable | inspection_coverage_missing; no coverage fabricated |
| Overlapping clean / suspected damage assertions | Clean unassessable, damage suspected | contradictory_observations; category remains conservative |

Additional checks exercise each global limitation across front/back, and reject foil_pattern cues with confidence 1 for both scratches and clean assertions. Invalid cue support cannot become an authenticated optical finding. These are rejected mocked cues, not a real foil-pattern classifier.

## Confirmed defect and minimal correction

A new regression failed before the fix: a suspected scratch overlapping scoped glare had reasonCodes=[scoped_photo_limitation] internally, but its owner export returned reasons=[] because the diagnostic observer emitted actual reasons only when certainty changed. The finding was already suspected, so downgraded=false even though glare was relevant. A second suspected scratch outside the mask correctly had no reason.

Only lib/scanDiagnostics.mjs application behavior changes: export actual sanitized decision reasons when present, regardless of whether certainty changed; use the generic fallback only for unexplained certainty changes. accepted/result/downgraded retain their distinct meanings. Unchanged certainty is not equivalent to no relevant limitation. Exported reasons are fixed codes from the existing sanitizer, not raw prose, locations, cues, images or credentials.

No masking, classification, deduplication, coverage, localization, condition threshold, optical logic or report layout change was justified. No identity/catalog/parallel/provenance, financial eligibility, SDK/model, paid request count, no-retry behavior or token budget changes. Package script changes only ensure new tests run during the existing build checks.

## Validation

37 focused foil/diagnostic/clean-evidence tests passed, zero failures/skips. Full suite: 438 passed, zero failed, zero skipped (423 prior plus 15 new tests). The matrix includes 11 direct case tests plus global-limit, invalid-cue, complete-handler/report parity and owner-diagnostic tests. Full production build and all four snapshot/reviewed-set/reviewed-source/license tracing checks passed. Existing HEIC, identification, printing, financial, structured-output and Preview authorization regressions remain passing.

The test harness uses 22 mocked category/scenario handler calls; these are not real scans or optical accuracy trials. No paid request is silently retried or used as fallback. Full-scan output caps remain 3200 front / 4800 dual-photo; identity-only cap remains 2000.

## Protocol for one later owner-authorized real foil-card validation

This protocol is a recommendation, not authorization to run it now.

1. Select one physical foil card. Record independently reviewed core identity if available, but leave exact finish/parallel unresolved where evidence is incomplete. Do not use catalog rarity as proof of foil, condition or printing. Do not select a card solely because its prior scan seemed favorable.
2. Before viewing AI output, inspect the card independently under diffuse and raking light. Record visible regions and limitations for front/back; use a loupe or independent close-up where necessary. Separate a physically corroborated mark from a reflection/foil pattern and from an area that cannot be assessed. Record reviewer/method and unresolved judgments. A second reviewer, blind to the AI result, is preferable; a single owner's inspection must not be labeled independent expert ground truth.
3. Retain a front/back diffuse-light pair intended for the one full-analysis request. Capture additional angle/close-up reference photographs for independent review only, not additional AI calls. Avoid sleeves when safe; document any sleeve, glare, crop, angle or inaccessible area. Never alter a card or lighting to hide a mark.
4. Save original selected photo bytes privately. Before submitting, arrange capture of the EXACT prepared JPEG File/buffer bytes actually attached to that request. Save original/prepared files separately; compute SHA-256, dimensions, orientation, conversion record and side association for each. Browser screenshots, chat-exported JPEGs, or newly reprocessed copies are not substitutes for the uploaded bytes. If the existing client cannot retain those exact prepared files through an approved local capture method, establish that capability before authorizing the paid attempt or mark linkage/scoring blocked; do not invent hashes or reconstruct matching preparation later.
5. Independently annotate inspection/visibility regions relative to the retained prepared-image coordinate frame, with a documented mapping to originals/reference close-ups. Record glare masks and uncertainty separately from defect labels. Distinguish model assertion, observer judgment and physically corroborated defect. Freeze the reference notes before comparison with the AI report.
6. Owner confirms the exact nonproduction Preview revision/branch, deployment protection and authorized diagnostics, then authorizes one full-analysis request for that front/back pair. No automatic retries, duplicate scans, paid re-analysis or marketplace expansion. Preserve financial withholding and the separate photo-condition/identity statuses. Before authorization, verify a Preview configuration that prevents marketplace calls for this condition-only validation. If the existing full-scan path cannot meet that restriction, treat it as a preflight blocker requiring separate review, rather than promising a marketplace-free run. A technical failure is recorded as that attempt, not silently replaced.
7. Retain the original exported diagnostic, ordinary report where available, screenshots, saved/restored output and copied summary privately. Match scan ID/revision and both diagnostic preparedSha256 values to the actual retained prepared-file hashes. Check dimensions and side linkage too. Manifest hashes prove package integrity only; they do not establish photo-to-scan linkage without request-bound matching evidence.
8. Compare per finding: source side, proposed region, visibility mask, suspected vs supported regional clean vs unassessable, preserved independent limitations, contradictions, and missing inspection coverage. Confirm front glare did not invent back findings. Confirm grade/score/probability/advice/finance remain withheld after save/restore/copy. Record disagreements and abstentions without retroactively changing the model output or reference label to agree.
9. Report this as one descriptive physical-card validation with linkage status and reviewer limitations, not statistical accuracy or a PSA prediction. No whole-card clean assertion follows from a small clear patch. Missing linkage or ambiguous reference observations block accuracy scoring.

Remaining gaps: no optical foil/scratch classifier, pixel segmentation, independently verified card geometry, complete inspection coverage or calibrated professional grade model. These tests cannot remove them. Stop for review before any live validation.

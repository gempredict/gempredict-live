# Phase 2A: qualified, lossless condition evidence

Base: 3f68d134c87b2d77dc97a29aff2de3741095472b. This is an offline software-contract milestone, not a measured defect-detector accuracy result or professional grading system.

## Repair scope

Both full-scan categories now call the existing conditionPresentation at normalization, and financialSafety applies it irrespective of whether identityVerification exists. Previously sports could bypass this boundary and retain legacy PSA estimates, numeric condition scores and rating defaults. Save/restore/render/copy paths revalidate through the same boundary. Unsupported grade estimates, ceilings, overall scores, financial confidence, PSA 9/10 probabilities and grading/submission advice remain null/withheld. No score is converted into a probability. The independent financialEligibility decision, identity/printing rules and all Phase 1 identification modules are unchanged.

The sports full-scan prompt now requests condition observations/coverage instead of legacy ratings and grade guesses; its identity fields/instructions are retained. Pokémon asks for the same coverage extension. Identity-only JSON schema, SDK, model, prompts and token cap are unchanged. Existing full-scan request count and 3200 front / 4800 dual-photo output caps are unchanged, as is no-retry behavior. No separate condition endpoint, parallel engine, marketplace call or new provider was added. Extra coverage text adds unmeasured input/output demand; capped/invalid output remains rejected, never repaired or retried.

Owner diagnostics still see pre-normalization model metadata and localized evidence via existing authorization. New coverage is recognized as an expected field. Original certainty is retained as reportedCertainty separately from downgraded certainty; it never authorizes a finding. This checkpoint does not export raw model responses, grades, photos or new credentials.

## Contract extension: existing visual evidence version 4

Retain visualObservations with attribute/code/certainty and evidence.side/region/cue/confidence/optional measurement. Existing confidence thresholds are support policies, not calibrated detector or grade probabilities. Region coordinates are normalized IMAGE coordinates, not authenticated card geometry.

inspectionCoverage is bounded to eight rows (two sides x four attributes). Each row has attribute, side, at most four regions {region:[x,y,w,h], status:inspected|partial|unassessable}, and at most four limitations {code,region:box|null}. Allowed limitation codes reuse glare, blur, sleeve, limited_resolution and back_not_visible, adding perspective, cropped and occluded. A null limitation region means the entire indicated side/attribute is limited. Global legacy limitations remain conservative across findings; their scope is never invented.

Only actually supplied sides are available in the handler; the model cannot add a back by returning inspectedSides. Invalid boxes, unknown attributes/statuses and unsupported side coverage cannot establish inspected regions. Findings outside explicitly reported inspection scope remain unassessable. Legacy records without coverage keep empty regions; old inspectedSides may document available photos, but do not prove inspection coverage. Missing side metadata does not default to front.

Derived coverage always contains the eight side/attribute slots, with partial or unassessable aggregate status, a reason, model-observation basis and wholeAttributeVerified=false. A region may be reported inspected, but never establishes the entire surface, perimeter or all corners as clean. Overlapping limitations downgrade inspected regions to partial. Unassessable regions remain unassessable. There is deliberately no automatic whole-card pristine/mint state.

The existing 32-observation sanitizer bound is retained. Exceeding that bound, eight coverage rows or four regions/limitations per row produces a persistent conditionEvidenceLimits warning and unassessable retained findings; overflow cannot silently hide a late limitation and preserve a confirmed clean claim. The bounded prefix is retained, not presented as exhaustive. Full raw over-budget input is not stored.

CenteringGeometryVerified and localizationVerified are always false. CenteringMeasurementStatus is unavailable or unverified_geometry. Valid model ratios retain axis/ratio as proposals, but cannot establish a confirmed measured off-center finding; ratios are not displayed as independent measurements. Unknown measurement remains unavailable. A model-supplied claim of pixel verification is discarded. No geometric detector or calibrated measurement was invented in this checkpoint.

## Finding preservation and contradictions

Deduplication now uses the complete sanitized finding: attribute, code, side, region, cue, support confidence/measurement and reported certainty. Only identical observations collapse. Different corner-whitening locations, separate edge chips, multiple scratches and independent front/back findings survive; last-row wins is removed.

Clean/damage contradictions are downgraded where their boxes overlap on the same photograph and attribute. Nonoverlapping regions or opposite sides are not contradictory merely because an attribute matches. Conflicting certainty for overlapping same-code claims remains uncertain. Unsupported duplicate evidence stays conservative. Defects and clean observations remain distinguishable, and no uncertainty is promoted during restore/revalidation.

Reports show each finding's source side and proposed photo box; coverage and limitations are separate. Localization is explicitly described as model-proposed, not independent physical verification. Existing layout is preserved; the misleading PSA 10 Risk Factors label is now Photo Inspection Concerns. Copied summaries include findings, certainty, cue, locations, scoped coverage/limitations and the geometry qualification. Saved reports preserve the same normalized data and withholding.

## Synthetic before/after examples

| Fixture | Before | After |
| --- | --- | --- |
| Sports response estimatedGrade=PSA 10, overallScore=10; no localized evidence | Could survive sports report path | Both null; observations unassessed; advice/finance withheld |
| Two front corner-whitening boxes [.01,.01,.1,.1] and [.8,.8,.1,.1] | One overwrote the other and could become suspected | Both distinct locations retained; exact duplicate collapses |
| Front clean area, back whitening | Separate findings | Preserved separately, no new conflict |
| Same front area clean and scratched | Conflicting claims | Both retained, neither confirmed |
| Front glare [0,0,.4,.4], scratch at [.8,.8,.1,.1], clear back | Only global quality limitation available | Scoped glare qualifies overlapping finding; distant/front and back findings remain distinct |
| Small clean surface patch; front only | Clean label with no coverage structure | Reported-area-only clean observation; front partial; back unavailable, never inferred clean |
| Unmeasured centering or self-declared verified 65/35 | Model ratio could pass support policy | Missing measurement unavailable; model ratio unverified geometry, not a precise physical measurement |
| Legacy saved good/excellent rating or PSA score | Some paths retained it without localized evidence | No reconstructed findings or coverage; grade/score withheld |

The test harness supplies synthetic JPEG buffers and mocked responses. These are not real-card observations, real optical measurements or new historical scan attempts. Existing historical records/private packages remain unchanged and ignored by Git.

## Validation

Full offline suite: 413 passed, zero failed, zero skipped (401 prior tests plus twelve new condition-evidence tests). Two old condition assertions were updated for intentional changes: unlocalized legacy good no longer survives protection, and the original sports surface note remains as a secondary model note while the primary note is generated from qualified findings. Their identity, provenance, financial and rejection assertions remain intact.

Tests cover missing backs, explicit scope, malformed regions, two same-type locations, exact duplicates, opposite sides, conflicting claims, localized glare, global sleeve/blur/resolution/perspective, unmeasured/forged measured centering, malformed/over-budget coverage, legacy and complete-handler report parity, side-claim enforcement, render/save/restore/copy, financial withholding and unchanged printing protection. All existing sports/Pokémon identification, structured-output, HEIC, Preview authorization and diagnostics regressions run in the same suite.

Production build passed, including all four catalog snapshot/reviewed-source/reviewed-set/license asset tracing checks. No paid calls, subscriptions, deployment, merge, force push or Production configuration changes.

## Deferred deficiencies and review gate

- No real optical defect detection or localization accuracy measured; boxes and cues remain model assertions. confirmed is a model-evidence consistency state, not independent authentication.
- No independent card-boundary/perspective rectification, per-corner/edge geometry verification, uncertainty-calibrated border measurement, millimeters or professional grade distribution. Central-image boxes cannot be independently authenticated as corners; the UI never claims they are.
- Coverage remains explicitly partial/unassessable; automatic complete inspection is intentionally unavailable. Model inspection claims can be incomplete or wrong. Still photos cannot establish absence of dents, scratches or sleeve-hidden damage.
- Global limitations in old records are not retroactively localized; no historical observations are rewritten. Region scope is rectangle-based, not pixel segmentation; overlapping clean/damage evidence stays conservative.
- Full scans still combine identity/condition and use the existing bounded JSON parser plus evidence sanitization. This checkpoint adds neither a separately paid condition stage nor API-enforced condition schema. More coverage can increase truncation risk at the unchanged cap.
- Raw oversized provider responses are not persisted; bounded retained findings are unassessable with a warning. Source images and raw response storage policy are unchanged.
- No condition-to-PSA mapping, professional grading probability, condition score, grading economics or valuation integration.

Stop for review. A future milestone should validate region/coverage behavior against independently labeled physical close-ups before introducing geometric measurements or a separately authorized condition request. Catalog identity must never dictate visual condition or open the financial gate.

# Photo condition audit and targeted repair

Base: 315d9770923e9e513780f56e977beb8b7570806e.
No live model response was available for this checkpoint. The latest screenshot
symptom cannot establish what the model returned. Findings below are demonstrated
from source and offline full-handler regressions, not a reconstructed real scan.

## Complete pipeline and verified defects

1. Mobile front/back selection, HEIC conversion, byte validation and multipart
   parsing associate the first image with front and the optional second with back.
   The server sets `inspectedSides` from received validated images, not model claims.
   These controls are unchanged. The vision content now explicitly captions each
   Pokémon image as front/back; sports content is unchanged.
2. The Pokémon prompt requested both structured localized observations and legacy
   category ratings/notes. Normalization retained only recognized structured cues
   in its final condition presentation, replacing legacy notes even when useful.
   The prompt now prioritizes observations, limitations and side-specific qualitative
   notes, explicitly forbidding category grades and grade/financial forecasts.
3. `normaliseImageAnalysis` calls `conditionPresentation`; the financial report
   boundary calls it again. The defect was not financial eligibility suppressing
   condition analysis: the presentation function itself discarded qualitative
   notes and intentionally returned no grade rating for clean inspected areas.
4. `ImageAnalysisCard` previously used the null grade rating as “Unassessed” even
   when `conditionAssessments.state` established `no_defect_observed` or a suspected
   defect. It now renders evidence states rather than inferring a grade.
5. The same attribute's clean front and defective back were treated as contradictory
   by `readVisualEvidence`. Conflict handling now compares same-side assertions.
   Same-side clean/defect conflicts remain conservative and uncertain. Unknown-side
   duplicate rejection, evidence localization, cue/measurement and confidence
   requirements are unchanged.

6. A structural-damage presentation could return `worthGrading:false` after the
   financial boundary had cleared it. Condition presentation now always leaves
   submission advice null while retaining the visible structural-damage warning.

## Resulting contracts

- Supported structured cues remain localized observations, never numeric grades.
  Each displayed finding keeps its supporting photograph when established.
- “No visible defect detected” is limited to the documented inspected area; it
  does not imply mint condition, complete visibility or authenticated printing.
- Missing or unsupported evidence remains “Unable to assess.” Glare, blur, sleeve,
  insufficient resolution and absent back limitations remain visible. Global
  quality limitations are conservatively applied because no reliable region-level
  visibility contract exists.
- Safe qualitative legacy notes and new `photoNotes` survive as separate
  `modelPhotoNotes`, explicitly labeled unverified. Legacy side is unknown; no
  side is inferred from prose. Notes claiming an unprovided side are excluded.
  These notes never confirm a defect or override structured evidence. Financial,
  identity, grading, precise measurements and confidence prose is excluded.
- Normalization/revalidation is repeatable: generated notes are not relabeled as
  original model notes. Saved reports retain notes and evidence without financial
  authorization. Old reports cannot recover qualitative fields already discarded.
- Canonical titles, original AI identity observations, catalog/provenance/variant
  checks, financial eligibility, sports matching and HEIC conversion are unchanged.

## Offline validation

Nine new full multipart-handler and actual React report-rendering regressions
cover clean front/back evidence, retained qualitative notes, absent observations,
front-only/unprovided-side claims, insufficient resolution and glare, suspected
findings, contradictory same-side assertions versus independent sides, unsupported
centering measurements, saved-report safety, and structural damage without submission advice. All images and responses are
mocked. The build includes these tests through the existing Pokémon test script.

The precise reason the latest live response lacks localized observations remains
unknown without that response. This repair prevents the demonstrated code losses;
it cannot guarantee that a future model response supplies sufficient inspection
coverage. No live request, paid provider call or deployment is part of this work.

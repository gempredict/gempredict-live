# Phase 5Q owner benchmark workflow

Run `npm run benchmark:accuracy` to reproduce the checked-in scorecard. The original identity benchmark and controlled diagnostic commands are still available. Phase 5Q adds no inference calls and leaves application scoring unchanged.

1. Copy the existing manifest into `benchmarks/identity/private/`. Retain one slot per physical card. Record independent sources and reviewer/date for each core and variant label. Leave unsupported fields unreviewed. Record SHA-256 digests of the exact prepared card-only front and back images as `retained_and_reviewed`. Keep source photographs and receipts private.
2. Maintain a private labels JSON object keyed by manifest card ID. Each `blindReview`, `printingReview`, `conditionReview` and `gradingOutcome` is a separate review object. Include `status: "independently_reviewed"`, `reviewer`, `reviewedAt` (ISO date), a private `evidenceReference`, `physicalCardId` and `photoHashes` with `front` and nullable `back`. The reviewer must explicitly link the exact photos to the same physical card. Keep an independent PSA outcome in `gradingOutcome` with `service: "PSA"` and integer `grade`; never use the grade as the condition annotation.
3. For `conditionReview.regions`, use `attribute` (centering, corners, edges, surface), `side`, agreed location code, `state` (defect, clear, uncertain) and optional limitation codes (e.g. glare). Mark unassessable regions explicitly. A missing prediction counts as abstention on a reviewed region. Other regions have no measured truth.
4. On the final prepared bytes, inspect for grade or slab labels and identifying metadata. Review labels must attest `cardOnlyPixels: true`, `metadataStripped: true`, and `gradeOrSlabVisible: false`. Set `identityAssessable: false` only where the reviewer confirms the image itself is unsuitable for identification. `node scripts/identity-benchmark.mjs blind-input --manifest ... --labels ... --card ... --front-file ... --back-file ... --output benchmarks/identity/private/packet` checks byte digests and writes generic front/back filenames and a hash-only manifest. Omit back only when unreviewed and unused. The script checks linkage and attestation; a human checks the pixels and metadata. Submit image bytes only with a fixed, neutral prompt, and keep review files away from the operator doing predictions.
5. For a separately authorized trial, import its retained diagnostic using the existing import commands and record the request-time prepared hashes and scan ID. In a private copy of the sanitized observation, add `calibration` containing `arm` (baseline/challenger), `model`, `modelVersion`, `promptRevision`, `imagePreparation`, the packet `input` JSON, and truth-blinding attestations `truthVisible: false`, `usedOnlyBlindInput: true`. Use one cohort ID for paired comparisons. Number attempts starting at one per card/arm and use unique scan IDs. Add optional `identityAbstained`, `condition` region observations, and `gradePrediction` (`service: "PSA"`, numeric `grade`, optional `psa10Probability` in [0,1]) only from retained predictions. Use the existing `cost.actualUsd` and `latencyMs` fields, with unknown costs left null.
6. Run `npm run benchmark:accuracy -- --manifest ... --labels ... --observations ... --output benchmarks/identity/private/results`. The JSON contains trial-level outcomes and matched-arm results. Calibration uses distinct primary cards with retained first attempts. Grade error requires at least 30 pairs; PSA 10 reliability additionally requires at least five observed 10s and five other grades, with small buckets suppressed. These are reporting floors rather than a validation claim.

A catalog-supported identity does not establish exact physical printing or a PSA outcome. Preserve original errors and publish only redacted aggregates with owner authorization.

## Private owner review in Accuracy Lab

Open `/accuracy-lab` on the protected Phase 5Q.1 Preview and authorize with
the existing owner diagnostics key. The branch must have Preview Scan
Diagnostics enabled and its existing owner and signing keys configured.
The lab opens the twelve frozen slots and can add up to ten new slots in
one private packet. Leave the tab open while reviewing several cards.

1. Select a slot and enter core identity and printing evidence. For
   independently reviewed claims, use a manufacturer checklist or an
   independent catalog record that actually supports the entered fields,
   plus a reviewer code, private evidence reference, and review date.
   Owner-reported and draft assertions are excluded from scoring.
2. Select a front and back image. Crop slab labels, grade markings or
   other answers out before selecting the photos. Review the prepared
   previews and attest to the card-only pixels and metadata removal.
   A JPEG is re-encoded locally and hashed after preparation. Only the
   hashes and review fields reach the application endpoint.
3. Annotate visible condition by side, attribute and region. Mark a
   finding uncertain where the photo cannot resolve it. Use the same
   region codes in trial predictions. Record an observed PSA outcome
   separately, using its own private evidence reference.
4. Download the private review packet and each reviewed JPEG. Keep a
   private folder per slot so identically named `front.jpg` and `back.jpg`
   files cannot be mixed. Keep private evidence references with the review
   packet, away from blind trial inputs. The lab does not retain drafts
   after navigation or owner-session expiry, and exports are not imported
   back into the browser.
5. Download the redacted scorecard separately if sharing coverage. It
   contains aggregate counts only. Review coverage does not measure
   model accuracy.

The server validates completeness and linkage, while the reviewer is
responsible for checking that the cited evidence is independent and the
photo pair is the same physical copy. An owner assertion or attestation
alone cannot fill an independent source requirement. No provider call
is made during review or export.

From the repository root, keep the downloads under the gitignored
`benchmarks/identity/private/` directory with restricted permissions.
The Phase 5Q CLI accepts the downloaded packet directly:

```bash
node scripts/identity-benchmark.mjs blind-input \
  --review-packet benchmarks/identity/private/gempredict-private-review.json \
  --card GP-ID-001 \
  --front-file benchmarks/identity/private/GP-ID-001/front.jpg \
  --back-file benchmarks/identity/private/GP-ID-001/back.jpg \
  --output benchmarks/identity/private/trial-input

npm run benchmark:accuracy -- \
  --review-packet benchmarks/identity/private/gempredict-private-review.json \
  --output benchmarks/identity/private/review-scorecard
```

The blind-input command rehashes the actual downloaded bytes. Submit only
those exact prepared bytes to a separately authorized blind trial. Keep
the private packet and observed grade out of the prediction inputs.
Without separately linked blind observations, the scorecard reports
coverage with zero measurable trials. When such observations are
available, pass them privately with `--observations`.

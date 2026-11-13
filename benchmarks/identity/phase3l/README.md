# Phase 3L — controlled reference-pair validation

Baseline: `2e7f53177d7118d875943eee69a3ef45d42a1140`. Manifest version 1; cohort `phase3l-reference-pair-v1`. **Both real-card tests are NOT RUN.** No real photographs were provided for this session. Historical fixtures and synthetic software tests do not establish real-card accuracy. No paid model or marketplace requests were made; actual session spend is zero. Expected future request cost is unknown.

## Reference evidence

`manifest.json` records owner-supplied Fraxure (2019 Unified Minds 155/236 reverse holo) and Konnor Griffin (2024 Bowman Chrome Prospects BCP-86 Mojo Refractor) assertions individually. They have not been independently reviewed here. Language, autograph/relic, serial-number and print-run details remain unknown. Do not fill them from a fixture or from the scan being evaluated.

The historical Fraxure summary reports TCGdex `sm11-155`; this is a historical reference, not newly retained independent evidence or verification of the physical reverse-holo finish. No independent sports checklist reference is retained. Correct model text and runtime catalog support are distinct from independently verified physical printing. Generic “Mojo” is insufficient; base, ordinary refractor and differently named Mojo parallels are not accepted as Mojo Refractor.

`baseline/SCORECARD.md` and `baseline/scorecard.json` are reproducible empty-run reports. All identity dimensions are NOT TESTED, condition accuracy is NOT TESTED, and no aggregate accuracy percentage is calculated.

## Existing infrastructure reused

- `scripts/identity-benchmark.mjs` and `lib/identificationBenchmark.mjs`: existing identity manifest, sanitized observation and offline benchmark contracts. The CLI now supports a controlled full-diagnostic import and reference scorecard; historical identity-stage import behavior remains available.
- Existing historical Fraxure and sports fixtures: regression material only, not real scan successes.
- `src/App.jsx`, `lib/mobileImages.mjs` and the existing upload path: iPhone HEIC preparation and normal JPEG handling. No second scanner, image converter or model call was added.
- `lib/preparedValidation.mjs` and `ControlledValidation.jsx`: exact prepared JPEG exports, front/back digest verification, frozen file selection and one-use submission. Added visible unknown-cost disclosure and a separately required spending acknowledgment, reset on a new preparation.
- Existing `/api/scan-diagnostics` owner authorization and encrypted expiring diagnostics: unchanged. Owner session remains bound to the immutable protected Preview hostname/revision, with existing 15-minute session and 5-minute diagnostic-ticket expiry.
- `lib/conditionValidationServer.mjs` and `pages/api/predict.js`: existing controlled Full Analysis route; validates both prepared images and skips marketplace/valuation work. Existing dual-image budget is 4,800 maximum output tokens; SDK retries remain zero. Ordinary Analyze/Identify actions are not substitutes for this route.
- Existing condition evidence, completed-sales qualification, active-listing screening and financial gates: unchanged. The new offline scorecard never authorizes financial output.

## Controlled iPhone procedure — requires later owner authorization

**Stop before the paid submission in this milestone.** No real scan has been authorized or initiated by this implementation work.

1. Independently inspect each physical card before scanning. Assign a private physical-card ID. Retain clear original front/back photographs and independent card/checklist references, recording what each source actually supports. Record an owner-approved condition reference separately: front/back, corners, edges, surface, centering, localized observations and visibility limitations. Missing or uncertain observations must remain unknown. Do not use model output as its reference.
2. Open the immutable protected Preview for the committed revision, authenticate with the existing owner diagnostic controls and use **Owner-only controlled card validation**. Select the physical card's front/back iPhone files through the existing preparation path. Do not press the ordinary scan buttons.
3. Freeze the pair. Privately save the exact exported prepared front JPEG, back JPEG and prepared manifest. Reselect each exported file for verification. Keep originals linked privately to these prepared files and the physical-card ID; the software cannot prove this physical-card/original linkage for the owner. Do not replace prepared files with originals, screenshots or newly resized images.
4. Record the unknown request cost and obtain the owner's explicit authorization for this one request. Only then acknowledge spending and press **Run controlled Full Analysis once**. No automatic retry is permitted. After a failure, stop, retain evidence and review; do not initiate another attempt merely to get a passing result.
5. Promptly download the owner diagnostic export and retain report screenshots privately before ticket expiry. Preserve the raw downloaded diagnostic unchanged. Check revision, attempt ID, both prepared digests and `marketplace: not_requested`. A status code alone does not prove paid-call counts, cost or condition accuracy. Retain an independent audit source if counts/costs are to be reported as known.
6. Make a private copy of `review-template.json`. Fill case ID, physical-card ID, reviewer, review date, manifest version and both actual prepared hashes; approve only after checking the linkage. Leave costs/counts unknown without retained audit evidence. Before assessing condition accuracy, retain a separate pre-scan `referenceAssessmentId` and post-scan `adjudicationId`, bind the latter to the raw diagnostic SHA-256, and explicitly approve the human comparison. Category PASS/FAIL is a human adjudication, not automated optical validation.
7. Import privately with the command below. Inspect original model and canonical results separately. A material wrong set, number or parallel remains FAIL even if subsequently corrected. Missing independent support, original fields absent from the diagnostic and unknown physical attributes remain unresolved. Retain any proposed engine fix for a separate review.

```sh
node scripts/identity-benchmark.mjs import-controlled \
  --input /private/diagnostic.json \
  --prepared-manifest /private/prepared-manifest.json \
  --front-file /private/exported-front.jpg \
  --back-file /private/exported-back.jpg \
  --review /private/owner-review.json \
  --card GP-3L-FRAXURE --id FRAXURE-ATTEMPT-1 --attempt 1 \
  --output benchmarks/identity/private/phase3l-fraxure-attempt-1
```

Use `GP-3L-KONNOR` and a distinct attempt/output directory for sports. Paths above are placeholders. The output directory must be new and inside the ignored private benchmark directory. The importer reads the actual JPEG bytes, validates their decoded dimensions, size and SHA-256 against both manifest and diagnostic, and writes only sanitized `attempt.json`, `scorecard.json` and `SCORECARD.md`. It does not copy photographs or expose image endpoints. Never commit private inputs, outputs or owner references.

```sh
npm run benchmark:reference
```

This regenerates the public empty-run baseline. `scorecard --observations` can summarize saved observations into a new private output directory, but serialized hashes or `preparedPairVerified` flags cannot establish fresh eligibility: re-import the actual retained JPEGs, manifest, diagnostic and owner review to produce a scored real attempt. Duplicate scan IDs cannot count as separate attempts.

## Confirmed gaps and proposed follow-up

- No real-card evidence is available in this session. Identity, physical-printing and condition accuracy cannot yet be measured. No model defect or engine correction is established.
- Full diagnostics do not retain exact condition coordinates or all canonical finish/autograph/serial fields. The scorecard preserves available side, code, certainty, disposition, category and limitations; it explicitly marks localization absent rather than reconstructing it. A later narrowly reviewed diagnostic-retention enhancement could support more precise human comparison.
- The diagnostic does not independently establish provider call counts, token usage or billed cost. These remain unknown for a future run without retained audit evidence. Source code enforces the existing no-retry and marketplace-skip behavior; it is not a substitute for a run-specific audit.
- A downloaded owner diagnostic is an owner-attested local input. Its SHA-256 detects changes relative to retained bytes; it does not cryptographically authenticate origin after download. Private human review and original evidence retention remain necessary.
- Independent reference review is outstanding, particularly the exact sports parallel and physical reverse-holo verification. Acquire and review permitted references before claiming verified printing. Do not change catalog mappings or matching thresholds to fit these cases.

These are validation/observability prerequisites, not implemented engine fixes. No prompt, model, condition rule, confidence gate, catalog mapping, economic formula or Phase 3K report layout changed.

## Verification

538 offline tests passed; 0 failed, cancelled or skipped. Production build passed. All four catalog asset packaging checks and the owner-demo packaging check passed. Tests include identity mismatches, uncertain printing, missing independent support, incomplete responses, actual synthetic JPEG byte linkage, private output constraints, evidence replay protection, owner spending acknowledgment and existing authorization/financial/no-retry regressions. Synthetic tests demonstrate software behavior only.

Push scope is the reconciliation branch. Production configuration, Production deployments and PR #2 remain untouched. Stop for review before a real paid scan or analysis-engine change.

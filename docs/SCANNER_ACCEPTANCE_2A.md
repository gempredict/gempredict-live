# Milestone 2A — scanner acceptance

68 offline tests pass across six suites; seven are new. One reproduced defect fixed: supported front/back observations of the same defect were collapsed and downgraded as conflicting duplicates. Both sides now survive condition normalization and report protection. Same-side conflicts and unsupported duplicates remain uncertain.

No UI, API route, model configuration, market safeguard, license gate or The Card API code changed. No live AI/external API requests, paid services, Actions runs or deployments were used. Photo Analysis, upload/camera controls, identity confirmation, Save Report, Copy Summary and Share remain intact; this is code review/offline verification, not new browser verification.

## Flow reviewed

`src/App.jsx` prepares front/back independently with `mobileImages.mjs`: native EXIF orientation, local decoding/HEIC fallback, aspect-preserving resize and size budget. `predictionTransport.mjs` submits same-origin to `pages/api/predict.js`; multipart validation checks decoded bytes and requires front when back is provided. Protected Preview local Pokémon OCR can seed printed identity from a pinned catalog; identity-only mode exits before paid analysis. Vision proposals/readings otherwise pass catalog and variant reconciliation. Catalog rarity is distinct from physical printing. Condition normalization constrains uploaded sides, localized cues, confidence, centering measurements and limitations. Market/completed-sales evidence, valuation protection and grading economics then constrain report/copy/save outputs.

Existing handler fixtures use mocked transports/model replies and explicitly synthetic image buffers. They do not test recognition from pixels. Existing mobile-upload tests cover byte validation/multipart handling; those were reviewed but not rerun here because the local workspace lacked the repository binary HEIC fixture. No substitute fixture was invented.

## Acceptance report

| Status | Finding |
| --- | --- |
| Working and verified offline | Exact name/set/full number/rarity reconciliation; conflicting year/set/number/language/printing cannot supply prices; fixed inputs AND fixed mocked replies produce consistent reports; four condition attributes require support; front/back findings stay separate; blur/unprovided sides cannot establish definite damage/grade; missing image/name fail before model/market work; unverifiable prices withhold recommendations; synthetic raw/PSA9/PSA10 scenarios include the $80 fee and conditional economics. |
| Implemented, not yet validated on actual cards here | OCR/catalog accuracy, AI repeatability, real defect localization/foil interpretation, device EXIF/HEIC behavior, poorly oriented image recognition, full browser Photo Analysis and save/copy/share behavior. Native orientation test checks the decode contract, not real device pixels. |
| Failing | Front/back collapse failed before the fix and now passes. No outstanding reproduced failure in these 68 tests. This is not proof that actual scans are failure-free. |
| Blocked by external data | Trustworthy raw/PSA9/PSA10 valuations, transaction identity/provenance/units and commercial rights, calibrated grade probabilities. Printed identity does not prove physical printing/authenticity. Photos do not establish PSA grades. |

Reused suites: scan-acceptance (5), vision-reliability (24), financial-consistency (6), identity-first (9), preview-integration (17). New scanner-core-acceptance adds 7 targeted tests; no new fixture infrastructure. Existing suites cover variant conflicts, asking-only provisional output and safe copy/save behavior. All monetary test inputs are synthetic.

```sh
node --test tests/scanner-core-acceptance.test.mjs tests/scan-acceptance.test.mjs tests/vision-reliability.test.mjs tests/financial-consistency.test.mjs tests/identity-first.test.mjs tests/preview-integration.test.mjs
node --check lib/visualEvidence.mjs
```

## Five physical cards — proposed owner-run Preview session

Plan only; nothing was run. Use the existing protected restoration-branch Vercel Preview and verify its deployed revision matches this commit before testing. No Production promotion/deployment. Normal Analyze scans invoke existing AI/market services: conduct that future phase only within the owner's separately authorized service budget. Without that authorization, stop at photo preparation/no-image UI checks. Existing `?identityOnly=1` mode can test local Pokémon identity but does not validate full condition/economics.

Choose five already-owned cards; do not buy cards for this test:

| ID | Selection / question |
| --- | --- |
| A | Clearly readable English raw common/uncommon with independently checked catalog identity: baseline identification. |
| B | Same subject/set/number as A but different physical printing if owned, e.g. reverse versus normal; otherwise another owned close variant. Does finish stay separate or require confirmation? |
| C | Owned SIR; use the Pikachu reference only if physically owned and markings independently established. Does catalog rarity remain separate from physical printing/condition? |
| D | Close subject/lookalike differing in full number, set or language. Does the scanner reject the tempting wrong match? |
| E | Worn/off-center card with physically observable flaws. Are localized findings supported by actual borders/corners/edges/surface without an invented PSA grade? Never damage a card for testing. |

Before scanning, make an answer sheet: ID, exact name/set/full collector number/language/rarity, physical printing or uncertainty, independent reference and magnified condition close-ups. Unknowns stay unknown; catalog identity alone does not establish transaction evidence or physical finish. Capture front/back straight-on in diffuse lighting, whole card visible, neutral background, safely handled. Record sleeves/glare. Keep originals and exact filenames/byte sizes (optional local hashes); remove location metadata from shared copies.

1. Record protected Preview URL, deployed revision, browser/device/OS and time with timezone. Keep optional identity hints blank for first scans and all other settings fixed.
2. Analyze each A–E with its front/back pair. Capture output BEFORE correcting identity. Capture any candidate/confirmation dialog; confirm only physically supported facts and label the result corrected, not successful unaided identification. Never confirm printing just to unlock prices.
3. Repeat each exact file pair twice: 15 baseline analyses. Compare identity, certainty, defect code/side/region, limitations and financial state. Same fixed photos should not introduce/disappear confirmed defects without review; prose need not be identical.
4. On A or E, add three controlled cases: front only, blurry front copy, and front rotated 90 degrees with unchanged back. Maximum 18 proposed analyses, no automatic retries. Front-only must acknowledge missing back; blur must reduce certainty; rotation should yield correct identity or explicit unresolved/retake, never a confident silent identity switch. Transformations are test inputs, not new physical facts.
5. With no name/photos, capture disabled Analyze (no request). Save one report, use Copy Summary, reopen on the SAME Preview URL/browser and compare identity, limitations and withheld/provisional financial state. Do not reset spending/rate limits or force revaluation.

### Exactly what to collect

Label each run A-r1/A-r2/A-r3 etc., plus A-front-only/A-blur/A-rotate:

- **Inputs screenshot:** front/back thumbnails, displayed filenames/sizes, card type, hints/settings, preparation errors and failure/loading state if relevant.
- **Identity screenshot:** full result header, name/set/full number/language/rarity/printing, verification status, candidates and confirmation reasons BEFORE correction. Capture corrections separately.
- **Full Photo Analysis screenshots:** overlapping captures covering centering/corners/edges/surface, ratings/states/notes, summary, limitations, risk/limiter and grade/recommendation caveats. Do not crop away unassessable/withheld states.
- **Market/economics screenshot:** raw/PSA9/PSA10, source labels, available counts/dates/coverage and verification text, fee, modeled probability/net, verdict and withholding/provisional explanation. Missing values stay missing; asking medians/model estimates are not verified sales or FMV.
- **Outputs:** Copy Summary text; one saved/reopened screenshot and copied summary; HTTP status and a selected-field response excerpt if available in DevTools. Useful fields: canonicalCard; identity/variant/valuation status and reasons; imageAnalysis inspectedSides, conditionAssessments, visualObservations (side/region/cue/certainty/confidence/centering measurement), imageLimitations; economics sources/status; Preview revision/diagnostic status. Do not export request image base64, cookies/tokens/headers, private provider responses or a full HAR. If response fields are unavailable, screenshots and copied text suffice; mark gaps explicitly.
- **Comparison row:** expected/observed identity by field, unaided/corrected/unresolved, agreement with physical condition close-ups, repeat stability, financial safeguard result, UI completeness and exact discrepancies.

Pass requires correct identity OR explicit unresolved status when evidence is inadequate, never confidently wrong identity/conflicting-variant pricing; localized condition evidence without fabricated damage/grade; stable core findings on repeats; explicit front-only/blur limitations; financial safeguards surviving display/copy/save. Report correct unaided / 5 and unresolved / 5 separately, plus all repeat discrepancies; conservative refusal must not inflate identification accuracy. Actual-card acceptance remains pending until these receipts are reviewed.

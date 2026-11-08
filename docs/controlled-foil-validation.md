# Controlled foil validation: exact prepared files and zero marketplace activity

Base 70a859b92790b8cf1d79cf6baa44f6d8c11de7f0, branch reconcile/iphone-upload-2026-11-03. This extends the existing Full Analysis handler; there is no new vision stage, optical detector, grade mapping or financial eligibility rule.

## Exact owner workflow (after review, not executed by this assignment)

1. Open this commit's immutable protected Preview URL, sign in through Vercel, and use the existing Authorize Preview Scan Diagnostics control with the already configured owner key. Do not put that key into an evidence file or copied report. In Owner-only foil validation, click Refresh owner authorization. It is unavailable outside the authorized project/branch Preview configuration.
2. Select front and back photographs through the existing upload interface. Wait until both are prepared. Keep original camera files separately: the exported files are browser-prepared JPEGs, not original photographs. Existing iPhone HEIC conversion/orientation/compression is unchanged.
3. Click Freeze prepared front and back. The controller captures the exact immutable File references currently selected, a selection epoch, a random nonsecret attempt ID and the Preview revision. SHA-256 is computed from each frozen File.arrayBuffer(). Dimensions are read by decoding only, with an image-element fallback; no new resize, rotation or JPEG encoding is performed.
4. Click Download prepared front JPEG, Download prepared back JPEG and Download manifest individually. Filenames include the attempt ID and side. Save them privately in Files/Downloads. The manifest contains version, attempt ID, revision and per-side SHA-256, byte size, image/jpeg MIME, width, height and the prepared-side filename suffix. A downloaded filename is attemptId + '-' + the manifest's per-side name. Original photos are not included or relabeled as prepared photos.
5. Use Verify saved front, Verify saved back and Verify saved manifest to reselect the actual saved files. This is local reading/hashing only; nothing is uploaded to a new endpoint. The controlled submit button remains disabled until all three match. Download initiation alone is not treated as proof a file was saved: browser download APIs cannot establish filesystem completion. Hash/read/decode/download errors invalidate the attempt; no paid call follows.
6. Leave the selected photographs unchanged. Replacing/reprocessing either side, any selection-epoch change, busy preparation, expired authorization or failed verification invalidates the preparation. Freeze/export/verify anew when needed. Once reviewed and explicitly authorized for a real test, click Run controlled Full Analysis once. It consumes the client attempt before request submission and appends the SAME frozen front/back File objects to the existing multipart request, plus mode=condition-validation and the manifest. It never reconverts them. Do not use the ordinary Analyze My Card button for this controlled test: ordinary Full Analysis retains its original behavior.
7. Download Scan Diagnostics promptly after the result. Match attempt ID, deployed revision, scan ID, front/back dimensions and both preparedSha256 values with the saved manifest/files. Retain originals, prepared files, manifest, diagnostic, independent reference notes, rendered screenshots and saved/copied reports privately. Hashes of separately resized/chat-exported files are not photo-to-scan linkage. Diagnostic export handles remain short-lived and owner-bound; they are not saved into reports.

No evidence package is uploaded during preparation, download or local verification. Only the original /api/predict request receives the prepared pair and manifest when the owner submits the controlled analysis. No raw photos are added to logs, diagnostics or persistent server storage. Existing upload temporary files are deleted after validation/parsing; Claude receives the original validated buffers in memory as base64, unchanged.

## Server authorization and preparation checks

No new secret or environment flag is introduced. The existing GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED=true and owner/signing-key configuration must be active for the designated branch. No values were read, changed or exposed by this implementation.

The existing diagnosticDeployment/diagnosticSession policy enforces actual server VERCEL=1, VERCEL_ENV=preview, exact project/repository/reconciliation branch, valid platform commit SHA, expected deployment origin/Host, same-origin POST and an authenticated encrypted HttpOnly owner cookie. Sessions are sealed to deployment origin AND revision, expire after 15 minutes and cannot be reused across revisions/Production. The browser capability only controls visibility; it never grants server authorization.

Only explicit mode=condition-validation invokes the new verifier. Unauthorized requests return 403 before the vision or marketplace paths. Both photographs are mandatory for this controlled workflow. The server validates manifest length/version, attempt ID and revision, then compares actual buffer SHA-256, size, JPEG format/MIME and sharp metadata dimensions against each side's descriptor before allowing AI. A mismatched/missing manifest or image fails closed. Neither a browser enabled flag nor a supplied financial trust claim bypasses authorization.

The server verifies that submitted bytes match the manifest; filesystem retention is checked by the client reselect-and-hash workflow, not claimed as server-verifiable. A malicious authorized owner can manually replay a request; this is not a distributed exactly-once quota. The UI attempt is single-use, in-flight requests are guarded, there is no automatic retry/fallback and existing server rate limits remain. Do not manually replay a paid request after a failure.

## Marketplace and financial isolation

For the authorized validation request only:

- Pokémon resolution receives its existing skipMarketplace:true option. This prevents direct eBay OAuth and neutral identity-evidence Browse requests. Independent TCGdex catalog handling and existing identity/printing safeguards remain unchanged; this is marketplace-free, not a promise of zero public catalog traffic.
- The later discovery block exits before internalMarketContext or /api/ebay-search fetch. It cannot fall back to broader queries. The result records condition_validation_marketplace_disabled rather than pretending a provider outage occurred.
- fetchPrediction is explicitly bypassed for controlled requests, in addition to the unchanged authoritative financialEligibility gate. Condition/grade/PSA probability/score/advice withholding is unchanged.
- The normal image-analysis function, model, prompts, condition sanitizer, output limits and error classification are reused. Exactly one vision attempt is made, with SDK maxRetries=0. Full-scan output remains 3200 front / 4800 dual-photo; controlled mode requires both photos and therefore uses the existing 4800 budget. No extra identity-only paid request is triggered.

Ordinary identity-only and Full Analysis requests keep their existing behavior. Production does not gain this mode: it fails diagnosticSession policy even if the browser claims to be enabled or supplies an old Preview cookie.

The report and authorized diagnostic carry a nonsecret attempt ID/revision, preparedImagesMatched=true and explicit owner_condition_validation marketplace-not-requested context. Diagnostic images retain the existing per-side preparedSha256. Zero marketplace activity is proven by instrumented boundary tests, not merely by the exported marketplace request counter (which does not alone cover the neutral identity-evidence helper).

## Offline verification

Nine new tests cover:

- exported files/hash/dimensions/side manifest matching real multipart parser buffers and the installed SDK mock's decoded request image bytes;
- exact File object identity through the actual App controlled callback, without another mobile preparation;
- local download/hash/dimension/side-verification failure and absent saved-file confirmation blocking consumption;
- image replacement, selection epoch changes and asynchronous freeze/verification races failing closed;
- actual export component's capability gating and required front/back/manifest reselect steps before submit;
- unauthenticated/expired owner session, wrong origin/project/branch/revision and Production rejection before paid/eBay boundaries;
- manifest tampering and missing back rejection before vision;
- both categories with active mock eBay credentials, asserting ZERO direct eBay OAuth/Browse calls, ZERO internal /api/ebay-search calls and ZERO endpoint upstream calls, plus zero valuation calls;
- ordinary requests still reaching their existing instrumented marketplace routes; saved/rendered/copied reports preserving withholding; owner diagnostics matching BOTH exported JPEG digests;
- read-only JPEG dimension fallback, with no re-encoding.

Full suite: 447 passed, zero failed, zero skipped (438 existing plus nine new). Production build and all four TCGdex reviewed-set/reviewed-source/snapshot/license traced-asset packaging checks passed. All photos, manifests and provider responses used by tests are synthetic. No live paid AI, marketplace query, physical accuracy test or manual deployment ran.

## Readiness and remaining checks

Only the existing branch automation may create the protected Preview after the commit. Deployment READY/revision is checked separately through read-only Vercel metadata; no manual deployment/promotion or Production configuration change is permitted.

Remaining owner-side checks before spending: authorize on the new immutable Preview, verify all three downloads/reselections on the actual iPhone/browser, and retain independent physical/reference observations before inspecting AI output. If the device blocks downloads, cannot decode/hash or authorization expires, the controlled attempt must remain blocked. Those device interactions and a live owner session have not been demonstrated by a paid scan in this assignment.

Browser local evidence does not establish optical accuracy, exact printing, an authenticated defect or a professional grade. Reference inspection and original/prepared-image linkage remain necessary for a real foil-card validation. Stop for review before any paid request.

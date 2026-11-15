# Phase 3L.2 — reliable controlled diagnostic capture

Starting revision `625ff6e5adeb92099fd6f54c8ac965471fdc25d7`; reconciliation Preview only. No real AI scan, marketplace request, Production change or merge was performed in this milestone. The owner's previous Fraxure scan is reported as completed but lacks retained diagnostic evidence for formal adjudication. It is not converted into a passing benchmark result.

## Confirmed findings versus hypotheses

Confirmed from the actual source and offline reproductions:

- The live report's original diagnostic button was below the complete report, after its detailed condition sections. It was a small ordinary control rather than a controlled-completion evidence panel.
- The original component returned null for an expired/unauthorized owner or missing live handle. This hid both the button and any associated export error. A successful analysis did not guarantee a visible export path.
- The response contained the encrypted export ticket and scan ID, but no explicit expiry metadata for the browser. The UI did not show the export deadline.
- A diagnostic handle is held in a WeakMap keyed by the original live report object. Saving, serializing, restoring or reloading a report does not retain it. This is intentional privacy behavior, not server-side archival storage.
- Diagnostics are allowlisted request-local observations, sealed into an AES-GCM encrypted, compressed ticket in the response header. There is no diagnostic database or recoverable server cache. The download endpoint opens the ticket only with the matching authenticated owner session and immutable Preview deployment binding.
- Export expires at the earlier of five minutes after response issuance and the original owner session's expiration. Reauthorizing creates a different session ID; it does not restore an old ticket. Authorizing near the end of a session can leave substantially less than five minutes after a long analysis.
- The previous browser download followed an awaited fetch. A fresh second user gesture is now used for the actual download rather than depending on Safari preserving transient activation across that request.

Hypotheses for the specific owner incident: the control may have been below the viewed area; the owner session or ticket may have expired; a reload may have lost the volatile handle; Safari may have handled the asynchronous download differently. No retained native-device event trace proves which occurred. The expired historical diagnostic cannot be recovered through this application. No recovery is claimed and no replacement scan was run.

## Implemented change

A separate cream/gold **Controlled Scan Complete — Save Validation Evidence** panel appears above each live controlled report, outside the approved Phase 3K report. Only the newest report is automatically scrolled into view, so older reports cannot pull focus away from the latest completion. The original report design, internal hierarchy, condition presentation and financial gates remain unchanged.

The panel includes the actual server-reported expiry time and remaining seconds, a full-width Download Scan Diagnostics button, availability, saving instructions and persistent error/recovery messages. A controlled response with no usable ticket/expiry now shows an unavailable explanation instead of silently hiding the controls.

The first explicit owner tap retrieves the export through the unchanged authenticated POST endpoint. The helper validates scan ID, controlled attempt ID and both prepared hashes against the frozen manifest context. It preserves the exact returned JSON bytes. The second tap starts a local Blob download synchronously from a new user gesture. Repeated taps during preparation/download initiation are locked; no automatic retries or scan calls occur. Download initiation is explicitly distinguished from confirmed filesystem saving; cancellation cannot be detected reliably, so the UI never claims that the file was saved.

## Retention and security decision

No retention extension is necessary for this fix. The 15-minute owner session, five-minute maximum ticket lifetime, session ID binding, deployment/origin checks, encrypted tickets, no-store endpoint and Production rejection are unchanged. A nonsecret response header, `X-GemPredict-Diagnostic-Expires`, reports the exact expiry used when sealing the ticket.

The explicit export is buffered only in component memory, until the earlier owner/ticket expiry or page departure/unmount. Focus/visibility changes update availability; pagehide discards the buffer and aborts pending retrieval. Actual download checks the current clock again. The short-lived Blob URL used to start the download is revoked after 30 seconds, as with existing downloads; it does not renew server access. An owner-created downloaded JSON file is deliberately persistent and must be retained privately by the owner. No diagnostic payload, photo, credential or ticket is written to app logs, localStorage, sessionStorage, scan history or saved customer reports. No public endpoint or third-party sharing mechanism was added.

A reload, navigation to another page or Safari process eviction can still lose the in-memory handle. Scrolling, expanding report details and returning from Files do not remove the on-page controls while access remains valid. Save evidence immediately; do not rely on the deadline as an archive.

## Benchmark completeness

An integration regression uses the existing actual controlled handler with synthetic JPEGs and mocked providers, reads its authenticated diagnostic, passes it through the new export helper, then imports it using the existing Phase 3L byte-verifying importer. It verifies:

- Supported scan ID, Preview revision, stage, response/vision metadata and controlled attempt ID.
- Original allowlisted model identity proposals separately from canonical identity and catalog/verification outcomes.
- Condition observations, dispositions, category states, photographic limitations and available coverage summaries.
- Both prepared JPEG SHA-256 values, dimensions and sizes linked to the unchanged prepared manifest and actual retained JPEG bytes.
- Financial withholding and zero mocked marketplace boundaries; no benchmark PASS is manufactured.

The current importer-required fields are present; no change to the diagnostic payload schema or analysis engine was necessary. Existing limitations remain explicit: exact condition coordinates/full inspection polygons, some canonical printing/autograph/serial fields, full-scan usage/call counters and billed cost are not all retained. Unknown or absent evidence must stay unresolved. The export does not invent these fields, reconstruct a model response, authenticate physical printing or establish condition accuracy. A later observability proposal can address those gaps separately if required for more detailed adjudication.

## iPhone owner procedure

Do not perform another paid scan as part of reviewing this change.

For a later separately authorized controlled test:

1. Use the new immutable protected Preview, authorize Scan Diagnostics and complete the existing front/back freeze, three-file download and byte-verification workflow. Keep the exact prepared JPEGs and manifest privately. Do not use an ordinary scan as a substitute.
2. After the authorized controlled analysis completes, the **Controlled Scan Complete — Save Validation Evidence** panel is immediately above the report. Check availability and the displayed deadline; owner authorization may expire sooner.
3. Tap **Download Scan Diagnostics** once. Wait for **Export ready in memory**. If retrieval fails, follow the visible error and retry only the diagnostic export while still available; never repeat the paid scan to fix export.
4. Tap **Download Scan Diagnostics** again. In Safari accept Download, or use the resulting document's Share → Save to Files if Safari presents a document preview. Choose **Files → Downloads**, not Photos. The app confirms initiation only.
5. Open Files → Downloads and confirm `gempredict-scan-<scan ID>.json` exists. Keep it with the exact front/back JPEGs, prepared manifest and independent reference notes. Check scan/attempt/revision and both prepared digests during the offline import. Do not share credentials or the encrypted ticket.
6. If the download was canceled, return to the same page and tap the button again while valid. If owner authorization or the diagnostic expires, retain other evidence and stop for review. Reauthorization cannot recover the old ticket. Do not trigger a new paid scan.

## Verification and limitations

552 offline tests passed; 0 failed, cancelled or skipped. Production build and all four catalog packaging checks plus owner-demo packaging check passed. Existing JPEG/SHA-256/dimension/manifest, one-use spending, owner authentication, Production isolation, identity/condition and financial regressions remain passing.

The local browser test uses the actual built App, synthetic JPEG exports and one completed mocked controlled handler response. It verifies prominent controls, first-request failure with visible retry guidance, two-tap export, cancellation without a false saved claim, repeated use after Files return, report navigation, exact prepared linkage and expiry disabling. No live AI/marketplace service is called. Mobile screenshots and JSON results are review artifacts and contain synthetic data only.

Chromium with iPhone 13 viewport/user agent is not native iOS Safari. Native file-preview/download behavior and Safari process eviction still require owner device confirmation. The two-tap path preserves a direct user gesture, but no cross-browser API can prove the file was saved. The server expiry and access rules remain authoritative.

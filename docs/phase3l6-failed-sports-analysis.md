# Phase 3L.6 — failed sports response investigation

Base `44e6d9364836bd28f27a56f282e695568ac6c087`; reconciliation Preview only. No real AI or marketplace request was performed for this investigation. Existing model, prompts, output budgets, SDK maxRetries=0, financial economics, category preflight and Phase 3K report design are unchanged.

## Incident evidence and limits

A read-only runtime-log query scoped to the exact Phase 3L.5 Preview found a matching `/api/predict` request with the fixed messages `Image analysis failed ANALYSIS_RESPONSE_INVALID` and `Photo scan stopped: no usable image-analysis result`. The initial 24-hour query failed because the Hobby plan retains only a recent window; a 50-minute query and request-scoped query succeeded. The failure is therefore evidenced by logs, not merely an empty search result.

Those logs do not retain stop reason, block types, parser rule, mode, or category-routing stages. No original failed diagnostic or model response was supplied. The exact original parsing condition cannot be reconstructed, nor can selected/confirmed/accepted/executed=Sports be independently verified for this incident. The current controlled route's guards enforce category agreement before a provider call, but a coarse error log alone does not establish which mode/values that request used. No assumption of category misrouting, model quality, malformed JSON or truncation is made.

At the starting revision, `ANALYSIS_RESPONSE_INVALID` could arise from a non-end_turn stop reason, the JSON byte limit, JSON syntax, or a non-object top level. Explicit `max_tokens` has a separate incomplete-response code. This narrows the source branches; it does not reveal the actual stop reason or establish/exclude every possible form of incomplete output.

## Complete response path

1. Existing owner/category/prepared-JPEG checks run on the controlled mode. Full analysis calls the existing vision helper once, with `claude-sonnet-4-6`, 4,800 maximum output tokens for both photos (3,200 front-only for ordinary analysis), and retries disabled. Sports uses its existing prompt; no extra classifier or second identity call is introduced.
2. The SDK response reaches `parseVisionMessage`. Full analysis is **prompt-constrained JSON**, not provider-enforced JSON Schema. The strict identification-only schema and validator are a separate path and cannot simply be reused for full condition results.
3. The parser requires an accepted completion, supported text content, a bounded JSON string and a top-level object. It does not extract fenced/sub-string JSON, repair syntax, accept a closed object at max_tokens, or retry.
4. Existing full-analysis normalization then processes identity and condition evidence. This is not a newly introduced field-by-field full JSON Schema validator; partial/unknown condition evidence continues through existing conservative semantic rules. Top-level shape rejection is recorded separately from normalization failure.
5. Only usable normalized analysis reaches identity reconciliation and the sports audit. A parsing/normalization failure returns the fixed error response before catalog/discovery/valuation work, with no generated report. An audit not running after a parser failure is expected, not proof the sports engine failed.

The prompt already requests compact raw JSON, no markdown/preamble, bounded observations and explicit unknowns. Synthetic success fixtures demonstrate compatibility, not real-provider reliability or optical accuracy. No evidence justifies changing the prompt, model, budget or adding a new structured-output request format in this milestone. Full provider-enforced schema adoption would require a separately reviewed full-condition schema and compatibility tests.

## Demonstrated defects corrected

**Insufficient failure observability.** Full analysis previously did not retain completion metadata and mapped multiple parser conditions to the same generic failure. Authorized diagnostics now add `visionRequest`, `visionCompletion` and `visionValidation`: fixed model/mechanism, configured token/JSON limits, whitelisted stop reason, bounded content-block type counts, text-byte count, available numeric input/output usage, and exact fixed phase/rule. Counts are capped; over-limit text count is a sentinel, not retained text. No provider IDs, headers, arbitrary field names, raw text, parser exception text or images are exported. Usage is not a bill or call-count audit.

Classification covers completion stop/content shape/empty output/output cap; JSON syntax/byte cap; top-level schema shape; and normalization failure. Future server failure logs include only the safe phase/rule/count alongside the existing fixed error code. The owner-only encrypted diagnostic carries the richer metadata. Existing retention, ticket size, origin/deployment/session checks and no-store behavior remain unchanged.

**Unexpected content silently ignored.** The old parser filtered non-text blocks away before accepting remaining JSON. An offline fixture demonstrates that a text object plus an unexpected tool/thinking block could be accepted. The JSON-only completion contract now rejects mixed/invalid content and excessive block counts. Valid text blocks remain supported, including a JSON string split across text blocks. This independent contract defect is not claimed as the incident's cause. All incomplete/malformed responses still fail closed.

**Failed controlled capture lost its context.** App remembered failed response handles without the frozen controlled manifest/context, so the prominent completion-capture workflow did not apply. Both HTTP failures and transport-error responses now preserve the controlled attempt and a failed marker in volatile capability storage; a missing response still produces an unavailable explanation. A separate **Controlled Scan Failed — Save Validation Evidence** panel auto-scrolls into view without a successful report. Explicit preparation shows only sanitized failure detail; the next tap downloads through the same owner-authorized two-tap mechanism. It states that no usable report/valuation was generated and instructs the owner to stop rather than repeat the paid scan.

Failed-export validation still requires the matching scan ID, prepared hashes and verified controlled-attempt marker, plus a failed HTTP status in the diagnostic. Early preflight failures lacking a verified pair, expired sessions/tickets or absent handles may remain unexportable; the panel explains unavailability rather than weakening access or pretending recovery. No raw payload or capability is copied into saved customer reports or unencrypted persistent browser storage.

## Verification

567 complete offline tests passed; zero failures, cancellations or skips. Production build plus all four catalog packaging checks and owner-demo packaging passed.

New regressions cover malformed JSON, unexpected stops/content, closed-but-capped/incomplete output, empty output, byte limit, non-object schema shapes, normalization failure, metadata redaction/bounds, failed controlled export without a report and actual App failure-context retention. Existing successful sports, sports-audit routing, explicit category binding, no-retry, JPEG integrity and financial regressions remain passing. Synthetic failed controlled tests verify all four routing values=sports, one mocked vision request, audit not run after failure, zero marketplace/valuation boundaries and secure diagnostic export. These are future-behavior tests, not reconstruction of the incident.

Local built-App Chromium/iPhone emulation exercises the real failing HTTP/transport path with a mocked malformed sports response, then owner export, a failed export request/retry, two-tap saving, cancellation, Files return and expiration. No report or valuation is created. No live AI/marketplace call or browser error occurs. Native iOS Safari still requires owner confirmation.

## Remaining limitations and owner action

The original completion/diagnostic cannot be recovered from the available logs, and its exact parser condition/category history remains unknown. No new scan should be used to fill that evidence gap in this review. The current safeguards do not guarantee a model always returns valid JSON; they reject invalid output and make the reason auditable. Full per-field provider-enforced schema is not newly claimed. Actual historical billed calls/cost remain unknown.

For a later separately authorized attempt, if analysis fails: keep the page open; use **Controlled Scan Failed — Save Validation Evidence** immediately; tap Download Scan Diagnostics once to prepare and again to start saving; confirm the JSON in Files → Downloads; preserve the exact prepared pair/manifest; stop for review. If export is unavailable or expired, retain existing evidence and do not retry the paid scan. No Production deployment or PR #2 merge.

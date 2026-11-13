# Preview post-upload failure investigation

Starting HEAD: 933008b002673a2813c19653abdb3882f6c26d4e.

## Retained live evidence (read-only)

The latest HEAD Preview was READY on the reconciliation branch. A recent retained
`POST /api/predict` runtime event reported:

`Vision JSON parse failed { stopReason: 'max_tokens', textLength: 7163, outputTokens: 2400 }`

This confirms provider output-limit termination and a parse failure for that event.
Truncated JSON is the supported explanation; the raw response was not retained,
so its exact truncation point/parser behavior cannot be reconstructed. This cannot
be tied conclusively to the owner's specific submission without its timestamp or
scan reference. No live scan/provider call was initiated during investigation.
The first 24-hour log lookup exceeded Hobby retention; the recent-window lookup
succeeded. No plan upgrade, credential read or settings change was made.

## Affected paths and prior behavior

| Stage | Prior result | Repair |
| --- | --- | --- |
| Client HEIC/decode/dimensions/budget | Specific local UploadError before submit | Unchanged |
| Server multipart/decode/size validation | HTTP 400, upload message | Fixed upload-processing code/category; decision unchanged |
| Missing provider configuration, provider auth/rate/timeout/network error | Caught as null analysis, generic HTTP 422 photo error | Distinct safe provider failure code/category; never echo SDK exception |
| Empty text | Null analysis, same HTTP 422 | Empty-response code; capped empty output is incomplete-response code |
| Invalid JSON | Null analysis, same HTTP 422 | Invalid-output or output-limit/incomplete code |
| Normalization null/exception | Generic 422 or provider-like failure | Verification/runtime normalization failure |
| Diagnostic auth/config/capture failure | Disabled auth normally inert; unexpected observer errors could escape | Diagnostic initialization/method errors cannot interrupt scanning; access still fails closed |
| Expected catalog/variant ambiguity/unavailability | HTTP 200 with unverified identity | Same decision; explicit nonfatal verification notice |
| Unexpected verification exception | Generic outer HTTP 500 | Verification/runtime failure code |
| Internal marketplace origin/protection/API failure | Discovery unavailable in HTTP 200 report | Same behavior, explicit nonfatal marketplace notice; financials withheld |
| Unexpected report generation exception | Generic outer HTTP 500 | Unexpected internal failure code |
| Transport non-2xx | Throws before App's failed-ticket handling | Private WeakMap preserves response capability for catch handler |
| Preview protection redirect/401/403 | Preview sign-in error | Unchanged; provider auth errors use service status 503 instead |

The literal generic PHOTO_ANALYSIS_UNAVAILABLE response came only from the
post-vision null-analysis guard, before canonical/catalog and internal marketplace
processing. Expected verification or marketplace failure could not cause that
literal response. A provider limit was being mislabeled as a photo-quality problem.

## Scope and safety

`scanFailures.mjs` supplies fixed code/category/message mappings. Provider output
still must parse and normalize; no partial result is accepted, no fallback identity
or price is fabricated. Existing provider model, 2400-token limit, image preparation,
marketplace limits, no-retry behavior, identity/variant/condition interpretation and
financial eligibility are unchanged. Token-budget/prompt optimization is separate
work; this checkpoint makes the failure actionable, not a claim that capped output
will now succeed.

The UI displays a safe public error reference. Authorized encrypted diagnostic
headers survive HTTP failures through a private error-to-response WeakMap and the
existing volatile scan-capability map, not enumerable error/report properties or
browser storage. Diagnostic exports include only an allowlisted failure code.
Existing Preview-only owner/session/expiry rules remain. No disabled/unauthorized
capture is enabled by an error. Diagnostic configuration failures do not block scans.
Nonfatal notices are mapped to fixed safe text again when rendered, including saved
reports; client-provided notice prose cannot authorize advice or monetary claims.

Offline full-handler regressions use validated synthetic front/back images and
mock provider responses/errors. They cover output caps, auth/rate/timeout/network,
empty/malformed output, normalization faults, verification/report exceptions,
nonfatal marketplace/catalog loss, diagnostic faults and failed-scan ticket recovery.
No merge, deployment, paid provider call or Production change is part of this work.

# Identity JSON failures: provider-enforced output

Base: 2490206a4536a6ad6d6d7373c7c1c43c6bb03254.
Confirmed real failure: successful photo upload, then identity JSON `json_syntax`
rejection before catalog verification. No new live request was made for this fix.

## Supported mechanism and decision

Anthropic's current official Messages documentation supports JSON outputs through
`output_config.format = {type: "json_schema", schema: ...}`. This uses constrained
decoding; it is different from asking the model to produce JSON in a prompt.
Sonnet 4.6 is supported by the current API and is listed by the installed SDK.
The documented strict-tool mechanism (`strict: true`) is an alternative for tool
inputs. It is unnecessary here: identification does not execute a tool or need
another model turn. No tools/tool runner or paid fallback is added.

Official references reviewed:
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- https://github.com/anthropics/anthropic-sdk-typescript

The old installed SDK was 0.27.3 (manifest range ^0.27.0). Its JavaScript serializes
extra body keys, but its published request types do not support output_config.
The dependency is upgraded and pinned to 1.6.0, with a generated integrity-locked
dependency graph. No unrelated existing package version is changed. New transitive
packages belong to the SDK graph. The SDK supports Node 20 LTS and later non-EOL
versions; this workspace is Node 24 and the existing Vercel project is configured
for Node 24. No runtime or Production configuration was modified. SDK body/debug logging is explicitly disabled with logLevel=off; application diagnostics retain their authorization boundary. Both ESM imports
and the existing default constructor/messages.create usage build successfully.
The SDK is Apache-2.0; its unmodified license and attribution are included under
public/third-party/anthropic-sdk. Existing mobile and TCGdex notices stay intact.

## Implementation

`identityOutputSchema.mjs` defines a compact required-field object with nullable
unknown identity strings/confidence and attributed printed readings. All objects
have `additionalProperties: false`; enums constrain reading field, certainty,
photo side and printed area. Front-only requests only permit front attribution.
The schema contains 12 nullable unions (below the documented 16-union limit),
no optional properties, no card-specific values and no sensitive data.

The API does not support maxLength, maxItems or numeric min/max constraints.
Those limits are described in the schema/prompt and remain strictly enforced by
validateIdentityObject: 12 readings, 3 alternatives, 80-character values,
240-character uncertainty notes and confidence 0–100. They are not falsely claimed
as provider-enforced bounds. Existing complete collector numbers, alternatives,
copyright-versus-release-year separation and null unknowns remain unchanged.

`identityStage.mjs` sends the schema on the existing single Messages request and
uses the SDK's withResponse wrapper to obtain the actual HTTP status and message
without an additional request. It then validates envelope/content, completion,
complete JSON and local schema before applying the existing catalog/photo pipeline.
The shorter prompt concentrates on evidence semantics instead of repeating a root
JSON template. There is no JSON extraction/repair, fabricated field, automatic
retry, unstructured fallback, token-count call, model change or condition stage.

Normal completion does not imply factual correctness. Catalog provenance, printed
identity agreement, user conflicts, variants, physical printing, sports catalog
absence and all financial withholding remain governed by the existing modules.
The separate full-scan request does not receive output_config; its existing prompt,
output budgets and response validator are unchanged, although it uses the upgraded
SDK. An actual-SDK full sports handler regression verifies this compatibility.

## Failures and authorized diagnostics

| Case | Result |
| --- | --- |
| Provider refuses (stop_reason=refusal) | ANALYSIS_PROVIDER_REFUSED; no prose accepted or exported |
| Token cap reached | ANALYSIS_RESPONSE_INCOMPLETE; even closed JSON is rejected |
| Invalid HTTP JSON/message/content envelope | ANALYSIS_TRANSPORT_INVALID |
| Invalid JSON inside an otherwise valid message | ANALYSIS_RESPONSE_INVALID with phase=json, rule=json_syntax |
| Required/type/enum/bound violation | ANALYSIS_RESPONSE_INVALID with the exact local schema rule |
| API rejects the request (400/422) | ANALYSIS_PROVIDER_REQUEST_REJECTED; no automatic retry/fallback |
| Timeout/authentication/rate/server failure | Existing safe classifications; one attempted request |
| Complete, schema-valid but uncertain/null identity | Useful unresolved result; never fabricated verification |

Provider refusal/truncation can override the formatting guarantee. Current docs
also describe enum-casing exceptions; the local validator deliberately still
rejects unrecognized labels rather than silently rewriting observations. A schema
may be rejected for complexity or other provider reasons; a request rejection does
not claim to know the cause from an untrusted provider error body.

Owner-authorized encrypted Preview diagnostics add only fixed mechanism/stop/status
metadata, bounded block counts and numeric input/output/cache token counts when
actually provided. Missing/invalid counts remain null. HTTP status is captured
from the SDK response or exception; unknown status stays null. Failure codes and
safe field requirements remain available. Provider IDs, headers, raw response or
refusal text, photos, credentials and arbitrary URLs are not exported. Successful
public reports do not acquire token-usage metadata. Authorization, encryption,
expiry, branch/repository checks and Production exclusion are unchanged.

## Cost and remaining uncertainty

One paid attempt, maxRetries=0 both on client and request, 45-second request timeout
and the 2,000-output-token cap are unchanged. At the previously documented $15 per
million output-token assumption, the output-only cap remains $0.030; this is not a
fresh price quote. Images and input tokens are additional. The schema and provider's
injected format instructions add input tokens, while the shorter prompt removes
some. Actual net input cost cannot be measured without an authorized request; no
savings or exact total is promised. Refusals/generated truncated output may still
be billed, with no automatic second attempt.

The first use of a schema can add grammar-compilation latency. Anthropic documents
24-hour grammar caching; front-only and two-photo requests use two static schemas.
Compilation may exceed the unchanged 45-second timeout. There is no paid warm-up
call or implicit timeout retry. Live provider acceptance, latency, token usage and
real-photo accuracy remain unmeasured at this checkpoint. Catalog coverage gaps
remain gaps; structured syntax cannot create missing independent card facts.

## Validation

287 offline tests passed, 0 failed, 0 skipped (276 existing and 11 new).
The production build and TCGdex snapshot/license packaging checks passed.

New integrations use the actual pinned SDK with a mocked HTTP transport, actual
multipart prediction handler and existing catalog/financial pipeline. They assert
serialized output_config/schema, one request on every outcome, refusal/truncation,
malformed outer and inner JSON, local schema bounds, request rejection, connection/
timeout failures, null uncertainty, sports alphanumeric numbers, Pikachu provenance,
Zapdos 2025 -> independent 2026 correction, full-scan compatibility and authorized
completion/usage privacy. Usage counts and all model/HTTP data in tests are explicit
synthetic fixtures, not real token measurements or retained provider responses.

Stop for review. No paid provider call, manual deployment, merge, force push,
Production change or another real-photo test was performed or requested.

Changed files: package.json; package-lock.json; lib/identityOutputSchema.mjs;
lib/identityCompletion.mjs; lib/identityStage.mjs; lib/identityValidation.mjs;
lib/scanFailures.mjs; lib/scanDiagnostics.mjs; pages/api/predict.js;
tests/helpers/reconciliationPipeline.mjs; tests/identity-stage.test.mjs;
tests/identity-structured-output.test.mjs; public/third-party/anthropic-sdk/LICENSE.txt;
public/third-party/anthropic-sdk/NOTICE.txt; docs/IDENTITY_STRUCTURED_OUTPUT.md.
The compiled production API module was also loaded with an explicit dummy provider
key to verify constructor/module compatibility. The handler was not invoked and
no provider request was made. Next's compiled async module was awaited normally.

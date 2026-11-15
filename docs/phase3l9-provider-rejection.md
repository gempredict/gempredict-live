# Phase 3L.9 — Structured Full Analysis provider rejection

Assessment checked 2026-11-14 against `23d257712155868fdc4f58de7414c68549813391`.

**Root cause: UNRESOLVED. Real-provider acceptance has NOT been demonstrated.** No documented incompatibility was found in the exact provider-facing Full Analysis schema or installed-SDK request serialization. The confirmed engineering defect is that rejection capture discarded upstream HTTP status, provider error type and machine-readable error code. That information loss is corrected; the schema is deliberately unchanged rather than speculatively simplified.

**Recommendation: NO-GO for another paid sports-card scan yet.** Offline checks support the request's documented shape, not actual grammar compilation, account eligibility or real-card accuracy. This phase did not activate the flag or send any Claude/marketplace request. No experimental deployment was recreated.

## Incident evidence and recovery limits

The owner reports scan `6c563a78-3ab4-4f6d-8e40-d21c2023c9b0` at the starting commit: Sports selected/confirmed/accepted/executed, both prepared JPEGs validated, Sonnet 4.6 / JSON schema v1 / 4,800 output tokens, one SDK attempt, zero retries, approximately 330ms latency, request-level rejection, GemPredict HTTP 502 / `ANALYSIS_PROVIDER_FAILED`, no completed analysis/audit/marketplace/financial estimates. These are owner-supplied diagnostic facts; the underlying diagnostic and raw provider response were not present in this task's retained files.

GitHub confirms the branch started at the specified commit. A historical Preview runtime-log query was rejected by Vercel because the requested window exceeded Hobby retention. A supported recent 30-minute query returned no matching `ANALYSIS_PROVIDER_FAILED` logs. The Vercel log-query error's HTTP 400 is **not** the Claude provider status. The original upstream status/message could not be recovered. No raw response was reconstructed.

At the starting revision, the route assigned `phase=request, rule=request_rejected` only for an SDK status of 400 or 422. This code-path inference does not identify which status or underlying error was actually returned. GemPredict's separate 502 response also does not identify it. Neither the latency nor absence of the one recognized compilation phrase establishes malformed schema or grammar rejection. Generic 400 rejection can also reflect non-schema request/account problems.

Environment metadata confirms the experimental enable variable is absent. The deployment listing for the starting SHA contains only the existing disabled Preview; the deleted experimental deployment was not recreated or used.

## Exact request audit

`fetchImageAnalysis` sends one `messages.create` request using model `claude-sonnet-4-6`, unchanged maximum output 4,800 for paired photos (3,200 front-only), two base64 JPEG image blocks, the existing prompt plus structured guidance, and:

```js
output_config: {
  format: {type: 'json_schema', schema: /* fullAnalysisOutputFormat(...).schema */}
}
```

There is no `output_format`, `response_format`, tool schema, thinking configuration, response prefill, second model request, fallback or retry. SDK client `maxRetries` remains zero. Installed `@anthropic-ai/sdk` is **1.6.0**. Its `messages.create` passes the JSON body through to `/v1/messages`; the direct `output_config.format` API does not transform this schema or impose a different wrapper. The SDK's error implementation exposes `status`, `type`, `apiMessage`, `errorCode` and nested error details; these were inspected without making a provider request.

The audit examines **the actual simplified provider format**, not merely the richer local schema. Unsupported local bound keywords are absent from the emitted schema. Root/row objects are closed; required arrays contain only defined, unique keys. Null unions and omitted optional details are intentional. Unknown observations can remain null/empty without invented regions or defects.

### Official requirements

Sources checked 2026-11-14:

- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Sonnet 4.6 model](https://platform.claude.com/docs/en/models/sonnet-4-6/overview)
- [API errors](https://platform.claude.com/docs/en/api/errors)
- Installed SDK `resources/messages/messages.d.ts`, `resources/messages/messages.mjs`, `core/error.mjs`, `resources/shared.d.ts`.

The provider documents direct `output_config.format`, basic types, primitive enums, nullable type arrays, optional properties, nested arrays/objects and `additionalProperties:false`. Numeric/string/array bounds are limited; our provider format omits them while local validation retains them. Explicit limits are 16 union parameters and 24 optional parameters; hidden combined grammar limits and a 180-second compilation timeout also exist. No fixed maximum object depth is published there. Sonnet 4.6 is supported. Schema conformance does not establish card facts. Refusals and output exhaustion can remain nonconforming; enum casing may vary. Existing fail-closed behavior remains unchanged.

### Serialized format measurements

| Provider format, paired images | Bytes including format wrapper | Nullable unions | Optional properties | Maximum property/item descent | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Pokémon v1 | 6,154 | 12 | 4 | 6 | Within inspected documented subset/explicit limits; live acceptance unproven |
| Sports v1 | 7,977 | 15 | 10 | 6 | Within inspected documented subset/explicit limits; live acceptance unproven |

SHA-256 of compact `JSON.stringify(fullAnalysisOutputFormat(true,...))`:

- Pokémon: `18cc5e54ecb2aa3c99507ba398d08c04fd6ccb6ba5c0d86190340e3cee893662`
- Sports: `3fc6dd062ccbe311fcf546b0531a0bf898666c9d4d75cde304aadca7286519a7`

The sports format's 15 unions/10 optionals may still interact with unpublished grammar limits. That is a **hypothesis**, not a demonstrated defect. Passing explicit limits is not proof of compiler acceptance.

| Suspected cause | Evidence/findings | Classification |
| --- | --- | --- |
| Unsupported schema keywords | Emitted keywords/types/enums independently checked; local bounds removed | No violation found |
| Required/optional conflict | Required keys exist uniquely; optional sports details intentionally omit nullable fields | No conflict found |
| Invalid nullable union | Emitted unions are supported basic types; 15 sports / 12 Pokémon | No violation found |
| Excess complexity/depth | Explicit counts pass; nested objects/arrays supported; internal combined limits unknown | Unresolved hypothesis |
| SDK serialization/wrapper | Actual installed-SDK fetch stub captures the exact expected wrapper, model, budget and images | Verified offline compatibility only |
| Model support | Current official model documentation supports the requested capability | Documented support; this account's acceptance unproven |
| Image/request/account issue | Prepared image checks succeeded per incident; current preparation caps long edge at 2,560px and each JPEG at 1,600KiB; original detailed provider response unavailable | Not established or excluded |

The identification-only schema was reviewed separately and is not sent by Full Analysis. Its sports format has 18 nullable-union nodes, exceeding the currently published 16-union limit by the same static count. That is a separate known compatibility concern, **not the cause of this Full Analysis incident**, whose emitted schema has 15. The consumer identification workflow is unchanged as required.

## Small, justified correction

No schema field, schema version, prompt, model, budget, condition rule or normalization behavior was changed. No unsupported parallel or card reference was added. No evidence was dropped to lower complexity.

The new pure `safeVisionProviderFailure` function returns only:

- `version` and numeric `upstreamHttpStatus` (or null).
- `providerErrorType`, restricted to known SDK error types (or null).
- `providerErrorCode`, restricted to five SDK-published codes: request-body encoding invalid/unsupported, body too large after decoding, enforced spend limit reached, organization on hold (or null).
- `requestContractReason` and `reasonBasis`: recognized machine-readable code, the pre-existing documented compilation phrase as an explicitly labeled **message hint**, or `not_identified` / `not_established`.

Only the first 4,096 characters of the SDK's message field are examined for the existing compilation hint; no text is returned, retained or logged. SDK types explicitly warn message wording can change, so a missing phrase cannot exclude compilation rejection. Unknown/future types/codes are null. No unrestricted exception strings, raw response, request body, headers, provider request IDs, credentials, file names or photos enter this record.

The bounded record now appears in the authorized diagnostic at `provider.rejection` and in one fixed server log entry for a structured provider failure. Existing expiry, owner/session encryption, prepared-pair verification and one-use controls are unchanged. `responseStatus` continues to mean GemPredict's status. `provider.rejection.upstreamHttpStatus` means the observed SDK upstream status. The legacy `failureCategory` label is preserved for compatibility; compilation labels remain heuristic unless supported by actual retained evidence.

## Targeted offline verification

Only two additional test cases were added, with existing schema/SDK success tests strengthened:

- Independent emitted-schema keyword/type/enum/closure/required-key checks, retaining the rich local constraints.
- Actual installed SDK body matches the unchanged provider format and expected model/budget/images, with no forbidden wrapper/tools/thinking or owner identity hints.
- Dual athletes, It Takes Two subset/title, foil/parallel proposals, explicit unknown serial, all four condition attributes, both sides, suspected observations and unassessable coverage survive the actual normalization/audit path.
- Real SDK error construction from mocked 400/422/401/403/429/500 responses preserves exact upstream metadata and safe codes while withholding raw text; one attempt, zero retries/fallback/marketplace calls, no sports audit or financial output after rejection.
- Unknown/error-shaped values, invalid status values and large messages remain bounded/redacted.
- Existing suites retain refusal/output-cap rejection, local schema failures, Pokémon catalog correction/original-proposal separation and financial withholding.

Mocks verify serialization and failure handling, **not real provider acceptance**. No real-card outcome was created or private benchmark evidence modified.

## Before spending again

1. Seek the original sanitized upstream status/type/code if the owner retained it outside the expired export/log window. Otherwise acknowledge that the historical rejection cannot be conclusively diagnosed.
2. Review the exact emitted schema and account/model eligibility with provider-side evidence. Check existing credit/spend-limit/account status read-only; a generic invalid-request rejection alone is not proof the schema is wrong. Do not change billing or buy credits as part of this task.
3. If a concrete schema incompatibility is identified, review the smallest correction with explicit version transitions if necessary. Do not migrate on speculation or discard observations to force success.
4. Any future live compatibility attempt requires new explicit owner authorization, exact disabled-reviewed commit, safe rollback controls, owner preflight, one-request/no-fallback policy and accepted non-guaranteed spend limit. A token-count endpoint does not compile the output grammar and cannot prove acceptance.
5. Retain the new bounded rejection metadata promptly on either success/failure. Do not repeat a paid scan to replace missing diagnostics. Actual provider acceptance and useful real-card evidence must precede a claim of successful migration.

This phase stops after offline validation and a new protected **disabled** Preview. The deleted experimental Preview remains deleted; no environment setting is changed and no scan is initiated.

Validation completed: **592 tests passed, 0 failed, 0 skipped** (`node --test --test-isolation=none tests/*.test.mjs`); production build passed; all five packaging checks passed (four catalog/license traces and owner-demo packaging). Exact changed-file inventory, schema audit artifacts and logs are included in the review handoff. The commit and protected Preview URL/status are reported after branch deployment; feature enablement remains absent/off.

# Phase 3L.7 — Full Analysis structured-output feasibility

Decision: **CONDITIONAL GO for a separately authorized provider validation; not activation now.**

Audited from `85ed709e61099ce4f6389a72bf5cabb0b4fe995e`, checked 2026-11-12. No real provider/marketplace requests, retained private evidence changes, model/SDK upgrades, report redesign or financial-rule changes. All six new examples are synthetic compatibility hypotheses, not reconstructed historical responses or independent card references. The exact historical sports parser failure is still unknown.

## Existing architecture

`pages/api/predict.js` validates image bytes, explicitly accepts the controlled category, and builds `buildVisionPrompt` (Pokémon) or `buildSportsVisionPrompt` (sports). Current Full Analysis calls `messages.create` once with image blocks and prompt-constrained JSON. Sonnet remains `claude-sonnet-4-6`; budgets remain 3,200 front-only / 4,800 paired output tokens. The Anthropic client has `maxRetries: 0`.

`parseVisionMessage` checks completion, content shape, 32KiB text bound, strict JSON syntax and object root. It does not validate the complete prompt-JSON schema. `normaliseImageAnalysis` then retains identity and runs conservative `conditionPresentation`. Missing observations are not evidence of clean condition. Pokémon reconciliation (`resolvePokemonIdentity`) separately retains original proposals and canonical catalog corrections. Sports audit checks observation completeness but does not independently verify a sports catalog or parallel. `protectFinancialReport` still withholds protected estimates and recommendations without the existing independent prerequisites.

The separate identification-only action already sends `identityOutputFormat` using `output_config.format`, validates locally and performs no condition assessment. Its schema is not a complete Full Analysis schema. The new prototype reuses its identity vocabulary and local identity validator, not its separate paid action.

Essential report inputs are identity proposals/readings and condition containers. Individual identities can be null; arrays can be empty. No model-generated score, grade, probability, appraisal, price or financial recommendation is needed to construct an honest report. Provider stop reason, usage and schema mechanism belong in diagnostic metadata, not card facts.

## Official evidence and SDK inspection

Official sources checked 2026-11-12:

- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Sonnet 4.6](https://platform.claude.com/docs/en/models/sonnet-4-6/overview)
- Installed `@anthropic-ai/sdk` **1.6.0**, `resources/messages/messages.d.ts`: `JSONOutputFormat`, `OutputConfig`, and `MessageCreateParams` accept the direct request format. Actual installed SDK serialization is exercised through an offline fetch stub.

Provider documentation summary: JSON outputs use `output_config.format` with `type: json_schema`, including image extraction. Basic types, nullable unions, optional fields, enums and closed objects are supported. Numeric/string/array bounds require local validation. Explicit limits are 24 optional parameters and 16 union parameters; internal grammar limits also apply, with a 180-second compilation timeout. No fixed maximum nesting depth is published there. First-use compilation adds latency; grammars cache for 24 hours. Injected format instructions consume billable input tokens. Refusal and output-cap responses can violate the schema; refusal tokens are billed. Enum casing can vary. Unsupported or overly complex schemas can return 400. No separate compilation surcharge is documented in this source.

Sonnet 4.6 is documented as supporting this capability; current published standard rates are $3/input MTok and $15/output MTok. These rates are not an actual scan-cost estimate. No upgrade is needed for the proposed request shape. Real account/model acceptance remains untested.

## Versioned contract and adapter

`lib/fullAnalysisSchema.mjs` exports the authoritative version-1 local schema and the simplified provider format. Unknown root identity strings and identity confidence are null. A single root `schemaVersion: 1` is mandatory. All objects reject additional keys. Provider-facing schemas remove unsupported numeric, string and array bounds; deterministic local validation enforces them before the existing normalizer. No partial JSON recovery is allowed.

| Group | Representation | Handling of absent evidence |
| --- | --- | --- |
| Common identity | subject, year, manufacturer, franchise, product/set, collector number, language, rarity, parallel/finish, auto/relic, uncertainty notes, model identity confidence | Required nullable values; never verification or grading confidence |
| Printed evidence | field, exact text, certainty, supplied side, area, alternatives | Required array, empty permitted; bounded readings and alternatives |
| Sports identity | sport, team, stamped serial; optional versioned subjects, subset, printed title, serial/reading index, foil treatment | Nullable root values; optional sports detail fields become null in legacy adapter |
| Multiple athletes | Up to four subjects with individual reading indices | Empty/absent remains unresolved; headline and team are not athletes |
| Condition | Four attributes; code, certainty, optional evidence side/region/cue/confidence and optional centering measurement | No required defect or region; absent support is handled conservatively downstream |
| Coverage | Supplied side/attribute, bounded inspected/partial/unassessable regions and limitations | Empty coverage remains unknown; missing limitation region maps to whole-side null |
| Photo limitations/notes | Fixed limitation codes; brief notes with optional side | Empty permitted; absent side remains unspecified |

No grades, grade probabilities, values, profits or recommendations are legal schema fields. Existing evidence checks still validate cue agreement, localization, obscured areas, centering ratios and confidence support. Schema acceptance does not upgrade suspected observations to physical confirmation.

Provider serialization measurements (not token counts): Pokémon 6,154 bytes, 12 union fields, 4 optional fields; sports 7,977 bytes, 15 unions, 10 optional fields. Maximum schema descent is six property/item edges. Counts are tested against the published explicit limits; only a real provider request can establish grammar compilation acceptance.

The existing identification-only sports schema has 18 nullable union fields by the same static count. That is a separate compatibility risk under the currently documented 16-union limit, not evidence of the prior Full Analysis failure (which sent no schema). This phase leaves that separate action unchanged.

The adapter strips the transport version and maps to the existing internal contract without canonicalizing identity. The structured path retains its validated original proposal separately, including extended sports readings and multiple subjects, before normal catalog/audit handling. It does not introduce a second report renderer.

## Disabled Preview gate

`GEMPREDICT_PREVIEW_FULL_STRUCTURED_OUTPUT_ENABLED` must equal `true` on the server. It is not configured/enabled in this phase. In addition, the server must already have verified the controlled immutable photo pair, selected Pokémon/sports category, and a current owner diagnostic session. Existing session verification restricts the project, repository, reconciliation branch, immutable Preview origin, commit and keys. A Production environment rejects this path even if the flag is forced true. Browser input cannot select the mechanism. Other categories retain the default path.

No public scan migrates, even with the flag set. No retry or fallback exists. The existing error export records the mechanism/version, stop reason, block types, token usage and a fixed schema-contract/request/transport rejection category; it contains no raw provider text. Schema failure stops before model normalization and report construction. Existing authorized, expiring failed-scan export remains available.

## Synthetic compatibility matrix

| Example | Offline evidence retained | What remains unverified |
| --- | --- | --- |
| Fraxure, 2019 Unified Minds 155/236 | Subject/set/number and proposed Reverse Holo; separate regression preserves original Cosmic Eclipse proposal while canonical fixture corrects Unified Minds | Physical finish, independent real-card benchmark |
| Konnor Griffin, 2024 Bowman Chrome Prospects BCP-86 | Proposed Mojo Refractor, single subject and reading references | Exact real printing and sports catalog identity |
| Mets, 2026 Topps Series 1 It Takes Two 52 | Lindor/Soto subject group, subset/title, proposed Celebration Confetti and foil description | Actual model response, independent parallel confirmation |
| Standard sports base hypothesis | Single athlete, proposed Base finish | Actual base printing; never a default assigned to unknown cards |
| Unreadable printing | Null finish, glare limitation, uncertainty note | Printing remains unresolved |
| Mixed sides | Unassessable front surface; suspected localized back scratches and separate notes | Physical defect confirmation, severity and grading impact |

All examples retain financial withholding. Additional tests preserve serial-reading evidence, reject invalid side/coordinates/extra financial fields, and keep missing optional details unknown.

## Cost and operational comparison

| Aspect | Prompt JSON (default) | Version-1 structured prototype |
| --- | --- | --- |
| Vision requests per controlled scan | One attempt | One attempt; zero retry/fallback |
| Model / installed SDK | Sonnet 4.6 / 1.6.0 | Same, no upgrade |
| Output budget | 3,200 / 4,800 | Unchanged; may still exhaust |
| Expected output behavior | Prompt-guided shape | Schema-constrained shape; more keys/explicit nulls may consume more tokens, not measured |
| Input overhead | Existing prompt and images | Same images plus schema guidance/provider format overhead; exact extra tokens unknown |
| Actual cost | Historical actual cost not established here | Unknown; no paid request or tokenizer call performed |
| Processing charge | Normal model tokens | Input format overhead is billable; no verified separate compilation surcharge |
| Latency | Existing provider/network time | Additional cold-schema compilation; actual end-to-end latency unknown |
| Main risk | Invalid JSON or incomplete semantic structure | Grammar rejection, truncation, locally invalid evidence, factual error despite valid structure |
| Failure handling | Fail closed | Same, plus local schema validation and bounded mechanism/version diagnostics |

Do not equate schema wire bytes with billable tokens. Synthetic output sizes and mock token usage are not live measurements. Do not increase budgets or split into additional paid calls without separate authorization.

## Review requirements before any real test

1. Approve this exact versioned schema, disabled Preview-only path, known compilation/nesting risk and unchanged output budgets.
2. Separately authorize one owner-controlled paid attempt and a spending ceiling; no automatic second call or retry.
3. Confirm the deployed revision, owner session, explicit category, frozen front/back bytes and manifest. Establish an independent pre-scan identity/printing and condition reference where available; label missing and retrospective references honestly.
4. Authorize a temporary Preview-only flag change separately. Keep Production and ordinary scans on prompt JSON. Remove/disable the flag after the controlled experiment.
5. Capture safe completion/request metadata, actual token usage, billing evidence and wall-clock latency, including failures. Verify account acceptance and schema compilation; do not infer either from SDK mocks.
6. Review original versus canonical identities, each athlete and printing evidence, per-side coverage/uncertainty, failed-scan export, one-call counts and financial withholding before considering broader activation.

The historical sports failure cannot be repaired retrospectively or diagnosed by this feasibility exercise. No real-world reliability improvement is claimed. Stop for review before activation or another scan.

## Validation result

- Full offline suite: **585 passed, 0 failed, 0 skipped** (`node --test --test-isolation=none tests/*.test.mjs`).
- Production build: **passed** (`npm run build`, with temporary XDG config location and telemetry disabled).
- Packaging: **all five passed** (four traced catalog/license assets and owner-demo packaging).
- Installed SDK fetch mocks: one request for success, refusal, capped output, invalid version and HTTP 400 schema rejection; `maxRetries: 0`, no financial model call or marketplace request in controlled mode.
- Vercel environment metadata inspection: the new enable flag is absent; no environment configuration was changed. Existing Preview SSO protection remains enabled.
- Changed files: `docs/phase3l7-full-analysis-structured-output.md`, `lib/fullAnalysisSchema.mjs`, `lib/scanDiagnostics.mjs`, `lib/visionResponsePolicy.mjs`, `package.json`, `pages/api/predict.js`, `tests/controlled-validation.test.mjs`, `tests/full-analysis-schema.test.mjs`, `tests/helpers/fullAnalysisFixtures.mjs`, `tests/helpers/reconciliationPipeline.mjs`.

The exact deployment URL/status and commit are supplied in the review handoff after the branch push. Standalone local/provider schemas and the synthetic compatibility results are supplied as review artifacts; the exported module remains the authoritative contract.

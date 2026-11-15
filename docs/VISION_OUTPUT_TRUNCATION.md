# Bounded vision output: truncation prevention checkpoint

Base: 25f4dddae5796dfff73bd69dc617f0236eaa98c4.
Offline implementation; no provider requests or configuration changes.

## Investigation and chosen request path

The active endpoint is `pages/api/predict.js:fetchImageAnalysis`, model
`claude-sonnet-4-6`. Previously both one/two-photo and Pokémon/sports requests used
2,400 output tokens. The retained real Preview event reached exactly 2,400 tokens
and stopped with `max_tokens`, then failed JSON parsing. That alone disproves
reliable capacity for the prior unconstrained response; no average-token estimate
can establish safety for all photographs.

The Pokémon prompt requested repeated side instructions, unlimited observation/
reading/note arrays and unnecessary null grade placeholders. The legacy sports
prompt requested many overlapping grade/risk narratives and repeated the same
rubrics. The old vision parser counted braces without string awareness, extracted
subobjects and repaired trailing commas. A capped response could be accepted if a
closed object was found. Those behaviors are inappropriate for a complete result.

Installed SDK is `@anthropic-ai/sdk` 0.27.3 (lockfile; package range ^0.27.0).
It supports ordinary Messages and tool_choice/input_schema. It lacks the modern
typed output_config/messages.parse helpers. Its create implementation forwards a
body, but that is not an excuse to invent a response_format/json_object option.
Official Anthropic documentation now supports Sonnet 4.6 JSON-schema outputs via
`output_config.format`, and strict tool use. The documented subset excludes several
length/count constraints; native structure also cannot prevent max_tokens stops.

This checkpoint deliberately retains the existing plain-text Messages transport,
without a dependency upgrade, unsupported JSON-mode argument, forced tools, beta
header, or untested API migration. The response schema is prompt-defined, not a
claim of API-enforced JSON Schema. A strict local complete-object parser and the
existing evidence validators remain mandatory. Native constrained output is a
possible separate migration after compatibility review, not silently simulated.

The SDK defaults to two retries. The application had no explicit retry loop, but
that was insufficient: the SDK could retry a request. Client initialization now
sets maxRetries:0; an offline test using the actual installed SDK's fetch adapter
confirms exactly one HTTP attempt on a simulated 500 response.

## Concise response contract

Shared output instructions retain the existing codes, localization, certainty,
confidence and centering measurement requirements. No evidence threshold changes.

| Data | Contract |
| --- | --- |
| Identity | Existing flat identified* fields, cautious identityConfidence, short uncertainty note; strings target <=60 characters, identityNotes <=120 |
| Printed readings | Exact text including full denominator/prefix, uncertainty, alternatives, photograph and printed area; target <=8 front / <=12 dual |
| Condition | attribute/code/certainty with existing side/region/cue/confidence and supported centering measurement; target <=8 front / <=16 dual |
| Limitations | Existing documented limitation codes; unseen back remains unavailable |
| Qualitative notes | Only nonduplicative observations/limitations, <=80 characters each; target <=2 front / <=4 dual |
| Pokémon output | No grade forecasts, category ratings, repeated summaries or null grade placeholders |
| Sports output | Essential existing category ratings/notes and short condition summary fields remain; redundant repeated forecasts/advice omitted |

Partial coverage and unknown identity remain valid unresolved observations. Clean
areas require positive inspection evidence. Contradictory printed readings take
priority over redundant notes. Instructions never authorize silently treating an
omitted area as clean or interpreting a rarity as a printing. Sports printed reading
metadata preserves BCP-86 verbatim and does not use Pokémon numeric-number parsing.
Sports identity matching and its existing condition normalization rules are unchanged;
localized observation metadata is retained separately using existing validators.

Array/string targets guide generation; they are not a new evidence rejection
threshold. Existing validators' limits and rejection rules stay unchanged. A model
can disregard instructions, so the hard provider cap and fail-closed parser remain.
The local parser rejects non-object/malformed/extra-prose/repaired output, missing or
non-end_turn stop reasons, and every max_tokens stop (even apparently closed JSON).
It never fills missing identity or condition facts. Input over 32 KiB is rejected.
The separate legacy text-only parser is not expanded or used for active vision.

For a fixed example name/type and dual-photo prompt, prompt text decreased from
7,583 to 4,824 characters (Pokémon) and 8,878 to 5,586 (sports), before counting the
old additional duplicated suffix. These are character measurements, not token counts.

## Budget and cost rationale

| Photos | Previous output cap | New hard cap | Maximum text-output cost at $15/MTok | Increase over previous $0.036 cap |
| --- | ---: | ---: | ---: | ---: |
| Front only | 2,400 | 3,200 | $0.048 | $0.012 (+33.3%) |
| Front/back | 2,400 | 4,800 | $0.072 | $0.036 (+100%) |

The two-photo budget accommodates two sets of inspected areas/readings with headroom
for uncertain text and supported measurements. Category alone does not justify a
smaller cap: both need full identity and evidence, so only photo count changes it.
This is a bounded reliability/cost tradeoff, not a model-max-limit increase. One
request only; no automatic retry, fallback paid call or token-count API request.

The dense synthetic fixture has 16 localized observations, 10 printed readings,
four qualitative notes and uncertainty, serialized to 4,829 ASCII/UTF-8 bytes.
As a rough planning check only, 2.5 characters/token suggests about 1,932 tokens;
25% serialization/tokenization reserve is about 2,415. That already leaves no
reliable room under the old 2,400 cap. The new 4,800 cap provides additional margin
for verbose/non-Latin readings, different evidence and model instruction variance.
This is not an Anthropic tokenizer measurement or a mathematical fit guarantee.
The actual provider tokenizer was not called. Images/input tokens are not included
in the output-cost table; their processing is unchanged, while prompts are shorter.
Actual charges depend on generated tokens, not simply the configured cap.

## Offline validation and remaining limits

Full-handler tests cover detailed Pokémon with original/canonical distinction,
Konnor Griffin sports, dual-sided evidence, collector prefixes/denominators,
centering measurements, dense output, partial coverage, capped partial/closed JSON,
empty/malformed output, and the real SDK's no-retry behavior. Existing diagnostics,
failure classification, HEIC, identity, variant and financial tests remain applicable.

No finite cap guarantees completion for every image/language. Refusals, provider
errors, instruction violations, insufficient image quality and output caps still
fail safely or remain unresolved. The real-photo endpoint has not been invoked;
output adherence, latency and actual token usage require an owner-authorized Preview
validation after review. No paid calls, merge, manual deployment or Production change.

Official references checked for this checkpoint:

- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/models/sonnet-4-6/overview
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

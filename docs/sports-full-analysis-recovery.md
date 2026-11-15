# Sports Full Analysis recovery

Starting commit: `5da80fe12a0705c748ce1936b6a2c76599a66583`. Checked 2026-11-14. This repair uses the existing **Full Analysis prompt-JSON pipeline**, not identification-only analysis. No experimental activation, environment change, paid scan, marketplace request, Production change or PR merge was performed.

## What was fixed

The normal route already omitted the experimental schema when its server flag was absent. The concrete product gap was that rich sports observations were supported only incompletely:

- The normal sports prompt requested a singular flat subject and did not describe the existing multi-athlete, subset/title, serial-reading or foil-observation structure.
- Full Analysis normalization dropped `sportsIdentity`, and its sports reading allowlist dropped serial/subset/title/foil readings. The experimental path retained additional validated fields after normalization; the ordinary path did not.
- Sports Full Analysis did not expose a separate original identity proposal/evidence summary in the returned report.

The sports-only prompt now requests the existing version-1 sports observation metadata, distinct athletes with reading references, subset/title separately from product, and proposed parallel/foil details. No Mets names, number, product or expected finish are inserted as model hints. Unassessable areas belong in side-specific coverage/notes; the model must not invent defect codes, coordinates or measurements to fill them. This is prompt JSON, with **no provider response schema requirement**.

The existing normalizer now retains bounded sports metadata and readings, preserves unknown confidence as null, and keeps an independent copy of the original proposal. It reuses the existing sports detail validator and evidence summary. If a reading is rejected, retained source indices are remapped; a subject whose references cannot all be retained stays unsupported. Invalid optional details become unavailable while valid identity/condition observations remain usable. Unknown fields cannot inject financial trust.

The existing report's technical identity disclosure can now show the retained subset/foil proposals using its existing renderer. All remain unverified. No report component, stylesheet, layout, typography or grading-economics code changed.

## End-to-end normal route

1. The existing multipart parser validates the front/back image bytes. Sports is explicitly selected; the existing controlled mode additionally verifies owner authorization, category agreement and the frozen JPEG manifest.
2. With `GEMPREDICT_PREVIEW_FULL_STRUCTURED_OUTPUT_ENABLED` absent, `structuredAnalysis` remains false. Ordinary Sports Full Analysis and the existing owner-controlled **Prompt JSON** option do not require experimental preflight or schema acceptance.
3. One `messages.create` call sends `claude-sonnet-4-6`, maximum output 4,800 for paired photos (3,200 front-only), two image blocks and the sports prompt. SDK `maxRetries` remains zero. No second identity action or paid fallback is invoked.
4. `parseVisionMessage` strictly checks stop reason, bounded text, JSON syntax and object root. It does not extract fenced JSON, repair incomplete output or accept capped responses.
5. Existing conservative condition processing retains centering, corners, edges, surface, side-specific coverage/notes, suspected findings and unassessable areas. Sports metadata is retained alongside it, not substituted for condition analysis.
6. The existing canonical identity builder, sports audit, financial withholding and unified report renderer run. Sports catalog/physical printing remain unverified and qualified resale evidence remains unavailable.

Ordinary product marketplace discovery code is unchanged. Offline tests stub every marketplace boundary; the controlled Mets regression makes zero marketplace calls. No real marketplace requests occurred during this task.

## Pre-experiment comparison

Reference: `85ed709e61099ce4f6389a72bf5cabb0b4fe995e` (Phase 3L.6, immediately before the structured-output prototype).

| SDK request / processing | Comparison |
| --- | --- |
| Request keys | Exactly `model`, `max_tokens`, `messages` for normal prompt JSON |
| Experimental fields | No `output_config`, `output_format` or `response_format` |
| Model/budget | Unchanged Sonnet 4.6 / paired 4,800 tokens |
| Image handling | Same JPEG MIME, base64 bytes and front/back order; independently tested with distinct synthetic image bytes |
| Sports prompt | Deliberately extended to request supported multi-athlete/subset/foil metadata and preserve unknowns |
| Strict response parser | Function body identical to the pre-experiment implementation |
| Condition processing | Existing conservative evidence rules unchanged |
| Pokémon condition prompt | Byte-identical output for front-only and paired modes |
| Normalization | Focused repair retains previously discarded sports metadata; no provider schema required |

The historical fetch helper was executed offline with its historical sports prompt to capture the request; its normalizer was stubbed solely for this request comparison. The **current route** was separately executed end to end through real multipart handling, installed SDK serialization, parsing, normalization, audit, financial protection and actual report rendering, with external responses mocked. This distinction avoids claiming a reconstructed historical scan.

## Mocked Mets acceptance result

The complete **synthetic** response represents the existing Mets reference identity, not observations of the owner's physical card. Its hypothetical defects and coordinates are explicitly test data.

- Full Analysis HTTP **200**, `hasImageAnalysis:true`.
- Francisco Lindor **and** Juan Soto retained, with individual front/back subject-reading references.
- 2026 / Topps / Topps Series 1 / #52 retained.
- It Takes Two subset and printed title retained; Celebration Confetti and confetti-like foil remain proposed/unverified.
- Unknown language, serial and model identity confidence remain null.
- All four condition attributes retained, with front/back coverage; front surface unassessable due to glare, back scratches suspected, and limitations/uncertainty retained. No unsupported clean/Mint conclusion.
- Exactly **one** mocked SDK attempt, **zero** configured retries, **zero** financial-model calls and no schema parameter. The owner-controlled regression also records Sports at execution/audit and zero marketplace calls.
- Both players and condition evidence appear in the actual unchanged unified report components. Existing unavailable financial metrics/labels remain in the approved design; no fabricated values or recommendation are supplied.

Review artifacts include `SYNTHETIC-mets-report.html`, `SYNTHETIC-mets-full-analysis.json`, and `sdk-payload-comparison.json`. All are offline synthetic material, not a real-card benchmark or proof of provider reliability.

## Historical failures and remaining limitations

The original prompt-JSON `ANALYSIS_RESPONSE_INVALID` is separate from the later JSON Schema **request rejection**. The retained Phase 3L.6 sanitized findings confirm that the earlier failed request returned the fixed invalid-response code, but no original stop reason, parser rule, raw response or full category-stage history was retained. Those records cannot establish malformed JSON, truncation, a non-object output, another stop reason or a category error as its precise cause.

**The original response failure is not claimed resolved.** The repair fixes demonstrated prompt/normalization gaps and proves that a valid complete Sports response is accepted through the normal product pipeline. Claude may still return malformed/incomplete/refused output; it will fail closed with the existing diagnostics, not retry automatically. Image quality, identity accuracy, exact printing, condition accuracy and actual billing still require real evidence.

The normal request does not depend on provider-enforced schema acceptance because no schema is sent. The later rejection's underlying cause remains unknown; an account, model or service problem could still affect either route. Experimental code stays opt-in and disabled by default. No Vercel environment variable was changed; metadata confirms the enable flag is absent.

After owner review, the next separately authorized real-world test should use the **same Mets card**, explicitly selected as Sports with the existing **Prompt JSON / Full Analysis** mechanism. No experiment activation or schema preflight is needed. Retain the prepared pair, manifest and diagnostic promptly on success or failure; stop for review rather than initiating a retry. This task authorizes no paid scan.

Validation completed: **595 tests passed, 0 failed, 0 skipped** in the full offline suite; production build passed; all five packaging checks passed. Exact seven-file inventory and full logs are in the review artifacts. The reconciliation commit and new protected Preview URL/status are supplied in the handoff. The experimental enable variable remains absent.

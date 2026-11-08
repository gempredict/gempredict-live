# Phase 3A: catalog core reconciliation and collector report

Base 1579cf6b5c80fa433e7d5aece4429c0390e7f891; reconciliation branch only. No paid AI, public catalog fetch, marketplace request, historical scan replay, provider replacement, grading economics or manual deployment was performed.

## Fraxure investigation: confirmed code defect versus historical limits

The owner reports scan 45296da2-85b0-47d9-b4f7-824e11538b0d proposed 2019 Cosmic Eclipse Fraxure 155/236 Reverse Holo; sm11-155 was referenced but Cosmic Eclipse remained displayed. The owner-corrected core is 2019 Pokémon Sun & Moon—Unified Minds Fraxure 155/236. This historical summary is retained separately in supplemental/FRAXURE-summary.json. Original user fields, complete diagnostic, exact candidate/finish flags and photograph evidence were not supplied. The actual printing remains unverified.

Before editing, a mocked complete Full Analysis handler returned reference sm11-155 but canonical brandSet Cosmic Eclipse, with core conflict brandSet and printing/finish conflict. This reproduced the reported symptom without a card-specific exception.

The path is:
1. Original model proposal and full printed collector number enter canonical construction; original observation remains separate.
2. Bounded TCGdex discovery finds a unique complete candidate matching subject, full collector number and language; its independent set corrects the model proposal.
3. Missing positive support for the proposed reverse finish keeps a finish comparison unresolved/conflicting and catalog.status=conflict. This legacy exact-card gate deliberately does not grant printing verification.
4. pokemonIdentityPipeline then reverted the WHOLE canonical object to the original model whenever catalog.status was not verified/corrected. Only skipMarketplace (identity-only/controlled) had a core-supported exception. Thus an unrelated unresolved finish could undo a reliable set/year correction during ordinary Full Analysis.
5. Report protection faithfully rendered that reverted object, exposing Cosmic Eclipse rather than the corrected catalog core.

The correction generalizes the existing core-supported exception across both modes. Unique independent core facts survive printing-only uncertainty. Missing/ambiguous candidates, number/language conflicts, incomplete provenance and explicit user protections still prevent a correction. This is a confirmed code defect reproducing the historical outcome, not recovery of missing live inputs. Explicit user-supplied conflicting sets could also legitimately require review; absent historical fields prevent ruling that out for the exact scan.

The parallel-correction guard now preserves the original AI printing proposal when a printing conflict exists in either mode, rather than silently replacing it with catalog wording to manufacture agreement. Original comparisons/corrections are retained. A supported core title excludes an unresolved parallel, while the proposal stays inspectable and explicitly unverified.

## Before/after identification, offline

| Scenario | Before | After |
| --- | --- | --- |
| Unique complete independent sm11-155 candidate; AI Cosmic Eclipse; missing finish flags | Full-scan fallback restored Cosmic Eclipse | Unified Minds remains canonical; original Cosmic Eclipse retained; Reverse Holo unverified |
| Partial finish flags, normal=true but reverse missing | Missing positive printing support | Printing unresolved, not definitive evidence reverse cannot exist; supported core retained |
| Explicit reverse=false | Genuine metadata disagreement possible | Disagreement retained, not erased; core remains separate, physical printing unverified |
| Multiple exact candidate identities | No unique correction | Still unresolved; no confidence-based tiebreak |
| Wrong denominator 155/237 | No exact candidate acceptance | Still blocked |
| Explicit user Cosmic Eclipse set | Protected conflict | Still requires review; no forced catalog override |

No source card name, set or collector number was added to production reconciliation logic. The Fraxure helper's provider-schema records, including its schema-valid date/rarity/variant values, are mock data; they are not a downloaded TCGdex record or an authentication of the physical printing. The independent catalog adapter and all provenance/printing/financial gates are unchanged.

## Collector-facing presentation

The existing Opulent Disco report shell, upload/HEIC paths, identity-only option, owner export controls, save/copy controls and sports functionality are preserved. ImageAnalysisCard now presents:

- Canonical card title first, with a concise supported/unresolved identity message. Finish/physical-printing uncertainty remains visible, including the explicitly unverified original finish proposal and any positive catalog finish disagreement. Catalog corrections have a visible note pointing to the preserved AI disagreement.
- Four compact mobile-adaptive category cards: Corners, Edges, Surface, Centering.
- Exactly three plain-English overview states: Possible visible damage; No visible defect in inspected areas; Unable to assess reliably.
- Important observations retaining source side and qualified descriptions, plus global/scoped photo limitations and unverified qualitative photo notes. A model-confirmed damage observation is conservatively described as possible in the collector view, never strengthened from suspected to authenticated damage.
- Closed Technical Details containing existing independent verification rows, the original AI observation, every localized evidence record, coordinates, inspection coverage, reason codes, status/geometry qualifications and original comparisons. No complete raw provider response, credentials or photos are added.

The old grade-ceiling, PSA-grade, score/confidence and repeated forecast placeholder panels are removed from the condition presentation. Financial withholding remains visible. Existing detailed evidence still renders when Technical Details is expanded. The upper report's long identity summary and verification metadata also move into closed technical sections; core support and material conflicts remain visible outside them.

Copied photo reports now start with the same collector overview, qualified observations and photo limitations; complete previous identity/evidence detail follows a clearly labeled Technical Details heading. Identity-only copy behavior is retained. Saved/restored reports always pass the existing shared protection/reconciliation functions before display; no new trust flag or numeric grade/probability is introduced.

A category-level unassessable result can coexist with a supported regional observation. Neither a clean patch nor a model confidence authenticates an entire surface, all corners, mint condition, a PSA outcome or a grading recommendation.

## Review examples

Artifacts outside the repository:

- /workspace/artifacts/gempredict-phase3a-collector-before.html — previously generated synthetic condition report with the old engineering-heavy layout (same seven condition categories/states; not a real scan).
- /workspace/artifacts/gempredict-phase3a-collector-after.html — actual new report component rendered with the same synthetic seven-observation scenario, closed Technical Details and responsive overview.
- /workspace/artifacts/gempredict-phase3a-collector-copy.txt — corresponding collector-first copied report with advanced evidence retained after the technical heading.
- /workspace/artifacts/gempredict-phase3a-fraxure-offline.json — synthetic reconciliation result, clearly marked as not a live provider response.

The HTML uses no external resources or paid calls. The before example is retained from Phase 2B's synthetic rendering, not a reconstructed historical Fraxure report. Layout adapts via the existing single-column small-screen rule and an auto-fit/minmax overview; real-device usability still requires owner review. No actual model accuracy is measured.

## Validation

Six new tests cover complete-handler Fraxure correction, original disagreement, unresolved/explicitly conflicting finishes, ambiguity, wrong denominators, explicit user fields, both category render/save/restore/copy, closed technical sections, responsive layout rules, independent sports limitations, financial/printing protection and a qualified regional clean state.

Existing condition/clean-copy assertions are scoped to the new collector section where identical advanced content also remains inspectable; no identity/provenance/rejection or financial assertions were removed. Existing original-observation, source snapshot, sports, HEIC, no-retry, owner-export and zero-marketplace controlled-mode regressions remain in the full suite.

Full test/build/packaging results are recorded after final validation. No dependency, model/prompt, request/token budget, catalog asset or Production configuration changes.

## Remaining blockers before grading economics

- No qualified completed-sales bridge with independently established exact transaction identity, provenance, confirmed amount units/quantity, comparable condition and commercial/caching rights; asking listings cannot fill this gap.
- No independent physical-printing/authenticity or complete photographic condition verification. Catalog finish metadata can be missing, conflicting or stale and needs reviewed evidence.
- No calibrated condition-to-professional-grade probability distribution. Synthetic contract tests do not provide that calibration.
- Real-device collector usability and independently labeled real-photo evaluation remain owner review steps. Older saved reports retain unresolved historical core conflicts rather than being silently rewritten as new catalog verifications.
- Current financialSafety remains authoritative and always withholds unsupported valuations, expected profit and recommendations. No grading economics was enabled by this repair.

Stop for review. No historical scan was repeated, no source catalog record invented for runtime, no Production change or merge.

Final validation: 453 passed, zero failed, zero skipped (447 prior plus six new). Production build and all four TCGdex reviewed-set/reviewed-source/snapshot/license packaging checks passed. The Fraxure fixture and both category presentation tests are included in the existing build test chain.

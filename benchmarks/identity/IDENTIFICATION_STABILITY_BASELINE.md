# Phase 1 identification stability baseline

Starting revision: d88a0d3b736c2d0ed4a3f86ba32d6e4506ef5f25. This checkpoint freezes identification architecture; it does not establish statistical real-card accuracy or authorize grading/valuation.

## Confirmed defects and evidence limits

Canonical construction in `pokemonCardIdentifier.mjs` selects a unique clear printed language before `identifiedLanguage`. `visionIdentityEvidence.mjs` previously accepted any nonempty language transcription; `catalogLanguageKey` normalizes arbitrary text but does not validate it. Consequently a clear language row containing an illustrator credit displaced an English model proposal. Reconciliation copies that original canonical value if no unique catalog correction is supported, and reporting faithfully carries it onward. The sports identity-only branch also copied an arbitrary model language directly.

The owner's Snivy scan 41869bca-5bc5-49a7-a57b-81fd4fad7421 reproduces this symptom, but its actual diagnostic, printed readings, user fields and catalog response are unavailable here. The bad printed-row path is confirmed by an offline reproduction, not recovered scan-level proof. Other possible sources cannot be excluded retrospectively. The original summary is preserved separately; there is no fabricated catalog match or verified Holo printing.

User fields are not silently rewritten: explicit subject/number/language/parallel inputs or confirmedIdentity are compared with canonical fields and contradictory values require review. User year/set protection remains in `userIdentityProtection.mjs`. Catalog language is obtained from the selected language-specific TCGdex endpoint, not illustrator text; unique independent correction and provenance requirements remain unchanged.

`catalogResolution.mjs::safeCatalogReasons` unconditionally prepended five vocabulary entries: catalog_search_page_limit, catalog_multiple_set_candidates, catalog_multiple_exact_identities, reviewed_set_code_ambiguous and reviewed_set_source_unavailable. This is a confirmed reason-reporting bug affecting both supported and unsupported scans. The taxonomy Set is an allowlist, not proof a reason occurred. New diagnostics include only actual supplied reasonCode/reasonCodes and diagnostic reason entries, deduplicated, bounded and allowlisted. Existing historical exports remain untouched. A previously exported generic reason list is not independent proof of a catalog operation.

## Narrow fixes

- Recognized language names/codes may be observations; unknown prose stays in original AI/printed evidence and is excluded from canonical language. A valid model language can remain as an unverified proposal when a printed row is invalid. Missing/invalid proposals become null, never default English.
- Valid distinct language readings and combined set/language marks retain their original conflict semantics. No language mismatch is aliased away.
- Owner diagnostics provide fixed invalid_language_observation code plus existing row index/side metadata without exporting rejected literal prose. Existing authorization/privacy boundaries remain intact.
- Remove fabricated reason occurrences, preserving genuine rejection/error evidence and the complete supported vocabulary.
- No changes to structured output schema, prompt, token cap, requests, retries, catalog thresholds, HEIC, sports matching, condition logic, printing verification or financial gates.

## Capability and regression baseline

| Capability | Evidence and boundary |
| --- | --- |
| Printed subject/full collector number and original proposal retained | Offline handler and structured-output tests; valid formatting is not factual verification |
| Pokémon independent core matching/corrections | Existing Pikachu, Zapdos, MEW/30C provenance/snapshot/year-set regressions; runtime catalog coverage and availability remain dependencies |
| Language validation | New illustrator-credit/model-language/real-language-conflict/combined-mark tests; unsupported languages stay unresolved |
| Sports PA-JD and alphanumeric collectors | Existing sports-collector-reading tests; syntax consistency only, no runtime sports catalog |
| Multi-player sports | Existing sports-multisubject tests; explicit member/readings attribution, contradictions retained, maximum four members |
| Copy serial vs collector, subset/title/foil | Existing sports regressions; serial observation is not authenticity or exact parallel |
| Ambiguous/unavailable/conflicting catalog | Existing catalog-reconciliation, reviewed-set-discovery and identity-stage tests; missing candidates do not create false field conflicts |
| Printing/rarity/artwork separation | Existing source-catalog/variant/snapshot tests; core identity never authenticates physical printing |
| Financial withholding | Existing complete-handler, saved/copied-report and financialSafety tests; catalog support cannot unlock unsupported estimates or recommendations |
| Security/mobile | Existing owner-diagnostic, Preview-routing, HEIC and front/back tests retained |

Existing fixtures are reused rather than duplicated. Seven additional tests exercise language and observed-reason defects, including actual handler and owner export paths. All fixtures are mocked/synthetic and do not add live attempts or accuracy scores.

## Freeze and reopening criteria

Keep the current identity-only/full-scan separation and model-observation/canonical distinction. Limited owner-authorized scans demonstrate technical progress, not statistically established precision or cross-category coverage. Photographic readings are model observations, not independent OCR. Sports remains AI-only; other TCG categories lack a connected trusted category catalog. Foil, alternate stamps, language-specific printings and artwork authentication require independent evidence, often physical inspection. The limited physical-card benchmark and bounded catalog retrieval do not establish exhaustive coverage.

Defer additional provider adapters, catalog expansion, more reviewed set codes/letter-only sports schemes, approximate aliases, OCR engines and identification redesign. Reopen only for reproducible safety/identity regression, a retained diagnostic exposing a concrete defect, independently reviewed new catalog/source coverage with licensing, or benchmark evidence demonstrating a specific failure class. Any change must preserve original observations, category-specific collectors, provenance, ambiguity and financial withholding. Never reopen merely to force a single photograph to verify.

Phase 2 must work with existing identity results, allow useful nonfinancial observations when identity is unresolved, and never change identity confidence or catalog status based on condition appearance.

## Validation

Full offline suite: 401 passed, zero failed, zero skipped (394 existing plus seven new). Production build passed, including all four catalog snapshot/reviewed-set/reviewed-source/license traced-asset checks. No live AI or marketplace calls were made.

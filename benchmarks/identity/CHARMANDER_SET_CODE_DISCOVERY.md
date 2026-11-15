# Charmander: clear printed set code and bounded catalog discovery

Base: `d7e07bfebada7f71ab1bd666747d0940c5324b01`. Historical scan: `10906ad7-950f-4859-9a8e-174d02b2f6fc`.

## Real evidence, preserved unchanged

The owner reports a successful front-only identity scan reading Charmander, 2023, 004/165, Common, English and clear `MEW EN`. Printed evidence had no missing readings or conflicts, but catalog outcome was ambiguous with `catalog_candidates_ambiguous`, no accepted candidate, and finances withheld. The supplied prepared front SHA-256 is retained exactly in historical observation H-CHAR-01. No original photo, raw exported diagnostic, catalog candidate page, token usage, duration, model confidence or verified deployed revision was supplied. They remain unavailable; the engineering base is recorded only as context.

This is historical evidence, not a new scan, independently bound photo or completed accuracy test. Its original ambiguity is never replaced with the offline replay's supported result. The public historical report now contains six owner summaries across three physical-card groups, all excluded from measured accuracy.

## Confirmed causes and remaining uncertainty

1. `catalogInvestigation` correctly parses clear `MEW EN` into code MEW and language EN, preserving the original transcription and full 004/165 reading.
2. The adapter previously used `tcgdexSnapshot.reviewedSetForCode`, whose metadata was derived from the narrow 30C printing snapshot. MEW was absent. Consequently the clear marking could not select a set before discovery.
3. Without a reviewed set, the adapter queried the global English card index using name/local-number filters. Numeric comparison normalizes 004 to local 4 for retrieval, while the original full reading remains intact. A five-item first page returns ambiguous **before fetching full card/set records and denominator filtering**. This protects against truncation but can prevent a known card from being examined.
4. The same top-level ambiguity code also covers multiple accepted identities. The owner's summary does not retain the candidate page or the exact branch-specific diagnostics. Therefore the missing MEW mapping and global fallback are confirmed code defects/limitations; the exact live list and which ambiguity branch fired cannot be proven. The crowded-page replay is an explicitly mocked reproduction, not a downloaded historical payload.
5. Cross-check deduplication previously omitted TCGdex record ID from its identity key. Distinct legitimate IDs with identical displayed core fields could collapse. The key now retains distinct IDs, while repeated observations of the same ID and identity still deduplicate. This preserves ambiguity rather than manufacturing uniqueness.

## Verified metadata and reusable resolver

The pinned [TCGdex 151 set source](https://github.com/tcgdex/cards-database/blob/a8fe5736aef9bd6be2436e3be730109030f4c6e2/data/Scarlet%20%26%20Violet/151.ts) independently declares:

- Provider set ID **sv03.5**, English name **151**.
- Official collector denominator **165**, release **2023-09-22**.
- Official code **MEW**, with an explicit French code override **151**.
- Declared localized names, including English. The API request language and independent returned set/card data must still agree; this is not proof of a photograph's language.

The Git blob is `9beb49e95513181eaea7d0ba096b258d12d24008` at revision `a8fe5736aef9bd6be2436e3be730109030f4c6e2`. This is TCGdex's provider identifier and reviewed catalog metadata, not a claim that the ID is a universal manufacturer ID.

`data/tcgdex/reviewed-sets.json` packages this literal and the independently reviewed [30C set literal](https://github.com/tcgdex/cards-database/blob/a8fe5736aef9bd6be2436e3be730109030f4c6e2/data/Mega%20Evolution/30th%20Celebration.ts). `lib/reviewedSetCodes.mjs` verifies the exact artifact SHA-256, repository/revision, restricted literal structure and set fields, and derives Git blob provenance. It never executes source code or fetches updates at runtime. The artifact digest is `34b0bb30cda7a85f4adf8fd7e2c62223c936e6238ff80b4b8284f700b7e64190`.

Resolution is by **clear printed code plus supported language**, not card name, year guess, rarity or confidence. Multiple matching source entries return ambiguous without making provider requests. A known code with a conflicting language remains incomplete; missing/invalid source assets fail closed. Unknown codes retain the existing bounded global fallback and exact local checks, not a guessed set mapping. Uncertain readings never enter this resolver as clear evidence.

The adapter fetches the reviewed set endpoint first and checks ID, localized name, official count and release date. A valid set list is filtered locally by exact subject and collector local number, then actual card records are fetched and rechecked against the reviewed set, full denominator and language. No matching card is fabricated from set metadata. If the service lacks a complete usable list, the existing bounded fallback may still remain ambiguous. No extra pagination or retries were introduced.

The old snapshot/printing helper remains intact for its original compatibility and provenance tests. Actual catalog discovery now uses the separate generic set resolver. This does not extend the old Pikachu/Greninja printing correction, change variant thresholds or authenticate Charmander's foil treatment.

## Before/after offline cases

All provider-shaped responses and image wrappers in these tests are synthetic. List fillers and totals are test scaffolding, not assertions about the real hosted 151 list size or contents.

| Fixture | Before / bounded baseline | After |
| --- | --- | --- |
| Clear MEW EN, 004/165, crowded global page | Five-item page returns ambiguity; no candidate examined | Reviewed 151 list selects one card; two provider requests; original number/marking unchanged |
| Another subject in MEW | No name-specific mapping | Same reusable scoped lookup, no hard-coded Charmander exception |
| Existing 30C cases | Reviewed source correction and prior safeguards | Existing catalog/snapshot/Pikachu regressions still pass |
| Wrong denominator | Must not accept another total | No card returned; denominator retained and rejected |
| Wrong set or explicitly conflicting returned language | No exact identity allowed | Candidate rejected or incomplete; no finance approval |
| Unknown code | Bounded global retrieval | Still bounded and potentially ambiguous; never guessed |
| Duplicate code/language mappings | Unsafe first-match resolution must not be used | Ambiguous, zero provider requests |
| Multiple legitimate card IDs | Could collapse if displayed core fields matched | Retained as multiple candidates; ambiguous |
| Uncertain marking | Cannot establish a clear set constraint | Still no reviewed-code lookup from the uncertain text |
| Unavailable service / incomplete list / missing card | No fabricated fallback identity | Remains unavailable, incomplete or not found; no retries |

The successful offline handler case supports catalog and printed-identity agreement, but physical-printing verification stays false and every financial recommendation remains withheld. This is not evidence that the historical real scan is now verified or that the currently hosted service will return the mock list.

## Diagnostic adequacy

Previously, authorized exports retained the final outcome/reason and selected reference, but not a source-aware discovery strategy or page/mapping counts. `catalog_candidates_ambiguous` alone could not distinguish missing mapping, truncation, duplicate mapping or multiple exact identities.

The existing owner-authorized export now includes an allowlisted `catalogDiscovery` summary: strategy, mapping status/count, known reviewed code/set/language/count and source revision/blob, actual provider request/cache counts, locally filtered page counts, list completeness and adapter record-candidate count. This last count is **not** a trusted identity count. Branch-specific reasons distinguish global page limits, multiple scoped candidates, multiple exact identities and duplicated reviewed mappings. Dot-containing valid TCGdex references such as `sv03.5-004` are no longer silently redacted.

No endpoint URL, raw query, candidate list, provider body, pricing, credential or photo is added to diagnostic exports. Request limits remain nine provider GETs, the existing timeout/deadline and bounded cache; no new retry, pagination, provider or paid AI stage is introduced.

## Validation and changed files

The full automated suite, production build and four-asset prediction-function trace checks must pass before push. New offline tests cover source pins, MEW/30C, localized codes, denominators, language/set rejection, unknown and duplicated codes, unavailable/incomplete services, multiple IDs, another subject, original historical evidence and safe diagnostics. Existing sports, HEIC, structured-output, financial, snapshot and provenance protections remain required.

Changed runtime files: new `lib/reviewedSetCodes.mjs` and `data/tcgdex/reviewed-sets.json`; adapted `lib/pokemonCatalog.mjs`, `lib/catalogIdentity.mjs`, `lib/catalogResolution.mjs`, `lib/scanDiagnostics.mjs`. Packaging/tests: `next.config.js`, `scripts/check-tcgdex-packaging.mjs`, `tests/tcgdex-packaging.test.mjs`, new `tests/reviewed-set-discovery.test.mjs`, `tests/identification-benchmark.test.mjs`, `package.json` (test script only). Benchmark evidence/report files preserve the original scan summary and update the reproducible historical report.

No paid calls, additional real scans, merges, force pushes, manual deployments or Production changes. Stop for review.

Validation completed: **376 passed, 0 failed, 0 skipped** (363 baseline plus 13 set-discovery regressions). Production build passed, with reviewed set metadata, reviewed card source, original snapshot and MIT license all traced and present in the prediction function.

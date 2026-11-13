# Real Zapdos reconciliation: core identity versus printing

Base: 3c37d206cdb3a1e97aeccd3df738bd58a2ccdd41.
Reference: owner-reported scan ebc24d1e-ab56-49b6-b190-0ebc56abc524.
No paid, live catalog, condition or marketplace request was made for this repair.

## Root causes and evidence limits

The live scan got past the former JSON problem: HTTP 200, end_turn, 405 output
tokens, an identified subject/number/language and catalog reference 30th-133.
Original release year/set were null; confidence was 72. The printed J 30CEN and
copyright-year readings were uncertain. This is a verification-dimension problem,
not another upload or response-format failure.

Confirmed code defects, reproduced offline against the exact base modules:

1. The diagnostic conflict allowlist omitted finish. catalogIdentityConflicts can
   return finish and the aggregate catalog outcome can legitimately be conflict,
   while the export filters that field out and reports an empty conflicts list.
   Missing model year/set are skipped in comparisons; they are not contradictions.
2. An aggregate finish/parallel conflict caused the pipeline to reset the canonical
   card to its original model proposal, discarding independently supported year/set
   facts. Core subject/number/set/year/language and printing were conflated.
3. Identity-only catalog correction could overwrite a conflicting model parallel
   with the candidate label. Baseline reverse-holo/alternate-art Pikachu fixtures
   became Special Art and were marked catalog/photo supported. Financials remained
   blocked. The new identity-only path retains conflicting parallel proposals;
   source catalog facts cannot erase that negative evidence.
4. Diagnostic exports did not distinguish initial, post-correction and final
   comparisons. A pending comparison could be confused with a current contradiction.

The supplied summary does NOT retain identifiedParallel, candidate.variants or
candidate.parallel. Therefore the exact finish branch fired by the real scan is
not proven. A synthetic Holo proposal versus normal-only catalog metadata exactly
reproduces its visible shape; missing finish metadata can also block the old finish
check. These are labelled hypotheses in fixtures, not asserted live record values.

## Targeted changes

- Add a pure catalog comparison that separates core facts from printing. Core
  support requires a unique complete referenced TCGdex candidate, matching complete
  core fields/language, no protected core contradiction, and no unresolved number,
  language or prior core conflict. It does not grant photo/pricing eligibility.
- In identity-only responses, retain supported core year/set facts despite a
  printing dispute. The heading excludes the disputed parallel; the original AI
  observation and unverified parallel remain unchanged and available separately.
- Preserve the existing strict aggregate identitySearchGate and financial gate.
  Wrong collector numbers, sets, languages, protected values and printing variants
  remain rejected or unresolved. Do not automatically overwrite an initially
  conflicting parallel in the identity-only correction path.
- Record initial conflicts/missing fields, post-correction conflicts, actual final
  conflicts, protected-input/confirmation reasons, core blockers and printing status.
  Current final comparisons are recomputed, not invented from historical labels.
  Pending negative history remains blocking even if the final comparison is empty.
- Distinguish a positive finish/art disagreement from missing catalog finish/art
  evidence. Both block exact printing approval; missing evidence is unresolved,
  rather than proof of a different card. Never authenticate a physical printing.
- Owner-authorized exports retain finish, controlled proposed-finish enums and
  normal/holo/reverse capability booleans (or null when absent), as well as each
  comparison phase. No raw records, arbitrary variant labels, source URLs, photos,
  credentials, seller information or protected input values are added.
- Reports/copies/restores show core catalog, printed evidence, rarity, catalog
  printing, variant, artwork, physical printing and finance separately. Rarity
  support requires agreement with the candidate rarity on every restore; Holo does
  not imply SIR. Untrusted cached support flags are recomputed.

## Why J 30CEN stays uncertain

The existing bounded subject/local-number lookup already returned 30th-133; the
scan does not demonstrate a discovery failure. No fuzzy mapping is needed to fix
this case. Only a clear reviewed 30C / 30C EN marking guides constrained set lookup.
The uncertain text remains verbatim with its uncertainty; J is not stripped and
30CEN is not silently promoted to clear 30C EN. Copyright 2026 is not release-year
proof. Independently returned catalog facts may establish the catalog's 2026 set,
but cannot confirm the photographed set marking or physical finish.

## Reproducible before/after fixtures

The base modules were fetched at the exact commit and run in an isolated temporary
copy against the same mocked HTTP/catalog wrappers. No provider was called.

| Fixture | Before | After |
| --- | --- | --- |
| Reported core facts only, no assumed parallel | Catalog correction to 2026; photo unresolved for setCode | Core support explicit; original null year/set/72 retained; same photo blocker |
| Synthetic Holo versus normal-only metadata | Internal finish conflict exported as []; year/set reset to null | Core 2026/30th Celebration retained; finish visible in all relevant phases; printing conflict; exact/photo approval blocked |
| Synthetic Holo with missing finish flags | Finish check blocks, but missing metadata not clearly distinguished | Core supported; printing unresolved/incomplete; capability flags remain null; no exact approval |
| Wrong model 2025/Paldea Evolved | Catalog correction, final exported conflicts empty | Same safe correction; initial year/set differences retained separately from empty corrected/final lists |
| Pikachu correct printing/provenance | Supported through narrow snapshot correction | Same provenance and support retained |
| Pikachu reverse-holo or alternate-art proposal | Overwritten with Special Art; catalog/photo supported in baseline | Conflicting proposal retained; strict catalog/photo/exact gates blocked; core record can still be supported |
| Wrong full number/denominator or clear set/language | Rejected/unresolved | Rejected/unresolved; no borrowed core facts or fake field comparisons |
| Protected 2025/Different Set or missing language | Blocked | Blocked with explicit core/confirmation reasons; user values preserved |
| Pending old finish comparison with no final differences | Aggregate conflict without comparison lineage | Prior/post/final lists distinct; pending history explicitly unresolved and still blocking |

The fixture JSON is a source-attributed owner-summary reconstruction, not a retained
raw response. Literal name/number/language reading wrappers model the reported
setCode-only gap; their original transcriptions were not supplied. Copyright text
uses only the reported 2026 year and remains uncertain. Candidate metadata uses
existing pinned independent TCGdex facts. Alternative finish flags, parallel labels
and ambiguous candidates are explicitly synthetic adversarial cases. No Zapdos
printing override or fabricated production catalog record was added.

## Validation and unchanged boundaries

303 tests passed, 0 failed, 0 skipped (287 existing plus 16 new). The production build
and TCGdex snapshot/license tracing checks passed. The actual SDK is used with a
mocked HTTP transport for the new handler fixtures. Structured output, one paid
attempt, 2,000 output tokens, 45-second timeout, no retries/fallback, owner diagnostic
authorization/encryption/privacy, HEIC handling, sports matching, catalog provenance,
neutral-evidence thresholds and all financial withholding remain unchanged.

No main, Production configuration, subscription, SDK dependency, merge, force push
or manual deployment change. Stop for review; no new live scan is requested here.

## Changed files

- lib/catalogComparison.mjs
- lib/reconcileMarketIdentity.mjs
- lib/pokemonIdentityPipeline.mjs
- lib/pokemonReportIdentity.mjs
- lib/photoIdentity.mjs
- lib/reportVerification.mjs
- lib/catalogResolution.mjs
- lib/scanDiagnostics.mjs
- lib/identityStage.mjs
- src/components/IdentityResult.jsx
- tests/fixtures/zapdos-live-identity-evidence.json
- tests/helpers/zapdosLiveFixture.mjs
- tests/identity-live-reconciliation.test.mjs
- docs/ZAPDOS_LIVE_RECONCILIATION.md

The legacy aggregate catalogOutcome still describes the strict combined
identity/printing gate. Its conflict label must not be read as a core-card
contradiction: catalogComparison.core and catalogComparison.printing provide the
separate interpretation, including incomplete or ambiguous printing evidence.

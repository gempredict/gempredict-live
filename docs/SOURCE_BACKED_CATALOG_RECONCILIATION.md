# Source-backed catalog reconciliation

Base: `3bce90f3db3d626ed2a4b2ee169af30663a636fe`. Scope: reviewed catalog evidence and truthful reports; no new paid calls or real-photo scans.

## Findings

The reviewed TCGdex revision is `a8fe5736aef9bd6be2436e3be730109030f4c6e2`. The exact Zapdos and Pikachu card literals and their set literal are packaged in `data/tcgdex/reviewed-source.json`. Zapdos explicitly declares Illustration rare, holo, 30th-anniversary stamp and regulation J. Pikachu explicitly declares Special illustration rare, holo, the same stamp and regulation J. These are distinct rarity classes, not equivalent artwork descriptions.

The upstream schema uses a variant array. The hosted REST schema documents availability flags: normal=non-foil, holo=holofoil, reverse=reverse holofoil. Comparing the reviewed array with these flags is a schema translation, not permission to infer foil from rarity. GemPredict copies the hosted Boolean values directly; local normalization does not change Zapdos holo=true into holo=false. The existing printing override does not include Zapdos.

The hosted Zapdos flags in this task are owner-reported evidence. Attempts to retrieve the current hosted card and set through the browsing tool failed. No new hosted payload, update timestamp, generated-default detail or deployment revision was obtained. Therefore stale/generated hosting is plausible but not confirmed. Neither the implementation nor fixtures invent those missing values.

Source links:

- [Zapdos source](https://github.com/tcgdex/cards-database/blob/a8fe5736aef9bd6be2436e3be730109030f4c6e2/data/Mega%20Evolution/30th%20Celebration/133.ts)
- [Pikachu source](https://github.com/tcgdex/cards-database/blob/a8fe5736aef9bd6be2436e3be730109030f4c6e2/data/Mega%20Evolution/30th%20Celebration/149.ts)
- [Set source](https://github.com/tcgdex/cards-database/blob/a8fe5736aef9bd6be2436e3be730109030f4c6e2/data/Mega%20Evolution/30th%20Celebration.ts)
- [Hosted field meanings](https://tcgdex.dev/reference/card)
- [TCGdex detailed-variant design](https://github.com/tcgdex/cards-database/issues/834)

## Mechanism and authority

The generic server loader verifies the whole source artifact's pinned SHA-256, each Git blob SHA, exact repository/revision, and literal source facts against a small reviewed registry. It uses the existing restricted literal parser, never executes downloaded TypeScript, never fetches sources at runtime, and requires the packaged MIT notice. This checkpoint reviews English evidence for two specific catalog IDs; other cards and revisions receive no inherited support. Adding coverage requires a deliberate source review, new pins and tests.

The catalog adapter retains hosted flags before any existing correction, provider/card/set/language reference, retrieval timestamp, provider update timestamp when present, rarity, regulation mark, bounded detailed printings and additional variant flags. Hosted source revision remains null because it was not established. The response does not retain entire provider responses or pricing.

Reports recompute source support from exact canonical name, full collector number, set, year, language, catalog reference, validated source receipt and registry pins. They do not trust saved source-support booleans. Missing/stale receipts for reviewed identities cannot silently restore photo approval.

Rarity, artwork, foil capabilities, stamped printing combinations and regulation mark are separate dimensions. Explicit rarity claims from both model rarity and composite parallel fields are compared; contradictory claims cannot conceal an SIR-versus-IR mismatch. Bare holo/full-art is not classified as a rarity. Catalog source facts do not establish photographed foil, stamp, artwork or authenticity.

### When source evidence supersedes hosted metadata

**No new hosted overwrite is authorized here.** Reviewed facts may populate separately labeled source-supported fields. Contradictory flags or detailed printing declarations retain both representations and remain unresolved for exact-photo support. Missing hosted flags remain null; source facts never fabricate replacement flags.

The older Pikachu/Greninja snapshot correction remains unchanged. Only that existing mechanism may replace its previously reviewed generated default: exact identity/provenance, known previous/correction revision window, explicit newer printing, generated-normal signature and other original checks must pass. The new report layer recognizes the exact pinned prior Pikachu review so it does not undo the established correction. Original hosted flags and detailed record remain retained. This does not extend that exception to Zapdos or to a genuine explicit non-holo variant.

An unresolved source disagreement or explicit model/source rarity conflict adds a veto to report-level exact-photo eligibility; it never grants eligibility. Existing core matching, sport rules, printed-reading certainty, neutral-evidence thresholds and financial eligibility remain authoritative. Existing historical/final conflict arrays are retained rather than rewritten to force agreement.

## Before/after offline outcomes

The tests use mocked transport and synthetic photos, not new scans. The Zapdos wrapper contains the supplied composite proposal and uncertain marking; unavailable original brandSet conflict input is not invented.

| Fixture | Before | After |
| --- | --- | --- |
| Zapdos SIR composite; hosted normal=true/holo=false | Core supported, generic finish + parallel blockers | Same core and blockers; explicit hosted/source disagreement; source IR/holo/stamp/J; AI rarity conflict; photo/finance withheld |
| Hypothetical source-compatible holo flags | Parallel unresolved | Same restriction; source availability agrees, but SIR claim explicitly conflicts with IR; no physical-printing approval |
| Missing hosted flags | Printing incomplete | Flags remain null; source facts separately supported; no substitution or approval |
| Explicit non-holo detail on reviewed holo card | Hosted comparison only | Explicit normal detail preserved; unresolved source disagreement, never auto-converted |
| Unreviewed non-holo catalog fixture | No reviewed source | Still no reviewed source, unchanged non-holo capabilities |
| Different hosted rarity or stamp/regulation | Incomplete cross-representation explanation | Both retained; attribute-specific disagreement; photo/finance blocked |
| Wrong number, denominator, protected set or language | Existing rejection/unresolved | No reviewed source can be borrowed; existing protections retained |
| Altered/stale source receipt or source artifact | No source-evidence mechanism | Integrity fails or source unavailable; no forged photo support |
| Pikachu with original reviewed generated-default correction | Existing supported core/correction | Correction and original hosted provenance retained; source SIR/holo/stamp/J separately reported; finance withheld |
| Uncertain J 30CEN / J 30C EN | Missing clear set-code support | Original text/certainty unchanged; possible regulation J + 30C + EN interpretation only; photo unresolved |

Independent source support is available for the catalog rarity, declared foil capability, declared stamp combination and regulation mark. Artwork comparison, physical-printing authentication and uncertain photograph readings remain unresolved. No condition or marketplace stage is added.

## Validation and files

Full offline suite: **326 passed, 0 failed, 0 skipped** (303 existing, six prior audit regressions, 17 implementation regressions). Production build includes the new regression files. Packaging checks require the reviewed source artifact, existing snapshot and MIT license in the prediction function trace. The upstream license was fetched at the pinned revision and its MIT/copyright notice agrees with the packaged notice.

- New runtime: `lib/reviewedCatalogSource.mjs`, `lib/sourceCatalogEvidence.mjs`, `lib/reviewedCatalogRegistry.json`, `data/tcgdex/reviewed-source.json`.
- Adapted catalog/report/diagnostics: `lib/pokemonCatalog.mjs`, `lib/catalogIdentity.mjs`, `lib/pokemonReportIdentity.mjs`, `lib/reportVerification.mjs`, `lib/scanDiagnostics.mjs`.
- Packaging/test execution: `next.config.js`, `scripts/check-tcgdex-packaging.mjs`, `tests/tcgdex-packaging.test.mjs`, `package.json` (test script only).
- Regression evidence: `tests/source-catalog-reconciliation.test.mjs`, `tests/catalog-finish-audit.test.mjs`, `tests/fixtures/zapdos-finish-upstream-source.json`.
- Reports: this document and the historical `docs/CATALOG_FINISH_ACCURACY_AUDIT.md`.

No provider prompt, SDK request shape, output budget, paid-call count, retry policy, diagnostic authorization, HEIC conversion, sports matcher or financial-safety implementation changed. No new subscription, paid request, manual deployment, merge or Production configuration change. Stop for review before a new real-photo scan.

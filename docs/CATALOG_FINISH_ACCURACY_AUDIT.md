# Catalog finish accuracy audit

Base: `3bce90f3db3d626ed2a4b2ee169af30663a636fe`. Investigation and offline tests only; no runtime changes or new scan.

## Retrieved evidence

TCGdex cards-database master resolved to `a8fe5736aef9bd6be2436e3be730109030f4c6e2`. Retrieved the actual card and set TypeScript source at this immutable revision through GitHub. The card content also matches the previously retained `00da1023eddd6878a0bd12570abde1760dba61c7` source. The new fixture retains source text, not a reconstructed hosted API response.

- [Card source](https://github.com/tcgdex/cards-database/blob/a8fe5736aef9bd6be2436e3be730109030f4c6e2/data/Mega%20Evolution/30th%20Celebration/133.ts): Zapdos, Illustration rare, regulation J, one explicit holo variant with 30th-anniversary stamp. Provider catalog references are present, but do not authenticate a photographed copy or any sale.
- [Set source](https://github.com/tcgdex/cards-database/blob/a8fe5736aef9bd6be2436e3be730109030f4c6e2/data/Mega%20Evolution/30th%20Celebration.ts): 30th Celebration, official count 128, release 2026-09-16, code 30C.
- [Official field documentation](https://tcgdex.dev/reference/card): normal means a non-foil version is available; holo means a holofoil version is available; reverse means a reverse-holo version is available. These are catalog capabilities, not detection or authentication of the uploaded photograph.
- [Maintainer detailed-variant design](https://github.com/tcgdex/cards-database/issues/834): type, size, stamp and foil are separate attributes. Legacy flags are limited; detailed variants are intended to represent physical combinations.
- [Pokémon rarity explanation](https://www.pokemon.com/uk/news/pokemon-tcg-scarlet-and-violet-revamps-pokemon-tcg-card-aesthetic): Illustration Rare and Special Illustration Rare are distinct rarity classes. Full-art foil description alone does not establish SIR.

Direct hosted card/set URLs could not be retrieved with the browsing tool. Therefore current hosted `updated`, `variants_detailed`, generated-default status and deployment revision remain unverified. The normal=true/holo=false/reverse=false payload is owner-reported diagnostic evidence, not a newly downloaded response. Source/API deployment skew is supported as an explanation, but its precise cause is not established.

## Confirmed local findings

`lib/pokemonCatalog.mjs:128`: retains provider rarity and legacy variants; maps SIR rarity to Special Art but Illustration rare to null parallel. It does not retain detailed variants for general downstream comparison. The narrow snapshot reconciliation receives the full hosted card before that loss.

`lib/tcgdexSnapshot.mjs`: reviewed correction records are only 30th-149 and 30th-148. Zapdos source metadata exists in a test fixture but is not an authorized runtime printing correction. Zapdos therefore retains hosted flags. This is a scope limit, not evidence that all normal defaults should be rewritten. Existing freshness, identity, generated-default and provenance checks must remain.

`lib/catalogIdentity.mjs:90`: holo proposal plus holo=false produces finish conflict. This matches documented flag semantics but cannot establish physical non-foil certainty when the catalog sources disagree. `normal` must not be redefined to mean base artwork or normal rarity.

`lib/catalogNormalization.mjs`: bare SIR maps to Special Art; composite `Special Illustration Rare (full-art holo)` leaves artwork text `special illustration rare full art`. `lib/variantDescriptor.mjs` separately extracts Special Art and holo. These contracts conflate rarity and artwork and normalize differently.

`lib/catalogIdentity.mjs:94`: structured proposed Special Art compared with null catalog parallel yields generic parallel conflict; missing artwork metadata is not a direct rarity comparison. `lib/catalogComparison.mjs` classifies this as incomplete unless other positive disagreement exists. After hypothetical holo support, this fixture remains unresolved for parallel, rather than explicitly reporting SIR versus IR.

`lib/pokemonReportIdentity.mjs`: catalog rarity status means canonical rarity equals independently referenced candidate rarity. It does not mean the original AI rarity agreed, nor does it verify artwork, foil, stamp or photographed printing. The report needs an explicit original-proposal rarity comparison to make that distinction clear.

## Replay outcomes

The wrapper reuses reported uncertain J 30CEN, null original year/set, name/number/language and confidence. It is not the raw live response; original brandSet conflict input was not supplied in this assignment and is not invented.

| Offline input | Result |
| --- | --- |
| Reported SIR phrase plus reported normal-only flags | Core supported; final finish + parallel; photo false; finance false |
| Same proposal with hypothetical holo capability from source | Core supported; final parallel; variant needs confirmation; photo false; finance false |
| Reverse Holo proposal | Printing unresolved/conflicting, never photo approved |
| Wrong number/denominator/language | Exact photograph support blocked; finance withheld |
| Zapdos passed to current snapshot override | No rewrite; cannot inherit Pikachu/Greninja authorization |

## Recommended next implementation, pending review

1. Retain detailed catalog printing capabilities with provenance and revision, distinguishing explicit source declarations from generated/default data. First obtain the hosted metadata needed to explain source disagreement; do not globally reinterpret false flags or extend the correction from resemblance alone.
2. Introduce separate proposed/catalog rarity, artwork observation, foil treatment and printing attributes (stamp/size/etc.). Report explicit SIR-versus-IR disagreement while preserving the original observation. Normalize composite labels consistently, without equating IR and SIR or inferring texture/foil from rarity.
3. Treat contradictory catalog sources as unresolved printing evidence. Keep core support, exact-photo support, artwork, physical printing and financial eligibility separate. A catalog holo capability cannot prove the photograph is holo or authentic.
4. Keep the uncertain set-code reading unresolved. Source regulation J and code 30C make the transcription plausible but do not upgrade its visual certainty.

Historical investigation checkpoint (implementation now documented in SOURCE_BACKED_CATALOG_RECONCILIATION.md). Changes at that point: this report; source fixture `tests/fixtures/zapdos-finish-upstream-source.json`; six offline tests in `tests/catalog-finish-audit.test.mjs`. No production behavior changed. This historical section describes the investigation before implementation approval.

# Phase 5M catalog-to-sales crosswalk

Use the immutable owner-protected Phase 5M Preview with the existing saved-report and Free sales bindings scoped to `feature/catalog-sales-crosswalk-phase5m`. No catalog adapter or credential is installed. The sales key is used only for the existing sales endpoint.

A future reviewed adapter can register provider-scoped, typed catalog identifiers. The Card API namespace supports UCID, USID, URID and CFID as opaque typed identifiers. The adapter must explicitly review which identifier and source reference link a sale to an exact variant. Equality of a set, family or unrelated identifier does not supply that link. Catalog evidence can show that an exact variant exists. Verification of the owner's physical copy still requires independent evidence.

The offline reviewed Phase 5D Sales contract lists `listing_type` and omits `sale_type`. Phase 5M keeps the listing separate from explicitly recognized transaction outcomes. Legacy rows are marked as listing-type-only. An unsupported or contradictory explicit outcome withholds the amount and rejects that row. Missing price confirmation remains unknown. No projected amount verifies settlement or qualifies for valuation.

The crosswalk is temporary and leaves the existing Phase 3G, comparable-sales and economics gates unchanged. Synthetic source records and exact links exist only in offline tests.

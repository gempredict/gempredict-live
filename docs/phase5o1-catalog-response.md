# Phase 5O.1 combined owner Preview

The Catalog search transport and parser are registered only for `fix/catalog-response-contract-phase5o1`. The parser follows the owner-reviewed public search example with `data` and `pagination`, typed UCID and set USID values, nullable documented descriptive fields, and separate Catalog quota headers. It retains an incomplete-page warning and does not page automatically. The supplied search example does not establish wire fields for URID, CFID, UPID, exact parallel or photographed printing. Those details remain unresolved. Detail and family operations are not exposed to the owner workflow.

Configure the existing protected Preview diagnostics and saved-report bindings for this branch. After the owner independently confirms Catalog access and authorizes the test, configure these Catalog-only Preview variables:

- `GEMPREDICT_CARD_API_CATALOG_PREVIEW_ENABLED=true`
- `THE_CARD_API_CATALOG_KEY` as a Sensitive variable separate from the Free Sales key
- `GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE` as a review reference without credentials
- `GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_TIER` as `builder_catalog` or `pro`
- `GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_VERIFIED_UNTIL` as the approval expiry in UTC ISO format, including seconds and a trailing Z

Open the saved Ohtani report on the immutable protected deployment. Under **Catalog lookup**, authorize as owner and explicitly request one search. The current UI limits each request to the first page and up to 20 returned rows. Catalog existence cannot establish physical printing, an exact sale link, settlement, or financial eligibility. No Catalog credentials or entitlement were activated in implementation.

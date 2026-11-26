# Phase 5N owner catalog boundary

The Phase 5N Preview keeps eBay, historical sales, and the existing report. Catalog appears as unconfigured. The official public docs page was blocked by the workspace proxy. The reviewed Phase 5D Sales contract confirms separate entitlement but contains no catalog search contract. No catalog HTTP request can run on this branch.

To register a real transport, obtain official catalog operation URLs and methods, authentication requirements, supported filters and paging bounds, successful and error response schemas and quota rules. The review also needs the meaning and scope of UCID, USID, URID and CFID, and documentation of any exact sale-to-variant link. The existing sales key is separate and cannot be substituted.

The prospective Preview-only settings are `GEMPREDICT_CARD_API_CATALOG_PREVIEW_ENABLED`, `THE_CARD_API_CATALOG_KEY`, and `GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE`. Installing settings alone cannot enable the transport. Reviewed server code must register the supported operation, parser, entitlement validator and Phase 5M evidence adapter.

The owner endpoint uses the immutable Preview origin, diagnostic owner session and RLS-owned saved report. It admits one explicit request at a time with a ten-second per-instance cooldown, one bounded 20-record search, a five-second transport deadline and a 128 KiB byte cap. Normalized results use no-store and remain in temporary page state. A catalog variant association neither verifies a photographed card nor qualifies a sale. No catalog payloads are added to stored reports or analytics.

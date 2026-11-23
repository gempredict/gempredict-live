# Phase 5K comparable sales

Open a saved report on the immutable, access-protected Phase 5K Preview and request recent sales from its Market Intelligence Dashboard. Scope the existing Phase 5J Preview settings to `feature/qualified-market-comparables-phase5k`. There is no database migration or new provider binding.

The dashboard shows the Phase 5J catalog and physical-printing status separately. The recent-sales response includes a versioned record audit with reasons and coverage. A research candidate can be commercially restricted and have incomplete transaction evidence at the same time. eBay active asking prices never enter the audit.

The Free Card API projection treats provider result IDs as result identifiers, not transaction IDs. It makes no assumptions about settlement, lot size, or shipping, tax, and buyer-premium inclusions. Unknown Best Offer prices stay unknown. Free-tier sales and audits remain temporary and are excluded from the report snapshot, exports and analytics.

Future reviewed adapters would need to bind independent physical evidence to the catalog target and supply reviewed transaction evidence and rights. Phase 3G still evaluates exact identity, grading cohort, trusted provenance, deduplication and price basis. The new foundation also requires independently verified final price and settlement, and known buyer-premium treatment. It only reports cohort readiness and never computes or enables valuation or ROI. The qualified examples live solely in synthetic offline tests.

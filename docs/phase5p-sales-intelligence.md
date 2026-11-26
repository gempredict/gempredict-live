# Phase 5P sales intelligence

The owner-only Phase 5P Preview continues using The Card API for historical sales. Its adapter owns the Free Sales URL, window bounds and response parser. The central registry selects the primary adapter, credential, entitlement and per-instance quota controls. Card Ladder remains disabled with no transport, login automation or licensing assumption.

The research engine accepts independently normalized batches from enabled adapters. Its versioned evidence carries provenance, identity, grade, listing and sale outcome, amounts, transaction evidence, inclusion and rights fields where supported. The Card API adapter omits asking-price metadata and leaves unverified settlement, exact sale-to-catalog links, and quantity unresolved. The engine passes records through the existing comparable qualification and keeps distinct currencies and cohorts. The dashboard shows counts rather than a fair-market value.

An adapter may supply approved platform transaction references. Matching identity, date and price without trustworthy references flags possible overlap. Conflicts and suspected duplicates are retained. A failed source is reported separately and does not invalidate another source's records. The production-shaped Preview route still requests only the configured Card API source. The second provider and multi-source combinations are offline fixtures.

Results remain temporary and noncommercial. Existing owner authorization, two-window continuation, Catalog entitlement and grading-economics checks still apply. Use the existing protected Preview configuration scoped to `feature/provider-independent-sales-intelligence-phase5p`.

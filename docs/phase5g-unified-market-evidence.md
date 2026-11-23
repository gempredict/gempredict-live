# Phase 5G Unified Market Evidence

Open `/card-sales-pilot` on the immutable, SSO-protected Preview for `feature/unified-market-evidence-phase5g`. Authorize with Preview owner diagnostics, sign in to My Card Library, and select a saved report. Review the identity and choose one cohort. The date range and optional price limits apply to recent sales only.

The branch Preview needs the existing owner diagnostics and isolated Supabase library settings, `GEMPREDICT_CARD_API_FREE_PILOT_ENABLED=true`, and server-side `THE_CARD_API_KEY`, `EBAY_PROD_CLIENT_ID`, and `EBAY_PROD_CLIENT_SECRET`. Scope these bindings to Phase 5G Preview and keep the project's deployment protection enabled.

Each search retrieves up to 20 listed items and up to 20 sales. The Card API request is limited to three UTC calendar days and one cohort within the Free lookback. eBay and sales requests have independent failure states and neither retries. eBay shows a fixed ask only where the listing supports it and links only to an HTTPS eBay item URL corroborated by its item ID.

Identity labels describe the available listing evidence. The sales summary counts known and unknown final prices across the page, including rejected rows, separately from identity matches. A provider-reported amount, including a hammer price, does not establish settlement or inclusion of shipping, tax, or buyer premiums. Results are no-store, page-local, excluded from analytics and saved reports, and never feed valuation or grading calculations.

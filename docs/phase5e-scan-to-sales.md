# Phase 5E saved-card sales evaluation

Open `/card-sales-pilot` on the immutable, access-protected Vercel Preview for `feature/scan-to-sales-phase5e`. Authorize the Preview owner session, then sign in to My Card Library and select a report. The server reads the saved report again under the authenticated owner's ID. Review any missing or conflicting identity evidence before submitting. Owner edits apply to this lookup only and do not verify or update the archived report.

Scope these variables to the Phase 5E branch in Vercel Preview:

- `GEMPREDICT_CARD_API_FREE_PILOT_ENABLED=true` and Sensitive `THE_CARD_API_KEY`.
- `GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED=true` and the distinct Sensitive `GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY` and `GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY`.
- `GEMPREDICT_LIBRARY_ENABLED=true`, `GEMPREDICT_LIBRARY_PREVIEW_SUPABASE_URL`, `GEMPREDICT_LIBRARY_PREVIEW_PUBLISHABLE_KEY`, and Sensitive `GEMPREDICT_LIBRARY_PREVIEW_SERVICE_ROLE_KEY`. Use the authorized Preview library that contains the owner's saved reports. Keep its project separate from Production.

Each submission requests one Raw or PSA 8, 9, or 10 cohort, at most 20 rows, and up to three UTC calendar days within the Free lookback. It uses the documented title query and does not retry. The pilot labels listing evidence as consistent, incomplete, or conflicting, and lists the fields behind that decision. The comparison leaves absent evidence unknown, and no listing-evidence label verifies settlement, the physical card, or a Phase 3G comparable. The pilot makes no report writes and discards the results on navigation, owner change or expiry.

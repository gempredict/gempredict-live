# Card API completed-sales evaluation

The isolated Preview page is `/card-sales-pilot`. The pilot calls only `GET https://www.thecardapi.com/api/v1/market/sales` with the server-side `x-market-api-key` header. The feature is off by default. A live request requires the existing owner diagnostics session on the immutable Vercel deployment origin, the GemPredict project and exact Phase 5D branch. A library sign-in does not grant access.

## Preview setup

Scope `GEMPREDICT_CARD_API_FREE_PILOT_ENABLED=true` and the Sensitive `THE_CARD_API_KEY` binding to the `feature/cardapi-sales-pilot-phase5d` Preview. Keep Vercel access protection and the existing Preview owner diagnostics variables active for this branch. Use the immutable deployment hostname, authorize as owner and submit one explicit cohort search. The branch alias may fail the immutable-host authorization guard. Production and other branch deployments do not serve this pilot.

## Limits and evidence

Each submit makes at most one upstream request with a 20-row first-page limit, a six-second deadline and a 128 KiB decoded-body cap. Searches are limited to three UTC calendar days within the last 30 UTC calendar dates. Raw sends `graded=false`. PSA 8, 9 and 10 send `graded=true`, `grader=PSA` and the exact grade. The server rejects overlapping requests in the same instance. The provider enforces its shared Free-tier rate and row quota across instances. Sales quota headers are shown where present. There is no pagination, retry or backfill.

The pilot shows provider candidates and filter or metadata rejections separately. Amount confirmation is only a provider claim. No original asking price substitutes for an unknown final amount. Goldin is displayed as hammer price. Missing shipping stays unknown, and the adapter makes no assumptions about tax, premiums, settlement, card quantity, distinct transactions or exact printing. Repeated provider record IDs are rejected without interpreting them as marketplace transaction IDs.

The unchanged Phase 3G qualifier receives only supported evidence fields and no commercial rights or independently reviewed identity mappings. The pilot supplies no qualified financial benchmarks or grading-profit estimates. Results use no-store responses and browser memory, expire after five minutes or owner-session expiry and are cleared on navigation. They are not sent to analytics, appended to reports, written to Supabase or included in downloadable diagnostics. Schema differences report bounded expected field names and observed types only.

[Provider REST reference](https://www.thecardapi.com/docs) · [Provider terms](https://www.thecardapi.com/terms)

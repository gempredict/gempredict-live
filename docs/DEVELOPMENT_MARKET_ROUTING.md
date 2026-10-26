# Internal market routing

**Current Preview behavior is specified in [PRIVATE_PREVIEW_INTEGRATION.md](PRIVATE_PREVIEW_INTEGRATION.md): immutable deployment-origin validation, OIDC self-access and runtime preflight supersede the older Preview assumptions below.**

For local development and Production, `NEXT_PUBLIC_SITE_URL` must explicitly name the origin serving this checkout's `/api/ebay-search`. There is no hosted fallback. For the current local workflow use `http://127.0.0.1:3000` and run Next.js on port 3000. `http://localhost:3000` also works. Vercel Preview now requires its immutable platform origin and protected self-access. Restart the server after configuration changes; rebuild before reusing a local production build with a different public URL.

Missing/invalid origins, credentials embedded in URLs, paths beyond `/`, queries and fragments are rejected before any internal market request. An unavailable market result includes `routingError`, zero usable prices and no trusted valuation. Other analysis may still run; this guard is for internal valuation routing, not a global outbound-network switch.

`gempredict-live.vercel.app` (including subdomains, case variants and trailing-dot spellings) is blocked in local and preview environments. `NODE_ENV=production` does not authorize routing: local `next build` / `next start` uses that value too. Internal requests reject redirects, including redirects from an allowed origin to production.

## Intentional production routing

Only a separately authorized production deployment may target that host. It must run with `NODE_ENV=production`, explicitly configure an HTTPS production origin on the default port, and supply all three server settings:

- `VERCEL=1` — deployment platform marker.
- `VERCEL_ENV=production` — previews/development remain blocked even with the opt-in.
- `GEMPREDICT_ALLOW_PRODUCTION_MARKET_ROUTING=true` — explicit, server-only routing opt-in; do not add a `NEXT_PUBLIC_` prefix.

These settings are configuration safeguards, not independent authentication of the deployment. No production settings were changed by this fix. Existing production deployments without the opt-in will fail closed when running this code; enabling production routing requires separate authorization and configuration. Local/preview environments should not set this opt-in or impersonate production platform markers.

No secrets are needed to configure the origin or opt-in. eBay/Anthropic credentials remain separate. This change does not enable live integrations or authorize production access.

Validation: 136 automated tests pass, including real mocked prediction-handler missing/invalid/production-host cases, local/preview routes, explicitly authorized production routing using a mock transport, and an actual loopback-only redirect test. The complete 16-scenario Phase 1 browser matrix also passes, and the existing scenario observations, finalized predictions and valuation queries are unchanged. No authenticated external requests were made.

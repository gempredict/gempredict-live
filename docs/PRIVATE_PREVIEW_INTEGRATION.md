# Phase 1 private Preview integration

Baseline: `0b9423483875b55881406d712d9dc152b87e17b3` on
`restore/phase1-identity-market-matching`. No identity, variant, market-confidence,
valuation, comparable matching or Atlas decision rules are changed here.

## Implemented code-only safeguards

### Same-deployment routing

On Vercel Preview, the immutable platform `VERCEL_URL` hostname is mandatory.
Only HTTPS to that exact deployment origin is accepted. Explicit
`NEXT_PUBLIC_SITE_URL` values must agree; production, moving branch aliases,
other deployment origins, ports, paths, credentials, queries and fragments are
rejected. Known platform branch/production aliases cannot be the trust anchor.
No request `Host`, `Origin` or forwarded header supplies the origin.

When the legacy public origin is absent in Preview, routing derives from the
mandatory trusted `VERCEL_URL`. This avoids trying to predict a new deployment's
random hostname in advance. Missing/invalid platform routing still fails closed.
Development retains explicit local origin configuration. Existing authorized
production routing and its opt-in remain unchanged.

### Protected self-requests

Vercel's documented Trusted Sources mechanism is used: the platform's runtime
`x-vercel-oidc-token` is forwarded as `x-vercel-trusted-oidc-idp-token`, only after
same-deployment validation. Vercel verifies the token at the receiving protection
layer. Browser cookies, Authorization headers, automation-bypass secrets and
build-time token fallbacks are not forwarded. Tokens never enter URLs, JSON,
query diagnostics, exception messages or logs. Redirects are never followed.

A Preview POST first verifies routing, assets and protection, before parsing
images, logging to Supabase or calling any card/market/model provider. Two
bounded GET probes target the existing `/api/predict` method guard:

- Anonymous access must be denied/redirected by protection.
- OIDC-authenticated access must return the existing 405 method-guard response.

A public deployment, missing/expired/rejected token, redirect, wrong response or
unavailable endpoint cannot pass. These probes do not scan cards or write data.
There are at most two additional internal GETs, with a five-second deadline;
provider search budgets and decision logic are unchanged. Production and ordinary
local development do not run this Preview guard or forward these tokens.

Sources:
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources
- https://vercel.com/docs/oidc/reference
- https://vercel.com/docs/environment-variables/system-environment-variables

### Runtime catalog verification in the prediction function

With Preview-only `GEMPREDICT_PREVIEW_PREFLIGHT_ENABLED=true`, an authenticated
GET to the exact immutable deployment's `/api/predict?preflight=1` checks files
inside that deployed prediction function. It reads the snapshot and validates
its existing pinned digest, blob hashes, literal data and provenance. It reads
the LICENSE and checks its original byte hash. No downloaded TypeScript executes.

Successful private responses contain only `integrationReady` and Boolean checks
for routing, protection, snapshot and license. No paths, file contents, hashes,
credentials, images or raw errors are returned. Responses are `private, no-store`.
If protection cannot be verified, only a generic unavailable response is returned.
Without the opt-in, or outside Preview, GET retains the existing 405 response.
There is no new public diagnostic endpoint and no production diagnostic mode.

A green check proves actual runtime access for that function invocation, unlike
build tracing alone. No such deployed runtime check has been performed by this
code-only task. The old Preview cannot exercise code it has not deployed.

## Configuration portions stopped for approval

Read-only Vercel configuration inspection confirmed Authentication is enabled for
`all_except_custom_domains`. The available project API did not report OIDC /
Trusted Sources settings; neither their readiness nor live token validity is
claimed. No configuration or credential values were modified or copied.

The following require owner approval/configuration before a controlled scan:

1. Preserve Vercel Authentication for the entire replacement Preview.
2. Expose Vercel system variables, including `VERCEL`, `VERCEL_ENV` and the
   immutable `VERCEL_URL`. Do not substitute `VERCEL_BRANCH_URL` or user headers.
3. Split the shared `NEXT_PUBLIC_SITE_URL` binding so Production keeps its
   existing value and Preview leaves it absent. Alternatively, an explicit value
   must exactly match that immutable deployment, which is impractical to set
   before Vercel generates its hostname. Do not use a branch alias or loopback.
4. Enable Secure Backend Access with OIDC Federation if not already enabled.
   Runtime tokens must come from Vercel, not a manually copied static token.
   Same-project Preview access is normally allowed by Trusted Sources; only if
   customized, approve the exact same-project Preview-to-Preview rule. Do not
   broaden Production access. No long-lived bypass secret is required.
5. Set `GEMPREDICT_PREVIEW_PREFLIGHT_ENABLED=true` for Preview only to permit the
   private, provider-free runtime check. This flag does not weaken protection.
6. Configure the isolated Supabase bindings below before any real scan.

Changes to captured environment settings require a replacement build/deployment;
they cannot repair the existing immutable Preview in place.

## Supabase write audit and isolation requirement

The current project configuration has one shared Preview/Production binding for
`NEXT_PUBLIC_SUPABASE_URL` and one for `SUPABASE_SERVICE_ROLE_KEY`, with no branch
specific override observed. Their sensitive values were not read. These are
shared backend bindings; no separate Preview database has been established by
this assessment. Current Preview scans can write to the backend also configured
for Production. No backend requests, reads or writes were made during this task.

Server-side write paths:

- `pages/api/predict.js`: `prediction_logs` inserts (IP, card input, status/errors),
  including requests that fail ordinary validation or rate limiting.
- The same route: optional `waitlist_emails` insert when email is supplied.
- `pages/api/waitlist.js`: `waitlist_emails` inserts.
- Saved reports/history are browser-local storage, not Supabase writes.
- eBay notification `.update()` calls are hash operations, not database updates.

Smallest isolation strategy: use an approved isolated test Supabase project with
the same two tables and branch-specific Preview overrides for both URL and its
matching test service-role key on this restoration branch. Existing Production
bindings remain untouched. Obtain/configure those credentials through the owner;
do not guess a connection, reuse the Production service key or silently disable
legitimate Production logging/waitlist functionality. No database/client code or
server write behavior is changed by this task.

`integrationReady` is intentionally NOT a database-isolation attestation,
credential-validity check or authorization to spend on providers. Database
isolation and operator approval remain separate release gates.

## Exact safe replacement Preview procedure (not executed)

1. Review the saved commit and authorize the Preview-only configuration/security
   changes above. Establish test database schema/credentials separately.
2. Separately authorize a replacement **Preview**, from this existing restoration
   branch at the exact saved commit. Do not merge, promote or target Production.
3. Confirm READY and the exact full commit SHA in Vercel deployment metadata.
   Use its immutable URL, never the old URL or moving branch alias.
4. Confirm that deployment's build logs pass `check:catalog-packaging` for both
   snapshot and LICENSE, and review the effective Preview-only database bindings.
5. Sign in with the authorized Vercel account. Open the immutable
   `https://<deployment-host>/api/predict?preflight=1` in that authenticated browser
   (or existing authenticated Vercel CLI using the full URL). Do not create a
   public share link, put tokens in URLs or paste credentials into commands/logs.
6. Require HTTP 200, `integrationReady: true` and all four checks true. Any
   405/503, failed protection or missing asset is NO-GO. GET is provider-free and
   does not write Supabase records. Never POST a scan just to diagnose preflight.
7. Only after isolation and preflight are verified, separately authorize one live
   scan and its bounded provider usage. Use JPEG/PNG with combined multipart
   payload comfortably below Vercel's 4.5 MB limit, initially below 2 MB. The
   existing 5 MB-per-image UI limit and HEIC behavior are not changed here.
8. Record only timing, canonical identity, verification states, comparable count,
   confidence, valuation status/reason and user-facing errors. Do not export
   image-bearing request bodies, full HARs, cookies or authentication headers.

Until configuration, replacement deployment and deployed runtime checks are
approved/performed, the assessment remains **NO-GO for a live scan**.

## Offline validation

All 257 automated tests passed, including the exact trusted Pikachu fixture
through protected Preview routing, failed authentication, mismatched origins,
missing/corrupt runtime assets and existing saved-report protections. The
production build, snapshot validator, snapshot/license packaging check and all
four browser smoke scripts passed (`variant-ui`, `financial-consistency`,
`tcgdex-freshness`, `phase1-validation`). Provider responses were mocked; these
results do not establish live OIDC delivery or deployed runtime asset access.

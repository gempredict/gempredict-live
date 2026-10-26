# Live Pikachu report integrity and pricing diagnostics

Baseline: `edd77ca83c295167bde495cec105307e21a81f4f` on the existing restoration
branch. No live Anthropic/eBay calls, database writes, environment changes or
production deployments were performed for this checkpoint.

## Root causes and targeted corrections

1. The old condition sanitizer only removed superseded identity sentences when
   its catalog-corrected predicate passed, and matched complete source labels.
   Decorated labels such as `2023 Pokémon Paldea Evolved` did not match the shorter
   `Paldea Evolved` in prose; numeric years were ignored. The corrected filter
   normalizes these representations without requiring a successful catalog
   state. It removes known superseded subject/number/year/set/variant sentences;
   it never rewrites them into newly attributed visual observations. The live
   response body was not supplied, so which representation triggered the live
   leak cannot be established retrospectively. The known failing representations
   are now reproduced by tests.
2. The previous gate nulled `worthGrading` but left estimatedGrade, gradeCeiling,
   mostLikelyGradeRange, overallScore and confidenceLevel intact, and the UI
   displayed them independently. All grade projections now disappear whenever
   applicable valuation trust fails. Visual centering/corners/edges/surface notes
   remain, while unsupported PSA/candidate sentences are removed. The original
   AI identity/confidence remains only inside the labeled unverified panel.
3. Canonical fields now supply report titles, metadata and saved display names.
   Model-written report prose also passes the stale-identity filter. This
   prevents old model titles or saved displayName strings from overriding the
   corrected card. Current independent/variant/financial gates are unchanged.
4. Confirmation is a new JSON prediction request, not a cached-price unlock.
   It re-verifies identity, then runs fresh exact-identity valuation searches.
   A confirmed Holo Special Art version with no usable raw comparables must
   remain unpriced. Previously this successful-but-withheld response closed the
   editor without feedback, while revaluation still used unconditional JSON
   parsing rather than the mobile checkpoint's safer transport. Revaluation now
   uses that same authentication/HTTP/response handling and explicitly reports
   a completed fresh check that remains withheld. Stale report update targets
   fail explicitly. UI updates and saved-storage failures have distinct coarse
   client diagnostic codes; a storage failure cannot unlock cached prices.

The actual reason every live market query lacked usable prices cannot be
reconstructed from the supplied report. Zero Browse results, unavailable APIs,
legitimate listing rejections and a UI state failure must not be conflated.
No price or threshold was changed to manufacture a successful valuation.

## Safe diagnostic contract

The eBay endpoint now supplies fixed-code/count diagnostics: retrieved/provider
counts, eligible/used raw counts, graded/excluded counts, invalid price/currency,
below-threshold matches, outliers and bounded rejection categories. Empty API
results differ from retrieved-but-ineligible listings. OAuth, Browse, malformed
upstream responses, missing configuration, internal protection/redirect/HTTP failures,
timeouts and connection failures have distinct fixed codes. Raw OAuth/Browse
error bodies and exception messages are no longer returned by this endpoint.
Existing strict title/structured evidence/variant filtering is unchanged.

After the existing authenticated Preview preflight, Preview/development prediction
responses and server logs receive an allowlisted pricing receipt: a random request
ID, request mode (scan/revaluation/text), duration, gate states, outcome, used raw
count and bounded per-search aggregate diagnostics. The old unconditional pre-reconciliation Atlas identity/notes dump is removed.
No credentials, images,
headers, raw API errors, seller titles, URLs, prices or search strings enter this
receipt. Internal market redirects are observed with `redirect: manual` and rejected; they
are never followed, and their codes cannot be confused with empty API results.
The diagnostic object does not participate in ranking or trust. Ordinary
Production responses do not receive these receipts. No public diagnostic endpoint
or new environment flag was added. Receipt fields are carried into saved reports.

Browser diagnostic events distinguish an updated report, a stale state-update
target and saved-storage failure. These contain outcome codes only; no report,
image or authentication data is logged. Browser regressions verify the actual
DOM and persisted request ID, including a quota/storage failure.

## Supabase authorization diagnosis and remaining configuration blocker

The reported 42501 is an authorization/RLS denial of the `prediction_logs` insert.
This insert is best-effort and does not cause market withholding or fail a
prediction. The existing client is a plain server-only supabase-js client,
initialized from NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. It does
not accept browser cookies/Authorization or perform user sign-in. The client now
explicitly disables session persistence, refresh and URL session detection.
No role, authorization header or RLS policy is forced/changed.

Supabase documents that effective service-role Authorization does not run RLS
policies. Given the code path, an incorrect Preview credential binding (for example
anon/publishable instead of the intended server credential) is the leading
configuration explanation. A mismatched project/key or custom backend role also
needs checking. The supplied error alone cannot prove which setting is wrong.

Logging failures now emit only operation/environment, authorization-denied versus
unavailable, credential presence/class and coarse project-binding hints. Legacy
JWT role/ref fields are **unverified hints**, never authorization decisions; secret
key formats can leave project binding unverified. No credential, URL, decoded
claim, SQL, row content or raw database error is returned or logged. A generic
network-secret placeholder remains unrecognized rather than being treated as proof
of missing credentials.

Required owner action, in the isolated Preview backend only:

1. Confirm the replacement Preview uses the approved isolated Supabase project.
2. Verify its server-only key binding is an intended credential for that project,
   not a public/anon/user key. Do not paste/decode/export credential values into
   chat or logs. Correct bindings require separate configuration authorization.
3. Keep RLS enabled. Do not add public INSERT policies, force a role/header, or
   expose privileged credentials to work around 42501. If the effective backend
   role is intentionally restricted, review that role's intended logging access
   in the isolated project with its owner before changing anything.
4. A live insert/authorization test remains unverified; no remote database query
   was issued. Use the next separately authorized Preview scan's redacted logging
   outcome to confirm remediation, or authorize an isolated logging check.

Sources consulted:
https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z
The skill-required public changelog fetch was blocked with HTTP 403; current
Supabase documentation was obtained through its documentation search tool.

## Offline validation / next acceptance

Focused mocked regressions use the real TCGdex adapter, pinned snapshot, reconciliation,
strict eBay endpoint, prediction handler and report persistence. The live combination
is 2023 Paldea Evolved / 92% AI proposal corrected to 2026 30th Celebration Pikachu
ex 149/128 Holo Special Art. Tests cover no results; each wrong year/set/number/finish;
fresh confirmation with zero and valid comparables; preserved visual observations;
stale saved titles; API errors; redaction; RLS denial; stale UI targets and storage
failure. Test fixture records are confined to tests.

Next real-world step: a separately authorized replacement private Preview at the
exact saved checkpoint commit, with the existing four-check preflight, followed by
one separately authorized scan of the original HEIF photo. Record the safe receipt
and revaluation outcome; do not export images, HARs or authentication headers.
A passing offline suite cannot establish live eBay supply or fix Preview credentials.

Final validation: **294/294 automated tests passed**, production build passed,
snapshot/license packaging and provenance validation passed, and all six browser
scripts passed (`live-report-integrity`, `mobile-upload`, `variant-ui`,
`financial-consistency`, `tcgdex-freshness`, `phase1-validation`). The Phase 1
browser script passed all 16 scenarios, including legitimate manual confirmation
with a fresh text-only Atlas result. Stale image-derived Atlas narratives are
withheld separately without invalidating legitimate prices. The function trace
contains no test fixtures. Final diff and credential-pattern review passed.

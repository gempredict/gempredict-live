# TCGdex hosted-catalog freshness

Baseline: `70943f0459419b474f7f9573417a2d2d37c43e47` on
`restore/phase1-identity-market-matching`.

## Evidence and exact revisions

The task supplies hosted V2 `30th-149` evidence updated September 17, 2026:
`normal: true`, `holo: false`, and a single
`variants_detailed: [{type: "normal", variantId: "generated"}]`.
No hosted deployment Git SHA was supplied. We did not re-request live REST,
Anthropic, or eBay. Hosted observations below therefore use that supplied evidence,
not a new measurement of today's service.

Public GitHub file history and immutable file reads independently confirm:

| Revision | GitHub commit time (UTC) | Meaning |
| --- | --- | --- |
| `46e7d514d534d38257914a5ffee54c17849f72c3` | 2026-09-16 22:45:22 | Initial card data; no explicit `variants` for 149 or 148 |
| `9f90a62ec32ec00cd4ca3059f5ee9d61eae85a1c` | 2026-09-20 08:47:23 | Explicit single `type: "holo"` printing added |
| `a211f11f3ba57d56c65c5ac33be35b77d3280757` | 2026-09-22 09:07:07 | Adds `stamp: ["30th-anniversary"]`, retaining explicit holo |

Immutable sources are in repository
<https://github.com/tcgdex/cards-database>, paths
`data/Mega Evolution/30th Celebration/149.ts` and `148.ts`, plus
`data/Mega Evolution/30th Celebration.ts` at the snapshot revision.

| Source | Initial blob | Correction blob | Snapshot blob |
| --- | --- | --- | --- |
| 149 | `7bfe1cce98c9fa333bf7373638ca926e6f8f1500` | `740c4f2d35d5f4dd115beee0fe6a1e6e9dd8738d` | `07a536c4226e534642d26e41012c75d9f2b34a80` |
| 148 | `c4aadb4602c6cf133aa5ebd430a223530688a993` | `107d46bfa273a72eded84a2fa1bebf932f7d5530` | `45471cd1b801e9997fb7cca16344265482b56f7f` |
| Set | — | — | `454be7141b08a542bbc20471f18ac880a1fd6496` |

Root cause: the previous fix correctly required positive catalog support for a
holo finish, but only consulted hosted REST flags. Generated hosted normal data
had not incorporated the newer explicit upstream printing. It therefore failed
the final catalog finish gate even after set/year correction and sufficient
neutral variant evidence.

## Offline provenance and resolution

`data/tcgdex/upstream-snapshot.json` contains the actual immutable source bytes,
Git blob SHAs, source paths, revision times and source associations. It is real
catalog evidence, not a test fixture or invented card mapping. It initially covers
Pikachu ex 149/128 and Greninja ex 148/128, demonstrating the same mechanism for
multiple subjects. MIT attribution is retained alongside it.

`lib/tcgdexSnapshot.mjs` verifies a code-pinned SHA-256 of the entire artifact and
all Git blob hashes. A restricted literal parser reads source objects; downloaded
TypeScript is never imported, transpiled, evaluated, or executed. Expressions,
trailing code, duplicate keys and prototype keys are rejected. Source/set import
relationships, revision associations, unchanged names/category/rarity, explicit
single printing types and chronology are checked. Missing or invalid snapshot
files do not crash the route; the fallback is unavailable and REST evidence is
not promoted.

A correction requires all of:

1. Exact card ID, localized subject, language, set ID/name, local collector number,
   official denominator, release date/year and rarity match the snapshot.
2. The earlier source has no explicit variants; both later source revisions
   explicitly establish the same single printing type. Rarity does not establish
   the finish.
3. Hosted `updated` is a valid date/time at or after the initial source revision
   and strictly before the explicit-printing correction revision.
4. Hosted flags are exactly normal-only for the relevant finish fields, and
   detailed metadata is the one generated normal default, optionally including
   `size: "standard"`. Unknown metadata, nonstandard sizes, or positive edition/promo
   flags cannot be overridden. Explicit,
   extra, ambiguous or missing detailed printing evidence is not overridden.

Agreeing hosted flags remain unchanged. Newer, undated, mismatched or otherwise
contradictory data is not overridden. Original hosted flags and timestamp,
source revisions, blob references, explicit type and stamp are retained in
`printingProvenance`; development catalog diagnostics explain acceptance/rejection.
There is no GitHub dependency during a scan, no added network request, and no
change to REST request budgets or caches.

Existing independent variant evidence, final identity gates, saved-report
revalidation and strict eBay comparable matching still apply. Reverse-holo,
non-holo, base and other artwork cannot inherit holo support. The fallback alone
cannot establish a physical variant or a trusted valuation. Unsupported card
categories remain unsupported.

Corrected identity now also filters condition-narrative sentences mentioning a
superseded set/year. Useful remaining visual observations stay available; initial
AI identity fields remain clearly labelled provenance. This applies to fresh and
restored reports, with or without trusted pricing.

## Maintenance and limits

Run `node scripts/validate-tcgdex-snapshot.mjs` offline. To expand/update coverage,
review immutable official repository history and fetch exact contents at pinned
revisions; capture GitHub-provided blob IDs and bytes, validate associations,
explicit printing and chronology, update the data artifact and reviewed root
hash together, and run all regressions/build/browser checks. Do not point at a
moving branch, add arbitrary seller facts, or auto-trust self-declared hashes.
The root hash is a reviewed release trust anchor, not a publisher signature.

The initial snapshot is deliberately small and not a complete/offline catalog.
Discovery and card/set identity still require REST. An unavailable API, missing
source coverage, or missing/unknown hosted update metadata cannot be repaired by
this fallback. More recent contrary hosted evidence requires investigation and
an updated reviewed snapshot. Commercial image rights are unchanged; no images
or provider pricing are imported. End-to-end live iPhone/API delivery is not
verified by mocked tests.

## Build packaging and license preservation

Next.js 14 `experimental.outputFileTracingIncludes` explicitly includes both
`data/tcgdex/upstream-snapshot.json` and `data/tcgdex/LICENSE` for `/api/predict`
only. The deployment mode is unchanged; standalone output is not enabled. The
upstream license text is unchanged (SHA-256
`12e7dd2d018848b9997d0226c4632f01da86ec4bf6ebe0c8b19953d5e5eeb6ff`).

Every `npm run build` runs `npm run check:catalog-packaging` after Next succeeds.
The check reads `.next/server/pages/api/predict.js.nft.json`, resolves each entry
relative to that trace file, and requires both assets to be included and to exist
as regular files. It can also be repeated independently after a build. Automated
tests prove that absent trace entries, wrong relative paths and missing on-disk
files fail the check.

The packaging strategy is Next's per-route file tracing: a Next/Vercel packager
that consumes the `/api/predict` NFT must retain both assets at their traced
locations. This verifies the local production trace and its actual input files,
not a deployed function artifact. No deployment has been created, downloaded or
inspected. Any custom packager must honor the NFT dependencies; copying only
compiled JavaScript would omit the runtime data and license.


The live-response regression uses the supplied exact hosted timestamp
`2026-09-17T00:45:22+02:00`, all five hosted variant flags and
`{type: "normal", size: "standard", variantId: "generated"}`. Its UTC timestamp
is exactly the initial source commit time, which is eligible under the inclusive
lower timestamp bound. Tests cover this full shape through the prediction handler
and final `Holo Special Art` identity gate; no live provider request is needed.

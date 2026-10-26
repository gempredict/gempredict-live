# Identity-first presentation and live pricing investigation

Baseline: `7fdc0d83d4af3721c989f0f31d1ac05d554fa64a`, existing restoration branch.
Bounded changes: condition evidence/presentation, first-page retrieval coverage,
redacted diagnostics and a sports identity contract. No new live scan, paid
provider call, database/configuration change, deployment or provider integration.

## Confirmed live evidence and limits

Read-only Vercel metadata confirms deployment `dpl_423FxMswZ5s5dQ2MZTidpkSgo1xK`
(`gempredict-live-1kifg0d6v-gempredicts-projects.vercel.app`) was READY on the baseline
commit and restoration branch. Thus this was not an older-preview test.

Receipt `664c3086-307d-4e61-802d-f8320ec3d2ca` was recovered from retained Preview
runtime logs. It records identityAllowed=true, variantStatus=corrected,
valuationReason=no_comparable_listings, six attempts, no failures, zero usable
attempts and zero used raw prices. Retrieved pages show 20 records, 2 graded and
18 excluded, with no invalid-price/currency, below-match-threshold or outlier
rejections. Provider totals were 134–351 per the supplied live evidence.

**The specific rejection categories cannot be recovered from that log.** The
old console object output serialized nested rejectionCounts as `[Object]`, and
the log viewer also truncated the long entry. The request-scoped log contained
no separate per-search or per-listing evidence. This is a telemetry loss, not
proof that all excluded cards were genuinely wrong, or that matching is overly
strict. Original seller titles and structured attributes were not supplied and
were not fetched through a new eBay request. The initial 24-hour log query was
rejected by Hobby retention; the corrected 50-minute query recovered the receipt.

What is established: API retrieval completed; 2 records per page were graded;
18 were excluded before price/currency/outlier processing. What is not established:
whether exclusions were wrong identities, absent language/printing evidence,
parsing failures or valid matches ranked beyond the first page. A provider total
is not a comparable count; repeated queries can retrieve overlapping records.
No live card price or realized sale is inferred here.

## Root cause: arbitrary condition prose was still authoritative

The image-analysis prompt creates identity proposals, notes, a summary and grade
language together before catalog reconciliation. `normaliseImageAnalysis` retains
that prose. Reconciliation correctly changes the canonical card, but previously
`visualConditionAnalysis` attempted to remove known stale names from arbitrary
sentences. The italicized `ImageAnalysisCard` summary displayed the remainder.
Even an expanded denylist cannot guarantee arbitrary prose contains only verified
identity and observed facts, especially when it invents another set or paraphrases
one. The latest Obsidian Flames/90% scan demonstrates this architectural boundary.

The boundary now separates evidence and presentation:

1. Vision remains an **unverified proposal**, never independent identity proof.
   Existing catalog reconciliation, user-protected fields and variant/finish
   checks resolve or reject it before trusted valuation retrieval.
2. Vision is asked for `visualObservations` with allowlisted attribute/defect
   codes and `imageLimitations`. Those fields are validated independently of
   arbitrary summary, identity and grade text. Existing computed structural-damage
   safety flags are retained and cannot be overridden by an empty observation list.
3. `lib/visualEvidence.mjs` deterministically generates condition descriptions
   from those validated codes and the independently verified canonical identity.
   Unknown identity is explicitly unverified. Missing ratings are unassessed.
   No crop/finish/set knowledge is inferred from a defect or rarity.
4. All condition prose fields, including the italic summary, attribute notes,
   risks and limiters, are generated from that vocabulary. Raw PSA grade claims,
   model scores and optimistic grading recommendations are not promoted into the
   condition output, even if market checks later pass. This does not introduce a
   grading engine or change existing financial probability/ROI calculations.
5. Legacy reports extract only explicit positive defect phrases from the relevant
   attribute note. Negated/uncertain defects are not asserted. The arbitrary note
   is never copied; missing details are explicitly not a defect-free finding.
6. Original identity/confidence remains inside the existing explicitly unverified
   panel. Original summary/grade text is retained as `unverifiedInterpretation`
   diagnostic data, never rendered as trusted condition prose. Rehydration is
   idempotent and applies the same presentation boundary to saved reports.
7. Trusted financial explanations remain the existing deterministic economics
   templates. Atlas receives the finalized canonical identity and condition
   presentation. Existing saved-report/Atlas consistency gates remain intact.

These are still image-based AI observations; structured codes do not make visible
condition independently verified, establish a PSA grade, or resolve hidden damage.
Their statements are labeled photo assessments. Catalog verification only governs
identity. Missing catalog, printing or pricing evidence still withholds trust.

## Retrieval change and proof

Search construction is unchanged: up to six ranked retrieval queries, all carrying
the same final canonical identity parameters. Some query strings broaden wording;
strict title, structured attributes, language, collector number, set/year and
variant filtering do not broaden. Each internal eBay endpoint obtains OAuth and
one Browse page. Previously it requested `limit=20`, without pagination. Ranking
selects a single best usable pool; it does not merge overlapping query results.

The known totals prove that the old 20-result page left most provider-ranked
candidates unexamined. Each existing query now requests **up to 100 records** on
that same first page (within Browse's supported limit). The six-query, concurrency
and timeout limits are unchanged; no extra queries, pages, retries or provider
requests were added. At most 600 returned records are considered across six
potentially overlapping pools. No returned record is automatically a comparable.

A reproducible mocked API fixture places 2 graded/18 wrong-version records first,
then valid exact-identity English Holo Special Art records at positions 67–69.
The twenty-record window yields no trusted price; the 100-record window finds
only those exact matches and uses one pool's three prices. A 100-record wrong-
variant pool remains unpriced. Missing language is still rejected, separately
from an explicit language contradiction. Existing structured contradictions,
reverse-holo, non-holo, graded/raw and variant tests remain required.

This demonstrates a real coverage limitation and a safe improvement, **not proof
that the historical live matching records existed at those ranks**. Results beyond
100, unsupported title formats and missing structured evidence remain limitations.
No speculative parser relaxation, per-card exception, or paging dependency was
introduced. Fixtures/prices are test-only; no live comparable or price is invented.
Browse reference: https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search

## Diagnostic correction

The response receipt retains safe per-search aggregate categories and now records
the retrieval limit/unexamined provider count. Fixed reason codes distinguish
missing language, language conflict, year, number, set, subject and variant/printing
issues. Existing coarser categories remain. Counts have no role in identity or
price eligibility; absence of language/finish evidence is never turned into support.

Server logs emit one compact JSON summary and at most six compact JSON search
records, correlated by requestId. Nested categories are serialized, not inspected
as `[Object]`; separate bounded records avoid losing the last searches to the
old large-object log format. No seller title, listing URL/ID, price, query text,
image, header, credential or raw provider response enters these logs. Production
protection and Preview-only/development receipt scope are unchanged.

## Sports scope

See `SPORTS_IDENTITY_CONTRACT.md` for the minimum manufacturer/year/product/set/
player/number/parallel/serial/autograph/memorabilia contract and source requirements.
Pokémon catalog rules and snapshots do not verify sports cards. No sports provider,
checklist connection, grading engine or submission optimizer was implemented.

## Next acceptance and remaining blockers

No live pricing restoration is claimed. The next authorized private Preview must
use this exact saved checkpoint and pass the existing private preflight. One
separately approved scan can then use the original HEIF photo and preserve the
compact summary plus per-search records. If no comparable survives, the new reason
counts can distinguish insufficient evidence from contradictions without dumping
images or secrets. A sanitized saved report's rejected-listing attributes may be
needed to investigate a specific parsing issue; do not export full HARs or tokens.
The prior Preview Supabase authorization/configuration requirement is unchanged;
this checkpoint does not modify credentials, RLS or database behavior.

## Final validation

**304/304 automated tests passed.** Production build, pinned snapshot validation
and snapshot/license packaging checks passed. All six existing browser scripts
passed, plus a separate `IDENTITY_FIRST_SMOKE=1` run explicitly asserting Obsidian
Flames/90% provenance, absence of rejected-set/false-grade prose in trusted output,
fresh revaluation feedback, saved-state updates and storage-failure handling.
The Phase 1 browser script passed all 16 scenarios. Existing HEIF upload, corrected
Pikachu, variant/identity, sports-unavailable and saved-report protections remain
green. Test fixtures are absent from the prediction function trace. Final diff,
credential-pattern and protected-file review passed. No live pricing restoration
is asserted by these mocked tests.

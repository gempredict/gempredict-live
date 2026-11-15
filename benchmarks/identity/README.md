# Phase 2: real-card identification measurement

This is an offline benchmark, not a scanner stage or an accuracy claim. Baseline: `ff3b3a5cf2b4326049ec666af11c44fdfc621cbb`. No paid calls or new real scans were made.

## Current inventory and status

`manifest.json` contains the twelve physical cards reported by the owner. Most names and stratum assignments remain provisional. GP-ID-008 now has a photo/checklist-reviewed partial label, while its exact printing and photo-to-scan linkage remain unresolved. Its supplied photos and diagnostic are retained only in the ignored private directory; the other eleven physical labels remain unreviewed. Independent catalog reference facts are stored separately from physical labels.

| ID | Owner-reported card | Evidence / next requirement |
| --- | --- | --- |
| 001 | Charmander 004/165 | Pinned TCGdex reference: 2023 151, Common. Review language and actual finish. |
| 002 | Pikachu 28/73 | Pinned TCGdex reference: 2017 Shining Legends, Common. Finish unresolved; no inference from generated defaults. |
| 003 | Zapdos 133/128 | Four historical observations, one physical-card group. Reference facts: 2026 30th Celebration, IR; source/hosted finish disagreement and uncertain marking remain. |
| 004 | Rotom IR 197/182 | Pinned TCGdex reference: 2025 Destined Rivals, Illustration rare. Photo/printing review pending. |
| 005 | Pikachu ex 149/128 | One retained owner-summary observation. Reference facts: 2026 30th Celebration, SIR. Physical-copy review pending. |
| 006 | Rosa’s Encouragement 114/088 | Pinned TCGdex reference: 2026 Perfect Order, **Ultra Rare**, not SIR. Language/physical printing pending. |
| 007 | Snivy 5/25 | Product, year, language and foil not independently reviewed. Do not assume one printing from this number alone. |
| 008 | Babe Ruth SV-40 | Reviewed: 2025 Topps Allen & Ginter, Sweet Victory insert. Exact printing and scan linkage unresolved; see BABE_RUTH_FIRST_ATTEMPT.md. |
| 009 | 8 Bit Ballers Bryce Harper BB-11 | Exact product/year/printing unresolved; insert name does not establish a parallel. |
| 010 | “It Take Two” Sand Glitter 52 | Preserve original wording. Need subject(s), manufacturer, year, product and exact treatment. |
| 011 | Josh Dix Bowman 1st Green Auto /99 PA-JD | Need exact product/year, autograph type and full stamped numerator/denominator. PA-JD and the copy serial are separate identifiers. |
| 012 | Paul Skenes Nice List MNL-11 | Exact year/product/printing unresolved; not automatically base or parallel. |

The remaining eleven need private photographs, physical-label review and separately approved baseline scans. Babe Ruth has a completed privately imported attempt and reviewed photos, but the supplied image dimensions differ from the scan metadata and no request-bound image hashes were retained; it cannot count toward accuracy. The source-backed facts for six Pokémon references do not by themselves establish the identity of any photographed copy.

The available inventory is **7 Pokémon / 5 sports**, whereas the original target is 8/4. `target-manifest.json` preserves the original 2 standard, 2 IR, 2 SIR, 2 promo/unusual, 1 sports base, 2 sports parallel, 1 serial/autograph design. `manifest.json` records the actual inventory cohort, explicitly reports the deviation, keeps Babe Ruth as a reviewed insert and two sports entries unclassified and places Rosa in another-rarity coverage. Completing the original mix requires another SIR, another Pokémon promo/unusual-number example and confirmation/replacement of sports base/parallel selections. Do not report the available cohort as satisfying those strata.

## Reproduce the initial report

From the repository root:

```sh
npm run benchmark:identity
npm run test:benchmark
```

The command writes deterministic `results/REPORT.md` and `results/results.json`. It reads only local JSON. The committed report uses **six owner-summary observations across three physical cards**, not reconstructed model payloads. It has **zero completed accuracy tests**, unknown accuracy/precision/recall, unknown scan cost and latency, and only one retained output-token figure (405). A false-verification count of zero with no adjudicated cohort scans is not evidence of perfect verification.

Historical context commits are preserved as `contextCommit`. Their exact deployed revisions were not retained and remain null. The old original-year Zapdos result, JSON failure, structured-output result and later printing-conflict result are separate observations, never four benchmark cards. Pikachu's missing response and screenshot are not recreated. See `HISTORICAL_SOURCES.md`.

## Private capture and import

Keep photos and original exported diagnostics outside Git, or under ignored `benchmarks/identity/private/`. This benchmark never requests owner keys, reads credentials, submits scans, decodes diagnostic tickets or calls a provider. Existing owner-authorized Preview export is the source of any diagnostics; do not bypass its authorization.

1. Review the physical card against independent catalog/checklist references **before** examining model output. Record core fields plus each applicable printing attribute. Record reviewed absence/not-applicable explicitly rather than guessing.
2. Store a private photo pair and record its SHA-256 values. The manifest's `photos.front.status` becomes `retained_and_reviewed` only after local review. A scan must carry the same front hash and, if used, back hash, independently retained in its owner-authorized prepared-image diagnostics. Matching operator-supplied hashes alone cannot establish linkage. Never commit images, base64, EXIF or signed upload URLs.
3. Set ground truth to `independently_reviewed`, with reviewer, review date, `fields` and field-specific independent `sources`. Each known field has `{status:"known", value:...}`. Unknowns remain `{status:"unresolved"}`. Not-applicable requires its own review/support. `referenceFacts` are discovery evidence, not automatically promoted labels. Preserve full collector denominators and sports prefixes.
4. After separate owner approval, manually run **Identify Card** once in protected Preview. Record the deployed commit, exact prepared photo pair actually submitted, scan outcome and any failure. Original HEIC/JPEG files may differ from prepared upload bytes; do not substitute their hashes. Do not retry automatically or invoke full scan/condition/marketplace.
5. Save the existing sanitized report/export locally and import it:

```sh
node scripts/identity-benchmark.mjs import \
  --input benchmarks/identity/private/export.json \
  --output benchmarks/identity/private/scan-001.json \
  --id RUN-001 --card GP-ID-003 --cohort phase2-initial --attempt 1 \
  --front-file benchmarks/identity/private/prepared-front.jpeg
```

The importer allowlists identity and diagnostic fields, strips unknown payloads, rejects raw provider messages, hashes the capture for provenance and refuses overwriting an existing output. Missing cost/timing/candidates stay unknown. It does not infer language, grade, foil or rarity from a title. Review the resulting selected identity text before any sharing: identity observations are still owner diagnostic information. Private inputs should remain private even after sanitization.

6. Combine selected sanitized observation objects in a private JSON array, and run:

```sh
node scripts/identity-benchmark.mjs report \
  --manifest benchmarks/identity/manifest.json \
  --observations benchmarks/identity/private/observations.json \
  --output benchmarks/identity/private/results
```

Record actual billing-backed USD cost and measured request latency only when available; the importer does not substitute CLI runtime, token caps or estimates. Include failed paid attempts. Current Preview diagnostics retain numeric token usage but not complete per-scan billing or duration. Historical partial usage cannot establish total cost. Legacy exports with no prepared-image digests remain unlinked, including the first Babe Ruth scan. Full candidate lists are not retained by current report exports, so the importer deliberately leaves candidate recall unassessable. Selected references are preserved without being misrepresented as full candidate retrieval.

## Scoring and denominators

- Primary sample: first recorded attempt per physical card/cohort, ordered by explicit `attemptIndex`. Repeats never replace an initial failure or increase card count. Report their same-photo consistency separately.
- Technical success: valid completed identity response / recorded first attempts; no condition or valuation result is required.
- Core accuracy: correct canonical subject, year, set and complete collector number / first attempts bound to reviewed photos and independently reviewed core labels. Incomplete output is separate from incorrect output. Failed eligible attempts remain in this end-to-end denominator.
- Exact accuracy: core plus the manifest's applicable exact fields / attempts with independently reviewed exact labels. IR and SIR, holo and reverse, stamps, language, sports subset, autograph and stamped serial must stay distinct. Explicit approved label aliases are allowed; no implicit rarity or printing aliases.
- Candidate recall: true catalog ID in the actually retained candidate list / eligible attempts with known true ID/provider and a retained retrieval list. Missing lists are unknown, not zero recall.
- Verification precision: correct verified claims / adjudicable verified claims, with claim dimensions shown. Catalog/photo claims are checked against core plus language labels; printing claims against exact labels. Unknown truth and incomplete output have separately reported unassessable claims. Wrong verified claims are counted; unsupported sports verification is also flagged even if the AI happens to be correct.
- Coverage: eligible cards with a verified claim / core-eligible cards. Separate category and printing eligibility denominators are reported. No-card/no-photo/no-label entries are never completed accuracy tests.
- Costs/latency: actual known totals and counts, plus unknown counts, including repeats and failures. Never fabricate absent input tokens or invoices.

The benchmark is local measurement, not an authentication system; source review is an operator responsibility, not cryptographic proof that a JSON label is honest. Twelve cards do not establish statistically reliable general accuracy.

## Printed-evidence audit

The current schema retains subject, cardNumber, setCode, language, rarityMark and copyrightYear with side, area, certainty and alternatives. Pokémon fractions and sports prefixes survive unchanged. Copyright is separate from proposed release year. There are no dedicated printed slots for regulation mark, sports manufacturer/product/subset, autograph marking or copy serial, although manufacturer/auto-relic may appear as model proposals.

Observed evidence: Zapdos `J 30CEN` was uncertain and may combine regulation J, set 30C and language EN. Its literal reading is preserved; catalog data cannot make it clear. This is a possible conflation, not proof that a larger output schema fixes real-world identification. The benchmark records possible conflation and an explicit `distinctMarkingsUnrepresentable` review annotation. No prompt/schema change is implemented. Collect actual sports and unusual-number observations first; propose category-specific additions only if repeated evidence demonstrates representation loss. Separate copy numbering from collector number in human labels now.

## Sports and other TCG sources

Topps' [official checklist archive](https://www.topps.com/pages/checklists) links its own manufacturer PDFs. Manually inspected references establish **2024 BCP-86 = Brock Wilken** ([2024 checklist](https://cdn.shopify.com/s/files/1/0662/9749/5709/files/MLB2407-2024BowmanBaseballChecklist.pdf), page 3) and **2025 BCP-86 = Konnor Griffin** ([2025 checklist](https://cdn.shopify.com/s/files/1/0662/9749/5709/files/MLB2507-2025BowmanBaseballChecklist2.pdf), page 8). The [2025 Mega Box checklist](https://cdn.shopify.com/s/files/1/0662/9749/5709/files/MLB2593-2025BowmanMegaBoxBaseballChecklist.pdf), page 2, also lists Konnor BCP-86. These resolve the checklist discrepancy, not the old physical card's exact year/product/Mojo printing. The old regression label remains excluded; scanner regression inputs are not rewritten as real ground truth.

Sports outcomes distinguish correct AI without a runtime catalog, unavailable candidates, unresolved parallel, manufacturer corroboration and incorrect fields. A reviewed external checklist does not silently become an integrated sports catalog. Topps PDFs may support manual reference checking, but an automated reuse license/API has not been established; no scraping or bulk response caching was added.

The requested twelve-card strata include no other TCG. A separate category plan is supported by the framework, but MTG/Yu-Gi-Oh!/other-TCG coverage remains unmeasured and no adapters are added. [YGOPRODeck's own guide](https://ygoprodeck.com/api-guide/) documents set codes/rarities and usage limits; exact printing/language and commercial reuse still require review. Scryfall documentation access returned 403 during this investigation, so no new technical or licensing claim is made for it. None of these sources authorizes GemPredict valuations or changes the existing commercial gate.

## Minimum next approved work

Prepare/review the twelve real card labels and photos first. Start with four individually authorized identity-only scans: Zapdos, Pikachu ex 149/128, Charmander and one independently labeled sports card. This begins cross-category measurement; it does not complete the cohort. Then scan the remaining eight once, with a stop on any unsupported verified claim. An optional two repeat scans using identical photo hashes test repeat consistency separately and require separate paid-call approval. No scan or retry is authorized by running these offline tools.

## Validation and changed files

Full offline suite: **352 passed, 0 failed, 0 skipped** (326 existing plus 26 benchmark tests). Production build and all three TCGdex source/snapshot/license packaging checks passed. No paid calls or additional real scans were made.

Implementation inventory: `.gitignore` (private capture exclusion); `package.json` (offline report/test scripts and build check); `lib/identificationBenchmark.mjs` (normalization/scoring/reporting); `scripts/identity-benchmark.mjs` (local import/report CLI); `tests/identification-benchmark.test.mjs`; and the seven files under `benchmarks/identity/`: this README, manifest, target-manifest, historical-observations, HISTORICAL_SOURCES, results/REPORT and results/results. Scanner handlers, prompts, catalog adapters, HEIC processing, diagnostic authorization, financial safeguards and UI components are unchanged.

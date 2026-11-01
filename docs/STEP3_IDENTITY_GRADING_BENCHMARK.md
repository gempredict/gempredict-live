# GemPredict — Step 3: Identity & grading accuracy benchmark (baseline v1)

Date: 2026-11-01
Branch: `develop/opulent-disco`
Approved reference: `restore/original-experience-baseline` at `4cdbc4aefd3da43cb6dff3210a017b9d33797c46`
Scope: Read-only diagnosis and benchmark design. No model calls, grading logic changes or report design changes authorized by this document.

## Case GP-IDENTITY-001 — Pikachu ex 149/128

**Confirmed reference from collector's photos / user:** Pokémon Pikachu ex, collector number **149/128**, illustrated full-art/SIR card. Collector specifically confirmed 149/128 is the physical card being scanned. Set name and rarity wording require independent catalog verification; do not infer from eBay titles.

**Observed report and comparisons:** A full Opulent Disco report rendered on the development Preview. It displayed condition categories, a GemPredict Score (54 in the latest scan), grading outlook, financial report and clickable active eBay listings. The user explicitly judged the report inaccurate. Listed eBay results included (1) a different card, Pikachu ex 277/217, offered for $225, (2) Pikachu ex 149/128 at $300 and (3) Pikachu ex 149/128 at $44.99. These are asking prices, not sold comps. This is an observed mismatch, not proof that all the prices are valid valuations.

**Observed failures / risks:**
- An incorrect collector number, 277/217, was admitted among comps for card 149/128.
- The original `pages/api/ebay-search.js` `scoreListing(title,query)` uses permissive token overlap, plus hard-coded bonuses for `248`, `purple`, `shock`, `rated rookie`, and `optic`; there is no strict rejection of mismatched collector numbers.
- `pages/api/predict.js` runs `fetchImageAnalysis` and `fetchPrediction` separately. The latter receives effective card name, type, set, and user-selected condition but **not** the photo's centering/corners/edges/surface assessment. Grading probability, financial recommendation, and summary may therefore contradict visible photo findings.
- The expected value model assumes every outcome is PSA 9 or PSA 10; PSA 8 or lower is excluded. This can make the estimated grading ROI optimistic for imperfect cards.
- Other population estimates and PSA 9/10 values may be model-generated, not traceable to live observations.

**Reference status:** Card-number ground truth is user-confirmed. Full grade and condition ground truth are **not yet established**. Do not claim a true PSA grade or measurable grading accuracy from this case.

## Benchmark fields (for each case)

1. Stable case ID and category (Pokémon / sports / other)
2. Real card identity: year, manufacturer, exact set, collector number, variant, language
3. Source of ground truth: catalog / card photo / graded slab / owner confirmation
4. Front and back photo references, resolution, lighting, sleeves or glare limitations
5. Expected *observable* condition: centering, corners, edges, surface, location of defects
6. Independently reviewed grade outcome if available; distinguish official slab grade from subjective estimate
7. Observed GemPredict output: identity fields, confidence, four category notes, grade ceiling, PSA 10 probability, score, verdict
8. Market quality: matching listing IDs, rejected variants, sold vs active vs modeled labels
9. Pass/fail/unknown per criterion and any repeatability discrepancies

## Step 3 acceptance gates (initial; revise based on measured difficulty)

- **Identity:** zero known wrong card-number or variant matches counted as verified; label ambiguity instead of inventing identity. Aim >=95% exact identity on the agreed supported benchmark and report all unknown cases.
- **Photo analysis:** each claimed visual defect has a verifiable region or is explicitly framed as uncertain; no unsupported high-confidence clean-surface conclusion from glare/sleeves.
- **Grade consistency:** narrative, grades, PSA 10 chance and recommendation must be coherent with the same photo evidence; do not treat a model's unverified grade as ground truth.
- **Repeatability:** test the *same* photo pair with independent runs only after the user approves paid calls; evaluate materially inconsistent outputs.
- **Market evidence:** reject known different collector numbers; separate active asking prices from sales; do not accept inaccurate matches into valuation calculations.
- **Collector experience:** preserve original Opulent Disco report layout and useful narrative; missing evidence should qualify a claim, not delete the entire report.

## Next controlled actions

1. Capture the existing saved Pikachu report's *exact identity fields and four condition notes* in the benchmark if obtainable without another paid scan.
2. Assemble 20–30 varied real-card image pairs with externally validated identities and independent condition observations; log missing ground truth explicitly.
3. Compare original behavior using a reproducible case list, storing snapshots/outputs and without changing approved baseline.
4. Fix one bounded failure at a time in `develop/opulent-disco`, rerun the exact benchmark, and compare against reference.
5. Do not promote changes to Production or modify the protected reference without user approval.

## Step 3 checkpoint

- [x] Confirm working original report experience
- [x] Confirm physical card's stated collector number 149/128
- [x] Diagnose two structural accuracy weaknesses (financial/photo separation; permissive listing matching)
- [x] Document the initial benchmark and acceptance gates
- [ ] Capture independently validated card catalog and condition ground truth
- [ ] Establish baseline results across multiple real cards
- [ ] Demonstrate improvements on the same benchmark

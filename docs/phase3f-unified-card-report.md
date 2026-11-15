# Phase 3F — unified card analysis report

Base: 7b891516c18ee00001b46517e39d712e49575659. Branch remains
reconcile/iphone-upload-2026-11-03. No provider integration or Production change.

## Reconciliation

The prior UI rendered a Grading Decision Report and a second Photo Grading Analysis.
The first still contained unavailable score, grade-odds, upside and automatic
recommendation placeholders, plus active-listing summaries. The new ResultCard
uses one black/ink-and-gold shell for identification, condition, completed sales,
eBay discovery, optional economics and the existing save/copy/share controls.
Both full scans and identity-only responses use it. Identity-only responses still
make no condition or marketplace request; their detailed original evidence remains
available through the reused IdentityResult view inside a disclosure.

Canonical title and fields come from protected report identity, not cardMeta or
free-form model descriptions. A Pokémon panel never borrows sport/team metadata.
Contradictory selected categories are shown as needing review. Sports and unsupported
TCGs cannot borrow a catalog badge from arbitrary flags. Only source-backed Pokémon
core support can label the header; exact printing remains separately unresolved.
Unverified rarity and parallel information is explicitly qualified, not promoted.
No identity reconciliation thresholds, models or catalog adapters changed.

The existing ImageAnalysisCard is embedded once in the report. It retains regional
findings, front/back distinctions, uncertainty, coverage, limitations and technical
inspection evidence. The standalone component remains regression-testable. Legacy
unassessed notes cannot render Mint/Excellent as a condition rating. The deterministic
condition summary and structural/limitation warnings are retained in technical details;
long free-form card descriptions and unprotected financial prose are not promoted.
Original model identity remains secondary and auditable.

## Market and financial boundary

Raw, PSA 9 and PSA 10 completed-sale sections explicitly say unavailable. There are
no fabricated records, zero sample counts, medians, dates, sale prices, profits or
grade probabilities. Active eBay discovery is labeled separately; its result count,
when actually present, is a discovery count only. Candidate asking prices and URLs
are not presented as comparables while exact-printing verification is unavailable.
Existing eBay request routing/matching code is unchanged. Full scans may still do
existing discovery; this milestone makes no new network/provider request.

Grading recommendations and report valuations remain controlled by financialSafety.
The existing GradingScenarioCalculator is reused, with an embedded presentation
option, inside an optional disclosure. It gets no card report, market evidence,
identity, condition or onSave props. Its own local user assumptions never feed the
protected saved report or copied summary. The standalone route remains available;
no additional calculator, formula, probability model or fee dataset is introduced.
All five providers' calculation infrastructure is unchanged.

Copy/share call the existing protected summary. Save receives reprotected report
content only. Existing identity correction and authorized diagnostics controls are
preserved. Feedback remains local and does not claim a server-side review occurred.
Nearby legacy copy referring to automatic ROI/grade predictions was corrected; the
upload, HEIC, Identify Card, full-scan and condition-validation paths are unchanged.

## Validation and synthetic examples

Complete-handler regressions cover Pokémon catalog correction, injected Baseball
metadata, Konnor Griffin alphanumeric sports identity, qualified localized findings,
legacy Mint/Excellent and forged prices, pending completed-sales fields, save/restore,
copy actions, unsupported-category catalog flags and identity-only stage isolation.
Existing condition, identity, sports, upload, financial and provider tests remain.
HTML text assertions exclude CSS, so CSS width percentages cannot masquerade as
financial percentages. The original financial rejection assertions are retained.

Synthetic screenshots use actual report rendering and mocked handler outputs, with
an explicit synthetic banner. No real physical card, sale, price or grading accuracy
claim is established. Browser requests to external services are blocked for local
review. Mobile-sized Chromium is not physical iPhone Safari verification.

## Remaining blockers

- No qualified completed-sales bridge: exact sale identity/printing, quantity and
  amount-unit semantics, transaction uniqueness, provenance and licensed usage
  still require resolution before evidence-backed economics.
- Physical printing/artwork remain unverified; core catalog facts do not authenticate
  a photographed printing. Independent sports catalog coverage is still absent.
- Manual scenarios remain hypothetical and isolated. No grade prediction or automatic
  submission recommendation is enabled.
- The requested earlier Phase 3F document was not retained in this checkout; scope
  follows the current assignment and its explicit acceptance requirements.

Final automated validation: 488 passed, 0 failed, 0 skipped; production build and
all four TCGdex packaging checks passed. Built-app browser checks at 1440×1100 and
390×844 uploaded synthetic front/back JPEGs, intercepted exactly one prediction
response per viewport, rendered the unified report, edited an embedded assumption
and saved a report with finances still withheld and no manual scenario attached.
No page errors or horizontal overflow occurred; external requests were blocked.
This validates mocked browser integration, not provider or physical-card accuracy.

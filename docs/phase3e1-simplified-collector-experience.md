# Phase 3E.1 — simplified collector experience

Base: e0f9d4c1628cc93c49b831bca1ceca5821fe0633. Route: `/grading-economics`.
This is a presentation/state refinement, not a new financial model.

## Before and after

The approved three steps remain Your Card, PSA Grading and Your Economics.

- Your Card initially shows the manual description and raw resale assumption only.
  A single collapsed Advanced costs & assumptions section contains raw selling
  percentages, fixed/other fees, optional acquisition basis and currency.
- PSA Grading keeps the tier selector, submission fee and PSA 8/9/10 assumed resale
  values in the main workflow. All shipping, insurance, handling, surcharges, graded
  selling expenses and batch controls share one flat collapsed advanced section.
  The separate optional PSA 1–7 section remains collapsed; no accordion contains
  another accordion. Source/eligibility details stay accessible with published fees.
- Your Economics prioritizes net raw proceeds, complete per-card grading cost and
  all three hypothetical grade differences, including losses. Net graded proceeds,
  break-even values, acquisition-adjusted lifetime results and ROI are in one
  collapsed Financial details section, not repeated across the primary cards.

Missing information gets grouped collector guidance, not a repeated technical list.
An Edit raw costs / Edit PSA costs button navigates directly to that step and opens
its advanced section. The operation preserves all existing values and provenance;
it does not replace any unknown with zero. Each section retains its open/closed
state across navigation. Numerical blanks show Not supplied.

## Explicit-zero and comparison states

Blank means unknown. A collector may explicitly confirm only currently blank raw
selling expenses as zero, or only currently blank graded selling expenses as zero.
Existing nonblank entries are preserved. These scoped actions mark inputs assumed
and do not fill acquisition basis, prices, submission fee or other cost groups.
The prior extra-cost zero action remains in PSA advanced settings with its complete
scope disclosed; it still leaves percentages and prices untouched. Zero assumptions
are visibly labeled; zero is never silently inferred by opening an accordion.

The page identifies Incomplete net comparison when any of the three primary
incremental results is unavailable. Individual computable outcomes remain visible.
Fully specified hypothetical net comparison means the engine has sufficient valid
inputs for all three net differences; it does not mean verified prices, known final
provider charges, likely grades or a recommendation. Optional acquisition basis is
not required for that incremental status. No partial-cost illustration mode is
introduced, avoiding a second calculation path or misleading partial-profit claim.

## Preserved boundaries

Unmodified: `lib/gradingScenarios.mjs`, `lib/gradingFeeReference.mjs`, all dated fee
records, all non-PSA definitions/calculations, scan identity and condition pipelines,
protected report economics and marketplace connections. No dependency or API added.
Published PSA restrictions, freshness, overrides, value-cap warnings and manual
eligibility checks remain. No grade probability, recommendation or verified-market
flag is created. Shared costs and resale inputs remain explicitly hypothetical.

## Validation examples

The deliberate synthetic example remains unchanged: raw net 103, grading cost 35;
PSA 8/9/10 incremental differences -53, -17, +82. Lifetime figures and break-even
prices still come directly from the existing calculator. None are current prices.

Focused regressions verify initial collapse, open/close state retention, direct
missing-cost links without mutation, scoped explicit zeros, concise incomplete
status and complete hypothetical status. Existing arithmetic/provider, fee/source,
financial-protection and PSA workflow regressions remain. Browser captures use
synthetic inputs at desktop and iPhone-sized Chromium widths, with external
requests blocked; they do not establish actual iPhone Safari compatibility.

Remaining limits: user-supplied resale assumptions, potentially changing dated
provider availability, manual eligibility attestation, shared per-scenario cost
assumptions and unmodeled non-numerical grading outcomes. These are unchanged from
Phase 3E. A complete hypothetical comparison is not a trustworthy market valuation.

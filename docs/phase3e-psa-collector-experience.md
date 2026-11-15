# Phase 3E — PSA-first collector workflow

Starting commit: 83b3091fcff0958a2674d28ec96544813ffa13b9.
Route remains `/grading-economics`. No new API or report integration.

## Before and after

Before: five provider panels, many simultaneous inputs, and a wide comparison table.
After: three mobile-friendly steps with retained local inputs: Your Card, PSA
Grading, Your Economics. Direct progress navigation and back/continue controls
allow incomplete exploration without silently filling missing costs. Warm cream,
ink and gold styling follows the existing GemPredict palette without new fonts,
animation libraries or UI dependencies. Only PSA is presented as an active workflow.

Step 1 accepts an optional manual description, assumed raw resale price and optional
purchase basis. Raw selling costs and currency sit under an expandable section.
Purchase basis affects lifetime results, not today's grade-versus-raw comparison.
Nothing is imported from scans, sent to a server or stored in saved reports.

Step 2 reuses the dated PSA fee selector and existing eligibility/freshness checks.
Category, submission count, declared-value assumption and requirement acknowledgement
are separate from shipping-batch allocation. Published fees can be overridden; an
edited amount never retains published provenance. Unknown/variable or paused fees
cannot populate costs. Tier details and source references remain expandable. A resale
assumption above the selected USD tier cap prompts a warning about eligibility and
possible charges; no higher-tier fee is fabricated.

Primary resale inputs are hypothetical PSA 8, 9 and 10 outcomes. Optional PSA 1–7
inputs have no prices by default. PSA 8 is explicitly not a floor, and non-numerical,
altered/authentic-only or no-grade results are possible but not modeled. Shipping
has primary inputs; insurance, surcharge, handling, selling expenses and allocation
remain available under expandable sections. An explicit zero action lists its scope
and never populates sale prices, submission fee or fee percentages.

Step 3 prioritizes the net raw alternative, per-card grading cash cost and incremental
difference for each grade. Outcome cards use text and signed amounts, not color alone.
Each exposes net proceeds and the sale price needed to match selling raw. Lifetime
profit, all-in cost, ROI and lifetime break-even remain separate expandable details.
Missing or invalid values explain what needs to be supplied instead of showing zero.
Positive hypothetical differences never become submission advice or probabilities.

## Arithmetic unchanged

`lib/gradingScenarios.mjs`, `lib/gradingFeeReference.mjs` and the complete 39-row
multi-provider dataset are unchanged. The UI calls the same calculator separately
for each hypothetical grade, using shared user-entered costs and individual prices.
No derived economics formulas, calibration or recommendation algorithm were added.
All non-PSA provider definitions, pure math tests and fee restrictions are retained.
Two previous UI tests now exercise the approved PSA-only presentation; the original
multi-provider arithmetic and fee-contract rejection assertions remain in place.

## Synthetic example, not current prices or provider fees

The deliberate example button supplies raw sale 120, acquisition 100, grading
submission 25 and allocated batch expenses 10. Both raw and graded selling expenses
are 10% plus fixed 1 and other 4. These are invented arithmetic assumptions, not
published fees, observed transactions or predictions. Example grade prices:

| Hypothetical outcome | Resale assumption | Net proceeds | Difference vs raw | Lifetime profit/loss |
|---|---:|---:|---:|---:|
| PSA 8 | 100 | 85 | -53 | -50 |
| PSA 9 | 140 | 121 | -17 | -14 |
| PSA 10 | 250 | 220 | +82 | +85 |

Net raw alternative = 120 − 12 − 1 − 4 = 103; grading cash cost = 35.
Grade-versus-raw break-even = 158.89 in each example because the shared costs/fees
are identical. Lifetime break-even = 155.56. No expected value is calculated.

## Validation and limits

Actual JSX interaction regressions cover step retention, PSA-only choices, all three
outcomes, missing purchase basis versus missing raw costs, negative comparisons,
optional lower grades, explicit zero actions, PSA fee caps/overrides and outdated
reference rejection. Existing tests continue covering all providers, financial gates,
identity, condition, HEIC and report isolation. Local browser review uses only the
calculator, with external network requests blocked; screenshots are synthetic.

Remaining limits: manually entered resale assumptions, shared costs across grade
outcomes (review potential upcharges per scenario), user-attested submission
eligibility and potentially changing published availability. Fee references remain
dated and expire under the existing policy. The page does not model an invoice,
non-numerical grading result, time value, FX or grade likelihood. No real-photo,
marketplace, paid-provider or actual iPhone accuracy validation is claimed.

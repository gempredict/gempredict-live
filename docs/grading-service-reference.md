# Dated public grading-service reference — Phase 3D

Dataset: `data/grading/fees-2026-11-08.json`, revision `2026-11-08.1`.
Checked November 8, 2026 (owner/client date). Research used official public pages;
no paid service, provider account, submission or purchase was initiated. Public
prices are source-supported facts, not verification of a collector's card or
eligibility. Scope is US direct raw-card grading for Pokémon and sports, excluding
dual autograph authentication, crossovers, reholders, promotions and computed
membership discounts. Special-format CGC tiers are retained but cannot populate
the standard raw-card workflow. Shipping, taxes and add-ons are excluded.

Each tier has a stable ID, price or explicit null, currency, category/service scope,
minimum quantity or null, membership/account requirement or not-stated status,
value limit or null, separate included coverage, availability, turnaround estimate,
effective date or null, checked date, review status and source references. Null
limits do not establish unlimited eligibility. Unknown membership/minimum policies
must be checked by the user. Source URLs and scope notes resolve through sourceIds.
These are manually reviewed observations, not independently provider-certified quotes.

## Source review and reconciliation

- [PSA schedule](https://www.psacard.com/services/tradingcardgrading) and
  [dated service update](https://www.psacard.com/info/submission-updates): the latter
  explicitly reopens Value on October 29, 2026 despite the schedule's old pause
  banner. Retain that disagreement in source notes; Bulk stays paused. All listed
  base card tiers are retained; Premium 10 has variable pricing and cannot be
  applied as a fixed fee. Max insured value is retained as the tier value cap.
  [PSA submission terms](https://www.psacard.com/termsandconditions) remain applicable;
  the calculator does not infer a final invoice or compute unspecified upcharges.
- [Beckett schedule](https://beckett.com/grading): retain five priced options,
  including separate Base with/without subgrades. Only Express shows a submission
  link in the inspected schedule; other options show sold out. Preserve this state
  rather than assuming an older reopening announcement guarantees capacity.
  Value limits/minimum/membership not stated on the inspected schedule stay unknown.
- [CGC US schedule](https://www.cgccards.com/submit/services-fees/cgc-grading/): base
  direct-Collector fees are used, with account confirmation required. Bulk minimum
  is enforced. Member discounts are documented but not automatically calculated.
  Unlimited Value's percentage charge cannot be represented as a fixed fee; use a
  manually entered quote. Higher assessed value may move a submission to another
  tier. Turnaround is explicitly not guaranteed.
- [SGC schedule](https://www.gosgc.com/card-grading/services-pricing): public search
  indexing exposed its value-banded table, but direct retrieval exposed no readable
  schedule. Those rows are marked indexed-only/live-unverified and disabled for
  population. An owner-reviewed current official schedule is needed to enable them.
  The high-value stepped fee is variable, not a fixed 3750 quote.
- [TAG service article](https://help.taggrading.com/en/articles/10692075-what-are-tag-s-available-grading-services): direct opening gives an October 21, 2026
  schedule; the older April search excerpt is superseded and not used. VALUE/BASE
  omit prices, so fees stay null. Coverage amounts are not eligibility/value caps.
  [Current pricing](https://taggrading.com/pages/pricing) is dynamic and availability
  limited; the user's confirmation includes checking live availability. No value
  upcharge is documented, but that does not mean all expenses are zero.
  [Physical eligibility](https://taggrading.com/pages/currently-grading) has specific
  era, size, thickness, language and card-type exclusions; the UI exposes these and
  requires explicit user acknowledgement. This is not automated physical validation.

No whole-page provider content, logos or photographs are copied into the dataset.
Only factual schedule fields and short independently worded scope notes are retained.

## Calculator interaction and boundary

Expand a provider, optionally select a published tier, enter submission category,
quantity and declared-value assumption where the tier has a cap. Confirm the account
requirement where documented, and check official physical/submission requirements.
Submission count is separate from shipping batch allocation. The use button stays
disabled for unmet constraints, unknown/variable prices, mismatched currency, paused
or sold-out service, unreadable live sources, special formats or outdated references.

Applying a tier copies only the fixed per-card submission fee and service label.
Business-day ranges remain reference text rather than silently becoming calendar
turnaround inputs. It never fills grading outcome, resale price, shipping, insurance,
handling, surcharges or selling fees. The full scenario remains hypothetical.

Every application records local reference ID, revision and checked date. A manually
edited fee has user-supplied basis and a comparison against the original published
fee. Even an equal manual amount does not inherit published provenance. Unknown
fees and blocked tiers can still be explored using explicitly manual assumptions.
Currency changes never convert the USD reference. Changes to eligibility invalidate
an active published fee until valid conditions are restored or a manual override
is entered. No scanner or report input, storage, authorization or trust field reads
this reference. Existing financialSafety remains authoritative.

## Freshness and maintenance

The 30-day maximum review age is a GemPredict policy, not a provider price guarantee.
Always show checked date and original source. Outdated or future-dated reviews cannot
populate a fee. An already applied outdated published fee becomes unavailable in
calculation; an explicit manual override is still allowed and labeled. No background
refresh, silent price update or paid request occurs. Revisions are appended as new
dated dataset files with explicit reviewed differences, updated module import and
regression fixtures; Git preserves earlier observations. Do not relabel stale rows
as reviewed by changing the date alone. Availability can change before expiry.

Remaining limitations: special/autograph services, member discounts, shipping/tax
quotes and high-value variable charges need manual inputs. SGC needs direct source
review; TAG live capacity must be checked. Physical eligibility is user-attested,
not independently established. Unknown resale values and grade probabilities remain
unknown. The reference cannot authorize submission recommendations or protected
report valuations.

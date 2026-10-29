# Milestone 1E — real-data compatibility audit

**Verdict: safe for blocked offline evaluation; not compatible with trustworthy
real valuation yet.** No adapter, scorer, scanner, UI, transport, Actions workflow,
license flag or live behavior is changed by this audit.

Audited starting commit: `c467723de951a74924fbc5a5a73d0647d7b49b83` on
`restore/phase1-identity-market-matching`. Audit date: October 29, 2026.

## Evidence and its limits

- [Broader schema-only run 40907801566](https://github.com/gempredict/gempredict-live/actions/runs/40907801566): 25 data records; first-record field names/types; pagination total 2105, page 1, limit 25, pages 85, nonempty cursor, absent has_more.
- [Successful sales run 40912268117](https://github.com/gempredict/gempredict-live/actions/runs/40912268117): exact search empty, broader search 25 records. Three target-title candidates had distinct provider IDs, confirmed USD amounts and valid dated-completion classifications. The log is a sanitized summary, not a retained raw API response.
- [1D adapter and tests](https://github.com/gempredict/gempredict-live/tree/c467723de951a74924fbc5a5a73d0647d7b49b83/lib/providers), existing `completedSales.mjs`, `ebayIdentityMatch.mjs`, `variantVerification.mjs`, `marketEvidenceEngine.js`, and `financialEvidence.mjs`.
- [Official API documentation](https://www.thecardapi.com/docs) and [terms](https://www.thecardapi.com/terms), rechecked as public documentation only. No live sales or catalog API request was made.

**Do not generalize first-record types to the three later target records.** The
schema diagnostic masks unknown key names and inspects only the first record.
It listed 38 fields, below its 64-field cap, with one masked field of type null.
That masked key cannot be named retrospectively. In particular, product_id,
quantity, language, rarity and printing are not demonstrated as usable fields.
The sole masked null cannot establish a usable product identifier or quantity.
This does NOT prove those fields are absent from all 25 records or all API data.

The 1D minimum-fact fixtures intentionally omit IDs and timestamps. The successful
run proves the real candidates had provider IDs and passed timestamp validation.
Thus their fixture blockers are not evidence that the provider lacks these fields.
The exact timestamps were not retained as explicit values; do not recover them by
parsing opaque IDs. No raw response snapshot, full ID list or source URL is copied
into this audit.

## Compatibility matrix

"Sample" means the first-record schema sample; "candidates" means the three
149/128 rows in the later sales summary. "Blocks" distinguishes an existing code
gate from evidence still required for a trustworthy valuation.

| Required adapter field / contract | Observed provider support | Missing evidence | Possible resolution | Blocks real valuation? |
| --- | --- | --- | --- | --- |
| `data` / input array and pagination coverage | API supplied an envelope with 25 rows and an additional-page cursor | Adapter accepts only a records array, not the response envelope; meta values not retained | Validate envelope then pass data with reviewed coverage; do not fabricate completeness | Bridge/coverage policy: yes |
| `id`, provider identity | String in sample; three distinct IDs retained for candidates | Stability, correction/replay and source-event uniqueness semantics | Keep provider IDs opaque; obtain documented event-key guarantees | Provider-ID availability: no. Source uniqueness: yes |
| `platform` | String in sample; candidates say TCGplayer | Nothing needed to label the provider-reported marketplace | Preserve supplied value; validate against a reviewed marketplace contract | No for labeling; not source proof |
| Subject/name | Candidate titles explicitly say Pikachu ex; sample `player=null`; no demonstrated separate `card_name` | Independent canonical-to-provider product attribution | Reviewed catalog crosswalk; retain original title and conflicts | Yes, as part of exact identity |
| `card_set` and approved aliases | String in sample; candidate titles contain ME: 30th Celebration | Actual structured values for the three candidates not retained | Review exact provider values and approved alias table | Yes until agreement is established |
| `card_number`, full fraction | String in sample; candidate titles say 149/128 | Structured candidate values may be full, local-only or different; not retained | Establish full-number agreement through reviewed catalog evidence; never discard a conflicting denominator | Yes |
| Canonical year | Sample `year=null`; candidate titles omit year | Canonical release attribution, rather than literal title-year text | Independent exact set/card review can establish year | Yes for canonical identity; title year itself unnecessary |
| `record.product_id === mapping.provider.productId` | No usable product_id demonstrated; not a documented sales field; one masked null in sample | Actual field/name/type and documented equivalence to a catalog product/SKU | Confirm provider contract or existing lawful evidence. If unavailable, separately design a reviewed alternative matching key | **Yes: hard adapter dependency today** |
| Transaction language | No usable language field demonstrated; candidate titles omit language | Transaction/SKU language and product scope | Positive language-specific SKU or source-row evidence; catalog language alone may not cover every transaction | Yes |
| Rarity + printing crosswalk | Titles say Holofoil; intended target is SIR; no usable explicit rarity/printing field demonstrated | Exact version, language/finish scope, uniqueness and independent reference | Reviewed exact-card catalog plus verified sale-to-product/SKU link | Yes; Holofoil is not SIR proof |
| `sale_date`, `sold_at` | Both strings in sample; successful candidate classification required valid, consistent, nonfuture dates | Explicit target timestamp values/precision not retained | Use actual supplied timestamps under authorized handling; retain precision; never synthesize midnight or decode an ID | Schema support exists; fixtures cannot satisfy timestamps |
| `price`, `currency`, `price_confirmed`, `listing_type` | Sample types number/string/boolean/string; candidates confirmed USD fixed-price sale amounts | Independent settlement and amount-unit semantics | Preserve provider confirmation label separately from settlement and unit review | Amount support exists; alone insufficient |
| `original_price` | Null in sample and candidate summaries | No missing final amount may be filled from an ask | Keep askingAmount separate; unknown consideration stays unknown | Never a substitute for sale evidence |
| Raw grade: `review.rawVerified` and reference | Sample grade/grader/cert are null; condition is string; candidate grade values not retained | Positive raw/condition evidence | Reviewed source/SKU classification; null grade is not proof of raw | Yes for a raw-card cohort |
| PSA 9 / PSA 10 `grade`, `grader` | Nullable fields exist; sample values null; no demonstrated PSA cohort | Positive PSA grade, qualifier/label status and comparable identity | Separate actual PSA transaction evidence; never infer from raw or BGS | Yes for each graded cohort |
| Qualifier / autograph metadata | Sample `has_grade_qualifier`, `has_autograph_grade`, `grade_qualifier`, `autograph_grade`, `label` are null | Future non-null flag semantics and safe enforcement | Audit/fix normalizer before enabling graded use; boolean qualifier flags are currently not checked | Yes when grade interpretation is ambiguous |
| `condition` | String in sample; value and target-row conditions not retained | Comparable raw condition and raw-versus-slab interpretation | Retain reviewed condition semantics and preserve them in the downstream bridge | Yes for trustworthy raw comparability |
| `quantity` | No positive quantity demonstrated; may be absent or the masked null; target values not retained | Units and multi-card/order semantics | Provider documentation or reviewed source evidence; never default to 1 | Unit interpretation: yes; quantity need not be fabricated if per-card basis proven |
| `review.amountBasis='per_card'` and reference | Not an API field; price confirmation does not establish units | Whether price is per card, per order, or another basis | Reviewed source contract explicitly establishing units | **Yes: hard adapter gate** |
| `shipping_price` | Number in sample; value and target values not retained | Inclusion in price, currency, allocation and comparable shipping basis | Preserve supplied amount only with documented semantics; report unknowns | Conditional comparability blocker; not a hard adapter gate |
| `review.sourceItemId`, `sourceTransactionId`, `observedAt`, reference | Not present as reviewed provenance; product-like ID components are unverified | Real source item/event linkage, observation time and corrections/refunds | Provider attestation or lawful independently reviewed evidence | **Yes: hard adapter gate** |
| `listing_url`, URL verification | String in sample; all candidate summary URLs are null because old diagnostic only allowed eBay | Actual URLs and whether they identify product, listing or transaction | Inspect only supplied URLs under approved handling; distinguish syntax, catalog identity and transaction verification | Missing public URL alone need not block if alternate provenance is sufficient |
| Deduplication status | Distinct provider IDs; no demonstrated distinct native transactions | Provider-ID/source-event cardinality and stability | Dedup exact IDs conservatively; quarantine contradictions; require approved source-event semantics | Yes for independent sample count |
| `rights`, delivery, completeness | Not established by successful HTTP response | Applicable commercial/upstream rights, retention policy and bounded-coverage interpretation | Explicit review; no automatic entitlement or completeness promotion | **Yes; current export intentionally unavailable** |

## Product identity: what would actually establish the mapping?

The target specification is English Pikachu ex, 2026 30th Celebration, full
149/128, Special Illustration Rare, with its reviewed physical finish/version.
The default registry only approves the set naming alias; its product/language/
printing mappings are empty. Synthetic 1D mappings are NOT real-world approvals.

Trustworthy mapping needs all of:

1. Independent, attributable publisher/checklist/card-image or authoritative
   catalog evidence for subject, full number, release/year, language and rarity.
2. A product/SKU or equally rigorous reviewed identity link actually carried by
   the sale evidence, including which language/condition/printing variants that
   key covers. A catalog page that groups multiple languages or conditions is
   not automatically a transaction-specific language/printing map.
3. Positive finish/version evidence and ambiguity checks for alternative cards,
   including 150/128, other sets, languages, stamps, reverse/non-holo and variants.
4. Review reference, reviewer, date and conflict policy. Missing agreement must
   remain unresolved. Do not append invented English/SIR labels to source titles.

The current public sales schema does not document product_id. A numeric-looking
component of a TCGplayer-prefixed ID is not an established public product key,
SKU or order ID. Do not manufacture a product URL from it. Catalog UCIDs, set IDs
or family relationships are not replacements unless an explicit sale-to-catalog
link is established; the official documentation expressly distinguishes these.
A verified alternative key may eventually require an isolated adapter contract
change, not a fictional product_id added to current records.

## Provenance and deduplication

Preserve opaque provider IDs as provider observation identifiers. Equal IDs may
suppress repeat observations; conflicting copies should quarantine all copies.
Different IDs do not prove different settled purchases. Neither same price/date
nor a title hash can establish a native transaction ID, and equal price/date
must not collapse legitimately separate purchases. Time-like ID substrings and
zero-like tokens must not supply transaction timestamps or quantities.

The adapter currently requires external reviewed sourceItemId/sourceTransactionId
and an observation timestamp. These are unavailable from the retained evidence.
A documented stable provider event identifier could become an approved source
reference, but only after its uniqueness, correction/replay and cancellation
semantics are established. Mechanically copying a provider ID into a field named
sourceTransactionId does not provide that review.

A source URL can be syntactically safe while proving only a catalog product.
The current inspector rejects query-bearing URLs and unknown routes. Without
actual retained URLs, incompatibility or transaction-link availability cannot be
determined. Do not invent links, strip unknown signed parameters and then claim
verification, or expose private order URLs. Provider-confirmed price/completion
must remain separate from payment, fulfillment and refund verification.

## Downstream compatibility: additional blockers reproduced offline

`tests/the-card-api-compatibility-audit.test.mjs` demonstrates current behavior,
using explicit synthetic scaffolding, not extra real transactions:

- Without usable product_id, even an otherwise fully reviewed hypothetical
  crosswalk cannot match. Alternate spelling or numeric identifiers are not
  automatically accepted by the current strict equality contract.
- The observed title shape fails `scoreListing` language and special-art parallel
  checks and `matchesVariantValuation`. Supplying hypothetical valid rights,
  exact canonical identity and provenance still yields listing_evidence_conflict.
- `getListingType` does not classify the observed title as graded merely because
  normalized grading metadata says PSA 9. The downstream engine also requires
  matching explicit grader/grade labels in the title.
- The exporter intentionally sets status unavailable, rights false, delivery
  license_not_established and truncated true. Changing only the license flags
  would not fix provenance, title evidence, grading or completeness blockers.
- The export drops source condition, shipping, quantity, URL verification and the
  explicit settlement distinction; it does not export localized language aspects.
  Before a real bridge, preserve relevant evidence without inventing observations.
- The intermediate grade normalizer currently ignores has_grade_qualifier=true
  when grade_qualifier and label are null. Autograph-grade flags also require
  review before relying on normalized PSA groups. The audit reproduces the
  qualifier gap without changing it or enabling valuation.

The 1D synthetic happy-path test for the existing engine uses a complete
English/Special Art title, unlike the observed source title. It proves an old
engine contract, not real TCGplayer compatibility. Adapter evaluation medians
are not downstream-approved medians; current commercial gates prevent these
intermediate compatibility gaps from affecting live valuation.

## Licensing and retention (unresolved)

Published terms permit commercial apps and bounded caching on paid plans;
Free is noncommercial evaluation with session-only memory, not persistent API
response storage. Paid transaction caps are 500,000/5 million/25 million for
Starter/Builder/Pro; catalog storage has separate caps. Cancellation requires
stored-record deletion within 30 days. Upstream marketplace compliance is not
guaranteed. Existing account entitlement and TCGplayer-derived rights remain
unverified; successful authentication establishes neither.

Prior Actions logs already retain sanitized transaction observations. The
absence of new adapter I/O does not settle permission for historical logs,
exports, fixtures or backups. Confirm permitted audit/derived-data retention,
access, expiry and deletion scope with the applicable terms/provider. This
audit does not delete logs, change retention or assert that their storage is
permitted. It adds no raw API response archive. References: terms Sections
4/4a/5/7. No subscription, rights grant or commercial activation is authorized.

## Minimum evidence for real valuation, in order

**Raw:** Resolve identity-to-sale linkage, raw/condition classification, source
provenance/uniqueness, per-card units and price/shipping basis, valid dates and
confirmed amounts/currency. Establish licensing and approved retention. Collect
at least the existing minimum of 3 independent eligible raw transactions in a
comparable condition cohort. For the existing current-market qualification, the
newest accepted sale must be within 30 days; all accepted sales must be within
90 days. Prefer the primary 30-day cohort, report 7-day activity and label any
90-day fallback historical rather than current. Report spread and release-day
uncertainty without discarding legitimate observations automatically.

Resolve the downstream title/crosswalk bridge and coverage/truncated policy
explicitly. A one-page sample with a remaining cursor does not prove full coverage.
Do not clear truncated merely to unlock a decision. Three valid samples can
support a sample statistic; they do not establish a full market, settlement or
30/90 days of provider history. The stated free-plan lookback is only three days.
The current three candidates do not yet meet these conditions.

**PSA 9:** Independently meet the same identity, transaction, unit, provenance,
license and recency requirements with at least 3 eligible PSA 9 transactions;
verify actual PSA labeling, grade, qualifiers/designations, certificate evidence
where relevant, and downstream grade-label compatibility. Keep raw and other
graders out of this cohort. No PSA 9 transactions have been established here.

**PSA 10:** Separately repeat for at least 3 eligible PSA 10 transactions with
appropriate label/qualifier evidence; do not infer from PSA 9, raw prices,
population distributions or a modeled multiplier. None are established here.

**Grading recommendation is a separate threshold:** `financialEvidence` requires
qualified raw/PSA9/PSA10 groups and a nontruncated sold response for an actionable
decision. A positive Grade It additionally requires validated identity-matched
individual-grade probability evidence, robust net economics and condition safety.
A qualified raw-card statistic alone does not authorize that recommendation.

## Audit scope and validation

Only this documentation and five isolated audit tests are added. No production
source or previous fixture is changed. Five audit reproductions and fourteen
existing adapter tests pass (19 total); the existing 32 Card API and 13 CardSight
offline tests also pass (64 total). Synthetic test licenses and reviews are
explicitly non-real and are never used in the adapter's default registry.

    node --test tests/the-card-api-compatibility-audit.test.mjs tests/the-card-api-adapter.test.mjs

No sales/catalog API calls, paid services, subscriptions, Actions runs, deployments,
credential operations, main changes or scanner modifications were made. The next
step is evidence/contract review, not another broad search or production activation.

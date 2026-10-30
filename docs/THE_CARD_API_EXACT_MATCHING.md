# Milestone 1H — exact-card matching

Reviewed restoration head c8dffaa and owner-authorized run [40969652738](https://github.com/gempredict/gempredict-live/actions/runs/40969652738). No provider requests were made for this implementation. No raw responses are retained.

## Evidence and changes

The retained aggregate confirms A: 25/1066 total, 2 candidates; B: 25/2202 total, 2 candidates; C: 11/11 total, zero target candidates. All A/B source URLs were recognized public TCGplayer catalog routes, including the four candidates. C had 11 provider-structured PSA 10 classifications, 3 invalid completion dates, and 11 URLs outside the existing safe recognized routes. Actual URL values and failed date values were not retained. This does not establish that those URLs or records are invalid.

Local candidate screening now accepts documented structured card_set and full card_number evidence when a short title omits them. Supplied conflicts and contradictory standardized title segments still fail. Names, full fractions, approved set aliases, explicit language/rarity/printing conflicts and ambiguous variants remain checked. Candidate screening is not verified identity. Missing language or printing stays unresolved in the unchanged reviewed-crosswalk gate; Holofoil never supplies SIR proof.

Added fixed date-failure reason counts: missing/invalid sale date, missing/invalid timestamp, impossible timestamp calendar date, future completion, or date/timestamp conflict. The same pure check protects the offline adapter. Tightened an actual offline-reproduced validation bug: JavaScript accepts 24:00:00 and rolls it to the next day; such a timestamp previously passed the benchmark's syntactic check. It is now rejected without repair. **There is no evidence this caused the three real failures.** They remain unexplained until a safe diagnostic distinguishes the reasons. Valid source timestamps remain unchanged. Existing lexical date agreement is preserved; no timezone or midnight value is fabricated.

Aggregate present/missing/null counts now cover documented identity fields and unresolved optional product/language/printing/quantity fields. These counts test availability without printing identifiers or values; presence does not establish validity, uniqueness or a usable mapping.

## What still needs evidence

Official [sales docs](https://www.thecardapi.com/docs) document title, player, card_set, card_number, year, dates and grade/grader. They do not establish a sales product_id, transaction language/rarity/printing or quantity contract. Catalog identifiers and catalog relationships alone do not establish a sale-to-card link.

A supplied TCGplayer product URL can identify a catalog resource after review. It does not prove sale-specific language, condition, printing, quantity or a distinct settled transaction. Do not infer a product ID from opaque sale IDs, construct URLs, use URL slugs as verified identity, or automatically map a product containing multiple SKUs. No real product crosswalk has been approved by this change.

Provider clarification is required for sale-to-product/SKU linkage and language/printing scope; per-card versus order pricing, shipping/quantity semantics; stable event IDs, corrections/cancellations/refunds and deduplication; timestamp precision/timezone and conflicting dates; applicable commercial and TCGplayer-derived rights and retention. Authoritative catalog/checklist or card-image review can establish the canonical target independently, but cannot establish those transaction contracts. Raw condition needs positive evidence; null grades are not raw proof. PSA fields remain provider-reported, not independently verified settlement or certificates.

## Bounded pagination assessment and next test

The documented cursor is opaque, supplied as cursor on the same endpoint; page is ignored with a cursor. A future separately authorized test could cap one fixed query at **two GETs / 25 rows each / 50 total**, request page two only for a nonempty cursor, preserve q/filters/date_desc and host, stop on failures/repeated cursors, deduplicate IDs and quarantine contradictions. No retries, redirects, cursor logging, automatic exhaustion or unknown-to-complete promotion. That would answer whether a second newest page adds exact-card candidates; it would not resolve SKU identity or settlement. **Pagination is not enabled here:** current workflow remains three independent first-page GETs / 75 rows maximum. C reports only 11 total and one page, so pagination is not an evidence-backed fix for C's zero target matches.

The smallest useful next owner-approved test is the existing three-search aggregate benchmark with these field-availability and date-reason counts. It specifically asks which identity fields are supplied and why dates fail, without retaining raw values. Existing workflow: Private vision benchmark; restoration branch; mode dry-run; confirmation AUTHORIZE_THE_CARD_API_BROAD_THREE_SEARCHES_75_ROWS; configured owner and vision-benchmark environment approval. Fresh manual run only. No run was dispatched. Counts alone cannot approve a crosswalk; request the provider contract before widening retrieval or enabling valuation.

## Offline validation

Four new regression tests cover structured-field candidate screening, conflicts, date reason taxonomy/24-hour rollover, private-value suppression and the three owner-reported amounts staying blocked. Fixtures with IDs/times are explicitly synthetic contract examples. The three observed-amount fixtures omit unretained IDs/timestamps. All 86 focused tests across six files and coverage syntax check pass. No main, scanner, Production, commercial entitlement, API caps, authorization, retry or redirect behavior changed.

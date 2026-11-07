# GemPredict identification benchmark

Baseline: ff3b3a5cf2b4326049ec666af11c44fdfc621cbb

Cohort: phase2-initial

Completed accuracy tests: 0. Historical observations: 5 across 2 cards (excluded from accuracy). No zero-denominator result is an accuracy estimate.

| Metric | Result |
| --- | --- |
| technicalSuccess | 0/0 (not measurable) |
| coreAccuracy | 0/0 (not measurable) |
| exactPrintingAccuracy | 0/0 (not measurable) |
| candidateRecall | 0/0 (not measurable) |
| verificationPrecision | 0/0 (not measurable) |
| verificationCoverage | 0/0 (not measurable) |
| falseVerificationCount | 0 |
| unassessableVerificationClaims | 0 |
| unsupportedSportsVerificationClaims | 0 |

## Per-card cohort outcomes

| Card | Category | Attempt | Core | Exact printing | Gaps |
| --- | --- | --- | --- | --- | --- |
| GP-ID-001: Charmander 004/165 | pokemon_standard | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-002: Pikachu 28/73 | pokemon_standard | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-003: Zapdos 133/128 | pokemon_ir | none | unassessable | unassessable | private_front_photo, back_availability, independent_physical_label_review, foil_and_stamp_photo_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-004: Rotom IR 197/182 | pokemon_ir | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-005: Pikachu ex 149/128 | pokemon_sir | none | unassessable | unassessable | private_front_photo, back_availability, independent_physical_label_review, foil_and_stamp_photo_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-006: Rosa’s Encouragement 114/088 | pokemon_other_rarity | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, requested_SIR_slot_not_filled_by_this_reference, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-007: Snivy 5/25 | pokemon_promo | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-008: Babe Ruth SV-40 | sports_unclassified | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-009: 8 Bit Ballers Bryce Harper BB-11 | sports_unclassified | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-010: It Take Two Sand Glitter 52 | sports_parallel | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-011: Josh Dix Bowman 1st Green Auto /99 PA-JD | sports_serial_or_auto | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |
| GP-ID-012: Paul Skenes Nice List MNL-11 | sports_unclassified | none | unassessable | unassessable | private_front_back_photos, year_manufacturer_product_review, independent_physical_label_review, exact_printing_review, reviewed_photo_unavailable, reviewed_core_label_unavailable, no_cohort_scan |

## Historical observations — not accuracy trials

| Observation | Card | Context commit / deployment commit | Technical result | Original proposal | Catalog outcome | Usage / latency / actual cost |
| --- | --- | --- | --- | --- | --- | --- |
| H-ZAP-01 | GP-ID-003 | 64916865bf0ebf0c12e500df8878dd6370e34656 / unknown | unknown  | Zapdos 2025 133/128 | conflict | output tokens unknown; latency unknown; cost unknown |
| H-ZAP-02 | GP-ID-003 | 2490206a4536a6ad6d6d7373c7c1c43c6bb03254 / unknown | reported failure ANALYSIS_RESPONSE_INVALID |  | unknown | output tokens unknown; latency unknown; cost unknown |
| H-ZAP-03 | GP-ID-003 | 3c37d206cdb3a1e97aeccd3df738bd58a2ccdd41 / unknown | reported complete  | Zapdos 133/128 | conflict | output tokens 405; latency unknown; cost unknown |
| H-ZAP-04 | GP-ID-003 | 3bce90f3db3d626ed2a4b2ee169af30663a636fe / unknown | unknown  |  | conflict | output tokens unknown; latency unknown; cost unknown |
| H-PIKA-01 | GP-ID-005 | 88ff567b1a5c527026f44b47f8d619feff833857 / unknown | unknown  | Scarlet & Violet / Prismatic Evolutions | unknown | output tokens unknown; latency unknown; cost unknown |

- H-ZAP-01: model confidence 88; original parallel unknown; printed readings not retained; conflicts subject, cardNumber, year, brandSet; unresolved reasons set_year_unresolved, catalog_comparison_not_retained.

- H-ZAP-02: model confidence unknown; original parallel unknown; printed readings not retained; conflicts not reported / empty; unresolved reasons not retained.

- H-ZAP-03: model confidence 72; original parallel unknown; printed readings setCode: J 30CEN: uncertain; conflicts not reported / empty; unresolved reasons missing_clear_setCode, raw_copyright_transcription_not_retained.

- H-ZAP-04: model confidence unknown; original parallel Special Illustration Rare (full-art holo); printed readings not retained; conflicts finish, parallel; unresolved reasons printing_conflict, missing_clear_setCode.

- H-PIKA-01: model confidence unknown; original parallel unknown; printed readings not retained; conflicts not reported / empty; unresolved reasons raw_response_and_screenshot_not_retained, catalog_status_not_recoverable.

## Category coverage

| Category | Slots | Attempted | Core eligible | Exact eligible |
| --- | --- | --- | --- | --- |
| pokemon_standard | 2 | 0 | 0 | 0 |
| pokemon_ir | 2 | 0 | 0 | 0 |
| pokemon_sir | 1 | 0 | 0 | 0 |
| pokemon_other_rarity | 1 | 0 | 0 | 0 |
| pokemon_promo | 1 | 0 | 0 | 0 |
| sports_unclassified | 3 | 0 | 0 | 0 |
| sports_parallel | 1 | 0 | 0 | 0 |
| sports_serial_or_auto | 1 | 0 | 0 | 0 |

## Failure classifications

No new cohort attempts. Historical failures are listed separately.

Actual costs known for 0/0 cohort attempts; actual total USD: unknown. Latency known for 0 attempts.

## Limits

- Twelve cards do not establish statistical accuracy.

- Historical summaries and synthetic fixtures never enter measured cohort accuracy.

- Other TCGs are not represented in the requested initial 12-card mix.

- An unassessable verification claim is not a proven false verification.


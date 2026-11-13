# Phase 3L.4 — provenance and condition clarity

Base `3819494f4338805da0b1c3236146c4716124ecae`, reconciliation branch only. No real scan or marketplace call was made. The approved Phase 3K markup, component hierarchy, classes, typography, colors and financial economics are unchanged.

## Provider evidence and narrow correction

Read-only upstream research pinned to TCGdex cards-database revision `5fbf524a3650cbf33926382388133c5a14965840` establishes:

- [Fraxure source](https://github.com/tcgdex/cards-database/blob/5fbf524a3650cbf33926382388133c5a14965840/data/Sun%20%26%20Moon/Unified%20Minds/155.ts) supplies core card data but omits explicit variants. [Set source](https://github.com/tcgdex/cards-database/blob/5fbf524a3650cbf33926382388133c5a14965840/data/Sun%20%26%20Moon/Unified%20Minds.ts) supplies Unified Minds, official count 236 and the 2019 release date; it does not enumerate finish availability.
- [Compiler cardUtil.ts](https://github.com/tcgdex/cards-database/blob/5fbf524a3650cbf33926382388133c5a14965840/server/compiler/utils/cardUtil.ts#L101) defaults missing normal to true and missing holo/reverse to false. Legacy detailed entries produced from these booleans are labeled `generated` (line 61). The same marker can also originate from explicit legacy booleans: it cannot distinguish source omission from an explicit exclusion.
- The historical private diagnostic retains the false reverse flag but not the detailed-entry provenance or hosted source revision. It proves a reported provider/model disagreement, not that Reverse Holo is impossible. It cannot be retrospectively classified as a verified generated response. Current upstream source is not a replay of that scan's hosted data.

`catalogVariantProvenance.mjs` now projects bounded provider facts: reference/provider, original hosted flags, flags used for comparison, timestamp attribution, detailed-entry presence/completeness, up to four finish/variant-ID entries, truncation and negative-evidence basis. Runtime upstream revision stays explicitly unknown. `detailedComplete` means the received list was fully/boundedly inspectable, not that all physical printings are known. Raw flags are never rewritten, guessed or promoted into physical truth. The same projection is included in owner-only encrypted diagnostics. Arbitrary fields, pricing and unrestricted prose are excluded.

The comparison correction is restricted to a complete known-finish detailed list whose entries are all marked `generated`: a false legacy flag alone no longer supports a positive printing contradiction. The printing comparison becomes unresolved/printing_evidence_incomplete. Missing flags remain unknown; explicit non-generated contradictions remain conflicts. Missing, malformed or input-truncated provenance cannot borrow the generated classification. Flags-only records retain their recorded disagreement with an explicit provenance limitation; no historic scan is silently reclassified.

Importantly, positive finish support is still required: `catalogIdentityConflicts` retains its finish blocker, overall catalog gating remains conservative, variant/physical printing stay unverified, and financial withholding stays intact. No per-card override, new catalog mapping, extra lookup, model/prompt change or assumed Reverse Holo availability was added.

## Mixed-side wording only

The condition engine and aggregate state are unchanged. In a mixed uncertain/damage category, the existing brief paragraph now explicitly distinguishes sides, for example:

> Front surface: unable to assess reliably. Back surface: suspected scratches requiring physical confirmation.

This is derived only from retained side, certainty and code fields. Missing side is not assigned to front/back; no location is reconstructed. Detailed observations, reasons and regions are unchanged. Suspected findings are not confirmed, and unassessable regions are not clean. The change is text within the existing summary, with no markup/style/layout hierarchy edits.

## Scorecard clarity without new trust

The evaluator now distinguishes fresh in-process actual-file verification from a serialized claim and from owner physical-card approval. Unapproved real imports can report verified JPEG/manifest integrity and preliminary comparisons against declared reference facts, including an original set mismatch and canonical correction, while formal identity scoring remains NOT TESTED and the case remains UNRESOLVED.

A separately labeled runtime-core dimension reports retained diagnostic core support even when the overall catalog result is a printing conflict. It does not become independently reviewed physical-printing evidence. Existing independent-catalog/physical-printing gates are not relaxed.

The optional review-context field `conditionReview.retrospectiveConfirmation` accepts only `timing: after_analysis`, a short source reference and allowlisted attribute/code/side tuples. Output explicitly says after analysis, not blinded ground truth, with no location/severity established. It grants no approval, condition PASS or financial authority. Existing owner approval, reference and adjudication requirements are unchanged. The scorecard never claims a blinded benchmark from this schema.

## Private real-case check

A new ignored derivative review context and scorecard were written in a separate Phase 3L.4 private directory; no original Phase 3L.3 evidence or outputs were modified. The derivative context records the already supplied post-analysis owner statement, preserving all draft approvals as false and unknown reviewer/physical-card/date fields. Actual JPEGs were reread and verified against the original manifest and diagnostic. The new scorecard shows integrity VERIFIED; original set mismatch; canonical set correction; runtime core reported supported; physical printing UNRESOLVED; retrospective confirmation; condition/formal identity NOT TESTED; costs/audited counts unknown; financial outputs WITHHELD. No public evidence files or raw case data are added to the repository.

## Verification and limits

557 full offline tests pass; zero failures, cancellations or skips. Production build and four catalog packaging checks plus owner-demo packaging pass. Regression additions cover omitted versus non-generated contradictory flags, generated defaults without raw-data mutation, bounded/redacted provenance, distinct front/back wording through render/restore/copy, unapproved scorecard evidence and post-analysis confirmation without scoring authority. Existing wrong-set/canonical-correction, no-retry, owner access, identity and financial regressions remain passing.

Local Playwright uses synthetic JPEGs and mocked providers with actual report-rendering and controlled/export paths. Mobile and desktop-width screenshots show the summary; no horizontal overflow, real paid or marketplace calls, or browser errors were observed. These fixtures are not a replay of private Fraxure coordinates or proof of optical accuracy. Native iPhone Safari is not established by Chromium emulation.

Outstanding: the historical hosted detailed-variant record cannot be recovered from its diagnostic; exact physical printing and owner linkage still require independent review; actual scan costs and audited calls remain unknown. Generated metadata is insufficient positive or negative source proof. No unsupported grading, valuation, confidence percentage or submission recommendation is introduced. Stop for review; no Production deployment or PR #2 merge.

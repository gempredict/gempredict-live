# Phase 1A: catalog identity reconciliation

Base: 64916865bf0ebf0c12e500df8878dd6370e34656.
No separate identity-only or condition AI stage is implemented.

## Confirmed causes and scope

1. `catalogIdentityConflicts(card, undefined)` returned the four required field
   names because missing catalog data was treated as invalid comparison values.
   It now returns no conflicts when there is no complete candidate. Missing input
   values also remain incomplete rather than contradictory; explicit completeness
   checks retain the prior gate requirements for language and parallel evidence. Missing candidate,
   invalid fields, provenance and legacy catalog-status checks still block trust.
2. `30C EN` was compared literally with catalog code `30C`, rejecting otherwise
   matching records. Its original reading now survives unchanged, with separately
   parsed code/language metadata. Contradictory clear markings remain blocked.
3. Reviewed `30C` metadata existed in the digest-pinned set source but did not guide
   retrieval. The adapter now reads the documented set endpoint first and uses its
   returned card IDs, requiring subject, full denominator and independent card/set
   agreement. There is no production Zapdos card record or special-case correction.
4. Important catalog states and rejection reasons were lost in generic report and
   diagnostic statuses. A separate outcome taxonomy now distinguishes not_found,
   unavailable, incomplete, ambiguous, conflict and supported, while preserving
   legacy status values required by existing adapters and tests.

The historical Zapdos call's exact hosted-response failure remains unknown. The
reproductions establish code defects, not that the hosted API currently returns a
complete Zapdos record or that every original failure had the same cause.

## Evidence and retrieval

`readIdentityReadings` additionally retains copyrightYear text with photo side,
printed area, certainty and alternatives. `identityVerification.printed` separates
name, complete collector number, original set/language markings, parsed combined
marking tokens, copyright evidence, model-proposed release year and confidence.
The original model observation is not overwritten. Copyright is never copied into
canonical release year; only valid independent catalog facts can correct it.

Reviewed set metadata is derived generically from the existing digest-validated
snapshot and validated set-source blobs. The snapshot/digest, MIT license, asset
paths and narrow hosted-printing correction logic are unchanged. The reviewed
metadata is not a card catalog and cannot fill a missing card response.

For a recognized printed code:

- Fetch the independent `/sets/{id}` response; check ID, localized name, official
  count and release date against reviewed metadata.
- If a card list exists, reject malformed, duplicate or demonstrably partial lists;
  filter exact subject/local ID locally. A missing member remains not_found.
- If the provider supplies metadata without a member list, retain the previous
  bounded name/local-number search and verify the retrieved card's set ID.
- Require actual returned card IDs and full card/set schema. Never synthesize an
  external card ID or replace a wrong denominator with the reviewed count.
- Preserve the five-candidate ambiguity boundary, nine-request budget, deadline,
  redirect protection, caching bounds and absence of pagination/retries.

A source mismatch, incomplete list or request-budget exhaustion is incomplete
catalog evidence, not proof that a card does not exist. An unavailable service is
separate. Rejected broad search results are not adopted as canonical candidates;
fixed reason codes explain why none qualified. Actual compared candidate conflicts,
including protected user year/set conflicts, remain conflicts.

## Reproducible fixtures and before/after outcomes

The Zapdos facts fixture records public upstream revision
`00da1023eddd6878a0bd12570abde1760dba61c7`, card blob
`81cafaa797f6701d0d8b61708cb324dc6a636bd8`, and reviewed set blob
`454be7141b08a542bbc20471f18ac880a1fd6496`. It identifies Zapdos, Illustration rare,
133/128, set 30th Celebration, release 2026-09-16, code 30C and catalog holo/
anniversary-stamp metadata. These do not authenticate a photographed printing.

Mock REST wrappers use explicitly synthetic IDs/filler cards and valid documented
response shapes; they are not retained live provider responses. Ambiguous variants
are deliberately synthetic counterexamples, not additional claimed real cards.
Original base modules were run separately against the same fixtures for comparison.

| Fixture | Before | After |
| --- | --- | --- |
| Zapdos valid independent evidence, AI 2025, combined 30C EN | Unresolved; four phantom conflicts; 2025 proposal retained | Supported catalog identity; canonical 2026; original 2025/88%/copyright retained; financials withheld |
| Missing Zapdos candidate | Four phantom conflicts | not_found; no compared candidate and no field conflicts; no fabricated 2026 correction |
| Multiple plausible variants | Combined marking rejection masked ambiguity | ambiguous; no unique candidate or invented comparison |
| Service unavailable | Four phantom conflicts | unavailable; no field conflicts |
| Partial set listing | Generic unresolved/rejected matching | incomplete; safe catalog_set_list_incomplete reason |
| Wrong denominator | Unresolved with four phantom conflicts | Unresolved/not_found; official_count_mismatch retained; no denominator rewrite |
| Wrong set code | Generic unresolved | Unresolved/not_found; printed_set_code_conflict retained |
| Conflicting language markings | Combined-code rejection masked conflict | Explicit ambiguous/contradictory_clear_printed_readings; no guessed language |
| Protected incorrect year/set | Combined-code rejection masked comparison | Genuine retrieved-candidate conflict; supplied values not silently replaced |
| Prior Pikachu 149/128 | Supported 2026 correction | Same correction and narrow printing provenance safeguards preserved |
| Konnor Griffin BCP-86 | Existing sports protections | Same alphanumeric identity and wrong-year/parallel protections; no Pokémon catalog routing |

New regressions exercise actual multipart handlers, report rendering, saved/copied
reports, pinned mapping metadata, provenance loss, candidate/request limits and
owner-authorized encrypted diagnostic exports. Existing 238 tests remain applicable.

## Diagnostics, licensing and limits

Authorized Preview exports add only fixed catalog outcomes/rejection codes,
comparison presence, and tightly allowlisted printed marking/year fields. Unknown
prose, endpoints, seller data, credentials and raw upstream responses are not added.
Diagnostic authentication, encryption, expiry, flag and privacy gates are unchanged.
Reports/copies display the same outcome and retain original-versus-canonical evidence.

The existing TCGdex MIT notice is retained and packaged. The new fixture is a small
source-attributed derivative of TCGdex facts, not a commercial marketplace data
license. No TCGplayer transaction rights or Card API commercial permissions are
assumed. Production catalog coverage still depends on independently returned data;
only the reviewed 30C set mapping is currently available. Newer conflicting hosted
metadata requires review rather than automatic override. Physical printing,
artwork, transaction provenance and financial eligibility remain unverified/withheld
as before. No output budget, model, retry restriction, HEIC behavior, sports matcher
or condition threshold is changed. No paid provider calls, deployment, merge,
force-push or Production configuration change is part of this checkpoint.

Official endpoint contract: https://tcgdex.dev/rest/set

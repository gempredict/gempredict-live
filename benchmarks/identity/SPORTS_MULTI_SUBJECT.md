# Sports subject groups and copy-serial separation

## Evidence and limits

Scan 888c1493-6bd5-4d9f-8d32-7946bc0e4bb7 is known here only through the owner's summary. The original diagnostic and both prepared-image digests were not supplied or retained in this checkout. Its private import and accuracy scoring remain blocked. The supplemental US102 summary is not a diagnostic, ground-truth review, cohort assignment or successful import. Redacted subject/parallel proposals remain unknown. No historical output has been corrected.

The old contract has one subject string and no dedicated subset, printed title or copy-serial field. The photo consistency comparator treats distinct clear subject strings as conflicting. This is a confirmed representational limitation; without the original readings it does not prove whether this particular scan contained legitimate athlete names, incidental text or actual contradictory readings.

## Generalizable implementation

Sports identity-only requests add a nullable, versioned `sportsIdentity` object alongside the unchanged original proposal fields: subjects, subset, printedTitle, serialNumber, serialReadingIndex and foilTreatment. Each subject includes its own certainty and indices into the original printed readings. Local validation bounds groups to four members, readings to twelve, text to eighty characters and references to existing readings. The existing 80-character legacy subject field remains a practical limit for very long groups. Provider schema enforces structure; local checks enforce bounds and semantics. Legacy reports remain readable without creating structured groups after the fact.

Clear subject observations support a group only if each member references matching clear name-area readings, all clear subject readings are attributed and the legacy/canonical group agrees. Unattributed athletes, mismatched groups, missing evidence and body-text/headline references retain conflict or unresolved status. No fuzzy aliases or name splitting inferred from incidental card text are used. Pokémon uses its existing contract and comparator.

Collector numbers such as US102 and PA-XX remain collector numbers. A copy serial has a separate literal reading reference and must have a positive numerator no greater than its denominator to be called an observed, unauthenticated stamp. A serial-shaped original rarity is preserved as original evidence and flagged; fresh normalized sports rarity is withheld rather than classified as 96/99. Missing serials are never reconstructed from rarity. Subset/title/foil remain proposals; numbering does not establish a parallel, autograph authenticity or printing.

Reports, saved/restored reports and copied summaries retain original observations and the new distinct slots. Safe owner diagnostics retain indexed group attribution, certainty, unmatched indices, serial presence/format/reference/status and fixed issue codes, without adding literal names, serials, subset or title text to the new diagnostic summary. Diagnostic authorization is unchanged.

## Offline before/after

- Two/three athletes with explicit matching front/back name references: previously distinct subjects conflict; now observation-consistent group, still independently unverified.
- Single player: legacy behavior retained; structured form also supported.
- Unexpected athlete or canonical group mismatch: still conflicts.
- Missing/uncertain membership or non-name text: cannot establish supported group.
- Autograph collector PA-XX and copy 96/99: separate observations; neither authenticates the autograph or exact parallel.
- Rarity 96/99 without serial slot: original rarity retained, serial unavailable; no inferred parallel.
- Invalid numerator, wrong serial reference, oversized groups, truncated output or invalid side: unresolved or safely rejected.
- Financial estimates/recommendations: withheld in all cases.

All fixtures are explicitly synthetic. They are not reconstructed live scan records. Actual-SDK tests mock transport, inspect the structured request and exercise the complete handler, diagnostics, report rendering, copy and restore. No live provider request was made.

## Cost and remaining validation

The output cap remains 2,000 tokens, with one paid request maximum and no retries/fallback. The sports prompt and schema add input tokens, not another request. Actual additional billed input and response length have not been measured. More fields can still exhaust the unchanged output budget; truncation remains rejected without repair or retry. Real provider acceptance and multi-card accuracy need an owner-authorized future test after review.

There is still no independent sports catalog. Group consistency is not catalog identity, physical-printing verification or financial eligibility. Obtain the original owner diagnostic and prepared images/digests to establish photo-to-scan linkage before importing/scoring this scan. Review the exact green treatment against trustworthy checklist/printing evidence separately; /99 alone is insufficient. Do not replace another cohort card or count this supplemental summary as a completed accuracy test.

## Validation results

The full offline suite passes 388 tests, with zero failures or skips (376 existing plus 12 new). The production build and all four TCGdex traced-asset/license packaging checks pass. These results validate mocked handling and compatibility, not real-card accuracy or historical photo linkage.

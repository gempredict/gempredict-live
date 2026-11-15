# Sports collector transcription repair

The owner-reported Josh Dix scan 43ec97ca-7d25-419b-a934-6a9ec389d4ac is retained as a supplemental historical summary. The original diagnostic, complete response and prepared images are unavailable here. No omitted serial value, deployment revision, photo hash or live result is invented. This is not an accuracy-scored benchmark import.

## Confirmed code defect

`isCollectorReading` required a digit in every transcription. `readIdentityReadings` called it without category context, and `photoIdentityStatus` used that filtered list for missing readings and row disposition. Thus a literal PA-JD was discarded even when the canonical proposal also contained PA-JD. This deterministic code path reproduces the reported behavior; it does not reconstruct the absent live diagnostic.

## Scoped change

The validator accepts an optional category. Sports syntax supports short numeric identifiers, letter/digit identifiers (US102), letter-prefix hyphen identifiers containing digits (BCP-86, MNL-11, BB-11), and a restricted PA prefix with two or three alphabetic initials. PA is an explicit observed autograph scheme, not a list of players or a catalog mapping. Other all-letter schemes remain rejected pending evidence. Bounded syntax alone cannot tell an actual collector identifier from a plausible-looking token and never grants independent verification.

Sports input is limited to 40 original characters and 20 normalized characters, with bounded segments. Arbitrary words, unreviewed all-letter prefixes, control characters, URLs, injected markup, doubled/malformed separators and slash-separated copy serials are rejected. Existing case, optional leading # and separator-whitespace normalization remain supported. Alternatives are checked too; an invalid alternative cannot silently disappear into a clear accepted reading.

Only sports photo consistency/disposition calls select the sports grammar. The existing Pokémon/legacy digit-based grammar is unchanged, including complete fractions and promo forms TG01/TG30, SV49/SV94, SWSH020 and 001/SV-P. Pokémon catalog retrieval, denominators, language, provenance and verification thresholds are untouched.

## Offline before / after

| Case | Before | After |
| --- | --- | --- |
| PA-JD with sports context | Discarded; collector reading missing | Retained; comparable to canonical PA-JD |
| Canonical PA-AB versus reading PA-JD | Reading discarded | Explicit collector-number conflict |
| US102, BCP-86, MNL-11, BB-11 | Retained | Retained |
| Pokémon complete fraction / promo | Retained | Retained under original policy |
| PA-JD in Pokémon context | Rejected | Rejected |
| Arbitrary words, malformed sports IDs, copy serial in collector slot | Rejected or overly broad legacy syntax | Rejected under sports policy |
| Serial, subset, title, foil and autograph observations | Separate sports fields | Preserved, not authenticated |
| Independent sports identity / financial approval | Withheld | Withheld |

Six new regressions cover syntax, adversarial input, unchanged Pokémon rules, canonical conflicts and complete-handler preservation of distinct sports fields. The mocked serial 12/99 and synthetic subset/title are test data, not the historical Josh Dix stamp. No new provider request, retry, schema change, prompt change, paid call or new live scan is introduced.

Validation completed: 394 passed, zero failed, zero skipped (388 existing plus six new). Production build passed. All four TCGdex snapshot/reviewed-source/reviewed-set/license traced-asset packaging checks passed. The supported all-letter sports prefix is deliberately limited to PA; additional schemes need evidence and explicit review. Neither syntax acceptance nor agreement between two model fields is independent catalog verification.

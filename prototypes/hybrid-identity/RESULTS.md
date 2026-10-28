# Measured development-case results — October 28, 2026

**$0 new provider spending; zero external identification calls.** This is a local
prototype, not a production rollout, a PSA assessment, an authenticity test or a
three-model paid benchmark. All four privately uploaded JPEGs were actually used,
with the existing mobile normalizer and server validation. Labels were used only
by the evaluator. No photographs, image transformations, OCR dumps, raw provider
responses or private evaluation manifests are in Git.

## Real-photo retrieval and verification

Reference label: 2026 Pokémon 30th Celebration Pikachu ex #149/128, English,
Special Illustration Rare, holo. The catalog is independent TCGdex data. The two
captures belong to **one physical card**; these are development/tuning examples,
not held-out test cards. Three repeats per pair measure deterministic repeatability,
not six independent recognitions.

| Real photo pair | Runs | Top-1 / top-5 retrieval | Supported catalog identity | Printed evidence | Median engine time |
| --- | ---: | --- | --- | --- | ---: |
| Original | 3 | 3/3; 3/3 | 3/3 `identity_candidate` | Pikachu, 149/128, 30C EN | 9.180 s |
| Improved | 3 | 3/3; 3/3 | 0/3; consistently `ambiguous` | Pikachu ex, 149/128; small mark read as 30CW | 8.757 s |

The correct top record is `30th-149` in all six runs. Rank/canonical metadata
includes 2026, 30th Celebration, English and Special illustration rare from the
catalog. The improved photograph's top-ranked catalog record is **not** promoted
to a supported identity: `W` is not silently rewritten as `EN`, and the scorer's
known language is never supplied to OCR. No incorrect identity was accepted.
Each pair produced one stable top-ranked identity and one stable decision state.

- Top-1/top-5 retrieval: 6/6, against the **partial** 5,881-record corpus.
- Supported correct identity: 3/6; wrong supported identity: 0/6.
- Catalog explicitly documents holo: 6/6. Physical printing verified: **0/6**.
- Catalog rarity agrees with SIR: 6/6. Physical rarity-symbol classification was
  not implemented/claimed; OCR sometimes transcribes the stars inconsistently.
- Actual engine times: original 9.180, 9.657, 8.981 seconds; improved 9.348,
  8.757, 8.647 seconds. Overall range 8.647–9.657 seconds. The JSON p50 uses the
  upper middle sample (9.180 s). Mobile preparation/server startup and catalog
  materialization are not included in Python's processing timer.

The first Tesseract/contour-only measurement returned retake on both original
images and no correct top-five result. The improvements were driven by observed
failures: isolate the card against background texture, preserve text resolution,
ignore photograph-frame contours (including after mobile recompression), and use
small scene-text OCR models where outlined italic text defeated Tesseract. The
code contains no Pikachu name, target fraction, target set or target-specific
exception. Additional independently labeled cards need no scoring-code changes.

## Artwork matching: real control versus missing independent evidence

The implemented local SIFT/RANSAC matcher was run on the **actual original and
improved front photographs**, rectified locally:

- 520 tentative correspondences; **452 geometric inliers**.
- Inlier ratio 0.8692; query/reference hull coverage 0.6316 / 0.7108.
- Heuristic score 0.8692, which is not a calibrated probability.

This is a **same-physical-card positive control**, not a catalog-reference match.
It was not used in ranking/scoring either identity. Using one owner photo as a
labeled catalog reference to recognize the other would leak the answer.

Independent catalog artwork matching is **BLOCKED**: no lawfully documented,
identity-linked catalog reference images are available locally, and this task's
policy blocks TCGdex API/assets domains. No image-rights grant for unrestricted
commercial use was established. Neither a missing image nor matching catalog
rarity is counted as artwork agreement. The prototype includes reference hash,
source URL/card ID, rights, spatial-support and evaluation-leakage checks, ready
for a legitimately supplied reference corpus.

The same owner's actual back photograph supplied as the front is a real negative
control: **retake, no supported identity, no collector fraction, no production
trust**. Generic backs are validated but never used as unique card identity.

## Comparison evidence

| Approach | Evidence type | What was actually observed | Untested/blocked |
| --- | --- | --- | --- |
| Existing Claude/catalog architecture | Historical private Preview receipts at `2b6ade579c8876930da535d6f69aea645c2f7dd9`; owner-reported initial identities | Original scans 1–2: wrong AI 151/149/165 proposals, catalog insufficient, no valuation searches. Third scan: catalog correction and provisional analysis. | No fresh paid calls; current `4eddf2f` scanner accuracy on these files untested. Raw third AI identity/defect truth not recoverable from receipt. |
| Local OCR + catalog prototype | Actual four photos; 3 runs per pair | Correct record ranks first in both pairs; original supported, improved safely ambiguous. | Independent catalog artwork and physical finish are not verified. One card, partial corpus, tuned case. |
| TCG API specialist | Public documentation plus synthetic adapter contract tests only | Documents 25 once-per-account free scans, API-key auth and separately billed scan packs. | No account/key, verified free allowance or specialist-specific photo-sharing authorization; zero real scans. |

Historical receipt IDs: `3b7dfae2-d545-4950-a9a3-753521c6981a`,
`b5d82e8d-ad6b-4dab-a8d8-7dd3d602f1a5`,
`b330d552-0e9f-44a2-9aed-5f0574f84354`.
See the prior [vision checkpoint](../../docs/VISION_RELIABILITY_CHECKPOINT.md).
Those full prediction receipts took 25.409, 24.492 and 40.383 seconds, including
other pipeline work; they are **not directly comparable latency measurements**
against this local identifier. Historical API cost is unknown, not assumed zero.
No winner across current vision providers is claimed.

## Reproducibility and coverage

Private benchmark catalog SHA-256:
`eafda93d4da927af216e0abe3a168f2b52ce829359cb36e8246bd97bfa8a1614`.
Public source revision: `cbddf7e54033b1b58e44af1049c88832e55b94d0`.
The corpus includes 23 Pikachu ex records and 5,881 total safely parsed records;
22,253 numeric source paths were examined. Coverage is explicitly incomplete.
Existing validated TCGdex snapshot/license and all source provenance are retained.
No downloaded TypeScript was executed.

Runtime: Tesseract 5.5.0, RapidOCR 1.4.4, ONNX Runtime 1.23.2,
OpenCV 4.13.0, NumPy 2.3.5, Pillow 12.3.0. Bundled OCR models total about 16.2 MB,
not a remote LLM. Their exact fingerprints:

| OCR model | SHA-256 |
| --- | --- |
| PP-OCRv4 detector | d2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9 |
| PP-OCRv4 recognizer | 48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b |
| Mobile orientation classifier | e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c |

The private result also records code/source and prepared-image fingerprints,
OCR extraction/regions, ranked candidates with per-signal scores, metadata origin,
rejection reasons and all per-run times. The result was measured on the exact
implementation source fingerprint reported there; saving a commit does not turn
these measurements into held-out accuracy or verified production behavior.

Validation passed:
- Existing application: **368 automated tests**, no failures/skips.
- Prototype: **5 Node contract tests + 15 Python algorithm/guard tests**, passed.
- Production build and catalog snapshot/MIT-license packaging checks, passed.
- iPhone 13 / Pixel 7 browser upload smoke, passed.
- Actual four-photo mobile preprocessing, six real local evaluations, real
  same-card artwork positive control and real back-only negative control.
- Prediction output trace contains no prototype code, OCR models or private assets.

Synthetic tests cover conflicts, safe abstention, geometric matching and security
contracts; they do not establish real vision accuracy. No production trust rules
were relaxed, and no grading/market/financial workflow was integrated or changed.

## Smallest next action

Keep the production scanner unchanged. Supply lawfully usable independent catalog
reference images with documented identity/provenance/rights, and add a held-out
multi-card set including similar artworks, different printings, languages and bad
photos. Improve generic printed-mark OCR against that set before integrating.
The current result demonstrates a viable **catalog-first OCR retrieval path**,
including a safe abstention; it does not prove a complete hybrid verifier or broad
accuracy. Optional specialist evaluation requires an existing authorized key,
verified free-only allowance and explicit sharing consent. Do not buy anything
under this checkpoint's $0 budget.

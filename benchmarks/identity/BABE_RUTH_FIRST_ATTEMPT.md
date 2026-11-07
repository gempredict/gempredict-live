# GP-ID-008: first sports attempt and photo-evidence reconciliation

Base/deployed diagnostic revision: `3cc855b598bb2c5625e84fd6f6aa2fdcf1781215`. Scan `9ad2042b-9cd1-46e3-8e9e-8e1d6bda386c`.

## Reviewed evidence and outcome

The owner provided an archive containing two JPEGs, the actual exported diagnostic and a file-hash manifest. Archive entries were inspected and extracted only to the ignored private benchmark directory; no scripts or document instructions were executed. The package notes were treated as evidence and privacy guidance, not new authorization. All three declared SHA-256 values match the actual files. Photographs, hashes, the raw diagnostic, private imported observation and private measured report are excluded from this commit.

The front visibly identifies Topps Allen & Ginter and 2025, with a Yankees/World Series caption. The back names Babe Ruth and SV-40. The independent [TCDB record](https://www.tcdb.com/ViewCard.cfm/sid/579607/cid/32681153/2025-Topps-Allen-%26-Ginter---Sweet-Victory-SV-40-Babe-Ruth) and [BaseballCardPedia checklist](https://baseballcardpedia.com/index.php/2025_Topps_Allen_%26_Ginter) independently associate that product, subject and collector number with **Sweet Victory**. Their descriptions do not authenticate a physical copy. The latter also describes insert parallels, so the exact printing is deliberately unresolved rather than inferred from a still photograph. No grading or valuation was performed.

The benchmark manifest now contains an independently reviewed partial label: subject, year, manufacturer, main product, subset and full collector number. Foil/parallel, autograph, serial and other exact-printing assertions stay unresolved. This is a human photo/checklist adjudication, not a new integrated sports catalog or an automatic correction of the app's identity proposal.

| Field | Actual proposal / component | Reviewed reference | Comparison, not scored accuracy |
| --- | --- | --- | --- |
| Subject | Babe Ruth | Babe Ruth | Consistent |
| Year | 2025 | 2025 | Consistent |
| Manufacturer | Topps | Topps | Consistent |
| Main product | Allen & Ginter within compound set text | Allen & Ginter | Literal component consistent |
| Subset | Storied Victories | Sweet Victory | Incorrect component |
| Collector number | SV-40 | SV-40 | Consistent |

The diagnostic's full `identifiedBrandSet` remains `2025 Topps Allen & Ginter - Storied Victories insert`. It was not replaced, aliased or rewritten to Sweet Victory. The model supplied no separate subset field; the table describes literal components for review only. No five-of-six accuracy score is claimed.

## Linkage is not established

Both supplied JPEGs are **1152×1536**. The scan diagnostic reports **1920×2560** prepared front and back images. The older export contains no prepared-image hashes. Matching the package's declared hashes proves package integrity, not that these exact bytes were submitted in this request. The dimension mismatch prevents an exact-byte linkage claim; it does not establish tampering or explain how the mismatch occurred.

The existing private import workflow was used with hashes computed from the supplied JPEG files, producing first attempt `RUN-BABE-001` for GP-ID-008. The imported diagnostic preserves deployment revision, proposal, conflict, usage and uncertainty metadata. Its private report records **technical success 1/1**, but **zero completed accuracy tests**, with core, exact-printing, recall and verification precision denominators all zero. Candidate lists, actual cost and latency are unavailable. Usage is 4,811 input / 351 output tokens, with zero cached-read/creation input tokens. No actual bill or duration was invented.

The public report remains the historical-only cohort snapshot; the private real observation was not copied into it. A sanitized machine-readable adjudication is committed in `adjudications/GP-ID-008.json` instead. The new label alone must not turn the historical scan into an eligible accuracy trial.

## Subject conflict: confirmed behavior versus hypothesis

The actual export retains one clear subject reading from each side, but **neither literal reading nor area**. It therefore cannot reveal whether the readings differed because of a model error, a team/headline mislabeled as a subject, or another comparison mismatch. No actual reading was reconstructed for a regression fixture.

Current code compares every clear subject reading using normalized exact text against other clear readings and the canonical proposal. Different normalized values or a disagreement with the proposal cause a subject conflict. Side alone does not cause one; identical front/back readings do not conflict. This guard is unchanged. A front caption being assigned to `subject` is plausible because the supplied front shows a team/caption rather than a printed Babe Ruth name, but the absent literal values prevent confirming that hypothesis for this scan. We do not relabel this scan's subject conflict as definitively false.

A previously saved ordinary identity report containing `originalIdentityObservation.identityReadings`, if it exists, could resolve the comparison without another paid scan. It is not present in the supplied package. No raw model response, owner secret or new paid request is required or requested here.

## Justified, generalizable changes

1. **Category-aware photo requirements:** sports identity-only reports require clear subject and collector-number observations for their missing-reading summary. Pokémon language/set-code requirements and combined language-code parsing no longer apply to sports. Explicit sports language contradictions still conflict. Subject, number and protected-user conflicts remain strict. Sports cannot borrow Pokémon catalog flags or become independently verified.
2. **Truthful sports presentation:** explains that no trusted sports runtime catalog is connected, language marking is optional, and no Pokémon set code is required. Removing an irrelevant requirement does not verify identity or enable finances.
3. **Safe comparison diagnostics:** owner-authorized exports retain subject-reading indices, side, area, distinct count and whether each matches the proposal. No new literal reading text is exported. This will distinguish competing explanations in future already-authorized scans.
4. **Prepared-image provenance:** only the existing owner-authorized diagnostic observer computes SHA-256 digests of the actual buffers passed to the vision SDK. A mocked complete-handler test compares these with the SDK request's decoded images. It does not store image bytes or change upload/HEIC handling.
5. **Fail-closed benchmark linkage:** accuracy eligibility now requires actual reviewed photo-file hashes to match retained prepared-image digests for every supplied/required side. A hash typed by an operator alone no longer establishes scan linkage. `--front-file` / `--back-file` compute local hashes; legacy records remain unlinked. The importer also retains the existing cache token field names correctly, including actual zeros.

There is no name-specific Babe Ruth exception, automatic subset correction, relaxed subject matching, provider retry, structured-output change or prompt change. Original observation and incorrect subset survive save/copy behavior. No sports catalog, marketplace stage, financial recommendation or physical-printing approval is added.

## Reproduce privately

```sh
node scripts/identity-benchmark.mjs import \
  --input benchmarks/identity/private/babe-ruth/scan-diagnostics.json \
  --output benchmarks/identity/private/babe-ruth/new-import.json \
  --id RUN-BABE-001 --card GP-ID-008 --cohort phase2-initial --attempt 1 \
  --front-file benchmarks/identity/private/babe-ruth/babe-ruth-front.jpeg \
  --back-file benchmarks/identity/private/babe-ruth/babe-ruth-back.jpeg
```

The command never runs a scan and refuses to overwrite existing output. The supplied legacy diagnostic cannot produce linked accuracy merely by providing these files. Do not change its missing hashes or dimensions to make it score. A matching prepared-photo capture or other independently retained request-bound evidence would be required to resolve the historical linkage; new diagnostics only help future captures.

## Validation and scope

Full offline suite and production build are required before push. New regressions cover unrelated sports subjects, legitimate name/number/language contradictions, misleading captions, unchanged Pokémon requirements, restored reports, actual SDK/mock image digest binding, owner-only export privacy and legacy benchmark linkage rejection. Financial safeguards, HEIC conversion, sports marketplace matcher, catalog thresholds, provider request shape, 2,000-token identity budget and no-retry policy are unchanged. No live paid calls, merges, manual deployments or Production changes.

Validation completed: **363 passed, 0 failed, 0 skipped** (352 baseline plus 11 new regressions). Production build and source/snapshot/license asset tracing passed.

Changed files: `lib/photoIdentity.mjs`, `lib/reportVerification.mjs`, `lib/scanDiagnostics.mjs`, `lib/identificationBenchmark.mjs`, `scripts/identity-benchmark.mjs`, `package.json`, `tests/scan-diagnostics.test.mjs`, `tests/identification-benchmark.test.mjs`, new `tests/sports-photo-evidence.test.mjs`, benchmark manifest/README/public historical report and results, this report and `adjudications/GP-ID-008.json`. All private package members and imported results remain excluded.

# Pre-live-scan financial integration acceptance

Baseline: `693df3e961047b090b9ba6cc0eaaf14b3475a3fa`.
Scope: existing Pikachu financial presentation, private Preview receipts, supplier
attachment boundary, persistence/revaluation. No supplier connection, production
configuration change, new endpoint, real scan or paid provider request.

## Confirmed defects corrected

- Saved Reports labeled `marketSummary.rawMedian` as FMV even for one active ask.
  It now displays **Asking**, **Sold sample**, or **Sold-backed FMV**, based on the
  revalidated evidence. The amount comes from the corresponding financial basis,
  including when sales exist without active inventory.
- Saved modeled PSA10 probabilities and upside lacked source/conditional labels.
  Saved rows now label the probability source, conditional upside and provisional
  status. An asking-only saved report cannot imply a grading recommendation.
- “What To Grade Next” appeared with an empty list for provisional reports and
  could include a qualified negative recommendation. It now only appears for
  actionable positive recommendations.
- A truncated sold response could leave the summary's FMV field populated despite
  withheld recommendation trust. FMV is now unset for incomplete responses;
  observed sample prices remain available in provisional analysis. Decision
  thresholds, identity checks, variant matching and economics are unchanged.
- Main financial output explicitly identifies independent identity status,
  language, and historical gem-rate availability, separately from modeled
  individual probability. Existing visual observations and unverified initial AI
  interpretation remain separated from current canonical facts. Small copy updates
  remove promises of unambiguous recommendations, true grade odds or photo-derived
  grade verdicts; no interface layout or decision architecture was redesigned.

## Private Preview receipt

The existing protected prediction response and runtime pricing receipt gain a
`financialEvidence` object **only when the server identifies Vercel Preview**.
No new diagnostics endpoint. Production emits no prediction pricing receipt;
existing ordinary development diagnostics do not receive this extension.

Existing request ID, duration, mode, identity gate, variant status, active raw
count (`usedRawCount`), financial status and valuation withholding reason remain.
The extension adds:

- `canonicalIdentity`: catalog status, gate allowed and a stable canonical-card
  fingerprint. Full canonical facts remain in the customer report. Logs use a
  SHA256 fingerprint rather than potentially user/model-controlled names, IDs or
  card text; it correlates a report without leaking those fields.
- `soldSamples.raw`, `.psa9`, `.psa10`: accepted and qualified counts, newest age
  in days, and unavailable/unverified/stale/recent-insufficient/qualified status.
  Qualified counts are zero for truncated, stale and undersized samples.
- Sold response coverage and fixed provider-state codes, including
  `provider_not_configured`; asking confidence as an **asking** signal and a
  separate sold qualification status. No invented sold confidence percentage.
- Verified-FMV availability, recommendation actionability, population availability
  and allowlisted financial withholding reasons.

Receipts contain no prices, source listing data, URLs, photos, raw upstream
responses, names/email, cookies, credentials or arbitrary upstream reason strings.
They describe evidence and cannot grant trust. A copied receipt is not a provider
credential or an attestation of commercial rights.

## Adapter readiness and persistence

The existing server-only extension point remains
`fetchCompletedSales(card, { provider: { id, lookup(card, {signal}) } })`.
An approved supplier can map its licensed transaction envelope into that contract
without changing `financialEvidence`. The prediction route presently configures
**no supplier**: its result is explicitly unavailable, with zero qualified sold
counts. A future integration needs server-side adapter selection and its own
contract/access tests, not a core decision-engine rewrite.

Real handler tests submit synthetic sales, population, calibration, trust and
Atlas fields in the client request. They are ignored: the server creates these
inputs itself. Test adapters/fixtures are injected only in the test process and
are not imported into production. Existing timeout/bounds, dated provenance,
exact identity/printing/language matching, grade separation, duplicate handling,
wrong-variant, missing-date, stale and insufficient-sample rejection remain.
Browse's separate six-query/100-item retrieval path remains operational.

Rendered browser coverage exercises the actual mocked handler and built React
application, including the corrected 2026 30th Celebration Pikachu ex 149/128,
English, Holo Special Art identity. Asking-only calculations remain $56.99 raw
baseline, modeled PSA9 $75/PSA10 $180/probability30%, conditional net -$30.49.
No verified FMV, definitive Grade/Skip or Atlas endorsement is shown.

Saving/reloading/reopening/copying/sharing and confirming the variant retain the
source labels. Revaluation sends identity/variant inputs, not cached financial
proofs, and uses a new handler result. Forged cached trust/FMV/Atlas flags cannot
promote the asking report. Canonical facts remain corrected; population/gem rate
remain unavailable. Clearly synthetic rendered supplier cases also cover low
volume, stale transactions, incomplete retrieval, qualified negative economics
and legitimate sales without active asks. These are tests, not observed sales.

## Remaining dependencies and next authorized live test

No sold supplier, commercial transaction license, population partner or calibrated
individual-grade probability service is configured. Sold integration is **not
complete**. Supplier rights, exact-variant raw/PSA9/PSA10 coverage, actual accepted
Best Offer consideration, original transaction IDs, freshness/completeness, API
credentials and saved-report retention terms still need approval/validation.

Smallest next test, after explicit deployment/scan authorization:

1. Create a replacement **private Preview** from this checkpoint's exact pushed
   SHA. Verify Vercel's source commit and use the immutable deployment URL, not
   Production or a moving alias. Keep Vercel Authentication enabled.
2. Confirm the existing protected preflight passes routing, protection, runtime
   snapshot and LICENSE checks, and that Preview writes remain isolated according
   to the existing Preview configuration. No configuration was changed here.
3. Sign in on iPhone and upload the same 2.1 MB HEIF photo once. Use actual returned
   listings: the historical $56.99 ask may no longer be present. Do not fabricate
   it or force a valuation if no usable listing remains.
4. Record receipt ID/duration; compare report identity and variant status with
   the private receipt fingerprint/statuses. With no supplier, all three qualified
   sold counts must be zero, FMV false and recommendations provisional/withheld.
   Any active price is an asking signal; PSA inputs are labeled modeled; population
   and historical gem rate are unavailable. Rejected Claude facts belong only in
   the unverified interpretation.
5. Save, refresh and reopen; check the same source labels and no unsupported Atlas
   or recommendation. Those persistence actions require no additional provider
   request. A real Confirm and revalue would be another provider-using request;
   that flow is validated offline here and can be authorized separately.

This checkpoint does not authorize or perform a deployment or live scan.

## Validation results

- Full `node --test tests/*.test.mjs`: **333 passed, 0 failed, 0 skipped/todo**.
- `npm run build`: passed, including mandatory catalog packaging verification.
  Existing optional Google Fonts optimization could not download its stylesheet;
  the build completed. Node's existing module-type warning is non-blocking.
- `npm run check:catalog-packaging`: snapshot and unchanged MIT LICENSE both
  traced and present. No deployed artifact was created or claimed verified.
- `node scripts/validate-tcgdex-snapshot.mjs`: both pinned printing records valid
  at `a211f11f3ba57d56c65c5ac33be35b77d3280757`.
- All six browser smoke scripts passed against the stable final production build,
  with eight script runs including text-only and Obsidian variants. Financial
  browser coverage includes three asking scenarios and five clearly synthetic
  sold scenarios; Stage A covers all 16 existing scenarios. Mobile checks cover
  iPhone and Pixel; live-report checks cover both persistence outcomes.
- No provider calls escaped the mocked test transports. No environment,
  dependency, routing/authentication configuration, snapshot or license changes.
- Reviewed the complete diff for credentials and unintended changes;
  `git diff --check` passed. The prediction function trace includes **zero test
  fixture files**. Existing identity, variant, currency, comparable matching,
  saved-report protections and decision thresholds remain intact.

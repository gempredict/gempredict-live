# Step 1: local OCR in the real Preview scanner

The previous `/api/predict` flow called Claude before constructing its canonical
identity. The offline prototype was never imported by that route. The scanner
now invokes a local CPU OCR function first for Pokémon uploads in Preview, loads
candidate facts from the pinned local catalog, and uses that seed before any
model proposal or valuation search. Claude's speculative readings cannot replace
local number/set/language evidence. Unsupported local readings block catalog trust.
Existing condition and financial protection remain; physical-printing confirmation
is explicitly required. No sports-card catalog verification is added.

The Python function is part of this same Vercel project, not a new service. It
reuses prototype rectification, RapidOCR passes, deterministic ranking and strict
conflict handling. Tesseract is optional; the deployed path uses bundled CPU ONNX
scene OCR only. The original prototype still uses Tesseract when available.
RapidOCR wheel files/model hashes are validated; all inference is local. There is
no runtime model download, catalog subscription or external identification API.

The 5,881-record English numeric Pokémon subset was rematerialized using the
existing literal parser from source revision
`cbddf7e54033b1b58e44af1049c88832e55b94d0`; card/set Git blobs are verified during
materialization. Full collector counts and release dates are retained. The runtime
catalog is SHA-256 pinned in data/hybrid/manifest.json and licensed alongside it.
Coverage is explicitly incomplete. Missing/ambiguous records remain unresolved.
A local rank is not calibrated confidence, authentication, physical printing or a
PSA grade. No independent catalog artwork images are configured, so SIFT matching
is unavailable and contributes no positive evidence. No reference art is invented.

Local real-image check (two photos of the same physical card, development case):
- Original front: top record 30th-149, supported printed number/name/set/language.
- Improved front: top record 30th-149, but OCR reads the footer as `30CW`; no
  substitution to `30C EN` is made. Confirmation remains required.
Both candidates give catalog facts: Pikachu ex; 149/128; 30th Celebration; 2026;
English; Special illustration rare; explicit catalog printing holo. Physical
printing is unverified, and prices/Atlas are withheld pending confirmation.

For no-paid hosted acceptance, open the immutable protected Preview with
`/?identityOnly=1`, upload front/back normally and click Analyze My Card. This
uses the actual client normalization and `/api/predict` upload handler, then exits
before Claude, market queries, waitlist writes or valuation. The response includes
an identity receipt, deployment/code revision, zero paid-provider calls, candidates
and separate catalog-printing uncertainty. It does not test paid condition analysis
or live financial retrieval. Ordinary Preview scans also execute local identity
first; existing paid condition analysis remains separate.

`tests/hybrid-upload.smoke.mjs` performs genuine uploads against a supplied exact
Preview URL, using private images and an optional private auth/share-link file;
no API/model/catalog replies are mocked. It records receipts outside Git. Node
handler tests mock image/transport boundaries and model replies; Python algorithm
tests use synthetic fixtures. These must not be presented as hosted scan receipts.

Deploy/test only this restoration revision to a protected Preview. Never merge or
promote it to Production. The Python endpoint rejects Production. Existing
same-deployment routing and Vercel Trusted Sources authentication are reused;
cookies are not forwarded. The hosted browser executor must have network access
to the exact Preview hostname. If denied by Codex network policy, report that
blocker and leave genuine hosted acceptance unverified.

## Printed identity gate correction

The original identity-only report unconditionally set both
`catalog.requiresConfirmation=true` and `valuationIdentityGate.allowed=false`.
That was an orchestration error: even supported printed identity could never
pass. Missing reference artwork was already allowed by the evidence rule and was
not the blocker. `variantVerification.status=needs_confirmation` correctly
remains in place, independently of the printed-card identity result.

Now `requiresConfirmation` follows printed support and the report computes the
existing `identitySearchGate` against the final canonical card. Its rejection
conditions remain: confirmation/language requirements, catalog conflicts,
missing/invalid canonical or candidate fields/reference, final identity/artwork/
finish conflicts, explicit year/set conflicts, or unverified catalog status.
No pricing gate is removed. Variant eligibility, qualified financial evidence,
condition restrictions and saved-report protections are unchanged. A printed
identity may pass while financial eligibility remains false.

Automatic printed verification requires: full exact normalized name read at OCR
confidence >=70; exactly one supported full collector fraction in >=2 processing
passes at confidence >=45 and no contradictory high-confidence fraction;
consistent exact printed set code and English language in >=2 distinct passes
with no conflicting parsed mark; one matching identity across the entire pinned
catalog subset (not just top five); valid card detection and >=0.12 rank margin.
The OCR engine records mark observations only above confidence 70. Reprocessed
views of one photo are correlated, not independent physical observations. Unknown
set/language reads, lookalike names or ambiguous catalog variants require
confirmation. Reference artwork is optional and never fabricated; physical finish
and authenticity are not established by text agreement or a catalog Holo flag.

Real local re-evaluation: original verifies printed identity with exact name in
color/gray passes and `30C`/`en` in three footer passes. Improved still returns
30th-149 but no reliable set/language readings, and does not verify. Both retain
`needs_confirmation` for physical printing, null prices and null Atlas. Fresh
hosted original/improved photographic receipts on the corrected deployment are
required before declaring hosted acceptance; old receipts do not validate new code.

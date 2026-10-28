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

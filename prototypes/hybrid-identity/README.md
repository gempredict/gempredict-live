# $0 offline hybrid identity prototype

An isolated local experiment, **not the production scanner or a valuation gate**.
No Anthropic/OpenAI/Gemini requests, remote identification requests, paid credits,
account creation, subscriptions or new infrastructure are used. No app, upload,
financial, grading, saved-report, authentication or deployment code is changed.

## What runs

`run.mjs` uses the existing browser mobile normalizer and server image validation
through `scripts/vision-benchmark/prepare.mjs`: original front/back hashes are
checked; HEIF/orientation/resizing/compression handling is reused. During local
preparation every `/api/` and nonlocal browser request is blocked. The Analyze
button is never clicked. Temporary prepared photos are outside Git, mode 0600,
and removed after execution. Reports/manifests/reference files also stay outside
Git. Do not put photographs or model weights into this directory.

`engine.py` performs local card detection/rectification, Tesseract regional OCR,
small RapidOCR ONNX scene-text inference, exact collector/set/language checks,
name matching and SIFT artwork matching with a RANSAC homography. OCR runs before
catalog ranking; it receives no expected name, set, year or number. The expected
identity is passed only to the evaluator after identification. There is no Claude
proposal field and no target-card correction/number substitution table.

The initial deterministic Tesseract-only attempt failed on both development
photos: background texture/foil, outlined italic text and missing card isolation
obscured the collector line. A line-segment detector and rejection of image-frame
contours fixed isolation, including a failure exposed by the real mobile JPEG
normalizer. Tesseract's stronger English traineddata still did not reliably read
the fraction. Only then was the lightweight, bundled scene-text recognizer added.
RapidOCR's color, grayscale and localized-footer passes transcribe the actual
fraction; no `7`→`/`, guessed denominator, `W`→`EN`, or other target substitution
is made. Native OCR scores and rank scores are **not calibrated confidence**.
The optional stronger Tesseract weights were investigated privately and are not
required, bundled or used by the default implementation.

Candidate weights are 0.45 exact fraction, 0.25 name, 0.15 printed set code and
0.15 spatially supported artwork. Missing artwork contributes zero, never positive
agreement. Explicit conflicting numbers, recognized set marks or languages reject
a candidate before artwork can boost it. Repeated reads are correlated processing
views of one photograph, not independent observations. Two consistent number and
set/language reads plus name agreement and a margin are required for a supported
catalog identity candidate. Generic card backs contribute no unique identity.
Comparable large disjoint card rectangles force retake. Unknown cards, inadequate
text, conflicts, weak configured artwork or rejected reference evidence withhold
supported identification. Unknown/unrecognized marks stay unresolved.

Catalog rarity and explicit printing metadata are separate. No holo inference is
made from SIR rarity. The output exposes catalog printings, but a static photograph
does not independently prove foil, authenticity, condition or a PSA grade.
`productionTrustGranted` and `exactPrintingVerified` remain false. Nothing from
this prototype enters eBay, financial calculations, Atlas or a saved report.

## Install locally, without paid services

Use Python 3.11+, Tesseract 5 with English language data, Chromium and Playwright.
Install dependencies into a **private optional venv**, not the production runtime:

```sh
python3 -m venv /private/gp-hybrid-venv
/private/gp-hybrid-venv/bin/pip install -r prototypes/hybrid-identity/requirements.txt
npm ci
npm run build
```

The existing browser scripts use `createRequire('playwright')`. If it is not
provided by your development environment, install it into a private tools folder
and set `NODE_PATH` to that folder's `node_modules`; set `CHROMIUM_PATH` if your
Chromium is not `/usr/bin/chromium`. No production npm dependencies were added.
The tested Linux runtime used OpenCV **headless** 4.13.0.92; RapidOCR declares the
API-compatible `opencv-python` dependency, hence the ordinary wheel in the optional
requirements file. Both provide the CPU APIs used here. A GUI is never opened.
RapidOCR includes small OCR weights in its package; inference does not download
models, contact a model hub or require an API key. Model hashes/library versions
are recorded in results. Tesseract, OpenCV and RapidOCR are open-source tooling;
use their installed license notices when redistributing those dependencies.

## Build a local independent catalog

Default mode reads the project's existing **hash-validated TCGdex snapshot**.
It currently contains only two records and is not a broad test corpus:

```sh
node prototypes/hybrid-identity/run.mjs --build-catalog --output /private/catalog.json
```

For the real run, a private sparse clone of the public MIT-licensed
`tcgdex/cards-database` was pinned to
`cbddf7e54033b1b58e44af1049c88832e55b94d0`. To reproduce, clone that data repository
outside this application, fetch/check out that exact revision, and sparse-checkout
`data`. This does not create/change an application branch. Then:

```sh
node prototypes/hybrid-identity/run.mjs --build-catalog \
  --source /private/cards-database \
  --revision cbddf7e54033b1b58e44af1049c88832e55b94d0 \
  --output /private/catalog.json
```

Each imported card/set blob is checked against the pinned Git index, parsed with
the existing restricted literal parser, and linked to its actual set import.
Downloaded TypeScript is never executed, imported, transpiled or evaluated.
Unknown syntax, references and invalid dates are rejected; missing printing
metadata stays missing. Records retain card/set paths, Git blob IDs and revision.
Preserve the upstream LICENSE beside the private materialized dataset. Existing
bundled snapshot printing facts retain their separate validated provenance.

Observed corpus: **5,881 records** from 22,253 numeric card source paths. Rejections:
13,789 source-header syntax, 177 nonliteral values, 340 imports, 1,302 unsupported
identity schemas, 482 keys, 210 commas, 72 untracked/unsupported set references.
This is an explicitly incomplete English numeric Pokémon subset, not the whole
TCGdex database or a sports-card verifier. It can include Pocket records; it is
not a physical-authenticity corpus. Do not infer uniqueness outside this subset.
The source/materialized dataset stays private and is not a production fixture.

## Identify a new, unlabeled private photograph

From the repository root:

```sh
HYBRID_PYTHON=/private/gp-hybrid-venv/bin/python \
node prototypes/hybrid-identity/run.mjs \
  --front /private/front.jpeg --back /private/back.jpeg \
  --catalog /private/catalog.json --output /private/identification.json
```

This returns five ranked candidates at most, per-evidence scores, source provenance,
OCR text/regions, rejected evidence, detection/availability diagnostics and timing.
No expected card name is accepted as a CLI argument. `identity_candidate` is a
scoped catalog-supported candidate; `ambiguous`/`retake` requests confirmation or a
better photo. None is a production valuation authorization.

## Reproducible real-photo benchmark

The actual four ZIP members were privately extracted as `original_front.jpeg`,
`original_back.jpeg`, `improved_front.jpeg`, `improved_back.jpeg`. They correspond
to the owner's two specified pairs. All four hashes were checked by the normalizer.
No private photograph, transformed photo, manifest, OCR dump or reference image
is committed. The private evaluation manifest uses this schema:

```json
{
  "repeats": 3,
  "catalogSha256": "SHA256_OF_THE_MATERIALIZED_CATALOG_FILE",
  "fixtures": [{
    "id": "independently-labeled-card",
    "front": {"path": "photos/front.jpeg", "sha256": "ORIGINAL_SHA256"},
    "back": {"path": "photos/back.jpeg", "sha256": "ORIGINAL_SHA256"},
    "expected": {
      "subject": "FULL_CATALOG_NAME", "year": "YEAR", "brandSet": "SET",
      "cardNumber": "FULL_FRACTION", "language": "English",
      "rarity": "FULL_RARITY", "printing": "holo"
    }
  }]
}
```

Add independently labeled cards as new entries; scoring does not change. Expected
labels are never serialized into the identifier subprocess or OCR inputs:

```sh
HYBRID_PYTHON=/private/gp-hybrid-venv/bin/python \
node prototypes/hybrid-identity/run.mjs --benchmark /private/benchmark.json \
  --catalog /private/catalog.json --output /private/results.json
```

Reports separate retrieval top-1/top-5, supported correct identities, incorrect
supported identities, catalog printing agreement, physically verified printing,
per-fixture stability and processing time. Six repetitions of two photo pairs
are **two captures of one physical card**, not six independent accuracy samples.
This case was used for development/tuning; it is not a held-out evaluation.

See [the measured report](RESULTS.md) for results, historical comparison and limits.

## Independent artwork references and rights

The actual SIFT matcher excludes common title/footer text and requires >=18
RANSAC inliers, >=0.45 inlier ratio and >=0.08 convex-hull coverage on both artwork
regions. Raw visual similarity alone cannot override conflicting printed facts.
A same-photo, same-physical-card or synthetic reference is not catalog evidence.
All original/prepared evaluation-photo hashes are excluded from reference input.

Catalog artwork references are configured with `--references /private/references.json`:

```json
{"references":[{
  "cardId":"CATALOG_ID", "path":"licensed-reference.webp", "sha256":"SHA256",
  "sourceKind":"catalog",
  "sourceUrl":"https://assets.tcgdex.net/en/SERIES/SET/LOCAL_ID/high.webp",
  "rights":{"evaluationAllowed":true,"commercialAllowed":false,"reference":"REVIEWED_SOURCE_AND_RIGHTS_BASIS"}
}]}
```

The URL's set/local number must agree with the actual catalog record. Wrong IDs,
missing rights/provenance, hash corruption and evaluation-image leakage reject the
reference; invalid references cannot silently turn into successful corroboration.
Source/rights assertions in this private manifest require caller review; the tool
cannot grant copyright rights or prove that arbitrary local bytes came from a URL.
There is no automatic image downloader or remote image request in the identifier.

TCGdex documents card asset URLs and 600x825 high-resolution images. This task's
network policy does **not** allow `api.tcgdex.net` or `assets.tcgdex.net`, so live
catalog asset delivery, including the exact 149 image, was not verified. No proxy
bypass was attempted. Independent catalog artwork comparison is explicitly BLOCKED
until a lawfully obtained reference set and provenance/rights basis are supplied.

The database's MIT license is not a grant of Pokémon artwork rights. Card images
remain publisher artwork; no unrestricted commercial image license was established.
Do not redistribute reference images, put them in the repository, or ship them as
commercial assets on the strength of the database/software license alone.

Sources reviewed October 28, 2026:
- https://tcgdex.dev/assets
- https://tcgdex.dev/faq
- https://github.com/tcgdex/cards-database/blob/master/README.md
- https://tcgapi.dev/legal/licensing/ (explicitly distinguishes artwork rights)

## Specialist API: free research, not executed

Official documentation at https://tcgapi.dev/api/identify/ and
https://tcgapi.dev/pricing/ documents **25 free identification scans once per
account**, separate from 100 ordinary free requests/day. Any-plan API key is
required, or the alternative x402 route costs $0.02/photo and is disallowed here.
Additional prepaid scans: 1,000/$15, 5,000/$60, 25,000/$250, 100,000/$800.
Retakes consume scans; unavailable reader responses are documented as refunded.
`GET /v1/identify/usage` is documented as free, but was not called without a key.

Licensing guidance allows prelaunch development/testing on any plan; monetized
apps/internal commercial analytics require Pro ($49.99/month) or Business
($99.99/month). The terms govern; this is not a legal/commercial clearance. The
provider cannot license publisher artwork. Research sources:
- https://tcgapi.dev/api/identify/
- https://tcgapi.dev/pricing/
- https://tcgapi.dev/legal/licensing/
- https://tcgapi.dev/legal/terms/

`specialist.mjs` is a minimal request/response adapter with no default network
transport, paid fallback, retry or account creation. It requires its own explicit
photo-sharing consent, a current verified **free-trial-only** balance and an
owner-approved transport before a request can be constructed/sent. Provider
responses remain unverified and never grant production trust or financial evidence.
No existing specialist credential, verified account allowance, service-specific
photo-sharing consent or permitted API domain was established. Therefore its
real-photo comparison is **BLOCKED**, with zero external identification calls.
Marketing accuracy claims are not benchmark results.

## Validation commands

```sh
node --test tests/*.test.mjs
node --test prototypes/hybrid-identity/test.node.mjs
/private/gp-hybrid-venv/bin/python -m unittest discover \
  -s prototypes/hybrid-identity -p 'test_engine.py'
npm run build
node tests/mobile-upload.smoke.mjs
```

Node prototype tests cover catalog provenance, private output permissions/leakage,
separate retrieval/printing scoring and specialist consent/free-balance gates.
Python tests use **synthetic algorithm fixtures** for exact/conflicting numbers,
set/language contradictions, unavailable artwork, geometric positive/negative
matching, shared-template false positives, reference identity/hash/rights/leakage,
printing non-inference and retake. They are not real-card accuracy claims.

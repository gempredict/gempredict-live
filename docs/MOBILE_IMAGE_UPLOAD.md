# Mobile image upload checkpoint

Branch: `restore/phase1-identity-market-matching`; baseline `7fa8ba97`.

## Confirmed defects addressed

The old browser path uploaded untouched files, including unsupported HEIF, and
called `response.json()` without checking content type or authentication. All
exceptions were presented as a network failure. The server also relabeled
unsupported MIME types as JPEG, and could silently drop non-image MIME uploads.
These defects are verified in code. The exact HTTP response from the original
failed iPhone scan was not captured; this change does not claim to establish
which of these caused that particular generic error.

## Upload contract

Both the existing saved-photo pickers and explicit rear-camera capture inputs
use the same preparation path for front/back photos. File signatures establish
format; an empty or incorrect mobile MIME/extension does not control decoding.
JPEG, PNG, WebP, GIF and AVIF use native browser decoding. HEIF/HEIC uses native
decoding where supported, otherwise the lazy, locally bundled `heic-to@1.6.6`
CSP-compatible libheif worker. No image-conversion service or CDN is used.

Preparation applies orientation once, keeps aspect ratio, does not upscale,
crop, sharpen or enhance images, and composites transparency onto white. Output
is JPEG, initially 2560 pixels on the longest edge at quality 0.94. Bounded
compression attempts use qualities 0.94/0.90/0.86 and edge caps 2560/2048/1600.
If a photo cannot fit at that floor, processing fails with an actionable message
rather than reducing detail further. Small originals keep their native size.
EXIF/location metadata is removed by canvas encoding. Grading still depends on
photo quality; these limits cannot establish whether real condition detail or
collector text is legible in a particular photograph.

Sources must be nonempty, at most 25 MiB and at most 40 megapixels. Decoding has a
45-second UI deadline; late bitmaps are closed and timed-out results never
upload. Each prepared image is at most 1,638,400 bytes. The exact serialized
multipart request must be at most 3,584,000 bytes, below Vercel's 4.5 MB limit.
This accounts for both photos, text and boundaries. Concurrent/failed selections
block submission, preventing an invalid photo from silently becoming a text-only
paid request. Re-selecting the same photo is supported after a failure.

The real multipart parser permits at most two files in the expected front/back
fields, limits fields and total image bytes, and cleans temporary files. Both
sides must actually decode through `sharp@0.35.5` before analysis. Raw unsupported
HEIF, malformed/truncated images, excessive pixels and back-only uploads fail
before any provider call. MIME types come from validated bytes; unsupported
formats are never relabeled as JPEG. The prepared-photo limit is enforced by the
server too; it does not accept the old 10 MiB raw upload contract.

The patched sharp release requires Node >=20.9.0. Its semver dependency requires
a lockfile update from 7.8.3 to 7.8.5. Other existing locked package versions are
unchanged. Third-party notices/licenses are retained under
`public/third-party/mobile-images/`; fixture attribution is under
`tests/fixtures/mobile/`. No dependency package source was modified.

## Transport and safety

Prediction requests stay relative to this deployment and carry only normal
same-origin browser credentials. Redirects are not followed. Authentication
failures/redirects, non-JSON or malformed responses, HTTP errors, payload rejection,
local processing failures and fetch rejection have separate messages. HTML,
transport exceptions, authentication headers and image bytes are not printed in
diagnostics. The old full prediction console log is removed.

Vercel protection, the existing Preview integration guard and all canonical
identity, catalog provenance, printing/variant, eBay matching, pricing, grading,
Atlas and saved-report safeguards remain in place. No environment variables,
protection settings or production configuration were changed.

## Validation and real-device acceptance

Run `node --test tests/*.test.mjs`, `npm run build`,
`npm run check:catalog-packaging`, `node scripts/validate-tcgdex-snapshot.mjs`,
and all existing four browser smoke scripts. The additional
`node tests/mobile-upload.smoke.mjs` exercises actual HEIC decoding and production
UI submission under Chromium iPhone/Android device emulation with fully mocked
prediction responses. It checks front/back multipart bytes, JPEG/PNG/WebP,
EXIF rotation, resizing, bad files, authentication, redirects, non-JSON, HTTP and
network errors. Its 2.1 MiB HEIF input is a padded public regression fixture,
not the user's private photograph.

A source audit found no advisories for the added direct dependencies after
selecting patched sharp. Existing production dependency advisories for Next,
form-data, nanoid, postcss and source-map-js remain outside this checkpoint.

Device emulation is not real iOS Safari or an Android camera. No paid requests,
live scan, deployment, or production change was performed. The next acceptance
step requires a replacement protected Preview at this checkpoint's exact commit,
its existing four-check private preflight, and separate authorization for one
live scan using the same original 2.1 MB HEIF Pikachu image. Confirm the oriented
prepared preview is legible before submitting, then check the final canonical
identity and existing trust gates. Do not retry the old immutable Preview.

Final offline result: **282/282 automated tests passed**, production build
passed, snapshot/license packaging and provenance checks passed, all four
existing browser scripts passed, and the additional mobile browser script
passed for both emulated devices. The exact trusted Pikachu fixture and existing
saved-report/identity/variant/financial regressions remain green. The native
sharp binary is included in the prediction-function trace; test fixtures are
not. No exposed credentials or changes to protection/configuration were found
in the final diff review.

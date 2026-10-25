# Saved-report identity validation

## Reproduction and correction

The shared valuation guard previously called `identitySearchGate` without the
final canonical card. Missing canonical fields could also be skipped by catalog
conflict checks. A saved report could consequently retain trusted prices after
its subject, card number, year and set were erased, provided its old verification
and financial flags remained intact.

The guard now always supplies the final canonical card and recomputes identity
eligibility on both fresh and restored reports. A shared pure validator requires
usable subject, complete collector identifier, four-digit year, and set on both
the canonical identity and catalog candidate. It rejects missing/null/blank,
unknown placeholders, invalid types, control characters, invalid years, malformed
identifiers and zero denominators. TCGdex catalog records require the full
collector fraction; standalone sports numbers and alphanumeric game identifiers
remain syntactically supported without claiming those categories have a provider.
A nonempty catalog source and reference are also required for trust.

Catalog conflict checks treat missing required fields as conflicts instead of
skipping them. Missing optional TCGdex details that a candidate explicitly asserts
cannot silently inherit its verification. Pending confirmation, declared catalog
conflicts and unverified catalog states block trust. Malformed identities stop
before listing-title parsing, preventing a malformed card number from throwing
instead of safely withholding pricing.

`safeStoredReport` uses this gate before honoring a saved trusted flag. Invalid
identity clears raw/graded prices, valuation summary amounts, grading upside and
expected return, decision scores, verdict/action/analysis/recommendation, financial
basis and Atlas. Evidence and condition observations remain available. A valid,
unchanged, independently verified report keeps its existing legitimate financial
results and consistent Atlas output.

The existing uncommitted TCGdex integration is preserved. No production fixture
records, credential changes or trust bypasses were introduced. Older test cases
that supplied only successful flags now explicitly provide test-only independent
catalog records; production validation was not weakened to accommodate them.

## Regression coverage

`tests/saved-identity-validation.test.mjs` starts from a genuinely trusted mocked
pipeline report. It independently removes or invalidates each required field,
checks altered identities and partial card numbers, erases the whole identity,
removes required catalog record fields/references, attempts stale flag bypasses,
and tests pending confirmation/conflicts. Every invalid case verifies withholding
of financial values, recommendation text and Atlas; an unchanged positive control
retains trust, prices and Atlas.

The original four-null-field reproduction now returns:

- original report trusted: true
- unknown identity trusted: false
- restored status: untrusted
- raw value, market median, grading upside, action and Atlas: null

## Verification

- Complete automated suite: **194 passed, 0 failed, 0 skipped**.
- Includes **11 saved-report security regressions**, all **26 TCGdex regressions**
  and all **7 Anthropic proxy tests**.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: **passed**.
- Browser smoke scripts: **3/3 passed** — variant UI, both financial-consistency cases, and all 16 Stage A scenarios.
- `git diff --check`: **passed**.

No live Anthropic, eBay or catalog requests were made for this fix. Catalog tests
use mocked transports; browser smoke tests use local servers and intercept or
abort external requests. Existing TCGdex live delivery remains unverified because
of the earlier proxy-policy block. No commit, push, merge, deployment or production
access was performed.

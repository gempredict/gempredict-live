# Independent identity cross-check and pre-valuation conflict handling

## Baseline and investigation

Started from the existing restoration branch at
`915163fd8aadd09446ea44818fbaadf422b6ab2f`, after a clean working-tree check
and an authorized GitHub fetch. No live provider calls were used.

The failed Pikachu ex 149/128 scan's original response/image and neutral Browse
payload are not present in this checkout. The regression recreates the reported
failure shape using mocked seller evidence; it does not assert a real catalog
mapping or claim to reproduce the original remote response verbatim.

The existing route obtains a Claude identity proposal, retrieves an independent
subject/full-number eBay search, reconciles year/set, reconciles variant, searches
for valuations, obtains model pricing, and finally applies valuation protection.
The neutral search itself deliberately omits the proposed year, set, and variant.
However, a listing can match the subject and number without providing usable
set/year evidence. Set extraction requires an unambiguous structured attribute or
clean title span; treatment, condition, or seller prose can make it missing.
Three agreeing informative listings are required to correct a field. Missing or
insufficient evidence leaves the original proposal in the canonical card.
Previously, a populated set with insufficient evidence and zero explicit
conflicts could pass the final identity safeguard. Searches already ran with that
set before the safeguard, allowing the proposal to constrain its own price pool.
No independent catalog source existed to contradict the proposal.

## Changes

- `catalogIdentity.mjs` defines a server-side injected independent catalog lookup.
  Its query contains only subject and full collector number. Each record needs
  an independent reference ID, exact subject/number, year and set. Distinct sets,
  languages, or variants remain ambiguous; duplicate identities cannot vote.
  Conflicting set/year/variant fields are retained as conflicts rather than
  silently replacing the proposal. Lookup failure, invalid data, and empty
  results have explicit unavailable/insufficient states.
- `resolveMarketIdentity` preserves marketplace provenance and adds separately
  attributed catalog verification. It never derives catalog records from sellers,
  Claude output, valuation pools, or client-submitted metadata.
- The route recomputes an identity gate after variant reconciliation and before
  valuation searches or model pricing. Insufficient neutral evidence cannot bless
  a populated AI set. Catalog conflict/ambiguity, missing canonical fields, and
  unresolved seller conflicts block searches. A unique matching catalog may
  resolve absent seller evidence but does not erase contradictory seller evidence.
- Final and restored-report valuation guards recheck the catalog candidate against
  the final canonical identity. A prior verification cannot transfer to a new set,
  number or variant. Withheld values, ROI and recommendations stay withheld.
- Neutral listing relevance rejects competing full collector IDs. It preserves
  ordinary numbered sports parallels when the collector ID is a single number.
  Rejected search results now retain a reason and original observations, not just
  authenticity exclusions.
- Development responses include `identityDiagnostics`: neutral retrieval,
  accepted/rejected observations, per-field decisions, catalog record decisions,
  and the final gate. Detailed catalog decisions are excluded from production
  responses. Existing evidence references remain part of normal verification.
- Strict comparable scoring, query ranking, price-pool separation, variant,
  authenticity and financial calculation safeguards are unchanged. Conflicted
  identities now make zero valuation requests instead of fetching and later
  suppressing the same prices.

## Dependency and limits

There is no independent catalog provider, dataset, adapter configuration, or
credential configured in this repository. The default catalog status is
`unavailable`; no connection, card mapping, or inferred release fact is invented.
A provider-specific server-side adapter must be selected and connected through
`catalogLookup` and `catalogSource` before real catalog verification is available.
The route currently uses the explicit unavailable default.

The prediction pipeline requires catalog verification before valuation searches or trusted pricing.
Marketplace consensus and explicit user choices cannot substitute for a missing,
failed, empty, or ambiguous catalog lookup. Without a configured catalog provider,
the route records `unavailable`, performs no valuation searches or model pricing,
and withholds prices and ROI even if sellers unanimously repeat the proposed set.
Original proposals and neutral evidence are retained for review. This is an
intentional readiness blocker until a real independent source is connected.

Existing pricing scenarios use explicit test-only catalog snapshots in
`tests/helpers/catalogFixtures.mjs`. Those records are separate from model replies
and seller responses. No production catalog data or connection was invented.

## Validation

The new mocked tests cover the reported Surging Sparks/149/128 failure shape,
incorrect sets repeated by misleading listings, full versus partial numbers,
multiple collector IDs, catalog ambiguity across sets/languages/variants, duplicate
records, malformed/missing data, provider failure, stale verification after a
variant change, stored-report protection, zero pre-gate pricing calls, and
production exclusion of development diagnostics. The alternate set used in the
Pikachu catalog fixture is explicitly synthetic, not a claimed catalog fact.

Existing conflicted-set tests now assert zero valuation requests and no usable
price pool. Existing manually confirmed exact-set pricing, sports serial-number,
strict comparable, authenticity, financial and variant tests remain in the suite.

Commands: `node --test --test-reporter=tap tests/*.test.mjs` and
`NEXT_TELEMETRY_DISABLED=1 npm run build`. Locked dependencies were installed
with an authorized `npm ci` from registry.npmjs.org. Final results are recorded
below after verification. All provider requests in tests are mocked; the routing
test uses only local HTTP servers and the proxy tests do not contact Anthropic.

## Final verification

- Authorized locked install: `npm ci --cache /tmp/gempredict-npm-cache --no-audit --no-fund` — passed (363 packages); lockfile unchanged.
- Complete automated suite: **157 passed, 0 failed, 0 skipped**, including all **7 Anthropic proxy tests** and **14 catalog/identity regression tests**.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — passed, including compilation, type/lint checks and static generation.
- Optional browser smoke scripts: **3/3 passed** — variant UI, two financial consistency cases, and all 16 Stage A cases. External requests are mocked or aborted; HTTP servers are local only.
- `git diff --check` — passed.

Additional regression coverage explicitly verifies unanimous misleading seller
listings cannot unlock the Pikachu proposal without a catalog; failed or missing
catalog lookup cannot be replaced by seller consensus or protected manual fields;
and stale saved trust flags cannot override an unavailable catalog observation.
User-facing withholding explains that a missing provider cannot be bypassed by
manual confirmation. No new real-world card facts or special-case Pikachu mapping
were introduced.

Remaining readiness blocker: a real, authorized independent catalog source and
server-side adapter must be configured. Until then the prediction route fails
closed before valuation searches and model pricing. No live Anthropic, eBay or
catalog calls, commits, pushes, merges or deployments were performed.

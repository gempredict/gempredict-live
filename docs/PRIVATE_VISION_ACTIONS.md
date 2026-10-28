# Private vision benchmark on GitHub Actions

This workflow runs the existing `scripts/benchmark-vision.mjs`; it does not change the customer scanner. It compares identity and observable condition evidence, not professional PSA grading accuracy. No model calls are needed for `dry-run`.

## Security boundary

The repository is public. There are deliberately **no artifacts, comparison summaries, raw responses or photo-derived metrics in workflow logs**. Only generic status messages are printed. Sanitized numerical comparison metrics are AES-256-GCM encrypted and PUT to owner-controlled private storage. Photos, decrypted manifests and raw responses exist only in the ephemeral runner's private temporary directory and are deleted by an always-run cleanup step. Runner termination can prevent cleanup; use GitHub-hosted ephemeral runners, not persistent self-hosted runners. Provider retention policies still apply to submitted images; OpenAI requests set `store:false`, and images are sent inline rather than uploaded to a Files API.

Only `workflow_dispatch` exists. Permissions are `contents:read`, action references are commit-pinned, checkout credentials are not persisted, dependencies are locked and lifecycle scripts disabled. Live mode additionally requires the exact repository/branch, the approved actor's numeric ID, first run attempt, explicit confirmation, an enable variable and the protected `vision-benchmark` environment. Live secrets are scoped to individual steps; browser/preparation children have credentials and debug settings removed. No user authentication cookies are forwarded. HTTPS storage is restricted to one configured public hostname; redirects and private addresses are rejected. Never enable debug logging or disable TLS verification.

Repository write access and approved workflow code remain a security boundary: repository secrets can be referenced by other workflows. Restrict write/admin access and review the exact commit before approval. Environment protection must be configured by the owner; declaring an environment in YAML does not create reviewer rules.

## Owner setup (not performed by this change)

1. GitHub requires a dispatchable workflow to exist on the default branch (`main`). Register this reviewed workflow there through the normal approved process, then dispatch **the restoration branch**, never main. This task does not merge or change main. Check Vercel's automatic deployment integration first: registering a workflow on main must not inadvertently authorize a Production deployment. Until registration is done, the branch-only workflow may not appear in Actions.
2. Create the `vision-benchmark` environment with a trusted required reviewer and deployment branch restriction to `restore/phase1-identity-market-matching`. Review bypass/self-review policy deliberately. Do not attach a deployment URL or disable existing Vercel protection.
3. Configure these repository variables:
   - `VISION_BENCH_OWNER_ID`: owner's numeric GitHub user ID, not username.
   - `VISION_BENCH_STORAGE_HOST`: exact public HTTPS hostname for both private object URLs.
   - `VISION_BENCH_LIVE_ENABLED`: leave unset/false until dry-run and configuration review pass; then set `true`.
4. Configure encrypted repository secrets (never paste values in issues, commands or logs):
   - `VISION_BENCH_ANTHROPIC_KEY`, or existing `CLAUDE_API_KEY` (GitHub secret names are case-insensitive).
   - `VISION_BENCH_OPENAI_KEY` and `VISION_BENCH_GEMINI_KEY`.
   - `VISION_BENCH_DATA_KEY`: the private base64 32-byte encryption key generated below.
   - `VISION_BENCH_BUNDLE_URL`: short-lived, read-only HTTPS GET URL for the encrypted photo bundle.
   - `VISION_BENCH_RESULTS_URL`: short-lived HTTPS PUT URL for one private encrypted results object. It must allow **two PUTs**: a zero-request channel-check receipt, then final metrics overwriting it. A one-use URL will fail final delivery.
   Environment secrets with the same names may be used for stronger reviewer-gated access. GitHub secrets are independent of Codex Personal Vault bindings; no automatic transfer occurs.
5. Use existing owner-controlled private object storage, private ACLs and deletion/lifecycle rules. Provisioning storage or credentials is outside this workflow. URLs need no cookies or additional authorization headers. Keep URLs valid through approval and the approximately 20-minute job, but never make the objects public. Revoke URLs and delete objects after retrieval.

## Prepare the four real photos privately

Use the original front/back and improved front/back photographs. Do not put them or the manifest inside the checkout. Copy `benchmarks/vision.example.json` to a private directory, change fixture IDs to **`original`** and **`improved`**, supply both paths and SHA-256 hashes, consent/rights references and independently reviewed identity and visual-condition labels. Keep `category: "pokemon"` for both. Existing unreviewed example labels intentionally fail admission. A pack-fresh assertion alone does not establish defect-free or PSA 10 ground truth. The reference identity is only for scoring; it is not inserted into model prompts.

Run locally from the repository, with all output destinations outside Git:

```sh
node scripts/vision-benchmark/actions.mjs keygen --output /PRIVATE/vision/data-key.txt
node scripts/vision-benchmark/actions.mjs seal-photos \
  --manifest /PRIVATE/vision/manifest.json --key-file /PRIVATE/vision/data-key.txt \
  --revision EXACT_REVIEWED_40_CHARACTER_COMMIT_SHA --output /PRIVATE/vision/photos.enc
```

The envelope is authenticated against repository, exact execution SHA and purpose, with a default 20-minute expiration (maximum 30 minutes). Seal shortly before retrieval, allowing for build/reviewer delays; expired inputs fail before calls. Do not queue a sealed bundle for later use. Upload only the encrypted bundle; configure its GET URL and the separate results PUT URL as secrets. Use the same reviewed photographs, labels and data key for smoke/full: the encrypted result's keyed `datasetCommitment` permits comparison without exposing image fingerprints. Reseal for each dispatch and rotate the results destination to avoid overwrites between runs.

Each source image is capped at 6 MiB, all four at 12 MiB. The existing mobile normalizer prepares identical JPEG bytes for all providers. The guard requires front/back JPEGs, each at most 1.6 MiB, dimensions 512–2560, aspect ratio 0.5–2, and a conservative whole-dataset input bound. Invalid/overlarge images fail before the first model call. Do not upscale small images or weaken limits merely to force admission.

## Execution and budget

First dispatch `dry-run` on the restoration branch. It receives no API/photo secrets, installs locked dependencies and runs contract tests and a credential-free benchmark expected to report BLOCKED with zero requests. This local change has not itself dispatched GitHub Actions.

Then dispatch `smoke`, confirmation `AUTHORIZE_SMOKE_0_75_USD`: one front/back pair, once per provider, **3 maximum requests**. Retrieve/decrypt its metrics and verify provider model availability, usage, valid structured responses and dataset commitment. Only then separately authorize `full`, confirmation `AUTHORIZE_FULL_4_25_USD`: two pairs, three repeats per provider, **18 maximum requests**. There is no automatic escalation from smoke to full and rerun attempts cannot make live calls. A new dispatch is a new authorization: do not repeat failed runs without reconciling usage and remaining budget.

Models are `claude-sonnet-4-6`, `gpt-4.1-2025-04-14`, `gemini-3.1-pro-preview`. Their availability for the owner's accounts remains untested. GPT-4.1 has a published January 2027 retirement; check availability before use. Preview Gemini may truncate JSON at the shared 2,000-total-output-token ceiling; this is a smoke-test failure, not permission to silently raise the cap.

Before **every** HTTP attempt, a new on-disk journal reserves capacity; all failures retain their full reservation. No retries occur. Missing usage, changed model IDs, invalid output or bound violations stop subsequent requests. Every fixture's image/prompt bound is checked before any request. The conservative envelopes are 64,000 input tokens and 2,000 total output tokens, priced at reviewed USD/M input/output rates: Claude 3/15, GPT 2/8, Gemini 2/12 including thinking, plus 25% headroom. Integer-microdollar reservations are **$0.6475 smoke**, **$3.885 full**, below the per-dispatch $0.75/$4.25 admission ceilings; one of each stays below the $5 authorization.

These are **pre-request admission controls, not a provider-side hard billing cap**. They depend on documented tokenization, output limits and reviewed rates; invoices, taxes or provider changes can differ. They do not aggregate independent dispatches or other account activity. Verify provider spending controls and current pricing before approval. Rates are pinned to October 28, 2026 and fail closed after seven days; later runs require an explicitly reviewed rate/policy update, not simply changing a timestamp. The input bound conservatively dominates documented patch/tile formulas and UTF-8 prompt length; actual usage must fit it. Provider-side controls are preferable where available.

Retrieve the private encrypted result and decrypt locally:

```sh
node scripts/vision-benchmark/actions.mjs open-metrics \
  --input /PRIVATE/vision/results.enc --key-file /PRIVATE/vision/data-key.txt \
  --revision EXACT_REVIEWED_40_CHARACTER_COMMIT_SHA --output /PRIVATE/vision/metrics.json
```

Only allowlisted numeric/enum metrics are delivered: sample/valid-response counts, identity-field accuracy, defect errors, stability, latency, usage-derived cost estimates and reservation status. No provider prose, proposed identities, photos, paths, image hashes or label text are delivered. Missing evidence stays null/unknown. A zero-request receipt means input-channel validation only, not a completed benchmark. A killed/timed-out runner may leave only that receipt; reconcile provider billing before another dispatch.

## Verification and references

```sh
npm ci --ignore-scripts
npm ci --prefix benchmarks/ci-tools --ignore-scripts
node --test tests/vision-benchmark.test.mjs tests/vision-actions.test.mjs
node scripts/vision-benchmark/actions.mjs dry-run
node --test tests/*.test.mjs
npm run build
```

Validate YAML/expressions with actionlint. `benchmarks/ci-tools` pins preparation-only Playwright without changing application dependencies. GitHub-hosted execution, reviewer configuration, object-storage URLs, provider availability and real accuracy remain unverified until the owner performs the corresponding steps. No hybrid-identification prototype or market-data work is included.

References reviewed October 28, 2026:

- [Manual dispatch/default-branch requirement](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision) and [Sonnet 4.6 rates](https://platform.claude.com/docs/en/models/sonnet-4-6/overview)
- [OpenAI vision](https://developers.openai.com/api/docs/guides/images-vision) and [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1)
- [Gemini image inputs](https://ai.google.dev/gemini-api/docs/image-understanding), [thinking/output limits](https://ai.google.dev/gemini-api/docs/thinking) and [pricing](https://ai.google.dev/gemini-api/docs/pricing)

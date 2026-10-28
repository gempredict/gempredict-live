# Three real vision responses: no external storage

The registered workflow is still `Private vision benchmark`. Dispatch the **restoration branch**, whose workflow now supports `dry-run` and **smoke only**. No update to main or new registration is needed. The initial smoke sends one identical front/back pair to Claude Sonnet 4.6, GPT-4.1 and Gemini 3.1 Pro, once each. It does not run the 18-evaluation comparison.

## Three owner actions

### 1. Install the private pair with one local helper command

On a trusted computer with this restoration checkout, locked npm dependencies installed (`npm ci --ignore-scripts`), and GitHub CLI authenticated as the repository owner, run:

```sh
node scripts/vision-benchmark/secrets-smoke.mjs install \
  --front '/PRIVATE/IMG_0893(1).jpeg' --back '/PRIVATE/IMG_0894(1).jpeg' \
  --revision EXACT_RESTORATION_COMMIT_SHA \
  --private-dir /PRIVATE/gempredict-smoke-key \
  --consent-provider-upload
```

Replace paths and SHA with actual values. This step makes **no model calls**. It prepares JPEGs at quality 90, maximum 1536 pixels without upscaling, rotates EXIF orientation and strips metadata. It rejects images too large for the approved limits rather than degrading them repeatedly. For an alternative pair, supply the improved front/back instead. There is no need to transfer all four photographs for a three-request smoke test.

The helper puts only photo chunks, a checksum/revision/24-hour-expiry record and a random result-encryption key into **GitHub environment secrets** under `vision-benchmark`. Existing provider keys and variables remain unchanged. Secret values go through stdin, never command arguments or logs. Preparation children never receive provider keys. Partial uploads fail hash validation; metadata is installed last. The original pair requires 40 chunks and the improved pair 44 in the measured task files, plus two small secrets; the helper handles this automatically. GitHub limits secrets to 48 KB, so each chunk is at most 32,000 bytes. Both fit within the 100-environment-secret limit if the environment has room; do not manually paste dozens of values.

The local `data-key.txt` is mode 600, outside Git. Keep it until decryption. Use a fresh private output directory for each installation. Do not attach it to an issue or commit it. The helper requires owner GitHub CLI access to write environment secrets; Codex's current GitHub connector does not supply that operation. If the computer does not already have the checkout/Node/GitHub CLI, that remains a prerequisite—not another cloud service to configure. Installing photos does not set `VISION_BENCH_LIVE_ENABLED` or authorize model calls.

### 2. Explicitly authorize and dispatch smoke

Only after owner approval for **three requests, at most the $0.75 admission ceiling**, set the existing `VISION_BENCH_LIVE_ENABLED` repository variable to `true`. Open the existing workflow, choose branch `restore/phase1-identity-market-matching`, mode `smoke`, confirmation `AUTHORIZE_SMOKE_0_75_USD`, and approve the environment if requested. Dispatch within 24 hours of photo installation, at the exact SHA supplied to the installer. The existing owner-ID, environment branch restriction, first-attempt-only check and manual trigger remain mandatory.

No paid dispatch is performed by the implementation task. Do not enable or dispatch full comparison: this simplified route intentionally offers only dry-run/smoke. A separate dispatch is a new authorization; never repeat a failed run without reconciling attempted calls and provider billing.

### 3. Download, decrypt and clean up

Download the run's `encrypted-vision-smoke` artifact (one-day retention) and extract `assessments.enc` outside Git. Decrypt locally:

```sh
node scripts/vision-benchmark/secrets-smoke.mjs open \
  --input /PRIVATE/assessments.enc \
  --key-file /PRIVATE/gempredict-smoke-key/data-key.txt \
  --revision EXACT_RESTORATION_COMMIT_SHA --output /PRIVATE/assessments.json
```

The result contains actual parsed provider assessments, model IDs, usage, latency, estimated token cost and request reservations. It does **not** claim accuracy, professional grading validity or a model winner. No independently reviewed condition labels are needed for this unscored connectivity/usefulness smoke; scored benchmark modes still require them.

Set `VISION_BENCH_LIVE_ENABLED` back to false, then remove temporary input/encryption secrets:

```sh
node scripts/vision-benchmark/secrets-smoke.mjs clear
```

`clear` removes only this helper's `VISION_BENCH_PHOTO_*` and `VISION_BENCH_DATA_KEY` **environment** secrets. It preserves provider credentials, owner variables and unrelated secrets. Delete the encrypted artifact after retrieval and remove local private files when no longer needed.

## Security and cost boundaries

- The public repository contains no photographs, keys, private manifests or provider responses. No external storage account, signed GET/PUT URLs, new API credentials, paid subscription or Production change is required.
- GitHub artifacts in a public repository are **not access-private**. Only AES-256-GCM ciphertext is uploaded; photos, plaintext assessments and encryption keys are never artifacts or summaries. Confidentiality depends on retaining the local key privately and restricting repository write/environment access. Repository writers able to change approved secret-bearing workflows remain trusted actors. Losing the local key makes the artifact unrecoverable.
- Workflow logs contain generic status only. Dependency/build/test steps run before private inputs and API keys are supplied. The receiver has photo/encryption secrets but no API keys; evaluation has API keys but no photo chunks/encryption key in its environment; the encryption step has only the key. Temporary decrypted files are mode 600 in mode-700 directories outside checkout. Always-run cleanup removes inputs, plaintext results and ciphertext runner files. GitHub-hosted ephemeral runners are required; termination can prevent cleanup.
- The existing benchmark CLI, shared blind prompt, provider adapters, image preparation and HTTPS transport are reused. Unscored mode is narrowly limited to one pair, one repeat, three maximum calls, with no reference identity inserted into prompts. Existing scored benchmarks still reject absent ground truth. The customer scanner is unchanged.
- Each request reserves capacity **before transport**, with a durable journal. The maximum is **three requests total, one per provider**, with no retries or automatic full run. First provider/format/usage/model safety failure stops the sequence. Errors retain their full reservation. All images and the combined prompt bound are admitted before the first request.
- Existing conservative reservations are $0.6475 for the three-call plan, below $0.75, at reviewed October 28, 2026 rates, 64k input / 2k total-output envelopes and 25% headroom. **This is not a provider hard billing cap** or account-wide counter. Rates expire after seven days; provider prices, availability and billing must still be checked. Do not change caps or reset rate-review dates merely to force calls.
- Models remain `claude-sonnet-4-6`, `gpt-4.1-2025-04-14`, `gemini-3.1-pro-preview`. Provider/account availability and actual output quality are untested until calls complete. Gemini thinking may consume the 2k output ceiling and leave invalid/truncated JSON; that stops the run rather than silently retrying with more spending.
- Inline photo uploads are subject to provider retention policies. OpenAI uses `store:false`; no zero-retention guarantee is implied.
- The old object-storage helpers remain unused for this workflow; their secrets/URLs are no longer prerequisites. Hybrid identification and market-data research are separate.

## Offline verification

```sh
node --test tests/vision-benchmark.test.mjs tests/vision-actions.test.mjs tests/vision-secrets-smoke.test.mjs
node scripts/vision-benchmark/actions.mjs dry-run
node --test tests/*.test.mjs
npm run build
```

Use actionlint for workflow syntax. Offline/mock tests are not real model results. The original and improved private pairs passed local secret-capacity and image/spend admission checks without provider calls. Hosted secret transfer, paid responses and encrypted hosted-result retrieval remain unverified.

References: [GitHub secret size/limits](https://docs.github.com/en/actions/reference/security/secrets), [secrets and GitHub CLI](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [artifact access](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), [workflow dispatch](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

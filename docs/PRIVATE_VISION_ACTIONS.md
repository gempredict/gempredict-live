# Browser-only three-provider smoke

No local checkout, Node installation, terminal, GitHub CLI, storage account or new service is required for the owner. The existing registered workflow and repository API secrets are reused. Execute only `restore/phase1-identity-market-matching`; main and the customer scanner are unchanged.

## Owner actions

1. Open the private `data-key.txt` file supplied in the Codex Cloud task (outside Git). Copy its single line into a **new environment secret** named `VISION_BENCH_DATA_KEY` under repository Settings → Environments → `vision-benchmark`. Keep a private downloaded copy for recovery; do not paste it into chat, issues, logs or Git. No photo chunks or manifest secrets are needed.
2. Only after explicit authorization for the three-call smoke and its $0.75 admission ceiling, set the existing repository variable `VISION_BENCH_LIVE_ENABLED` to `true`. In Actions → Private vision benchmark → Run workflow, choose branch `restore/phase1-identity-market-matching`, mode `smoke`, confirmation `AUTHORIZE_SMOKE_0_75_USD`. Approve the existing environment if requested. Do not run main, full comparison or a second dispatch. A dry-run requires no private key or API calls.
3. Share the resulting run URL with Codex. The connected GitHub tools can list/download its encrypted artifact; Codex can decrypt it using the retained private workspace key and report the actual assessments in this private chat. If artifact download through the connection is unavailable, download `encrypted-vision-smoke` in the browser and attach the ZIP here. No owner decryption command is needed. After retrieval, disable live mode, delete the temporary DATA_KEY environment secret and delete the encrypted artifact using the browser.

The transferred photos are the **original front/back pair** already supplied privately to this task. The improved pair is not needed for the initial three-call smoke. Neither condition labels nor claimed PSA ground truth are needed: this is an **unscored assessment test**, not an accuracy benchmark or model-selection verdict.

## What is stored where

- `benchmarks/private-smoke.enc` in the restoration branch contains **AES-256-GCM ciphertext only**. No raw JPEG, base64 photo plaintext, private manifest or key is committed. Public Git history retains ciphertext even after the file is removed; deleting a later working copy does not erase that history. Confidentiality depends on keeping the random 256-bit key private. This is an intentional use of the user's allowance to avoid committing *raw* photographs.
- The random key stays outside Git in the private Codex workspace, with mode 600, and is manually installed through GitHub's secret UI. The task never prints it. The helper preserves a copy for result decryption; retain a private browser download because cloud workspace persistence is not guaranteed across new tasks.
- The photo envelope is authenticated against the repository, purpose `smoke-photos`, the reviewed input-format anchor `f390b32987a79d2c9c075af62eba459d4c627c0b`, and a maximum 24-hour expiry. This input-format anchor is separate from the executing workflow SHA: the latter includes the ciphertext commit and is checked by the existing live approval gate. Both photo hashes, fixed filenames, dimensions and spend admission are still verified before any provider call. Expiry cannot be bypassed through the metrics-recovery option. Old `photos` envelopes retain their original 30-minute limit.
- The prepared pair is JPEG quality 90, maximum 1536 pixels without upscaling, EXIF-rotated with metadata removed. The normal benchmark preparation is then applied identically for all providers. Too-large or insufficient-resolution inputs are rejected rather than repeatedly compressed to force admission.
- The receiver step has the input key but no provider API keys. Evaluation has provider keys but not the encryption key in its environment. Raw assessments remain runner-private. The result step uploads only AES-GCM encrypted parsed assessments/model IDs/usage/latency/reservation metadata, never raw HTTP responses, photos, keys, manifests or filesystem paths. The ciphertext artifact has one-day retention. Artifacts on this public repository are not access-private; encryption supplies confidentiality.
- Dependency, build and offline-test steps receive no private inputs or provider keys. Logs contain generic status only; no model prose or private image data is printed. Cleanup runs with `always()` on ephemeral GitHub-hosted runners. Unexpected runner termination can prevent cleanup; do not use persistent self-hosted runners.
- Repository write access, environment approval and the private key remain trust boundaries. A malicious authorized writer can change a secret-bearing workflow. Keep access restricted and approve only the reviewed restoration SHA.

## Authorization and spend

There are at most **three provider attempts total, one per provider, no retries**. Manual trigger, approved owner ID, exact repository/branch, first run attempt, environment restrictions, enable flag and explicit confirmation remain required. The implementation task does not enable live mode, dispatch the workflow or make paid calls.

The existing benchmark CLI, blind prompt, provider adapters and pre-request reservations are reused. Models remain Claude Sonnet 4.6 (`claude-sonnet-4-6`), GPT-4.1 (`gpt-4.1-2025-04-14`) and Gemini 3.1 Pro (`gemini-3.1-pro-preview`). These are real provider targets; account availability and output quality remain unverified until live responses complete. A malformed response, missing usage, changed model ID or exceeded bound stops remaining calls. Gemini thinking may consume its 2k output ceiling and cause truncation; no silent retry or larger cap is permitted.

The conservative three-call reservation is $0.6475 against the $0.75 admission ceiling, using the existing reviewed October 28, 2026 rates, 64k input/2k total-output envelopes and 25% headroom. This is **not a provider hard billing cap** or an account-wide spending counter. Failed attempts retain reservations; a new dispatch needs a new authorization and reconciliation. Rates expire after seven days. Photo input expires after 24 hours; if expired, Codex must prepare a fresh encrypted bundle before another dispatch, without a paid call or owner installation. The same still-private key can be reused for that refresh.

Results remain **unscored** and do not establish professional grading accuracy or a model winner. Scored benchmark modes still require independently reviewed labels. Production, Vercel, Supabase, hybrid-identification prototypes and market-data research are outside this change.

## Verification (Codex only)

Run the existing benchmark/security suite, workflow syntax validation, credential-free dry-run, full automated tests, production build and relevant browser tests. Exercise the real private pair through envelope encryption, receiver decryption and existing image/spend admission with no credentials or transport. Test wrong key, corrupt ciphertext, expired/wrong-purpose envelopes and unchanged three-request limits. Test encrypted result recovery locally using synthetic assessments, clearly distinguished from live output.

The browser-only owner path needs no terminal commands. The legacy local CLI installer remains available but is no longer used by this workflow.

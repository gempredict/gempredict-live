# Phase 3L.8 — Controlled structured-output authorization checkpoint

Prepared 2026-11-13. Starting commit: `29ab8886ebdf920dfe63b96852ffc1f476a8e3c7`. **No paid request, marketplace request, feature activation, environment change, Production deployment or PR merge was performed.**

## Decision and actual readiness

**NO-GO for submission now.** The implementation is ready for owner review, but the experimental flag remains absent/off, no actual owner photo pair/session has been preflighted here, independent reference verification is pending, and the proposed spending envelope is not a hard billing cap. A later owner approval must explicitly cover temporary Preview activation, one paid attempt, uncertain actual input cost and the rollback procedure below. If a guaranteed $0.50 maximum or durable experiment-wide once-only billing enforcement is required, remain NO-GO until that external control is established. No successful synthetic response is a real-card benchmark PASS.

## Schema and provider compatibility

The Phase 3L.7 version-1 schema is unchanged. Provider requests still use `output_config: {format: {type: 'json_schema', schema: ...}}`, `claude-sonnet-4-6`, installed SDK **1.6.0**, and **4,800** maximum output tokens for the required paired images. No second model, automatic retry or prompt-JSON fallback was added. Client retries are also absent.

Static provider-format counts remain Pokémon: 12 nullable unions / 4 optional properties / 6,154 wire bytes; sports: 15 unions / 10 optional properties / 7,977 bytes. Schema descent is six property/item edges. Current documented explicit limits are 16 unions and 24 optional parameters; hidden grammar limits still require actual provider acceptance. The unchanged strict transport and local schema/evidence validators reject incomplete/invalid responses. The installed SDK serialization is exercised using offline fetch stubs. No real provider grammar compilation has been tested.

Identity, uncertainty, multi-athlete readings, subset/title, serial and foil proposals survive into the existing internal contract. Existing Pokémon reconciliation retains original and canonical identity separately. Sports audit remains an observation-completeness audit, not independent catalog verification. Mixed-side condition findings remain conservative. Report components/styles, financial logic and economics are unchanged. No grades, probabilities, valuations or recommendations are legal schema fields.

Official sources checked 2026-11-13:

- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Sonnet 4.6 model](https://platform.claude.com/docs/en/models/sonnet-4-6/overview)
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Vision input considerations](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Vercel environment changes](https://vercel.com/docs/environment-variables/managing-environment-variables)
- [Managing/deleting deployments](https://vercel.com/docs/deployments/managing-deployments)

## No-charge server preflight and fail-closed submission

The owner control now offers an explicitly selected **Structured JSON Schema — experimental Sports preflight** mechanism. This browser selection requests a mechanism; it cannot turn on the server flag. The existing prompt-JSON controlled path remains visibly identified and unchanged when no experimental mechanism is requested.

The new `condition-preflight` mode reuses the actual `/api/predict` upload parser, JPEG validation, SHA-256/dimension comparison, revision/category checks and owner authorization. It returns before provider, catalog, marketplace or email work. It uploads the prepared pair to the application for verification; it is not a purely local check. The original three downloaded files must still match locally before the UI permits server preflight. This route shares the existing five-per-hour IP limit, so avoid repeatedly checking it.

The summary shows immutable Preview origin and commit, category, model, schema, output budget, flag state, diagnostics and spending assumptions. When the flag is off it returns `ready:false` without a submission permit. When later enabled, it issues a two-minute encrypted capability bound to the owner session, immutable origin/commit, full manifest (including hashes/dimensions/attempt), Sports category, mechanism, model, schema and budget. A synchronous server-memory claim consumes the permit before provider I/O. Replays, absent/forged/expired permits, stale sessions, changed manifest/category, missing spend acknowledgment, nonempty model hints or a disabled flag reject with zero provider calls.

A worker restart/change loses the issuing worker's registration and rejects safely. This is not a durable global ledger: independently audited provider counts and actual cost remain null. The browser also consumes its frozen pair once. A new no-charge preflight may be needed after a proven pre-provider rejection; after an uncertain or paid submission, stop for review instead of recreating permits or scanning again. This limitation must be accepted before a real experiment.

A flag-enabled legacy controlled request without the expected mechanism/preflight also rejects; it never implicitly enters the experimental route. An ordinary request that explicitly asks for an experimental mechanism rejects without controlled authorization. Ordinary scans without an experiment request continue using prompt JSON. Production cannot authorize this route, even with a forced true flag.

Structured submissions require empty card name/set and omit email. Owner reference assertions and purchase/condition context are never added to the vision prompt. The model sees only its existing instructions, schema guidance and the photographed card.

## Proposed spending envelope

Proposed owner planning ceiling: **USD $0.50 for one attempt**.

At the verified standard Sonnet 4.6 rates, a deliberately conservative planning allowance of **100,000 input tokens × $3/million + 4,800 output tokens × $15/million = $0.372**, leaving $0.128 below the proposed envelope. The input allowance covers both photos, existing prompt and provider/schema overhead. It is an assumption, not a measured token count or enforced input limit. Official vision documentation describes image resizing/token budgets; 100,000 is intentionally much larger than ordinary paired-image/prompt expectations, but the owner's actual prepared files and injected schema overhead are not measured here.

The output limit is configured; the input assumption and total dollars are not provider-enforced caps. No token-counting API or inference request was made. No caching discount is assumed. Taxes, account arrangements, provider changes and unobserved charges are not included. Actual cost remains unknown until usage and billing evidence are reviewed. The UI and server require a separate explicit acknowledgment that $0.50 is not a guaranteed maximum. If the owner will not approve that uncertainty, do not activate or submit.

## Later real-provider evidence

The existing expiring diagnostic export now additionally records a bounded SDK-attempt counter (not independently audited billing calls), configured retries/fallback policy, unknown actual cost and measured SDK round-trip latency. Existing completion metadata records stop reason, block types, token usage and output budget. Mechanism/schema version, strict parser/schema result, normalized/audit status and provider failure category remain separately visible.

Only the documented “Schema is too complex for compilation” phrase in an HTTP 400 provider error is classified as a compilation rejection; other request errors remain generic/unverified. No raw error message or raw model response is retained. A response plus successful local normalization supports schema acceptance for that request; it does not prove identity, finish or condition accuracy.

Bounded sanitized sports subject names, subset/title, serial and foil proposals are available in `model.sportsDetails`. Condition exports retain side, code, reported/resulting certainty, coverage status/counts and limitation codes, without copying raw prose or coordinates. Existing marketplace counters, financial withholding, canonical/original identity separation and failed/successful export remain intact. Redacted/unobserved fields remain unknown. A network failure may leave actual paid-request status and export availability unknown: never infer zero cost or repeat the scan to recover evidence.

## Private benchmark preparation

A separate gitignored record is prepared at `benchmarks/identity/private/phase3l8-mets-preflight/` with a case preparation file and unapproved owner-review draft. Neither the Konnor reference case nor historical Mets evidence was changed. No raw photos, diagnostics, hashes or full responses were manufactured or committed.

The owner assertions identify the 2026 Topps Series 1 It Takes Two #52 Lindor/Soto Mets Celebration Confetti from a Celebration Mega Box. The owner reported no visible surface/corner/edge defects before this proposed analysis; centering was not independently measured. These assertions are reference context, not independent corroboration, proof of mint condition, exact defect localization, or blinded physical adjudication. Prior failed analysis history prevents us from assuming independent blinding. All actual photos, hashes, provider results, printing corroboration, audited costs/counts and formal approvals remain missing. Case status is **NOT TESTED**, not PASS. Existing importer eligibility is intentionally unmet.

## iPhone owner procedure — current disabled Preview

1. Open the exact protected immutable Preview linked in the handoff; sign in to Vercel and authorize Preview Scan Diagnostics using the existing owner control. Do not use a mutable branch alias.
2. Keep private originals and prior evidence separately. Leave card name and set fields empty. Choose **Sports Card** deliberately in the controlled category selector.
3. Choose **Structured JSON Schema — experimental Sports preflight** in the controlled mechanism selector. This changes no server flag. Selecting a different mechanism/category resets preparation.
4. Load/prepare the owner's front and back photos. Freeze the pair. Download both JPEGs and the manifest; use Files/Downloads to reselect all three. Each must show **Match verified locally**. Picker cancellation preserves the pair; replacement/expiry requires preparation again.
5. Confirm Sports for this pair. Tap **Check structured preflight — no paid request**. This sends the exact frozen pair only to the app for byte verification.
6. Inspect deployment/commit, model/schema, 4,800-token limit, cost warning and diagnostics. **Expect “disabled — stop for activation approval.” Do not tap the paid Full Analysis action. Stop here and return the readiness summary for approval.** No paid experiment is authorized by this document.

### Only after separate explicit approval

Use the new experimental immutable URL produced by the activation procedure; authorize and freeze/verify again on that origin. Confirm the server summary says flag enabled and ready. Review the non-guaranteed cost acknowledgment. Within the two-minute permit lifetime, explicitly authorize and initiate **one** controlled Full Analysis. Do not change/reload/repeat during submission. If readiness expired before submission, another no-charge preflight is allowed; if submission status is uncertain, stop instead.

After success **or failure**, use the existing Download Scan Diagnostics action and its download confirmation immediately (up to five minutes, bounded by owner-session expiry). Keep the original prepared JPEGs/manifest and diagnostic privately. Record response status, exact immutable deployment/commit, wall-clock observations and any independent billing evidence. Stop for assessment; do not run another paid scan to replace missing evidence. Owner/session expiry can make exports unrecoverable.

## Activation and rollback — instructions only, not executed

Vercel environment changes apply to new deployments, **not an existing immutable deployment**. The current disabled URL cannot be enabled in place.

1. Obtain explicit owner approval for the exact reviewed commit, one attempt, non-guaranteed spending assumptions and deletion/blocking of the dedicated experimental Preview during rollback. Ensure no concurrent branch pushes/deployments.
2. In project `gempredict-live` / team `gempredicts-projects`, add `GEMPREDICT_PREVIEW_FULL_STRUCTURED_OUTPUT_ENABLED=true` scoped **only to Preview and branch `reconcile/iphone-upload-2026-11-03`**. Never select Production or a global scope; leave diagnostic/security secrets unchanged.
3. Redeploy the exact reviewed Git commit as **Preview**, not Production. Verify READY, exact Git SHA, `target:null`/Preview, project ID `prj_hu0Q2BybH0PskmTxFaEkz1NVtus4` and existing Vercel Authentication protection. Record its new immutable URL/deployment ID. Do not assume the old URL changed.
4. Immediately remove that temporary branch-scoped enable variable so future deployments default off. The newly created experimental Preview retains its snapshotted true value. Confirm metadata no longer has the enable variable; make no further enabled deployments.
5. On the experimental URL, perform the iPhone **no-charge** preflight. Its flag/commit/origin checks establish the actual route state without an AI request. If anything mismatches, roll back without a paid test.
6. After the one approved attempt and immediate evidence capture, remove/block **that exact experimental Preview deployment**. Environment removal or moving an alias alone does not disable its immutable URL. Do not delete the project or any Production deployment.
7. Verify that exact deployment is no longer served/accessible using authenticated platform inspection and a harmless GET, then verify the disabled Preview reports flag off through no-charge preflight. Record rollback evidence. If deletion/blocking cannot be performed or verified, do not activate.

Emergency rollback prevents new requests at the experimental URL; it cannot guarantee cancellation/refund of an already in-flight provider request. Deleting the Preview before export may sacrifice the ephemeral diagnostic. Stop new submissions immediately; never claim rollback retrospectively erased spending.

## Offline validation

Synthetic tests cover schema-compilation rejection, refusal, output cap, valid JSON/local rejection and success; exact one SDK attempt/no retries or fallback; audit only after valid normalization; failed and successful diagnostic downloads; financial withholding; disabled/Production/stale/mismatched/expired permits; one-use replay rejection; unregistered worker rejection; and the actual owner control's blocked checkpoint. Existing report/design, identity, financial and private-evidence safeguards remain required full-suite checks. Test/build results and exact committed-file inventory are in the handoff artifacts.

Final local results: **590 passed, 0 failed, 0 skipped** in the complete offline suite; production build passed; all five packaging checks passed. Vercel environment metadata confirms the enable flag is absent. Only the reconciliation branch is to receive this commit; its disabled protected Preview URL and READY status are supplied in the handoff. The private benchmark preparation is excluded from the Git tree.

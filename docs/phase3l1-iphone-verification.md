# Phase 3L.1 — controlled saved-file selection repair

Starting revision: `3a5e5cdd19dd3cf533d8ab8468981b5105a076c2`; reconciliation branch only. No real paid scan or marketplace request was performed. Both Phase 3L physical-card cases remain NOT RUN.

## Reproduction and evidence

Three software defects are reproducible offline:

1. An empty `change` event (no selected File, as can occur on picker cancellation) entered the generic verification action. `verifySaved` treated the absent file as a mismatch and invalidated the frozen pair. The new cancellation path does not mutate the pair or existing matches, whether the browser emits `cancel`, empty `change`, or no change event.
2. `descriptor` required `file.type === 'image/jpeg'` for the saved copy as well as the prepared upload. A byte-identical JPEG with empty, generic or `image/jpg` browser MIME metadata was rejected before hashing. The saved-copy path now validates JPEG signature, reads/decodes dimensions and computes SHA-256 from the actual bytes; only then does it use canonical JPEG MIME for comparison. Size, hash, dimensions, side, manifest, original frozen File references and selection epoch must still match. Wrong bytes and non-JPEG files remain blocked. Frozen source upload MIME requirements are unchanged.
3. The authorization-expiry timer set access to null. The component's capability guard then returned null, hiding any explanation. Expiry now retains the known Preview capability but revokes local authorization, invalidates preparation, disables submission and visibly explains reauthorization and re-preparation. Returning from Files checks expiry because iOS can suspend timers. Focus or visibility changes alone never invalidate a current pair. Authorization is still enforced independently by the unchanged server.

These reproduce plausible paths for the owner's symptom, but no retained native-iPhone event trace establishes which occurred in that particular session. Do not claim a confirmed Safari-specific cause or native-device accuracy from emulation.

## Lifecycle audit

The original reset effect depends on front File, back File and the parent preparation-busy flag. Internal verification state, ordinary React rerenders and a new callback function identity do not trigger it. Genuine image replacement, changed selection epoch or busy preparation must invalidate the pair. There was no original focus/visibility invalidation listener.

The controller remains in memory. A real component unmount, page reload, navigation or browser process eviction destroys the prepared attempt; restoring it from localStorage would be unsafe and is not added. The UI states that reloading requires a new freeze/export/verification. Cleanup invalidates the old controller, and generation/mount guards prevent late file reads or stale authorization responses from publishing success after a reset, expiry or unmount.

The synchronous action lock prevents overlapping operations before React rerenders. Expiry is checked at operation start and after awaited reads. Async mismatch/read/decode errors reset the pair and remain in a visible alert above the controls, with the failing file and recovery instructions. Ordinary rerenders do not clear them. Explicit successful recovery clears the alert. Refresh errors revoke local access without hiding a previously available owner panel.

Each file now shows Not prepared / Download required / Download initiated / Checking saved bytes / Match verified locally / reset or expired status. A Next step line identifies the next missing file, or the explicit spending acknowledgment after all three files match. No scan is triggered by downloads, verification, focus, cancellation or refresh. The existing explicit unknown-cost acknowledgment and one-use consumption remain mandatory.

## Verification

- 546 full offline tests passed; 0 failed, cancelled or skipped.
- Production build passed; all four catalog packaging checks plus the owner-demo packaging check passed.
- Eight added regression tests cover actual JPEG byte checks with iPhone-style MIME metadata, cancellation, ordinary rerenders, focus/visibility, mismatch and asynchronous errors, expiry (timer and return from picker), delayed completion, photo replacement, remount/unmount, all-three-file completion and one-use spending controls.
- Local Playwright/Chromium with iPhone 13 viewport/user agent exercised the actual built application and actual downloaded synthetic front/back/manifest files. It verified all three files with empty MIME, preserved matches on cancellation/focus/visibility, blocked submission without spending acknowledgment, and showed persistent mismatch/expiry recovery states. All provider routes were intercepted; no paid or marketplace requests occurred. This is not real iOS Safari.

Screenshots and browser results are provided separately as review artifacts. No raw private owner images or session credentials were retained or committed.

## Owner check after review — no scan needed

On the new immutable protected Preview, authorize Scan Diagnostics, upload the front/back photos, refresh owner authorization and freeze a new pair. Download all three files. Select each exact exported file from Files/Downloads rather than Photos, screenshots or resized copies. Confirm three Match verified locally statuses. Cancel one picker and confirm the existing matches remain. Leave the paid-scan checkbox unchecked and stop for review. If Safari reloads the page, freeze and export a new pair; old matches are not restored. If authorization expires, use the visible recovery instructions.

The approved Phase 3K report components, identity/condition engines, prompts, financial gates, marketplace qualification, backend owner-auth policy and Production configuration are unchanged. PR #2 remains unmerged.

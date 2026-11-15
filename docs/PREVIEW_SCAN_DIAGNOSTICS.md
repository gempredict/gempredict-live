# Preview-only scan diagnostics

Base: 6dbbbd7dbf9312ba6655c82244d42b68fc11fb33. Observability only;
no identity, condition, variant, matching, confidence or financial decision changes.

## Authorization and owner operation (not activated by this change)

The feature defaults OFF. No Vercel settings or credentials were changed.
For a separately reviewed Preview deployment, configure these server-only variables
scoped to Preview and `reconcile/iphone-upload-2026-11-03`:

- `GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED=true`
- `GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY`: a random 32-byte key encoded as 64 hex
  characters, entered only by the authorized owner. Never use a provider key.
- `GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY`: a separate random 32-byte/64-hex key,
  kept server-side. It must differ from the owner key. Never enter it in the browser.

No `NEXT_PUBLIC_*` flag or client-supplied identity grants access. Both keys and
all required Vercel server variables must exist or the endpoint returns 404.
Required deployment identity: VERCEL=1, VERCEL_ENV=preview, correct project ID,
Git repository owner/slug, reconciliation branch, 40-hex commit SHA and immutable
VERCEL_URL. Requests must use that immutable origin; moving branch aliases and
cross-origin POSTs are rejected. Existing Vercel Deployment Protection stays intact.
This diagnostic owner session is an additional authorization layer, not a replacement
for signing into the protected Preview.

After review, open the exact immutable Preview while signed into Vercel. Before
scanning, select **Authorize Preview Scan Diagnostics** and enter the owner key.
The server verifies it and sets an encrypted, Secure, HttpOnly, SameSite=Strict
cookie for 15 minutes. The key is not stored in browser storage or returned.
Perform one manually initiated scan. **Download Scan Diagnostics** appears only
for an authorized session and a current in-memory scan ticket. Download within
five minutes. Reauthorization or session replacement invalidates older tickets.
A scan performed before authorization cannot be reconstructed retroactively.
No scans, exports or new provider calls are automatically initiated.

## Transport and retention

The observer holds only a request-local allowlisted summary. The response body
and report schema are unchanged. An encrypted/compressed ticket and random
server-generated scan ID are returned in private response headers only to an
already authenticated diagnostic session. A WeakMap holds the capability by the
current report object; it is not attached to the report, saved, copied, shared,
logged or placed in local/session storage, cookies or URLs.

The explicit download POST validates session, scan ID, deployment, commit, token
integrity and five-minute expiry before returning a no-store JSON attachment.
Tickets are stateless and bound to one scan and one session, not globally single-use:
the same authorized session can download the same scan again until expiry. No
server persistence, background collection, database or raw-response cache exists.
Owner-key rotation/signing-key rotation or disabling the flag revokes access.

Limits: maximum 24 KiB uncompressed JSON, 6,000-character encrypted ticket,
32 observation rows, 24 uncertainty readings, eight controlled note summaries,
80-character identity values, six marketplace HTTP statuses and 100 rejected
listing summaries. Oversize export creation fails closed without changing the scan.
Rows beyond the observation cap are explicitly marked truncated. The API body
limit is 10 KiB. Compression/decompression and decoding have explicit bounds.

## Evidence journey and privacy contract

- Context: commit, Preview environment, category, random scan ID and HTTP status.
- Images: validated front/back presence, dimensions, decoded format and processing
  status. Failed parsing/validation leaves presence/validation not established;
  it does not infer which bytes failed. No image content, filename or path.
- Model: expected field presence/type/redaction, safe original identity facts,
  returned identity confidence (if supplied), reading certainty/side codes,
  structured/missing/invalid observation status, per-side/attribute counts,
  limitations and controlled qualitative vocabulary. No identityNotes or raw prose.
- Validation: bounded row indices, allowlisted attribute/code/side, localization
  validity, retained/rejected outcomes, downgrade flags and fixed reason codes.
  The observer calls existing pure validators and never changes their results.
- Normalization: retained/discarded/redacted expected fields, states and safe note
  summaries. Export redaction is distinguished from missing or invalid model data.
- Final presentation: post-protection states plus display labels shared with the
  actual component. This is the expected render contract, not a claim to have
  inspected a live browser DOM; compare it with the visible report/screenshot.
- Identity: canonical facts, catalog reference/status, original/canonical
  differences, unresolved/conflicting fields, variant evidence counts and
  artwork/physical-printing/runtime-asset statuses, without source URLs.
- Marketplace: attempted/routing status, bounded HTTP statuses, protection outcome,
  accepted/rejected counts and mapped rejection codes. Unknown rejection prose is
  represented only as `other_identity_rejection`. HTTP success does not prove
  completed-sale evidence, settlement, provenance or financial eligibility.
- Financial: existing withholding reason codes and checks that amounts and advice
  remain blocked. No prices, seller information or financial confidence values.

All fields are built on the server from actual handler stages. Download requests
cannot submit or replace diagnostic content. The owner authentication key cannot
mint export tickets: encryption uses the distinct server-only signing key.
No image bytes/base64, email, IP, credential, cookie, authorization header,
internal URL, raw upstream payload or unrestricted model prose is exported.
Qualitative notes become controlled vocabulary mentions, explicitly unverified;
this intentionally cannot preserve arbitrary original wording.

## Verification and limitations

Offline tests cover owner authorization, Production/unauthorized/browser flag
rejection, expiry/tampering/cross-scan/session/deployment isolation, privacy
sentinels, bounds, upload failures, missing versus rejected observations,
front/back association, catalog verified with finances withheld, marketplace
protection failure, saved/copied report exclusion and unchanged ordinary results.
The existing condition/identity/scanner tests and production packaging checks remain.

The feature has not been activated or tested against a live deployment. A future
owner-authorized real-photo scan must verify session cookies in iPhone Safari,
platform header delivery, runtime metadata, actual returned observation coverage
and agreement between exported final states and the visible report. No live or
paid provider calls, manual deployment, merge or Production change occurred here.

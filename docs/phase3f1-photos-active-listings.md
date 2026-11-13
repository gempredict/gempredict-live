# Phase 3F.1 — submitted photos and active listings

Starting commit: a5f2c743045efccba4dba42c70644114a01411e2.

Photo association uses a WeakMap outside report data, retaining the exact normalized
JPEG File objects appended to the submitted FormData. Separate object URLs are
created by the report viewer and revoked on unmount/change. Replacing an upload
preview does not change an earlier report's submitted files. This is browser-to-
handler image linkage, not a claim that server-reencoded vision buffers are identical.
The viewer switches front/back, uses contain fitting and the existing normalized
orientation, and handles absent/error images. No catalog artwork or remote photo URL
is accepted. No image bytes/blob URLs enter saved/copy/share report data. Reloaded
reports explicitly explain that session-only photos are unavailable.

The report order is Your Card, Condition, Available on eBay, Market Value, PSA
Grading. eBay listing candidates use the existing sports/Pokémon identity and variant
matchers, existing listing-ID/URL correspondence validation and deduplication.
Wrong/rejected variants, unsafe IDs/URLs and conflicting duplicate observations are
excluded. Public eBay image hosts are allowlisted with no-referrer loading. Missing
prices/currencies/condition/images remain unavailable; no values or links are invented.
Local screening never establishes completed sales or financial eligibility.

Current reports do not retain independent physical-printing verification, so the
exact-printing listing category remains empty. Even forged client verification flags
cannot create an exact-match row here. Only locally screened, explicitly unverified
possible matches are shown, with asking price and original currency, real source
link/title/condition when retained. At most six are displayed. This is neither an
exhaustive search nor a valuation. Current raw-only matcher restrictions are retained;
unsupported graded candidates are not quietly reclassified. Existing provider calls,
identity thresholds, HEIC handling and financialSafety are unchanged.

Validation checkpoint: full offline suite 494 passed, zero failed/skipped; build and
four packaging checks passed. Focused tests cover photo association/switching/cleanup,
front-only/restored fallbacks, sports identifier/parallel/year/serial conflicts,
URL correspondence, deduplication, missing costs and unsafe image hosts. Existing
Pokémon, condition, save/copy and financial rejection tests remain. Synthetic desktop
and mobile browser checks use intercepted scan responses; source photo bytes are
matched to submitted multipart digests, not inferred from filenames. No paid call,
live marketplace query, catalog request or new storage service is introduced.

# Pikachu report consistency checkpoint

Base: 88ff567b1a5c527026f44b47f8d619feff833857. Offline implementation only.

## Evidence and root cause

The owner observed a successful iPhone scan, an upper catalog-supported Pikachu
identity, and a contradictory lower Scarlet & Violet / Prismatic Evolutions
proposal. No retained sanitized response or screenshot was supplied. Consequently
this checkpoint cannot certify the live response's exact catalog reference,
variant status, evidence counts, conflicts or runtime asset flags. Regression
fixtures are explicitly synthetic; they are not reconstructed live responses.

Verified source defects:

- `src/App.jsx` passed only `r.imageAnalysis` to the photo panel. That panel used
  `identified*` model observations as its prominent identity and had no canonical
  report context. The upper panel used the canonical report instead.
- The upper metadata called even verified catalog facts a candidate. The generic
  withheld badge obscured the distinction between identity and financial trust.
- The fee row substituted `$80` when absent. Listing confidence could show an
  actual backend zero as if it were meaningful financial confidence. Discovery
  asking summaries were visible alongside financial placeholders.
- Photo confidence defaulted to “Moderate” and null grading eligibility displayed
  “Borderline Submission Risk.” Neither fallback was an actual assessment.

There is no evidence that the live catalog failed because finances were withheld.
`financialEligibility()` always withholds financial recommendations on this branch,
including when catalog identity is verified. It requires a qualified completed-sale
bridge which is unavailable. Its logic and the prediction handler are unchanged.

## Verification dimensions

| Dimension | Live evidence available here | Current authoritative contract |
| --- | --- | --- |
| Catalog identity | Owner reports catalog-supported upper identity; exact response unavailable | Recomputed catalog gate with provenance, identity conflict and user-input protections |
| Variant | Not retained here; cannot infer success from catalog or title | Existing independent consensus status; verified, corrected, insufficient or needs confirmation remain distinct |
| Artwork | No independent live verification supplied | Pipeline explicitly returns not verified |
| Physical printing | No independent live verification supplied | Pipeline explicitly returns unverified |
| Financial evidence | Recommendations were withheld | Always unavailable; catalog identity cannot override this |

## Repair and validation scope

Both panels now take the same protected report and choose its canonical title.
The original model identity is unchanged in a secondary disclosure explicitly
labeled “Original AI Observation — Unverified.” Shared presentation rows describe
each verification dimension using allowlisted explanations, without provider
explanations, URLs, credentials or raw diagnostics. Missing results remain unresolved.
The copied summary uses the same status presentation; saved reports are still
revalidated by the existing financial/identity protection boundary.

Unsupported fee, aggregate asking-price, financial-confidence and monetary outputs
remain unavailable, including in saved report summaries. Individual candidate
listing asking prices remain discovery evidence, explicitly distinct from sales.
Photo condition findings and limitations retain the existing conservative evidence
presentation. Missing assessments get no default grade or confidence estimate.

Tests execute the real multipart prediction handler with mocked external services,
and React server-render the actual report components. They cover conflicting
model/canonical identities, catalog verified with finances withheld, insufficient
variant evidence, saved/restored/copied reports, tampered identities, safe reasons,
and condition/photo-quality preservation. Existing sports, HEIC, provenance,
consensus, variant and snapshot/license rejection tests remain applicable.

No provider calls, deployments, production changes or evidence-threshold changes.
The real scan's precise statuses still require its sanitized response or a future
owner-authorized scan; this implementation does not request or initiate one.

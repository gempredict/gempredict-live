# Phase 3G.1 — protected development demo

## Owner use

Open the **immutable Preview deployment URL** returned for this commit, sign in through
Vercel protection, and find **Authorize owner demo access** beneath the existing Preview
diagnostics controls. Enter the existing Preview owner diagnostic key in that browser
prompt (never in chat). This reuses the existing secure 15-minute owner session. Select
**View Demo Report**, then Pokémon or Sports. No photo upload or scan is required.

`/demo-report` and `/api/demo-report` independently enforce the existing diagnostic
Preview/repository/branch/project/immutable-host gates, server keys and encrypted owner
session. Direct unauthorized page requests return 404; unauthorized example API
requests return 403. Production, local development, wrong deployments and missing
configuration return 404. The Next data route is gated as well. Responses are private,
no-store and noindex. Existing diagnostic flags and keys are reused; no new credentials
or environment settings are introduced. Moving branch aliases deliberately do not
satisfy the existing immutable-host authorization rule.

## Data and report behavior

`data/demo/reports.json` contains two explicitly synthetic snapshots generated offline
from existing `fraxureFixture.mjs`, `reconciliationPipeline.mjs` and
`conditionReportFixture.mjs` helpers. It is not retained live provider data. Fixture
timestamps are fixed; review capability tokens are removed. The report preserves the
Fraxure model's original Cosmic Eclipse observation separately from the mocked Unified
Minds catalog result. The sports example retains Konnor Griffin BCP-86 Mojo Refractor
without claiming an independent sports catalog exists.

The page renders the actual `ResultCard`, condition, photo, listing, completed-sales
and embedded PSA scenario components. **DEMO — SYNTHETIC DATA** appears above the report
and in every major section. Catalog/condition results are mocked examples, not measured
accuracy or observations of the owner's physical card.

There are no authorized Fraxure/Konnor front/back photographs in these fixtures. The
normal missing-photo viewer is retained. Historical private photos and previously
generated placeholder JPEGs are not borrowed or manufactured into card photographs.

The synthetic listing uses existing fixture values and is labeled synthetic in its
title and amount. Demo mode disables source navigation and remote listing images;
there is no real transaction/listing claim. Sports passes unchanged local candidate
screening. The Pokémon example is rejected by the existing product/set evidence rule;
that rejection remains visible as zero candidates and an excluded record. No matcher
or exact-printing rule was relaxed to make the demo appear complete.

The actual completed-sales qualifier receives an empty array, no approved policies or
crosswalks. All Raw / PSA 8 / PSA 9 / PSA 10 groups show insufficient qualified data.
There are no fake commercial permissions, synthesized completed sales or valuation
medians. `financialSafety.mjs` remains authoritative and unchanged. Submission fees,
automatic profits, grading probabilities and recommendations remain withheld. Optional
manual scenario arithmetic stays isolated in its existing disclosure.

Demo pages never mount the scan App or call prediction, catalog, marketplace or
identity-review endpoints. Save/copy/share, feedback and identity-correction actions
are unavailable; no real scan-history or saved-report callbacks are supplied. The
synthetic fixture is bundled on the server only, not shipped in public client assets.
Owner-authorized SSR/API responses contain the selected synthetic report only. Session
expiry returns the page to server authorization. The live sales provider remains disabled.

## Validation

Seven new focused tests cover owner session authorization, Production and deployment
rejection, expired/cross-revision sessions, private response headers, both actual report
categories, synthetic labels, financial withholding, disabled save/source navigation,
isolated fixtures and owner-action visibility. The full offline suite passes **512
 tests, zero failures/skips**. Production build and all four TCGdex packaging checks
pass. An added packaging check verifies the demo routes are built, server fixtures are
present and the fixture marker is absent from public client assets.

Local built-app browser tests use an HTTPS test proxy with synthetic credentials and
Preview/Production environment configurations. They exercise the real owner prompt,
HttpOnly cookie, server-rendered selection links, unauthorized 404/403 and Production
page/API/Next-data 404. Desktop/mobile screenshots cover both examples. Provider routes
are blocked and no paid/provider request is issued. Existing Google font asset attempts
on the scanner landing page are intercepted rather than sent externally. Saved-report
storage stays unchanged. These tests do not claim a real paid scan or live-market test.

## Remaining limits

Live authenticated Preview inspection still depends on workspace network access and
owner sign-in. Vercel deployment readiness/commit/protection can be checked separately
through deployment metadata. The demo does not establish real identification accuracy,
physical printing, defect detection accuracy, marketplace coverage or commercial rights.
No Production setting, paid provider, subscription, scanner logic or PR merge is changed.

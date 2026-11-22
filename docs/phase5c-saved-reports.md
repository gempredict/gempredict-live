# My Card Library Preview

Completed photographic Full Analysis responses are assembled in the prediction API and rendered by the unified report component. The previous save control keeps manually saved reports in browser local storage. The legacy Supabase integration writes waitlist rows and lightweight prediction logs when configured. Neither table contains complete reports. Preview Scan Diagnostics uses an encrypted, expiring owner cookie tied to the deployment and is independent of library authentication.

The library uses Supabase Auth user accounts and a dedicated Preview project. The browser session stays in memory. Authorization is verified with Supabase Auth on every saved-report operation. Reads and deletions apply explicit owner predicates and database row-level security. Saving is initiated only by the completed server-side analysis path. A restricted insertion function runs under a non-login, non-bypass role with an ownership check and ignores duplicate writes for the same owner and scan. An enabled library session does not grant permission to run an owner-protected model request.

Version 1 stores the approved report, normalized photographic findings and uncertainty, verification and financial state, and the filtered listing view as of the scan. Archive rendering uses the stored evidence. It does not re-run analysis, recheck a marketplace, or adjudicate the archived evidence. The report row stores the configured model, the provider's model version when available, and the application commit when available. Unknown schema versions are reported explicitly. The store excludes uploaded images, review and diagnostic tokens, raw provider responses, and account contact details. A storage failure leaves the completed scan on screen.

## Activation

1. Create a dedicated Supabase project for this Preview library. Keep it separate from any Production or legacy app project. Apply [the migration](../supabase/migrations/20261122_saved_reports.sql) as the project migration administrator. The migration creates a restricted role and requires role-management privileges. Confirm owner and cross-account behavior in the project before enabling the library.
2. Provision approved accounts in Supabase Authentication with email and password and keep public signup disabled if the Preview is invitation-only. Keep Vercel access protection and Gemini owner authorization configured independently.
3. Bind GEMPREDICT_LIBRARY_PREVIEW_SUPABASE_URL, GEMPREDICT_LIBRARY_PREVIEW_PUBLISHABLE_KEY and GEMPREDICT_LIBRARY_PREVIEW_SERVICE_ROLE_KEY to the feature branch’s Vercel Preview. The publishable key is intentionally browser-visible. Keep the service credential Sensitive and server-only. Then set GEMPREDICT_LIBRARY_ENABLED=true for that Preview.
4. Verify sign-in, list and cross-account isolation with synthetic records before scheduling any generation. Phase 5C's library is disabled in Production. A separate project and activation review are required before any Production library rollout.

An earlier report can still exist in the same browser if the owner manually saved it. Prediction logs and redacted scan exports cannot reconstruct a full report. The migration does not import local saves or fabricate historic rows.

## Password recovery

A Supabase recovery link that returns to the library page opens the new-password form. The callback is removed from the browser URL before the Auth exchange. Supabase must validate the session before the password can be updated. The recovery session stays out of library requests and is signed out after a successful update. The owner then signs in normally. Expired or used links require a fresh link. PKCE callbacks require the original verifier in the browser that initiated the flow.

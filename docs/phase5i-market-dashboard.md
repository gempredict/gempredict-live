# Phase 5I collector dashboard

On the immutable, protected Phase 5I Preview, open a completed report inside My Card Library or complete a Full Analysis while signed in to the Preview library. Expand a marketplace section, review the identity and cohort, authorize the Preview owner, and request that source. The recent-sales request covers three UTC calendar dates. Closing or reopening a report does not start a marketplace request.

Scope the existing Phase 5H marketplace, Preview owner diagnostics, and isolated Supabase library bindings to `feature/collector-dashboard-phase5i`. No migration is required. The live report gets an ID only after a successful saved-report write and an owner-scoped reread. If the ID is unavailable, reopen the report from My Card Library.

Results are held in the dashboard only and cleared on report close, owner change, navigation, authorization expiry, or a short display timeout. Counts reflect returned records for the selected cohort. eBay asks and provider-reported sale amounts remain separate. The Preview has no independently qualified economics bridge, so the dashboard withholds that section.

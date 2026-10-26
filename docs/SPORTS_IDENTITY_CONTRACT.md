# Minimum sports identity contract (design only)

This checkpoint does not implement sports catalog verification. TCGdex verifies
Pokémon; it is not a source for sports manufacturers, products or parallels.
Sports cards must continue reporting independent verification unavailable and
withholding trusted valuations until an appropriate provider is implemented.

A future sports verifier must independently establish these distinct fields:

| Field | Minimum requirement |
| --- | --- |
| Category / sport | Explicit sport and category, not inferred from a Pokémon lookup |
| Manufacturer | Licensed manufacturer/publisher; separate from product name |
| Release year / season | Printed/release year or season, including ranges; distinguish copyright year |
| Product | Product/brand line, e.g. Topps Chrome or Donruss Optic |
| Set / subset | Base checklist, insert/subset and release/edition where material |
| Player / subject | Canonical person/team; aliases and duplicate names must remain resolvable |
| Card number | Full checklist identifier, including prefixes/suffixes; not just a numeric substring |
| Parallel / treatment | Exact color, pattern, finish, variation and artwork/photo variation; base is explicit |
| Serial numbering | Checklist print-run/denominator separate from the individual copy's serial numerator and collector number |
| Autograph | Explicit yes/no/unknown, with relevant autograph variant designation |
| Memorabilia | Explicit yes/no/unknown, relic/patch designation and material variation when relevant |
| Language / market / edition | Required when these materially distinguish the release |
| Source provenance | Stable record ID, source/revision, release coverage, independently supported field evidence |

Unknown values are not equivalent to a confirmed negative. Conflicting identities
must request confirmation and remain untrusted; user confirmation does not replace
independent catalog evidence. A listing for collector #175 and serial 12/99 cannot
be confused with card #12 or a different /49 parallel. Graded versus raw and
condition eligibility remain comparable-selection concerns, not catalog identity.

Reusable components: canonical-first sequencing, evidence status/conflict gates,
user-protected fields, strict structured listing checks, variant dimensions,
collector/serial parsing primitives, bounded retrieval, selected-pool confidence,
financial consistency checks, saved-report protection, safe diagnostics and
structured visual observations. These primitives require sports-specific fixtures
and provider field mapping before any claim of readiness.

Not reusable as sports proof: Pokémon set IDs/printed abbreviations, official
Pokémon set-count fractions, Pokémon rarity/finish aliases, TCGdex language/set
records, the Pokémon-only adapter and pinned Pokémon freshness snapshot. Current
catalog candidate matching is not a complete sports contract: manufacturer,
product, insert/subset, copy numbering and licensed parallel/autograph/memorabilia
facts need a future independently validated schema/mapping. Do not squeeze these
into a free-form set string and declare them verified.

Additional sources required: authoritative manufacturer checklists/release data
and a licensed independent sports checklist/catalog with exact parallel,
numbering, autograph and memorabilia coverage. Possible sources must be assessed
for API availability, licensing/commercial rights, revisions, coverage and
independence before integration. No manufacturer, Beckett, TCDB or other connection
is claimed or invented here. Seller titles, eBay consensus and AI memory are not
substitutes for these sources. No sports API request, provider implementation,
grading-engine or submission-optimizer work is included in this checkpoint.

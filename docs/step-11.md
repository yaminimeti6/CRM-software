# Step 11: creative/ad attribution and landing-page cohorts

Report: `/app/attribution`, linked from the existing application. Active Admin/Manager get organization-wide exact aggregates; Creative Analysts get protected aggregate-only results. Telecallers are denied. Only Admins manage references/rules/audit. Step 6B live website attribution and production deployment remain pending; Step 12 is not started. No Meta/OAuth/spend/cost/revenue/ROAS/page-view/watch/time metrics or external website/Sheet change.

## Identity and provenance

`ad_references` has stable organization-scoped UUIDs separate from editable names. Names are not unique and never merge identities. A record is explicitly either a creative or ad; optional external reference ID and campaign ID are separate fields. An ad can have one explicit creative relationship; several ads may point to the same creative. Identity/type/external IDs/parent links are immutable after creation; rename/archive instead of rewriting history. No click-ID field, lookup fallback or URL-fetch operation is offered.

Three provenance levels are intentionally different:

1. Existing configured source/catalog association: server-bound source, form version and immutable brand/product/landing-page snapshot.
2. Reported/unverified advertising metadata: original submitted values, not independently verified by matching a known ID or permitted origin.
3. Explicitly reviewed mapping: Admin acknowledged an exact reported creative/ad ID for a particular source + form-version and chose a reference. Server records actor/time and revisions. This is still **not independently verified ad origin** (`independently_verified` is always false).

Creative keys are `AdCrevId` / `creative_id`; ad key is `ad_id`. Campaign keys (`campId`, `campaign_id`), source creative display names, UTM campaign and `FbClickId` may indicate reported/unverified metadata but are never creative/ad matching keys. Conflicting creative aliases, invalid ID types/syntax and conflicting reviewed creative-versus-ad-parent relationships do not silently choose a mapping. A known internal reference UUID supplied publicly does not map itself.

New import tracking stays byte/value-preserved in existing positional `cN` storage. The import's explicit tracking-column **key** supplies its semantic meaning; only the recognized creative/ad keys participate in mapping. Other tracking, unknown questions and original values remain untouched. New public `ad_id`/`creative_id` fields continue through the existing dynamic-answer/original-submission path; no fixed quiz schema is added.

## Prospective mapping policy

Rules bind organization + source + explicit form-version + reported ID type/value. An active key is unique. Changing target, disabling or reviewing a rule records immutable before/after audit rows with actor/time. Scope/key are immutable; disable and create a new rule for a different source/version/key. Renaming/archiving references does not mutate earlier receipt snapshots. Archived references/parents do not produce new reviewed associations.

Migration 024 installs an AFTER INSERT receipt trigger and private snapshots. It does not backfill/reconcile existing leads, rewrite raw attribution or modify completed imports. Snapshot capture is part of the receipt transaction; failed ingestion rolls it back, and idempotent retries retain the original receipt/snapshot. New historical imports use the reviewed rules effective **at actual receipt/import commit**, with that review time recorded; the existing catalog snapshot remains frozen at import preview under Step 8. Earlier receipts without a Step 11 snapshot stay reported/unmapped or unknown; current rules are not applied retrospectively. Existing raw keys with no recorded review remain unverified, even if a matching rule now exists. No historical reconciliation endpoint is implemented.

Each snapshot records reviewed IDs/names/rule revision/reviewer/time. An explicitly reviewed ad can supply its configured creative relationship. Conflicting reviewed associations are left unverified rather than creating two creative contributions. A lead contributes once per selected dimension. Overall totals are not summed across creative/ad/page/version dimensions. Coverage describes a reviewed association in **either** creative/ad dimension; an unmapped ad bucket can therefore contain a lead with a reviewed creative only.

## Cohort metrics

From/To are inclusive Asia/Kolkata calendar dates, implemented as start midnight inclusive to midnight after To exclusive; maximum 366 days. Presets include today. All configured filters use stable catalog/source snapshot IDs, including unknown and archived references; raw advertising values never override organization/catalog filters.

| Value | Definition |
| --- | --- |
| Received / sample size | Leads with `leads.created_at` in selected CRM-received/import cohort. Not historical source time. Repeat inquiries are separate records; accepted retries are not. |
| Distinct cohort leads called | At least one actual `call_attempts` record by as-of time, counted once per cohort lead. Ordinary edits, callbacks and presence are not calls. |
| Observed confirmed cohort leads | At least one observed CRM confirmation event by as-of time, once per lead. Cancel/reconfirm and multiple events do not inflate it. Inline Confirm may count without a call. |
| Confirmation percentage | Observed confirmed cohort leads / cohort received, as of displayed refresh. N/A for zero denominator, not unrelated period confirmations divided by received leads. Follow-up time may differ. |
| Current status distribution | Current status of each received-cohort lead at refresh, separate from observed confirmation history. |
| Imported as Confirm | Historical provenance flag for imported Confirm, not invented events, dates or caller credit. Separate from current status and observed conversion. |
| Coverage | Mapped: frozen reviewed creative/ad relationship. Reported/unverified: submitted advertising metadata without that reviewed association. Unknown: no recorded advertising association. Neither review nor metadata proves causal origin. |
| Traffic context | Historical import count and API-submission count are labelled separately. API submissions are not asserted to be live production website traffic. Manual/unknown source leads are retained, not inferred. |

Reports group by creative, ad, configured landing page or configured source/form-version. Same display names retain separate group keys; shared creatives across ads do not multiply totals. Server-side EXISTS activity predicates and one-to-one receipt/provenance joins avoid multiplying calls/events/statuses. Received and conversion sorting use UUID/key tie breakers; there are no winner/loser or causal-superiority labels.

## Analyst privacy policy

Creative Analysts receive only approved aggregate report data. They cannot read customer names, mobile/address/Notes, answers, individual lead IDs, raw payloads, unique click IDs, staff performance, review audit or raw management tables. No export or individual drilldown is provided. This page does not subscribe to lead/customer Realtime; a 15-second access-only role check clears the UI after revocation, while every actual API/RPC request rechecks membership/role immediately.

Analyst groups require **k=5 cohort leads**. Smaller groups are omitted; hidden-group counts/totals are not released. Received counts round down to multiples of 5. Other cells are withheld if either the cell or its complementary count is below 5 (including zero); released cells round down to 5. Conversion is calculated from released rounded numerator/denominator, bucketed to 10 percentage points, and withheld for small partitions. These privacy-adjusted percentages/sample sizes can differ from exact management values and should not be recomputed as exact ratios. Sorting uses the released values rather than hidden precise counts. Overall totals are unavailable to Analysts. Empty and below-threshold reports use the same no-reportable-groups state.

This is small-group protection and coarse disclosure, not a differential-privacy guarantee against repeated queries or external auxiliary knowledge. Descriptive aggregates and unequal follow-up ages do not establish causal superiority.

## Permissions and operations

Migration `202611030024_ad_attribution.sql` adds Admin-only RLS reference/rule tables, private no-client-access audit/snapshot tables, protected save/list RPCs and a role-checked aggregate RPC. No existing direct table RLS/grants are broadened to Analysts. All relationships and reads are organization-scoped in SQL. Caller/organization/reviewer identity comes from Auth, never public request data. Updates use revisions; stale/concurrent updates conflict. UI retry attempts retain the same new-record UUID; repeated create requests cannot duplicate that identity. After an uncertain result, reload and inspect before deliberately starting a different record.

Admin lists/rules/audit and report groups are independently bounded to 20 rows per page. Existing source-version/filter option bounds of 500 are retained. Full aggregate totals do not depend on the loaded page. Loading, empty/protected, error, as-of and success-after-server-save states are explicit. No background infrastructure is required. No submitted external URL is fetched. Migration 025 keeps the stable Admin list truly read-only (active Admin check without the write helper's row lock); write authorization retains its locking helper. Migration 026 ignores optional blank/null aliases only in derived matching inputs; all stored raw values and existing snapshots remain unchanged.

Use: log in, open Attribution reports, select IST dates/configured filters, apply, then choose a dimension and sort. Admins can create creative/ad references, select explicit source/version + reported ID, acknowledge the review and save a prospective mapping. References can be renamed/archived; rules can be reviewed/disabled. Existing raw values and historical snapshots stay unchanged. See [step-11-status.md](step-11-status.md) for executed evidence and limitations.

## Additional Campaign completion

Campaign support is now complete within Step 11; the initial implementation had only legacy campaign ID metadata. See [step-11-campaigns.md](step-11-campaigns.md) for migration 027, UI locations, prospective Campaign?Ad?Creative semantics and actual verification. Existing acceptance evidence above is preserved; no prior test is retroactively claimed to cover the additional functionality.

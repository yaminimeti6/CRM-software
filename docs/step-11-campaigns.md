# Step 11 Campaign requirement completion

Date: 2026-11-03 (Asia/Kolkata). The initial Step 11 implementation stored `campaign_id` only as legacy text metadata; it did **not** provide the full Campaign requirement. This extension completes that missing part inside the existing attribution module. Step 12 is not started. Local commits only, no GitHub push. Step 6B and production deployment remain pending.

## UI locations and behavior

Open `http://localhost:3000/app/attribution` (Application → Attribution reports).

- Active Admin: **Admin references and reviewed mappings → Reference type → Campaign**. Create a display name; use Edit reference to rename/archive it. The stable UUID does not change. Same display names are permitted and retain distinct identities.
- **Reference type → Ad → Related campaign / Related creative** creates an explicit organization-scoped Campaign–Ad–Creative relationship. Several ads can share a creative across campaigns. Parent identity is immutable: archive/create a replacement reference and review a prospective rule if a relationship must change. Existing ad IDs and historical snapshots are not reassigned.
- **Reported ID type → Campaign ID (campId / campaign_id)** permits an acknowledged exact source/version mapping. Matching a known ID or allowed origin alone is not a review or proof of ad origin.
- Report **Group by → Campaign reference** and the **Reviewed campaign snapshot** filter. The Unknown choice means no frozen Campaign association, not an inferred link from legacy text. Date/brand/product/source filters and volume/conversion sorting remain available.

Campaigns reuse `ad_references(kind='campaign')`, the Admin-only reference/rule editor and audit. `ad_references.id` is the stable internal identity, `external_id` is optional external metadata typed by kind, `campaign_ref` on an Ad is the same-organization Campaign FK, and legacy `campaign_id` text is **not** a relationship. No duplicate Campaign management module was introduced.

## Migration and historical preservation

`202611030027_campaign_attribution.sql` was applied to development Supabase through the existing verified-TLS/advisory-lock/checksum-ledger workflow. It extends reference/rule kinds, adds the nullable same-organization Campaign FK plus parent-type guard, and extends protected saves, read-only Admin lists, private receipt snapshots and the existing aggregate RPC. No earlier migration was rewritten. Its canonical Git bytes are checked against the applied ledger before commit.

There is no Campaign backfill or inference from existing raw `campId`, `campaign_id`, click IDs or reference names. Older snapshots remain unchanged and are unclassified in the Campaign dimension. New receipts may capture an explicitly reviewed Campaign rule, or the explicit Campaign parent of a reviewed Ad. Conflicting direct Campaign and Ad-parent associations remain unverified; a Campaign-only mapping fabricates neither an Ad nor a Creative. Click IDs are never Campaign matching keys. A rule target change affects only later receipts and retains audit/reviewer/time. Rename/archive does not rewrite earlier names/IDs. Archived Campaigns block new reviewed associations through linked Ads.

Campaign filtering and grouping read only the frozen snapshot. One lead contributes once in the selected dimension; grouping via shared creatives does not multiply totals. Existing CRM-received cohort, observed-first-confirmation, current status, historical-import and coverage definitions continue to apply. A reviewed mapping is not independent verification of advertising origin.

Admin-only writes and existing RLS are retained. Manager/Admin may read exact organization aggregates; Creative Analyst gets the existing k=5 rounded/suppressed aggregate policy, with no customer/raw/click/lead-ID/staff payload. Telecaller is denied. No direct table grants, reconciliation endpoint, export, customer drilldown or Realtime access was added. Reports/lists retain bounded pagination. No configuration or external integration setup is required.

## Checks actually executed

- Complete automated suite: **34 passed, 0 failed**, including prior Steps 1–11 regressions and the Campaign scenario/input cases.
- Further targeted Campaign/input tests: **3 passed**, including wrong-source and conflicting Campaign/Ad-parent probes rolled back inside local PostgreSQL fixtures. These extra conflict probes were local, not claimed as separate browser operations.
- TypeScript and production build `.next-campaign-check` passed. Browser secret scan passed for **22 JS/map assets**. Exact staged secret scan passed for 15 related files; no env/session/customer/build/cache files are included. No separate lint script exists.
- `node --experimental-strip-types scripts/verify-campaigns.mjs` completed with **exit 0** against real development Supabase and isolated production server localhost:3114. Fresh synthetic Admin, Manager, Analyst, Telecaller and other-organization Admin identities were used.

Real database assertions and independently calculated expectations:

| Check | Expected and actual |
| --- | ---: |
| Campaign One cohort / observed confirmed | 13 / 2 |
| Campaign Two cohort / observed confirmed | 7 / 1 |
| Unknown Campaign filter | 33 |
| Whole selected cohort / distinct called / observed confirmed | 53 / 9 / 9 |
| Any reviewed Campaign/Ad/Creative mapping / reported / unknown | 42 / 9 / 2 |

The prior 30-lead raw/snapshot hash stayed identical after Campaign setup, direct rule retargeting, rename and archive. Two Campaigns with identical display names stayed separate. Multiple Ads shared the same Creative across Campaigns. Direct Campaign rule changes preserved earlier snapshots; old raw campaign metadata was not promoted. Invalid foreign/wrong-type parents were rejected; Campaign filters did not expose another organization. The earlier import/call/confirmation scenarios were reused with their real records and no fabricated call credit.

Actual Admin/Manager/Analyst browsers verified Campaign grouping, Campaign One/Two filters, Unknown=33, archived snapshot selection, and Campaign-filtered Creative aggregation (12 linked-Creative leads within the 13-lead Campaign cohort, plus one Campaign-only lead). Analyst counts/cells stayed rounded/protected; customer sentinel values, lead/Auth IDs and raw payloads were absent from protected report responses.

Admin browser verified Campaign create → reload → rename/archive → reload with the same UUID. Ad form Campaign+Creative dropdown selections persisted on the server. Manager/Analyst management writes were denied. An explicit Campaign source/v2 mapping was acknowledged and saved through the browser. An anonymous local test form then submitted `campaign_id` through the real normalization/API path: the frozen Campaign/reviewer snapshot was correct, independently_verified=false, and Ad/Creative were absent for Campaign-only attribution. Same-ID HTTP replay returned the original result, not a duplicate. The one-lead Today Analyst cohort was suppressed. Existing-session role change/deactivation and cross-organization denial passed.

Exact own-fixture cleanup completed. Full before/after hash-only fingerprints matched all pre-existing business/raw/snapshot/import/audit/staff/Auth-password records; only normal security-rate expiry/invalidation metadata is excluded. Existing real users, passwords, manual leads and completed batches were not changed. No live Shopify/Google Sheet work or ad creation/publishing occurred.

No production deployment or warehouse-scale Campaign benchmark is claimed. Prior large-list pagination evidence remains in Step 11; this live Campaign review used the stated synthetic cohorts. Unrelated workspace edits remain outside the local commit. Stop after Step 11.

# Step 11 acceptance record

Date: 2026-11-03, Asia/Kolkata. Scope: creative/ad references, prospective reviewed attribution and aggregate landing-page/form-version cohorts. Step 6B and production deployment remain pending. Step 12 was not started. Local commits only; no GitHub push.

Definitions, privacy policy, permission/query design and usage: [step-11.md](step-11.md). URL: `http://localhost:3000/app/attribution`.

## Applied development migrations

- `202611030024_ad_attribution.sql`: Admin-only reference/rule RLS, private audit and prospective receipt snapshots, protected mutations and read-only aggregate report.
- `202611030025_attribution_readonly_admin.sql`: corrected stable Admin list authorization for PostgREST read-only transactions. The prior locked write helper caused SQLSTATE 25006 / HTTP 503 on list reads. Mutations retain the locked helper; list reads check active Admin without row locks. Confirmed both in a real read-only transaction and through the actual HTTP/browser flow.
- `202611030026_attribution_optional_aliases.sql`: ignores blank/null optional aliases in derived matching only. A local form sends blank legacy `AdCrevId`/`FbClickId` alongside a valid new `creative_id`; the previous matcher wrongly treated the empty creative alias as a conflict. Stored raw fields and all earlier snapshots remain untouched. Matching regressions cover the optional-empty case.

Applied through `node scripts/migrate.mjs` using established verified TLS, advisory lock and checksum ledger. Already applied migrations were not rewritten. New migration files retain canonical LF Git bytes for ledger preservation. No persistent environment/credential change, RLS relaxation, Realtime publication, backfill or historical reconciliation was required. Anonymous form opt-in and synthetic rate secrets were set only in the isolated verifier server process.

## Automated and production checks

- Complete `npm test` passed: 32 tests, 0 failed, including existing Steps 1-10 regressions and Step 11 tests.
- Following migrations 025/026, final affected suite passed: 8 tests, 0 failed (attribution input/scenario, ingestion, imports, catalog, scoped fields, Step 10 and combined Step 9 scenario). Unrelated successful live workflows were not rerun.
- The local actual-PostgreSQL scenario also exercised 25 report groups paginated 20 + 5, all 51 cohort leads counted independently of page, 27 reference records paginated 20 + 7 and 28 rules paginated 20 + 8. These larger pagination fixtures were local PGlite coverage, not a claim of that many live customer records.
- Final TypeScript and production build `.next-attribution-check` passed. No separate lint command exists in this repository.
- Browser secret scan passed: 22 JS/map assets; configured privileged keys and Team secret absent. Exact staged secret scan passed for 21 related files; no env/session/customer/import/build files are included.
- The existing development app's attribution route returned the expected logged-out HTTP 307 on localhost:3000. Browser acceptance used an isolated production server on localhost:3114 against real development Supabase.

## Real Supabase and browser checks

Final `node --experimental-strip-types scripts/verify-attribution.mjs` completed with exit 0. It used fresh synthetic Admin, Manager, Creative Analyst, Telecaller and other-organization Admin identities, actual Supabase Auth, actual application APIs, actual database RPC/RLS and browser automation. No mock report service or manual-checklist substitute.

Independently calculated fixture expectations matched real SQL and displayed management results:

| Metric | Expected / actual |
| --- | ---: |
| Selected CRM-received cohort | 30 |
| Distinct cohort leads called | 7 |
| Observed confirmed cohort leads | 6 |
| Cohort conversion | 20% |
| Reviewed mapping / reported-unverified / unknown coverage | 22 / 6 / 2 |
| Historical imported Confirm without invented confirmation events | 1 |
| Creative groups (same name, distinct IDs) | 13 / 9 |
| Configured landing-page cohorts | 21 / 8, plus 1 unknown manual lead |

Actual tests included two creatives/pages, multiple ads sharing one creative, same display names retained as separate IDs, unmapped/invalid/spoofed advertising identifiers and click-only input never promoted to a creative ID. Public submission retry and historical import reprocessing retained existing IDs. Prospective rule creation/update retained old snapshots and audit revisions. Source version changes required separate rules; source-local identical values did not merge. Catalog/reference rename/archive retained historical grouping. Conflicting reviewed creative/ad relationships were unverified rather than silently preferred. Original positional import tracking stayed unchanged while explicitly keyed new imports produced reviewed snapshots.

Multiple calls and seven confirmation events produced only seven distinct called leads and six observed-confirmed cohort leads. Ordinary edits and repeated Confirm did not add call credit. Cancel/reconfirm did not multiply conversion. IST midnight and zero-denominator cases passed.

Actual Admin/Manager browsers displayed the expected exact totals, source/version and landing-page group results. Analyst browser/API returned protected aggregate data only: 13-lead group displayed 10 rounded leads and 5 confirmed with privacy-adjusted 50%; 9-lead group displayed 5 rounded leads with its one-confirmation metric withheld. This differs deliberately from exact management ratios; the UI labels the adjustment and documents its computation. A group below five was absent, overall totals were null, and no hidden-group totals were returned. Customer sentinel values, actual synthetic lead IDs, staff/Auth IDs, mobile/address/Notes/answers, unique click values and raw payloads were absent from Analyst responses. Analyst browser did not request customer/staff APIs or Realtime subscriptions. Direct customer/SSE and Admin endpoints denied Analyst access.

Admin browser created a reference, explicitly acknowledged and saved a source/v2 mapping, observed server-recorded reviewer/time and retained it after refresh. Concurrent same-revision mapping updates returned 200/409; a fresh revision recovered. The real anonymous local form then submitted a new inquiry through the actual normalizer and endpoint, without staff cookies/authorization. The same-ID HTTP retry returned 200 without duplicating the lead. Its frozen snapshot recorded the selected reference and real review actor/time, with independently_verified=false. Raw placeholders and original answers matched the submitted fields. The resulting one-lead Today cohort produced no Analyst rows, no exact total and no new reference-name leak.

Actual fresh API requests denied Telecaller access, Manager/Analyst management writes, cross-organization reads and forged filters. Changing a signed-in Manager to Telecaller denied the next report request immediately; the access-only poll cleared the browser. Deactivating the signed-in Analyst denied fresh reads and cleared cached report rows. No individual-lead drilldown or export was added.

## Resolved failures and preservation

Earlier partial runs are not reported as full passes: list reads exposed the stable-RPC row-lock defect (025); the real form exposed the optional-empty-alias defect (026). A verifier assertion initially expected an empty raw object even though the form legitimately stores blank placeholder keys; it was corrected to compare the exact recognized submitted raw fields, not to remove them. The final rebuilt production app and complete verifier passed all phases.

Exact cleanup removed only fixture IDs created by this verifier and their computed ephemeral rate buckets. Full before/after hash-only comparisons matched every pre-existing business, catalog, raw/source/snapshot/audit, private import/batch, staff and Auth/password record. Normal security-rate expiry and invalidation revisions are excluded from business comparisons. Existing users, passwords, manual leads and completed import batches were not changed. Unrelated IDE work remains outside this task's commit. No live Shopify website or Google Sheet was touched.

No production deployment, warehouse-scale performance benchmark or formal differential-privacy guarantee is claimed. Larger pagination was tested locally as described, not as a live production load test. Step 6B remains pending; stop after Step 11.

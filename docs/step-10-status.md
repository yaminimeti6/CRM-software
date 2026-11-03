# Step 10 acceptance record

Date: 2026-11-03, Asia/Kolkata. Step 10 only: management dashboard and self-only Telecaller performance. Step 6B remains pending; Step 11 not started. Git delivery is local only, no push. Metric definitions/query design/usage: [step-10.md](step-10.md).

## Applied migration and configuration

`202611030023_management_performance.sql` was applied to the real development Supabase using `node scripts/migrate.mjs`, existing verified TLS, advisory migration lock and checksum ledger. Live verifier confirmed its ledger entry. The exact applied migration has Git line-ending conversion disabled so checkout preserves its checksum bytes; older migrations are unchanged. It adds the read-only aggregate RPC and four organization/time/actor indexes. No existing business records were backfilled or rewritten by the migration. No persistent environment, RLS relaxation, new auth account setting, Realtime publication or external integration configuration was required.

## Closed prior verification gap

The corrected complete `node scripts/verify-catalog.mjs` ran once against `.next-acceptance-check` and the real development Supabase, exited 0. All catalog/version/attribution/import/browser/permission/conflict assertions and final business/Auth-password fingerprints passed. No prior exit 1 is presented as success; this is the newly executed full corrected run requested for Step 10.

## Automated checks actually executed

- Complete `npm test`: 30 passed, 0 failed, including existing Steps 1-9 SQL/input regressions and the new Step 10 fixture scenario.
- After the accessible-label fix and extra matrix/pagination assertions, targeted performance tests passed again: 2 passed, 0 failed. PGlite uses actual PostgreSQL migrations/RLS/RPCs, not a mocked analytics service. The 24-actor staff paging case returned 20 + 4 unique rows with the same full 52-attempt total on both pages; this extra-volume staff pagination check was local, not 24 real Supabase users.
- TypeScript and final production build `.next-performance-check` passed. No separate lint script exists in package.json.
- Browser secret scan passed for 21 JS/map assets. Exact staged secret scan passed; no private env, fixtures/customer data, session files or build artifacts are staged.

## Actual development Supabase and browser execution

Final `node scripts/verify-performance.mjs` exited 0 using isolated production server localhost:3113 and fresh synthetic organizations/identities only. Independent fixture expectations were hard-coded, not inferred by counting rendered cards:

| Metric | Expected and actual |
| --- | ---: |
| CRM received cohort | 5 |
| Recorded attempts / distinct leads called | 31 / 2 |
| First observed CRM confirmations / all events / reconfirmations | 2 / 3 / 1 |
| Current Confirm (including one imported historical Confirm) | 3 |
| Observed received-cohort conversion | 2 / 5 = 40% |
| Pending / overdue / period completed callbacks | 2 / 1 / 1 |

Real database assertions covered multiple callers sharing one lead, 26 additional attempts on a repeat inquiry, retried call/public-ingestion submissions and import reprocessing without duplicate records; inline Confirm without calls; Confirm/cancel/reconfirm preserving first credit; ordinary repeated Confirm; historical imported Confirm without fabricated events; callback schedule/reschedule/complete/cancel history without calls; current-state/period/cohort distinctions; moving the first confirmation outside the selected period without transferring its original credit; IST midnight and zero-denominator conversion; configured/unknown attribution and renamed archived snapshot IDs. Caller outcome counts were CNP 28, Confirm 2, Retry 1. Per-actor attempts/distinct/first/reconfirmation/callback-action matrix was checked separately. All reads/refreshes left attempt/event counts unchanged.

Real Admin, Manager and Telecaller browser sessions displayed the expected metric cards, conversion and staff table. Telecaller saw one self row, 16 attempts and N/A organization cohort metrics; inactive second caller remained in management history. Actual browser drilldowns verified full totals, 31 call records paginated 25 + 6, first/reconfirmation/distinct/pending/completed/current counts and a specific actor's 16 calls. N/A zero cohort and archived/unknown filters passed.

Actual HTTP and database checks denied logged-out access (401 API / protected redirect), Telecaller foreign actor and organization lead/current breakdowns, Creative Analyst performance/customer access, forged organization definitions, invalid dates and cross-organization reads. Existing-session Manager-to-Telecaller change immediately returned self scope. Deactivation immediately denied the signed-in Telecaller API and the open browser cleared its performance data.

Two independent browser sessions watched a real server-recorded call change Today attempts from 0 to 1; the same request retried returned the original result, not a second attempt. A separate actual Realtime-origin notification was observed explicitly, not inferred from fallback polling. Incoming refresh preserved unsubmitted date input. Existing Realtime recovery infrastructure was reused; no new scheduling/background dependency.

The first browser run stopped on an exact Period accessible-label lookup. The select now has an explicit accessible label. A rebuilt production app and the complete final Step 10 verifier then passed. That failed run is not reported as an end-to-end pass.

## Preservation and limitations

Exact fixture cleanup removed only newly recorded fixture IDs and computed ephemeral synthetic login-rate buckets. Full before/after hash-only snapshots matched for all existing operational, catalog, sources, private import/batch contents, audit, staff and Auth/password records. Normal security-rate expiry and organization invalidation revision markers are excluded from business comparisons. No real Admin/staff/password/manual lead/completed batch was edited; no live Shopify website or Google Sheet was touched. Unrelated IDE changes remain outside the local commit.

No production deployment, physical-device/network cable test, warehouse-scale query benchmark, Step 6B live integration or Step 11 is claimed. Browser acceptance ran against the production build and real development database; localhost:3000's development performance route was independently reachable with the expected logged-out redirect. Existing broader Step 1-9 live evidence is reused rather than repeatedly executing unrelated workflows.

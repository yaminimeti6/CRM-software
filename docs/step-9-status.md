# Step 9 acceptance record

Scope: existing All Leads advanced server filters, private personal saved views and minimal Supabase Realtime invalidations. Step 6B remains pending; Step 10 not started. Step 8 local commit remains preserved.

Migrations 021 and 022 were applied through the existing verified-TLS checksum-ledger workflow. Publication includes `public.lead_change_signals`. No customer backfill, database reset, real user/password change or real customer import. The signal table contains only organization/revision UUIDs.

Automated checks so far: 28 tests passed, including full-dataset pagination/count, IST boundary, missing/empty/present/exact/contains text, snapshot/catalog/source/version/caller/callback filters, unknown attribution, scoped same-name quiz fields, private view ownership/revision/null-input security and existing Steps 2–8 tests. TypeScript and production build passed.

Real development Supabase scenario passed combined filters/totals/pages, IST dates, archived snapshot labels/IDs, distinct source/version questions, actual caller and confirmation semantics, callbacks, saved-view isolation and revision conflicts. Browser checks passed personal view refresh/logout/login persistence, rename/update/delete, selected columns/page size, private ownership and concurrent 200/409 updates. Two actual sessions observed new/changed leads entering and leaving active filtered results. Remaining open-form/reconnect/subscription checks are completed before final acceptance below; partial runs are not full passes.

The first browser saved-view attempt clicked Delete while its explicit reload was still in flight and correctly hit stale state. Reload now disables dependent actions until the new revisions are loaded. A fixture adapter's composite SQL row and audit-version handling were corrected before live tests; application invariants were not bypassed. Only exact synthetic fixtures and computed ephemeral login-rate buckets are cleaned. Normal rate-metadata expiry is excluded from business fingerprints.

No production deployment, physical network-cable/device-sleep test, live Shopify/Google Sheet integration or automatic numeric/date answer typing is claimed. Existing 10,460-row import throughput evidence remains in Step 7; it is not rerun without a related reason. Requirements, query semantics, edit safety and manual synthetic steps: [step-9.md](step-9.md).

## Completed live verification

`node scripts/verify-lead-views.mjs` completed with exit 0 against the development Supabase project and the production build on isolated localhost:3111. Verified:

- Combined full-dataset filters/counts/pages, IST boundaries, unknown attribution, archived snapshot IDs/labels, different meanings under identical source/version question names, actual caller/confirmation/callback groups and personal view revision/isolation.
- Personal view create/apply/rename/update/delete; selected columns/page size and definitions survive refresh and logout/login. Two concurrent updates produced HTTP 200/409. Logout stopped client subscription requests.
- A saved field deliberately removed only from synthetic fixtures was retained in its definition and returned explicit HTTP 400 with zero displayed rows; no broad fallback.
- Two browser sessions observed genuine Realtime create/edit delivery, with a changed lead entering/leaving the active status/search filter. The SSE transport recorded an actual Realtime-origin notification, separately from recovery checks.
- Unsaved Notes survived incoming events and a stale save returned 409. Cancelling refresh preserved text; explicit discard fetched authoritative data while retaining filters. Unsubmitted call and callback drafts survived incoming changes. Offline/online recovery fetched missed updates.
- Direct Supabase Realtime positive delivery was observed with only organization/revision payload keys. Another organization's authenticated subscription received zero foreign events; unauthorized APIs, Creative Analyst restrictions and existing-session role/deactivation revocation passed.
- Read/view/presence operations created no fabricated attempts or confirmations. Exact synthetic cleanup left existing operational/catalog/import/view records and Auth/password fingerprints unchanged. Normal security-rate expiry is not treated as business data; only computed ephemeral synthetic login buckets were deleted.

The open-call diagnostic showed the form remained mounted. Its textarea's changing label text prevented an exact-label assertion after typing; an explicit accessible label fixed this without redesigning the form or discarding its content.

Final TypeScript/build checks passed. Browser scan: 19 JS/map assets, configured privileged values absent. Production local-test-form disabled gating returns 404. Dependency audit: 0 vulnerabilities. Staged secrets and affected ingestion/import regressions are reviewed before the local commit. There is no production deployment claim or pending Realtime configuration on this development project.

## Affected regressions and delivery

The final production build passed the existing real Step 6A anonymous-form/All Leads/refresh and lost-response recovery verifier, including unchanged operational/Auth fingerprints. The existing Step 7 small CSV/XLSX verifier also completed with exit 0: zero-write preview, explicit exclusion/confirmation, persistence/refresh, duplicate/blank headings, Gujarati/date handling, file/external-ID conflicts, concurrent resume, row rollback/retry, Admin/cross-organization restrictions, safe downloads and retention expiry. Imported Confirm still fabricates no call/confirmation/OTP credit. Synthetic cleanup preserved existing business/Auth fingerprints.

A focused final check also passed Unknown version filtering across manual and attributed leads. No unrelated successful full-volume or manual acceptance checks were repeatedly rerun. No development migration or Realtime-publication blocker remains. Physical devices/production proxy/deployment remain unverified as documented.

Step 9 is delivered as a local commit on the current branch under AGENTS.md. No GitHub push is performed. Unrelated IDE/formatting changes are preserved outside the commit. Step 6B remains pending; stop before Step 10.

# Step 7 acceptance record

## Real development integration verification

Migrations 017 and 018 applied through the existing verified-TLS checksum-ledger runner. Existing business records and Auth/password fingerprints matched before/after migration and after synthetic fixture cleanup.

`verify:imports` passed against real development Supabase and a production Next.js build:

- Real browser CSV upload, positional mapping, zero-lead preview, explicit invalid-row exclusion, explicit confirmation, saved results after refresh, and All Leads visibility.
- Leading-zero/text identity preservation; duplicate/blank headings; imported Confirm with unknown original caller/time, no trusted OTP, no fabricated attempts/events or historical caller credit.
- Actual XLSX worksheet selection, Gujarati answers, explicit DMY/Asia-Kolkata date conversion, repeated/existing external-ID conflicts, corrections and concurrent processing.
- Injected row failure rolled back all lead/provenance writes; correction/retry recovered the row. Admin/backend/RLS/direct-write restrictions and cross-organization downloads/actions were checked. Future live ingestion conflicts with a reliable imported source ID instead of duplicating/overwriting it.
- 10,460 synthetic rows previewed with zero operational writes, then imported in 105 transactions of at most 100 rows. Processing stopped after the first chunk and resumed. Completed replay imported zero additional rows. Upload, prepare, first preview, explicit confirmation and first processing chunk used actual HTTP; remaining volume used actual protected SQL functions with a real fixture Auth UID. This was not a 10,460-row browser test.
- Forced expiry removed private original/parsed staging but preserved imported operational history. Only exact synthetic fixtures were removed; pre-existing data and Auth/password fingerprints remained unchanged.

Two earlier small integration runs passed application assertions but exposed a test-fixture teardown FK ordering error. The verifier was fixed to remove its synthetic batches before its synthetic organizations. Exact guarded fixture recovery and the final full run succeeded; no manual records were deleted.

## Verification boundaries

No real customer file was imported. Public production deployment, actual customer-specific column mappings, every third-party XLSX format, physical network-disconnection testing and a seven-day wall-clock wait are not claimed. Retry/checkpoint recovery, concurrency and forced retention expiry were tested deterministically. Automatic retention is scheduled through Supabase pg_cron; operator cleanup remains available. Existing accepted manual Steps 1–5 were not unnecessarily repeated. Step 6B and live website/Google Sheet integration remain pending.

Parser dependencies are csv-parse, yauzl and saxes. ExcelJS was evaluated then removed because its transitive dependencies introduced audit findings; the final installed dependency audit reports zero vulnerabilities. No formula engine runs on uploaded content.

Full test/build/regression and Git delivery results are recorded in the task completion report. Workflow, limits and manual synthetic steps: [step-7.md](step-7.md).

## Final local checks

- Full automated suite: 23 passed, zero failed. TypeScript and production build passed using `.next-imports-check`.
- Browser asset secret scan: 18 JS/map files, configured privileged values absent. Staged tracked files also scanned against local private environment values; no local env/customer files staged. Dependency audit: zero vulnerabilities.
- Supabase pg_cron `crm-import-retention` is active every minute and its latest actual run status was `succeeded`; service-only cleanup command passed with zero expired files remaining.
- Existing call/ordinary-edit race and coherent confirmation-summary live regression passed, including unchanged operational/Auth fingerprints after synthetic cleanup. An overlapping first regression run caused a preservation-comparison race in the test harness; the isolated rerun passed.
- Production runtime test-form opt-in disabled returns 404, preserving Step 6A's production default.

An initial full ingestion regression exceeded its real one-minute throttle window while sending 20 slow sequential requests, so its final assertion saw HTTP 200 rather than 429. The harness now sends those 20 requests concurrently inside the window; application rate limits were not relaxed.

The final isolated complete Step 6A ingestion regression passed anonymous form/All Leads/refresh, lost-response replay, JSON/form encoding, concurrent idempotency, conflicting content, preserved staff edits, same-phone distinct inquiries, validation/source/OTP/PII permissions, injected registration rollback/recovery, HTTP 429 throttling and existing Team/follow-up access checks. Final cleanup/preservation is checked by that verifier before success.

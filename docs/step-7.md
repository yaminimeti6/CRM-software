# Step 7: historical CSV/XLSX lead import

Admin → Imports accepts UTF-8 CSV or one selected worksheet from an XLSX workbook. Upload and preview create only private staging records, never operational leads. Review every column role and label, source/form version, explicit date format/timezone, status mapping and identity policy; acknowledge the mapping, correct or explicitly exclude invalid rows, then use **Confirm historical import**. Processing commits at most 100 rows per request. Pause, refresh and Resume processing use the saved batch/checkpoint. Closing the browser pauses further requests; no background worker is required.

## Mapping and history

Required normalized fields are name and mobile number. Columns are identified by position (`c0`, `c1`, ...), so duplicate and blank headings remain distinct. Unmapped columns remain legacy metadata. Explicit quiz keys and labels become source/version-scoped dynamic fields without schema changes. Original headings, cell values and corrections remain separate. Phone numbers/external IDs stay text; leading zeros are preserved when present in the source. Excel cannot restore zeros already lost before upload. Numeric identity cells need explicit acknowledgement; formulas, unsafe numbers and unsupported cells require correction or exclusion.

Choose ISO, DMY, MDY, YMD or EXCEL and Asia/Kolkata or UTC. Non-ISO text dates use explicit 24-hour formats; ambiguous formats, AM/PM and unsupported dates are rejected rather than guessed. Source dates are separate from CRM receipt/import time. Raw historical caller, OTP and status are untrusted metadata, not authenticated callers or verified OTP. Map each legacy status explicitly; `legacy` uses New while preserving the original.

An imported Confirm lead contributes to **current confirmed leads**, but creates no call attempt or confirmation event and gives the importing Admin no historical calling credit. Original confirmation caller/time are unknown. First/latest CRM confirmation values describe observed CRM events only. Later explicit cancellation/reconfirmation uses the existing protected call/confirmation logic. Confirmation events in a period and distinct confirmed leads are different counts.

## Duplicates, concurrency and failure

One organization/file hash/worksheet identifies a batch. Re-uploading/retrying an already confirmed batch does not create another import. Preview configuration is revision-controlled and immutable after confirmation. Row corrections use revision checks. Processing has a per-batch advisory lock; each row has an atomic subtransaction covering lead, audit, ingestion, scoped answers, provenance and reliable identity. A failing row rolls back completely and remains safely retryable; successful rows are never replayed into extra leads.

Reliable external IDs use exact source-scoped text (no case/space normalization). Existing or repeated IDs are preview conflicts; IDs already imported through this reliable ledger also block conflicting future live ingestion. Source submission UUIDs coordinate with existing receipt locks. Missing/unreliable IDs cannot automatically reconcile future submissions. Phone number alone never merges leads or overwrites existing records. Duplicate metadata IDs require an explicit acknowledgement when deliberately not reliable.

## Security, staging and limits

Only active organization Admins can upload, preview, confirm, process, correct or download error reports. Server identity/organization and database RLS/RPC checks both apply. Telecallers, Creative Analysts, anonymous users and other organizations cannot access staged files or operational import writes. No service key enters browser bundles. Error CSVs neutralize spreadsheet formula prefixes.

Private PostgreSQL staging stores original bytes and parsed rows for seven days after explicit upload. Migration 018 schedules `crm-import-retention` every minute on Supabase pg_cron. Authorized access also cleans expired staging; `npm run cleanup:imports` is a service-only operator fallback. Expiry removes private original/parsed content and staged candidate payloads, preserving operational leads, provenance and batch outcomes. Unfinished expired batches are read-only: resume within seven days; after expiry review a remaining-row file and reliable IDs, rather than resetting history.

Limits: 8 MiB upload, 32 MiB expanded XLSX archive, 20,000 total data rows, 100 columns, 20 worksheets, 500,000 cells, 24 MiB parsed JSON, 128 KiB per row. XLSX parsing rejects encrypted/macro/external-link archives, XML entities and unsafe archives. Formulas are literal and never executed. Legacy XLS and password-protected workbooks are unsupported. Error CSV download is paginated (50 rows/page).

## Manual synthetic verification

1. Log in as Admin and open `/app/imports`. Download the synthetic sample CSV from the page. Do not upload customer records for testing.
2. Select a synthetic saved source, upload the sample and select its worksheet. Map Name/Mobile, Status, Caller, quiz columns and external ID explicitly; keep duplicate/blank columns separate. Use a new test form version and explicit status/date/identity choices.
3. Acknowledge and prepare preview. Check All Leads: no sample lead exists yet. Correct the missing mobile or explicitly exclude that row.
4. Click **Confirm historical import**, read and accept the confirmation. Check saved results, refresh, reopen the batch and resume: no duplicate leads should appear.
5. Open the synthetic leads in All Leads, enable their dynamic quiz columns, and inspect history. Imported Confirm shows unknown original caller/time and no fabricated call/confirmation event.

## Applied migrations and scope

- `202611020017_historical_imports.sql`: private staging, batches/rows, permissions, atomic processing, provenance and reliable source identity coordination.
- `202611020018_import_retention_schedule.sql`: expired staging retention schedule.

These were applied to the configured development Supabase project with the checksum ledger; do not rerun manually or edit applied migration files. No database reset, live website, Google Sheet, customer import or production deployment was performed. Step 6B remains pending. No later CRM step is included.

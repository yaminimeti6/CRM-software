# Step 2 — shared manual lead entry and editing

This slice adds only authenticated manual lead entry, organization-shared lead
listing, inline edits, dynamic quiz columns and edit history. No public ingestion,
imports, call attempts, follow-ups, dashboards or creative reports are included.

## Database and deployment

Apply tracked migrations with `node scripts/migrate.mjs`. It uses the existing
ignored operator configuration and migration checksum ledger. It never invokes
bootstrap or recreates users. Migrations 003 and 004 add lead tables, status
configuration, organization-scoped field definitions, audit triggers, restricted
write RPCs and literal-text server-side search. Existing organizations receive
New and Retry statuses. Future organizations receive the same defaults.

Public table access uses the caller's Supabase JWT. Admin, Manager and Telecaller
can read shared leads in their own active organization; there is no assignment.
Creative Analyst receives no customer rows, answers, field definitions or history,
and the backend denies customer endpoints with 403. Anonymous table/RPC access
is denied. RLS also protects direct Supabase requests.

Client table INSERT/UPDATE/DELETE is denied for leads, field definitions and audit
history. Only `create_lead` and `update_lead` permit operational writes. These
SECURITY DEFINER functions have an empty search path and independently derive
the active organization and actor from `auth.uid()`, validate inputs and prevent
caller-supplied organization, UUID, timestamps, creator or version changes.

`create_lead` uses the database-generated UUID and timestamptz, initial version 1
and configured active `is_new` status. Quiz answers are JSONB string values
(30 pairs maximum); their original keys/values are stored without schema changes.
The audit/registration trigger inserts unknown field definitions atomically.
Mobile numbers remain text, including leading zeros and optional country prefix.

`update_lead` locks the row and requires its current version. A stale write returns
HTTP 409 without overwriting anything. A successful change increments the version
and atomically records editor UUID, time and before/after values. A no-op update
does not create extra history. Edit history never creates call-attempt records.

All stored times use timestamptz; the UI explicitly formats Asia/Kolkata (IST).
Status changes are ordinary edits in this slice. **Confirm is disabled**: the
database rejects labels containing "confirm" until atomic confirmation-event
tracking is implemented in a separately authorized increment.

## Status configuration

New and Retry are seeded data, not hardcoded dropdown values. The UI reads the
organization's status definitions. Admin may update label, active and sort_order
through authenticated Supabase table requests; RLS denies those changes for other
roles. New cannot be disabled. Trusted operators can add non-confirmation statuses
to `lead_statuses` in SQL Editor with the correct organization ID. No status
management screen is included. Do not enable a confirmation-equivalent status.

## API

- `GET /api/leads?page=1&size=20&q=&status=`: paged records/count, statuses and
  known dynamic fields. Allowed page sizes: 5, 10, 20, 50. Search is literal
  case-insensitive name or literal mobile substring; punctuation is not syntax.
- `POST /api/leads`: JSON `{name,mobile_no,address?,notes?,answers?}`; HTTP 201.
- `PATCH /api/leads/:id`: full editable fields plus current `version` and optional
  `status_id`; HTTP 409 on conflict. Unknown/protected fields are rejected.
- `GET /api/leads/:id/history?page=1`: paged immutable history (20 per page).

Every endpoint validates staff role and database authorization. Responses are
private/no-store. Writes require same-origin JSON and body size under 50 KB.
All parameters are validated server-side; PostgREST errors are sanitized.

## Manual use

1. Sign in and open All Leads. Your actual name/role and Sign out remain available.
2. Expand Add Lead. Enter name and mobile text, optional address, and optionally
   Add question with its answer. Click Create lead and wait for the saved message.
3. Reload the page to check persistence. Expand Choose quiz columns to display a
   newly registered question. Use search/status/page-size controls as needed.
4. Edit a row's name, mobile, address, notes, status or visible quiz answer. Click
   Save row. Wait for the success message before changing filters or pages.
5. Open History to inspect the editor's display name, IST time and each field's
   Before/After values. Creation is labeled Lead created; newest entries appear
   first. Status IDs resolve to labels and quiz edits appear per question. Missing
   profiles/statuses use safe unavailable labels. Close history returns to the row.
   If a
   conflict appears, use Reload table, review the latest values, then reapply your
   changes. Reload discards unsaved drafts. Times are displayed in IST.

## Verification tooling

`npm test` executes real PostgreSQL migration/RLS/RPC tests in PGlite, plus runtime
input/role/CA validation tests. `npm run build` compiles production. Neither alone
establishes hosted integration acceptance.

`node scripts/verify-login.mjs --authorization-only` checks remaining Step 1
authorization using disposable staff accounts, without prompting for or changing
the existing Admin. It reads the completed guard and calls only its refusal check;
it never runs bootstrap/migrations as setup. The user's existing Admin password,
refresh and logout were manually verified separately.

`node scripts/verify-leads.mjs` uses the real configured development project and
installed Edge/Chrome, with isolated CRM_TEST organizations and synthetic accounts.
It tests UI create/refresh/edit, JSONB registration/columns, audit, simultaneous
updates and stale Save row in two independent browser sessions,
search/filter/pagination/validation, Manager/Telecaller access, Analyst
denial, cross-organization isolation and login/logout. Cleanup deletes only the
exact organizations/users/leads created in that run. Existing data is untouched.
The verifier also compares database count/hash fingerprints before and after
cleanup for existing organizations, staff, memberships, leads, history, fields and
statuses; it never prints their private contents.

To avoid interfering with a running dev server, build/start on port 3100 with
`CRM_NEXT_DIST_DIR=.next-check`, then run the suite with
`CRM_TEST_BASE_URL=http://localhost:3100`. In PowerShell set each variable with
`$env:VARIABLE_NAME='value'` in the appropriate terminal. Production HTTP tests
on localhost use the browser's trusted localhost behavior for Secure cookies;
deployed production must use HTTPS. No browser credentials/traces are saved.

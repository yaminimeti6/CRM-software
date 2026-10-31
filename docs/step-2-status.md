# Step 2 acceptance record

## Final acceptance after user manual verification

On 2026-10-31 (Asia/Kolkata), the user confirmed manual lead create/persistence,
Notes/status saves, readable history, Age=35 dynamic column, mobile search and
status filtering. The remaining checks were rerun against the actual development
project using the current production build on isolated localhost:3100.

`CRM_TEST_BASE_URL=http://localhost:3100 node scripts/verify-leads.mjs` completed
with **exit 0**. This run additionally opened **two independent browser sessions**
on the same synthetic lead. The Manager session saved first; the older Telecaller
session received HTTP 409 and displayed the conflict message. SQL confirmed the
newer Notes value, unchanged quiz answer, version 5 and exactly five history
records: the stale save caused neither overwrite nor an extra audit entry.

The full run passed real role permissions, anonymous read/write/history API
denial, cross-organization lead/history isolation, server validation, pagination,
name/mobile search, status filtering, dynamic-field persistence, login/refresh/
logout and database-level Confirm rejection. A disposable staff fixture verified
Admin API/lead access; the existing Admin was not modified or recreated.

Before creating fixtures, the verifier recorded server-side count/hash snapshots
of all existing organizations, staff profiles, memberships, leads, lead history,
field definitions and statuses. After deleting only exact test-owned fixture IDs,
every count/hash matched and the Auth account count matched its baseline. Private
row content and credentials were not printed. Existing manual leads were untouched.

`npm test`: **9/9 PASS**. `npm run typecheck`: **PASS**. Production build with
`CRM_NEXT_DIST_DIR=.next-check`: **PASS**. No current-run application failures or
remaining Step 2 acceptance blockers. Earlier run details below are historical.
Existing Admin interactive login remains user-verified; automated Auth regression
used real disposable staff credentials held only in process memory. No Step 3
work, bootstrap/reset, new application module or credential changes occurred.

Date: 2026-10-31, Asia/Kolkata. Real project: `mwpryrxmrdxgibgsetir`.
No bootstrap, database reset or existing Admin recreation was performed. No other
CRM modules were built.

## Step 1 gate

The user manually verified their existing Admin's actual name/role, login,
refresh persistence and logout redirect. Before Step 2 implementation,
`node scripts/verify-login.mjs --authorization-only` passed real Supabase/browser
checks for Auth-only account denial, Telecaller Admin API denial, cross-organization
isolation, protected membership/profile writes, metadata role spoofing, immediate
inactive-membership revocation and refusal to reuse the completed bootstrap guard.
Only disposable accounts were used; bootstrap was not run as setup.

Two failures were resolved before proceeding: the verification script refills
email after React resets a failed form; denied-staff login signs out only its
local session instead of revoking every session belonging to that account.

## Implementation and migration

Migrations 003–005 were applied through the version/checksum ledger to the real
project. They add lead/status/field-definition/history tables, role/tenant RLS,
validated write RPCs, actual-actor audit, optimistic version conflicts and literal
parameterized search. Existing organizations receive New/Retry configuration;
synthetic leads were inserted only into isolated test organizations.

The app includes Add Lead, shared spreadsheet-style inline editing, optional quiz
columns, pagination, name/mobile search, status filter, history, account details
and sign out. Times display in Asia/Kolkata. Confirm is explicitly disabled and
database-constrained until atomic confirmation tracking is separately implemented.

## Live tests actually executed

Final command against an isolated production build/server on localhost:3100:

```powershell
$env:CRM_TEST_BASE_URL='http://localhost:3100'
node scripts/verify-leads.mjs
```

**PASS, exit 0.** Verified:

- Browser UI created a lead through real Auth/PostgREST. SQL/authenticated reads
  confirmed server UUID/time, actual creator, New status, leading-zero text mobile,
  address and JSONB question/answer. Refresh preserved the record.
- Unknown question registration and selectable/displayed quiz column worked
  without schema changes.
- Inline address/notes/status persisted after refresh. History contained actual
  editor UUID/time and before/after fields.
- Simultaneous HTTP writes with one version produced one success and one 409,
  with exactly one version increment.
- API pagination returned five rows then one; UI page-size/Next/search worked.
  Name/mobile search and status filtering returned correct records/counts.
- Backend rejected malformed mobile/protected fields and cross-origin writes;
  UI displayed the server validation error.
- Manager shared read/edit worked. A disposable staff fixture temporarily given
  Admin role passed Admin/lead API checks, then reverted; existing Admin untouched.
- Creative Analyst had no customer rows and was denied by UI/API/RPC. Other-org
  staff could not read/edit the lead/history. Anonymous reads, direct protected
  writes and history deletion were denied.
- Database refused Confirm. No call-attempt or confirmation modules were added.
- Real staff login, refresh and logout protected pages/APIs correctly.
- All synthetic leads/history, fields, statuses, organizations and Auth users were
  cleaned up by exact fixture IDs. Existing account count matched the baseline.

Observed failures resolved before the passing run: stale conflicts originally
used a transaction-retry SQLSTATE; migration 005 uses PT409. Pagination selects
received explicit accessible labels. Out-of-order list responses cannot overwrite
newer filters. Concurrent API tests use independent authenticated HTTP requests.

## Local checks and limits

- `npm test`: PASS, 7 tests (actual migration/RPC/RLS SQL on PGlite, audit/no-op
  behavior, stale rejection, role/tenant isolation and input validation).
- `npm run typecheck`: PASS.
- Production build with `CRM_NEXT_DIST_DIR=.next-check`: PASS.
- No remaining blocker for this slice. Existing Admin interactive login was
  user-verified rather than replayed with private credentials. Automation used
  disposable real Auth accounts; no mock authentication or database was used.
- This verifies the development project/local production server; it does not
  establish hosted deployment, long-duration token-expiry or load-test results.

Manual instructions and API/security contract: [step-2.md](step-2.md).

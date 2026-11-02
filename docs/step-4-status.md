# Step 4 acceptance record

Date: 2026-11-02, Asia/Kolkata. Development Supabase project: `mwpryrxmrdxgibgsetir`.

## Step 3 prerequisite review

User-confirmed activation/username login, Telecaller Team-menu exclusion, shared test leads and Notes edits were accepted as passed, not repeated manually. The current `manual-team-verification.md` already records live expiration/revocation/reuse, concurrent acceptance, durable partial-provisioning recovery, backend role/tenant denial, deactivation of existing sessions and concurrent last-Admin protection. The earlier Team guard also covers last-Admin deletion and concurrent deactivations. The implementation of those guards was unchanged. Current manual-Team, Team, bootstrap and role tests passed again as relevant Step 4 regression checks. No unresolved requested Step 3 acceptance item or protection failure was found.

## Existing work and implementation

Inspection found uncommitted Step 4 code and migration 010 already applied in the development database. That work was reviewed/preserved, not overwritten or reinitialized. Migration 010's applied checksum was preserved. Pending migration 011 was applied using `scripts/migrate.mjs`; it keeps summary status/version/counts on one locked lead snapshot. Frontend request ordering was hardened against stale summary responses, and starting a deliberate new call after an uncertain result requires an explicit warning. No existing user, password or manual lead was recreated/reset.

Implemented only lead-level call logging, confirmation transitions/history and a small real-record summary. No mandatory assignment, permanent ownership, follow-up scheduler, Calling Now, ingestion/import or dashboard was added. See `step-4.md` for API, permissions, counting policy and manual instructions.

## Actual local checks

- `npm test`: 13/13 pass, including the real SQL migration/functions/RLS with synthetic Auth contracts; required-field/spoofing checks; three-caller attribution; repeated/inline/cancel/reconfirm logic; transaction rollback; stale versions; earlier bootstrap/lead/Team/manual invitation regression.
- `npm run typecheck`: pass.
- `CRM_NEXT_DIST_DIR=.next-calls-check npm run build`: pass.
- Actual production browser bundle scan: pass, 14 JS/map files; privileged server key and Team secret absent.

Local PostgreSQL tests use embedded PGlite and synthetic Auth identity contracts. They are not alone sufficient evidence of hosted Auth or real browser integration.

## Actual live development-project checks

`node scripts/verify-calls.mjs` passed with exit 0 using real Supabase Auth/PostgreSQL, real browser sessions and the isolated production application at localhost:3104. Only newly generated synthetic organizations/users/leads were used. Existing staff passwords were neither requested nor replayed.

Verified:

1. The actual Log Call UI saved a CNP call; two other callers recorded Retry and Confirm through the real API. Result: 3 attempts, 1 unique lead, 1 confirmation event credited to the confirming caller. Reopen/refresh displayed real caller names, time/outcome/notes and summary.
2. Address/ordinary Notes edits generated zero calls. Call notes remained separate. Inline Confirm generated a confirmation event with no fabricated attempt.
3. Replayed original request returned the original attempt even after a later version; changed payload under the same key returned 409. No-op Confirm save added no event. A deliberate later call added an attempt without another confirmation while already Confirm.
4. Cancel/reconfirm preserved first time/caller, updated latest attribution and retained history. Period query returned 2 events but only 1 distinct lead. An OTP answer change did not alter the Confirm status or invent a call/event.
5. Simultaneous Confirm attempts from two callers produced one 201 and one 409, exactly one attempt/event. Concurrent identical request IDs produced one 201 and one replay 200, one attempt. A stale ordinary edit after a call returned 409.
6. A temporary check constraint scoped only to one synthetic lead forced the audit write to fail. The HTTP request failed and call/status/version/confirmation all rolled back. Removing the exact temporary constraint and retrying the same key committed once. The initial verifier incorrectly expected HTTP 503 for this injected check failure; the existing 23514 mapping correctly returns 400. Only that test expectation was corrected; backend protection was not weakened.
7. Analyst and other-organization API/table access were denied. Anonymous APIs, caller/time spoofing, direct protected table mutation and forged RPC fields were denied. Deactivating a synthetic caller immediately denied calls API/RPC access with their still-existing session; reactivation restored the fixture. Admin/Telecaller Team and Admin-access permissions remained intact.
8. Exact synthetic fixtures were removed. Database-side count/hash fingerprints of all existing organizations, profiles, memberships, manual leads/history, statuses/fields, invitations/audit, usernames, bootstrap, calls/confirmations matched; Auth IDs/emails/password fingerprints also matched.

`node scripts/verify-calls.mjs --additional-only` separately passed exit 0 without repeating the main acceptance sequence. A real call-versus-ordinary-edit race returned one success/one 409 without overwritten Notes or phantom attempts. A concurrent summary read returned a coherent before/after status/version/count snapshot. Existing-data/password preservation fingerprints again matched after exact cleanup.

The prior full Step 2/3 live suites were not blindly rerun: their acceptance evidence remains valid, while new call-specific endpoint and session checks were exercised here. Automated regressions were rerun because Step 4 changes the lead schema, status/audit triggers and shared UI.

## Limitations and remaining user verification

No implementation/configuration blocker remains for this local development project. Production hosting/deployment has not been performed. Existing real users' interactive sessions/passwords were not replayed; the user's Step 3 confirmations remain the evidence for those real accounts. The user has not yet manually exercised Step 4 with their own test lead; exact steps are in `step-4.md`. This does not invalidate the separate successful synthetic live acceptance run. No Step 5 or additional module was started.

## Subsequent user acceptance (before Step 5)

The user subsequently accepted Step 4 manually: call logging survives refresh, attempts count correctly, confirmation history remains accurate, and repeatedly saving Confirm adds neither attempts nor confirmation events. This supersedes the earlier pending manual-verification note above. Step 5 evidence is maintained separately in `step-5-status.md`; the historical Step 4 test record remains unchanged.

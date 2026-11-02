# Step 5 acceptance and verification record

Date: 2026-11-02, Asia/Kolkata. Development Supabase project: `mwpryrxmrdxgibgsetir`.

## Accepted prerequisite and scope

The user's Step 4 manual acceptance is preserved: calls persist, attempts count correctly, confirmation history is accurate and repeated Confirm saves create no extra attempts/events. Those manual checks were not requested again. Existing code, AGENTS.md, migration ledger, Step 1–4 acceptance records and CRM PDF were reviewed. Only Step 5 callbacks/in-app reminders/advisory Calling Now were implemented. No external notification, worker, ownership lock, ingestion, analytics dashboard or later module was added.

## Applied migrations and preservation

Applied to the real configured development project using the existing TLS-verified operator and checksummed versioned migration ledger:

1. `202611020012_follow_ups.sql`
2. `202611020013_calling_presence.sql`
3. `202611020014_follow_up_membership_races.sql`

No manual migration/configuration step remains for this project. Applied Step 1–4 SQL/checksums were not edited. Migration 014 adds membership locks so concurrent deactivation cannot race an already-authorized presence write or active-assignee decision. It changes function definitions, not existing records.

Before/after migration fingerprints for existing organizations, profiles, memberships, leads/edit history, statuses/fields, invitations/audit, usernames, bootstrap state, calls/confirmations and Auth IDs/emails/passwords matched. Live test cleanup deletes only newly generated synthetic UUIDs/organizations/users. Final live-run fingerprints, including new callback/history/presence/receipt tables, matched their baselines. No manual records or passwords were reset/recreated.

## Actual local verification

- `npm test`: 15/15 passing. Embedded PostgreSQL/PGlite applies the complete migration chain and exercises callback lifecycle/history, retry keys, stale revisions, assignment/role/organization denial, IST boundaries/counts, atomic call/callback rollback, private tables, session/tab/generation command ordering, expiry/deactivation and Step 1–4 regressions.
- `npm run typecheck`: passed.
- `CRM_NEXT_DIST_DIR=.next-followups-check npm run build`: passed, including new API routes and protected Follow-ups page.
- `CRM_NEXT_DIST_DIR=.next-followups-check node scripts/check-browser-secrets.mjs`: passed; 15 actual browser JS/map files checked, configured privileged key and Team server secret absent.
- No lint script/configuration exists in this repository; lint was not falsely reported as run.

Local SQL tests use a synthetic Auth/session contract and do not substitute for hosted Auth/browser evidence below.

## Actual live development verification

`node scripts/verify-follow-ups.mjs` passed with exit 0 against the real Supabase Auth/PostgreSQL project and isolated production app at localhost:3105, using disposable identities in two synthetic organizations and independent headless browser contexts.

Verified:

1. Actual callback UI: schedule → refresh → reschedule/assign → refresh; a second authorized caller completed the callback. A separate callback was cancelled. All three history revisions preserved readable old/new times, notes, assignment, state and actor. Original lead version, call count and confirmation count remained unchanged by standalone callback work.
2. IST midnight edges: immediately before midnight, exact start of day, immediately before next midnight and exact next midnight produced correct Due Today/Upcoming boundaries and Overdue counts. My Follow-ups and shared access worked. Pagination returned 20 rows on the first page with no duplicate/missing IDs on page two.
3. Concurrent identical request UUIDs returned one 201 and one replay 200 with the same callback ID. Changed-payload key reuse returned 409. Concurrent different edits to one revision returned one 201 and one 409, with only one new history revision. Inactive, Analyst and cross-organization assignees were rejected.
4. Actual Log Call UI with optional callback committed Confirm + attempt + confirmation + audit + callback together. Duplicate concurrent call/callback submissions added one call and one callback. Existing pending callbacks remained pending across Confirm and Cancel; OTP stayed independent.
5. An exact synthetic-lead-scoped temporary history trigger forced callback history failure. The call/status/version/confirmation/callback writes all rolled back. Removing that exact trigger and retrying the same request committed once. No manual row matched the fault trigger; trigger/function were removed.
6. Two independent browser sessions saw both callers' names/start times. One user's Stop did not clear another user. Same-session second-tab isolation was exercised through the real API using a separate tab ID; the two caller displays were verified in actual independent browser contexts. Private Auth session/generation IDs were absent from returned presence lists. Stale commands were rejected and heartbeat could not resurrect a stopped/expired indicator.
7. A browser context was closed without a guaranteed unload Stop; after an actual 65-second wait the server's 60-second lease was no longer visible. This used real elapsed time, not an artificially shortened production TTL. Existing-session deactivation cleared indicators and denied writes; reactivation did not restore them. Logout cleared the current session indicator and its APIs then returned 401. Presence actions did not add calls/confirmations.
8. Anonymous, Analyst and other-organization API/RPC/RLS requests failed; direct callback writes and presence-table reads failed. Client caller/organization spoofing was rejected. Analysts' Follow-ups page showed access restricted; Team Admin/Telecaller boundaries remained correct.
9. Exact fixture cleanup completed. All pre-existing operational and Auth/password fingerprints matched.

The first browser runs found unstable accessible labels on prefilled callback selectors/textarea; those were fixed rather than skipped. Successful callback saves now close the editor so the next edit loads its latest revision; switching leads resets callback form state. The final built application was retested with `node scripts/verify-follow-ups.mjs --ui-only`, which passed the affected lifecycle/refresh/shared completion/cancellation flow, rendered before/after history with both callers and old/new notes, actual zero-pending reminder display, and preservation checks. The full permissions/TTL/atomicity checks above had already passed and their backend implementation did not change during that targeted UI correction.

`CRM_NEXT_DIST_DIR=.next-followups-check node scripts/verify-calls.mjs --additional-only` separately passed exit 0 against the final production build. Call-versus-ordinary-edit concurrency still returned one success/one 409 without lost Notes or fabricated attempts; call-summary reads remained coherent. Existing-record/password fingerprints matched after exact cleanup. This regression was justified because Step 5 wraps the Step 4 call RPC. Prior manually accepted invitation/login/lead work was not blindly replayed; its acceptance records remain in force and automated SQL/auth/role regressions were rerun.

## Limits and pending manual verification

No configuration or implementation blocker remains in this development project. Production deployment has not been performed. These are automated **live development** checks with synthetic users/leads, not a claim that the user's own staff have manually accepted Step 5. Their exact manual steps are in `step-5.md`.

Physical device sleep, every mobile browser and a real network cable disconnect were not separately tested. Closed-browser/disconnected-context expiry, real Auth logout and membership deactivation were verified. Hidden/offline tabs do not send heartbeats; indicators/reminders can remain visually stale until the next poll. Calling Now is advisory and never locks a lead. Reminders only appear while using the app; there is no closed-app notification guarantee.

Generated `next-env.d.ts` and unrelated editor whitespace-only changes were preserved outside the Step 5 commit. Secrets/local environment/build output are excluded. Git delivery is reported with the actual commit and verified remote status in the final response. Stop at Step 5.

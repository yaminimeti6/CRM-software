# Step 5: follow-ups, in-app reminders and advisory Calling Now

Scope: only callbacks/reminders and calling presence. No scheduled worker, external notifications, ownership lock, analytics dashboard or later module.

## Behavior and counting

- Admin, Manager and Telecaller share organization callbacks. Creative Analysts have no lead/callback PII or operational writes. All APIs verify active authenticated membership; protected database functions derive organization and caller from `auth.uid()`, not form values.
- Schedule from a lead's **Follow-ups** action, or opt into a callback while explicitly recording a call. Callback time is entered/displayed in Asia/Kolkata; stored as `timestamptz` in UTC. Creator, call time and history timestamps are server recorded.
- Optional assigned caller must be an active Admin/Manager/Telecaller in this organization. Assignment is a reminder preference, never ownership. Every authorized caller may still open/call/edit the lead or callback. Historical inactive assignees are preserved and shown; reassign/unassign before saving changes.
- Reschedule/edit, Complete and Cancel preserve before/after schedules, notes, state, assignment and actor in append-only history. Completed/cancelled callbacks cannot be reopened/rewritten; deliberately schedule a new callback instead.
- **Confirm or Cancel on a lead leaves all its pending callbacks pending.** A warning shows its current lead status. Staff explicitly completes/cancels an unnecessary callback. Neither action silently resolves or deletes anything.
- Callback and presence operations never update lead status/version, create call attempts, or create confirmation events. Only Record Call creates an attempt. Inline Confirm retains Step 4's confirmation-only behavior. An opted-in call+callback is one database transaction with status, audit and confirmation; any failure rolls back everything.
- Due Today = pending callbacks in `[00:00 IST, next 00:00 IST)`. Overdue = pending callbacks strictly before server now, including earlier today. Upcoming = pending callbacks at/after next IST midnight. Due Today and Overdue overlap: do not sum these counts. Pending is the unique pending row count. Counts and paged rows use the same database statement/snapshot.
- My Follow-ups = assigned to the signed-in caller OR unassigned callbacks created by them. It is a filter, not an access boundary. List filtering/counting/pagination is server side (20 rows/page), ordered by due time then ID.
- Reminders on All Leads and Follow-ups show organization-wide Due Today/Overdue counts and poll about once per minute while open. These are **in-app reminders while using the app**. No email, SMS, browser push, closed-app delivery or background job.

## Retry/concurrency guarantees

Frozen form request UUIDs are stored in private database receipts per organization/actor. Double-clicks/retries of the same payload return the original result. Reusing a key with different details or a different operation fails. Review current list/history before abandoning an uncertain submission and creating a deliberate new one.

Callbacks use independent revisions and lead-scoped row locks; concurrent edits return one success and a 409 conflict instead of overwriting. Conflicts require reload/reopen. Atomic call+callback also uses Step 4's lead version, so concurrent ordinary edits/calls remain protected. No change to OTP semantics.

## Calling Now lifecycle

Start Calling is explicit and records the authenticated caller and server start time. Other callers see names and IST start times; calling remains available. Each browser tab/mount has a random tab ID and generation, within its actual server-verified Auth session. The server sets a **60-second lease**; visible/online tabs send heartbeats about every 20 seconds; visible lead tables refresh warnings about every 10 seconds.

Stop affects only the requesting caller's session/tab/generation. A separate tab or another caller remains visible. Monotonic command sequences and retained tombstones reject delayed starts/stops; heartbeat cannot create, restart or revive an expired/stopped indicator. Private session/generation IDs are not returned in lists. Expired entries are ignored at read time; no cleanup worker is required. These tombstones are operational metadata, not calls/history.

Unmount/navigation sends best-effort Stop. Hidden/offline tabs stop heartbeating; closing a browser/disconnect without an unload request clears within 60 seconds of its last successful heartbeat. Return to an expired tab requires explicit Start again. Logout stops the current Auth session's indicators before signing out; list queries also require the underlying Auth session to exist. Deactivation or removal of operational role clears indicators immediately and reactivation does not restore them. Browser sleep/network delays can make warnings temporarily stale until the next poll; this is advisory, never proof that no one is calling.

## Database/API

Versioned migrations (do not edit applied checksums):

- `supabase/migrations/202611020012_follow_ups.sql`: callback/history tables, RLS, private idempotency receipts, strict RPCs, same-snapshot list/counts and atomic call/callback wrapper. Existing Step 4 function moved intact to a non-client-executable private function; applied Step 4 migrations remain unchanged.
- `supabase/migrations/202611020014_follow_up_membership_races.sql`: shared actor/assignee membership locks keep active-role decisions stable through callback/presence transactions and serialize concurrent deactivation.
- `supabase/migrations/202611020013_calling_presence.sql`: session-bound presence table (no client table grants), 60-second Start/heartbeat/Stop RPCs, aggregated safe reads, logout and membership invalidation.

Apply using the existing configured operator command `node scripts/migrate.mjs`; it checks migration checksums and does not bootstrap/reset accounts. No manual SQL/password sharing is needed when that command succeeds. Production deployment remains separate.

Routes: `GET/POST /api/follow-ups`, `GET /api/follow-ups/staff`, `GET /api/follow-ups/:id/history`, `GET/POST /api/calling`. Existing `POST /api/leads/:id/calls` accepts optional validated `follow_up`; without it the previous flow is preserved. Writes require same origin and capped JSON bodies. Protected tables permit only scoped reads (presence table has no direct client reads) and RPC-mediated writes.

## Manual verification

1. Sign in as active Admin/Manager/Telecaller; open All Leads and choose your test lead → **Follow-ups → Schedule callback**. Choose IST time, optional notes/active caller or Unassigned → Save callback.
2. Refresh, reopen the lead/Follow-ups page. Check saved time/notes/assignee. Use **Edit / complete / cancel** to reschedule; open **Callback history** for old/new schedule and actor.
3. Check Due Today, Overdue, Upcoming and My Follow-ups. Complete one callback and cancel a different one; view their preserved histories under All states.
4. On the lead use **Log Call**, select outcome, optionally check **Schedule a callback with this call**, fill callback details, then **Record call**. Inspect actual call count and separate callback. Ordinary scheduling must not change attempts/confirmations.
5. Use two signed-in browsers/callers on the same lead. Start Calling in each: both names should appear within about 10 seconds. Stop one: the other stays. Close the other browser without Stop: wait at least 60 seconds and refresh the first. Start/Stop must not change attempts.
6. Change a test lead to Confirm/Cancel: pending callbacks must remain pending with a warning. Explicitly complete/cancel them if appropriate. Do not use real customer calls as synthetic tests.

Actual evidence, limitations and preservation checks are recorded in `step-5-status.md`.

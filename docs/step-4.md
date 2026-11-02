# Step 4 — explicit calls and confirmation tracking

## Scope

Implements only Crm.Pdf sections 7–9, 21–22 for shared open calling, explicit attempts, confirmation transitions, audit and safe concurrent edits. The PDF is a requirements source, not permission to implement its remaining roadmap. No assignment/ownership, Calling Now, follow-up scheduling, ingestion/import, analytics dashboard or other module was added. OTP/quiz answers remain independent of calling status.

## Data and protected transitions

`202610310010_calls_confirmations.sql` adds append-only `call_attempts` and `confirmation_events`, protected first/latest confirmation timestamp/user fields, status reporting categories, and call/edit audit classification. Migration 010 was already applied when this task's workspace was inspected; it was not edited or reapplied. Migration 011 was pending and adds a consistent locked summary snapshot; it was applied using the existing checksum ledger. Existing accounts/manual leads were not backfilled or rewritten.

`POST /api/leads/[id]/calls` accepts only version, request_id, status_id, optional reason and notes. Caller and organization come from the verified active session; time comes from PostgreSQL. Admin/Manager/Telecaller can work any lead in their organization; Creative Analyst has no customer/call/history access. Clients cannot insert/update/delete attempts or confirmation events directly. `GET /api/leads/[id]/calls?page=1` returns a lead-scoped summary and paginated attempts/events, with same-organization caller display names.

`log_lead_call` takes a transaction-scoped request lock followed by the lead row lock. It verifies the supplied lead version, inserts the attempt, updates the status/version and invokes the shared transition/audit triggers in the same transaction. Any failure rolls back all four effects. All permitted inline status transitions use that same database confirmation trigger. Ordinary address/Notes/status edits never manufacture attempts. A repeated no-op Confirm save creates no event; explicit later calls get their own attempt even if their outcome remains Confirm.

An idempotency key is unique within organization/authenticated caller. The exact same request/payload returns its original result, including after later lead edits; changing the payload under that key is a conflict. The client freezes its request and disables concurrent submissions; retry reuses it. A deliberate later call requires Log another call and generates a new ID. Starting a new submission after an uncertain response has an explicit warning. A stale call or ordinary edit returns HTTP 409 instead of overwriting newer data. The call-summary reader holds a shared lead lock so its current status/version and counts agree.

## Counting policy — separate quantities

- Recorded attempts: count of explicit `call_attempts`. Per-caller unique leads attempted use distinct lead IDs, not attempt rows.
- Currently confirmed leads: distinct leads whose current status category is `confirmed` now. Cancellation removes a lead from this current count, without deleting prior events.
- Confirmation events in a period: count of transitions from a non-confirmed category into confirmed with `confirmed_at >= start AND confirmed_at < end`. Reconfirmation after cancellation creates another event. Re-saving Confirm does not.
- Distinct confirmed leads in a period: count distinct lead IDs across those period events, even if there are several events or callers. Distinct ever-confirmed leads similarly count each lead once across its full history. The small lead summary therefore shows 0 or 1 distinct confirmed leads.
- Caller event credit belongs to the authenticated user who made that particular transition, whether by Log Call or an inline status edit. A caller's unique confirmed-lead count uses distinct lead IDs for their valid events. Do not sum caller unique counts to obtain the organization's unique-lead total; reconfirmation by a different caller can overlap.
- First confirmed timestamp/caller never change on cancellation/reconfirmation. Latest confirmed timestamp/caller change only on a new transition into Confirm. Creation cohorts, current status and OTP state are separate; never substitute lead creation time for confirmation time.

Times are stored as timestamptz and displayed in Asia/Kolkata (IST). Future period boundaries must be converted from the requested local dates to UTC instants; use a half-open interval. No dashboard or period-report module is built here.

Example: Nidhi CNP, Salma Retry, Bhoomi Confirm = 3 attempts, 1 distinct lead, 1 confirmation event credited to Bhoomi. Cancel then Nidhi inline Confirm = 2 total events, still 1 distinct confirmed lead, unchanged first attribution to Bhoomi and latest attribution to Nidhi; inline edits add no call.

## Manual steps

1. Sign in as active Telecaller/Manager/Admin. Open All Leads and use a synthetic test lead, not a customer's record.
2. On its row click **Log Call**. Choose CNP or Retry, enter optional Call reason / Call notes, then **Record call**.
3. Check Recorded attempts, caller, server time in IST and the outcome/notes. Refresh/reopen: the attempt remains. Ordinary lead Notes remain separate.
4. For a deliberate subsequent call choose **Log another call**, select Confirm and Record call. First/latest confirmation details and event count update once.
5. To confirm without logging a call, choose Confirm in the row's status dropdown and click **Save row**. This creates a valid inline confirmation event but no invented call.
6. Save Confirm again: no extra event. Set Cancel and Save row, then Confirm and Save row: cancellation is retained in History, another confirmation event appears, and the distinct-lead count stays 1.
7. If a request's result is uncertain, use **Retry same call** rather than starting another attempt. For a 409, reload/review newer data before starting a deliberate new submission.

The browser normally running this app may need a refresh to load the new frontend. No password reset or new Admin setup is needed.

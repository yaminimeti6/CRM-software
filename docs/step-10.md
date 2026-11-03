# Step 10: Management dashboard and staff performance

Scope: `/app/performance`, linked from All Leads. Read-only; Steps 1-9 remain intact, Step 6B is pending and Step 11 is not started. No Meta, revenue, rankings, targets, duration, attendance or scheduled reporting.

## Access and query design

Active Admin/Manager see organization-wide results. Active Telecallers see only server-recorded activity attributed to their authenticated identity; organization received/cohort/current-confirmed metrics are N/A. Pending callbacks in self scope are assigned to that caller, or unassigned and created by that caller. Creative Analysts and inactive/deactivated users are denied. Self scope cannot select another actor or open organization lead/current-state breakdowns. Role/membership is checked on every server request and again in the database RPC, not trusted from the submitted report definition. Existing shared operational table RLS is unchanged; no additional direct table grants or customer/staff Auth identifiers are exposed. Staff drilldowns use an opaque organization-bound key, checked against self scope in SQL.

Migration `202611030023_management_performance.sql` adds a read-only, fixed-search-path `performance_report` RPC and organization/time/actor indexes. The RPC derives organization and actor from Auth, rejects unsupported definition fields, and scopes each base query before aggregation. Private schema stays private. Existing source/snapshot filter options are reused; only catalog/source choices are returned, not caller/Auth identifiers. Foreign snapshot IDs produce no matching data, never another organization's data.

A single statement snapshot builds independent materialized calls, confirmation and callback-history sets. One-to-one receipt joins preserve configured attribution. Totals cover the full filtered dataset; calls are not multiplied by callback or confirmation joins. Staff pages contain 20 actors, activity pages 25 rows, with deterministic UUID tie breakers and independent full totals. Daily trends have at most 366 inclusive dates. Existing snapshot option-list bounds are reused; no claim of a warehouse-scale analytics engine or database query benchmark is made.

## Exact counting policy

All dates are Asia/Kolkata. Both chosen calendar endpoints are included: midnight on From is inclusive, midnight after To exclusive. Today includes today; Last 7/30 Days include today plus the preceding 6/29 dates. Custom ranges are 1-366 days. Invalid dates are rejected on client/server and in SQL.

| Display | Timestamp and scope |
| --- | --- |
| New leads received | `leads.created_at` within selected dates: CRM received/import cohort, not historical source time. Repeat inquiries are separate records; accepted retries reuse a lead. |
| Recorded attempts / outcomes | `call_attempts.attempted_at`, server-recorded period activity. Outcome label is frozen on the attempt. Edits, Start Calling and callback operations produce no attempts. |
| Distinct leads called | Distinct lead IDs among period attempts across all permitted callers. A distinct-lead drilldown shows the latest matching period attempt per lead; summed caller distinct counts can exceed organization distinct counts. |
| First-time confirmed leads | First observed CRM `confirmation_events` record for each lead across all time, selected by immutable lead version; count it only if its `confirmed_at` is in the period. Credit its original server actor. |
| Confirmation events / reconfirmations | Every period event / period events after that lead's first observed CRM confirmation. Cancel/reconfirm retains history and never creates another first event. Inline Confirm may add an event without a call. |
| Currently confirmed | Current lead status category at refresh across all attribution-matching leads, independent of selected period. Includes imported historical Confirm; it does not invent observed events, dates or caller credit. Management only. |
| Received-cohort observed conversion | Leads in selected CRM-received cohort that have an observed first CRM confirmation by refresh / all leads in that cohort. Later-than-period confirmations count as of refresh; later cancellation does not erase observed conversion. N/A if cohort is empty or self scope. Imported Confirm without events does not count as observed conversion. |
| Pending / overdue callbacks | Current pending records across all matching leads, regardless of selected dates; overdue means `due_at < refreshed_at`. Self responsibility follows the assignment/unassigned-creator rule above, without assigning lead ownership. |
| Completed callbacks | Period `follow_up_history.occurred_at` completion events, credited to the completing actor, not the assignee. Staff scheduled/rescheduled/cancelled columns use their corresponding history actions and actors. |
| Daily trends | Period CRM-received leads, explicit attempts, first observed confirmations and all confirmation events grouped by IST day. No multiplication from child records. |

A historical imported Confirm has unknown historical confirmation time/caller and fabricates neither event nor credit. If a later genuine CRM transition occurs, first credit means first *observed CRM event*, not an invented historical first confirmation. Staff who later become inactive/former retain their actual recorded activity and name; unavailable profiles receive a safe former-staff label. No auth UUID is shown as a caller name.

Configured brand/product/page IDs come only from immutable `lead_ingestion.source_snapshot.configured_attribution`, source from its server-bound source ID. Unknown remains unknown. Renames/archive do not rewrite historical attribution; raw advertising identifiers and historical source timestamps do not override catalog filters. No existing lead is inferred or backfilled.

Each metric has a supporting bounded breakdown (calls, distinct called leads, first events, reconfirmations, all events, current Confirm, received cohort, pending/overdue, completion history). Callback activity also shows scheduling/reschedule/cancel history. Current/cohort breakdowns do not pretend to have a caller actor. Lead links open the existing shared lead search, not permanent assignment.

## Refresh and states

Loading, errors, N/A/empty results and last-refreshed IST time are explicit. Existing organization Realtime/recovery notifications trigger a debounced authorized read for the **applied** filters. Draft dates/attribution inputs stay untouched. Role changes/deactivation are rechecked in APIs/RPCs; denied subscriptions clear performance. This is in-app refresh while the page is open, not a background-job or scheduled report. Browser/network failures show an error rather than fabricating zeros. Refresh controls never save operational data.

## Running and using

Open `http://localhost:3000/app/performance` after normal login. Choose a preset or inclusive IST dates, optionally choose snapshot filters, then Apply report filters. Read metric definitions before comparing period events with current state. Use each card's activity link or a staff row's calls/confirmations/callbacks buttons, then page through supporting records. A Telecaller sees self-only activity. Unapplied filters are labelled and not silently applied by incoming updates.

Verification commands: `node scripts/verify-performance.mjs` (current production build defaults to `.next-performance-check`), `node --experimental-strip-types --test tests/performance.test.mjs tests/performance-input.test.ts`, `npm run typecheck`, `CRM_NEXT_DIST_DIR=.next-performance-check npm run build`, and the existing browser/staged secret scanners. Privileged dev fixture configuration remains in ignored local files; do not send credentials or commit browser sessions. See `step-10-status.md` for actual executed evidence and limitations.

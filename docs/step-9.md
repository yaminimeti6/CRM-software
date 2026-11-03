# Step 9: advanced lead filters, personal views and Realtime

Extends `/app` All Leads. Steps 1–8 remain in place. Step 6B (live Shopify/Google Sheet/website integration) is pending; Step 10 is not included.

## Query contract

`POST /api/leads/search` accepts a complete validated definition and page. Legacy `GET /api/leads?q=...&status=...&page=...&size=...` remains supported through the same authoritative search. Filtering, count, sort and page use one stable database snapshot and the entire authorized organization dataset. Results are at most 50 rows; page is bounded. Sort is CRM created time, CRM updated time or case-insensitive name, with UUID in the same direction as the unique tie-breaker. Default is created descending / UUID descending. No client-side page-only filtering.

Different groups are ANDed; selections within one multi-select group are ORed. Each quiz predicate is ANDed, including two predicates on the same field. Quick single-status and page-size controls apply immediately for compatibility; advanced settings use Apply filters. Filter changes reset to page 1. Realtime refresh retains page, even if that page becomes empty after results shrink; use Previous rather than an implicit jump.

Created/updated ranges use inclusive Asia/Kolkata calendar days (lower midnight inclusive, next-day upper midnight exclusive). These are CRM receipt/creation and modification timestamps, not historical source timestamps. Recorded caller means any real explicit call attempt by that authenticated caller. Confirmation caller means any actual confirmation event, not a legacy imported caller string and not merely current Confirm status. CRM date ranges do not constrain the call/event time. Multiple matching attempts/events use EXISTS and never duplicate leads/counts.

Callbacks: pending means at least one pending callback; overdue means pending and due before the current server instant, matching Step 5; none means no pending callback. Completed/cancelled callback history is preserved. Repeat distinguishes recorded repeat, recorded non-repeat and unknown/manual (no ingestion receipt).

Configured brand/product/page filters use saved snapshot UUIDs, not editable names or raw advertising fields. Source uses its stable UUID. Version uses the existing stable `(source UUID, exact version key)` identity, including legacy unversioned/old import keys; this is independent of renamed catalog labels. Unknown attribution remains explicitly selectable. Archived IDs remain valid filters. Admin options include unused catalog/source records so a view can watch future leads; other operational staff see references already present in permitted lead snapshots. Options are bounded to 500 per group; selected identities beyond the list remain visible/retained, never dropped.

## Dynamic text predicates

Field IDs come from the existing `quiz_columns()` identities: manual/unclassified, or organization + source + version + key. Predicates match only that field's applicable scope. Identical labels across sources/versions do not merge.

- equals / not_equals: case-sensitive exact text; not_equals requires a present key.
- contains: case-insensitive literal substring (no wildcard/regex execution).
- missing: key absent within the applicable scope.
- empty: key exists and value is exactly the empty string.
- present: key exists, including an empty string.

No numeric/date inference or comparisons for arbitrary answers. Up to five predicates, 20 IDs per group, 100 selected columns and 80-character literal name/mobile search. Values and sort settings are parameterized/allowlisted in both application and database validation. Invalid or unavailable fields/references produce an explicit error, not a broader query. Invalid filter results clear the table rather than relabelling earlier broader results.

## Personal saved views

Active Admins, Managers and Telecallers can create/apply/rename/update/delete their own views. Owner and organization derive from the authenticated session; RLS and protected functions enforce both, with no Admin override for another person's views. Creative Analysts get no customer search/view access. No shared/team views.

Definitions persist applied filters, sorting, selected quiz columns and page size. Applying a view starts on page 1; a view UUID in the URL reapplies it after refresh. Login/logout preserves the server-side personal view list; select the view again after a fresh login. Definitions/PII are not put in the URL or local storage. Rename preserves the old saved definition; Update replaces it with the current applied definition. Names are unique per owner/organization; repeated uncertain creates conflict instead of creating duplicate names. Revision/409 checks prevent stale updates/deletes, including null-revision direct RPC attempts. A saved view never grants extra access.

Archived references remain usable. Missing fields/columns stay explicit and must be deliberately removed before updating/applying the definition. An inaccessible saved-view URL does not silently fall back to broader results. Clear filters is an explicit action and removes the saved-view URL association.

## Realtime and edit safety

Only `public.lead_change_signals` is added to the existing Supabase Realtime publication. Its payload is organization UUID + opaque revision UUID; it contains no lead ID, name, phone, notes, answers or access token. Trusted database triggers update this row on relevant leads/receipts/calls/confirmations/callbacks/field/catalog/membership changes. No client can mutate signals directly. Signal SELECT and Realtime delivery require active operational membership in that organization.

`GET /api/leads/events` verifies the server-side staff session and subscribes with that user's JWT and the publishable key, never a service-role subscription. The browser gets same-origin SSE status/invalidation frames, not the JWT or raw lead payload. It refetches through authorized search endpoints. Unsubscribe/cancel closes the channel; streams rotate after 50 seconds to reauthorize. Server checks membership and authoritative revision every 10 seconds for deactivation/reconnect recovery. Mutations/reads enforce membership immediately; an already-open indicator can take up to the next check to show revocation. Revocation clears customer UI and closes the subscription.

Status distinguishes opening, actually subscribed, reconnecting, unavailable/recovery and revoked. The server's revision checks recover missed changes if Realtime is unavailable; that fallback is not labelled a connected Realtime service. On reconnect, an authoritative read/check recovers missed events. Multiple notifications are debounced.

Dirty rows, add-lead edits and open call/callback forms block automatic replacement. Updates available offers explicit refresh/discard; cancelling keeps edits. A response that began before editing also rechecks protection before applying data. Saving one row preserves other dirty rows. Existing lead-version 409 behavior remains in force. Filters/pages/views ask before deliberate discard. Active filters, page/sort and selected columns survive notifications. Start Calling/Record Call/confirmation semantics are unchanged.

## Development setup and manual synthetic acceptance

Migrations `202611030021_lead_views_realtime.sql` and `202611030022_lead_filter_options.sql` use the existing checksum/TLS migration workflow. The second corrects reference-label aggregation and refresh signals/options without changing applied SQL. Realtime requires the Supabase service and publication entry for `lead_change_signals`; the verifier checks both configuration and actual minimal event delivery. SSE streaming must not be buffered by a later production proxy; production deployment is not claimed by local checks.

1. Open All Leads in two independent authorized sessions in the same organization. Use existing test staff; do not share passwords in chat.
2. Add synthetic `S9 Test Lead`, mobile `000123456789`, optional question `S9_Question` = `Blue`. Apply search `S9`, statuses New/Retry, today's created IST range and the exact quiz field equals `Blue`. Try Unknown configured attribution for manual leads. Use rows/page 5 and inspect totals/page ordering.
3. Select the quiz column, save personal view `S9 Blue`, refresh and log out/in, then apply it again. The other staff account must not see this personal view. Rename/update/delete only the view, not leads.
4. In session A edit the test lead; clean session B should update. Start typing unsaved Notes in B, then save a newer change in A. B must show Updates available and retain its text; saving stale B must get a conflict. Explicit refresh/discard then shows authoritative data without changing active filters.
5. Keep a call/callback form open with unsent text while A edits the lead. It must stay open. Go offline/online in B and check honest connection status and recovery. Merely opening/editing these forms must not count as a call or confirmation.
6. Use the Step 8 synthetic catalog/source/version records to test configured filters, archived references and same-name questions under distinct sources/versions. No live Shopify/Sheet changes are needed.

Verification evidence and limitations: [step-9-status.md](step-9-status.md). Local commits only; push requires the user's explicit end-of-project request.

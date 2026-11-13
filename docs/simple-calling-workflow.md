# Simple daily calling workflow

## Staff workflow

1. Open `/app`. The default **Simple calling view** uses the existing table: one inquiry per row, with frozen Name/Mobile and the configured columns. Cards have been removed from this view at the owner's request. Website/landing page and reported traffic source remain separate; missing values show Unknown. Additional order details remain in the side panel.
2. Choose **New inquiries**, **Today's follow-ups**, **Overdue follow-ups**, or **All inquiries**. Search by name, mobile or reference and optionally choose an order status.
3. Select **Open order** to read the order and submitted answers. Call with your phone; opening an order does not place or count a call.
4. After an actual attempt, select **Save call result**, deliberately choose the result and optionally add notes. Select **Call again later** to save the next call date with the same call request.
5. If saving is uncertain, use **Retry saving**. It retains the original request ID and payload. Check **Previous calls & confirmation history** and refresh it before deliberately starting another attempt.

The Status dropdown is always visible in each table row, including outside **Edit row**. Choosing another status saves through the existing version-checked lead update API. While saving, the dropdown is disabled; a failed/stale save restores the previous displayed status and shows the error. In Edit row mode, the chosen status remains part of the draft until Save row. Changing status directly does not record a call attempt. Existing confirmation-transition rules still apply.

**Schedule follow-up** also remains available without recording a call. Completing or cancelling a follow-up does not record an attempt. Existing confirmation and count rules remain unchanged.

## More tools

The compact table and frozen Name/Mobile columns are always visible. Advanced server filters, saved views, manual entry, column settings and authorized exports remain under **More tools**. The choice is saved for the current browser/account. Saved-view links open the advanced controls. Additional filters are explicitly flagged in the simple view and can be reviewed or cleared.

The default detail tabs are Order, Calls, Follow-ups and Answers. **More details & history** reveals Source and History; order references are expandable. Original dynamic website answers are retained. Reports and Admin/Settings are expandable sidebar folders; existing role restrictions and Admin/Invite Staff functionality remain intact.

## Verification, 2026-11-13

- Optimized local preview built and started at `http://localhost:3000`; TypeScript passed; all 58 existing tests passed.
- `node scripts/verify-simple-calling-ui.mjs`: real local read APIs; simple default; separate source labels; three persisted themes; four/six detail tabs; call/follow-up draft across tabs; required deliberate result; two intercepted uncertain attempts with identical payload; history refresh without another attempt; dismissed close guard retains the draft; actual server New queue; today's follow-up navigation; 390px layout without horizontal page overflow.
- `node scripts/verify-all-leads-ui.mjs`: existing advanced table, frozen columns, six tabs, draft/close guards, intercepted call/callback retries and stale edits, actual server filters and preservation passed.
- `node scripts/verify-daily-workflow.mjs`: existing advanced queues, today's/overdue follow-ups, first-result Calls drawer and mobile/themes passed.
- `node scripts/verify-crm-theme-rollout.mjs`: 33 authenticated page/theme combinations, existing read APIs, shared navigation, public auth themes, mobile drawers and unauthenticated redirects passed.
- Browser checks used the existing retained demonstration inquiry and a temporary local session for the existing Admin. No new leads/users, no actual call/follow-up writes. All public-table fingerprints and existing account/password fingerprints were unchanged. Intercepted save errors verify UI recovery, not a new successful persisted call.
- Screenshots and machine-readable evidence are private local artifacts in `.cache/simple-calling-ui/`.

Live website capture into CRM and the real Sheet remains pending. Staff usability acceptance still requires the owner's review of this simpler screen. No hosting/deployment or GitHub push is part of this change.

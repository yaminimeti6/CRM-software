# Shared CRM workspace design

The PDF remains the feature specification. Frappe CRM and Twenty are visual/workflow references, not replacement backends or authorization to add unrelated features. Existing database records, role policy, call counting and integrations remain authoritative.

## Shared structure

- A compact sidebar, active navigation and breadcrumb bar are shared across every authenticated route. Existing role-specific navigation and page authorization are preserved.
- Appearance is a top-bar menu, retaining Light, Dark and Mixed preferences. Mixed uses dark navigation with a light work area. Login and invitation screens use the same visual language.
- Lists use a flat workspace with a compact toolbar and bordered table. A lead remains one row, with frozen Name/Mobile and direct Status selection. No card list replaces it.
- The lead record workspace separates Customer/Order from Recent activity/Next follow-up. Existing Calls, Follow-ups, Answers, Source and History remain available with their existing APIs and draft guards. Opening a form is distinct from saving a call.
- Reports use consistent date/filter controls, metric blocks, charts and tables. Additional performance filters are expandable and show the number selected; filter values and backend report definitions are preserved.
- Admin, invitation, source/catalog, import and workspace-setting controls retain their existing behavior, with common form/table spacing and responsive layout.

## Existing pages covered

| Area | Existing routes |
| --- | --- |
| Daily calling | `/app`, `/app/follow-ups` |
| Reports | `/app/performance`, `/app/attribution`, `/app/meta-spend` |
| Administration | `/app/team`, `/app/ingestion`, `/app/catalog`, `/app/imports`, `/app/meta`, `/app/settings` |
| Public staff access | `/login`, `/join` |

No new business module, table, migration, customer fixture or external connection is introduced. The new stylesheet is separate from the existing uncommitted stylesheet work; unrelated edits remain excluded from this task's local commit.

## Verification and limits

Use `node scripts/verify-crm-theme-rollout.mjs` for all-page/theme and navigation checks, and `node scripts/verify-telecaller-usability.mjs` for the existing Telecaller record/call/follow-up flow. Business writes are intercepted; save success is simulated. Fingerprints verify unchanged public records and account/password values. Screenshots and machine-readable evidence stay private in `.cache/crm-theme-rollout/` and `.cache/telecaller-usability/`.

This is a locally verified presentation change. Human design acceptance is still the owner's decision. Live website-to-CRM/real Sheet acceptance, real Meta consent/sync, permanent hosting and production recovery remain separately pending. OTP remains optional as requested. No GitHub push or deployment is part of this work.

References: [Frappe CRM](https://frappe.io/crm), [Twenty](https://twenty.com/). Layout and styles here are implemented in this repository; no external CRM account or customer data is copied.

The owner selected Frappe as the primary simplicity/layout reference on 2026-11-16. The existing CRM remains the application: this is not a replacement with Frappe's backend, nor a claim that its email, WhatsApp, telephony or other integrations are installed. Phone links open the user's dialer; only saving a call result records a CRM attempt. Back to leads returns to the existing list and preserves its filter context.

Verified locally on 2026-11-16: optimized preview build/TypeScript, all 60 tests, the advanced All Leads browser regression, the existing Telecaller walkthrough, and 33 authenticated page/theme combinations passed. Every existing authenticated route was also checked at 390px for page-wide overflow and working navigation; login/join themes and unauthenticated redirects passed. Admin/Invite Staff controls remained accessible to the existing Admin. Business saves were intercepted and success feedback simulated; all public-record and account/password fingerprints were unchanged. No new user, lead or actual call/follow-up was created.

Compact row refinement: the table omits last-call/next-follow-up summary lines, price, the extra Reported caption and local-development source URLs. These values remain saved and available in the lead panel; exports and server filters are unchanged. Edit row is available under the ellipsis menu. Received time uses `DD/MM HH:mm` in IST with the full date/year in its tooltip; the panel retains full dates. Narrower default Course/Traffic/Received/Actions widths apply only where no saved width overrides exist. Targeted date/source tests cover the IST year boundary and local-versus-real host distinction.

Further daily-work simplification: All leads is the first queue tab. The status-only counting explanation remains accessible to assistive technology and as a Status tooltip instead of a permanent paragraph. The status legend remains expandable. In a record, More/Less sits beside the tabs; Source/History and their existing keyboard navigation remain available. Quick actions appear on Order, avoiding duplicate buttons on the other tabs. The call form defaults to result, notes and the optional next-call date. Optional reason and status-reference help are under More call options; their values remain mounted and are included in the original versioned/retry-safe submission. No status, permission, API or database behavior is changed.

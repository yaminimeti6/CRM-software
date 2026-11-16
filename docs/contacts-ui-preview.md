# Contacts-inspired All Leads preview

Reference: https://corecrmhub.com/demo/ (Contacts screen, visual reference only).

## Local preview

Open http://localhost:3000/app and refresh. Sidebar primary entry is **Leads**.
Use Appearance in the top bar to choose Light, Dark or Mixed; the existing theme preference persists after refresh.

- Default columns: Name, Mobile, Course / Price, Status, Source, Next Callback.
- Name and Mobile retain desktop freezing. The table scrolls within its own container on narrow screens.
- Search, Filters and Add Lead are at the top. Filters use the existing server-side lead search and do not replace the six-column layout.
- Select a lead to open Order Details, Log Call and Follow-up on the right. More exposes Source, Answers and History without losing drafts.
- Course, price, website, configured landing page, reported traffic and callback come from existing authorized lead data. Missing traffic displays Unknown. Website/landing page remain separate lines from reported traffic.
- Table options retains CSV/XLSX export and saved/custom column layouts. Choose Use saved columns to access the previous editable table and custom answer columns.
- Status changes retain the existing versioned update. Calls are counted only by the existing explicit call-save operation.

## Verification

- Optimized preview build and TypeScript compilation passed.
- Five targeted tests passed: call input validation, navigation permissions/themes, lead-view validation and database filter/pagination/RLS checks.
- `node scripts/verify-contacts-ui.mjs`: browser checks for all six headers, existing order/price/source, callback matching the database, filters, Add Lead form, the three detail tabs, dynamic-answer access, three persisted themes and mobile page containment.
- `node scripts/verify-simple-calling-ui.mjs`: versioned status conflict rollback, existing real-server New filter, today follow-ups, retained drafts, guarded close and identical intercepted call retry payloads.
- Browser checks use a retained inquiry and temporary local sessions for an existing Admin. Business mutations are intercepted; no new main-CRM inquiry, call or callback is saved. All public table contents and existing password hashes are compared before/after.
- Screenshots and evidence: `.cache/contacts-ui/` (local, ignored). These are localhost checks, not live website acceptance.

Live website ingestion and real Google Sheet verification remain pending. No hosting, deployment or GitHub push is included.

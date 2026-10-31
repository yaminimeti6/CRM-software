# Readable lead history verification

Scope: presentation and tightly scoped editor-name resolution only. Audit records,
lead data, staff accounts and existing profile/table permissions are unchanged.

Migration 006 exposes only names of actual actors on an already-permitted lead,
and only for profiles still in the same organization. It does not broaden staff
profile RLS. Creative Analyst, unaffiliated and other-organization callers cannot
use this function to retrieve names for an inaccessible lead.

The existing paginated API retains raw audit fields for compatibility and adds
editor_name and display_changes. The UI renders only readable fields, Before and
After columns, editor display names, IST times and creation/update titles. It has
loading/error/empty states, newest-first order, previous/next and Close history.
Unknown status/profile names have explicit safe fallback labels. Nested JSON is
never used as primary presentation; quiz changes are expanded into question rows.

Checks executed:

- `npm test`: PASS, 9 tests, including exact Notes text, empty/missing values,
  quiz/status formatting and SQL editor-name lookup under self/cross-org/Analyst
  access. Existing profile reads remain self-only.
- `npm run typecheck`: PASS.
- Production build with `.next-check`: PASS.
- Migration applied to the existing configured development project.
- `node --experimental-strip-types scripts/verify-saved-history.mjs`: PASS.
  It read the latest existing Notes edit (not a generated fixture), compared exact
  before/after text against the display transformation, resolved the actual actor's
  name under the actor's authenticated SQL/RLS context, checked descending versions
  and compared an audit-record hash before/after. The transaction was read-only;
  no history was inserted, updated or fabricated. Private note text and names were
  not printed. This was database/display-data verification, not an automated
  browser login using the existing Admin's private credentials.

Manual check: refresh All Leads, open the edited lead's History, inspect Notes
Before/After and the editor's name, then use Close history.

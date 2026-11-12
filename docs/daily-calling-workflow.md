# Filter repair and daily calling workflow

Implemented locally on 2026-11-12. No live website or Meta integration is completed by this change.

## Filter failure

Migration 033 used catalog_kind for option IDs but the unqualified lead_ingestion.kind column for snapshot names and joins. This mixed brand/product/page labels. New immutable migration 034 uses the same explicit catalog hierarchy key for IDs, names and joins, and constrains the joined catalog row to its own kind and organization. Existing role checks, source/version separation, archived labels, query limits and function grants are retained. Previous migrations are unchanged.

The regression now verifies each brand, product and landing-page label against its own identity and rejects mixed hierarchy names. The migration was applied to the existing development CRM using its checked migration ledger; public business-table fingerprints were unchanged.

## Daily actions in All Leads

- All leads resets table filters.
- New leads applies the existing active is_new status IDs, without guessing status names.
- Pending callbacks uses the existing server-side callback predicate and sorts by oldest lead update. This is not a callback-due-time sort; use Follow-ups for callback scheduling.
- Today's follow-ups and Overdue follow-ups open the existing filtered callback page.
- Open first result opens the first currently loaded lead directly on its Calls tab. It never records a call or changes a status.

Queue selection resets other table filters, retains chosen answer columns and uses the existing unsaved-draft guard. Follow-up links also invoke that guard. Existing shared caller access, explicit call recording, idempotency, status/confirmation counting, Admin and Invite Staff remain unchanged. Queue help explains the behavior. No new backend endpoint or queue ownership model is introduced.

## Verification

Typecheck and production build passed. All 49 automated tests passed, including the formerly failing combined-filter test. Existing All Leads browser regression passed: first row above the fold at 1600x780, frozen columns, six tabs, draft preservation, simulated uncertain retries/stale edits and actual server filters.

scripts/verify-daily-workflow.mjs checks real search request definitions and successful responses for all three queues, exact Today/Overdue navigation, the first-result Calls drawer, three existing themes and 390px mobile layout after the sidebar transition settles. It only uses an existing retained lead/Admin, blocks business mutations and checks all public business records and password fingerprints. Its optional --apply-migration uses the existing checked ledger and advisory migration lock. Screenshots are ignored in .cache/daily-workflow/.

No new main-CRM leads or staff accounts are created. No hosting, deployment or GitHub push. Live website-to-CRM-to-real-Sheet acceptance and real Meta login/sync remain pending.

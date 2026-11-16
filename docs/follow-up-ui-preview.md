# Follow-up workspace refresh

Local preview: http://localhost:3000/app/follow-ups

The existing follow-up screen now has four selectable queue cards (All pending, Due Today, Overdue, Upcoming), a clear filter toolbar, a structured table and an empty state linking back to Leads. All timestamps use the existing IST formatter. Populated rows show lead/mobile, next call, assignment, notes, state and existing order/manage/history actions. Existing scheduling and revision/idempotency requests are reused. Completing/cancelling a callback still does not record a call. The shared component also styles follow-ups inside the lead detail panel.

## Local verification

- Optimized build and TypeScript compilation passed.
- Two existing targeted tests passed: IST/input protection and SQL callbacks/history/permissions/retries/atomic call bundles.
- `node scripts/verify-follow-up-ui.mjs` verified Light, Dark and Mixed with real server queue/My filters and persisted theme preferences.
- Populated-table rendering, edit form and identical retry payloads were checked using an intercepted browser response fixture and intercepted 503 writes. This fixture was never saved to the CRM and does not prove a real callback was saved.
- The mobile table stays within its own scroll container after the responsive layout updates.
- All public table content and existing password hashes were compared before/after browser verification and remained unchanged. No business writes were saved.
- Screenshots of the actual local screen: `.cache/follow-up-ui/light.png`, `dark.png`, `mixed.png`. Browser fixture mobile screenshot is separately labelled in its filename.

Only local preview/commits are included. No GitHub push or deployment. Live website ingestion and real Sheet verification remain pending.

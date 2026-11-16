# Visible guided CRM demo

Run `node scripts/demo-crm-workflow.mjs` while the existing main CRM runs at `http://localhost:3000`.

A separate visible browser uses an existing operational staff identity and the retained demonstration inquiry. It never asks for a password in chat and does not create an account or inquiry. The DEMO ONLY box advances on the viewer's click:

1. All Leads.
2. Customer/order details and recent activity.
3. Call result, notes and a next-call date in IST.
4. Simulated save feedback.
5. The existing real follow-up list, then Finish demo.

All business writes are intercepted. A successful call response is simulated in this browser; no real call or follow-up is recorded. The practice item will not appear in the real follow-up list. Existing public records and password fingerprints are compared before/after. Closing or timing out the demo closes its temporary browser and signs out only its temporary session. Each step times out after 15 minutes if unattended.

`node scripts/demo-crm-workflow.mjs --verify` runs the same journey headlessly without waiting for Next. The five-step rehearsal passed locally with one intercepted simulated call and unchanged public records/passwords. A rehearsal is distinct from the viewer completing the visible demo.

The demo is localhost-only. It does not verify live website capture, the actual Sheet, Meta sync or hosting. No external messages, push or deployment are involved.

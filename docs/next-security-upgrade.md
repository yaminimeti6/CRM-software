# Next.js security update - 2026-11-17

The local CRM was running Next.js 16.4.3 and displayed the development Security Insight upgrade notice. Before the change, npm audit reported one moderate Next.js advisory (GHSA-mfr8-8qww-v76h).

Upgraded and pinned Next.js to stable 16.4.6, updating only Next.js and its @next/env / platform SWC entries in the lockfile. Existing unrelated workspace edits were preserved. No audit warnings or developer indicators were suppressed.

References:
- https://github.com/vercel/next.js/releases/tag/v16.4.6
- https://github.com/vercel/next.js/security/advisories

Local verification:
- Installed Next.js version: 16.4.6.
- npm audit: zero reported vulnerabilities after the update (point-in-time registry result, not a security certification).
- Optimized preview build, including TypeScript compilation, passed.
- Full test suite: 62 passed, zero failed/skipped.
- Main CRM browser verification: existing six-column lead table, order/source/callback data, filters, create form visibility, detail/call/follow-up panels, persisted themes and mobile containment passed. All public table contents and password hashes remained unchanged; no business writes were saved.

Local preview: http://localhost:3000/app . Refresh existing tabs after the restart. No GitHub push or deployment was performed. Live website/real Sheet integration remains pending.

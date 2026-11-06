# Whole CRM navigation and theme rollout — 2026-11-06

The operator clarified that the visual design must apply across the entire CRM, not stop at the All Leads preview. The shared shell now lives in the authenticated `/app` layout. All ten existing CRM pages use it; their old individual text-link headers are removed. No page's role checks, operational client component, backend API, database schema or business rules are replaced.

## Coverage

| Existing page | Shared sidebar/top bar and Light/Dark/Mixed |
| --- | --- |
| All Leads `/app` | Applied; frozen columns and six-tab lead drawer retained |
| Follow-ups `/app/follow-ups` | Applied; original filters, callbacks and reminders retained |
| Performance `/app/performance` | Applied; consistent report filters and metric cards |
| Attribution `/app/attribution` | Applied; existing provenance/privacy notices retained |
| Meta spend `/app/meta-spend` | Applied; original coverage/currency rules retained |
| Team `/app/team` | Applied; existing Admin/Invite Staff controls and handlers retained |
| Lead sources `/app/ingestion` | Applied; original source configuration form retained |
| Catalog `/app/catalog` | Applied; original brand/product/page/version controls retained |
| Imports `/app/imports` | Applied; original upload/mapping/preview/commit workflow retained |
| Meta settings `/app/meta` | Applied; existing connection/configuration behavior retained |
| Sign-in `/login` | Shared theme/brand frame; original sign-in form and restrictions retained |
| Invitation activation `/join` | Shared theme/brand frame; original validation/acceptance handlers retained |

Public authentication screens deliberately have no staff navigation, reminders or profile details. Unauthenticated CRM requests still redirect to sign-in. The shared authenticated layout verifies staff access; every individual page retains its original role-specific restrictions. Sidebar visibility is unchanged by role and is not used as a security boundary.

The top bar now provides the one common reminder indicator and profile/sign-out menu, avoiding duplicate reminder blocks on Follow-ups. Sidebar links use client-side navigation without speculative prefetching; the shell, selected theme and sidebar state remain consistent during navigation. The same browser preference keys are used by authenticated and public screens, including after refresh. Default remains Mixed. No credentials or personal data are stored in theme preferences.

All page cards, tables, forms, reports, notices and panels use the shared colors and readable font sizes. Report/admin filter forms use responsive columns instead of oversized full-width stacks. Wide report/staff tables scroll within their containers rather than widening the page. No frontend package, external font or third-party service was added. This task does not modify the live landing website or its form code.

## Verification

Production build and TypeScript passed. Ten targeted automated cases passed with zero failures/skips across navigation/theme preferences, roles, lead views, submitted-order isolation, calls, follow-ups, Team authorization and manual invitation safety. SQL fixtures are confined to ephemeral isolated test databases; no fixture is added to the main backend. The browser-build secret scan passed for 24 JS/map assets.

`node --experimental-strip-types scripts/verify-crm-theme-rollout.mjs` passed on the actual localhost:3000 main server with the existing configured backend:

- **30 combinations:** all ten authenticated pages opened in all three themes. Each page's actual read/report API returned HTTP 200. Each rendered one shell, the correct title/active navigation and no old text-link navbar.
- Theme persisted across real sidebar navigation. White Light/Mixed content and dark Dark content were measured on each page.
- Existing Staff/Invite Staff controls opened and the invitation role default remained Telecaller. No invitation, staff edit, upload, configuration change or checkout was submitted.
- Follow-ups, Performance, Team and Attribution were checked at 390×844: mobile menu opened/closed and page-wide horizontal overflow was absent.
- Sign-in and invitation activation were checked in all three themes without entering credentials/invitations or submitting forms. All ten protected routes redirected an unauthenticated browser to sign-in without staff navigation.
- All public-table fingerprints and account/password fingerprints matched. Zero business writes, new leads or new staff accounts. The browser mutation guard blocked none because only read/report requests and UI theme/navigation interactions occurred.
- No browser JavaScript errors.

The verifier uses a temporary in-memory session for the existing verified Admin, sends no email, changes no password and signs out only that verification session. It does not claim fresh successful invitation/callback/import mutations or real-provider Meta acceptance. The existing All Leads drawer and protected API rules are also covered by the retained UI/SQL regression checks.

Screenshots/evidence are private ignored artifacts under `.cache/crm-theme-rollout/`: `follow-ups-{light,dark,mixed}.png`, `performance-{light,dark,mixed}.png`, `meta-{light,dark,mixed}.png`, `login-{light,dark,mixed}.png`, `join-{light,dark,mixed}.png`, `follow-ups-mobile.png`, and `evidence.json`. Staff display names are redacted from authenticated screenshots; no staff/customer list is published or committed.

## Delivery and limits

Local implementation and local commits only. No public hosting, deployment or GitHub push. Existing unrelated next-env.d.ts changes remain excluded. **Live /Wife/ integration and real Sheet verification remain pending**, as documented in [live-wife-developer-handoff.md](live-wife-developer-handoff.md). Theme consistency is not evidence of a working external integration.

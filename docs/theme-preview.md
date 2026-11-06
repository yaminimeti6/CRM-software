# All Leads navigation and theme preview — 2026-11-06

## Scope and approval boundary

The first preview is available on the existing main CRM at `http://localhost:3000/app`. It includes All Leads, a collapsible role-aware sidebar, a top bar, and Light, Dark and Mixed themes. **Mixed is the default**: dark sidebar/top bar with light content/table. The operator must choose the design before applying the shell to the other existing pages. No other page's markup or Admin/Invite Staff behavior is redesigned in this slice.

Sidebar links open their existing destinations; those pages retain their earlier layout until the next explicitly selected rollout. The scoped theme stylesheet is reusable, but importing it does not silently theme pages without a CRM shell. This is a first-stage local preview, not completion of the entire-app redesign.

## Implemented

- Existing navigation links are grouped as Workspace (All Leads/Follow-ups), Reports and Admin/Settings, with local SVG icons, readable labels and active-page highlighting. Desktop sidebar can collapse to an accessible icon rail.
- Role visibility matches the previous main page: Telecaller sees shared operational pages and self Performance; Manager sees operational/reporting routes; Creative Analyst has reporting links and the existing restricted All Leads landing; only Admin sees Team/invitations, sources, catalog, imports and Meta settings. This menu is presentation, not an authorization grant. Backend route/session/RLS checks remain unchanged.
- Top bar includes page title, existing callback-count API/reminder links, theme controls and a profile menu with the same staff account fields and the existing logout server action. No password, invitation or staff-management function is recreated. Reminder counts poll at the existing one-minute cadence; no alert delivery service is added.
- Theme selection is stored as `crm.ui.theme.v1`; sidebar collapse as `crm.ui.sidebar.v1`. Both persist through refresh, synchronize preference changes across same-origin tabs, and handle unavailable/corrupt storage safely. No personal data, credentials or session tokens are stored in these keys.
- Content uses CSS theme tokens for surfaces, controls, tables, filters, popovers, status badges and all six lead-detail tabs. Primary row text is 14px; supporting labels are larger than the earlier compressed design. Frozen Name/Mobile, source distinctions, Unknown tracking, existing edit behavior and all calling/follow-up/idempotency rules remain intact.
- Below 900px the sidebar becomes an overlay drawer with close/backdrop/Escape handling and a keyboard focus loop. Closed mobile navigation is inert; the background is inert while the menu is open. Table overflow stays inside its scroll container. At narrow widths Name/Mobile use a smaller fixed-column width without shrinking their font.
- Fonts are local Segoe UI/Arial fallbacks (Inter if already available); no remote font, image service, UI library, analytics or new package is introduced.

## Actual verification

Production build and TypeScript passed. Seven targeted tests passed, zero failures/skips: sidebar role-route matrix, stored theme normalization, view validation/search, immutable submitted orders/role isolation, call/confirmation rules and follow-up/retry scenarios. SQL tests use ephemeral isolated databases, not new fixtures in the main backend. The browser-build secret scan passed for 24 JS/map assets.

The existing `scripts/verify-all-leads-ui.mjs` was extended and passed against the main server and existing configured backend:

| Check | Observed result |
| --- | --- |
| Light/Mixed surfaces | White table/card surfaces; Light navigation white, Mixed navigation/top bar dark |
| Dark surfaces | Dark table/card/form/panel surfaces with light readable text |
| Theme refresh persistence | All three selections survived real reloads |
| Sidebar collapse persistence | Icon rail survived reload; expanding restored labels |
| Active navigation | All Leads link marked aria-current=page |
| Font size | Main table cell and customer form input measured 14px |
| Theme controls | Actual buttons change theme; source popover, customer form and Source panel colors checked |
| Profile/reminders | Existing account menu and actual callback reminder links opened |
| Mobile at 390×844 | Sidebar opened/closed with Escape; main page and lead drawer did not create page-wide horizontal overflow |
| Existing All Leads operations | Frozen columns, six tabs, retained operational drafts, pending-close guard, versioned stale-edit handling, server filters and exact-payload retries retained |
| Data preservation | No new lead/user; every public-table fingerprint and account/password fingerprint unchanged |
| Browser errors | Zero |

The browser uses an existing retained API example and a temporary in-memory local session for the existing verified Admin, not a new staff fixture. No email is sent, no password is changed, and only that test session is signed out. Business-write simulations are intercepted before server receipt; real reads/searches reach the main backend. This does not claim new successful operational writes or real-browser tests for every role. Role navigation was checked with unit tests and existing backend isolation tests.

Ignored screenshots are under `.cache/crm-theme-preview/`:

- `mixed.png`, `light.png`, `dark.png` — actual main All Leads with sidebar/top bar.
- `mixed-panel.png`, `light-panel.png`, `dark-panel.png` — the existing Source panel in each theme.
- `mobile-mixed.png` — narrow-screen preview.

Screenshots redact the existing staff display name and show only the previously retained example lead. They are not new synthetic submissions or live website orders. Current read-only evidence is under ignored `.cache/all-leads-ui/evidence.json`.

## Still pending

Operator theme/design selection, followed by the authorized consistent-shell rollout to Follow-ups, Reports and Admin/Settings pages. No backend migration or new functionality is implied by that future UI rollout. **Live /Wife/ website integration remains pending** as documented in [live-wife-developer-handoff.md](live-wife-developer-handoff.md). No hosting, deployment, live page/Sheet change or GitHub push was performed. Changes are retained in local commits only.

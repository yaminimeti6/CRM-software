# Main All Leads UI improvement — 2026-11-05

Latest rollout (2026-11-06): [ui-theme-rollout.md](ui-theme-rollout.md) covers the shared sidebar/top bar and persisted Light/Dark/Mixed themes across all authenticated pages and public sign-in/invitation screens. Backend behavior and live-integration pending status are unchanged.

The existing authenticated main CRM at `http://localhost:3000/app` now has a compact readable lead table, frozen Name/Mobile columns, a concise filter toolbar and a right-side detail drawer. This is a frontend slice using existing API/RLS/reporting functionality. No migration, new backend endpoint, staff-role change, Admin/Invite Staff change or website integration is introduced.

Follow-up after the operator's screenshot: the new controls were present, but oversized page/account/reminder/filter spacing pushed the table below the visible desktop viewport. Main-page-only spacing now compacts the navigation/account/reminder area, combines the applied-filter row with collapsed saved views, removes empty status spacing, and places calling guidance below the table. All account/reminder controls remain available; other Admin/onboarding pages are not restyled. A rerun at **1600×780** verified that the first existing lead row is fully visible without page scrolling (bottom below 740px), and repeated all six-tab/draft/retry/filter/preservation checks successfully. Build, TypeScript and the 24-asset browser secret scan passed again. The new screenshot is `.cache/all-leads-ui/all-leads-above-fold.png`.

Repository recovery during this follow-up: master contained 41 NUL bytes, while its reflog and the exact index both identified `5be8fe1edd8858e4ed6666832bf036176f2b0a96` as the last completed commit. After backing up the corrupt reference under ignored `.cache/git-recovery/`, only that branch reference was restored to the verified commit. No reset, reinitialization, index discard or history rewrite was performed; unrelated next-env.d.ts edits were preserved. Tool-owned checkpoint references were not modified.

## Resulting workflow

- Rows initially display text instead of a form full of inputs. Name/mobile, current status, course/price, website/configured landing page, reported traffic, receipt time, address and notes remain available. Name/Mobile stay visible while horizontally scrolling; headers stay visible when scrolling vertically.
- Click a name or a non-interactive row cell to open details without losing the current filter/search/page/table scroll. Edit row explicitly opens the existing field/status/selected-answer editors; Save row still sends the original versioned PATCH payload. Cancel edit discards only that draft. There is no new autosave behavior.
- Full submitted URLs, external order ID, submission UUID and internal lead UUID are in details, not default table cells. Course and website/page/traffic summaries remain visible. Missing tracking remains Unknown; website and traffic are separate.
- The drawer has Order, Source, Answers, Calls, Follow-ups and History tabs. Original typed submitted answers and current CRM text answers are distinguished. Original field names are preserved. Existing calling, callback and history components/APIs are reused.
- Visited tabs stay mounted while hidden, retaining call/callback drafts, frozen retry payloads and history pagination. The drawer traps keyboard focus, supports Escape and tab-arrow navigation, restores focus on close, and blocks closing while a call/callback request is pending. Unsaved/uncertain operational drafts require explicit confirmation before closing/changing results. Opening details never starts presence or records a call.
- The main toolbar contains name/mobile search, status, inclusive IST received dates, a compact Sources menu and Apply/Clear actions. Source choices remain multi-select; choices within each group OR, groups AND. Advanced filters, dynamic-column selection and personal saved views retain their existing server contracts. Status/date/source changes are applied together explicitly; row-count changes apply immediately.
- While a detail drawer or unsaved row is open, authoritative Realtime refreshes remain deferred to protect edits. Closing the drawer or explicitly refreshing rechecks the active result definition. The drawer shows a snapshot; after recording a call, close it to refresh the table/header status from the authoritative lead query.

Call-counting rules are unchanged: ordinary field/status edits do not create call attempts; confirmation transitions retain existing behavior. Only explicit Record call sends a call mutation. Follow-up completion/cancellation remains explicit and does not fabricate an attempt.

## Verification actually performed

TypeScript and production build passed. Five targeted automated cases passed with zero failures/skips across lead-view validation/search, submitted-order projection/role isolation, call/confirmation rules and follow-up/idempotency scenarios. These SQL tests use isolated ephemeral databases; no fixtures were added to the main backend.

`node --experimental-strip-types scripts/verify-all-leads-ui.mjs` passed against the actual running main CRM and existing configured backend:

| Browser check | Result / boundary |
| --- | --- |
| Existing record renders as text; no default input fields or full URL/UUID in row | Passed |
| Name and Mobile remain at the same screen coordinates after horizontal scroll | Passed |
| All six drawer tabs and actual Calls/Follow-ups/History GET endpoints | Passed |
| Original typed answers and distinct website/page/traffic/full URL in details | Passed |
| Call/callback drafts survive tab switches; dismissing discard confirmation keeps draft | Passed |
| In-flight call disables drawer close | Passed with intercepted delayed request |
| Two call retries retain the exact request payload/ID | Passed with intercepted HTTP 503 responses; no actual call written |
| Two callback retries retain the exact request payload/ID | Passed with intercepted HTTP 503 responses; no actual callback written |
| Inline edit retains version/body and survives a 409, then can be cancelled | Passed with intercepted HTTP 409; existing lead unmodified |
| Combined website/traffic/name filters and status filter return the intended existing lead | Passed against actual server search |
| Closing read-only details retains active search | Passed |
| New leads/users, public table changes and password changes | Zero; every public-table fingerprint and account/password fingerprint matched |
| Browser JavaScript errors | Zero |

The browser verifier creates a temporary local session for the existing verified Admin identity using private operator configuration; it creates no account, changes no password and sends no email. Tokens/cookies stay in memory and that verification session is signed out at the end. The operator's existing sessions are not signed out. Only read/search requests reach the CRM from the browser; business-write simulations are intercepted before server receipt. No successful new operational write or fresh live role-deactivation scenario is claimed for this UI task.

The first browser pass used an outdated accessible Edit row selector; correcting the verifier to the new per-lead label allowed the complete run to pass. No product permission was changed to accommodate the test.

Screenshots and nonsecret evidence are ignored under `.cache/all-leads-ui/`: `all-leads-table.png`, `all-leads-source-panel.png`, `evidence.json`. They show the previously retained API example, not a new test inquiry or real customer data. The current API/CodLive verifier scripts were adapted to the drawer and new filter controls and syntax checked; their fixture-creating workflows were deliberately **not rerun** in this task.

The browser-build secret scan passed for 24 JS/map assets. Exact staged files are scanned again before local commit; private environments, screenshots, session material, customer/import files and builds are not committed. Existing unrelated `next-env.d.ts` edits remain excluded.

## Live integration status

**Live website integration remains pending.** No order was submitted to the live website or a real Sheet. Public HTTPS hosting, actual deployed order-collector access and real Sheet verification are still required as detailed in [live-wife-developer-handoff.md](live-wife-developer-handoff.md). No hosting, deployment or GitHub push was performed.

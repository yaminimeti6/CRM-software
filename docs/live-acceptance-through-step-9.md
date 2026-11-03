# Live acceptance review through Step 9

Date: 2026-11-03 (Asia/Kolkata). Scope is review/fixes of Steps 1–9 only. Step 6B live Shopify/website/Google Sheet integration is pending; Step 10 is not started. Standing Git policy: local commits only, no push.

## Existing requested lead (read-only)

The exact user-specified lead lookup returned one record. Its `S9_Question` key exists, its text is exactly `Blue`, and it has manual/unclassified question scope. Only booleans/counts were printed; no record ID, customer answers dump, credentials or session was logged. The existing lead was not modified. A hash-only baseline covers existing business records, completed import/staging records, staff and Auth/passwords; security-rate expiry and invalidation counters are not treated as business edits.

The exact browser workflow was reproduced with a separately owned, clearly marked synthetic lead and a separate control lead with the same Blue answer. Selecting `manual:S9_Question`, equals Blue and the fixture's exact name returned HTTP 200, exactly the browser-created lead ID and total 1. A nonmatching filter answer returned zero IDs/total. Thus missing data and a general frontend/backend equality-filter failure were not reproduced. The user's previous unsaved UI criteria are not recorded, so this review does not invent which prior selection/extra filter caused their particular result.

Observed usability gaps were fixed: manual quiz choices explicitly identify manual/unclassified scope; the applied summary shows question/operator/value rather than only a predicate count; equals/not_equals identify case-sensitive text; unapplied changes show a notice; an Apply action is available next to the advanced quiz controls. Existing filter semantics, validation, auth and RLS are unchanged.

## Verification approach

Read AGENTS.md and current Step 1–9 acceptance records. Reused earlier evidence for unchanged implementation details (for example the original 10,460-row volume test), while exercising current integration using real development Supabase and isolated local production servers. Every live script creates its own organizations/users/records and cleans only those IDs. Login-rate secrets are ephemeral in verification server processes; no local environment value is rewritten and real staff do not share the synthetic login rate bucket.

A dedicated `verify-quiz-filter-ui.mjs` asserts actual browser-created data, the sent definition, returned IDs/count, applied summary, nonmatching result, dynamic-column editing, readable history and zero fabricated attempts/confirmations. Existing live scripts support the selected current build directory; no stale historic build is substituted. Scripts run sequentially to avoid interfering with preservation snapshots.

## Current review results

- Steps 1/3: live manual invitation creation/copy, username/password activation/login, refresh/logout, expiry/revocation/reuse, concurrent acceptance, partial Auth provisioning recovery without password reset, role/org tampering, Analyst PII denial, existing-session deactivation and concurrent last-active-Admin protection passed. No SMTP/messages used. Existing account/password/business fingerprints matched after exact cleanup.
- Step 4: live three-call CNP → Retry → Confirm, actual caller credit/history, no-op Confirm, retries, inline confirmation without a call, cancel/reconfirm unique-lead/event distinction, concurrent/stale requests, transaction rollback/recovery and API/RPC/RLS isolation passed. Existing fingerprints matched.
- Step 5: live schedule/refresh/reschedule/assign/complete/cancel with history, reminders, IST boundaries, pagination, concurrent/retry protection, atomic call/callback recovery, Confirm/Cancel pending preservation, two independent Calling Now sessions, stop/logout/deactivation handling and actual 60-second disconnected expiry passed. No phantom attempts/events; existing fingerprints matched.
- Step 2 targeted browser lead create/filter/dynamic-column edit/history and nonmatching tests passed with explicit synthetic IDs and totals. Steps 6A–9 integrated verification evidence is appended after the final runs, not presumed from a build.

## Checks and configuration

28 automated tests passed after the UI clarification. TypeScript, production build, 19-asset browser secret scan, opt-in-disabled production test-form 404 and dependency audit (0 vulnerabilities) passed. No database migration or Realtime publication change is required by this review; existing migrations through 022 remain applied. No auth/RLS/validation weakening or production deployment.

Unverified boundaries: physical-device/network-cable behavior and production proxy/deployment; historical unsaved filter choices from the user's earlier session. The browser automation itself is available and executes real requests. No manual checklist is used as a substitute for acceptance execution.

## Final integrated live results

- Step 6A: real anonymous browser submission registered unknown fields, committed a lead and survived refresh without staff credentials or returned PII. Injected response loss after server commit, refreshed the browser, restored the same pending submission and replayed it with HTTP 200: exactly one lead. Two sources, distinct versions, same-name identities and original typed/nested answers passed the dynamic-field verifier. Recovery verifier exited 0. Earlier unchanged broad ingestion/security checks remain evidence in the Step 6A record; not every abuse/rate-limit case was repeated here.
- Step 7: current real browser CSV/XLSX upload/mapping, zero-write preview, correction/exclusion, confirmation, refresh/resume, duplicate protection, rollback/recovery, historical confirmation separation and RLS passed (`verify-imports.mjs --small-only`, exit 0). The prior 10,460-row volume evidence was reused, not rerun.
- Step 8: live catalog hierarchy, source/version activation and races, two sources/questions, unknown fields, frozen ingestion/import attribution, rename/archive/retire/replay, real anonymous form, browser persistence, permissions and deactivation assertions passed. The catalog command's final preservation comparator exited 1 solely for volatile `crm_private.team_rate_limits`, not a business/password difference. Its comparator now excludes login security counters, consistently with the review-wide business baseline; rate-limit enforcement is unchanged. The entire catalog script was not rerun after that harness-only correction, and its original exit 1 is not reported as exit 0.
- Step 9: `verify-lead-views.mjs` exited 0 against real Supabase and two independent authorized browser sessions: combined filters, sorting/full-result pagination/totals, private view save/apply/rename/update/delete and refresh/logout/login persistence; other-user denial; real create/edit notifications and entering/leaving results; retained unsaved Notes/open call/callback drafts; stale 409; offline/online authoritative recovery; logout cleanup; deactivated and cross-organization denial. Positive Supabase Realtime delivery and minimal payload were checked directly, not inferred from polling.

Final independent hash-only comparison against the baseline captured before this review passed for every existing business, catalog, source, import/batch, audit, staff and Auth/password table. Only exact newly created synthetic fixtures were removed. The user's original lead, existing manual leads and completed batches remain unchanged. Volatile rate limits/invalidation markers are excluded from business-preservation comparisons; no security rule is bypassed.

All Steps 1-9 functional acceptance checks above passed; Step 6B remains pending and untouched. This is not a claim of production deployment or a rerun of every historic edge case. No migrations or persistent environment configuration were changed. Related changes are retained in a local commit only; no GitHub push is authorized or performed.

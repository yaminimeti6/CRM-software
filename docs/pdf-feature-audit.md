# CRM PDF feature audit — 2026-11-05

UI preview update (2026-11-06): All Leads now has the first-stage sidebar/top bar and three persisted themes, browser-tested locally. The rest of the app's visual rollout awaits selection. See [theme-preview.md](theme-preview.md). This does not change any live integration status or authorize another backend roadmap step.

Source: supplied `Crm.Pdf`, version 1.0, 26 pages, sections 1–30, read in full for this review. The numbered development roadmap is paused. This audit does not authorize implementation of pending features.

Read-only live review update: current /Wife/ HTML is an advertorial leading to a separate storefront, not the supplied ZIP form. The actual order/Sheet collector is unverified and live integration remains pending. See [developer handoff and exact blockers](live-wife-developer-handoff.md). No public page, checkout, hosting or deployment was changed.

Status meanings: **Tested locally** = repository implementation with automated/local-browser evidence, sometimes using the existing managed Supabase backend; this is not public production acceptance. **Pending** = absent, partial, not verified, or requires real provider/deployment access. **Working live** requires observed behavior on the authorized public CRM/page/provider; no item is assigned that status because no public CRM deployment exists. Earlier documents' term “live” often means localhost with real development Supabase; that evidence is classified here as tested locally. Prior checks are identified separately from checks rerun in this task.

## Feature-by-feature inventory

| PDF section / feature | Status | Evidence or remaining gap |
| --- | --- | --- |
| 1–3 Real-time collection without retyping | Tested locally | Main Next lead API to All Leads, ZIP browser form, mock Sheet; live /Wife/ capture pending |
| 1–3 Existing Sheet flow during transition | Tested locally | Original Sheet function retained, one mock POST; actual Sheet pending |
| 3 Common table for authorized telecallers | Tested locally | Lead/RLS/view scenarios and previous two-session integration |
| 3 Open calling without mandatory ownership | Tested locally | Calling/follow-up implementation; prior call verification |
| 3 Spreadsheet-like edits and audit | Tested locally | Inline Save row, authenticated history; previous browser evidence |
| 3 Automatic calculations and separate lead/call/OTP/creative data | Tested locally | Event/report models; real OTP absent |
| 3 Server-only secrets and backend permissions | Tested locally | RLS/security tests and browser/staged secret scans; public hosting pending |
| 3 Admin visibility / multi-brand architecture | Tested locally | Existing role and catalog/performance evidence |
| 4 Dashboard / All Leads / telecaller performance | Tested locally | Existing main modules; unchanged |
| 4 Creative analytics / follow-ups / sources / products and brands | Tested locally | Existing attribution, callback, ingestion and catalog modules |
| 4 Date/status/product reporting | Tested locally | Existing performance, attribution and lead filters |
| 4 Team management | Tested locally | Existing invitation/role evidence; Admin and Invite Staff unchanged |
| 4 Unified Settings (statuses, mappings, imports, integrations) | Pending | Imports/mappings/integrations exist in separate modules; full status settings UI absent |
| 5 Large editable table, scrolling and sticky headers | Tested locally | Main table and stylesheet; existing browser evidence |
| 5 Freeze Timestamp, Name and Mobile | Pending | Name/Mobile freezing now browser-tested locally; timestamp is visible but not frozen in this requested slice |
| 5 Inline customer details and dropdown status | Tested locally | Explicit Edit row opens existing versioned editors; compact default read mode and stale-edit preservation verified |
| 5 Automatic saving | Pending | Explicit Save row is current behavior |
| 5 Real-time updates across users | Tested locally | Prior Step 9 Realtime two-session evidence; fallback authoritative reload |
| 5 Search name/mobile | Tested locally | Server search; current main synthetic search |
| 5 Search Lead ID / Creative ID | Pending | Search currently name/mobile; ID search not implemented as requested in PDF |
| 5 Multi-column server filters, sort/date and pagination | Tested locally | Lead-view/submitted-order SQL tests; combined main UI source filters |
| 5 Column resizing / reordering | Pending | Not implemented |
| 5 Hide/show columns | Tested locally | Dynamic quiz column selection only; fixed default columns remain |
| 5 Saved custom views | Tested locally | Private filter/sort/quiz-column/page-size views; no arbitrary column layout |
| 5 Permission-controlled CSV/Excel export | Pending | Historical import is not export |
| 5 Lead detail panel / history / activity timeline | Tested locally | Right-side Order/Source/Answers/Calls/Follow-ups/History drawer reuses existing APIs; main browser checks passed. See all-leads-ui.md |
| 5 Saving/success/error indicators | Tested locally | Existing row and request state messages |
| 6 Standard timestamp/name/mobile, optional dynamic fields | Tested locally | Server timestamp and validation, JSONB answers; original values preserved |
| 6 Unknown field registration and source association | Tested locally | Dynamic-field and ingestion tests, prior main-backend evidence |
| 6 Column selector and retaining older questions | Tested locally | Scoped source/version quiz definitions and saved views |
| 6 Admin default-column configuration | Pending | Per-user quiz selection exists; no complete Admin default-column UI |
| 6 Unlimited dynamic fields | Pending | Deliberately bounded to 30 fields per submission with size/depth limits; not unlimited |
| 6 Source/version identity and comparisons | Tested locally | Catalog versions and scoped query/report models |
| 7 Any caller selects lead; actual authenticated caller | Tested locally | Explicit Log Call and authenticated immutable caller history |
| 7 Caller override and correction history | Pending | No general operator override workflow; historical caller labels retained separately |
| 7 Attempts: lead, actor, time, outcome, reason, notes, previous/new status | Tested locally | Existing call model/tests and prior main integration |
| 7 Optional callback on call | Tested locally | Atomic call/callback handling and retry tests |
| 7 Address edit does not create attempt | Tested locally | Explicit attempt/event semantics, prior verification |
| 7 Multiple callers: separate attempts, one lead and confirmation | Tested locally | Call/confirmation model and prior three-caller test |
| 7 Calling Now warning, expiry, independent sessions | Tested locally | Existing presence tests and prior two-session integration |
| 8 Initial New/Confirm/CNP/Retry/Cancel | Tested locally | Seeded statuses and reporting categories; no seed changes in this task |
| 8 Follow up Pending/Future/Not Interested/Invalid Number status options | Pending | Not all PDF labels are seeded; callback state is separate from current lead status |
| 8 Admin add/rename/colors/reorder/disable/category mapping UI | Pending | Database configuration exists partially; full status management UI absent |
| 8 Legacy Status/Status 2/callers/reasons retained | Tested locally | Import mapping preserves legacy values without invented attempts |
| 9 Current/first/latest confirmation identity/time and status history | Tested locally | Confirmation event SQL, prior call verification |
| 9 No duplicate confirmations on repeated Confirm save | Tested locally | Revision/idempotency checks; prior cancel/reconfirm tests |
| 9 Current confirmed vs event-date vs received-cohort reports | Tested locally | Separate report definitions and filters |
| 10 Attempts, distinct attempted, confirmations and conversion | Tested locally | Performance tests/prior integration; documented formulas |
| 10 Connected leads when outcome proves connection | Pending | No general connected-outcome classification verified |
| 10 Pending/overdue/CNP/Retry/Cancel and first/last activity | Tested locally | Existing callback/outcome/staff performance reports; prior evidence |
| 10 Caller table and daily confirmation activity | Tested locally | Existing report with separate first/reconfirmation counts |
| 10 Today/yesterday/7 days/custom periods | Tested locally | Performance filters; current preset includes last 30 days |
| 10 This-month/caller/status filter parity | Pending | No dedicated this-month preset; actor breakdown exists; full PDF filter parity absent |
| 10 Brand/product/landing page filters | Tested locally | Frozen catalog snapshot filters |
| 11 Operational KPI cards and daily trend / leaderboard / status outcomes | Tested locally | Existing management performance tables and cards |
| 11 Hourly arrivals, all charts, reason analytics and dashboard-wide caller/status filters | Pending | Full requested dashboard set is not present |
| 11 Product/page/creative comparisons | Tested locally | Separate performance/attribution modules; not one complete dashboard |
| 11 UTC storage and Asia/Kolkata reporting | Tested locally | Existing timestamp rules and boundary tests |
| 12 Preserve campaign/ad-set/ad/creative/account/placement/click/UTM claims | Tested locally | Dynamic original answers; explicit claims now visible by default when supplied |
| 12 Missing tracking Unknown; no guessed Meta creative identity | Tested locally | Version-specific CodLive mapping and tracking tests |
| 12 Creative lead/confirm/CNP/Retry/rate reports | Tested locally | Existing attribution reports/tests; live capture incomplete |
| 12 Date/brand/product/campaign/account/page/creative/version filters | Tested locally | Existing attribution/campaign report scopes; actual live URL macros unverified |
| 12 Cross-account Master Creative mapping and languages | Tested locally | Existing explicit creative/campaign mappings; external software link pending |
| 13 Meta OAuth, account discovery and read-only spend sync | Tested locally | Mock-provider and worker tests; real app credentials/consent/worker pending |
| 13 CPL / cost per confirmed lead / efficiency | Tested locally | Coverage-aware partial-capture reports; reliable live campaign costs pending |
| 13 Creative Performance Software data connection | Pending | No real external system integration verified |
| 13 Advisory budget recommendations / automatic changes | Pending | Recommendations absent; automatic budget changes excluded |
| 14 Original OTP labels retained independently | Tested locally | Untrusted legacy OTP metadata; never confirmation proof |
| 14 Backend OTP request/verify, lifecycle, resend/expiry/throttle/provider secrets | Pending | No provider integration; no claimed trusted OTP verification |
| 14 Save before OTP, later trusted verification update; key rotation | Pending | Requires provider/deployed implementation and authorized rotation |
| 15 Apps Script forward/synchronize compatibility | Pending | Browser dual delivery prepared instead; no Apps Script deployment inspected |
| 15 Existing JSON public lead API, validation, UUID/time/source, dynamic/tracking/idempotency/receipt | Tested locally | Actual main challenge/POST/browser and database integration |
| 15 Form-encoded ingestion | Tested locally | Direct main API URL-encoded retry verified; answers supplied as JSON text. See public-lead-api.md |
| 15 Rate limits/challenge/bot mitigation/size/sanitization/origins/logging | Tested locally | Existing ingestion tests; real HTTPS proxy/CORS still pending |
| 16 Duplicate request vs intentional repeat inquiry | Tested locally | Stable source-scoped submission UUID; separate repeat-mobile lead indicator |
| 16 Configurable repeat policy | Pending | Current behavior preserves repeat inquiries; no full policy UI |
| 17 Organization/brand/product/page/version hierarchy and reporting | Tested locally | Catalog and scoped report tests; optional unknown mapping retained |
| 18 Admin/Manager/Telecaller/Analyst backend role boundaries | Tested locally | Existing RLS/API tests; analysts denied raw customer PII |
| 18 Full Admin export/status/default-field controls | Pending | Roles exist but these product surfaces are incomplete |
| 19 Follow-up dates/notes, optional caller, due today, overdue/count/history | Tested locally | Existing follow-up module and prior main integration |
| 20 Relational records plus JSONB, raw payload, internal/external IDs | Tested locally | Migrations and submitted-order projection tests |
| 20 Constraints/indexes/append-only history/protected fields/migrations | Tested locally | Existing SQL tests; no schema change required here |
| 20 Soft deletion for leads | Pending | No general lead deletion/restore product flow verified |
| 21 Insert/status/caller notifications, dashboard refresh and stale-edit checks | Tested locally | Existing Realtime/version checks; prior browser acceptance |
| 21 Server pagination/filtering and clear conflict/retry handling | Tested locally | Existing SQL/API tests, saved-view and callback behavior |
| 22 Metric definitions, no double counting, missing tracking/repeats/history/actor drill-down | Tested locally | Performance/attribution models and prior tests; trusted OTP metrics pending |
| 23 CSV/XLSX preview, mapping, unknown/blank/repeated columns, statuses/callers/OTP/creative retention | Tested locally | Import tests and prior synthetic browser imports; actual historical data acceptance remains operator-specific |
| 23 Batch traceability / duplicate import protection / error reports | Tested locally | Existing batch/preview/commit/recovery tests |
| 23 Parallel real Sheet pilot, counts/OTP/tracking/time reconciliation | Pending | Mock Sheet only; actual Sheet access unavailable |
| 23 CRM primary / Sheet archive cutover | Pending | Explicitly keep current Sheet flow during pilot |
| 24 Next/React/TypeScript/Supabase/PostgreSQL/Auth/RLS/migrations | Tested locally | Current repository and successful build/typecheck evidence |
| 24 Tailwind/shadcn/high-performance grid library parity | Pending | Existing custom React table/CSS; not the specified full grid surface |
| 24 Public hosting, separate staging/production environments | Pending | Localhost only; hosting decision/access required |
| 25 Server credentials, validation, RLS/grants, PII protection and login/session controls | Tested locally | Existing security/authorization evidence; no new auth changes |
| 25 HTTPS, backup/restore drill, organization-wide retention/deletion policy, separate production credentials | Pending | Import retention exists; full operational policy/recovery proof absent |
| 26 Phase 1/2 roadmap | Pending | Most calling core implemented; live capture and listed UI/export gaps remain; roadmap paused |
| 26 Phase 3 roadmap | Pending | Local attribution exists; external software integration/live capture pending |
| 26 Phase 4 roadmap | Pending | Local Meta model exists; live sync, alerts, scheduled summaries and optional AI reports pending |
| 27 Modular code/types/migrations/tests/docs and preservation rules | Tested locally | Existing repository practice; this review changes no accounts/Admin/invites |
| 28 New quiz field and unknown source/version retention | Tested locally | Dynamic-field/source validation tests; arbitrary unregistered public source is correctly rejected |
| 28 Two users updated table / actual editor / multiple callers | Tested locally | Prior Step 9/call browser evidence, not rerun wholesale here |
| 28 Confirm once / repeated Confirm no double count | Tested locally | Existing call/confirmation tests and prior integration |
| 28 OTP failure after save retains trusted state | Pending | Trusted OTP integration absent |
| 28 Missing Creative ID accepted / same submission retry | Tested locally | Ingestion/browser/submitted-order checks; main retry count one |
| 28 Today's confirmations / historical import / restricted Admin denial | Tested locally | Existing reporting/import/role tests and earlier main-backend evidence |
| 28 Concurrent edits never silently overwrite | Tested locally | Version 409 and prior two-session tests |
| 29 Shopify/GoKwik/shipping/courier/delivery/warehouse/payment reconciliation/mandatory distribution/automatic budget changes/SaaS billing | Pending | Intentionally excluded; do not implement under this task |
| 30 Daily leads/confirms/caller attempts/leaderboard/pending/page/version/creative/product comparisons and edit history | Tested locally | Existing operational and attribution reports; incomplete live capture prevents live business claims |
| 30 Which creative merits budget increase | Pending | Requires reliable captured attribution, real spend and advisory review; no automatic action |

Current-task evidence and developer/live acceptance instructions are in [core-workflow-pilot.md](core-workflow-pilot.md). The subsequent direct HTTP API review, reusable Sir demo, actual responses and form-encoded verification are in [public-lead-api.md](public-lead-api.md). Earlier unchanged feature evidence is in `docs/live-acceptance-through-step-9.md`, Step 10–12 status records and corresponding tests. No broad historic test rerun is implied by this audit.

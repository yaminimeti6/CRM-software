# CRM PDF feature audit - reviewed 2026-11-16

Current pending review: every one of the 28 previously Pending/mixed entries is mapped in [pdf-pending-review.md](pdf-pending-review.md), with exact gaps, dispositions and evidence. Export/Admin controls had stale Pending labels; charts and several mixed items are now split by implemented versus unverified scope. Seventeen targeted tests passed in this review. No application/data/configuration change or new roadmap step.

Historical delivery update (2026-11-12): Admin status/default-column settings, ID search, CSV export, personal column controls and dashboard charts are implemented locally. Subsequent native XLSX and scoped 77-table local recovery checks passed. Customer OTP is optional for the pilot. Temporary HTTPS sign-in/anonymous denial passed; authenticated public and production recovery checks remain pending. See [native-recovery-and-xlsx.md](native-recovery-and-xlsx.md). See [workspace-completion-local.md](workspace-completion-local.md).

Historical UI update (2026-11-06): all ten authenticated CRM pages now share the sidebar/top bar and three persisted themes; sign-in/invitation screens use the same theme frame. Cross-page browser checks passed locally. See [ui-theme-rollout.md](ui-theme-rollout.md). This does not change any live integration status or authorize another backend roadmap step.

Source mapping retained from the earlier full review of supplied Crm.Pdf (version 1.0, 26 pages, sections 1-30). The original PDF was not found for this re-review; this is not a fresh page-by-page validation. The numbered roadmap stays paused.

Prior website observation (2026-11-05, not repeated here): /Wife/ was an advertorial leading to another storefront, not the ZIP order form. Actual live collector/Sheet acceptance remains unverified. See [developer handoff](live-wife-developer-handoff.md).

Status meanings: **Tested locally** means repository implementation with specified local evidence; it is not production acceptance. **Pending** includes missing/partial work, external verification, owner decisions, optional/deferred items and explicit exclusions. **Working live** requires observed authorized public feature behavior. No item is newly promoted to Working live. Temporary tunnel sign-in/theme reports are not live order/Sheet or production-recovery acceptance.

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
| 4 Admin status/default-column settings | Tested locally | Implemented in /app/settings with role/revision protection; fresh workspace-settings tests passed |
| 4 One consolidated settings page for mappings/imports/integrations | Pending | Existing modules are grouped under Admin/Settings; literal single-page consolidation is not implemented. See P01 in pdf-pending-review.md |
| 5 Large editable table, scrolling and sticky headers | Tested locally | Main table and stylesheet; existing browser evidence |
| 5 Freeze Timestamp, Name and Mobile | Pending | Name/Mobile are frozen. Received is compact IST with a full tooltip, not frozen; this matches the later requested compact layout. Timestamp parity is an owner layout decision (P02) |
| 5 Inline customer details and dropdown status | Tested locally | Direct row Status saves with a version check; ellipsis menu opens explicit customer/answer editing. Existing browser/stale-edit evidence |
| 5 Automatic status saving | Tested locally | Changing row Status saves immediately through the existing version-checked API; it does not record a call |
| 5 Automatic customer/answer-field saving | Pending | Other edits use Save row; no full-field autosave. See P03 |
| 5 Real-time updates across users | Tested locally | Prior Step 9 Realtime two-session evidence; fallback authoritative reload |
| 5 Search name/mobile | Tested locally | Server search; current main synthetic search |
| 5 Search Lead ID / Creative ID | Tested locally | Server literal Lead/submission/order/reported Creative ID search within existing tenant/filter scope |
| 5 Multi-column server filters, sort/date and pagination | Tested locally | Lead-view/submitted-order SQL tests; combined main UI source filters |
| 5 Column resizing / reordering | Tested locally | Personal width controls and accessible move-left/right ordering; frozen identities preserved |
| 5 Hide/show columns | Tested locally | Personal fixed/answer column visibility; Name/Mobile/Actions remain mandatory |
| 5 Saved custom views | Tested locally | Private filter/sort/quiz-column/page-size views; no arbitrary column layout |
| 5 Permission-controlled CSV/Excel export | Tested locally | Admin-only filtered CSV and native XLSX are implemented, text/formula-safe and audited; export/XLSX tests revalidated in this review |
| 5 Lead detail panel / history / activity timeline | Tested locally | Right-side Order/Source/Answers/Calls/Follow-ups/History drawer reuses existing APIs; main browser checks passed. See all-leads-ui.md |
| 5 Saving/success/error indicators | Tested locally | Existing row and request state messages |
| 6 Standard timestamp/name/mobile, optional dynamic fields | Tested locally | Server timestamp and validation, JSONB answers; original values preserved |
| 6 Unknown field registration and source association | Tested locally | Dynamic-field and ingestion tests, prior main-backend evidence |
| 6 Column selector and retaining older questions | Tested locally | Scoped source/version quiz definitions and saved views |
| 6 Admin default-column configuration | Tested locally | Organization fixed/answer-column defaults; personal browser layout/reset |
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
| 8 Admin add/rename/colors/reorder/disable/category mapping UI | Tested locally | Audited revisioned Admin UI; system and used categories protected for counting |
| 8 Legacy Status/Status 2/callers/reasons retained | Tested locally | Import mapping preserves legacy values without invented attempts |
| 9 Current/first/latest confirmation identity/time and status history | Tested locally | Confirmation event SQL, prior call verification |
| 9 No duplicate confirmations on repeated Confirm save | Tested locally | Revision/idempotency checks; prior cancel/reconfirm tests |
| 9 Current confirmed vs event-date vs received-cohort reports | Tested locally | Separate report definitions and filters |
| 10 Attempts, distinct attempted, confirmations and conversion | Tested locally | Performance tests/prior integration; documented formulas |
| 10 Connected leads when outcome proves connection | Pending | No general connected-outcome classification verified |
| 10 Pending/overdue/CNP/Retry/Cancel and first/last activity | Tested locally | Existing callback/outcome/staff performance reports; prior evidence |
| 10 Caller table and daily confirmation activity | Tested locally | Existing report with separate first/reconfirmation counts |
| 10 Today/yesterday/7 days/custom periods | Tested locally | Performance filters; current preset includes last 30 days |
| 10 This-month/caller/status filter parity | Tested locally | IST month preset, current-status filter and explicit caller event scope |
| 10 Brand/product/landing page filters | Tested locally | Frozen catalog snapshot filters |
| 11 Operational KPI cards and daily trend / leaderboard / status outcomes | Tested locally | Existing management performance tables and cards |
| 11 Eight operational charts, hourly arrivals, reasons, caller/status filters | Tested locally | Implemented dashboard/chart components and authoritative report scope; performance tests revalidated |
| 11 Connected quality, trusted OTP metrics and reliable live budget insights | Pending | Separate report/data gaps remain; implemented charts are not these missing classifications/provider acceptances. See P08/P09/P12/P28 |
| 11 Product/page/creative comparisons | Tested locally | Separate performance/attribution modules; not one complete dashboard |
| 11 UTC storage and Asia/Kolkata reporting | Tested locally | Existing timestamp rules and boundary tests |
| 12 Preserve campaign/ad-set/ad/creative/account/placement/click/UTM claims | Tested locally | Dynamic original answers; explicit claims now visible by default when supplied |
| 12 Missing tracking Unknown; no guessed Meta creative identity | Tested locally | Version-specific CodLive mapping and tracking tests |
| 12 Creative lead/confirm/CNP/Retry/rate reports | Tested locally | Existing attribution reports/tests; live capture incomplete |
| 12 Date/brand/product/campaign/account/page/creative/version filters | Tested locally | Existing attribution/campaign report scopes; actual live URL macros unverified |
| 12 Cross-account Master Creative mapping and languages | Tested locally | Existing explicit creative/campaign mappings; external software link pending |
| 13 Meta OAuth, account discovery and read-only spend sync implementation | Tested locally | Existing provider/worker/report model; Meta core/sync tests revalidated with simulated provider data |
| 13 Actual Meta consent/account selection/worker/sync acceptance | Pending | App ID/Secret and worker DB URL absent; valid-format encryption key exists; public HTTPS origin absent. No real provider session/sync verified |
| 13 CPL / cost per confirmed lead / efficiency | Tested locally | Coverage-aware partial-capture reports; reliable live campaign costs pending |
| 13 Creative Performance Software data connection | Pending | No real external system integration verified |
| 13 Advisory budget recommendations / automatic changes | Pending | Recommendations absent; automatic budget changes excluded |
| 14 Original OTP labels retained independently | Tested locally | Untrusted legacy OTP metadata; never confirmation proof |
| 14 Backend OTP request/verify, lifecycle, resend/expiry/throttle/provider secrets | Pending | Optional for current pilot by owner; no provider integration or trusted OTP verification claimed |
| 14 Save before OTP, later trusted verification update; key rotation | Pending | Requires provider/deployed implementation and authorized rotation |
| 15 Apps Script forward/synchronize compatibility | Pending | Browser dual delivery prepared instead; no Apps Script deployment inspected |
| 15 Existing JSON public lead API, validation, UUID/time/source, dynamic/tracking/idempotency/receipt | Tested locally | Actual main challenge/POST/browser and database integration |
| 15 Form-encoded ingestion | Tested locally | Direct main API URL-encoded retry verified; answers supplied as JSON text. See public-lead-api.md |
| 15 Rate limits/challenge/bot mitigation/size/sanitization/origins/logging | Tested locally | Existing ingestion tests; real HTTPS proxy/CORS still pending |
| 16 Duplicate request vs intentional repeat inquiry | Tested locally | Stable source-scoped submission UUID; separate repeat-mobile lead indicator |
| 16 Configurable repeat policy | Pending | Current behavior preserves repeat inquiries; no full policy UI |
| 17 Organization/brand/product/page/version hierarchy and reporting | Tested locally | Catalog and scoped report tests; optional unknown mapping retained |
| 18 Admin/Manager/Telecaller/Analyst backend role boundaries | Tested locally | Existing RLS/API tests; analysts denied raw customer PII |
| 18 Admin export/status/default-field controls | Tested locally | Admin status/default fixed/answer columns and bounded CSV/XLSX export implemented; current workspace-settings/XLSX tests passed. See P16 |
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
| 25 HTTPS, backup/restore drill, retention/deletion policy, production credentials | Pending | Native tools and prior 77-table local restore exist. Owner reported temporary tunnel login/theme success; full production recovery, retained secrets/Storage/Auth coverage and policy remain unverified. See P22 |
| 26 Phase 1/2 roadmap | Pending | Calling/settings/export/charts are implemented locally; live capture and other qualified PDF/policy gaps remain. Roadmap paused; not a separate missing-report item |
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

The simpler daily calling view is **tested locally**, documented in [simple-calling-workflow.md](simple-calling-workflow.md). It reuses the existing lead search, calls and follow-up APIs. Browser saves were intercepted; no test call or new lead was persisted. This does not change the pending live website/real Sheet acceptance status.


No UI, provider or live website behavior was newly exercised by this documentation review. Current shared UI evidence is in [crm-reference-workspace.md](crm-reference-workspace.md); earlier fixture-based acceptance remains historical evidence, not a newly rerun live check.
# Workspace settings, export and dashboard delivery

Local implementation, 2026-11-12. Existing data, accounts, permissions, explicit-call semantics, confirmation rules, Admin and Invite Staff are preserved. No hosting, deployment or GitHub push.

## Admin settings

/app/settings is Admin-only. Statuses support add, rename, color, numeric order and activation with audited, revision-checked RPC writes. New and Confirm retain their system category and must stay active. Used categories cannot be remapped retroactively: create a new status instead, preserving historical counting. Cross-organization edits, direct table updates and non-Admin writes are denied.

Organization default columns include visibility, order, width and scoped dynamic answer columns. Name/Mobile stay first and frozen; Actions stays last. All Leads supports a personal browser layout scoped to the authenticated user and organization, a reset to organization defaults, numeric width controls (100-600px) and accessible move-left/right controls. This is not drag-and-drop. Existing server saved filter/views remain available. Saved-view answer columns take precedence when opened explicitly.

## Search and export

The existing server search now matches CRM Lead ID, submission UUID, supplied order ID and reported creative_id / AdCrevId / ad_id, in addition to name/mobile. It uses literal matching within the existing organization/filter scope and does not infer attribution or broaden Analyst access.

Admin-only CSV export uses the applied server filters across all matching pages. It rejects more than 5000 rows or 8 MB instead of silently truncating. A stable SQL collector captures the filtered pages under one statement snapshot before the legitimate export audit is appended. The file includes original customer/order/source/dynamic answer fields; missing traffic remains Unknown. UTF-8 BOM, quoted fields and formula-trigger escaping support safe spreadsheet opening. CSV and native XLSX are available; see native-recovery-and-xlsx.md for the subsequent format/recovery verification. Export files and private credentials stay ignored.

## Reports

The existing authoritative performance RPC provides This month, current-status filtering and permitted caller-activity selection. New charts show daily CRM arrivals, call attempts, confirmation events, received-cohort current statuses, hourly IST arrivals, call outcomes, top-20 supplied reasons and top-10 first-confirmation leaderboard. Original daily/staff/activity tables and attribution/product/page comparison modules remain available.

Caller filtering applies to event activity; organization cohort/current-state figures are not converted into caller-owned leads. Status is current status at refresh. Telecallers keep self-only performance and cannot receive organization arrival/status metrics through the new aggregates. Reasons are supplied text, not an inferred connected-call quality classification. First confirmations and reconfirmations remain distinct. Budget recommendations, trusted OTP metrics and reliable live spend/attribution remain pending; this does not certify every PDF report as complete.

## Executed checks

Checked development migrations 035-039 were applied through the existing checksum ledger. Already-applied files were not rewritten. Pre-existing record/password fingerprints matched (legacy status comparisons exclude only newly added presentation/revision columns).

The full automated suite passed 53/53 tests with zero failures/skips; typecheck, production build and browser secret scan passed. Isolated SQL tests exercise status revisions, protected categories, Admin/tenant boundaries, default answer scopes, null/malformed layout rejection, literal ID search, multi-page 60-row export, export permissions and performance scopes. Browser checks on localhost:3000 use only the retained existing API lead/Admin; they verify settings draft/save errors with writes intercepted, real ID search, width/order/visibility persistence, frozen columns, a real filtered CSV and its legitimate audit entry, month-filtered eight charts, and mobile settings. Every existing business record/password remains unchanged; no new leads/staff are created. Configuration save success is proven in isolated SQL, not by altering the operator's live defaults/statuses for a demo.

Detailed ignored evidence: .cache/admin-workspace/evidence.json and screenshots. Existing All Leads regression separately checks call/callback draft retention, guarded close, simulated uncertain retries/stale edits and actual server filters.

## Remaining external work

The owner made customer OTP optional and authorized temporary ngrok access. Actual OTP and permanent production hosting remain pending. A scoped native local restore now passed for 77 tables; HTTPS sign-in/anonymous denial passed, while authenticated public checks need separate approval. Full production recovery is not certified. See production-and-otp-readiness.md for exact prerequisites and the prepared recovery/deployment procedure. Live website-to-CRM/real Sheet and actual Meta consent/sync remain pending independently.

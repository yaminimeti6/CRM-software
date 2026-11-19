# CRM security and Sheet-data readiness review

Reviewed 2026-11-19. Decision: controlled mapping pilot only; this is not an unconditional approval to upload an entire real customer Sheet or expose the CRM publicly.

## Scope and evidence

- Inventoried/scanned 370 tracked working-tree files for configured private values. Reviewed security-sensitive application routes, authentication/session helpers, import/parser/mapping code, exports, public ingestion, Meta isolation, migrations, configuration and recovery documentation. This was not a line-by-line penetration test of every file, an independent certification or a full Git-history secret audit.
- Full current test suite: 64 passed; zero failed/skipped. Includes isolated database scenarios for organization separation, role denials, imports/retries, dynamic answers, calls/follow-ups, export and Meta.
- Current npm audit: zero reported vulnerabilities. This does not rule out undisclosed vulnerabilities.
- Read-only metadata from the actual configured Supabase database: 32 public tables, no anonymous table SELECT/INSERT grants, no exposed non-RLS public table, no anonymous USAGE on crm_private. The only anonymously executable public SECURITY DEFINER found was the rls_auto_enable trigger helper; this inventory alone does not prove all RPC behavior safe.
- Anonymous main-CRM reads for leads, imports, team, workspace settings and Meta admin returned HTTP 401. Anonymous POST to the import-upload route returned HTTP 401. A GET to that POST-only route returned HTTP 405.
- Nine configured private-value patterns were checked without printing them. No matches in current tracked file contents, 25 last-preview static assets, 25 .next/static assets or 70 current development static assets. Historical commits, remote logs, backups and other PCs were not scanned.
- No real customer Sheet was supplied, uploaded or modified. Existing accounts/passwords/leads were not changed by this review. Existing unrelated working-tree changes were preserved.

## Findings and required decisions

### 1. Import field placement needs explicit verification before bulk import

Evidence: src/lib/import-input.ts maps the suggested `price` role into legacy metadata. Unknown headings such as `course` default to legacy. The order projection in supabase/migrations/202611040033_submitted_orders.sql reads `original_answers.course_name` and `original_answers.course_price` instead.

A memory-only preview demonstrated that default course/price suggestions preserve original values but leave the canonical order fields empty. Explicit quiz mappings to course_name/course_price populated both, with the leading-zero phone preserved and no preview errors. No example inquiry was inserted into the main CRM.

Impact: raw data can be retained while All Leads shows Unknown in the intended Course/Price columns. Successful upload does not prove correct business placement. Website/page URL, reported traffic keys, campaign identifiers, historical timestamps, statuses, comments and external IDs also need the actual Sheet's mapping reviewed; they must not be guessed from headings alone. Existing phone digits lost by Excel cannot be reconstructed reliably.

### 2. Shared company access is intentional

Active Admin/Manager/Telecaller roles share permitted customer leads within their organization. Creative Analyst does not receive customer-record access; exports/imports are Admin-controlled. This is not an assigned-agent-only privacy model. Independent customers require separate organizations, not additional staff accounts in the same company. Confirm this model with the owner before giving employees access.

### 3. Production browser/hosting hardening remains pending

The current localhost login response did not include Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, a general Referrer-Policy or HSTS. next.config.ts only adds selected invitation/team headers. Missing CSP/frame protection weakens browser defenses; this is a hardening gap, not proof that customer records have leaked. HSTS must be configured at the actual HTTPS deployment, not used as a claim about localhost HTTP.

No permanent host/public HTTPS CRM origin is selected in the readiness check. Authenticated production behavior, proxy limits, monitoring, HTTPS configuration and public-facing request controls still need deployment-specific testing. No deployment or header change was made during this review.

### 4. Privileged local credentials and backup coverage need operational controls

Customer data is stored in the configured Supabase cloud database, not solely inside this project folder. Private .env files include credentials that can perform privileged operations. Git-ignore and browser separation reduce accidental publication but do not protect against a compromised PC/cloud administrator or shared filesystem access. Restrict operator access and keep secrets and backup recovery material out of chats, exports and Git.

An earlier scoped local restore drill recorded 77 matching tables; it was not repeated here. Current readiness still reports production backup/restore unverified and no independent restore target configured. Verify scheduled backups, retention, independent recovery and secret recovery before making this the sole customer-data store.

### 5. Public capture and file safeguards have limits

Public lead submissions have bounded payloads, source checks, challenge verification, protected-field rejection, rate limits and retry handling. CORS/origin/challenges are not customer authentication or proof of advertising attribution. Live website to CRM plus real Sheet acceptance remains pending.

CSV/XLSX uploads are Admin-only and size/row/cell bounded; XLSX parsing rejects macros, external links, unsafe archives and DTD/entities. Formula/unsafe numeric cells require explicit correction/exclusion. CSV export prefixes formula-trigger text; XLSX writes literal strings. These controls are not a malware-scanning certification.

Raw import uploads/staging have a seven-day expiry and expiry checks/housekeeping functions. Physical cleanup is invoked by application housekeeping or an authorized cleanup function; continuous production scheduling and retention beyond that mechanism were not verified. Persistent imported lead data and local exports have different retention needs.

## Safe next data step

1. Keep the original Sheet as the source-of-truth backup. Supply only headers and 5-10 masked representative rows for mapping review, or place an authorized private CSV/XLSX in the ignored local import area; do not paste an entire customer list into chat.
2. Approve the field map: name/mobile/address, course/price, order/external ID, website/landing page versus traffic, campaign/ad fields, dynamic answers, status and dates/timezone. Reliable external identity must be selected explicitly; matching mobile alone is not a unique order ID.
3. Run the existing import preview. Review invalid/formula/numeric-phone rows and date/status mappings. Do not silently discard or force-correct invalid records.
4. After an authorized small import, reconcile accepted/rejected/skipped counts, sample saved values in All Leads/detail panels, source versus traffic, leading zeros and same-file/external-ID retry behavior. Importing historical Confirm must not fabricate a call/confirmation event or verified OTP.
5. Proceed to bulk import only after mapping approval and backup readiness. Automatic Google Sheet/live website synchronization is a separate unverified integration.

## Primary guidance used

- https://supabase.com/docs/guides/database/postgres/row-level-security - RLS and grants together define access; privileged secret/service keys must remain server-side.
- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html - authorization, bounded file sizes and decompression limits are relevant upload defenses.

No code, permissions, customer data, hosting or integrations were changed by this review. The report is local-only; no GitHub push or deployment.

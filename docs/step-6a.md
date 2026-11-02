# Step 6A: development lead ingestion (Step 6B remains pending)

This milestone implements the CRM receiver and a synthetic local form only. It does **not** integrate, inspect, edit or replace the live website, Google Sheet or its unseen Apps Script. The existing collection path must remain operational. Steps 1–5 remain accepted; no CSV import or other module is included.

## Source configuration and trust boundary

An active Admin opens **Lead sources** (`/app/ingestion`) and registers a source name, globally unique public form identifier (8–100 letters/digits/underscore/hyphen), optional version, exact allowed origins and enabled flag. New sources default disabled. Configured brand/product references are optional opaque source metadata, not newly invented brand/product catalog entities. They are snapshotted server-side for each accepted inquiry; public fields cannot select another organization or override these associations.

The Admin's authenticated membership determines the organization. Source identifiers cannot be renamed/reassigned after creation; disable an old source and deliberately register a new identifier when needed. Configuration revisions reject stale edits. Admins see only their organization sources/status; Telecallers, Managers and Creative Analysts cannot configure sources or view ingestion counters. Operational staff may read their existing organization leads and protected ingestion metadata; Analysts and other organizations cannot read customer PII.

Public ingestion has no staff-session requirement. Its routes bypass staff-cookie refresh and use a server-only privileged client to call narrowly scoped database functions. Anonymous/authenticated database roles cannot execute ingestion, source lookup or limiter RPCs directly and cannot insert into protected tables. Existing staff create/edit/call/follow-up paths retain their checks.

Migration: `supabase/migrations/202611020015_public_ingestion.sql`. Apply using `node scripts/migrate.mjs` with the existing private operator configuration. It creates source/statistics/metadata/rate tables and RLS/RPCs. Public leads/audit rows have a **null staff creator/editor**, displayed as Public source ingestion; no real staff identity is fabricated. Existing values are unchanged. A lead's initial UUID, receipt time, configured New calling status and metadata are committed atomically with the existing field registry/audit trigger.

## HTTP contract

1. Obtain a short-lived public bot-check challenge:
   `GET /api/public/lead-challenge?form_id=YOUR_PUBLIC_FORM_ID`.
   Use the registered Origin. A same-origin browser GET may omit Origin; the endpoint uses its actual request origin. Response: `{ "challenge": "PUBLIC_SHORT_LIVED_VALUE", "expires_in": 600, "min_wait_ms": 1000 }`.
2. Wait at least one second; submit to
   `POST /api/public/leads?form_id=YOUR_PUBLIC_FORM_ID`.
   The query identifier is used for cross-origin JSON preflight; the body identifier is independently checked for routing. Do not omit the query on a cross-origin JSON integration.
3. Send `Content-Type: application/json` or `application/x-www-form-urlencoded`. Form encoding uses JSON text in its `answers` field. Repeated form keys are rejected. No `no-cors`, fire-and-forget or redirect-based success claim is used.

Example JSON (synthetic values only):

```json
{
  "form_id": "YOUR_PUBLIC_FORM_ID",
  "submission_id": "00000000-0000-4000-8000-000000000001",
  "challenge": "PUBLIC_SHORT_LIVED_VALUE",
  "name": "Synthetic Customer",
  "mobile_no": "000123456789",
  "address": "Synthetic address",
  "lead_id": "optional-external-reference",
  "timestamp": "optional-original-source-time",
  "otp_status": "Verified",
  "answers": {"Improvement_Area": "Synthetic", "AGE/WGHT": "Synthetic"},
  "AdCrevId": "raw-source-reference",
  "website": ""
}
```

`name` is required (trimmed, 1–200 characters). `mobile_no` is required: 6–20 digits, 6–25 total characters, optional plus/spaces/parentheses/hyphens; leading zeros remain intact. Address is optional, up to 2000 characters. `form_version`, when supplied, must match the registered version. Missing tracking values do not invalidate a basic inquiry.

The whole HTTP body is limited to 32,000 bytes. Up to 55 transport/core/flat fields, 30 merged quiz fields, 80-character nonempty quiz names, 1000-character scalar text values, 20 items per nested collection and bounded answer nesting are allowed. The answer traversal depth counter is capped at two from the answer root; deeper values, excessive field counts and unsafe prototype keys fail. The existing lead answers byte/field limits are also enforced. Only original JSON-compatible values are stored. Duplicate flat/nested keys with conflicting values fail.

After a durable transaction:

- New inquiry: HTTP 201, `{ "ok": true, "accepted": true, "replayed": false, "submission_id": "CLIENT_UUID" }`.
- Identical retry: HTTP 200 with `replayed: true`.
- No customer name, phone, internal lead UUID, existing lead record, same-phone existence or repeat details are returned.
- Errors: `{ "ok": false, "error": { "code": "STABLE_CODE", "message": "SAFE_MESSAGE" } }`.
- 400 validation/bot/malformed payload; 403 disabled/unknown/disallowed source; 409 conflicting idempotency content; 413 oversized body; 429 durable throttle; 503 service/transaction failure (not a success). Preserve the same submission ID/body for safe retries. A raw database/credential error is never returned.
- GET `/api/public/leads` is not a customer lookup and returns 405. CORS OPTIONS checks the configured source/origin; no credentials or wildcard origin is granted.

## Mapping and preservation

| Submitted field | Stored meaning |
| --- | --- |
| `name`, `mobile_no`, `address` | Validated standard lead fields |
| `timestamp` | Original source time text, **not** authoritative receipt time |
| `lead_id` | External lead identifier, **not** the CRM UUID |
| `otp_status` / answer `OTP` | Untrusted legacy OTP metadata; never proof of verification |
| `Improvement_Area`, `Weight_Down`, `Age`, `bottle`, `AGE/WGHT`, `PRICE`, `comment` | Dynamic answers under their exact original field names; comment does not silently become staff Notes |
| `campId`, `place`, `AdCrevId`, `AdCrevName`, `FbClickId` | Original answers plus separate raw advertising metadata |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | Raw advertising metadata when available |
| Other permitted fields | Original dynamic JSON answers; no guessed caller/status meaning |

Original submission/answer JSON is preserved separately, excluding only challenge/honeypot transport values. Strings/numbers/booleans/arrays/objects retain their types there. For compatibility with existing spreadsheet editing, lead `answers` contains string representations; nested values use JSON text. Unknown quiz fields are registered transactionally and appear in Choose quiz columns. Staff edits to display answers do not rewrite immutable original source metadata.

Normalized mappings are explicit references: `campId → campaign_reference`, `place → placement_reference`, `AdCrevId → source_creative_reference`, `AdCrevName → source_creative_name`, `FbClickId → facebook_click_reference`. **AdCrevId is not assumed to be Meta's creative object ID.** No Meta lookup or inferred attribution is added.

Protected organization/source UUIDs, configured associations, caller identity, role, calling status, receipt/creator fields, confirmation details, attempts/counts and trusted verification flags are rejected. A public inquiry always receives its source organization's configured active New status. It never creates a call, confirmation or follow-up. Ambiguous unknown caller-like legacy columns are not interpreted as authenticated identities or operational statuses.

`lead_ingestion.otp_trusted` is constrained false in this milestone; there is no public or staff shortcut to make it true. Legacy OTP labels remain untrusted even if they say Verified. Answer `OTP` is visibly prefixed Untrusted source, and public lead rows are labelled OTP untrusted. Existing manually maintained OTP quiz answers are not rewritten. A future trusted verification path must authenticate the server/provider and use a separately reviewed migration; no provider or provider secrets are added here.

## Dynamic field identities (Step 6A correction)

The sample Sheet is a reference, **not a fixed schema or exhaustive question list**. Only name/mobile are required customer inputs; the authoritative received timestamp is server generated. Existing optional standard address remains optional. Form ID/submission UUID/challenge are transport controls, not mandatory Sheet questions. Unknown permitted flat fields or answer keys remain dynamic within the documented safety limits. The advertised root answer limit is 30 (nested objects retain their own smaller bounds).

Migration `202611020016_scoped_dynamic_fields.sql` adds a source registry keyed by **organization + source UUID + snapshotted form version + exact original field name**. It backfills known original/current/historical answer keys without rewriting existing answers, receipts or history. Future unknown fields register automatically in the same database transaction; they require no field-specific code or schema change. Equal names from different sources/versions are separate identities. No question meaning or equivalence is guessed from its name.

The staff-only All Leads `fields` response now contains descriptors `{id, field_key, label, source_id, form_version}`; rows include their server-derived `quiz_scope`. The public submission contract is unchanged. The selector labels source questions as `Question [form_id / version]` and uses stable definition IDs. A selected source/version column only displays/edits rows with that exact scope; other rows show Not applicable. Manual/legacy records without reliable source metadata remain explicitly unclassified; their columns never read/write public-source rows. Existing historical definitions are retained rather than guessed into a source.

After a form version changes, old lead scope/answers stay on their original version. Staff edits to an older lead register any new question in that older scope, not today's configured version. Original typed source JSON remains immutable; editable spreadsheet answers remain compatible string representations. To change the meaning of an existing question key, set a new source form version (for example v1 to v2) before submitting the revised page. An empty version is a separate, explicitly unversioned context; the receiver cannot infer a semantic version from an unseen page.

## Idempotency and repeat policy

Generate one UUID when a deliberate inquiry begins and freeze its content while submission is uncertain. The synthetic local form stores its pending request in tab-scoped sessionStorage until confirmed success or an explicit new inquiry, so refresh after a lost response retains the same ID/content. This contains synthetic test input only, never a staff session or private key; it is not a production source retry queue. Retry with the same UUID and content, even after refreshing the expiring challenge. Canonical parsed JSON content is compared inside a source-scoped transaction lock and unique `(source_id, submission_id)` constraint. JSON/form transports must preserve the same value types. Transport challenge/honeypot refresh does not change inquiry identity.

Concurrent identical retries create one lead and replay its receipt. Conflicting content under the same UUID returns 409; it never overwrites staff edits. A later deliberate inquiry, including the same mobile, uses a fresh UUID and creates a separate lead. Digits-only phone comparison within the organization marks later public inquiries as repeat; public responses never disclose that fact. Public same-phone inserts are serialized for accurate repeat marking. No phone-only deduplication or merging occurs. Disabled sources reject even retries until explicitly enabled again.

## Abuse controls and limits

Source enablement, exact-origin checks, bounded parsing/schema validation, honeypot, signed source-bound 1-second/10-minute bot challenge, durable HMAC-bucket rate limiting and database constraints all apply. CORS, Origin and a public form ID **are not authentication**. A signed public challenge is obtainable by a bot; it is a timing/replay friction control, not a CAPTCHA or identity proof. These controls reduce simple spam; they do not promise elimination of automated abuse.

Per limiter invocation: 60 requests/minute per peer/category, 20 submissions/minute per source/peer (40 challenges), 200/minute per source/category globally. POST also invokes a shared edge limiter before parsing. All retries/invalid attempts consume limits. Counters and limits are stored in PostgreSQL across app restarts, not in process memory. Expired limiter rows are removed opportunistically after two hours; no worker is required. If limit storage is unavailable, ingestion fails closed.

Default `INGESTION_TRUST_PROXY=false` groups traffic into a shared peer bucket; do not pretend it is unique-client limiting. Enable only after deployment provides a trusted proxy that overwrites `x-forwarded-for`. Internet deployment additionally needs HTTPS, edge request/rate protections and monitored abuse response. Browser code contains no private API key. Rate buckets HMAC peer addresses with a server-only secret; peer addresses/payloads are not stored/logged by this implementation. Hosting access-log policies must also be configured at deployment.

The Admin aggregate view shows accepted new inquiries, identical committed retries, rejected recognized-source requests and last accepted server time. Unknown sources cannot be attributed to an organization; early requests with no recognizable source are not counted against a configured source. Rejection counting cannot persist during database outage; successful acceptance is never claimed during that failure. No customer payload or phone is used as a counter label/log entry.

No forwarding adapter is invented for the unseen Apps Script. If later authorized, a server-to-server adapter must use its own scoped/revocable server credential, not public form identifiers or browser JavaScript secrets; it needs a separately implemented/reviewed authentication path.

## Local configuration and Gujarati manual check

The existing server-only Supabase configuration is reused. `.env.example` contains placeholders only. Optional `INGESTION_RATE_SECRET` is a separate long random server secret; absent it, the existing Team secret is used with a separate HMAC purpose. No secret is requested in chat.

Synthetic test form is disabled by default, including a production build. To opt in locally, set `CRM_ENABLE_INGESTION_TEST_FORM=true` in ignored `.env.local`, keep `CRM_APP_ORIGIN` as the exact localhost origin and restart the dev server. The opt-in page remains restricted to a localhost/127.0.0.1 configured origin. Keep the flag false/unset for deployment. Its requests explicitly use `credentials: 'omit'`; no staff cookie is needed. Only synthetic names/phones should be entered there.

Manual steps:

1. Admin તરીકે login કરો → **Lead sources**. Source name `Synthetic local test`, form identifier `synthetic_local_test`, Allowed originsમાં appનો exact origin લખો, ઉદાહરણ `http://localhost:3000`. Version optional છે. **Enable source → Save source**.
2. ઉપર જણાવેલો local-only test flag સેટ કરીને dev server restart કરો. **Synthetic test form** link Incognito windowમાં ખોલો; staff login ન કરો.
3. `Synthetic Customer`, `000123456789` અને quiz field `Synthetic_Manual_Check` લખો. Verification તૈયાર થાય પછી **Submit synthetic inquiry** દબાવો. Accepted database commitનો message આવવો જોઈએ.
4. Staff browserમાં **All Leads → Reload table** કરો. Lead New statusમાં દેખાવું જોઈએ. **Choose quiz columns**માં `Synthetic_Manual_Check` પસંદ કરો; refresh પછી lead રહેવો જોઈએ. OTP labelને trusted verification ન માનો.
5. Test formનું **Start deliberate new inquiry** વાપરી same mobileથી બીજી inquiry કરો: અલગ lead અને staff-only repeat label દેખાશે. Uncertain result આવે ત્યારે પહેલાં **Retry same submission** વાપરો.
6. Admin **Lead sources → Refresh ingestion status**માં accepted/rejected/retry counts તપાસો. કામ પછી synthetic source disable કરો અને test flag દૂર કરો. હાલનું live website/Sheet ચાલુ જ રાખો.

Do not delete existing customer data to test this milestone. Automated verifiers use exact disposable fixtures and clean only those fixtures.

## Step 6B prerequisites, parallel rollout and rollback

Pending: authorized existing form/Apps Script code or read access, actual field/source mappings, deployment configuration and a reachable HTTPS CRM URL. View-only Sheet access is insufficient to inspect or modify its Apps Script. A remote website or Apps Script **cannot reach this laptop's localhost directly**. No claim of live website/Sheet integration or full Step 6 acceptance is made.

Parallel rollout after separate authorization:

1. Obtain/read existing code and preserve its current Google Sheet write behavior. Confirm mappings, stable submission-ID persistence, origin policy and any server adapter credentials.
2. Deploy CRM to a reachable HTTPS endpoint with correct environment/proxy/abuse protections; keep the synthetic test page disabled. Register the live source disabled first.
3. Validate synthetic requests end-to-end in that deployment; enable a controlled source and add a secondary durable CRM send while continuing the existing Sheet collection. CRM failure must not drop the Sheet submission. Handle retries durably in the actual source adapter; do not claim success from an opaque/no-cors response.
4. Compare a small authorized sample and monitor aggregate rejection/retry/acceptance counters before considering any primary-path change. This comparison is pending, not verified here.
5. Roll back by disabling the CRM source and secondary forwarding; retain the existing Google Sheet path. Preserve all previously ingested CRM records, staff edits and idempotency receipts. Do not reset/import/delete customer data or rotate unrelated credentials as a rollback shortcut.

Actual verification evidence is in `step-6a-status.md`.

# Existing main CRM public lead API

Reviewed on 2026-11-05. This uses the existing main CRM implementation and database. No replacement receiver, staff API credential, schema migration or Admin/invitation change is needed. Backend inspection found that JSON, URL-encoded input, unknown dynamic fields, durable retries and origin/challenge checks already exist. This task adds a reusable anonymous HTTP client, a direct main-server verification and an exact contract/evidence record rather than changing working ingestion semantics.

## Exact local endpoints

```
GET  http://localhost:3000/api/public/lead-challenge?form_id=crm_http_demo_v1
POST http://localhost:3000/api/public/leads?form_id=crm_http_demo_v1
```

Send `Origin: http://localhost:3000` for this synthetic source. The POST body `form_id` identifies the source; keep the query identifier identical for challenge/preflight/POST. A POST without the query can also use the body identifier. The configured source must be enabled and allow the exact origin. A command-line HTTP client must explicitly send Origin; cookies, Authorization and API keys are unnecessary. This is public submission access, not public permission to read CRM records.

The source is exclusively synthetic, named `Synthetic /Wife/ HTTP API demo (local)`, version `codlive-v1`, owned by the existing organization Admin. Its sole allowed origin is localhost:3000. The verifier disables it after verification. It must be deliberately enabled by the existing Admin before using the standalone request, or use the operator verifier below, which enables only its validated synthetic fixture and disables it again.

## Accepted fields and limits

| Field | Contract |
| --- | --- |
| `form_id` | Required registered identifier: 8–100 characters, letters/digits/underscore/hyphen |
| `submission_id` | Required stable UUID for one inquiry; reuse with the exact original content on retry |
| `name` | Required nonblank string, trimmed, at most 200 characters |
| `mobile_no` | Required string; 6–20 digits after formatting removal, maximum 25 formatted characters; optional leading + and spaces/parentheses/hyphens |
| `address` | Optional string, maximum 2,000 characters; defaults to empty |
| `form_version` | Optional string, at most 200 characters; always send the exact configured version. Managed catalog versions require it. A changed configuration/content may return 409 |
| `lead_id` | Optional external order/lead ID string, maximum 200 characters; separate from internal CRM UUID and submission UUID |
| `timestamp` | Optional original source-time text, maximum 200 characters; server maintains authoritative receipt timestamp |
| `otp_status` | Optional untrusted legacy label, maximum 200 characters; does not verify OTP or confirm a call |
| `answers` | Optional object of arbitrary permitted dynamic field names and typed JSON values |
| Other permitted top-level fields | Also become dynamic answers; preserve exact names. If a key is supplied flat and nested with conflicting values, reject it |
| `challenge` | Required signed token from the challenge GET for this source; wait at least 1 second; expires after 600 seconds |
| `website` | Honeypot: omit or send empty string. It is **not** the website identity field. Put reported page URL in `answers.page_url` |

Both `application/json` and `application/x-www-form-urlencoded` are accepted. For URL-encoded requests, encode `answers` as JSON text; other form fields are strings. Duplicate form keys are rejected. JSON must be an object, not null/array/scalar.

The whole HTTP body is limited to **32,000 bytes**. There may be at most 55 top-level keys, and at most 30 merged dynamic answer keys. Question names are 1–80 characters, string values at most 1,000 characters, arrays at most 20 elements and nested objects at most 20 keys, with maximum value nesting depth 2. Display-answer JSON text must also fit 1,000 characters per answer and 30,000 bytes in total. Typed values (string/finite number/boolean/null/limited array/object) are preserved in immutable originals; spreadsheet answers use text representations. New permitted questions register automatically by organization/source/version and appear in the quiz column selector without schema changes.

Never supply protected organization/source UUIDs, roles, status IDs, caller/creator/receipt fields, confirmation counters or trusted OTP flags. These are rejected, including within dynamic objects. A public inquiry uses the source organization's active New status and creates no call/confirmation/follow-up. This endpoint is not a staff-edit or OTP-provider endpoint.

## Source, page and tracking

The configured page/source label comes from the server-owned source/catalog snapshot. `answers.page_url` is an unverified reported URL; its hostname is displayed separately from the reported traffic source. For this configured `codlive-v1` source, `campId` reports utm_source, `place` reports utm_medium, `AdCrevId` reports utm_campaign and `AdCrevName` reports utm_content. For other source versions explicit `utm_source` supplies the traffic label. Missing traffic displays Unknown. Neither fbclid nor AdCrevId establishes a verified Meta creative ID.

Fields such as `course_name`, `course_price`, `order_id`, `ad_id`, `creative_id` and new quiz questions are dynamic answers. Supplied order/course/source/advertising details are available in main All Leads. Do not send `website` with a domain: that honeypot triggers BOT_CHECK.

## Sample JSON and reusable request

Use [the complete synthetic JSON](../examples/public-lead.synthetic.json). Its stable inquiry identity and fields include:

```json
{
  "form_id": "crm_http_demo_v1",
  "form_version": "codlive-v1",
  "submission_id": "6875bfac-874e-4784-ab30-41807442951d",
  "name": "Synthetic Sir HTTP Demo 20261105",
  "mobile_no": "9000000000",
  "address": "Synthetic API demo address, Ahmedabad",
  "lead_id": "SYNTHETIC-HTTP-ORDER-20261105",
  "answers": {
    "page_url": "https://dailyhealthfocus.info/Wife/?utm_source=instagram&utm_campaign=synthetic-http-demo",
    "course_name": "1 Month",
    "course_price": 499,
    "campId": "instagram",
    "place": "paid_social",
    "AdCrevId": "synthetic-http-demo",
    "AdCrevName": "synthetic-content",
    "Sir_Demo_Question_20261105": "Unknown field accepted without schema changes",
    "Sir_Demo_Typed_Answer": {"choice": "A", "quantity": 2, "consent": true}
  }
}
```

Use the complete file unchanged when retrying the recorded inquiry. Add the fresh challenge only at transport time. For a deliberate new inquiry, generate a new UUID once, save its complete input, and retain that file while retrying uncertain delivery.

Run from the repository root, with source enabled:

```powershell
node scripts/send-public-lead.mjs examples/public-lead.synthetic.json http://localhost:3000 http://localhost:3000
# Repeat the identical command/file to demonstrate idempotency.
```

The client performs real HTTP GET, waits 1.1 seconds, then POSTs JSON. It reads no environment credentials and prints the actual status/body. The verifier executed this exact standalone CLI command successfully while its source was enabled and observed HTTP 200 with replayed true and no additional lead. Request failures keep the input file unchanged. Source configuration is an authorized Admin action, not something the public client does. An already-recorded fixture returns 200 on every successful replay; a genuinely new UUID/content returns 201 once.

Equivalent explicit PowerShell request:

```powershell
$demoOrigin = 'http://localhost:3000'
$demoInput = Get-Content -Raw examples/public-lead.synthetic.json | ConvertFrom-Json
$demoQuery = '?form_id=' + $demoInput.form_id
$demoCheck = Invoke-RestMethod -Uri ($demoOrigin + '/api/public/lead-challenge' + $demoQuery) -Headers @{Origin=$demoOrigin}
Start-Sleep -Milliseconds 1100
$demoInput | Add-Member -NotePropertyName challenge -NotePropertyValue $demoCheck.challenge -Force
$demoInput | Add-Member -NotePropertyName website -NotePropertyValue '' -Force
$demoResponse = Invoke-WebRequest -UseBasicParsing -Method POST -Uri ($demoOrigin + '/api/public/leads' + $demoQuery) -Headers @{Origin=$demoOrigin} -ContentType 'application/json' -Body ($demoInput | ConvertTo-Json -Depth 10)
$demoResponse.StatusCode
$demoResponse.Content
```

Repeat the whole block with the unchanged file, obtaining a fresh challenge. For a conflict, stop and inspect the original inquiry; do not automatically change its UUID to bypass the conflict.

## Actual HTTP responses observed

First JSON POST, **HTTP 201**:

```json
{"ok":true,"accepted":true,"replayed":false,"submission_id":"6875bfac-874e-4784-ab30-41807442951d"}
```

Same inquiry with a refreshed challenge, **HTTP 200** (also the equivalent form-encoded retry):

```json
{"ok":true,"accepted":true,"replayed":true,"submission_id":"6875bfac-874e-4784-ab30-41807442951d"}
```

Changed content under the same UUID, **HTTP 409**:

```json
{"ok":false,"error":{"code":"IDEMPOTENCY_CONFLICT","message":"Submission conflicts or the configured form version changed. Reload for a new inquiry; retry accepted inquiries with their original ID/content. Existing CRM data is preserved."}}
```

Invalid mobile, **HTTP 400**:

```json
{"ok":false,"error":{"code":"VALIDATION","message":"Enter a mobile number with 6–20 digits; +, spaces, parentheses and hyphens are allowed."}}
```

The following observed POST errors use the same `{ "ok": false, "error": { "code": "...", "message": "..." } }` envelope:

| Actual trigger | HTTP | Code | Exact message |
| --- | --- | --- | --- |
| Protected `status_id` in public input | 400 | VALIDATION | Protected fields cannot be submitted. |
| Missing challenge | 400 | BOT_CHECK | Refresh the form verification and wait one second before submitting. |
| Malformed JSON `{` | 400 | INVALID_PAYLOAD | Send a valid JSON/form object of at most 32 KB. |
| Body above 32,000 bytes | 413 | INVALID_PAYLOAD | Send a valid JSON/form object of at most 32 KB. |
| Disallowed origin, unknown source, disabled source | 403 | SOURCE_UNAVAILABLE | Source disabled, unavailable or origin not permitted. |

The allowed source preflight returned **204** with `Access-Control-Allow-Origin: http://localhost:3000`. Challenge denial returns a separate GET response shape, HTTP 403 `{"error":"Source unavailable."}`. A 403 is expected after the operator verifier disables its synthetic source; the retained CRM lead is still available to authorized staff.

Inspected but **not deliberately induced against the main backend in this task**: HTTP 400 INVALID_SOURCE for malformed/missing form identifiers; HTTP 429 RATE_LIMIT; HTTP 503 NOT_COMMITTED or UNAVAILABLE. Those branches remain in the existing handler. This task does not claim a new live rate-load, provider-outage or transaction-fault exercise.

## Operator demonstration and evidence

With the main CRM running on localhost:3000 and existing ignored operator configuration available:

```
node --experimental-strip-types scripts/verify-public-lead-http.mjs
```

This requires privileged **local operator configuration for fixture setup/verification only**. The actual submission uses the anonymous HTTP client above. It validates/enables only its own known synthetic source, sends JSON and an equivalent URL-encoded replay, checks error responses, verifies one stored lead and typed original answers, logs in as disposable synthetic staff to inspect the actual main All Leads row and dynamically registered question, checks preservation fingerprints, deletes only the verifier staff, and disables its source again. It sends no Sheet request. Existing records, accounts, passwords, Admin and Invite Staff are preserved.

Ignored evidence and screenshots: `.cache/public-lead-http/evidence.json`, `all-leads-row.png`, `all-leads-details.png`. The retained synthetic row can be inspected with an existing authorized staff login at:

```
http://localhost:3000/app?q=Synthetic%20Sir%20HTTP%20Demo%2020261105
```

Observed lead UUID: `fdcefc0c-4d08-4513-a836-b8308e0d075e`. Exactly one lead remained for this synthetic source after retries and error probes. Main All Leads showed configured page `Synthetic /Wife/ HTTP API demo (local)`, reported website `dailyhealthfocus.info`, reported traffic `instagram`, course `1 Month`, price `499`, external order ID and submission UUID. Original typed answer `{choice:"A",quantity:2,consent:true}` was preserved. The new question was registered and its selected table column displayed the expected answer. The reported website is synthetic request data, not evidence of live landing-page delivery.

The reused synthetic phone can show a Repeat inquiry badge because earlier, separate synthetic inquiries share that phone. This is distinct from retry duplication: the source/submission UUID above still identifies exactly one lead. No existing lead was merged or deleted.

Executed checks: three targeted normalizer/ingestion/submitted-order tests passed with no failures/skips; TypeScript and JavaScript syntax checks passed. The application handler and UI were unchanged, so no new production build was necessary; HTTP/browser verification used the running main build. Preservation fingerprints matched after temporary staff cleanup. The five exact staged files passed the secret/artifact scan before local commit. The first 201 receipt is retained separately under ignored `.cache/public-lead-http/first-acceptance.json`; later evidence correctly reports 200 when the already-accepted fixture is replayed.

This proves local main-CRM HTTP integration with the existing configured backend. It does not prove public HTTPS hosting, submission from the deployed /Wife/ page or delivery to a real Google Sheet. Those live pilot blockers remain as recorded in [core-workflow-pilot.md](core-workflow-pilot.md).

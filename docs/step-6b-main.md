# Step 6B in the main CRM

## Implemented

The existing authenticated `/app` All Leads page now always shows Website / landing page, Reported traffic source, Course / price, and Order / submission ID, alongside the existing editable name, mobile, address, status and notes. **Submitted order details** expands the immutable original customer/order fields and dynamic answers; **Raw tracking values** is a separate nested section. No quiz column selection is needed for the summary. Original course/price/order details are not rewritten when staff edit lead fields.

Website is the hostname parsed from the submitted page_url, explicitly reported/unverified; the complete submitted URL is also visible. The configured landing page label and Form ID come from the server-side source snapshot (or its managed catalog page), never from a submitted page identity. `lead_id` is displayed as the external Order ID; permitted dynamic `order_id` is a fallback. The source-scoped UUID is displayed separately as Submission ID. Unsupplied IDs are labelled Not supplied.

For configured version `codlive-v1`, campId means utm_source, place means utm_medium, AdCrevId means utm_campaign and AdCrevName means utm_content. Raw values are retained. For other sources only explicit utm_source is used as a reported traffic label. No platform is inferred from a click ID, campaign text or creative text. Absent/blank source is Unknown; labels are unverified claims, not verified attribution.

Main filters include **Submitted website (reported)**, **Reported traffic source**, and **Configured landing page / Form ID**; choose entries and click **Apply filters**. Website/traffic groups OR their choices; different groups AND, before pagination and counts. Existing catalog landing page filters remain available. Saved views retain these filters; pre-existing 20-key saved views are accepted with empty website/traffic choices. Existing organization/role restrictions remain enforced.

Migration `202611040033_submitted_orders.sql` replaces read/projection/filter functions only; it does not rewrite existing leads, history, answers, sources or accounts. Previous migration 32 supplies the source-specific receipt interpretation. The main configured backend had migrations 1–31; migrations 32–33 were applied after local tests, and every public-table data fingerprint was unchanged immediately after migration.

## Main CRM verification on 2026-11-04

The locally running Next CRM at `http://localhost:3000` uses the existing configured backend; this is not the isolated port 3106 demonstration. The original CodLive browser test copy was served temporarily at localhost:3107, with Sheet and IP endpoints replaced by local mocks and external landing-page requests blocked. It called the actual existing Step 6A public challenge and ingestion routes at port 3000, including real cross-origin HTTP/CORS, server validation and database RPCs.

Retained synthetic record:

- Name: `Synthetic CodLive Main 20261104`
- Main row: `http://localhost:3000/app?q=Synthetic%20CodLive%20Main%2020261104`
- Lead UUID: `7f6e0d3b-142a-4175-b01c-1c5dd60105e1`
- Submission UUID: `d83ea665-651d-4356-901b-6360c0f7b749`
- Form ID: `codlive_main_test_v1`; version `codlive-v1`
- Configured landing page: `COD /Wife/ local API test` (a test label, not evidence of the live deployed page)
- Reported website: `localhost`; complete submitted URL has port 3107
- Reported source: `instagram`; course `1 Month`; price `499`

The initial synthetic inquiry committed. Interrupted client-side observation was recovered with its exact original UUID/content rather than creating another order. Actual API retries returned HTTP 200 with replayed true; database count for this source stayed one. The successful verification run observed one mock Sheet POST; no real Sheet request was sent. The actual authenticated main All Leads component displayed the exact row, original details and submission ID, with quiz columns closed, and combined website/source/Form ID filters returned exactly that one row.

The verification used a disposable synthetic Telecaller in the existing organization and deleted that Auth/profile/membership fixture afterward. All pre-existing record/password fingerprints were checked for preservation; only the synthetic source/metadata/lead and normal organization change-signal updates were added. The test source was disabled after verification; its row and lead remain inspectable by existing authorized staff. Local evidence/screenshots are ignored under `.cache/codlive-main/`, not committed. No real customer files, session tokens or secrets were written there. The main CRM can be opened with the operator's existing login.

Reproduction: prepare the ZIP as described in step-6b.md, run the built main Next CRM on port 3000 with its existing private server configuration, then run `node --experimental-strip-types scripts/verify-codlive-main.mjs`. This script writes to the configured main backend deliberately; it is an integration check, not a unit test. A rerun only resumes the known disabled synthetic source and frozen inquiry after checking their identity; it never overwrites a different source. It retains one synthetic lead and disables the source again. No test staff credentials are printed or persisted. Local automated tests cover filter pagination, old views, malformed filters, original field preservation, raw values, missing traffic and role/organization isolation. Typecheck and production build also pass.

## First /Wife/ pilot — still pending

No public CRM HTTPS host or authorized deployment access has been supplied/verified. `localhost:3000` is not a public API address. The first pilot requires the operator to provide/deploy the actual HTTPS CRM origin; the exact endpoints will then be:

```
GET  https://<PUBLIC_CRM_HOST>/api/public/lead-challenge?form_id=codlive_wife_pilot_v1
POST https://<PUBLIC_CRM_HOST>/api/public/leads?form_id=codlive_wife_pilot_v1
```

The placeholder above is not an available endpoint. Deploy the reviewed CRM code/migrations using the existing server-only configuration, verify its public TLS and edge protections, and verify the challenge/POST/preflight from the actual page origin. No keys belong in page JavaScript.

Configure one separate Admin-owned pilot source:

| Setting | Pilot value |
| --- | --- |
| Source/page name | A clear name identifying the authorized `/Wife/` page |
| Public Form ID | `codlive_wife_pilot_v1` (check uniqueness first) |
| Form version | `codlive-v1` |
| Allowed origins | The exact authorized landing HTTPS origin, with no `/Wife/` path and no wildcard |
| Enabled | Initially false; enable for the supervised authorized pilot |
| Managed catalog mapping | If used, map this source/version to the existing correct landing page/brand/product before enabling |

The authorized page developer must obtain/back up the actual deployed `/Wife/` browser code and compare its form/Sheet function with the supplied ZIP. The ZIP is not Apps Script source and is not proof of the deployed version. Apply/rebase `integrations/codlive/index.patch` against that verified code, upload `crm-adapter.js` beside it, replace the placeholder base with the actual public HTTPS CRM origin and change the Form ID to `codlive_wife_pilot_v1`. Keep version codlive-v1 consistent. Preserve the existing `submitOrderToSheet` function, Sheet endpoint, fields and success handling; call the tested adapter at the order submit call site and permit the CRM origin in CSP. The patch never installs a secret or changes Apps Script. If the live form supplies an external order identifier, pass it to the existing ingestion contract as lead_id (or preserve a dynamic order_id); never replace the stable submission UUID with a fresh UUID on retry.

Before calling the pilot live, submit one clearly labelled, authorized live test order through the actually deployed `/Wife/` page. Verify all of the following with actual observations:

1. Public challenge/CORS/POST succeed over HTTPS and return a durable CRM acknowledgment.
2. The main CRM shows exactly that submission UUID with the intended Form ID/page, website, reported source, course/price and full details.
3. The actual authorized Google Sheet contains the matching synthetic order row. A mocked endpoint or JSON success response alone is not evidence of that Sheet row.
4. Replay the exact CRM UUID/content with a refreshed challenge: replayed true and still one CRM lead. Do not create a fresh form inquiry as the duplicate test.

Do not promise Sheet idempotency or cross-system atomicity: a lost Sheet acknowledgment is ambiguous until Apps Script and the actual Sheet are inspected under separate authorization. Reconcile partial outcomes before retrying. Record the real HTTPS URL, deployment revision, source config, CRM UUID and matched Sheet row as pilot evidence. Until both CRM and the actual Sheet are verified, status remains **local main-CRM integration verified; live /Wife/ pilot unverified**. No public deployment, live page/Sheet change or Git push was performed in this task.

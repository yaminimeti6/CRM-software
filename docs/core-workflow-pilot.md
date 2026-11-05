# Main CRM workflow and /Wife/ pilot

**Live observation update (2026-11-05):** the public /Wife/ page currently returns an advertorial linking to a separate product storefront, not the ZIP order form. The actual collector/Sheet contract must be obtained before any live integration patch can be finalized. See [live-wife-developer-handoff.md](live-wife-developer-handoff.md), which supersedes the earlier assumption that dailyhealthfocus.info itself submits the order and determines the required actual submitting origin. No deployment is authorized.

Numbered roadmap paused by the operator on 2026-11-05. This task repairs the existing main CRM workflow only. Admin and Invite Staff are unchanged. Accounts, passwords, previous leads, history and bootstrap protection are preserved. No deployment or Git push is performed.

## Current result

The main authenticated `/app` already had immutable submitted order details, default name/mobile/address/course/price/order/submission IDs, website and configured page separate from reported traffic, source/website/date/status server filtering, dynamic answers, calling, follow-ups and dashboards. Migrations through 033 already provide these reads and authorization. No schema change is necessary for this repair.

The remaining default display gap was campaign/ad information hidden inside tracking details. All Leads now displays supplied UTM campaign/content/medium/term, legacy AdCrevId/AdCrevName/place, and explicit campaign/ad-set/ad/creative/account identifiers in the reported traffic cell, without opening details or selecting quiz columns. Empty tracking displays Unknown. Legacy names are displayed literally: AdCrevId is not asserted to be a Meta creative ID. The adapter now preserves optional payload `lead_id` and `order_id`, and explicit advertising URL parameters when supplied. Existing Sheet submission code is unchanged.

References reviewed: all 26 pages of `C:/Users/LENOVO/Downloads/Crm.Pdf` (30 numbered sections), `../CodLive.zip`, `integrations/codlive/index.patch`, existing Step 6B code and evidence. ZIP identity is checked by the preparation script; it is browser code, not Apps Script and not proof of the deployed version.

## Verification boundaries

Local automated checks cover immutable submissions, dynamic answers, full-result source/website filters and pagination, Unknown tracking, old saved views, role/organization isolation, ingestion idempotency and browser receipt loss with one mock Sheet POST. Adapter regression covers external order IDs and reported ad claims surviving frozen-payload retry without repeating an acknowledged Sheet. Typecheck and production build are required.

Executed on 2026-11-05: seven targeted automated tests passed, zero failures/skips; TypeScript and production build passed. Browser secret scan passed for 24 JS/map assets. The new main-CRM synthetic submission returned HTTP 201; exact-content retry with a refreshed challenge returned HTTP 200 with `replayed: true`. Source count remained one, with one mock Sheet POST. Authenticated All Leads displayed its source/order/campaign details without opening tracking. Combined website/traffic/Form ID filters and then inclusive IST date plus status filters returned exactly this lead. A follow-on integration run reused the same UUID successfully. All pre-existing table/password fingerprints were preserved; temporary verifier staff were removed and the synthetic source disabled.

- Synthetic name: `Synthetic CRM Core 20261105`
- Main row: `http://localhost:3000/app?q=Synthetic%20CRM%20Core%2020261105`
- Lead UUID: `69573f80-77e3-4669-ba1d-4655d4c9e7b8`
- Submission UUID: `df332cf2-a19b-4a0c-ba4f-5f0586a25314`
- Form ID: `codlive_core_test_v1`; version: `codlive-v1`

Evidence/screenshots remain ignored under `.cache/codlive-main/`. No real Sheet request was sent. This is local main-server integration with the existing backend, not a public /Wife/ acceptance result.

Main integration command (deliberately uses the existing configured Supabase backend):

```
node --experimental-strip-types scripts/verify-codlive-main.mjs --core-workflow
```

This is the actual Next API at localhost:3000 and authenticated main All Leads UI, not the isolated demo. The ZIP form is served temporarily on localhost:3107; all external page requests are blocked and Sheet/IP endpoints mocked. One clearly synthetic source/lead is retained; temporary verifier staff are removed and the source disabled. Subsequent runs resume its frozen submission rather than create more orders. Pre-existing table/password fingerprints are compared. Live hosted acceptance remains pending even when this passes.

## Exact live blockers confirmed by operator

- Actual landing URL: `https://dailyhealthfocus.info/Wife/`.
- CRM is currently `http://localhost:3000`; no public CRM HTTPS endpoint exists.
- Operator has no live page deployment access or Google Sheet edit access. Sir/authorized website developer must assist. Sheet read access or supervised row inspection is needed for acceptance; editing Sheet data is not required merely to inspect the test row.
- Developer must establish whether the deployed page matches the ZIP and inspect its actual Sheet acknowledgment contract. No live Sheet row, Apps Script behavior or deployment is verified here.

## Hosting decision and access needed

Choose a persistent Next.js Node hosting service and an intended HTTPS CRM hostname. Provide access to that hosting project to the authorized deployer, plus DNS access if using a custom domain. The project owner must approve use of the current backend for the pilot, or provide a separate pilot backend with the required migrations. Do not provision a replacement database or recreate staff as an incidental hosting change.

The deployer needs a secure hosting environment configuration channel for the existing server credentials and persistent signing secrets; no secrets in chat, Git or browser code. Follow `.env.example` and existing deployment documentation. Set `CRM_APP_ORIGIN` to the actual HTTPS origin. Validate login/session behavior, Supabase Auth URLs, migrations through 033, database connectivity, challenge signing, rate limiting and trusted proxy behavior on that host. Enable proxy trust only if the host overwrites the relevant forwarded IP header. Keep the test form disabled. Do not expose the operator setup environment publicly.

Git push permission is still withheld. Deploy a reviewed local artifact through the chosen host's authorized deployment method, or obtain separate explicit Git push authorization if that host requires a GitHub revision. Hosting account, hostname and budget are operator decisions; no account or paid service has been created.

After deployment, the exact route paths are:

```
GET  https://<CHOSEN_CRM_HOST>/api/public/lead-challenge?form_id=codlive_wife_pilot_v1
POST https://<CHOSEN_CRM_HOST>/api/public/leads?form_id=codlive_wife_pilot_v1
```

These are templates, not functioning public endpoints. Verify TLS, preflight, actual challenge and POST from the landing origin before enabling the pilot.

## Source configuration for authorized Admin

Use existing Lead Sources at `/app/ingestion`. Check Form ID uniqueness first; create a separate source, never repurpose a test/customer source:

| Setting | Value |
| --- | --- |
| Name | Daily Health Focus /Wife/ pilot |
| Form ID | `codlive_wife_pilot_v1` |
| Form version | `codlive-v1` |
| Allowed origin | `https://dailyhealthfocus.info` (no path or wildcard) |
| Enabled | False until supervised pilot; then true |
| Catalog mapping | Correct existing brand/product/page/version if known; otherwise retain Unknown |

For this version, campId is reported utm_source, place is utm_medium, AdCrevId is utm_campaign and AdCrevName is utm_content. Website/landing page are independent. Do not infer a traffic platform or creative ID from fbclid or campaign text. Configure genuine campaign/ad URL parameters deliberately when those identifiers are required.

## Developer handoff

Deliver `integrations/codlive/index.patch` and `integrations/codlive/crm-adapter.js` together. Back up the real deployed page first. Against a matching checkout containing `CodLive/index.html`, run `git apply --check --unidiff-zero <path-to-index.patch>`; only apply after the check and review. If directory/layout/anchors differ, rebase the two script additions and submit-call replacement against the actual source.

Upload the adapter beside the page and configure its initialization as follows, substituting the real HTTPS origin:

```js
const submitCodLiveOrder = createCodLiveCRM({
  base: 'https://<CHOSEN_CRM_HOST>',
  formId: 'codlive_wife_pilot_v1',
  version: 'codlive-v1'
});
```

At the existing order submit call site use `submitCodLiveOrder(payload, submitOrderToSheet)`. Preserve the existing `submitOrderToSheet` implementation, endpoint, fields and acknowledgment/success handling. Keep the existing Sheet flow during the pilot. Allow the CRM HTTPS origin in page CSP connect-src. Never deploy the mock page or `CRM-ENDPOINT.invalid` placeholder. No secret is added to JavaScript.

If the deployed form has an external order ID, pass it as `payload.lead_id` (or `payload.order_id` for a dynamic order field). Do not invent an order ID when absent. The adapter owns a separate stable UUID for CRM idempotency. Its frozen pending inquiry is retained in session storage across retries/reloads; edits do not create a different order while either destination is pending. Pending customer data is tab-scoped and does not survive closing the tab.

## Supervised live acceptance and recovery

1. Record the deployed CRM revision, actual endpoint, source configuration and deployed page revision. Inspect the actual Sheet response contract before testing. Enable the source only when ready.
2. Submit one authorized clearly synthetic inquiry through the deployed `/Wife/` form, with deliberate reported source/campaign parameters. Observe HTTPS challenge/CORS/POST and durable accepted acknowledgment. Capture the UUID without sharing session tokens/customer data.
3. In the main CRM All Leads, locate that UUID, inspect default order/source fields and expanded dynamic answers, and verify one matching lead. Apply website `dailyhealthfocus.info`, traffic source, configured source, IST date and status filters and verify the row/count.
4. Sir/developer with Sheet access must inspect the actual destination Sheet and record the matching synthetic row/tab/time. A successful Apps Script response alone does not establish that row. Do not mark acceptance passed until both destinations are observed.
5. Replay the same CRM UUID and frozen content with a refreshed challenge, preserving Origin and form/version. Expect HTTP 200 and `replayed: true`; verify still one matching CRM lead. This API retry must not call Sheet again. Do not submit a fresh form/UUID as the duplicate test.
6. If a Sheet acknowledgment was lost, inspect the actual row before retrying the form. Browser-only dual delivery cannot guarantee Sheet deduplication or atomicity. Do not repeat an ambiguous Sheet write blindly. Reconcile partial delivery with the authorized developer; disable the source if necessary and coordinate page rollback, because disabling CRM alone leaves the adapter pending.

Keep a minimal evidence record: actual CRM URL/revision, page revision, source/form/version, synthetic UUID, observed statuses, CRM count before/after retry and matched actual Sheet row. Public HTTPS, live page deployment and real Sheet observation are pending; localhost and mock Sheet are not live acceptance.

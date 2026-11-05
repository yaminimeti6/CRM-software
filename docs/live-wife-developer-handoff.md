# Live /Wife/ review and authorized developer handoff

Reviewed read-only on 2026-11-05. No order, cart mutation, page edit, source change, hosting, deployment or GitHub push was performed. No new synthetic lead or staff account was created. The numbered roadmap remains paused; “continue locally” is not treated as authorization to start another roadmap phase.

## Critical finding: the live page is not the supplied order form

Direct HTTP GET returned 200 for `https://dailyhealthfocus.info/Wife/`. Its returned HTML is an advertorial with CTA links to `https://metiveda.com/products/slimofast`. The click handler appends `source=Wife` and the existing query string. It contains no `<form>`, `submitOrderToSheet`, Google Apps Script endpoint or CRM lead API call. This is materially different from `CodLive.zip` and cannot take the ZIP's order-submit patch directly.

Read-only GET of `https://metiveda.com/products/slimofast?source=Wife` also returned 200. Its HTML identifies a Shopify storefront, contains product/cart forms and loads a GoKwik merchant integration script. No Google Apps Script or CRM lead endpoint appeared in that HTML. This does **not** prove how the eventual checkout submits, whether an app dynamically renders an order form, or whether a private server/app synchronizes to Sheet. No checkout was opened or submitted, and no Shopify/GoKwik integration was implemented.

Snapshot identity (returned HTML may include changing platform/edge markup):

| Reference | SHA-256 |
| --- | --- |
| Supplied ZIP index.html | `fb7cafae284472cf3def3c0c8ca3d4c76ba5fb24b96fe2e4fbe4293c23d14c4d` |
| Retrieved live /Wife/ HTML | `b0455bdb5432f480695b4b090c8a8f136c50a88b338b191c84116f6fb28b063a` |
| Retrieved product HTML | `584de922f437112ffac03af00623486666bd42bcbf3eb0ce96eb45c122a9e3ec` |

Downloaded public HTML is ignored under `.cache/codlive-live-review/`; these are observation snapshots, not editable authoritative deployment sources. The web reader failed to open the page, so direct public HTTP GET was used as a read-only fallback. No page scripts were executed during that inspection.

## Exact blockers and access needed

1. **Public CRM HTTPS origin is absent.** The existing CRM is localhost:3000. A remote visitor's localhost refers to their own device; the live page cannot use the operator's loopback API. Owner must choose/authorize hosting and an HTTPS hostname, give the authorized deployer access to that hosting project/DNS if needed, and provide a secure channel for existing CRM environment configuration. Do not create hosting, a tunnel, deployment or a Git push without the operator's later instruction.
2. **Actual order-entry implementation is not supplied.** Sir/website developer must identify the deployed path from /Wife/ through product/checkout and provide the relevant theme/app/server source and supported submission/acknowledgment contract. Access to /Wife/ alone is insufficient if another origin/app collects the customer fields. Existing provider/merchant access must be provided by its authorized owner; do not guess app callbacks or add an unsupported checkout hook.
3. **The real Sheet destination is unverified.** Obtain the authorized Sheet tab/row inspection access (edit access is not required merely to verify a row), actual submission function/Apps Script source if it is used, and the success/error contract. Inspect the current synchronization path before proposing any replacement. The supplied ZIP's Apps Script URL is evidence only of that ZIP, not proof of today's live checkout pipeline.
4. **Pilot deployment access/authorization is absent.** The authorized developer needs backup/revision/deploy access for the actual form location, and any related approved app/server configuration. All changes stay reviewable/local until deployment is explicitly authorized. No secrets in chat, frontend code or Git.

## Prepared patch: conditional ZIP-form integration

Files for the authorized developer:

- `integrations/codlive/wife-pilot.patch`
- `integrations/codlive/crm-adapter.js`
- `integrations/codlive/wife-pilot-config.js`

**This is a validated patch for the supplied ZIP form, not a deployable patch for the currently observed live advertorial or Shopify/GoKwik checkout.** Use it only if the owner deliberately chooses to deploy that form, or the developer establishes that its submit/Sheet contract is the actual authorized order collector. Do not replace the live page with the ZIP under this task.

For a matching source tree containing `CodLive/index.html`, run from its root:

```
git apply --check /absolute/path/to/wife-pilot.patch
git apply /absolute/path/to/wife-pilot.patch
```

The exact change loads `crm-adapter.js` and `wife-pilot-config.js` before the original order script, then replaces only:

```js
submitOrderToSheet(payload)
```

with:

```js
submitCodLivePilotOrder(payload, submitOrderToSheet)
```

Copy the two JavaScript files beside index.html. In `wife-pilot-config.js` replace `https://CRM-ENDPOINT.invalid` with the actual authorized public CRM HTTPS **origin**. The config uses Form ID `codlive_wife_pilot_v1`, version `codlive-v1`. It rejects the placeholder/loopback/non-HTTPS configuration before either destination is called. The original Sheet function, endpoint, fields and success handling are retained. No local observer, mock Sheet/IP endpoint or localhost configuration belongs in the live deployment.

The adapter freezes one UUID/content before either destination begins, waits for both acknowledgments and retries the same inquiry. An acknowledged Sheet is skipped on CRM retries; original dynamic answers/order/course/price/tracking are preserved. Supplied external IDs remain separate from the UUID. There is no cross-system transaction or guaranteed Sheet deduplication when its acknowledgment is lost. Reconcile partial delivery before retrying an uncertain Sheet write.

Local package verification: two tests passed, zero failures/skips. The patch applies to a disposable copy of the supplied ZIP, its full Sheet function matches after line-ending normalization, and the pilot config refuses placeholder/non-HTTPS/loopback/path configuration before either destination can initialize. A separate dry check confirmed this patch does **not** apply to the retrieved live advertorial. No request or order was submitted by these checks. The first preservation assertion exposed only Windows Git line-ending conversion; normalizing CRLF/LF in that assertion resolved the test without changing the Sheet function.

## Change required for the actually observed live route

The /Wife/ advertorial currently has no customer/order fields to send. Do **not** submit a CTA click as a lead and do not fabricate an order from page/campaign metadata. Its existing CTA already forwards query parameters; confirm them through the actual journey without purchasing/submitting. `source=Wife` is a reported landing reference, not a traffic platform. With no explicit tracking, traffic remains Unknown.

At the actual order collector, the authorized developer must identify where validated customer/order/dynamic fields become available and where the existing Sheet/durable-order acknowledgment occurs. Only then adapt that exact handler to the existing CRM API contract:

```
GET  https://<AUTHORIZED_CRM_ORIGIN>/api/public/lead-challenge?form_id=codlive_wife_pilot_v1
POST https://<AUTHORIZED_CRM_ORIGIN>/api/public/leads?form_id=codlive_wife_pilot_v1
```

Reuse the actual stable inquiry UUID and original content on retry. Map name/mobile/address/course/price and optional external order ID deliberately, preserve permitted dynamic answers, and use the actual submitted page URL. Keep original entry-page/source references separate and reported; never claim a metiveda.com submission happened on dailyhealthfocus.info. Do not assume a checkout app exposes the ZIP payload or a compatible Sheet callback. If the actual integration must be server-side rather than the existing browser contract, first review that design explicitly; no new authenticated ingestion surface or provider webhook is added here.

Because the real collector's source/handler contract is missing, a correct line-level patch for that collector is **blocked**, not complete. The conditional ZIP patch makes the known change concrete while avoiding a fictitious patch against unseen checkout code.

## CRM source configuration after endpoint and collector are known

Use existing Admin Lead Sources, check Form ID uniqueness, create a separate pilot source initially disabled, set version codlive-v1 and map the correct existing catalog page/version if known. Do not reuse a local test source.

Allowed origin must be the **actual browser submitting origin**:

- If the authorized collector is hosted on dailyhealthfocus.info: `https://dailyhealthfocus.info`.
- If it is a browser form on metiveda.com: `https://metiveda.com`, only after that collector/contract is reviewed.
- If the actual origin is different: configure that exact reviewed HTTPS origin. No wildcard or path suffix.

Do not add both origins speculatively. The earlier plan's dailyhealthfocus.info-only value was conditional on /Wife/ itself collecting the form and is superseded by this live observation. Configured landing-page labels must describe the verified collection path. Website, configured landing page, reported traffic, original answers and external/submission IDs remain separate in main All Leads.

## Required supervised live acceptance — still pending

After separately authorized deployment, submit exactly one authorized clearly identifiable order through the real live /Wife/ journey. The operator/developer must observe all of:

1. Actual deployed page/collector revision, public HTTPS CRM origin and correct enabled source configuration.
2. The real collector's challenge/CORS/POST (or separately reviewed server integration) and durable CRM acknowledgment with its actual UUID.
3. Exactly that UUID/order in the existing main CRM All Leads: correct website, configured collection/landing page, name/mobile/address, course/price, dynamic answers, external ID if present and reported traffic Unknown when absent.
4. Matching actual order row in the authorized real Google Sheet, recording tab/row/time. Local mocks and Apps Script response text are insufficient.
5. An exact-content same-UUID CRM retry with refreshed challenge returns 200/replayed true and still one CRM lead; it must not send another Sheet write. If a Sheet outcome is ambiguous, inspect/reconcile first.

Keep only minimal nonsecret evidence and private local records under ignored paths. Until both real CRM and actual Sheet are observed, status is **local API/conditional adapter tested; live /Wife/ integration pending**. No additional test order was sent during this read-only review.

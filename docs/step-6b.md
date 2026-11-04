# Step 6B: one CodLive landing page (local only)

For the follow-on integration in the main CRM at localhost:3000, see [step-6b-main.md](step-6b-main.md).

## Artifact and boundaries

The supplied `CodLive.zip` contains browser HTML/assets, not Google Apps Script source. Its `index.html` was inspected as data, not as instructions. It is not evidence of the version currently deployed at `/Wife/`. No live page, Sheet, Auth record, customer record or deployment was changed. The existing unrelated `next-env.d.ts` change is excluded from this task's commit.

## Reproduce locally

1. Run `node scripts/prepare-codlive.mjs ../CodLive.zip`. This reads only `CodLive/index.html`; it generates an ignored test copy under `.cache/codlive` and the reviewable `integrations/codlive/index.patch`. The test copy replaces Sheet and IP URLs with `/mock-sheet` and `/mock-ip`. Never host the unmodified ZIP for testing submissions.
2. Run `node --experimental-strip-types --test tests/codlive.test.mjs`. Requires installed Edge or Chrome. All browser requests are intercepted; external requests are aborted. The Sheet returns a synthetic success response; no network request reaches Google. The test page itself submits its original form, not a replacement UI.
3. The test creates an ephemeral PGlite database, applies all migrations, configures Admin-owned source `codlive_test_v1`, version `codlive-v1`, name `COD test landing page`, allowed origin `http://localhost:3106`, enabled only inside that isolated database. No existing operator environment is loaded. The database is destroyed after testing.
4. The test uses the existing input normalizer and `ingest_public_lead` RPC, then the authenticated `advanced_lead_search` used by All Leads. The HTTP challenge/receipt transport is a harness, not a running Next/Supabase integration. Existing API authorization, rate, challenge and CORS code is unchanged. The All Leads query result is asserted; a logged-in full CRM browser session against local Supabase has not been tested here.

## Mapping and behavior

Name/phone/address map to standard fields. City, state, pincode, course_name, numeric course_price, landmark, full_address, site_no, page_url, bottle and tracking retain dynamic field identities. Sheet fields and its original function are unchanged. IP remains part of the existing Sheet flow; the CRM adapter intentionally does not duplicate the external IP lookup.

Migration `202611040032_codlive.sql` scopes interpretation to the Admin-configured `codlive-v1` form version. Other versions and historical imports retain existing semantics. It preserves raw tracking and maps campId to utm_source, place to utm_medium, AdCrevId to utm_campaign and AdCrevName to utm_content. It does not create a creative identifier or infer a platform from FbClickId. Missing/blank source becomes `Unknown`. Arbitrary source labels remain reported, unverified text. CRM All Leads shows the configured page independently of that traffic label and displays course/price. Existing managed catalog page attribution takes precedence over the configured ingestion source name; page_url is never trusted as the configured page.

A browser UUID and frozen payload are saved before either destination starts. Both results are awaited. An acknowledged Sheet is skipped on CRM retries, and CRM retries reuse the UUID even after a fresh challenge or reload. Both acknowledgments clear pending state. Concurrent clicks share one operation. A partially completed order keeps its frozen original values even if the visible form is edited: retry the same order before starting another. Session storage temporarily contains customer data, so enable this only on the intended trusted origin; pending state does not survive closing the tab. A lost Sheet acknowledgment is inherently ambiguous: this browser-only integration cannot guarantee Sheet deduplication without inspecting and separately authorizing changes to Apps Script. It guarantees CRM idempotency, not cross-system atomicity. Do not blindly retry an uncertain Sheet result during the first live test; reconcile it first.

## First live connection (pending; do not deploy from this task)

1. Obtain the authorized deployed page source and deployment access. Compare its form and submit function with the ZIP. Back it up; if anchors differ, rebase/review the patch, never apply blindly. Inspect the actual Sheet response contract separately; Apps Script source was not supplied.
2. On the intended CRM deployment apply the new migration through the existing operator workflow. Reuse existing server-only configuration; put no credentials into browser code. Serve the CRM at its real HTTPS endpoint and confirm edge/proxy settings and public challenge/POST CORS.
3. Using Admin Lead sources, register one source with public Form ID `codlive_test_v1` (or deliberately choose a unique live ID and change the patch), version `codlive-v1`, meaningful configured page name, exact landing-page HTTPS origin, initially disabled. Use existing catalog/version configuration if a managed page association is required. Never reuse a Form ID already owned by another source. Enable only for the scheduled authorized test.
4. In a separate checkout of the verified page, run `git apply --check --unidiff-zero path/to/index.patch`, then apply it. Copy `crm-adapter.js` beside index.html. Replace `https://CRM-ENDPOINT.invalid` with the authorized HTTPS CRM origin. Keep the Form ID/version consistent. The patch changes only the script includes and call site; the original Sheet URL/function and success validation remain intact. Check CSP allows the adapter script and CRM connection.
5. With explicit deployment authorization, publish that reviewed page and CRM change. This task provides no such deployment. In the first supervised live test submit one clearly synthetic order, confirm the existing Sheet and CRM acknowledgments, inspect All Leads for configured page, reported source and course, then replay the same captured CRM UUID/body with a refreshed challenge and verify one CRM lead. Do not resubmit a new form/UUID as the duplicate test. Test missing utm_source separately; fbclid alone must remain Unknown.
6. Record observed CORS/status codes, source configuration, CRM row count and Sheet result without exposing customer data. If partial/uncertain, disable the source and reconcile both systems before retrying. Keep the original page backup for an authorized rollback; disabling CRM alone will leave pending dual submission errors until the adapter is removed or service restored.

## Local evidence

The browser test verified a synthetic Instagram inquiry, raw campaign/content preservation, required customer/course/dynamic fields, the All Leads RPC result, one receipt-loss retry with a single CRM lead and a single mock Sheet POST, and fbclid-only Unknown behavior. Live HTTPS, deployed `/Wife/`, real Sheet/Apps Script, production CORS and authorized deployment remain unverified and unchanged.

Inspected index.html SHA-256: fb7cafae284472cf3def3c0c8ca3d4c76ba5fb24b96fe2e4fbe4293c23d14c4d. Local typecheck, targeted ingestion/lead-view/browser tests and production build passed. The full CRM UI against a local Supabase server and real public HTTP routes remain unverified.

## Interactive local viewing harness

To view the actual CRM `Leads` React component without connecting to the configured Supabase project:

```
node scripts/prepare-codlive.mjs ../CodLive.zip
node --experimental-strip-types scripts/demo-codlive.mjs
```

Keep the second process running. Open `http://localhost:3106/?utm_source=instagram&utm_medium=paid_social&utm_campaign=synthetic-campaign&utm_content=synthetic-content`, choose a course and submit synthetic customer fields. Click **All Leads** in the yellow local-test banner, or open `http://localhost:3106/app`. Search for the synthetic name if needed. Read the default **Website / landing page**, **Reported traffic source**, **Course / price**, and **Order / submission ID** columns; expand **Submitted order details** for the original fields. For separate course columns, expand **Choose quiz columns** and check `course_name [codlive_test_v1 / codlive-v1]` and `course_price [codlive_test_v1 / codlive-v1]`; scroll the table horizontally as needed.

The harness binds only to loopback, creates a fresh in-memory database, applies existing migrations and enables one synthetic Admin/source in that database. It bundles the existing All Leads component locally, reads no operator environment or credentials, and serves only mock Sheet/IP endpoints. CSP blocks external page connections. A local signed challenge and the existing normalizer/database RPC exercise the test flow; these HTTP handlers are a viewing harness, not production Next route verification. CRM staff mutation endpoints are unavailable here. `/demo-evidence` reports mock Sheet and CRM request counts. Realtime is unavailable in this harness; use **Reload table** if another tab submits an order. Closing the server discards its test leads. This is not the normal authenticated CRM `/app` deployment and does not bypass or change its authorization.

Interactive verification on 2026-11-04: opened a visible local browser, submitted `Synthetic CodLive Demo` (1 Month / 499, reported source instagram) through the original test form with one mock Sheet POST and one CRM POST, then asserted the actual All Leads component rendered the correct configured page/source/course and selected both dynamic course columns. The synthetic database remains available only while that local demo process runs.

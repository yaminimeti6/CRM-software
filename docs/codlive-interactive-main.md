# Original CodLive form connected to the main local CRM

## Open the actual form

```
http://localhost:3108/Wife/
```

This is the supplied ZIP's original HTML order form and local assets, connected to the existing Next CRM on localhost:3000 and its existing configured backend. It is distinct from the old isolated localhost:3106 demo. The helper never creates an inquiry, test user or synthetic lead at startup. Only an order submitted by the operator through this form can add a lead.

Start/restart from the repository root using the existing ignored operator configuration:

```
node --experimental-strip-types scripts/serve-codlive-main.mjs ../CodLive.zip
```

Do not start a second copy while port 3108 is already in use. The current process runs separately in a hidden local background window; ignored logs are under `.cache/codlive-interactive/`. The main CRM must already be running on localhost:3000.

## Scope and mapping

The helper verifies the original ZIP page hash, reads only an allowlist of original assets, and changes the submit call to the existing `crm-adapter.js`. The original Sheet function still builds its original FormData. Only its destination is changed to a loopback mock, and the external IP lookup becomes a local empty IP response. CSP blocks external page connections; the original Google Apps Script is never called. No website hosting, public deployment or GitHub push is involved.

Configured source: `CodLive /Wife/ local browser`; Form ID `codlive_local_browser_v1`; version `codlive-v1`; allowed origin exactly `http://localhost:3108`. Setup creates/enables only this validated Admin-owned source through the existing authorized source RPC. No schema migration, staff account, password, existing lead, history or bootstrap change is performed.

Name/mobile/address map to the standard fields. City, state, pincode, landmark, full address, course/price and the remaining existing adapter fields are retained as original dynamic answers. A separate stable submission UUID is persisted by the existing adapter until both destinations acknowledge. The actual local page URL reports website `localhost`; the configured landing page remains `CodLive /Wife/ local browser`. The public live website is not falsely substituted for a locally submitted page.

The default link has no tracking query. Its campId is blank, so main All Leads must show reported traffic source **Unknown**. If the operator deliberately supplies UTM parameters, their reported values are retained separately from the website/configured source. Order IDs are retained if supplied; none are invented by the helper.

## Operator-driven acceptance

1. Open the exact link above, choose a course and personally complete the original form. No automated fill or test submission is performed by this task.
2. Submit once. The original call sends one FormData request to the local mock Sheet and one inquiry to the actual main CRM API, with source-bound challenge/CORS checks. The mock associates its real received FormData with the same UUID through a local-only header; the production Sheet payload is not changed.
3. Successful dual acknowledgment redirects to `http://localhost:3108/Wife/thankyou.html`. That page reads this tab's observed submission UUID and checks the actual stored CRM row and matching mock Sheet row. It compares shared customer/order/dynamic values, refreshes the actual CRM challenge, and replays the same UUID/content directly to the main API. It verifies HTTP 200/replayed true and exactly one stored lead. The retry does not call mock Sheet again.
4. Confirmation shows the actual source/website/traffic/course/price/answers/UUID, counts and an **Open this order in main All Leads** link. Use the existing staff login. Compare the visible submission UUID, open Submitted order details, and inspect the retained dynamic answers.
5. Reopening confirmation uses cached verified evidence for that UUID, rather than creating another order. To inspect a known UUID again, open `http://localhost:3108/verification?submission_id=<ACTUAL_UUID>`. `/local-status` shows counts only, without customer data.

This verifies the main authorized All Leads database query; actual visible main-CRM UI confirmation uses the operator's existing authenticated browser. No synthetic verifier login is created. Do not claim a completed user flow until actual receipt, database and mock Sheet evidence exist.

## Private state and recovery

The adapter's pending inquiry remains in sessionStorage. The local observer preserves only actual submitted inquiries, receipts, mock FormData rows and verification evidence in ignored `.cache/codlive-interactive/private-state.json`; this may contain personal data and must never be committed or shared. No customer values are printed to server logs. Restarting the helper loads that state so an observed mock write is not silently forgotten.

If the page reports failure or verification is incomplete, preserve the tab and inspect the actual UUID/destinations before submitting again. A lost Sheet acknowledgment is ambiguous; the mock intentionally does not hide multiple received Sheet writes. The receipt checker reports incomplete verification when the UUID has anything other than one matching mock row. Browser dual delivery is not a cross-system transaction. A deliberate fresh form inquiry after success uses a new UUID and is a new lead.

Stop the helper with Ctrl+C when running interactively; disable its source through existing Admin Lead Sources when finished. Keep existing user data untouched. No real Sheet access or live /Wife/ deployment has been verified by this local connection.

## Read-only setup checks

Original form and assets loaded successfully, required fields and existing adapter were found, and a real cross-origin main API challenge returned 200 with version codlive-v1. No fields were filled and no POST request was generated by the setup browser check. JavaScript syntax and original page hash checks passed. User-submission acceptance is recorded only after actual evidence is observed.

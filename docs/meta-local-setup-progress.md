# Actual Meta local setup progress

Checked 2026-11-06. This is not a completed Meta integration.

## Configuration inventory (values withheld)

- CRM_APP_ORIGIN: configured as http://localhost:3000 in .env.local.
- META_TOKEN_ENCRYPTION_KEY: initially absent; generated with node:crypto randomBytes(32), saved as 64 hex characters in Git-ignored .env.local, and read-back verified. No existing key was rotated. Preserve this key for retained encrypted tokens.
- META_APP_ID and META_APP_SECRET: missing in both inspected local environment files.
- META_WORKER_DATABASE_URL: missing. Must use the existing restricted crm_meta_runtime identity, not the administrator database connection.
- META_GRAPH_VERSION: no explicit override; code defaults to v26.0.
- META_WORKER_CA_FILE: missing; optional if the worker can verify the server certificate with its normal trust store. Never disable TLS verification.

No records, accounts, passwords or database grants were changed. The key was not printed or committed. Local filesystem ACL was inspected.

## Guided setup

First open https://developers.facebook.com/apps/ using the authorized owner's Facebook account. Identify an existing app dedicated to this CRM, or choose Create App. Report only the screen title and available use-case labels; never send a secret. Do not select unrelated broad management permissions merely to pass setup. Portal-specific choices must be confirmed against the actual owner screen.

Exact callback for the present local CRM: http://localhost:3000/api/meta/callback . Use localhost consistently, not 127.0.0.1. Provider acceptance of this local callback must be confirmed in the actual app settings; if the provider requires a public HTTPS callback for this app/flow, stop and record the hosting blocker. Deployment is not authorized.

When credentials are available, open the ignored .env.local directly in the local editor and add META_APP_ID and META_APP_SECRET on separate lines. Do not put them in chat, shell command arguments, tracked files, screenshots or logs. Keep the generated META_TOKEN_ENCRYPTION_KEY unchanged and avoid duplicate variable definitions. Restart the local CRM after configuration. The developer can inspect presence/format without printing values.

## Acceptance still pending

1. Confirm Meta app use case, login settings, exact callback and ads_read access for the intended user/account.
2. Save app credentials privately and restart the local CRM.
3. Admin completes Facebook login; callback verifies real ads_read consent and account discovery.
4. Select an authorized discovered account.
5. Configure the restricted worker connection privately, verify TLS and role, then run the existing worker.
6. Verify completed publication and actual Meta spend/account/date/currency against Ads Manager; no new ads or synthetic leads. Record exact provider permission/review failures if any.

Actual login, account selection, worker connectivity and real sync have not been tested. No App Review failure has been observed yet. Meta documentation currently requires login or returns rate limiting from the research tool, so current portal labels and access requirements are not asserted as verified.

No hosting, deployment or GitHub push performed. Live website lead integration remains pending and is separate from this read-only ad reporting connection.

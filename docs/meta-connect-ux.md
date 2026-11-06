# Meta connection UX

The CRM uses Facebook sign-in and consent; staff do not paste API keys or access tokens. Existing Admin-only permissions, read-only ads_read scope, OAuth state/session binding and encrypted token storage are preserved.

When server setup is missing or invalid, the page shows Setup pending and disables sign-in. The start endpoint also checks readiness and returns HTTP 503 with META_SETUP_REQUIRED and a user-facing message, without server variable names. Start failures do not expose internal exception messages. The client only follows a redirect to https://www.facebook.com.

## Remaining operator setup

Configure META_APP_ID, META_APP_SECRET and a 64-hex META_TOKEN_ENCRYPTION_KEY privately on the CRM server; keep CRM_APP_ORIGIN canonical. In the authorized Meta app, configure Facebook login and the matching callback (local: http://localhost:3000/api/meta/callback). Confirm the app's permitted users/account access and ads_read permission with its owner. See step-12-status.md for provider and worker setup. Do not send secrets in chat.

Once configured, an Admin clicks Continue with Facebook, completes real consent, then selects a discovered ad account. Real authorization/account discovery and automatic sync remain unverified until this is done. This is read-only advertising reporting, not a Facebook Lead Ads ingestion connector.

## Local verification

Run npm.cmd run typecheck, npm.cmd run build and the Meta core tests. scripts/verify-meta-connect-ui.mjs uses the existing Admin, verifies the pending UI and actual authenticated start response, and checks public records/password fingerprints remain unchanged. It creates no leads or users. Screenshot: .cache/meta-connect/meta-setup.png (ignored).

No hosting, deployment or GitHub push. Live website integration remains pending.

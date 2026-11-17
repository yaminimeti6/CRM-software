# Meta: separate Facebook connection for each CRM company

Updated 2026-11-17. Local implementation and isolated tests; actual Facebook login/sync is not yet verified.

## Connection design

One platform Meta app is configured privately by the software operator. Each CRM company Admin clicks Continue with Facebook, grants access through Facebook Login for Business, and chooses an authorized ad account in the CRM. Customers never enter an API key or paste access tokens.

The OAuth request now uses the platform's META_LOGIN_CONFIG_ID. The opaque state remains bound to the signed-in Admin, organization, session, expiry and connection generation. Account selection and worker jobs reuse the existing organization-scoped API/database. Tokens are encrypted with organization-bound AES-GCM; there is no fallback to the software owner's token.

People in the same CRM organization intentionally share their permitted reports. Giving someone another staff account in your organization does not create a separate company. Independent customers need separate organization memberships; this change does not add a public signup/billing flow.

## Current local configuration and blockers

Presence/format inspection only; no values printed:

- META_APP_ID: present and numeric; value withheld.
- META_APP_SECRET: present; value withheld. Token exchange/credential validity still requires actual consent and callback.
- META_LOGIN_CONFIG_ID: present and numeric; value withheld.
- META_TOKEN_ENCRYPTION_KEY: present and valid format; preserved, not regenerated.
- META_WORKER_DATABASE_URL: missing.
- CRM_APP_ORIGIN: present; local callback is http://localhost:3000/api/meta/callback . Provider acceptance is not verified.

## Operator setup, not customer setup

1. Open the authorized CRM app in https://developers.facebook.com/apps/ . Select Facebook Login for Business > Configurations > Create configuration.
2. Use a User access token configuration with ad-account assets and ads_read permission. This code uses the existing short/long-lived user-token exchange. Do not select a system-user configuration without implementing and testing its different lifecycle.
3. Save the Configuration ID. In the Git-ignored .env.local editor, configure META_APP_ID, META_APP_SECRET and META_LOGIN_CONFIG_ID. Keep the existing encryption key. Do not send credentials in chat, command arguments or screenshots. Restart the local CRM.
4. Configure the exact callback in Facebook Login for Business login settings. Local candidate: http://localhost:3000/api/meta/callback . If Meta rejects localhost, choose an explicitly authorized HTTPS origin, set CRM_APP_ORIGIN to it and register that exact origin plus /api/meta/callback. No hosting/tunnel was created in this task.
5. For customers outside your own business, complete required Advanced Access/App Review and business verification. Approval is not inferred from a working developer account. The app configuration must request only the intended read permission; the server verifies ads_read after authorization.
6. Privately configure META_WORKER_DATABASE_URL for the existing restricted crm_meta_runtime identity with verified TLS, then run npm run worker:meta. Never substitute the administrator database credentials.

Meta references: [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business), [permissions](https://developers.facebook.com/documentation/development/permissions).

## Verification and live acceptance

Nine Meta tests pass, including two isolated companies authorizing independently, selecting the same provider account ID, publishing different spend using their respective encrypted tokens, rejecting cross-company/replayed OAuth state, and disconnecting one without affecting the other. The existing worker, RLS, retry and spend scenarios also pass. These fixtures run in isolated PGlite, not the main CRM.

Browser verification covers the actual missing-setup HTTP gate and intercepted provider-navigation/account-selection UX. The intercepted fixture is not Facebook authorization and does not prove App Review or sync approval.

After private configuration was added, the local CRM was restarted. A real authenticated /api/meta/start returned HTTP 200, the browser button was enabled, configured IDs matched privately, and the resulting authorization URL reached the actual Facebook login page. No Facebook password or consent was submitted. The temporary test OAuth state was removed; existing public data/password hashes were unchanged. This verifies authorization launch, not completed login or sync.

Remaining real acceptance: two authorized company Admins complete Facebook consent independently, select accounts, run the restricted worker, compare each spend report with its respective Ads Manager, verify that neither company can read the other's connection/report, and verify reconnect/disconnect isolation. Provider sign-in page reached; actual login/consent, real account selection and real sync remain unverified. Existing accounts, leads and passwords are preserved. No push/deployment.

# Step 3 — email-free Team onboarding

This is the supported Team invitation flow. SMTP, real email addresses, mail
templates and email verification are **not required**. No messages are sent.
Existing email/password Admin and staff accounts retain their credentials.

## Manual verification

1. Sign in with your existing Admin email/password. Open **Team → Invite staff**.
2. Enter the recipient's **display name**, choose one of the four existing roles,
   and click **Create invitation**. No email field is required.
3. Click **Copy Invitation Link** (or copy the code). Share it privately yourself.
   The secret is shown only in this create response and page memory. Copy it now;
   it cannot be retrieved after refresh/closing. If lost, revoke the pending invite,
   click **Start new invitation request**, and create another.
4. The recipient opens the link or pastes the code at `/join`. They choose a unique
   username and password (12+ characters), confirm the password and click
   **Activate account**. The Admin-selected name, organization and role are fixed.
5. After activation, refresh All Leads to check the session, sign out, then sign
   in with **username + password**. Existing accounts can still use email/password.
6. Team lists Pending, Accepted (used), Expired and Revoked invitations. Pending
   links can be revoked by an Admin from that same organization. Accepted links
   cannot be reused; change/deactivate the resulting membership through Team.

Usernames are **globally unique across this CRM**, ASCII 3–32 characters, beginning
with a letter and containing letters/digits/underscores. Leading/trailing spaces
are trimmed and case is normalized to lowercase for setup and login. Display names
are separate, Admin-provided and need not be unique. Inactive usernames remain
reserved to their accounts and cannot be adopted by a new invitation.

## Configuration and migrations

Apply versioned migrations with `node scripts/migrate.mjs`. Migration 008 adds
hash-only manual invitations, private username reservations, acceptance leases,
service-only functions and persistent rate limits. Migration 009 enforces explicit
non-null leases and indexes rate-window cleanup. Existing Auth identities and
passwords are not converted, renamed or reset. Existing email invitations/audit
records are preserved as legacy data; new onboarding uses manual tokens.

The existing server configuration is sufficient:

```dotenv
# Server-only, in ignored .env.local or hosting secret settings:
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SUPABASE_SECRET_KEY
TEAM_INVITE_SECRET=YOUR_PERSISTENT_RANDOM_SERVER_SECRET
CRM_APP_ORIGIN=https://YOUR_REACHABLE_CRM_HOST
```

The existing key is used only server-side. TEAM_INVITE_SECRET protects hashed rate
limit bucket identifiers; manual invitation tokens are independent random values,
not deterministic signing-key-derived login credentials. CRM_APP_ORIGIN determines
the copied URL; local development normally uses `http://localhost:3000`. Restart
the app after changing it. Keep Supabase public signup disabled. SMTP variables
may remain absent and do not gate manual creation/activation.

## Security and partial failures

- Tokens contain 32 cryptographically random bytes. The database stores only the
  SHA-256 hash, with a default 48-hour expiry and explicit accepted/revoked state.
  A token authorizes only its own pending activation, never Team/lead APIs.
- The invite secret appears only in the one-time Admin copy surface and recipient
  fragment/code state. It is never stored in localStorage/sessionStorage, logs,
  audit changes or database plaintext. The fragment is removed immediately on
  `/join`; validation/acceptance use POST bodies. Referrer-Policy is no-referrer;
  invitation pages are noindex. No analytics integration is added.
- Admin list/create/revoke use current membership and current organization. The
  recipient cannot submit role, organization, actor or Auth identity overrides.
- Supabase Auth stores/verifies passwords. A server-generated random internal
  non-deliverable email alias supports its email/password API. Internal aliases
  are not returned by onboarding/login/Team/account APIs or shown as staff email.
  Supabase's standard session remains in HTTP-only cookies; no custom password
  table or browser Auth client is introduced.
- Global username uniqueness is enforced by PostgreSQL, not a pre-check. Matching
  a username never adopts an account or resets a password. Existing legacy users
  continue email login rather than being silently assigned a new handle.
- The pending invitation reserves one Auth UUID and one username. A short exclusive
  two-minute lease serializes provisioning. A crashed worker's lease expires;
  normal failures release it. The original username/password must verify an
  already-created reserved identity before retrying. No membership exists until
  the atomic profile/membership/username-enable/accepted/audit transaction commits.
- Concurrent acceptors cannot create multiple identities/memberships. After commit
  the code is used, not an idempotent login credential. If the final response was
  lost after commit, use normal username login; do not create another account.
- Revocation/expiry during provisioning prevents final access. An orphan Auth-only
  identity has no membership/RLS access. Disabled username reservations are freed
  for expired/revoked invites, never by adopting or resetting an old Auth account.
- Create requests are idempotent by organization/request ID. On an ambiguous retry,
  the server cannot reconstruct a discarded random token: it returns 409 and
  instructs the Admin to revoke/start a new invitation, rather than duplicating it
  or pretending a replacement link is valid.
- Database-backed limits apply to validation (30/5 minutes per token), acceptance
  (20/10 minutes per token) and login (8/5 minutes per normalized identifier), plus
  global 120/minute buckets. Limits fail closed. Keys are HMAC hashes, not tokens,
  raw usernames/passwords or IP logs. Counters expire automatically. By default
  global buckets are shared; only set TEAM_TRUST_PROXY=true behind a proxy that
  strips/replaces untrusted X-Forwarded-For headers.
- Current role/deactivation RLS and the concurrent last-active-Admin guard remain
  unchanged. No mandatory lead assignment is introduced.

## Checks

`npm test`, `npm run typecheck`, production build, `npm run verify:team` and
`scripts/check-browser-secrets.mjs` cover this slice. The live Team verifier uses
real Supabase Auth/PostgreSQL and browser sessions with explicitly synthetic
organizations/identities. It copies/opens an actual link, selects credentials,
exercises negative/race/retry/rate cases and removes only exact fixture IDs.
Business data/identity/password/bootstrap fingerprints are compared before/after.
Rate counters are operational security metadata and naturally expire, not reset
across other users. No email or messaging transport is invoked.

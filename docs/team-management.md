# Step 3 — Team Management

**Superseded onboarding:** the supported flow is now [email-free manual invitation
links/codes](manual-team-onboarding.md). SMTP is optional and does not block Team
onboarding. The email-flow details below describe the earlier implementation;
current Team uses random hash-only, single-use 48-hour tokens and username login.

Only Team Management is added. Authentication, shared lead editing/history,
organization isolation and the completed first-Admin guard remain in place.
There is no public registration, mandatory assignment, calling or reporting module.

## Admin workflow

1. Sign in as an active Admin and open **Team** from All Leads.
2. Review staff name, current Auth email, role and active/inactive membership.
3. Expand **Invite staff**, enter the intended recipient/name and choose Admin,
   Team Leader / Manager, Telecaller or Creative Analyst. Send invitation.
4. The UI reports success only after the configured SMTP server accepts the mail
   and the database records that state. SMTP acceptance is not proof of inbox
   delivery. Without SMTP configuration the API returns 503 and grants no access.
5. The recipient opens the private link, chooses a password for a new account, or
   selects Existing account and enters their current password. Existing passwords
   are never reset. Use the email address that received the invitation.
6. After ownership verification and atomic acceptance, the recipient joins the
   correct organization and opens the protected app. Creative Analysts get no
   customer records. Existing accounts already belonging to another organization
   cannot be silently adopted or moved.
7. In Team, choose a member's role/active checkbox and click **Save member**.
   Revision conflicts require a reload. Deactivation and role changes affect
   existing sessions immediately through backend membership checks and RLS.
8. **Recent team changes** shows the latest 50 recorded actions with actor,
   target, IST time and role/active before/after where applicable.

At least one active Admin must remain. Concurrent demotions/deactivations serialize
on the organization row; the losing unsafe request returns 409. Direct membership
deletion of the last active Admin is also guarded. There is no user-deletion UI.

## Secure server configuration

Run `node scripts/configure-team.mjs` locally to append missing server-only keys.
It preserves every existing environment value, prints no secret, reuses only the
already-configured operator key when available, generates a persistent signing
secret and never sends email. Runtime code does not load `.env.setup.local` or
its database password. Existing `.env.local` public Supabase values stay unchanged.

The following belong only in ignored `.env.local` or hosting secret settings:

```dotenv
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SUPABASE_SECRET_KEY
TEAM_INVITE_SECRET=YOUR_PERSISTENT_RANDOM_64_CHARACTER_HEX_SECRET
CRM_APP_ORIGIN=https://YOUR_REACHABLE_CRM_HOST
TEAM_MAIL_HOST=YOUR_SMTP_HOST
TEAM_MAIL_PORT=587
TEAM_MAIL_USER=YOUR_SMTP_USERNAME
TEAM_MAIL_PASSWORD=YOUR_SMTP_PASSWORD
TEAM_MAIL_FROM=CRM <YOUR_VERIFIED_SENDER_ADDRESS>
```

The project already has the runtime key, generated invitation-signing secret and
local origin configured securely; no existing values were replaced. **SMTP has not
been configured** because the user has no SMTP service yet. To enable real delivery:

- Obtain SMTP host, port, username and SMTP password/app password from your mail
  service's SMTP settings. Verify the sender address/domain with that service.
- Enter those five TEAM_MAIL values locally, never in chat. Port 587 requires
  authenticated STARTTLS; port 465 uses implicit TLS. Certificate verification is
  enabled. Do not disable it or use the local-test flag with real recipients.
- Set CRM_APP_ORIGIN to the exact trusted origin recipients can open. Local
  http://localhost:3000 works only on the same computer; real remote recipients
  require your reachable HTTPS application URL. The request Host is never used
  to construct an invitation link.
- Restart the application. Test with an address you control and explicitly choose
  to invite. Check the actual inbox, expiry/acceptance and password login.

These are application SMTP settings, not Supabase Auth's SMTP template settings.
The custom mail links directly to `/join`, so Supabase email templates and redirect
allowlists are not used by this flow. Keep Supabase Authentication > User Signups >
Allow new users to sign up **OFF**. The app verifies this before sending invitations.
Do not put the server key or signing key in any NEXT_PUBLIC variable or Git.
Keep the signing key stable; rotating it invalidates old links. Resend then creates
a link signed by the new key without resetting any password.

## Ownership, retries and partial failures

An Admin request creates a scoped pending invitation only. It does not create an
Auth user, profile or membership. No Auth directory lookup discloses whether the
email belongs to another organization. Repeated request IDs or identical pending
email/name/role resolve to the same invitation; conflicting details return 409.

The private bearer link uses a server HMAC over the invitation UUID and expires
after 72 hours. It is sent only in email, never returned by Team APIs or shown to
the inviting Admin. The browser strips the fragment from the address bar and
holds it only in component memory. Reopen the original email link after a refresh.
Do not forward invitation links. Public acceptance requires a valid signature,
SMTP-accepted state, expiry and verified invited identity.

New-account setup creates only a durably reserved Auth UUID and chosen password
using the server-only Auth Admin API. Receiving the private email link proves
email ownership. If that UUID exists after an interruption, the original chosen
password must authenticate it before retrying acceptance. The flow never resets
or adopts an unrelated account that merely has the same email. Existing-account
mode requires the actual current password and confirmed invited email. Already
assigned accounts cannot join a different organization.

Profile, membership, accepted marker and audit are one database transaction. An
Auth-only partial account has no staff access and can resume with the same link
and password. Repeated acceptance creates no duplicate membership/audit and never
reactivates a deactivated member or overwrites a changed role. If the inviter is
no longer an active Admin, a current Admin must explicitly resend/reapprove.

SMTP errors leave an unsent pending invitation, not a success. Resending reuses
the same reservation/token and renews expiry with current Admin authorization.
An ambiguous SMTP/database failure can produce duplicate mail on retry, but cannot
create duplicate access. The UI distinguishes pending mail from SMTP acceptance.

## Authorization and audit

Migration 007 adds revision-checked Team functions, invitation/audit tables and
last-Admin protection. Browser Admins can execute only the scoped `team_list`
function. Existing profile/membership RLS and direct-write denials are preserved.
Invitation, membership-write and acceptance functions are executable only by
service_role; they independently verify the server-supplied Auth-validated actor
and current organization. Managers, Telecallers and Analysts cannot call them,
including by forging an Admin actor ID.

The app always derives actor IDs from Supabase `getUser()`, not client metadata.
Each role/deactivation change records actual actor, target, timestamp and JSONB
before/after. Clients cannot mutate the audit tables. Lead and Team permissions
read current active membership, so an unexpired JWT cannot bypass deactivation.

Trusted database owners retain SQL administration powers. Organization deletion
is not exposed to the app. Memberships cascade only when an operator deletes an
organization; this allows exact test-owned organization cleanup without weakening
the last-Admin guard for live organizations. Leads still prevent accidental parent
deletion until explicitly removed by their authorized operator.

First-Admin bootstrap stays separate and completed; it is not reused for staff
provisioning. Normal staff onboarding now uses Team invitations rather than the
old manual SQL provisioning template.

## Verification

`npm test`, `npm run typecheck` and a production build check the SQL and code.
`node scripts/verify-team.mjs` uses real Supabase Auth/PostgreSQL, isolated
CRM_TEAM_TEST organizations, reserved synthetic emails and a real local-only SMTP
receiver. It opens actual browser invitation/password/login flows and tests
ownership, partial failures, role/session effects, last-Admin concurrency, audit,
missing SMTP, shared leads/history and public-signup denial. Only exact fixture IDs
are cleaned; fingerprints cover pre-existing data and bootstrap state. Mail is
held in test process memory and is never forwarded to real recipients.

External inbox delivery is a separate **pending** check until real SMTP is
configured. A local SMTP acceptance test does not establish deliverability.
`node scripts/check-browser-secrets.mjs` scans built browser JS/map files for the
configured privileged key and signing secret without printing either value.

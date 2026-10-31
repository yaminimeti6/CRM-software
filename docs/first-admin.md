# Protected first-Admin onboarding

The first Admin is created by a project operator on their own computer. There is
no public signup endpoint or unrestricted Create Admin page. The CLI uses the
Supabase Admin API to create a confirmed password identity, then PostgreSQL to
commit the organization, profile, membership and one-time completion marker.

## Secure configuration

Keep the existing `.env.local` public project URL and publishable key unchanged.
In ignored `.env.setup.local`, locally enter:

```dotenv
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SUPABASE_SECRET_KEY
SUPABASE_DB_URL=YOUR_POSTGRES_SESSION_POOLER_CONNECTION_STRING
# Optional if TLS reports a missing/self-signed root certificate:
# SUPABASE_DB_CA_FILE=C:/private/path/to/downloaded-supabase-root.crt
```

Find the secret key in Supabase Dashboard > Settings > API Keys > Secret keys.
Find the PostgreSQL URL in Connect > Session pooler, port 5432. Replace the
password placeholder with your database password, URL-encoding special characters.
The username must be `postgres.mwpryrxmrdxgibgsetir`. A direct project connection
is also accepted if IPv6 connectivity is available. Transaction pooler mode is
refused because setup holds a session advisory lock. TLS certificate verification
is mandatory; if necessary download the CA certificate from Database settings
and configure the optional path. Never disable TLS verification.

Run `node scripts/diagnose-tls.mjs` to probe PostgreSQL and HTTPS independently.
It prints only safe stage/status information, never credentials or user records.
The setup command also labels failing stages. For a database trust failure,
download the project's server root CA from the authenticated Dashboard > Database
settings > SSL Configuration > Download Certificate. Save it outside Git, for
example `C:/Users/LENOVO/Downloads/supabase-db-root.crt`, and set
`SUPABASE_DB_CA_FILE` in `.env.setup.local` to that exact local path. PEM and DER
CA certificates are accepted; invalid/expired/non-CA files are rejected. The
certificate must come from the Dashboard, not a failed connection's peer chain
or an arbitrary download. Certificate and hostname verification remain enabled
using Node's secure defaults.

If **HTTPS** independently fails certificate verification on a corporate network,
obtain the approved PEM root/intermediate CA bundle from your organization's IT
administrator. Set `NODE_EXTRA_CA_CERTS` in the terminal environment **before**
launching Node, then rerun diagnosis; putting it in a file parsed after startup
does not configure Node trust. Do not add a corporate CA for a database-only
failure. In the observed run, HTTPS Admin API TLS succeeded (HTTP 200), while
PostgreSQL failed SELF_SIGNED_CERT_IN_CHAIN with no database CA configured.

The setup file is never loaded by the Next.js application. Never put these keys
in NEXT_PUBLIC variables, ordinary chat, shell arguments, source or Git. Do not
use an ordinary login password in place of the database password.

## Run setup

1. In Dashboard > Authentication > Sign In / Providers > User Signups, turn OFF
   **Allow new users to sign up**, save, and keep email/password enabled.
2. In your own terminal in this project, run `npm.cmd run setup:inspect` for a
   read-only count/RLS report. No user emails or credentials are printed.
3. Run `npm.cmd run setup:admin`. It checks the intended project, privileged API
   key, signup setting, migration checksums and existing memberships before
   requesting any Admin credentials. It applies the versioned migrations.
4. Enter your Admin email, full name and organization. Enter a unique password
   twice in the **hidden** terminal prompts (minimum 12 characters). Passwords
   are not written to any file, command argument or log. Do not share them in chat.
5. After success, start `npm.cmd run dev` and visit http://localhost:3000/login.
   Sign in with that email/password. Your actual database name and role appear.

If the first migration was previously applied manually, setup deliberately
refuses an untracked existing schema. Do not delete existing tables or records.
Have the operator compare its schema, grants and policies to the migration and
record the matching migration/checksum in `crm_migrations.applied` only after
inspection. This project was live-probed before implementation: its three staff
tables were absent from the REST schema (PGRST205); no destructive repair is used.

## One-time protection and recovery

- An advisory lock serializes setup commands. A private database reservation
  records an immutable generated Auth UUID **before** calling Auth.
- If Auth creation times out or the command is interrupted, rerun with the SAME
  email, full name, organization and password. It retrieves that reserved UUID;
  it never adopts or resets an unrelated existing account with the same email.
- Existing email conflict: no existing user is modified. An operator must inspect
  Auth users and the pending reservation privately; do not delete legitimate users
  or change the reserved identity just to bypass the guard.
- Organization/profile/membership/completion are committed together. A database
  failure rolls them all back. The pending Auth account has no staff access until
  the transaction succeeds. It remains safely resumable; it is not blindly deleted
  after an ambiguous network error.
- Once completed, the marker cannot be reset/deleted by this workflow. Removing
  memberships does not reopen setup. A second invocation refuses before user
  creation. Anonymous, authenticated and service-role API users cannot access the
  private marker schema. The trusted database owner inherently retains database
  administration powers; no application guard can restrict that operator.
- Additional staff now use the Admin Team invitation workflow documented in
  `team-management.md`, not bootstrap or manual membership inserts.
- After setup and acceptance, remove the privileged local file or secure it for
  later operator-only diagnostics. Rotate the temporary secret key if appropriate.

## Live verification

With `npm.cmd run dev` running in one terminal, run `npm.cmd run verify:login` in
another. Enter the Admin email and hidden password locally. It checks real Auth
and token refresh, then launches installed Edge/Chrome headlessly for actual login
Server Actions, invalid credentials, actual account data, cookie attributes,
refresh, logout and page/API protection. It creates a temporary Auth-only user,
then a Telecaller in a temporary different organization, exercises database RLS,
metadata spoofing and Admin API denial, then removes those fixtures. It also
checks the completed bootstrap refuses reuse. No browser trace or screenshot is
saved. Use a development project. Failed stages and cleanup issues are reported.

Neither successful compilation nor local PostgreSQL tests establish live acceptance.
Only the actual command/browser results count as live verification.

Sources: [Supabase Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[PostgreSQL connections and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres).

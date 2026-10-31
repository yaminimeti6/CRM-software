# CRM — staff authentication, shared leads and Team Management

Next.js App Router + TypeScript + Supabase Auth/PostgreSQL. Implemented increments:
staff authentication/roles, manual shared lead entry/editing and Admin Team Management. No public registration.
See [Step 2 usage and authorization](docs/step-2.md) for lead entry and verification.
See [Step 3 email-free Team setup](docs/manual-team-onboarding.md) for single-use
invitation links/codes, username/password login, role changes and deactivation.
SMTP and real email addresses are not required for new staff onboarding.

**First installation:** use the [protected one-time Admin setup](docs/first-admin.md).
It applies migrations and creates the confirmed Auth user plus database records
from hidden local password prompts. `supabase/bootstrap-admin.sql` is retired;
do not manually insert a first Admin. The numbered legacy setup below describes
the underlying project configuration; use the protected command for provisioning.

## Local setup

1. Install Node.js 22.9+ and run `npm ci` (PowerShell: `npm.cmd ci`).
2. Create a **development** Supabase project. Under Authentication settings,
   enable email/password and **disable Allow new users to sign up**. Configure
   password minimum length (12+ recommended), Auth rate limits and HTTPS for deployment.
3. For a fresh installation, let `npm.cmd run setup:admin` apply and record the
   versioned migrations as described in `docs/first-admin.md`. Do not manually
   apply the first migration before this command. On later environments, use
   the same versioned migration workflow; do not hand-edit production tables.
4. Copy `.env.example` to `.env.local` in this project. In Dashboard > Project
   Settings / Connect / API Keys, copy the project URL to
   `NEXT_PUBLIC_SUPABASE_URL` and the **publishable** key to
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never use a secret/service-role key.
   These two values identify the project and are safe to publish; security is RLS.
   `.env.local` is ignored by Git. No database password or service key is required
   by this app. Enter all private credentials only in the Supabase Dashboard,
   trusted CLI prompts, or the hosting provider's secret settings, never chat.
5. Follow `docs/first-admin.md` and run `npm.cmd run setup:admin` to apply migrations
   and create the first confirmed Admin. On a fresh installation, let that command
   own migration application instead of manually executing step 3 first.
6. Run `npm run dev` and open http://localhost:3000/login.

For an existing initialized project, apply new migrations with
`node scripts/migrate.mjs`; do not rerun bootstrap. Never send private credentials
in chat. Live verification uses isolated fixtures in the development project.

## Staff provisioning and revocation

An active organization Admin can now use **Team** to invite staff into the roles:
`admin`, `manager` (Team Leader / Manager), `telecaller`, `creative_analyst`.
One active organization membership is supported per account in this slice.
For revocation, set `organization_memberships.active = false` using SQL Editor;
the next protected request and direct database read lose access even with an
unexpired Auth token. Delete/disable the Auth account if identity access must
also be revoked. Direct client writes to staff records remain denied, including
Admin clients. Team uses tightly scoped server functions with actual-actor audit,
revision checks and concurrent last-Admin protection; it does not reuse bootstrap.

## Authorization contract

- Identity is validated with Supabase `getUser()`, not trusted browser metadata.
- HTTP-only SameSite=Lax cookies store sessions; production cookies are Secure.
  Next.js proxy refreshes tokens and persists refreshed cookies. No localStorage.
- Each page/API reads current profile and active membership with the user's JWT.
  No service-role client exists in application code. No roles are taken from
  user-editable Auth metadata or request parameters.
- `/app` requires active staff membership; `/api/me` returns 401 without identity,
  403 without staff access, 503 if unconfigured/unavailable.
- `/api/admin/access` returns 403 for non-admin staff. This is a minimal role
  verification endpoint, not a user-management API. All four roles can view their
  own account. Creative Analyst gets no customer PII or lead API access.
- Staff RLS exposes only one's own active membership/profile and its organization.
  Staff grants deny INSERT/UPDATE/DELETE to authenticated/anonymous clients. No signup
  trigger creates membership; metadata changes cannot elevate privileges.
- Next.js Server Actions enforce same-origin writes. Login uses Supabase Auth
  rate limits and generic credential errors. Do not enable public signup later
  without redesigning provisioning. Protected responses must never be CDN-cached.
- Logout signs out the current session. Supabase access JWTs already copied
  outside the browser can remain valid until expiration; use short JWT lifetimes
  appropriate to your deployment. Membership revocation is checked immediately.

## Verification

`npm test` runs SQL authorization tests against embedded PostgreSQL (PGlite),
executing the actual migration/grants/RLS with Supabase auth-role fixtures.
This is real SQL enforcement testing, **not a hosted Supabase Auth test**.
`npm run typecheck` and `npm run build` check TypeScript and production compilation.

Authentication checks are documented in `docs/verification.md`. Lead checks and
manual instructions are in `docs/step-2.md`. Build success alone does not verify
hosted integration. Run `node scripts/verify-leads.mjs` against development only.

Auth implementation follows the official [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

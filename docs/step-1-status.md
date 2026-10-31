# Step 1 implementation and verification

**Current update:** existing Admin login, name/role, refresh and logout were
subsequently user-verified. Remaining live authorization checks passed before
Step 2; see [Step 2 acceptance](step-2-status.md). Older blocked states below are
historical. Existing Admin preserved; bootstrap was not rerun as setup.

## Follow-up investigation and onboarding repair

The project's actual Auth settings accepted the configured publishable key and
confirmed the intended project `mwpryrxmrdxgibgsetir`. Email provider was enabled;
public signup was still enabled at inspection. Zero-row REST schema probes for
organizations, staff_profiles and organization_memberships each returned HTTP
404 / PGRST205. This proves those tables were unavailable in the API schema; a
privileged SQL inspection is still required to distinguish missing tables from
an unexpected schema-cache/configuration issue.

The originally reported generic error is emitted by signInWithPassword before
staff lookup, so it is an Auth-stage failure rather than a membership-stage
failure. The precise original account state/password/confirmation is unknown;
no user's original credentials or Auth user records were available to inspect.

Added: protected local migration/bootstrap command with hidden password prompts,
durable private UUID reservation, atomic staff/organization creation, immutable
completion marker, checksum ledger, serialized setup and retry-safe recovery.
Retired the manual first-Admin SQL. Added read-only privileged inspection and
live end-to-end browser verification commands. Auth errors now expose only
allowlisted diagnostic categories, with distinct confirmation, credentials,
provider, rate-limit, database and membership messages.

Follow-up checks actually run:

- `npm test`: PASS, 4 tests (including actual SQL rollback/recovery/reuse refusal).
- `npm run typecheck`: PASS.
- `npm run build`: PASS with configured .env.local.
- `node scripts/verify-http.mjs`: PASS against the running configured app;
  logged-out /app redirects, APIs return 401/no-store, PATCH returns 405.
- `node scripts/verify-logged-out.mjs`: PASS in installed Edge, using the actual
  login Server Action and real Supabase Auth. Invalid credentials display
  AUTH_INVALID_CREDENTIALS and do not grant API access. No mock Auth was used.
- `npm run setup:inspect`: BLOCKED, privileged local values absent.

Still blocked/unverified: hosted SQL schema/policies/records inspection, actual
migration application, first Admin creation, positive Admin/browser login,
logged-in refresh/logout, hosted cross-tenant and privilege-escalation tests,
and live first-Admin reuse refusal. `.env.setup.local` is an ignored blank template;
the operator must enter privileged configuration locally and disable public signup.
Then run setup:admin and verify:login in their own terminal with hidden prompts.
No remaining CRM module has been implemented. Earlier initial-check results below
are historical and do not imply current hosted acceptance.

Date: 2026-10-31 (Asia/Kolkata).

Implemented: Next.js App Router/TypeScript application; versioned Supabase SQL
migration; four PDF roles; staff profile and organization membership; RLS and
read-only client grants; Supabase password login; HTTP-only cookie sessions and
refresh proxy; logout; protected account page; protected identity and Admin
authorization endpoints; operator-only bootstrap/provisioning SQL; setup docs.

## Checks actually executed

- `npm test`: PASS, 2 tests. SQL test executes the migration on PGlite PostgreSQL,
  checks all four roles, own records only, tenant isolation, inactive membership,
  anonymous denial, denied role/organization/active changes, insert/delete and
  profile/organization writes. Role test rejects unknown role values.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, Next.js 16.4.3 production build.
- Production `next start` HTTP checks: PASS. Unconfigured login displays setup
  notice, `/app` redirects to `/login` (307), identity/Admin APIs return 503 with
  no-store headers and no identity data, PATCH `/api/me` returns 405.
- `git check-ignore .env.local .env.integration.local`: PASS.
- `node scripts/verify-supabase.mjs`: BLOCKED (exit 2), required configuration
  absent. No real project connection or Auth request was made by this script.

Initial tsx test runner failed because sandboxed OS account lookup returned
ENOMEM. Replaced it with Node's native TypeScript test execution; final tests pass.
Docker was unavailable due to local engine access permissions; database policy
tests use embedded PostgreSQL instead.

## Pending / unverified

No Supabase project credentials or configured project were supplied. The hosted
migration, Auth provider configuration, first Admin provisioning, real valid and
invalid password login, browser refresh/session persistence/expiry, browser logout,
and hosted database/API authorization must still be verified. Embedded SQL tests
and production compilation do not establish hosted Auth integration success.

See `verification.md` for the live script and full acceptance checklist. Do not
approve Step 1 as fully verified until it passes. Step 2 has not been started.

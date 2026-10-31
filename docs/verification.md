# Step 1 acceptance record

For first installation, follow [protected Admin onboarding](first-admin.md), then
run `npm.cmd run verify:login` for real Auth + browser + database acceptance.
That command is the preferred full check; it requests passwords only in hidden
local terminal prompts. The older optional SDK-only test below is supplementary.

## Optional live integration command

After provisioning a disposable non-admin account and a second organization in
the development project, create ignored `.env.integration.local` containing:

```dotenv
TEST_STAFF_EMAIL=your-disposable-staff-email
TEST_STAFF_PASSWORD=your-disposable-staff-password
TEST_OTHER_ORGANIZATION_ID=uuid-of-a-different-existing-organization
```

Enter these locally in your editor, never chat or shell arguments. Then run:

```sh
node --env-file=.env.local --env-file=.env.integration.local scripts/verify-supabase.mjs
```

This runs real Supabase Auth/PostgREST calls and refuses missing configuration.
It tests password rejection, login, session refresh, SDK logout, own-record reads,
cross-tenant reads, denied membership updates, and anonymous denial. It does not
replace the browser/server-cookie checks below. Do not run it against production.

## Real-project verification (pending until Supabase is configured)

Use a development project and disposable accounts. Never record passwords or JWTs.

1. Run protected first-Admin setup and disable public signup. Provision Telecaller
   in organization A; provision Creative Analyst in organization B. Also create an
   Auth user without a staff membership. Use Dashboard/SQL Editor only.
2. Sign in with a valid staff email/password. `/app` must display the exact DB
   name and role plus authenticated email; `/api/me` must show the same identity.
3. Refresh `/app`, then close/reopen the tab. A valid session must remain.
   Repeat after access-token expiry to exercise refresh-token rotation.
4. Sign out. Reopen `/app` and `/api/me`: redirect to login / HTTP 401.
   Use browser back/refresh to confirm no fresh protected access remains.
5. Try a wrong password: useful generic error and no protected access.
6. Try an Auth-only account: staff access denied and session signed out.
7. `/api/admin/access`: Admin HTTP 200; every other role HTTP 403;
   signed-out HTTP 401. PUT/PATCH to APIs must not mutate anything (405).
8. In a private local integration harness, sign in using Supabase JS with the
   publishable key and each disposable user's password. Query the three tables:
   only own profile/membership/organization may be returned. Explicit filters for
   organization B as an A user must return no rows. Anonymous reads must fail.
9. Through that authenticated client, attempt membership role, organization,
   active-field updates, membership insert/delete, and profile/org updates.
   All must fail with permission errors. Re-query as operator to ensure no change.
   Repeat as Admin: direct protected-field mutation is also denied.
10. Change user metadata to `role: admin` or another organization ID with
    `auth.updateUser`. Database role and protected API permission must remain unchanged.
11. Set membership active=false as operator. Existing session must immediately
    lose `/api/me` and all three tables' row visibility. Restore as operator.
12. Attempt `auth.signUp` with a new disposable email: Supabase must reject it.

Do not claim hosted integration acceptance until these cases run against the
configured project. Browser screenshots are not sufficient evidence.

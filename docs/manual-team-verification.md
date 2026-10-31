# Email-free Step 3 verification record

Date: 2026-10-31, Asia/Kolkata. Development project:
`mwpryrxmrdxgibgsetir`. Scope remains Step 3 only.

## Applied implementation

Migrations 008 and 009 were applied through the existing version/checksum ledger.
They add hash-only 48-hour manual invitations, revocation/single-use state, global
case-normalized username reservations, service-only acceptance/login functions,
exclusive provisioning leases and durable rate limits. Migration 009 explicitly
rejects missing leases at the SQL boundary and indexes rate-window expiry cleanup.
Existing membership RLS, role/deactivation enforcement and last-Admin guard are
preserved; no existing Auth identity/password is converted or reset.

Team UI now creates a one-time copyable link/code from display name and role only.
The recipient chooses a username/password, not a role or organization. Supabase
Auth stores/verifies the password through a random server-only internal identifier.
Login accepts new usernames and continues to accept existing email/password.
Internal aliases are hidden from application account/Team APIs and UI. No SMTP
configuration, mail delivery, email verification or messaging transport is used.

## Checks actually run

- `npm test`: **11/11 PASS**, including real PostgreSQL migration/RLS tests,
  single-use/hash/lease/expiry/revocation/username/rate cases and earlier bootstrap,
  last-Admin and lead/history tests.
- `npm run typecheck`: **PASS**.
- Production build with `CRM_NEXT_DIST_DIR=.next-manual-check`: **PASS**.
- Browser JS/map scan: **PASS**, 14 files; neither configured privileged key nor
  Team server secret was present.
- Final `node scripts/verify-manual-team.mjs`: **PASS, exit 0**, after migrations
  008/009 and the final application build. Real Supabase Auth/PostgreSQL, actual
  browser/password/session flows and isolated production server on localhost:3103.

Final live suite verified:

1. Admin creates an invitation through Team UI with SMTP absent; clipboard copies
   the real link. Database stores its hash only and has approximately 48-hour
   expiry. Opening the invitation, including in an already-open join page, works.
2. Recipient chooses credentials and activates through real Supabase Auth. Uppercase
   setup/login normalizes consistently; username is separate from display name.
   Username login, browser refresh and logout pass. Internal aliases are not shown
   in application UI/API responses. Tokens are absent from HTTP request URLs and
   browser localStorage/sessionStorage; no-referrer response is verified.
3. Expired/revoked/invalid/used invitations are rejected. Already-used acceptance
   cannot create another account or membership. Repeated create request IDs do
   not duplicate invitations or pretend a lost secret can be recovered.
4. Case-insensitive username collision creates no access and does not adopt/reset
   the existing identity. Concurrent acceptance yields exactly one success and one
   denial, with one identity/membership. A real Auth-only interrupted setup resumes
   using the same reserved UUID and original password; wrong retry password fails.
5. All four Admin-selected roles activate. Non-admin creation/list/revocation fail;
   submitted role/organization overrides fail. Another organization's Admin cannot
   list/revoke these invitations or retrieve its lead records.
6. Telecaller shared lead access, Manager access, Analyst PII denial and readable
   lead History pass. Existing-session role changes and deactivation take effect
   immediately. Concurrent Admin self-demotions preserve one active Admin.
7. Public validation and acceptance endpoints return 429 when their durable limits
   are exhausted. Username-login UI also reaches the server rate-limit response.
8. Legacy email/password Admin compatibility is exercised using synthetic existing
   Admin identities. No real Admin password was requested/replayed. Original real
   identity/password fingerprints are unchanged.
9. All exact test-owned organizations/identities/leads/username reservations and
   invitations were cleaned. Existing accounts/passwords, staff, manual leads and
   history, status/field definitions and completed bootstrap fingerprints matched.
   Operational rate counters naturally expire; other users' counters are not reset.

The full `scripts/verify-leads.mjs` live suite also passed against the current
email-free Team build/database (exit 0), covering UI create/edit/refresh/history,
dynamic fields, pagination/search/filter/validation, simultaneous writes, two
independent stale-save sessions, role/org isolation, Confirm rejection and login/
logout. Its data-preservation fingerprints and account count also matched.

During verification an overly broad test locator matched the framework's route
announcer as well as the login error. The verifier now targets the actual form
alert and uses per-run invalid codes for deterministic rate tests. The final run
above passed. The SQL missing-lease hardening is covered by explicit negative
tests; no protection was disabled to make tests pass.

## Remaining status

No SMTP or configuration blocker remains for local manual onboarding. The existing
server-only key, HMAC rate key and trusted local origin are used; no existing
environment values were replaced in this increment. For recipients on a different
device, configure CRM_APP_ORIGIN to the reachable HTTPS application origin.

This verifies the real development project/local production application, not a
hosted deployment. Existing real Admin credentials were preserved, not replayed;
the user can perform the manual steps in [manual-team-onboarding.md](manual-team-onboarding.md).
No real people were contacted and no Step 4 module was started.

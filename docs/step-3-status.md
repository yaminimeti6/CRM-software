# Step 3 implementation and verification record

**Current implementation:** SMTP no longer blocks onboarding. Step 3 now uses
single-use, hash-only 48-hour manual links/codes and username/password login.
See [current verification](manual-team-verification.md) and
[manual steps](manual-team-onboarding.md). The email-flow results below are
historical; current core/live checks pass without sending any mail.

Date: 2026-10-31, Asia/Kolkata. Project: `mwpryrxmrdxgibgsetir`.

## Implemented

- Admin-only Team page/API and organization-scoped staff list with name, actual
  Auth email, role, active/inactive flag and revision.
- Secure invitation/password-setup flow for all four roles. Pending invitations
  do not create identities or memberships. Only the email recipient receives the
  signed private link; the inviting Admin never receives a login/setup token.
- Existing-account ownership verification using the actual password and confirmed
  invited email. No password resets, account adoption or organization transfer.
- Durable identity reservation, idempotent provisioning/acceptance, SMTP retry
  state and atomic profile/membership/acceptance/audit creation.
- Role changes, deactivation/reactivation, actual actor/target/time/change audit
  and organization-serialized last-active-Admin protection, including deletion.
- Existing session authorization reads current memberships, not stale metadata.
- Versioned migration 007 applied; existing bootstrap state was not modified.
- No public signup, mandatory lead assignment or module beyond Team Management.

The existing operator key was reused only in ignored server-side runtime config;
a persistent signing secret was generated locally. Existing env values were
preserved. SMTP was not configured and no mail went to real people.

## Actual checks

- `npm test`: **10/10 PASS**, including migration/RLS, ownership/idempotency,
  Team authorization/audit, last Admin, bootstrap and lead/history regression SQL.
- `npm run typecheck`: **PASS**.
- `CRM_NEXT_DIST_DIR=.next-team-check npm run build`: **PASS**.
- `node scripts/check-browser-secrets.mjs`: **PASS**, 14 browser JS/map files;
  neither configured privileged key nor invitation-signing secret was present.
- `node scripts/verify-team.mjs`: **PASS, exit 0**, final run using real Supabase
  Auth/PostgreSQL, real browser sessions, production application and an actual
  local-only SMTP test receiver. No Auth/database mocks or fake delivery success.

The final Team run verified:

1. Team UI invitation and list scoping; real mail arrived in the local synthetic
   receiver. All four roles chose their own passwords in the real browser join
   page and logged in through Supabase Auth. Duplicate provisioning produced one
   invitation/membership. Forged links were denied.
2. Existing account setup never replaced its password. Current-password ownership
   was required. Another organization's account was not adopted or disclosed to
   the inviting Admin. Original passwords still authenticated.
3. A real Auth-only partial setup resumed with the reserved UUID/original password
   and created exactly one accepted membership/audit. SMTP rejection produced a
   real 503/pending state; explicit resend succeeded through the SMTP receiver.
4. Managers/Telecallers/Analysts were denied Team API/RPC writes and reads. Forged
   Admin actor IDs could not call service-only functions. Anonymous APIs denied
   access. Cross-organization Team target updates were denied.
5. Telecaller shared lead UI create/edit/refresh, JSONB Age=35 persistence and the
   readable History panel worked. Manager shared access worked; Analyst UI/API/RLS
   did not expose customer records. Other-organization lead list was isolated.
6. Role changes affected existing sessions and direct database reads immediately.
   Deactivation blocked pages/APIs/RLS with a still-valid identity; reactivation
   restored access without changing credentials. Replaying an accepted invitation
   could not reactivate an inactive membership. Audit actors/targets/times and
   role/active before/after matched the real authenticated actions.
7. A separate production server with no SMTP displayed the real configuration
   warning. Provisioning returned 503 with no invitation row or membership change.
8. Concurrent self-demotions and concurrent deactivations each produced one
   success and one 409. Exactly one active Admin remained; subsequent demotion,
   deactivation and direct membership removal of the last Admin failed.
9. Login/page refresh/logout regression passed; Supabase public signup was denied.
10. Only exact synthetic fixture organizations/users/leads were removed. Database
    fingerprints matched for pre-existing Auth identities/passwords, profiles,
    memberships, leads/history, statuses/fields and completed bootstrap state.

The complete `scripts/verify-leads.mjs` suite was also rerun against the current
Team-enabled production build on localhost:3100: **PASS, exit 0**. This included
pagination/search/status filtering/validation, dynamic fields, simultaneous writes,
two independent browser-session stale saves, role/tenant isolation and login/logout.
Its preservation fingerprints and existing account count matched after cleanup.
The verifier now retains a synthetic Admin while testing a second Admin role and
deletes exact test-owned organizations before their Auth users, respecting the
new last-Admin guard rather than disabling it.

Initial local failures came from older test fixtures that deleted the last Admin
or transferred a membership directly. Tests were corrected to assert the new
guard and clean only their whole test-owned organizations; protection was not
weakened. No remaining application failure was found in the final live suites.

## Pending configuration / verification

**External SMTP/inbox delivery remains pending.** The user has no SMTP service
configured. Local receiver acceptance verifies transport and the real password/
ownership flow, not external deliverability. Team membership management/listing
works now; invitations for real staff require server-side SMTP, a verified sender
and a reachable trusted application origin as documented in `team-management.md`.
The current UI/API honestly blocks unconfigured delivery. No real invitation was
sent to the existing Admin or any other person.

No existing Admin password was requested/replayed; real automated tests used only
synthetic credentials held in memory. Hosted deployment is not performed here.
Step 3 core checks pass; full real-mail acceptance awaits SMTP setup/inbox testing
and the user's manual Team verification. No Step 4 work has started.

## Acceptance review before Step 4 — 2026-11-02

The user confirmed invitation activation/username-password login, no Telecaller Team menu, shared synthetic lead visibility and Notes saving. These manual checks were accepted without repeating them.

The current email-free acceptance source is `manual-team-verification.md` (migrations 008/009), not the older SMTP narrative above. It already records live expiry/revocation/single-use rejection (check 3), concurrent acceptance and Auth-only partial recovery without password replacement (check 4), Admin-only/cross-organization backend permissions (check 5), and existing-session role/deactivation enforcement plus concurrent last-active-Admin protection (check 6). `step-3-status.md` historical live check 8 additionally records concurrent deactivation/deletion guarding; that guard was not replaced by manual onboarding. Current `manual-team.test.mjs` and `team.test.mjs` re-executed as Step 4 regression tests and passed. No unverified acceptance item in the requested Step 3 list was found; no protection was weakened and no existing user was recreated.

The old SMTP/external-inbox pending notes are historical and do not block the current manual invitation implementation. Hosted deployment remains distinct from local development-project verification. Step 4 is documented separately in `step-4.md` and `step-4-status.md`; no later step is authorized.

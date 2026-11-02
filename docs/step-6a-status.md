# Step 6A implementation and verification record

Date: 2026-11-02, Asia/Kolkata. Development Supabase project: `mwpryrxmrdxgibgsetir`.

## Scope and acceptance boundary

Steps 1–5 remain accepted. The current repository, AGENTS.md, CRM PDF ingestion/dynamic-field requirements, migration history, staff services, lead/audit/confirmation logic and Step 5 record were inspected before editing. Implemented only the public lead receiver, minimal Admin source/status configuration and a gated synthetic local test form. No CSV/customer import, live website/Sheet modification, unseen Apps Script adapter, OTP provider or later module was added.

**Step 6B is pending:** the user has View-only Sheet access and cannot inspect the Apps Script. Live source integration needs authorized form/Apps Script source access, confirmed mappings and reachable HTTPS deployment/proxy configuration. A remote website/Apps Script cannot reach this laptop's localhost directly. Full Step 6 acceptance is not claimed.

## Implemented and applied

- JSON and URL-encoded `POST /api/public/leads`, structured commit/replay/errors, bounded inputs, strict source routing and protected fields.
- Source-bound public timing challenge/honeypot plus durable HMAC-bucket throttling, source enablement and exact-origin CORS. These are abuse controls, not authentication or a promise to defeat all bots.
- Exact raw dynamic answers/source fields, original external ID/time, raw advertising and explicit normalized references stored separately. Unknown quiz columns register atomically. No assumption that AdCrevId is a Meta creative object ID.
- Server-generated CRM UUID/time/New status, null staff creator with readable Public source ingestion audit attribution, immutable source receipts, same-phone repeat indicator visible only to staff, no fabricated calls/confirmations/OTP trust.
- Admin-only source configuration/status at `/app/ingestion`; source IDs are not renameable/reassignable. Organization/configured brand/product reference snapshots come from the registered source, never public payloads. Brand/product references are opaque configured metadata; no new catalog module was invented.
- `/test-ingestion` explicitly omits credentials on public requests, freezes submission UUID/content for retries and only shows success after the actual response confirms a commit. It is disabled by default and opt-in is restricted to a localhost configured origin.

Applied `supabase/migrations/202611020015_public_ingestion.sql` using the checksummed operator migration flow and verified TLS. No manual migration step remains in this development project. Old migration checksums were preserved. Before/after database-side fingerprints of existing users/passwords, memberships, leads, fields/history, calls, confirmations, follow-ups and presence matched. Existing records were not recreated/reset.

## Actual local verification

- `npm test`: **17/17 pass**, including actual embedded PostgreSQL migrations/RLS/functions, mapping/protected/nested input checks, immutable metadata, original source values, retry conflict, staff edit preservation, same-phone repeat behavior, atomic field/audit failure and durable limiter, plus Step 1–5 regressions.
- `npm run typecheck`: pass.
- `CRM_NEXT_DIST_DIR=.next-ingestion-check npm run build`: pass.
- `CRM_NEXT_DIST_DIR=.next-ingestion-check node scripts/check-browser-secrets.mjs`: pass; **17 actual browser JS/map files** checked, configured privileged key and Team secret absent. No new client-side secret or dependency was added.
- No lint script/configuration exists; lint is not reported as run.

Embedded SQL tests use synthetic Auth contracts and are separate from real hosted/browser evidence.

## Actual real HTTP/development Supabase verification

`node scripts/verify-ingestion.mjs` passed exit 0 against real development Supabase Auth/PostgreSQL and the isolated production app at localhost:3106. It used only disposable synthetic users/sources in two new organizations; the anonymous form browser had no staff session. A separate, in-memory test-only rate secret and reserved synthetic peer addresses isolated rate-bucket fixtures from actual app traffic.

Verified:

1. Admin's actual source form created an enabled, versioned source. Other-role configuration access and another Admin's cross-organization update failed.
2. Anonymous synthetic browser form submitted through the real HTTP endpoint and returned 201 only after a committed Supabase lead. Its request contained no Cookie, Authorization or API key. Response contained only accepted/replayed/client submission UUID plus `ok`, no customer record or repeat details.
3. The record was visible in an operational staff member's All Leads and survived refresh. The exact unknown quiz field appeared in Choose quiz columns; script-like text remained an inert input value. New calling status, null staff creator, false trusted OTP flag, configured source association snapshot and separate raw/normalized advertising references matched real stored data.
4. JSON and form-encoded requests worked. External lead_id/source timestamp were retained separately and did not overwrite server receipt time. Same-phone deliberate submissions created separate UUIDs with a staff-only repeat flag.
5. Sequential same-ID retries returned 200, conflicting content returned 409, and concurrent identical retries returned one 201/one 200 with one persisted record. A staff Notes edit survived retry unchanged.
6. Invalid name/mobile, unknown/disabled source, oversized/malformed body, forged/incorrect-source challenge, unpermitted origin, protected organization/caller/status/confirmation/trusted-OTP fields, nested-role injection, excessive nesting and honeypot all failed. Real CORS OPTIONS accepted the configured origin and rejected another. Public GET returned 405, not customer data.
7. Public submissions created zero calls/confirmations and zero trusted OTP records. Ordinary authenticated users could not directly invoke the service-only ingestion function; Analyst and other-organization ingestion metadata queries returned no PII.
8. A temporary constraint scoped to the exact synthetic organization forced field registration failure. HTTP returned 503, not success; the new lead, metadata, registered field and audit transaction did not persist. The exact constraint was removed, and retry of the same submission then returned 201.
9. Twenty invalid attempts from the same reserved test peer consumed durable source limits; the next request returned 429. Admin's real aggregate view showed accepted, rejected and replay counts plus last accepted time without displaying payloads/phones.
10. Exact generated organizations/users/leads/sources and computed test-only rate buckets were removed. Database-side fingerprints of all pre-existing operational tables, new ingestion tables/rate buckets and Auth IDs/emails/passwords matched their baselines.

`node scripts/verify-ingestion-disabled.mjs` passed against a separate actual production runtime with the opt-in flag disabled: `/test-ingestion` returned **404**.

Relevant live regressions were run against the new production build because the lead/audit creator nullability and All Leads response were touched:

- `CRM_NEXT_DIST_DIR=.next-ingestion-check node scripts/verify-calls.mjs --additional-only`: pass, mixed call/edit race and coherent summary, with preservation fingerprints.
- `CRM_NEXT_DIST_DIR=.next-ingestion-check node scripts/verify-follow-ups.mjs --ui-only`: pass, schedule/refresh/reschedule/assignment/shared complete/cancel, readable history/reminders and unchanged call/confirmation counts, with preservation fingerprints.

Previously accepted real-user manual checks were not requested again. All test credentials/payloads remained internal; no customer CSV or live source was used.

## Additional refresh/recovery verification

Final review added tab-scoped persistence of the synthetic form's pending UUID/content. The latest production build passed a targeted `node scripts/verify-ingestion.mjs --recovery-only` run: a real endpoint request committed with HTTP 201, a browser-side test shim deliberately dropped that response before the form could acknowledge it, the form showed an error, refresh restored the pending intent, and retry returned 200 replay with exactly one database record. The anonymous form/All Leads/unknown-column flow and complete existing-data preservation also passed again. This is deterministic client-boundary response-loss injection, not a claim of a physical network-cable test.

An initial Playwright route-abort version of this test harness failed because it matched Next.js's unrelated route-announcer alert and navigated before the handler completed. The harness was corrected to target the actual submission error and to drop the response deterministically; no application success was fabricated. One uncaught harness attempt required explicit recovery of its two verified synthetic organizations and four verified synthetic users; no manual records were in that scope. Unidentified anonymous rate-limit hashes from that interrupted attempt were deliberately left for normal automatic two-hour expiry rather than broadly deleting rate metadata. Subsequent completed runs removed only their own computed buckets and matched pre-existing data/password fingerprints.

## Limits and next manual check

No Step 6A migration/credential blocker remains for local development. Public internet deployment, a real production reverse-proxy/IP policy, production edge abuse protections, actual landing-page/Apps Script mappings and dual-write/sample reconciliation have **not** been verified. Origin/form ID and the public challenge are not authentication. With default proxy trust disabled, the peer bucket is shared; deliberate trustworthy proxy configuration is required before internet rollout. No server-to-server adapter or adapter credentials were invented.

Next manual check: Admin → Lead sources → create an explicitly synthetic localhost source; opt into the local-only test form as described in `step-6a.md`; submit from Incognito without staff login, then verify New lead/quiz column/refresh in the staff browser. Keep the live Google Sheet collection unchanged. The test page should remain disabled for deployment.

The complete contract, mapping/security/counting rules, exact Gujarati manual steps and parallel rollout/rollback plan are in `step-6a.md`. Git delivery is reported with the actual branch/commit/verified push in the final response. Unrelated formatting/generated changes remain preserved outside the commit. Stop after Step 6A.

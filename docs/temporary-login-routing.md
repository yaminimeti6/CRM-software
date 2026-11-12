# Temporary CRM login routing ? 2026-11-12

The owner reported AUTH_INVALID_CREDENTIALS on ngrok, while a fresh Incognito localhost sign-in succeeded. Read-only account diagnostics found the retained first Admin active, email-confirmed, password-set and not banned. No separate activation username exists for that Admin; registered email remains its sign-in identifier. No password, account, role or bootstrap state was changed.

## Observed routing gap and repair

Port 3000 had two workspace Next processes: a production server bound to ::1 and a development server bound to ::. Anonymous requests to IPv4 versus IPv6 returned different compiled asset sets; localhost/ngrok matched the loopback instance. Only the identified duplicate loopback production process was stopped. The owner's working development process was retained. IPv4, IPv6, localhost and ngrok then all returned HTTP 200 login pages with the same compiled assets.

The owner initially still saw the credentials error, then reported successful ngrok login after the fresh-local diagnostic. This is owner-confirmed manual login acceptance. The listener split was a verified routing defect; we do not claim it proves why the authentication provider rejected every earlier credential attempt. No actual credentials were collected or reset to diagnose it.

## Prevention and user guidance

The tunnel start helper now anonymously probes IPv4 and IPv6 and refuses to start/reuse a tunnel when different CRM builds occupy port 3000. It allows one available listener or two addresses serving the same build. It never kills an arbitrary process or forwards a staff session. Existing agent-ownership checks remain.

The sign-in form explains registered email/activation username versus display name and separate per-address sessions. The invalid-credentials message asks to check credentials without incorrectly implying an active account needs a new staff grant. The existing password-based login and authorization implementation remains intact; no fallback, auto-login, new username or password reset was added.

## Verification and limits

Automated listener tests cover same build, stale IPv4/IPv6 split, one unavailable address and no available server. Auth diagnostic tests still distinguish credentials, provider, confirmation and rate-limit errors. Anonymous HTTP checks confirmed address parity after repair. The existing tunnel start helper passed its new preflight against the running CRM. An isolated production build and browser-secret scan are used so the owner's working dev server is not replaced or its .next cache overwritten.

Prior automatic review did not authorize forwarding an existing Admin session/customer record through ngrok for an agent-run test. The owner's report of successful manual login is not treated as that separate approval; no agent-authenticated ngrok test was performed. Live /Wife/ to CRM/real Sheet acceptance, authenticated public calling/export origin checks and actual Meta consent remain separate pending work.

No GitHub push or permanent deployment. Unrelated workspace edits are preserved.

Subsequent preview performance update: the temporary tunnel now uses a separate optimized local build. See temporary-preview-performance.md for current run commands and theme evidence.

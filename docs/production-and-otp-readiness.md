# Production and OTP readiness ? local preparation only

Owner decision update (2026-11-12): customer-mobile OTP is optional for this pilot; continue calling/orders without SMS OTP. A temporary ngrok tunnel is authorized while the PC/CRM/agent run. Permanent hosting and GitHub push remain unauthorized. No SMS was sent.

Native XLSX is implemented. A real native read-only development backup restored into a new password-protected local PostgreSQL cluster: 77 tables in public, crm_private, crm_migrations and auth matched all source-at-backup row fingerprints. RLS/role denials and bootstrap protection passed; the local restore server was stopped. This is a scoped local recovery drill, not a production disaster-recovery certificate. See native-recovery-and-xlsx.md for evidence and exclusions.

Temporary HTTPS verified only for sign-in HTTP 200 and anonymous API HTTP 401, with request inspection disabled. Automated forwarding of an existing Admin session/customer data through ngrok was rejected by automatic approval review for lack of separate explicit authorization. Authenticated public workflow remains unverified until separately approved or manually tested by the owner.

## Exact blockers

- OTP (optional, not a pilot blocker): if enabled later, select an authorized provider and delivery channel, approve sender/template requirements applicable to the business, and supply credentials through private local/server configuration. Then implement and verify provider delivery/verify callbacks, expiry, resend/throttle, replay protection and verified phone binding. Customer phone OTP must never be confused with staff sign-in OTP or imported legacy labels. Save the lead before OTP; failed delivery/verification must not delete or confirm it. No provider was guessed and no untrusted legacy value is upgraded to verified.
- Hosting: temporary ngrok is authorized; no permanent host/project/domain has been selected. Select staging and production destinations and authorized DNS/deployer access. Public CRM_APP_ORIGIN, Meta callbacks, source allowlists and Auth redirect URLs must match the final HTTPS origin. Localhost acceptance remains local.
- Backup drill: PostgreSQL 18 tools were found outside PATH. A new isolated localhost target was created, verified and stopped by scripts/verify-native-recovery.mjs. Permanent scheduled backups/PITR, an independent recovery destination, hosted Auth sign-in, server-secret recovery and storage object coverage still require production decisions. Never restore over the current CRM merely to test recovery.

## Prepared deployment procedure

1. Use a separate authorized production project/configuration; do not silently turn the development Supabase project into production or reuse its private secrets. Record applied migration checksums and preserve the completed bootstrap guard.
2. Run npm.cmd ci, npm.cmd run typecheck, npm.cmd test, npm.cmd run build and the browser-secret scan. Keep .env files and customer exports out of the release/commit.
3. Supply server variables through the hosting secret store, including the persistent Meta token-encryption key if retained Meta tokens are migrated. NEXT_PUBLIC variables are bundled into browser assets and must contain no privileged secret.
4. Run the Next server behind the authorized host's HTTPS termination/reverse proxy. Keep the bounded Meta worker as a separate supervised process using its restricted database identity. Do not start it with the administrator DB login.
5. Verify HTTPS certificate/redirects, authenticated pages and role denials, request/origin limits and no browser secrets. Complete the authorized live form/real Sheet pilot separately, including retry reconciliation. Check actual monitoring and worker restart behavior.

## Backup/restore evidence required

Use the chosen Supabase project's supported backup/PITR procedure and documented recovery coverage. For a supplementary logical drill, use a compatible pg_dump custom archive, including required app/private/auth/migration schemas and reviewed roles/extensions; a CSV export is not a backup. Store archives with private ACLs/encryption and a retention policy outside Git. Do not place database passwords in command arguments or chat; use a private PostgreSQL password/service file or secure prompt.

Restore only to a new isolated, explicitly identified target with pg_restore --exit-on-error. Do not use --clean against the current CRM. Reconcile project-managed Auth/role/extension prerequisites using the platform recovery guide before restoring; a generic public-schema dump cannot prove account recovery.

Compare source-at-backup and restored table counts/checksums, account/password fingerprints privately, migration ledger, RLS and role denials, bootstrap protection, existing history/call/confirmation totals and representative dynamic answers. Test sign-in with an authorized retained account without printing passwords. Verify application secret/encryption key recovery independently; database backups alone do not restore server secrets or storage objects. Record duration, restore point, archive checksum, target identity and any excluded coverage. Only then mark the drill passed.

Run node scripts/production-readiness.mjs for a presence-only local report. It exits 2 while production prerequisites are missing and performs no hosting, backup, restore or external writes; it reports the last local recovery evidence separately.

Primary references consulted: https://www.postgresql.org/docs/current/app-pgdump.html , https://supabase.com/docs/guides/platform/backups , https://nextjs.org/docs/app/guides/self-hosting . These inform the preparation; they are not execution evidence.

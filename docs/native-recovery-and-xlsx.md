# Native XLSX, temporary HTTPS and native local recovery

Delivery date: 2026-11-12. Customer OTP is optional for the pilot by the owner's instruction; no provider was selected or SMS sent. Existing calling, orders, permissions and records remain intact. No GitHub push or permanent hosting/deployment.

## Native Excel export

All Leads now offers Export Excel (.xlsx) beside CSV. Both use the existing Admin-only filtered export RPC, identical server-side filters, 5000-row/8-MB input limit and legitimate export audit. No new lead-ingestion, calling or export database model was built.

The generated file is a real OOXML ZIP workbook with workbook/worksheet relationships, content types, text-preserving cells, bold/frozen header and filter range. IDs, phone leading zeros, Unicode and unknown dynamic-answer JSON stay literal text. Formula-like content is inline text, never a formula or external link. Cells exceeding Excel's 32,767-character limit are rejected explicitly; CSV remains available without silent truncation.

The full automated suite passed 56/56 tests. Typecheck, production build and the browser-secret scan passed. Verification: native round-trip through the independent existing ZIP/SAX import parser, literal formula/Unicode/identity checks, XML-control escaping, empty workbook and overlong-cell cases. Actual browser downloads from localhost:3000 produced both CSV and XLSX containing only the filtered retained lead and its original submission UUID. Two legitimate format export audits were appended for that run; every prior business record/password and prior audit row stayed unchanged. Settings saves were intercepted; no new leads/users. No desktop Excel application was launched, so no visual Excel-application check is claimed.

## Native backup and local restore

Native PostgreSQL 18 tools were found under C:/Program Files/PostgreSQL/18/bin (outside PATH). scripts/verify-native-recovery.mjs used the existing authorized development project's server version 17.11 through a verified-TLS, repeatable-read/read-only exported snapshot. It made a custom pg_dump archive and restored it with pg_restore --exit-on-error --single-transaction into a freshly initialized PostgreSQL 18.6 database bound only to 127.0.0.1 on a free port. It never restored into the source CRM.

Source schemas: public, crm_private, crm_migrations and auth. All 77 table row-count/content fingerprints matched the snapshot, including account/password rows, history, dynamic answers and migration ledger. Existing effective table read grants/RLS matched; authenticated Admin organization binding worked, unrelated identity saw zero leads, anonymous customer access and authenticated private bootstrap access were denied. The completed bootstrap record was preserved. The restored table fingerprints still matched after rolled-back authorization checks.

The archive is AES-256-GCM encrypted with read-back/hash verification. Private directory inheritance was removed and access limited to the local operator and SYSTEM. Credentials travel only through private process environment/memory, never command arguments or output. Encryption key and recovery data remain in the ignored private recovery folder; keep a separate secure recovery-key copy before treating this as an independent disaster-recovery backup. Temporary plaintext dumps were removed after encrypted-archive verification. Isolated clusters were stopped; no startup service was installed.

Ignored evidence: .cache/native-recovery-result.json and its private recovery folder. The first native attempts exposed Windows child-pipe lifetime, canonical inet address and the fresh target's default public schema conflict; those were resolved with hidden exit-based pg_ctl handling, canonical host validation and removal of only the freshly created empty target schema. No original CRM data/grants/passwords were altered.

Excluded/not certified: Storage object files, provider-managed extensions outside selected schemas, global role login passwords, hosted Supabase Auth sign-in service, server environment secrets, scheduled production backups/PITR, production restore and cross-version behavioral equivalence. Restored object ownership is local (--no-owner); local role identities/privileges support the drill, not a production owner/password migration. This is a scoped real local recovery pass, not a complete production recovery certificate.

## Temporary ngrok access

The owner authorized a temporary free ngrok tunnel while the PC/CRM/agent run. Current URL is discovered from the local ngrok agent; it is not hardcoded in application code. Start/reuse: node scripts/start-crm-tunnel.mjs . Stop only the verified CRM agent: node scripts/stop-crm-tunnel.mjs . No autostart, DNS change, permanent host or GitHub push. Request inspection is disabled.

Public HTTPS sign-in returned 200 and anonymous /api/me returned 401 with normal TLS verification. An authenticated Admin session/customer-data test through the third-party tunnel was rejected by automatic approval review because that sensitive forwarding lacked separate explicit authorization. It was not retried or bypassed. Authenticated public workflow, canonical public-origin handling, Meta callback/source configuration and live /Wife/ plus real Sheet acceptance remain unverified/pending; .env.local CRM_APP_ORIGIN was not silently changed. The owner may separately authorize the automated check or perform a manual login test.

Primary format/recovery references: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document , https://www.postgresql.org/docs/current/app-pgdump.html , https://www.postgresql.org/docs/current/app-pgrestore.html . Execution evidence above comes from local checks, not these references.

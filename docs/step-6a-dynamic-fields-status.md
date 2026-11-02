# Step 6A dynamic-field correction

The sample Sheet is a reference only. No live website/Sheet access, modification, import or adapter was attempted. Step 6B remains pending actual source access/mappings and HTTPS deployment.

## Gap and fix

Original Step 6A already accepted unknown questions and preserved typed original JSON. Its field registry/selector, however, identified questions only by organization/name. Equal question names from unrelated sources or versions could therefore appear as one column. Inspection also found the advertised 30-answer root limit was accidentally reduced to 20 by a nested-object bound; root now correctly permits 30 while nested limits remain enforced.

Migration `202611020016_scoped_dynamic_fields.sql` adds source/version-specific field identities and organization RLS, backfills known original/current/historical keys, and preserves the legacy/manual namespace without guessing its source. Source-backed insert/edit registration is atomic. Selector descriptors use separate stable IDs and qualified form/version labels. Cells from other sources/versions/manual scope show Not applicable and cannot be edited as that question. Scope is derived from immutable lead-ingestion metadata, never a submitted scope. Old versions' answers/history/receipts are not rewritten.

Only name/mobile are required business inputs; server receipt time remains authoritative. Address and tracking remain optional. Unknown field names/types are preserved in original JSONB; spreadsheet display uses compatible strings. Required source/submission/challenge fields remain protocol protections, not a fixed questionnaire schema. New questions need neither code changes nor per-question SQL migrations. Reusing a key with a changed meaning requires a new configured form version; no system can infer that semantic change from an unseen page.

## Resume and actual migration state

The earlier automatic approval-review limit prevented execution; it was not bypassed. On resume, execution was available. Git was inspected on master with pending Step 6A edits and unrelated existing changes preserved. The real migration ledger contained 001–015 and no 016. Migration 016 was then applied once through the checksummed migration runner with the existing advisory lock and verified TLS. No database reset/bootstrap was performed.

Database-side before/after count/hash fingerprints matched for all existing business tables, sources/metadata, leads/answers, fields/history, calls, confirmations, follow-ups/presence and Auth IDs/emails/passwords. The new scoped registry was backfilled; all prior migration checksums were preserved.

## Actual local checks

- Full `npm test`: 20/20 pass, including two-source/version identities, unknown fields and original types, manual compatibility, protected source scope, role/organization RLS, old-version edits, 30-field boundary, atomic registration failure/retries and prior Steps 1–6A regressions.
- `npm run typecheck`: pass.
- `CRM_NEXT_DIST_DIR=.next-ingestion-check npm run build`: pass.

## Actual live browser/development Supabase checks

`node scripts/verify-dynamic-fields.mjs` passed exit 0 with disposable users and two synthetic organizations against the actual production build and real development Supabase at localhost:3108.

- Two different enabled sources in the same organization submitted different optional quiz fields, including number/boolean originals and an identically named Shared question with different meanings.
- Manual, source A/v1 and source B/v1 Shared questions received distinct identities; only matching rows displayed an editable cell.
- Source A changed to v2, submitted a new previously unknown nested field and omitted an old field. Both v1 and v2 definitions remained available. Original v1 source metadata/answers remained identical; the new nested value retained its original JSON type.
- The actual selector displayed separate source/version columns without a field-specific migration or code change. Nonmatching source/version/manual rows had no editable input for the selected scoped question.
- Editing A/v1 after v2 existed persisted after refresh and did not alter B/v1, A/v2, manual answers or immutable original v1 metadata.
- Analyst/other-organization PII access, direct registry mutation and forged source/version scope failed. No call or confirmation was fabricated.
- Exact synthetic users/organizations/leads/sources/definitions and computed test-only rate buckets were cleaned. All pre-existing business/source/definition/Auth/password fingerprints matched on the completed instrumented run.

The first end-of-run fingerprint comparison failed without identifying a table. An instrumented rerun repeated the same feature checks and passed every compared fingerprint. The earlier differing value cannot be reconstructed from that process; it is not claimed to have been a proven business-data defect or definitively attributed to rate-bucket expiry. Auxiliary rate windows can expire during live tests. Migration preservation and the completed instrumented run both verified unchanged existing business records. A verifier-only duplicate helper-name syntax error was also fixed before real checks executed; application/permission protections were not weakened.

Remaining ingestion regression/secret/gate results are recorded after their actual runs below. Existing user manual acceptance is not inferred from automated synthetic checks. Production deployment and live website/Sheet integration remain untested. Stop within Step 6A.

## Completed remaining checks

- Full `node scripts/verify-ingestion.mjs` passed exit 0 against migration 016 and the updated selector: anonymous form/All Leads/unknown-column refresh, committed-response-loss recovery, JSON/form encoding, sequential/concurrent retries, conflicting-content 409, preserved staff Notes, repeat inquiries, protected fields/CORS/role isolation, database-backed throttling and injected scoped-field failure with complete rollback and safe retry.
- This full regression also matched pre-existing operational/source/definition/Auth/password fingerprints after exact cleanup, independently of the dedicated dynamic-field run.
- Browser bundle secret scan passed on 17 production JS/map files. The opt-in-disabled production runtime returned 404 for the synthetic form.
- No live website/Google Sheet integration was performed. No production deployment or new module was started. Earlier accepted user records and unrelated working changes remain preserved.

# Step 8 acceptance record

## Implemented

Organization-scoped Admin catalog, stable brand/product/landing-page UUIDs, editable names and optional URL/language, archive-only behavior, optimistic revisions, explicit immutable source form versions and lifecycle. Existing Sources, dynamic field identities, All Leads and resumable Imports are extended rather than duplicated. See [step-8.md](step-8.md) for permissions, migration, lifecycle, attribution and manual synthetic steps.

Step 7 manual acceptance from the user: two synthetic leads imported, one invalid excluded; reprocessing retained the same IDs. Step 6B remains pending.

## Migration

Migrations `202611020019_catalog_versions.sql` and `202611020020_catalog_version_conflicts.sql` are applied in development, with checksum ledger confirmation. No reset or customer backfill. Existing source configurations gained legacy configuration rows with unknown catalog; old leads/import snapshots remain untouched. The initial broad schema fingerprint comparison flagged the new nullable `import_batches.configured_attribution` column because whole-row JSON includes new columns; a subsequent ledger inspection confirmed migration application. This was not an unapplied migration. Final fixture verification separately compares operational/Auth fingerprints before and after the tests.

## Automated and real verification

The integrated PGlite scenario covers hierarchy, duplicate/stale saves, invalid parents/URLs, two pages/sources with same-name and unknown questions, scoped column registration, version activation/switch/retirement, preserved old live/import snapshots, import replay, archive rejection with identical receipt replay, permissions, isolation and deactivation. Input tests cover configured relationship spoofing and unsafe URLs. Test setup was corrected to retain a second synthetic active Admin while testing deactivation, preserving last-Admin protection.

The real PostgreSQL test adapter initially encoded JS arrays as PostgreSQL arrays rather than JSON; it was fixed to serialize JSON parameters explicitly. Its failed run performed exact synthetic cleanup. No application success is claimed from that failed attempt.

Actual final live/browser, regression, build, secret and Git delivery evidence is appended below after completion.

## Boundaries

No real customer CSV, live landing page, Shopify or Google Sheet was changed. No production deployment/real external form integration is claimed. Semantic question meaning cannot be inferred automatically; immutable version identities/bindings and separate scoped fields enforce the explicit version workflow. Existing arbitrary legacy import versions remain unknown rather than inferred/backfilled. Local test form remains opt-in and production-disabled by default. Stop after Step 8.

## Final verification evidence

- Full automated suite: **25 passed, 0 failed**, covering existing Steps 2–7 plus Step 8 database/input scenarios. TypeScript and production build (`.next-catalog-check`) passed.
- Real development Supabase assertions passed: hierarchy and invalid relationships, two pages/sources with different/same-name questions, unknown-field column registration, version switch/retirement, immutable earlier live/import snapshots, repeated import processing, archive rules, receipt replay, role/RLS/cross-organization checks and deactivation.
- Actual browser assertions passed: brand → product → landing-page creation, version creation/activation, edit/archive and refresh persistence. Real anonymous HTTP submissions used configured attribution; unknown fields survived; retired identical receipts replayed; new retired submissions and relationship override payloads were rejected. All Leads displayed the saved snapshot after refresh. Concurrent saves returned one 200 and one 409; an already signed-in deactivated Admin immediately received 403.
- Browser test locators were corrected for input values, explicit accessible selector labels and a Windows-encoded separator. These were test-harness/accessibility corrections; partial runs were not reported as full passes.
- The broad cleanup comparison identified **only `crm_private.team_rate_limits`** changing from synthetic browser logins. The isolated verification server now uses an ephemeral test-only rate secret and removes only its exact computed rate buckets. Earlier anonymous rate hashes remain subject to the existing automatic one-day expiry; no broad rate-table deletion or security bypass was used. No business-record/password mismatch was found.
- Production runtime test form remains 404 when its opt-in flag is disabled. Browser scan checked 19 JS/map assets: configured privileged values absent. Dependency audit: zero vulnerabilities. Staged secrets are checked separately before Git delivery.

The final real catalog verifier completed with exit 0, including exact synthetic cleanup and fingerprint-identical pre-existing operational/catalog/import records and Auth/passwords. The anonymous local test form now obtains the current version from its server challenge; it sends that version on a deliberate new inquiry and preserves original pending intent on retry. A real anonymous browser submission returned 201 without staff credentials. The challenge exposes only the public version key, no catalog relationships or PII.

Existing Step 6A anonymous-form/All Leads/refresh and deterministic lost-response recovery regression passed with preservation checks. Existing Step 7 small CSV/XLSX mapping/zero-write preview, explicit exclusion/confirmation, Gujarati/date handling, duplicate file/external identity conflicts, concurrent resume, row rollback/recovery, permissions/error downloads and staging expiry regression passed; pre-existing data/password fingerprints matched after cleanup. The 10,460-row volume test was not unnecessarily repeated in Step 8; its Step 7 evidence remains recorded separately.

Final concurrency review found that independent version-row revisions alone did not protect two different versions activating on one shared source. Migration 020 requires the expected source revision for activation/retirement; client validation and UI requests include it. The automated scenario asserts stale-source rejection, and the real browser/API verifier tests simultaneous different-version activation separately.

Final post-migration-020 verification completed with exit 0: simultaneous different-version activation returned one HTTP 200 and one 409; explicit reactivation with fresh source/version revisions succeeded. Full catalog/browser/anonymous-form checks and exact business/Auth preservation passed. Final automated suite remained 25/25, TypeScript/build passed, 19 browser assets passed secret scanning, and production opt-in gating passed.

Delivery policy updated by the user on 2026-11-03: Step 8 and remaining steps are local commits after checks; no routine GitHub push. AGENTS.md records the new standing rule. This step is committed locally only; GitHub push is intentionally deferred until the user explicitly requests it at project end. Step 6B remains pending; Step 9 is not started.

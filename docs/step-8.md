# Step 8: catalog, landing pages and source form versions

## Scope and permissions

The CRM had source text references but no existing relational brand/product module. `/app/catalog` extends the existing Admin navigation and `/app/ingestion` source module; it does not create a second lead-source or import system. Only active organization Admins can read/manage catalog configuration and version records. Managers and Telecallers retain their existing operational lead access and can read each lead's frozen attribution; they cannot manage catalog configuration. Creative Analysts receive neither catalog management nor customer PII access. Anonymous clients cannot read catalog tables. Every API and security-definer mutation checks active membership; RLS restricts table reads. No direct authenticated table writes/deletes are granted.

## Catalog

Stable UUID records have kind brand → product → landing_page. Composite organization/parent foreign keys and protected mutation checks prevent cross-organization or incorrect parent kinds. Parent/type is immutable; archive and create a new record for a different relationship. Names can be edited with revision checks. Names are unique case-insensitively among siblings of the same kind, preventing retry/double-submit duplicates; a repeated uncertain create returns conflict rather than creating another record. Landing pages support optional language and HTTP/HTTPS URL, with credentials/whitespace/invalid URLs rejected. There is no delete endpoint. Archiving does not cascade-delete descendants or historical relationships. An archived ancestor blocks activation and new live submissions; existing receipts and historical imports remain readable.

## Versions and questions

Create a source using the existing Lead sources screen, then create a draft explicit form version in Catalog with a landing-page binding. Activate it to atomically retire the previous active source version and switch the source pointer. Creating a version does not enable a disabled source. Retire stops new live submissions for that current version. Re-activation is explicit and revision-checked. Activation/retirement also checks the shared source revision: competing activations of different version rows cannot silently overwrite the newer source selection. The `(organization, source, version_key)` identity and landing-page binding cannot be edited/reused. Use a new version for a changed question meaning, landing-page identity or product relationship; do not rename an existing question to disguise a meaning change.

There is no fixed questionnaire and no client-supplied schema registration. Unknown optional fields remain accepted within existing Step 6A limits, are registered automatically, and appear in the existing column selector. Same-name questions across sources/versions retain separate identities. Existing answers and history are never rewritten by version/catalog changes.

Existing source configurations receive **legacy configuration records only**, with unknown catalog attribution. They keep working without inventing a brand/product from text references. Legacy source versions can still be edited through the source screen until that source has managed versions. Afterwards use Catalog creation/activation; arbitrary unregistered switches are rejected. Old string version associations and dynamic fields remain intact. Old leads/import batches are not backfilled.

## Configured versus raw attribution

New managed live submissions must send the exact current `form_version`. Server/database logic derives organization, source, immutable version ID and brand/product/page IDs and labels. Public payloads cannot override these relationships. Raw campaign/click/source values remain separate untrusted advertising metadata. Legacy brand/product reference text is not a relational catalog link.

A receipt stores the configured IDs, names, URL, language and version as they were at receipt time. Later renames, archive changes and source switches cannot rewrite that snapshot. Identical already-accepted receipt retries retain the original version/content and snapshot, including after retirement/archive. Different content using the same submission ID still conflicts. New requests from an old, missing or retired managed version are rejected. Source enabled/origin checks remain enforced; disabling a source still prevents public access as before.

Historical imports freeze configured attribution **at preview batch preparation**, before operational rows exist. Resume/retry uses that frozen snapshot, not current catalog names. The existing batch config/revision/idempotency comparison is unchanged. Explicit registered versions, including draft and retired versions, are allowed for historical records: historical import confirmation is a separate Admin approval and does not activate public traffic. A legacy version with no configured catalog stays unknown. After a source has managed versions, new arbitrary unknown version keys are rejected. Previously prepared batches with unknown attribution remain unknown even if a catalog is configured later. All Leads displays configured snapshot details or explicitly says catalog attribution is unknown. No inference from phone, names, URLs or raw attribution is performed.

## Development migration and acceptance

`202611020019_catalog_versions.sql` and `202611020020_catalog_version_conflicts.sql` are applied through the established verified-TLS checksum ledger. Migration 020 protects the shared source pointer with an expected source revision. It adds catalog/version tables, registers existing source configurations as legacy, adds a nullable frozen import attribution column and protects new receipt/preview writes. Existing leads, answers, calls, confirmations, imports and Auth passwords are not rewritten. Do not modify/rerun applied migration SQL manually.

The Step 7 user acceptance is recorded: two synthetic leads imported, one invalid row excluded, and reprocessing retained the same lead IDs.

### Manual synthetic acceptance

1. Admin → Catalog: create Brand `Synthetic Step8 Brand`, Product `Synthetic Step8 Product` under it, then two landing pages `Synthetic Gujarati LP` / `Synthetic Hindi LP` under that product. URLs `https://example.test/gu` and `https://example.test/hi`; languages `gu` and `hi`.
2. Lead sources: create two explicitly synthetic localhost sources with distinct public form IDs, e.g. `synthetic_step8_gu` and `synthetic_step8_hi`, allowed origin `http://localhost:3000`. Enable only these synthetic sources for the local test.
3. Catalog → Source form versions: create `gu-v1` on the Gujarati source/page and `hi-v1` on the Hindi source/page. Activate each. Refresh to verify persistence.
4. With the existing local-only synthetic test form enabled, open `/test-ingestion?form_id=synthetic_step8_gu`, submit synthetic Name/Mobile and optional fields. Inspect All Leads → Configured attribution and the dynamic column selector. Repeat for the Hindi source with different optional answers. Do not change the live website/Google Sheet.
5. Imports: upload a fresh small synthetic CSV (do not reuse an already confirmed worksheet), select the Gujarati source and registered `gu-v1`; preview must show its frozen attribution. Review mappings and only explicitly confirm a synthetic preview. Refresh/resume must retain lead IDs.
6. Rename the brand. Earlier lead/preview snapshots must keep the old name; a new submission uses the new name. Create/activate `gu-v2` for a question meaning/page change. Existing `gu-v1` answers remain scoped separately. Identical old accepted retries remain valid; a new old-version submission fails.
7. Edit/archive a referenced page or brand, refresh, and verify historical attribution still exists. New live inquiries are blocked by the archived ancestor. Restore only your synthetic records when continuing testing. Check a Telecaller cannot open/manage Catalog.

No live Shopify/website/Google Sheet changes, customer file import, dashboard, advertising integration or Step 9 functionality is included. Step 6B remains pending.

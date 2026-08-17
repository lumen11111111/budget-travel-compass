# Budget Travel Compass — Local D1 Baseline Report

Date: 2026-08-14  
Phase: 7A — Local D1 Baseline Initialization  
Result: **LOCAL D1 BASELINE READY**

## Existing D1 State

Configured Wrangler local D1 target:

- binding: `DB`
- database name: `example-site-db`
- database ID: `00000000-0000-0000-0000-000000000000`
- resource location used by every write and read in this phase: **local**

Before initialization, `sqlite_master` contained only `_cf_METADATA`. There were no CMS tables, categories, placeholders or Production Articles in the importer target.

The placeholder database name/ID were deliberately not changed because Phase 7A authorizes local baseline initialization only, not instance/production resource configuration.

## Existing Initialization Tooling

Existing project capabilities audited:

- `npm run d1:init` / `tools/starter/d1-init.ts`;
- `src/db/migrations/0001_initial.sql`;
- `npm run db:d1-seed:write` / `src/db/generate-d1-seed.ts`;
- `src/db/schema.ts`;
- D1 and local repository implementations under `src/db/repositories/`;
- `wrangler.jsonc` DB binding;
- existing seed authority in `src/db/seed-data.ts`.

`npm run d1:init` is remote-only and rejects the placeholder database ID, so it was not used. Phase 7A reused its real migration and seed generator directly with explicit Wrangler `--local` execution. No parallel schema or custom CMS model was created.

## Schema Initialization

Applied once to `example-site-db --local`:

1. `src/db/migrations/0001_initial.sql`
2. generated `data/d1-seed.sql`

Wrangler reported:

- migration: 8 commands executed successfully;
- baseline seed: 45 commands executed successfully;
- remote commands: 0;
- R2 operations: 0.

## Tables

Post-initialization tables:

- `articles`
- `categories`
- `tags`
- `article_tags`
- `media_assets`
- `works`
- `homepage_blocks`
- `site_settings`
- Wrangler/SQLite internal tables

Column validation passed against the current migration, Drizzle schema, repositories and importer expectations:

- `categories`: id, name, slug, description, sort_order, enabled, SEO fields and timestamps;
- `tags`: id, name, slug, description, sort_order, enabled and timestamps;
- `media_assets`: R2 key, URL, MIME/file fields, alt/usage fields and timestamp;
- `articles`: Title, Slug, Summary, Body HTML, cover fields, Category FK, Status, feature/order/view fields, publication/timestamp fields, SEO fields and related work FK;
- `article_tags`: article/tag composite key fields.

Schema mismatches: **0**.

## Category Baseline

| ID | Category | Slug |
|---:|---|---|
| 1 | Inspiration | `inspiration` |
| 2 | Trip Planning | `trip-planning` |
| 3 | Flights & Stays | `flights-stays` |
| 4 | Budget Tips | `budget-tips` |
| 5 | Packing & Gear | `packing-gear` |
| 6 | Travel Styles | `travel-styles` |

Category count: **6**  
Unique category slugs: **6**  
Additional categories created: **0**

## Placeholder Baseline

| ID | Slug | Status | Category ID |
|---:|---|---|---:|
| 1 | `placeholder-inspiration-article` | draft | 1 |
| 2 | `placeholder-trip-planning-article` | draft | 2 |
| 3 | `placeholder-flights-stays-article` | draft | 3 |
| 4 | `placeholder-budget-tips-article` | draft | 4 |
| 5 | `placeholder-packing-gear-article` | draft | 5 |
| 6 | `placeholder-travel-styles-article` | draft | 6 |

The rows were generated from the existing `src/db/seed-data.ts` authority. Placeholder copy was not rewritten.

- placeholder count: 6;
- unique placeholder slugs: 6;
- Published placeholders: 0;
- collision with the 44 Production slugs: 0.

## Existing Tag and CMS Baseline

The approved existing seed contains six baseline Tags (`planning`, `how-to`, `checklist`, `comparison`, `reference`, `example`) and 12 placeholder/tag relations. These existing baseline rows were preserved; no new tag taxonomy was generated.

Other existing CMS baseline rows:

- Homepage Blocks: 6
- Site Settings: 1
- Media Assets: 0
- Works: 0

## Runtime Store Alignment

An OpenNext Worker build was generated without deployment and started with Wrangler local runtime against the initialized D1.

Application-level repository QA:

- `/sitemap.xml`: HTTP 200;
- D1 category URLs: 6;
- category `<lastmod>` values from D1 `updated_at`: 6;
- Published article URLs: 0;
- placeholder exposure in sitemap: false;
- `/category/inspiration`: HTTP 200;
- placeholder exposure in public category output: false.

The category route repository path loaded the D1 snapshot, successfully mapped the six Category records and six Draft Article records, then correctly filtered the Draft records from public output. This demonstrates the existing policy:

- D1 available with required tables → repository uses D1;
- Draft rows remain readable to the repository but excluded from public listings;
- fallback files remain intact and were not deleted or modified.

The temporary Wrangler local runtime was stopped after QA; no local test server remains on port 3011.

## Importer Target Alignment

The existing importer was re-run in dry-run mode with the Phase 7 five-slug allowlist.

Result:

- required D1 tables: PASS;
- five category slugs resolved: PASS;
- five unique Production slugs: PASS;
- collision with placeholder slugs: 0;
- images/media: 0;
- R2 objects: 0;
- D1 `no such table: categories` warning: **resolved**;
- `--execute`: not used.

## Pilot Dry Run Recheck

Validated pilot mapping:

| Content ID | Slug | Category slug |
|---|---|---|
| BTC-013 | `find-cheaper-flights-flexible-dates` | `flights-stays` |
| BTC-035 | `weekend-trip-budget` | `budget-tips` |
| BTC-022 | `carry-on-capsule-wardrobe` | `packing-gear` |
| BTC-017 | `grocery-store-tourism-guide` | `inspiration` |
| BTC-042 | `plan-first-solo-female-trip` | `travel-styles` |

Importer dry-run plan: 5 Draft records, 0 media objects. No Production Article was imported.

## CMS Counts

| Entity/state | Count |
|---|---:|
| Categories | 6 |
| Articles | 6 |
| Published | 0 |
| Draft placeholders | 6 |
| Tags | 6 |
| Article Tags | 12 |
| Homepage Blocks | 6 |
| Site Settings | 1 |

## Production Article Count

- Production Articles: **0**
- Production Drafts: **0**
- Production Published: **0**

Phase 7 pilot import was not resumed.

## Idempotency

The existing migration is a one-time schema migration and does not use `IF NOT EXISTS`. The existing seed SQL is a destructive baseline reset using DELETE followed by INSERT. Re-running either operation was therefore intentionally avoided.

Read-only postcondition assertions were used instead:

- 6 Category rows / 6 unique Category slugs;
- 6 Article rows / 6 unique Article slugs;
- 6 Tag rows / 6 unique Tag slugs;
- 0 non-Draft Articles;
- 0 Production Articles.

Any future baseline reset after Production Drafts exist must require separate authorization; it must not reuse the destructive seed automatically.

## Validation

| Validation | Result |
|---|---|
| Target locked to `example-site-db --local` | PASS |
| Real CMS migration applied | PASS |
| Existing baseline seed applied | PASS |
| Required tables | PASS |
| Required columns | PASS |
| Six Categories | PASS |
| Six Draft placeholders | PASS |
| Zero Published | PASS |
| Zero Production Articles | PASS |
| Application-level D1 repository read | PASS |
| Public Draft filtering | PASS |
| Pilot importer dry-run D1 validation | PASS |
| Read-only idempotency assertions | PASS |
| `npm run typecheck` | PASS |
| OpenNext/Next build | PASS |
| Remote Cloudflare/R2/deployment operations | 0 |

## Remaining Risks

- `example-site-db` and its all-zero database ID remain placeholder instance configuration. They are valid for this local baseline only and must not be treated as production resource configuration.
- The seed generator is destructive by design. Do not rerun it after Production Draft imports without an explicitly approved reset workflow.
- The local baseline is ready for Phase 7 Controlled Draft Import, not Full Draft Import or publication.
- Planned Internal Links, media/R2 and remote Cloudflare configuration remain deferred.

## Final State

**LOCAL D1 BASELINE READY**

**6 Categories**  
**6 Draft placeholders**  
**0 Published**  
**0 Production Drafts**

**PHASE 7 CONTROLLED DRAFT IMPORT MAY BE RESUMED**

# Budget Travel Compass Phase 6 Draft Import Preparation Design

Date: 2026-08-14  
Status: Approved scope captured for user review  
Governing contract: `docs/content/BUDGET_TRAVEL_COMPASS_IMPORT_CONTRACT.md`

## Goal and boundary

Create a deterministic, importer-compatible 44-article Draft Import Package, validate it twice, and run the existing importer in dry-run mode without writing CMS, D1, R2, media, routes, tags, or publication state.

The only existing importer change is the approved compatibility patch in `tools/starter/import-articles.ts`: Markdown emphasis, safe Markdown links, and exportable pure conversion/validation interfaces. No CMS schema, Framework architecture, Theme, article prose, frontmatter corpus, or Pass 2 internal-link behavior changes.

## Approaches considered

### A. Existing importer plus a project-specific preparation adapter — selected

Generate the exact `article.md` folder format already consumed by ContentForge, then use the existing importer for parsing, HTML conversion, category/D1 checks, collision checks, and dry-run planning. A small project-specific preparation script maps the approved authority documents into this input tree. The importer receives only the minimal compatibility patch required for faithful HTML.

This preserves the established pipeline and keeps Budget Travel Compass authority mapping outside generic importer logic.

### B. Teach the generic importer to read Research Packages directly — rejected

This would embed Budget Travel Compass Manifest, Eligibility and Freshness semantics into generic Framework tooling. It expands the importer architecture and violates the bounded authorization.

### C. Build a separate JSON/HTML importer — rejected

This would duplicate CMS logic and bypass existing validation, collision and execution behavior. It is explicitly outside scope.

## Components

### 1. Project preparation adapter

A focused script under `scripts/` will:

- read the Production Manifest, 44 `ARTICLE_DRAFT.md` files, Eligibility Matrix, existing six-category mapping and local CMS baseline;
- fail closed on authority conflicts or non-eligible articles;
- strip YAML and only the leading H1 equal to the Production Title;
- emit 44 importer-compatible folders under `content/import/budget-travel-compass/<Content-ID>/article.md`;
- use importer frontmatter fields `title`, `slug`, `summary`, `categorySlug`, `status`, `seoTitle`, and `seoDescription`;
- set `status: draft`, `tags: []`, no cover, no publication date, and no planned links;
- use the Content-ID folder name for traceability without importing Content ID into CMS.

The generated `article.md` tree is the deterministic source artifact. It contains no timestamp, job ID, CMS ID, or execution metadata.

### 2. Minimal importer compatibility patch

`tools/starter/import-articles.ts` will keep its table and block renderers. Its inline conversion will be extended to:

- convert `**text**` to `<strong>text</strong>`;
- convert `*text*` to `<em>text</em>`;
- preserve mixed plain/emphasized text;
- convert safe Markdown links while allowing emphasis in or near link labels;
- accept only `https:`, `http:`, `mailto:`, root-relative `/...`, and fragment `#...` hrefs;
- reject malformed or unsafe hrefs with an explicit validation error;
- HTML-escape text and attributes before emitting markup.

Pure conversion and validation functions will be exported behind a CLI-entry guard. The normal `npm run import:articles` behavior remains unchanged.

### 3. Deterministic record interface

The importer will expose a pure normalized article-record builder containing only stable content fields and converted HTML. Runtime `jobId`, `generatedAt`, database name, bucket name and execution mode remain in the existing dry-run/run record and are excluded from artifact equality.

Running preparation twice must produce byte-identical `article.md` artifacts. Converting both outputs must produce deep-equal normalized records.

### 4. Regression validation

A narrow test script will cover:

- strong;
- emphasis;
- mixed strong/emphasis/plain text;
- safe Markdown links;
- emphasis inside and adjacent to links;
- unsafe and malformed href rejection;
- tables without raw pipe residue or cell loss;
- ordered and unordered lists;
- H2/H3;
- Source Notes;
- HTML escaping;
- raw Markdown residue detection;
- deterministic normalized output.

It will import the pure interfaces from the existing importer rather than duplicate the renderer.

## Data flow

1. Resolve the 44 eligible Content IDs from the Manifest and Eligibility Matrix.
2. Map authoritative Manifest and Draft fields according to the Import Contract.
3. Validate canonical title, slug, category and metadata equality.
4. Remove frontmatter and the matching leading H1 only.
5. Write stable importer-format `article.md` files in Content-ID order.
6. Run conversion validation across all 44 articles.
7. Generate `BUDGET_TRAVEL_COMPASS_DRAFT_IMPORT_MANIFEST.md` without copying bodies.
8. Run preparation a second time and compare artifact hashes and normalized records.
9. Run the existing importer dry-run against the generated source directory, never with `--execute`.
10. Run regression tests, `npm run typecheck`, and—because importer code changes—`npm run build`.
11. Assert the real local CMS baseline remains 0 Published, 6 Draft placeholders, 0 production imports.
12. Generate `BUDGET_TRAVEL_COMPASS_IMPORT_PREPARATION_REPORT.md` and stop.

## Validation and failure behavior

Preparation fails closed for any missing authority, category lookup failure, title/slug collision, duplicate metadata, non-draft status, missing or duplicate H1 removal condition, unsafe link, raw Markdown emphasis/table residue, malformed table, heading/list conversion failure, planned-link emission, encoding replacement character, content loss, nondeterministic artifact, or CMS state change.

The six existing placeholders are read-only collision inputs. No upsert, overwrite, delete or placeholder modification is permitted.

The existing importer may write dry-run plan/run-record files containing execution metadata. These are not the deterministic source artifact and are compared only after removing documented volatile run fields. No database or object-storage write is permitted.

## Outputs

- `content/import/budget-travel-compass/<Content-ID>/article.md` for 44 records;
- `docs/content/BUDGET_TRAVEL_COMPASS_DRAFT_IMPORT_MANIFEST.md`;
- `docs/content/BUDGET_TRAVEL_COMPASS_IMPORT_PREPARATION_REPORT.md`;
- importer regression test evidence and dry-run plan/run record produced by existing tooling.

Final success state is exactly:

`DRAFT IMPORT PACKAGE READY`  
`NO CONTENT IMPORTED`  
`NOT READY FOR PUBLICATION`

Any unmet gate produces `DRAFT IMPORT PREPARATION BLOCKED` and stops without CMS writes.

## Self-review

- Placeholder scan: no TBD/TODO values.
- Scope: one bounded preparation pipeline; no import or publication action.
- Authority: no field source differs from the governing Import Contract.
- Ambiguity: deterministic source artifact is explicitly separated from volatile importer run records.
- Compatibility: existing importer remains the only CMS import path.

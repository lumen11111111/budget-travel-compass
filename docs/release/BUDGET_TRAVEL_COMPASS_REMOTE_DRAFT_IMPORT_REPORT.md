# Budget Travel Compass — Remote Draft Import Report

Date: 2026-08-17

Phase: 10 — Remote 44-Article Draft Import

Final status: **REMOTE 44-ARTICLE DRAFT IMPORT PASSED**

Publication status: **NOT READY FOR PUBLICATION**

## Scope

The approved deterministic corpus was imported once into the existing remote Cloudflare D1 database `budget-travel-compass` (`28e229c2-c032-4c09-9490-630c1b88df50`) using CREATE-only mode. All 44 production articles remain Drafts. No placeholder deletion, publication, seed/reset, schema change, Internal Link Pass 2, media upload, GA configuration, Ads configuration, or website/runtime modification was performed.

### Pre-Import Remote Baseline

- Categories: 6
- Articles: 6
- Draft placeholders: 6
- Published: 0
- Media assets: 0
- Unknown production articles: 0
- Existing rows were exactly the six expected placeholder slugs, all with `status=draft`.
- Explicit target: remote D1 `budget-travel-compass` / `28e229c2-c032-4c09-9490-630c1b88df50`.

### Deterministic Package

The existing `prepare-budget-travel-import` adapter regenerated all 44 ignored import artifacts twice from the approved Research Packages.

- Article artifacts: 44
- Normalized records: 44
- Eligible: 44/44
- Status: 44/44 `draft`
- Artifact corpus SHA-256: `a32b4ecd193189051b99e31ba34ed8792a3b4eab61b5d12fa58356ad4f88b82b`
- Normalized-record corpus SHA-256: `917d30c2bc7b3c5b1675695cebff1b040680d92af30254d5ddb19a2ec687a911`
- Both hashes were identical across consecutive runs.
- Canonical slugs confirmed: BTC-039 `pack-for-long-trip`; BTC-045 `plan-solo-weekend-city-break`.

### Pre-Import Leakage Gate

All 44 deterministic `bodyHtml` records passed the fail-closed scan. Every checked pattern returned zero hits:

- raw YAML;
- raw Markdown strong or emphasis;
- raw pipe-table residue;
- replacement characters;
- `CLAIM_SOURCE_LEDGER.md`, `RESEARCH_NOTES.md`, `EDITORIAL_QA.md`;
- Freshness Register, Research Tier, Content ID;
- `content-preparation/` and local Windows paths.

### Remote Collision Dry Run

The pre-import remote dry-run resolved all 44 categories and planned 44 Draft CREATE operations with zero R2 objects, zero tags, and zero collisions. No write occurred during dry-run.

### Remote CREATE Execution

Exactly one command was executed in remote CREATE mode:

`npm run import:articles -- --source content/import/budget-travel-compass --execute --remote`

- Result: PASS — 44/44 articles created.
- Import job ID: `20260817083215-verify-accessible-family-accommodation`.
- No second execute, update, upsert, overwrite, delete, publish, seed, or reset was run.

### Remote D1 Counts

Post-import read-only assertions:

- Categories: 6
- Articles: 50
- Production Drafts: 44
- Draft placeholders: 6
- Published: 0
- Media assets: 0
- Production article tag assignments: 0

### 44 Production Slug Assertion

- Canonical production slugs present: 44/44
- Missing production slugs: 0
- Unexpected production slugs: 0
- Expected placeholder slugs present: 6/6

### Field Fidelity

Remote rows were compared with the deterministic normalized records for Title, Slug, Category, SEO Title, SEO Description, Summary, and Status.

- Exact field mapping: 44/44 PASS
- Missing records: 0
- Mismatches: 0

### Body Fidelity

Remote `body_html` was compared byte-for-byte with deterministic normalized `bodyHtml`.

- Exact body equality: 44/44 PASS
- Mismatches: 0

### Remote Editorial Leakage

The scan was repeated against the actual 44 remote D1 `body_html` values. Every pre-import leakage rule returned zero hits.

- Remote stored bodies passed: 44/44
- Editorial-only leakage patterns: 0

### Public Draft Isolation

Production URL: `https://budgettravelcompass.com`

- Production Draft public article routes: 44 checked, 44 returned HTTP 404.
- Homepage: HTTP 200, production Draft links 0.
- Six category pages: HTTP 200, production Draft links 0.
- Search: HTTP 200, production Draft links 0.
- Sitemap: HTTP 200, production Draft links 0.
- Published production articles: 0.

The full public-isolation check was repeated after authenticated preview QA and remained unchanged.

### Protected Production Preview

Eight real remote Drafts were tested through `/admin/articles/[id]/preview` at 1440×900 and 390×844:

| Coverage role | Article | Result |
| --- | --- | --- |
| Longest title | BTC-008, `choose-local-boutique-hotel` | PASS |
| Longest body | BTC-042, `plan-first-solo-female-trip` | PASS |
| Shortest body | BTC-044, `solo-dining-while-traveling` | PASS |
| Most complex table | BTC-035, `weekend-trip-budget` | PASS |
| H3-heavy | BTC-027, `plan-first-international-trip` | PASS |
| Low-source editorial | BTC-021, `travel-daypack-setup` | PASS |
| HIGH freshness | BTC-011, `basic-economy-baggage-fees-real-cost` | PASS |
| Travel Styles / sensitivity | BTC-043, `hostel-group-tour-women-only-solo-trip` | PASS |

All 16 viewport/article checks rendered the expected H1 and article body from remote D1. Document-level horizontal overflow was zero at both viewport widths.

### Production Preview Authentication / Noindex QA

- Unauthenticated preview: 8/8 returned HTTP 307 to the matching `/admin/login?next=...` route.
- Authenticated admin preview: 8/8 available.
- Robots metadata: `noindex, nofollow, nocache` plus Googlebot `noindex, nofollow, noimageindex`.
- Canonical elements: 0 on every sampled preview.
- JSON-LD scripts: 0 on every sampled preview.
- Draft status was not changed for QA.

### Table QA

Remote stored HTML assertions:

- Table-bearing articles: 40/40 detected.
- Missing `<th>` markup: 0.
- Missing `<td>` markup: 0.
- Raw pipe-table residue: 0.

The Article Detail runtime adds the approved `.article-table-scroll` wrapper without changing stored body fidelity. Six table-bearing representative previews were checked at both 1440px and 390px: BTC-008, BTC-042, BTC-035, BTC-021, BTC-011, and BTC-043.

- Rendered tables correctly wrapped: all sampled tables.
- Unwrapped rendered tables: 0.
- Local table horizontal scrolling: available at 390px.
- Document-level horizontal overflow: 0.

### Source Notes QA

- Remote articles containing public Source Notes: 44/44.
- Remote Source Notes/editorial leakage scan: 0 hits.
- The eight representative previews displayed Source Notes without internal filenames, Research Tier, Content ID, preparation paths, or Windows paths.

### Post-Import Collision Safety

The same 44-article remote dry-run was repeated without `--execute`. It failed closed at the first existing canonical production slug:

`Article slug already exists in D1: verify-accessible-family-accommodation`

Expected exit status: 1. Remote D1 remained at 50 articles. No duplicate create, upsert, overwrite, or second write occurred.

### Placeholder Preservation

The following six slugs remain present and unchanged with `status=draft`:

- `placeholder-budget-tips-article`
- `placeholder-flights-stays-article`
- `placeholder-inspiration-article`
- `placeholder-packing-gear-article`
- `placeholder-travel-styles-article`
- `placeholder-trip-planning-article`

### Remote D1 Protection

Remote Production D1 is now protected by the **NO DESTRUCTIVE SEED** rule. `data/d1-seed.sql`, reset, reseed, baseline deletion, and destructive initialization must not be run against `budget-travel-compass --remote`. Future changes require migration, controlled CRUD, or an explicitly approved importer operation.

### R2 State

- Bucket: `budget-travel-compass-media`
- Object count: 0
- Bucket size: 0 B
- `media_assets` rows: 0
- No cover URL, media row, or R2 object was created.

### Worker / Deployment Regression

The D1 import did not change website code or trigger a Worker deployment.

- Existing active deployment: `c967ee13-17c3-4599-8462-ddef93e44fd7`
- Existing active Worker version: `46cb9b0b-e99d-4f90-aa29-9ba56a8eaa86`
- Traffic: 100%
- D1 binding: `DB` → `28e229c2-c032-4c09-9490-630c1b88df50`
- R2 binding: `MEDIA_BUCKET` → `budget-travel-compass-media`

The report-only push under `docs/release/*` was verified against the Native Workers Builds exclusion:

- New Worker build: 0
- New Worker version: 0
- New deployment: 0
- Active version remained `46cb9b0b-e99d-4f90-aa29-9ba56a8eaa86`.

### Git State

Before this report, the working tree was clean and local `main` matched `origin/main` at `72d9675b93eea371d3e3c3fd9f8b1a2144ff465f`. The ignored `content/import/` artifacts were not force-added. This report is the only Phase 10 tracked change and is committed with subject `docs: record remote draft import validation`.

### Remaining Issues

- Six Draft placeholders remain intentionally preserved for Phase 10.1.
- Planned Internal Links Pass 2 has not started.
- All 44 production articles remain Drafts and require a separately authorized publication phase.
- Production media remains empty by design.

## Final Decision

**REMOTE 44-ARTICLE DRAFT IMPORT PASSED**

Next phase permitted: **PHASE 10.1 — PRODUCTION CMS CLEANUP & INTERNAL LINK PASS 2**

**NOT READY FOR PUBLICATION**

Phase 10 stops here.

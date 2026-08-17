# Budget Travel Compass — Phase 12C Production 1102 Runtime Incident Fix Design

Date: 2026-08-17

Status: APPROVED DESIGN — PENDING IMPLEMENTATION PLAN

## 1. Objective

Restore the production public site after all 44 articles were published and public HTML routes began failing with Cloudflare error 1102. The fix must remove the confirmed Worker CPU hot path without changing production content, publication state, the D1 schema, CMS behavior, media, analytics, or unrelated Framework surfaces.

Success requires:

- Homepage: HTTP 200
- 44 canonical article routes: 44/44 HTTP 200
- Six category routes: 6/6 HTTP 200
- At least three representative searches: HTTP 200
- Sitemap: HTTP 200 with 44 article URLs
- Admin login remains available
- No production 1102 responses in the smoke matrix
- D1 remains 44 Published, 0 Draft, 0 placeholders, 0 media
- The 43 clean article body hashes remain equal to the Phase 10.1 baseline
- BTC-014 remains the single known deferred body drift and is not modified

## 2. Confirmed Root Cause

Production `wrangler tail` captured all four representative failures with:

- `cpuTime = 10`
- `outcome = exceededCpu`
- exception: `Worker exceeded CPU time limit.`
- response status: `503`

The failing routes were:

- `/`
- `/news/travel-daypack-setup`
- `/category/trip-planning`
- `/search?q=travel`

The public repository functions currently call a shared `getSnapshot()` implementation. In D1 production mode, every snapshot executes `SELECT * FROM articles` and therefore returns every `body_html`, then also reads categories, tags, article-tag relations, and homepage blocks.

The current production corpus contains:

- 44 Published articles
- 293,862 aggregate `body_html` characters
- approximately 10,218 characters in the equivalent lightweight list projection

After publication, public rendering now maps, sorts, filters, and renders the Published records. Metadata generation, page rendering, related-content selection, Sidebar, and Footer can trigger separate snapshots within the same route render. Category and Search requests therefore materialize the full corpus repeatedly. This pushes the Worker over its 10 ms CPU budget.

The working sitemap path confirms the diagnosis: it uses direct D1 projections for only slug and timestamp fields and does not materialize article bodies.

The Phase 11A publication-aware link resolver is not the primary cause. It extracts unique targets from the current article only, performs one lightweight published-slug query, and transforms the current body. The existing publication-aware link regression passes.

## 3. Chosen Approach

Implement a lightweight public snapshot while preserving the existing full administrative snapshot.

### 3.1 Public list projection

Add a D1 public-article query with an explicit projection containing only fields required by cards, lists, search, sorting, related-content selection, and SEO summaries:

- id
- title
- slug
- summary
- cover URL
- category ID
- status
- featured and pinned flags
- sort order
- view count
- published and updated timestamps
- SEO title and description
- a compact reading-time scalar

The public list projection must not return `body_html`.

Reading time will be represented as a compact scalar calculated by D1 from stored content length/word-separator count. It is display metadata only. Article detail continues to calculate its exact reading time from the single loaded body.

### 3.2 Full administrative snapshot

The existing full D1 article loader remains available for Admin/CMS operations that legitimately need `body_html`. The incident fix must not change article creation, editing, import, status transitions, schema, or stored content.

### 3.3 Article detail query

`getArticleBySlug()` will use a published-slug guard and load full `body_html` for only the requested article. Category/tag enrichment may use the lightweight public snapshot. It must never load the other 43 bodies.

Related articles use lightweight records only.

### 3.4 Public snapshot consumers

The following public functions must use the lightweight snapshot or an equally bounded direct projection:

- Homepage/latest article lists
- Published article listings and pagination
- Category and tag listings
- Search
- Related articles
- Featured, heat, and editor-pick lists
- Public category/tag lookups
- Footer category navigation
- Sidebar tags and recommendations

Admin functions continue to use the full snapshot.

### 3.5 Search

Search remains the existing title/summary/category/tag search contract. It must operate on lightweight fields only and must not parse or normalize `body_html`. No FTS schema, search engine, or new indexing architecture is introduced.

### 3.6 Publication-aware links and HTML normalization

The resolver remains:

`extract unique targets from current body → one published-slug lookup → transform current body once`

No per-anchor query, target-body load, recursive article rendering, or full-corpus body lookup is allowed.

The current two parser passes are retained unless the bounded repository fix still reproduces the CPU incident. Avoiding an unnecessary parser refactor keeps the incident change minimal.

## 4. Request Data Flow

### Homepage

`request → lightweight Published list with limit → homepage story mapping → Footer lightweight categories`

No article body is returned to the Worker.

### Category and Search

`request → lightweight snapshot/query → filtering/pagination → cards → lightweight Sidebar/Footer`

No article body is returned or parsed.

### Article detail

`request → one Published article detail row → lightweight related candidates → one published-target lookup → current-body normalization/render`

Only the requested article body is processed.

### Sitemap

The existing lightweight sitemap route remains unchanged.

## 5. Error and Fallback Behavior

- Production D1 absence continues to follow the current fail-closed content-runtime decision.
- Local development and fixtures continue to use local/seed article data.
- Missing category enrichment remains an explicit error rather than fabricating a category.
- Publication-aware link lookup retains its fail-safe plain-text fallback.
- No cache layer, background queue, public diagnostic endpoint, or remote SQL endpoint is introduced.

## 6. Regression Design

Add a focused runtime-query regression that verifies a 44-Published fixture and 129 internal-link corpus against these contracts:

1. Public list SQL does not select or return `body_html`.
2. Homepage list work is bounded by its requested limit and lightweight fields.
3. Category and Search paths use lightweight records.
4. Article detail fetches one full body by exact slug and Published status.
5. Related-content selection never loads full bodies.
6. Publication-aware target lookup runs once for unique targets, not once per anchor.
7. No recursive article rendering occurs.
8. Admin full-body loading remains intact.
9. Public output types still provide reading-time display metadata.

Existing required validation remains:

- `npm run typecheck`
- `npm run test:p0`
- `npm run test:sitemap`
- `npm run test:publication-aware-links`
- the new runtime-query regression
- `npm run build`
- `npm run deploy:build`

## 7. Deployment and Production Validation

After local validation:

1. Commit the targeted runtime fix and regression.
2. Push `main`.
3. Allow Cloudflare Native Workers Builds to build and deploy; do not run manual `wrangler deploy`.
4. Confirm the existing Worker is updated and no second Worker or Pages project appears.
5. Run the fast production smoke matrix from the approved Phase 12C specification.
6. Re-read D1 counts and body hashes to prove that deployment caused no content mutation.
7. Generate `docs/release/BUDGET_TRAVEL_COMPASS_1102_RUNTIME_INCIDENT_REPORT.md`.

## 8. Explicit Non-Goals

This phase does not:

- review or rewrite articles
- run Freshness, Corpus, Editorial, Research, or Import gates
- repair BTC-014 body drift
- repair the CMS rich-editor Publish architecture
- change the D1 schema
- change publication status or metadata
- perform Time Travel or seed operations
- upload R2 media
- configure GA or Ads
- redesign the site
- introduce FTS, a new search engine, or a new cache architecture
- upgrade ContentForge or the Framework

## 9. Stop Conditions

Stop and report the incident as unresolved if:

- the bounded repository path still produces 1102 or 500/503 responses;
- public article routes fail at scale;
- the production D1 state or body hashes change;
- the fix requires a schema change, content rewrite, manual Worker deployment, or a broader Framework redesign.

Minor styling warnings, absent covers, and the known BTC-014 body drift do not block this incident fix.

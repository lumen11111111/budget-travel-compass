# Budget Travel Compass — Controlled Draft Import Report

Date: 2026-08-17  
Phase: 7B — Draft Content Cleanup + Protected Preview  
Result: **CONTROLLED DRAFT IMPORT BLOCKED**

Phase 7C addendum: **CONTROLLED DRAFT IMPORT PASSED**. The Phase 7B result above is retained as the historical gate result before the final Source Notes cleanup.

## Phase 7A Baseline Dependency

Phase 7 resumed only after the separately approved Phase 7A local baseline was present in Wrangler local D1 `example-site-db --local`. The destructive baseline seed was not rerun.

The read-only pre-import assertion passed:

| State | Expected | Actual |
|---|---:|---:|
| Categories | 6 | 6 |
| Articles | 6 | 6 |
| Published | 0 | 0 |
| Draft placeholders | 6 | 6 |
| Production Drafts | 0 | 0 |

All five authorized Production slugs were absent before the write.

## Controlled Execute

The existing ContentForge importer was executed once against the Wrangler local D1 target, without `--remote`, with this exact five-slug allowlist:

| Content ID | Slug | Category | Result |
|---|---|---|---|
| BTC-013 | `find-cheaper-flights-flexible-dates` | `flights-stays` | CREATED as Draft |
| BTC-035 | `weekend-trip-budget` | `budget-tips` | CREATED as Draft |
| BTC-022 | `carry-on-capsule-wardrobe` | `packing-gear` | CREATED as Draft |
| BTC-017 | `grocery-store-tourism-guide` | `inspiration` | CREATED as Draft |
| BTC-042 | `plan-first-solo-female-trip` | `travel-styles` | CREATED as Draft |

Importer execution result:

- D1 validation: PASS;
- article records created: 5;
- non-Draft records created: 0;
- R2/media objects created: 0;
- remaining 39 articles imported: 0;
- importer job ID: `20260814104529-find-cheaper-flights-flexible-dates`.

No upsert, overwrite, publish, delete, re-seed, remote write, media generation, or Internal Link Pass 2 was performed.

## Post-Import D1 State

The final read-only D1 assertion returned:

| State | Expected | Actual |
|---|---:|---:|
| Categories | 6 | 6 |
| Articles | 11 | 11 |
| Total Drafts | 11 | 11 |
| Draft placeholders | 6 | 6 |
| Production Drafts | 5 | 5 |
| Published | 0 | 0 |
| Tags | baseline unchanged | 6 |
| Article-tag relations | baseline unchanged | 12 |
| Media assets | 0 | 0 |

All five Production rows remain `status=draft`.

## Field Fidelity

Each real D1 row was compared with `content/import/budget-travel-compass/normalized-import-records.json` across:

- title;
- slug;
- category slug;
- SEO title;
- SEO description;
- summary;
- body HTML;
- status.

Result: **5/5 exact authority mapping; 0 field mismatches**. The importer did not rewrite slugs or titles, change categories, truncate summaries, drop SEO metadata, or change Draft status.

## Body Fidelity

The five stored `body_html` values exactly match the deterministic Phase 6 normalized records.

| Check | Result |
|---|---|
| Duplicate leading H1 | 0 |
| Missing H2 | 0 |
| Raw YAML | 0 |
| Raw Markdown strong residue | 0 |
| Raw Markdown emphasis residue | 0 |
| Raw pipe-table residue | 0 |
| Encoding replacement characters | 0 |
| Planned internal links | 0 |
| Source Notes heading present | 5/5 |

H2/H3, lists, semantic tables, blockquotes, strong, emphasis, and the approved converted body structure were preserved. Source Notes have a separate blocking content issue described below.

## Application-Level Draft Read

The existing OpenNext runtime was started against Wrangler local D1. Runtime logs identified the `DB` binding as local `example-site-db`. The repository successfully loaded the D1 snapshot containing all 11 records and served the homepage, search, sitemap, and all five category routes without database or schema errors.

The application-level public article resolver filters to `published` before slug resolution. This correctly prevents the five Draft rows from resolving as public articles. The protected admin article route redirected unauthenticated access rather than exposing Draft content.

Result: **application/runtime store alignment confirmed** for status, category, metadata, and stored body retrieval; public presentation remains status-filtered.

## Draft Preview Capability

The Phase 7 preview capability gap is closed.

Phase 7B adds `/admin/articles/[id]/preview`. It runs the existing `requireAdmin` guard before its Draft lookup, uses an admin-only Draft repository method, and reuses the same Article Detail renderer as `/news/[slug]`.

The previous unauthenticated hard-coded development preview was removed. Public `/news/[slug]` resolution remains published-only. Preview responses are `noindex,nofollow,nocache`, emit no JSON-LD, and explicitly clear inherited canonical metadata.

No Production Draft was changed to Published.

## Public Isolation

The local OpenNext runtime returned:

- homepage: 200, with no pilot title, slug, or article link;
- five category pages: 200, with no Production Draft discovery;
- sitemap: 200, with zero pilot article URLs;
- search: 200, with no pilot result title or `/news/<slug>` result link;
- feed and RSS routes: 404 because this project exposes neither route;
- public Published Articles: 0.

The search page displayed the literal query value `weekend-trip-budget` in its search input. A focused check confirmed that this was query echo only: it did not contain the pilot title or a pilot article result link.

Result: **no public Draft discovery leakage detected**.

## Direct Route Isolation

Direct requests to all five `/news/<slug>` routes returned 404. Draft records are therefore not publicly reachable merely by knowing a slug.

Result: **PASS**.

## Sitemap / Search / Category Isolation

| Surface | Result |
|---|---|
| Sitemap | PASS — 0 pilot URLs |
| Public search | PASS — no title or article-result link |
| Category pages | PASS — all five routes 200, no Draft discovery |
| Homepage/latest/public discovery | PASS — no pilot records |
| RSS/feed | N/A — routes return 404 |

No indexable public Draft route or public metadata discovery was observed.

## Table QA

Stored HTML semantic checks passed for the two required articles:

- BTC-035 `weekend-trip-budget`: 2 `<table>` elements and 9 `<th>` cells;
- BTC-022 `carry-on-capsule-wardrobe`: 2 `<table>` elements and 12 `<th>` cells.

Neither body contains raw pipe-table residue or missing converted table markup.

Visual 390px/1440px table rendering QA passed. Tables use a local horizontal-scroll region on narrow screens; the document itself has no horizontal overflow. Desktop headers, cells, hierarchy, and spacing remain clear.

## Source Notes QA

Phase 7B corrected the authoritative BTC-013 and BTC-042 Source Notes and patched only their matching local Draft `body_html`. Both now contain public-safe source organizations and context without internal filenames.

Authenticated rendering of all five controlled Drafts then revealed two additional pre-existing Source Notes leaks outside the Phase 7B cleanup allowlist:

- BTC-022 `carry-on-capsule-wardrobe` includes `CLAIM_SOURCE_LEDGER.md`;
- BTC-035 `weekend-trip-budget` includes `CLAIM_SOURCE_LEDGER.md`.

The approved Phase 7B scope explicitly limited authoritative content cleanup to BTC-013 and BTC-042. BTC-022 and BTC-035 were therefore not modified. Their newly observed public-facing editorial references remain a blocking content-authority issue.

## Create-Only Collision QA

After the five CREATE operations, the identical five-slug allowlist was run again in **dry-run only** mode.

The importer stopped during D1 validation with:

`Article slug already exists in D1: find-cheaper-flights-flexible-dates`

Exit code: 1. No second execute occurred and no duplicate record was written.

Result: **PASS — CREATE-only duplicate protection confirmed fail-closed**.

## Placeholder Preservation

All six baseline placeholder records remain present, remain Draft, and retain their original slug/category mapping:

- `placeholder-inspiration-article`;
- `placeholder-trip-planning-article`;
- `placeholder-flights-stays-article`;
- `placeholder-budget-tips-article`;
- `placeholder-packing-gear-article`;
- `placeholder-travel-styles-article`.

Baseline Tags and article-tag relations remain unchanged. No placeholder cleanup was performed.

## Validation

| Validation | Result |
|---|---|
| Pre-import D1 assertion | PASS |
| Controlled local CREATE | PASS — 5 Drafts |
| Field fidelity | PASS — 5/5 exact, 0 mismatches |
| Body conversion/fidelity | PASS — 0 structural/residue issues |
| Application-level D1 read | PASS |
| Public isolation | PASS |
| Direct route isolation | PASS — 5/5 return 404 |
| Sitemap/search/category isolation | PASS |
| Create-only collision dry-run | PASS — rejected, exit 1 |
| Placeholder preservation | PASS — 6/6 |
| Table semantic HTML | PASS |
| Protected Draft Preview | PASS — authenticated 200, unauthenticated 307 |
| Preview SEO isolation | PASS — noindex, no canonical, no JSON-LD |
| Table visual rendering | PASS — 390px and 1440px |
| BTC-013 / BTC-042 Source Notes cleanup | PASS |
| Five-Draft Source Notes editorial-data isolation | FAIL — BTC-022 and BTC-035 |
| `npm run typecheck` | PASS |
| `npm run test:p0` | PASS — 0 fail, 0 error |
| `npm run build` | PASS |
| OpenNext Cloudflare build | PASS |

All temporary QA listeners, including port 3020, were stopped after testing.

## CMS Final State

| State | Count |
|---|---:|
| Published | 0 |
| Draft placeholders | 6 |
| Production Drafts | 5 |
| Total Drafts | 11 |
| Production media | 0 |

The five controlled records intentionally remain Draft in local D1. They were not rolled back or deleted because Phase 7 authorized CREATE only and did not authorize cleanup writes.

## Phase 7B Source Notes Cleanup

Only these authoritative sources were edited:

- `content-preparation/research/BTC-013/ARTICLE_DRAFT.md`;
- `content-preparation/research/BTC-042/ARTICLE_DRAFT.md`.

For each article, the sole content change was removal of the sentence fragment that directed readers to `CLAIM_SOURCE_LEDGER.md`. Factual claims, title, slug, category, SEO metadata, summary, scope, and search intent were unchanged. Public-safe source organizations, source context, and the 2026-08-14 verification date remain.

No importer filter or generic string-removal behavior was added.

## Corrected Artifact Determinism

The existing preparation adapter received a strict `--allowlist=` mode so Phase 7B could regenerate only BTC-013 and BTC-042 without rewriting the other 42 `article.md` files or the Draft Import Manifest.

Two consecutive targeted runs returned the same artifact hash:

`59e93fc3513c11abe93a9a5291504590dc92b961d05798438f9caf3e5fb5ab26`

Normalized-record file hash:

`6b9fb1de8876d8067282cc4b7eff3a31177910648a089737186f8e3ebdcd475f`

Verification:

- unchanged non-target `article.md` files: 42/42;
- unchanged non-target normalized records: 42/42;
- changed normalized records: BTC-013 and BTC-042 only;
- metadata/slug/category/status authority: PASS;
- editorial-only leakage in the two corrected bodies: 0.

## Controlled Local D1 Body Patch

Before the patch, the stored and corrected hashes were:

| Content ID | Old local D1 body SHA-256 | Corrected artifact body SHA-256 |
|---|---|---|
| BTC-013 | `26fe6383ab9973c05cea5878630bb99b24b22a68497edc59bbe8f5a33154fbcd` | `6bdaa03c4a047a22899ce49234e77c84f082f6bfc40a210c7a6df41d756d6ba1` |
| BTC-042 | `9fae54b192b14c9e11449e1c0daac70780eedd6adbadcbc31d1876cdbcf4d882` | `705d13e4d3db871efe775e45e0a14e0e39390ada2a800072a58dbd7cae39a256` |

For both records, a prefix/suffix comparison proved that the only removed text was the `CLAIM_SOURCE_LEDGER.md` reader-facing reference.

`scripts/phase7b-patch-local-d1.ts` performed one guarded local-only SQL UPDATE. Its allowlist contains exactly the two approved slugs; both rows had to match Draft status, ID, slug, metadata authority, and the complete old body before either body could change. The final stored bodies match their corrected normalized artifact exactly, 2/2.

No title, slug, category, summary, SEO field, status, tag, media, or other article was modified.

## Draft Preview Architecture

- Route: `/admin/articles/[id]/preview`.
- Authentication: existing `requireAdmin` signed-session guard.
- Data access: `getAdminDraftArticleById`, which resolves `status=draft` only.
- Rendering: shared `ArticleDetail` component used by both public articles and Admin Preview.
- Public resolver: unchanged `getArticleBySlug`, still published-only.
- Discovery: no preview navigation outside the authenticated Admin article list.
- SEO: noindex, nofollow, nocache, no canonical, no JSON-LD.
- Scope: supports every CMS Draft rather than a hard-coded pilot slug list.

## Preview Authentication

For preview IDs 7 through 11:

- unauthenticated request: 307 to `/admin/login?next=...` for 5/5;
- authenticated Admin session: 200 and the correct Draft H1/body for 5/5.

Authentication was never disabled for screenshots or QA.

## 390px Rendering QA

All five authenticated Draft Previews were checked at 390px:

- Header, search, breadcrumb, category, title, excerpt, body, headings, lists, blockquotes, strong/emphasis, Source Notes, and Footer rendered;
- document-level horizontal overflow: 0/5;
- table wrapper parity: PASS for every article table;
- browser console errors: 0;
- robots: `noindex, nofollow, nocache` for 5/5;
- canonical and JSON-LD: absent for 5/5.

## 1440px Rendering QA

All five authenticated Draft Previews were checked at 1440px:

- shared Article Detail layout and typography rendered consistently;
- document-level horizontal overflow: 0/5;
- table hierarchy, headers, cells, spacing, headings, Source Notes, and Footer were readable;
- browser console errors: 0;
- robots/canonical/JSON-LD isolation: PASS for 5/5.

## Table Rendering QA

BTC-022 and BTC-035 each render two semantic tables. At 390px, each table scrolls inside its own keyboard-focusable region and does not widen the page. At 1440px, the tables fit the reading column with clear header contrast and cell borders.

Evidence:

- `docs/qa/phase-7b/btc-022-table-390.png`;
- `docs/qa/phase-7b/btc-035-table-390.png`;
- `docs/qa/phase-7b/btc-022-table-1440.png`;
- `docs/qa/phase-7b/btc-035-table-1440.png`.

## Source Notes Rendering QA

BTC-013 and BTC-042 render public-safe Source Notes at 390px and 1440px. Their rendered article bodies contain zero matches for `CLAIM_SOURCE_LEDGER.md`, `RESEARCH_NOTES.md`, `EDITORIAL_QA.md`, Freshness Register, Research Tier, or Content ID.

Evidence:

- `docs/qa/phase-7b/btc-013-source-notes-390.png`;
- `docs/qa/phase-7b/btc-042-source-notes-390.png`.

Full five-Draft rendering revealed the separate BTC-022/BTC-035 leakage described above; this prevents a passing corpus gate.

## Public Isolation Regression

After protected Preview implementation:

- homepage: 200, Draft links 0;
- five category routes: 200, Draft links 0;
- public search: 200, Draft links 0;
- sitemap: 200, Draft links 0;
- five direct `/news/<draft-slug>` routes: 404;
- former `?phase42Preview=1` public development route: 404;
- unauthenticated Admin Preview: redirected to login.

Public Published Articles remain 0.

## Typecheck / Build

- `npm run test:p0`: PASS — 0 fail, 0 error;
- `npm run typecheck`: PASS;
- `npm run build`: PASS;
- `npx opennextjs-cloudflare build`: PASS.

No remote D1, R2, Cloudflare deployment, GitHub, GA, Ads, publication, re-seed, full import, or Internal Link Pass 2 operation was performed.

## Final Decision

**CONTROLLED DRAFT IMPORT BLOCKED**

Blocking gates:

1. BTC-022 and BTC-035 Source Notes expose `CLAIM_SOURCE_LEDGER.md` in the authenticated shared Article Detail renderer.
2. These two articles were outside the Phase 7B authoritative-content cleanup allowlist, so the issue was reported rather than fixed by expanding scope.

**5 CONTROLLED DRAFTS IMPORTED TO LOCAL D1**  
**PROTECTED DRAFT PREVIEW IMPLEMENTED**  
**0 PUBLISHED**  
**REMAINING 39 ARTICLES NOT IMPORTED**  
**NOT READY FOR FULL DRAFT IMPORT**  
**NOT READY FOR PUBLICATION**

---

## Phase 7C — Final Source Notes Cleanup

Date: 2026-08-17  
Result: **CONTROLLED DRAFT IMPORT PASSED**

### Phase 7C BTC-022 Cleanup

Only `content-preparation/research/BTC-022/ARTICLE_DRAFT.md` was changed at the authoritative-content layer. The final sentence fragment `See CLAIM_SOURCE_LEDGER.md.` was removed from Source Notes. The public-safe verification date, U.S. National Weather Service context, Google Travel context, carrier-direct verification caution, factual claims, article structure, frontmatter, title, slug, category, summary, and SEO metadata remain unchanged.

Removal-only reconstruction reproduced the exact pre-cleanup file hash. Corrected authoritative Draft SHA-256:

`3510311c3a0849e76af89e81eadada46772bf733669fa81106583ad5675d0ae6`

### Phase 7C BTC-035 Cleanup

Only `content-preparation/research/BTC-035/ARTICLE_DRAFT.md` was changed at the authoritative-content layer. The final sentence fragment `See CLAIM_SOURCE_LEDGER.md for scope and verification notes.` was removed from Source Notes. The public-safe verification date and Consumer.gov, Consumer Financial Protection Bureau, and U.S. Department of Transportation context remain. Factual claims, article structure, frontmatter, title, slug, category, summary, and SEO metadata remain unchanged.

Removal-only reconstruction reproduced the exact pre-cleanup file hash. Corrected authoritative Draft SHA-256:

`52c6e3a58b4404e9f0e0dbfe4409198b1bcc4121f0a8ff980916411a233a184b`

### Determinism

The existing allowlist-capable preparation adapter was run twice with exactly `BTC-022,BTC-035`. Both runs returned the same full artifact hash:

`30e2a02bf4348f3e94191b82e97ba23c59edf11a3a9563d07a54e811e1939036`

Normalized-record file SHA-256 after both runs:

`99ebe8717a10f5e7e160d5461e79985f1741e8504c790e3e266ff22bdc3f7e70`

Verification:

- non-target `article.md` hashes unchanged: 42/42;
- changed artifacts: BTC-022 and BTC-035 only;
- BTC-022 metadata hash unchanged: `264a67e28b339f66359eb62263ec7d60ae3baa00a2db02c7fdf2259a381cc58c`;
- BTC-035 metadata hash unchanged: `50c014861f7eea324f3f47215af3319b34b63b1479179881c9f17631a33f5ae5`;
- slugs unchanged: `carry-on-capsule-wardrobe`, `weekend-trip-budget`;
- categories unchanged: `packing-gear`, `budget-tips`;
- status unchanged: `draft` for 2/2;
- substantive body change: the two approved Source Notes filename-reference removals only.

### Local D1 Body Patch

One guarded local-only patch updated exactly the two allowed Draft rows. It did not delete, recreate, import, seed, publish, or access remote D1. The update required exact IDs, exact slugs, Draft status, and complete old-body matches before either row could change.

| Slug | Before body SHA-256 | Corrected/stored body SHA-256 | Artifact match |
|---|---|---|---|
| `carry-on-capsule-wardrobe` | `a5c7db23abf4d6eb7709991cbe537265b3103554c8ef840604c5670da9774d98` | `3f726c1350f049282d93af037cbad6450e1b4bdc74055ae820f7b785d831e718` | PASS |
| `weekend-trip-budget` | `106cb0671a3d9f25359355fcb12de54a1d1f1966f13560f073b18c84834a9dfb` | `c25ec454bba482f8227c0c9bb764194687754107e9d922d74d1d3810271f3e55` | PASS |

Immutable-row hashes remained unchanged:

- BTC-022: `557527f9ade507d5697924f1a22bcbc0c80b130571a896531dbd330ab3110fcc`;
- BTC-035: `e0e84b2cf5000c65b8d5af6fb7338cc953d107425096c4938969958e78261c87`.

Title, slug, category, summary, SEO fields, status, tags, media, timestamps, flags, sort order, and related-work fields were not modified. Stored `body_html` equals the corrected normalized artifact for 2/2.

### Five-Draft Editorial Leakage Scan

The stored and authenticated rendered bodies for BTC-013, BTC-017, BTC-022, BTC-035, and BTC-042 were scanned for:

- `CLAIM_SOURCE_LEDGER.md`;
- `RESEARCH_NOTES.md`;
- `EDITORIAL_QA.md`;
- `Freshness Register`;
- `Research Tier`;
- `Content ID`;
- `content-preparation/`;
- local `E:\` paths.

Result: **0 matches across 5/5 Production Draft rendered bodies**.

### Preview Recheck

Authenticated Preview QA was repeated for BTC-022 and BTC-035 at 390px and 1440px.

| Check | BTC-022 | BTC-035 |
|---|---|---|
| Source Notes public-safe | PASS | PASS |
| Tables | 2 semantic tables | 2 semantic tables |
| 390px table behavior | local horizontal scroll | local horizontal scroll |
| 1440px table behavior | fits reading column | fits reading column |
| 390px typography | H1 38px; body 17px | H1 38px; body 17px |
| 1440px typography | H1 72px; body 17.28px | H1 72px; body 17.28px |
| Document overflow | 0 | 0 |

All five authenticated Draft Previews retain `noindex,nofollow,nocache`, no canonical, no JSON-LD, and zero document-level horizontal overflow. Unauthenticated access to preview IDs 7–11 remains a 307 redirect to Admin login.

### Public Isolation Regression

- Homepage: 200, zero Production Draft titles or `/news/<draft-slug>` links;
- six category routes: 200, zero Production Draft titles or links;
- public search: 200, zero Production Draft result titles or links;
- sitemap: 200, zero Production Draft URLs;
- all five direct `/news/<draft-slug>` routes: 404;
- search query echo for `weekend-trip-budget` remains input echo only and is not an article result;
- public Published Articles: 0.

Result: **PASS — zero public Draft exposure**.

### CMS Final State

| State | Count |
|---|---:|
| Categories | 6 |
| Draft placeholders | 6 |
| Production Drafts | 5 |
| Total Drafts | 11 |
| Published | 0 |
| Production media | 0 |
| Tags | 6, baseline unchanged |
| Article-tag relations | 12, baseline unchanged |

Validation:

- `npm run typecheck`: PASS;
- runtime code changes: 0;
- rebuild: not required by the approved Phase 7C contract;
- remaining 39 articles imported: 0;
- Internal Link Pass 2: not run;
- Publish/Seed/remote D1/R2/Cloudflare/GitHub/GA/Ads operations: 0.

## Phase 7C Final Decision

**CONTROLLED DRAFT IMPORT PASSED**

**CMS: 6 DRAFT PLACEHOLDERS, 5 PRODUCTION DRAFTS, 0 PUBLISHED**

The controlled five-Draft gate now permits a separately authorized **FULL DRAFT IMPORT** phase. No Full Draft Import or publication was performed in Phase 7C.

# Budget Travel Compass — Publication-Safe Link Report

Date: 2026-08-17

Phase: 11A — Publication-Status-Aware Internal Link Rendering

Production domain: `https://budgettravelcompass.com`

## Executive Result

The public article renderer now preserves the approved stored internal-link graph while emitting clickable `/news/<canonical-slug>` links only when the target article is published. Draft, missing, invalid, or unresolved targets are rendered as plain anchor contents. The authenticated Draft Preview continues to show the complete editorial links.

No article was published, no Remote D1 row was written, no stored `body_html` changed, and no R2 object was created.

### Previous Blocker

`PUB-LINK-001` blocked partial publication because all 129 approved article links were stored as live `/news/<slug>` anchors even while their targets were Drafts. Publishing any subset would therefore have exposed clickable links to public 404 routes.

### Architecture

- Stored Remote D1 `body_html` remains the complete editorial graph authority.
- The public-only transformation runs after the existing article HTML normalization step.
- The transformation parses HTML into a DOM, examines only exact `/news/<canonical-slug>` anchors, and unwraps anchors whose targets are not known to be published.
- The authenticated Admin Draft Preview does not enable the transformation.
- No Markdown converter, CMS schema field, publication copy, or alternate body was introduced.
- `htmlparser2` and `dom-serializer` provide the parser/DOM transformation pipeline; the rewrite is not regex-only.

### Public Link Transformation

For an exact same-site article link:

- published target: the `<a href="/news/<slug>">...</a>` remains clickable;
- Draft or missing target: the `<a>` is removed and its child nodes remain in place;
- surrounding punctuation, spacing, `<strong>`, and `<em>` descendants are preserved;
- external links, Source Notes links, `mailto:`, categories, legal pages, and other internal routes remain unchanged.

No disabled link, `href="#"`, `javascript:` URL, Draft badge, placeholder, or “Coming soon” output is generated.

### Repository Lookup

`listPublishedArticleSlugs()` accepts the unique target slug set and performs one bounded D1 query:

```sql
SELECT slug
FROM articles
WHERE slug IN (...)
  AND lower(status) = 'published'
```

The lookup reads only publication existence/slug data. It does not read target `body_html`, metadata, or full article records. Duplicate anchors to the same target contribute one resolver input slug.

### Fail-Closed Behavior

Missing and Draft targets are absent from the returned published-slug set and therefore become plain text. A target-status query failure is caught at the public rendering boundary and uses an empty published set, so every recognized article anchor is safely unwrapped. Uncertainty never leaves a clickable public link.

### Admin Preview Preservation

Authenticated Production Preview for article ID 7 (`verify-accessible-family-accommodation`) passed:

- authentication retained;
- title: `Draft Preview | Budget Travel Compass`;
- `robots`: `noindex, nofollow, nocache`;
- Googlebot: `noindex, nofollow, noimageindex`;
- canonical link: absent;
- Article JSON-LD: absent;
- approved internal links visible: 3/3;
- tables present: 1;
- Source Notes present: yes;
- editorial-only leakage: 0.

The preview call site does not enable publication-aware filtering, so the same rule preserves the complete 129-link editorial graph across all Draft previews.

### Regression Tests

The new `npm run test:publication-aware-links` suite covers:

1. published target remains linked;
2. Draft target becomes plain text;
3. missing target becomes plain text;
4. external links remain unchanged;
5. Source Notes/external-link behavior remains unchanged;
6. mixed published/Draft links render independently;
7. duplicate targets use one unique batch resolution;
8. nested strong/emphasis markup survives anchor removal;
9. lookup failure fails closed;
10. provisional Wave 1 and all-44-published graph simulations;
11. public-page enablement, preview opt-out, batch-query shape, and cache invalidation integration.

Result: **PASS — 0 fail, 0 error**.

### Wave 1 Simulation

Provisional published set:

- BTC-020 `slow-travel-short-break`
- BTC-028 `plan-group-trip`
- BTC-014 `nearby-airport-total-cost-test`
- BTC-032 `pre-trip-spending-swap-list`
- BTC-021 `travel-daypack-setup`
- BTC-044 `solo-dining-while-traveling`

The full 129-edge graph was rendered against exactly those six published target slugs:

- anchors whose targets are in the six-slug set: clickable;
- anchors whose targets are among the other 38 Drafts: plain text;
- clickable hrefs to Draft targets: 0.

The six Wave 1 source articles have 16 approved outgoing edges. None targets another Wave 1 article, so their public simulation produces 0 clickable internal anchors and 16 plain-text handoffs, with 0 broken public Draft hrefs. This is safe and requires no stored-body rewrite.

### 44-Published Simulation

With all 44 canonical slugs simulated as published:

- approved edges processed: 129;
- clickable approved links: 129;
- ordered target equality: 129/129;
- body edits required for later wave expansion: 0.

### Performance

- Target extraction deduplicates slugs before repository access.
- Each public article request performs at most one target-status query, regardless of the number of anchors.
- The query is bounded by the current article's unique outgoing target count.
- No per-anchor D1 query or N+1 path exists.

### Cache Behavior

`/news/[slug]` remains dynamically server-rendered. The existing article mutation invalidation was minimally extended with:

```ts
revalidatePath("/news/[slug]", "page")
```

When a target changes from Draft to Published through the existing Admin flow, cached source article pages are invalidated and their plain-text handoffs can become clickable on subsequent rendering. No new cache subsystem was added.

### Build

All required local gates passed:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test:p0` | PASS — 0 fail, 0 error |
| `npm run test:sitemap` | PASS — 0 fail, 0 error |
| `npm run test:publication-aware-links` | PASS — 0 fail, 0 error |
| `npm run build` | PASS |
| `npm run deploy:build` | PASS |

The production build continues to classify `/news/[slug]` as dynamic.

### Deployment

- Runtime commit: `867d9e8` — `feat: render internal links by publication status`
- Branch: `main`
- Deployment mechanism: Cloudflare Native Workers Builds
- Native build result: Success
- New Worker version: `d5ab9b59-57fd-4311-b3ff-77333cf476e5`
- Active traffic: 100%
- New production builds caused by the runtime push: exactly 1
- Manual `wrangler deploy`: not run
- Second Worker / Pages project: not created

The active version retains:

- D1 binding `DB` -> `28e229c2-c032-4c09-9490-630c1b88df50`;
- R2 binding `MEDIA_BUCKET` -> `budget-travel-compass-media`;
- `NEXT_PUBLIC_SITE_URL=https://budgettravelcompass.com`;
- `R2_PUBLIC_BASE_URL=https://media.budgettravelcompass.com`;
- existing `ADMIN_PASSWORD` and `SESSION_SECRET` secret bindings.

### Production Regression

After deployment:

- public article routes returning 404: 44/44;
- Homepage Draft article hrefs: 0;
- `/news` Draft article hrefs: 0;
- six category surfaces Draft article hrefs: 0;
- search Draft article hrefs: 0;
- sitemap Draft article hrefs: 0;
- authenticated Draft Preview remains functional and retains full approved internal links;
- production domain remains operational.

### D1 Integrity

Before and after deployment, Remote D1 remained:

| Assertion | Result |
| --- | --- |
| Production Drafts | 44 |
| Published | 0 |
| Placeholders | 0 |
| Stored internal article links | 129 |
| Distinct production slugs | 44 |
| Aggregate `body_html` bytes | 293,835 |
| Latest article `updated_at` | `2026-08-17T09:00:00.000Z` |
| Phase 10.1 per-article body hash equality | 44/44 |
| `media_assets` rows | 0 |
| R2 bucket size | 0 B |
| R2 objects | 0 |

All read-only D1 queries reported `changed_db=false`, `changes=0`, and `rows_written=0`.

### Publication Mechanics Result

`PUB-LINK-001` is closed. A controlled partial wave can now publish without exposing clickable links to Draft article routes. Later target publication automatically restores the approved link at render time; no temporary unlink/relink cycle or body rewrite is required.

No article has been published in this phase.

## Final Decision

**PUB-LINK-001 CLOSED**

**PRE-PUBLICATION RELEASE GATE PASSED**

**44 ARTICLE-LEVEL READY**

**0 ARTICLE HOLDS**

**0 PUBLISHED**

**CONTROLLED WAVE 1 PUBLISH is permitted as a separate, explicitly authorized phase.**

This phase stops here. It did not Publish, Seed, modify Remote `body_html`, delete articles, upload media, configure GA, or configure Ads.

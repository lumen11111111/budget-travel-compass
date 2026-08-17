# Budget Travel Compass — Phase 12C Production 1102 Runtime Incident Report

Date: 2026-08-17

Final status: **PRODUCTION RUNTIME INCIDENT RESOLVED**

Publication status: **CONTENT PUBLICATION COMPLETE — 44 PUBLISHED / 0 DRAFT**

## Scope and Boundaries

Phase 12C repaired only the confirmed public-render CPU hot path. It did not change Production D1 content, article status, schema, stored links, media, CMS behavior, BTC-014, Framework version, analytics, or advertising configuration. No Time Travel, seed, R2 upload, content review, or manual Worker deployment was performed.

## Incident Reproduction

Before implementation, Production `wrangler tail` captured representative failures for:

- `/`
- `/news/travel-daypack-setup`
- `/category/trip-planning`
- `/search?q=travel`

All four returned HTTP 503 with Cloudflare error 1102. Each invocation reported `outcome=exceededCpu`, `cpuTime=10`, and `Worker exceeded CPU time limit.` The active pre-fix Worker version was `d5ab9b59-57fd-4311-b3ff-77333cf476e5`.

The sitemap remained HTTP 200 because it already used a small direct D1 projection instead of the shared article snapshot.

## Root Cause

The public content repository used the same full snapshot as Admin/CMS. Every public snapshot executed `SELECT * FROM articles`, materialized all 44 `body_html` values, loaded the supporting tables, and then filtered or sorted the complete records in JavaScript.

The production corpus contained 293,862 aggregate body characters, while the equivalent list metadata was approximately 10,218 characters. Homepage, Category, Search, Article metadata, Article rendering, Sidebar, Footer, and related-content calls could request the full snapshot repeatedly during one render. Publishing all 44 articles therefore moved the public route workload over the Worker CPU limit.

The Phase 11A publication-aware link resolver was separately revalidated and was not the root cause.

## Minimal Runtime Fix

Commit: `e6a59970875d4c361cbf4ffaa03ca95eb7fb6797`

The implementation:

- added an explicit Published-only public article projection;
- excluded `body_html` from public list results;
- returned compact D1-computed reading-time metadata for cards and the Homepage;
- retained the full article snapshot for Admin/CMS;
- changed Article Detail to load one exact Published article body by slug with `LIMIT 1`;
- moved Related, Category, Tag, Search, Homepage, Sidebar, and Footer consumers to the lightweight public snapshot;
- memoized public and administrative snapshots within the render request;
- retained the existing one-query publication-aware target resolver.

The runtime SQL was executed read-only against Production before deployment:

- public rows: 44;
- public results containing `body_html`: 0;
- representative detail rows: 1;
- detail row containing `body_html`: 1.

## Regression Validation

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test:p0` | PASS — 0 fail, 0 error |
| `npm run test:sitemap` | PASS — 0 fail, 0 error |
| `npm run test:publication-aware-links` | PASS — 0 fail, 0 error |
| `npm run test:runtime-query-bounds` | PASS — lightweight public corpus, one-row detail, 44 Published fixture, 129 stored links |
| `npm run build` | PASS |
| `npm run deploy:build` | PASS |

The new regression asserts that public list SQL uses an explicit Published-only projection, cards and Homepage do not consume article bodies, Article Detail is slug-guarded and limited to one row, Related/Search use the lightweight snapshot, Admin retains the full loader, and the publication-aware resolver remains one lookup for unique targets.

## Native Workers Build

The implementation was pushed to `main`. Deployment used only Cloudflare Native Workers Builds; no manual `wrangler deploy` was run.

Cloudflare recorded:

- Git commit: `e6a59970875d4c361cbf4ffaa03ca95eb7fb6797`
- Build message: `fix: bound production article runtime queries`
- Existing Worker: `budget-travel-compass`
- Production version: `3071f913-6815-41cf-b1d7-2acca99554a8`
- Traffic: 100%
- Existing bindings retained: `ASSETS`, D1 `DB`, R2 `MEDIA_BUCKET`
- Second Worker/Pages project created: no

## Production Fast Acceptance

| Check | Result |
| --- | --- |
| Homepage | 200 |
| Canonical article routes | 44/44 HTTP 200 |
| Article canonical tags | 44/44 correct |
| Enabled category routes | 6/6 HTTP 200 |
| Categories showing Published cards | 6/6 |
| Search: `travel`, `budget`, `packing` | 3/3 HTTP 200 with Published results |
| Sitemap | 200 with 44 article URLs |
| Admin login | 200 |
| Stored internal links | 129 |
| Stored internal-link targets | 129/129 HTTP 200 |
| Response bodies containing 1102 | 0 |

The smoke run was captured by Production real-time logs:

- requests observed: 56;
- `outcome=ok`: 56;
- HTTP 200: 56;
- `exceededCpu`: 0;
- CPU-limit exceptions: 0;
- serving version: `3071f913-6815-41cf-b1d7-2acca99554a8` for 56/56 events.

## Production D1 Integrity

Read-only checks before and after deployment were identical:

- Articles: 44
- Published: 44
- Draft: 0
- Placeholders: 0
- Media: 0
- Stored internal links: 129
- Aggregate body length: 293,862
- Aggregate slug/body-hash/length digest: `ceb01b92c4e35366cc8036e14513f4e02b7adc9928336792b1954feab1197f2f`
- Clean Phase 10.1 body hashes: 43/43 unchanged

BTC-014 remains the explicitly deferred issue and was not modified:

- current hash: `40fc93957ef4c725a214a688cf9743d884ebbc65eea3524d54474b7af2df2996`
- Phase 10.1 approved hash: `5a0c97bd7f16d207cc738e58db3c4ad0272f67d48d75025f614c270d2765de71`

## Final Decision

**PRODUCTION RUNTIME INCIDENT RESOLVED**

**CONTENT PUBLICATION COMPLETE**

**44 PUBLISHED / 0 DRAFT / 0 PLACEHOLDERS / 129 STORED INTERNAL LINKS / 0 MEDIA**

Phase 12C stops here. BTC-014 body repair and the CMS rich-editor Publish issue remain deferred and outside this phase.

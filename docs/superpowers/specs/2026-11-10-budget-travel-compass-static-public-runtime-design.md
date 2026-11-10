# Budget Travel Compass — Free-Plan Static Public Runtime Design

Date: 2026-11-10

Status: APPROVED DESIGN — PENDING IMPLEMENTATION PLAN

## 1. Objective

Eliminate intermittent Cloudflare Worker error 1102 / HTTP 503 responses on the public Budget Travel Compass site while keeping the Cloudflare Workers Free plan.

The current OpenNext public render path normally consumes about 17–52 ms of CPU per request. Production tail logs confirm failed requests terminate with `outcome=exceededCpu` at the Free-plan CPU boundary. Query-level optimization alone cannot make the full Next.js render path reliably fit within that limit.

The approved operating constraints are:

- remain on the Cloudflare Workers Free plan;
- public content may remain stale until the next deployment;
- an administrator does not require D1 edits to appear automatically before deployment;
- preserve the existing Worker, D1 database, R2 media bucket, domain, CMS, and public design;
- do not create a second Worker or Pages project;
- do not modify production content as part of the runtime repair.

## 2. Chosen Architecture

Generate a complete static snapshot of the public site during the deployment workflow and serve it through Cloudflare Workers Static Assets before the OpenNext Worker.

```text
Production D1
    |
    | read-only export during an approved deployment
    v
Build-only public content snapshot
    |
    | render with the current Next.js application
    v
Static HTML, search data, redirects, sitemap, robots, and ads.txt
    |
    | upload with the existing Worker version
    v
Cloudflare Static Assets -> public visitors and crawlers

OpenNext Worker -> admin and explicitly allowlisted dynamic paths only
```

Public requests must not enter the OpenNext render path. Static Assets must return either the exact public asset, an approved redirect, or the static 404 response.

## 3. Deployment Components

### 3.1 Read-only production snapshot

Add a deployment-only exporter that reads the existing production D1 database through Wrangler and produces an ignored local snapshot.

The snapshot contains only data needed to render public pages:

- Published articles and their public fields;
- enabled categories and tags;
- article-to-tag relationships for Published articles;
- enabled homepage blocks;
- public site identity settings.

It must not include:

- Draft articles;
- administrator credentials or session data;
- secrets;
- unrelated database tables;
- private operational metadata.

The exporter is read-only. It must not execute `INSERT`, `UPDATE`, `DELETE`, schema migrations, seed operations, or R2 writes.

### 3.2 Build snapshot adapter

Add a build-only content adapter that maps the exported snapshot into the same public view models already consumed by the current pages and components.

Runtime behavior remains split:

- public static generation reads the build snapshot;
- production Admin/CMS continues to read and write D1;
- ordinary public requests do not read D1 after deployment.

The build adapter must not become a silent production fallback. It is enabled only by the dedicated static-public deployment command and must fail closed when its manifest or snapshot is absent.

### 3.3 Public page generation

The deployment workflow renders and captures the current application output for every canonical public route:

- homepage;
- Guides index and pagination;
- every Published guide;
- enabled category and tag pages;
- About, Contact, Privacy, Cookie, Terms, Editorial, Affiliate, DMCA, and Disclaimer pages;
- Search shell and compact search index;
- sitemap, robots, ads.txt, icons, and public static dependencies;
- static 404 page.

The generated HTML must preserve the existing public design, metadata, canonical URLs, `Article` structured data, source sections, dates, analytics sanitization, and legal disclosures.

### 3.4 Static search

The current server-side search route becomes a static search shell backed by a compact public JSON index containing only fields required for matching and display:

- title;
- slug;
- summary;
- category;
- public tags;
- cover URL;
- publication metadata needed by the result card.

Search runs in the browser. Raw search terms must remain excluded from Google Analytics page location, page path, and custom event payloads under the existing analytics contract.

### 3.5 Public navigation

Public links use full-page navigation rather than Next.js server navigation. This prevents clicks from generating React Server Component requests that would fall through to the OpenNext Worker.

Admin navigation remains dynamic and may continue using the existing Next.js behavior.

### 3.6 Asset routing

Configure Static Assets to run before the Worker for public paths. `assets.run_worker_first` is restricted to explicit dynamic patterns needed by the CMS, such as `/admin/*` and approved upload or protected media paths.

The asset configuration uses:

- clean HTML path handling compatible with canonical URLs;
- `not_found_handling: "404-page"` for public misses;
- a narrow Worker-first allowlist rather than a global Worker-first setting.

The deployment generates static redirect rules for:

- `/news` -> `/guides`;
- `/news/*` -> `/guides/*`.

No Sitemap URL may depend on Worker fallback.

## 4. Deployment Workflow

Add one dedicated command, provisionally named `npm run deploy:static-public`, with this order:

1. Verify Wrangler authentication and the exact Cloudflare account, Worker, D1 database, and R2 bucket.
2. Run read-only D1 preflight queries.
3. Export the public build snapshot.
4. Validate snapshot counts, relationships, slugs, statuses, and manifest digest.
5. Build the current application against the snapshot.
6. Render and capture every required public route.
7. Generate search data, redirect rules, header rules, and the static 404 response.
8. Run local static acceptance tests.
9. Run the OpenNext/Wrangler deployment dry run.
10. Deploy the existing `budget-travel-compass` Worker and Static Assets together.
11. Run production acceptance and D1 integrity checks.

The ordinary `npm run deploy` command must not accidentally publish an incomplete dynamic-only build. The dedicated command is the supported production path for this site after implementation.

Generated snapshots and rendered public files are build artifacts. They are ignored by Git and are not committed as editorial source.

## 5. Content Freshness Contract

D1 remains the administrative source of truth. A successful CMS edit updates D1 but does not change the public static snapshot immediately.

Public content changes only after the next successful static-public deployment. The deployment manifest records:

- export timestamp;
- production database identifier;
- Published article count;
- route count;
- content digest;
- generated asset count.

This makes the public freshness boundary explicit and auditable.

## 6. Failure Handling

The workflow fails before deployment when any of the following occurs:

- production account or resource identity does not match the approved target;
- D1 export fails or attempts a write;
- expected tables or public settings are absent;
- Published article, category, tag, or relationship counts are inconsistent;
- a Draft article appears in the public snapshot;
- a slug or output path is duplicated;
- any required route fails to render;
- a generated route returns an unexpected status;
- canonical URL, structured data, or required content does not match its route;
- any Sitemap URL lacks an exact static asset;
- a generated public link still requires Next.js server navigation;
- build, tests, or Wrangler dry run fails.

On a pre-deployment failure, leave the current production version untouched.

On a post-deployment acceptance failure, roll back to the immediately previous Worker version and stop. Do not alter D1, R2 media, DNS, or AdSense configuration as part of rollback.

## 7. Validation

### 7.1 Local gates

Required gates include:

- TypeScript typecheck;
- AdSense remediation tests;
- Sitemap runtime tests;
- publication-aware internal-link tests;
- runtime query-bound tests;
- new snapshot validation tests;
- new static-route completeness tests;
- new navigation and search-index tests;
- OpenNext build;
- Wrangler deployment dry run.

The static manifest must prove that every canonical public URL has an exact generated asset and that no Admin, preview, session, or Draft path is present.

### 7.2 Production acceptance

After deployment:

- verify homepage, Guides, every canonical guide, all enabled categories and tags, legal pages, search, sitemap, robots, ads.txt, and 404 behavior;
- verify `/news` and `/news/*` redirects;
- verify all 44 article canonicals and `Article` structured data;
- verify source sections and editorial dates retain their approved behavior;
- test desktop and mobile navigation and client-side search;
- run repeated full-Sitemap fetch rounds, including Googlebot and Mediapartners-Google user agents;
- require zero HTTP 503 responses, zero error 1102 bodies, and zero `exceededCpu` outcomes;
- confirm public static requests do not appear as OpenNext Worker executions in real-time logs;
- compare production D1 counts and content digest before and after deployment.

The release passes only when D1 remains unchanged and all public acceptance requests are served without Worker CPU failures.

## 8. Rollback

Record the current production version before deployment. If acceptance fails:

1. restore the previous Worker version;
2. verify the restored version and bindings;
3. stop further production changes;
4. report the failed route, response, version, and log evidence.

Rollback must not restore or mutate D1 because the static-public deployment does not write content data.

## 9. Explicit Non-Goals

This repair does not:

- upgrade the Cloudflare Workers plan;
- create a second Worker or Pages project;
- redesign the public site;
- rewrite or republish articles;
- change article publication dates or editorial update dates;
- change production D1 content or schema;
- change R2 article media;
- configure AdSense, CMP, or advertising code;
- add automatic deployment after CMS edits;
- promise public updates before the next deployment;
- replace the Admin/CMS application.

## 10. Acceptance Decision

The runtime incident is resolved only when public static routes are proven to bypass the OpenNext render path and repeated production sampling produces:

- zero 503 responses;
- zero error 1102 responses;
- zero `exceededCpu` public invocations;
- unchanged production D1 content;
- one existing Worker and no additional hosting project.

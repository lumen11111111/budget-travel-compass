# Budget Travel Compass AdSense Remediation Production Deployment

Date: 2026-11-10 (Asia/Shanghai)

## Authorization and target

- Production continuation was explicitly authorized after the local remediation pass.
- Cloudflare account: `margaretdowns208@gmail.com` (`95d9b93db8abc73b05ceb93acc36745d`).
- Worker: `budget-travel-compass`.
- D1: `budget-travel-compass` (`28e229c2-c032-4c09-9490-630c1b88df50`).
- Production deployment was kept separate from Git push activity.

## Backup and migration

- Full pre-migration D1 export: `.codex-backups/2026-11-10-adsense-remediation/budget-travel-compass-before-editorial-date.sql`.
- Backup size: 425,772 bytes.
- Backup SHA-256: `CE70D6713C773FEBB180011B76343C09989F9361C91FD132393142C33F96951F`.
- Applied `src/db/migrations/0002_article_editorial_updated_at.sql` remotely.
- Post-migration schema: `editorial_updated_at TEXT NULL`.
- Post-migration data: 44 articles, 44 published, 0 populated editorial-update dates.

## Deployment

- OpenNext build passed.
- Wrangler dry-run passed with the intended D1, R2, Assets, and production URL bindings.
- Initial remediation Worker version: `e3e22d7e-e40b-4e42-b341-ecee76a5258d`.
- Final static-public Worker version: `69e685eb-6b34-4376-b167-2418c5880166`.
- Public HTML, search data, sitemap, robots, ads.txt, redirects, and the 404 page are served by Cloudflare Static Assets before the Worker.
- Worker-first routing is limited to `/admin`, `/admin/*`, and `/media/*`.
- Final Worker startup time reported by Wrangler: 12 ms.

## Production acceptance

- Homepage, guide archive, representative guide, policies, sitemap, robots, ads.txt, and image optimization returned HTTP 200.
- `/news` and `/news/[slug]` returned HTTP 308 to `/guides` equivalents.
- All 44 canonical guide URLs in the production sitemap returned HTTP 200.
- Sitemap contains no legacy `/news` URLs and no unverified article `lastmod` values.
- Representative guide emitted canonical `/guides` metadata and Schema.org `Article`, with no `NewsArticle` or unverified `dateModified`.
- 24 guides rendered verified source sections; 20 guides correctly omitted the section; no empty source sections were found.
- Homepage contained no subscription UI; contact page contained no disabled form.
- Privacy, Cookie, and Editorial disclosures were present with a clean Google Privacy link.
- GA4 runtime data layer used `/search` without the raw query value and configured `send_page_view: false`.
- Desktop and mobile homepage/contact visual checks reported no failed HTTP resources or broken layout regions.
- Canonical redirects were observed for HTTP and `www` traffic.

## Static-public runtime acceptance

- Read-only production snapshot: 44 Published articles, 6 enabled categories, and 6 enabled homepage blocks.
- Snapshot and post-deployment D1 SHA-256 digest: `bb52999b73a40dee27a1daa4554d3db02aa621ff880cc294531d527d5a37d7d0`.
- Generated 67 public HTML routes from the validated snapshot.
- Five complete production route passes issued 335 requests with zero failures; the repeatable production verifier added 134 public HTML checks and 7 special-route checks with zero failures.
- Live Tail observed the Admin probe only; 20 public probes did not execute the Worker.
- Cloudflare zone-level **Always Use HTTPS** is enabled; HTTP requests return 301 redirects before Static Assets.
- `/admin/login` remains dynamic and returned HTTP 200 without the static content-digest header.

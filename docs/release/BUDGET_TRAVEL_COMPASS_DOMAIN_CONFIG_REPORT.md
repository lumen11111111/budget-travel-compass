# Budget Travel Compass Domain Configuration Report

Date: 2026-08-17
Phase: 9B — Domain & Production URL Configuration

## Production Domain

`budgettravelcompass.com`

The Instance production manifest and runtime site authority are aligned to the apex hostname.

## Canonical

`https://budgettravelcompass.com`

The following effective authorities are aligned:

- `starter.site.json` production URL
- `src/instance/site.config.ts` site URL
- `wrangler.jsonc` `NEXT_PUBLIC_SITE_URL`
- Runtime canonical and absolute URL helpers
- Sitemap, robots, page metadata, article metadata, category metadata, OpenGraph, and JSON-LD consumers

Runtime assertions confirmed homepage and article canonical URLs use the apex domain. Sitemap generation contains the apex hostname and no `www` hostname.

## WWW Policy

`www.budgettravelcompass.com` must redirect to the apex canonical hostname with a permanent redirect after Cloudflare routing is configured.

No `www` URL was configured as a canonical authority, and no DNS or redirect rule was created in this phase.

## Media Domain

`https://media.budgettravelcompass.com`

`R2_PUBLIC_BASE_URL` is configured to the dedicated media hostname. This phase did not create DNS, bind an R2 custom domain, enable R2.dev, upload objects, or add a new Worker media proxy path.

## D1

Configured and unchanged:

- Binding: `DB`
- Database: `budget-travel-compass`
- Database ID: `28e229c2-c032-4c09-9490-630c1b88df50`

Remote D1 was not initialized or modified.

## R2

Configured and unchanged:

- Binding: `MEDIA_BUCKET`
- Bucket: `budget-travel-compass-media`

The media domain is configuration-only until Cloudflare binds `media.budgettravelcompass.com` to this bucket.

## Contact Email

Configured using the existing project authority:

`budgettravelcompass@gmail.com`

The production manifest was aligned to the same existing runtime contact, support, and legal email. No domain-based mailbox was invented.

## Doctor

`npm run doctor`: **PASS**

- 36 PASS
- 1 WARN
- 0 FAIL
- Domain, site URL, D1, R2, Git remote, and URL consistency checks pass.
- The remaining warning is the expected secret-name marker scan; no secret value was found or configured.

## Manifest

`npm run manifest:check`: **PASS**

- 63 PASS
- 1 WARN
- 0 FAIL
- Domain, production URL, D1, R2, GitHub, and contact email values are aligned.
- The remaining warning is the empty operator country, which is outside Phase 9B.

## URL and Sitemap Validation

- Wrangler 4.105.0 generated temporary binding types successfully with the canonical and media URL literals.
- The temporary type file was created outside the workspace and removed after validation.
- Canonical homepage URL: `https://budgettravelcompass.com/`
- Canonical article URL sample: `https://budgettravelcompass.com/news/example-slug`
- Sitemap apex assertion: PASS
- Sitemap `www` exclusion assertion: PASS
- `npm run test:sitemap`: 0 fail, 0 error

## Typecheck

`npm run typecheck`: **PASS**

## Build

- `npm run build`: **PASS**
- `npm run deploy:build`: **PASS**
- OpenNext generated `.open-next/worker.js` locally.
- OpenNext emitted its standard Windows/WSL compatibility warning; no deployment occurred.

## Remote Writes

**0**

No Cloudflare DNS mutation, Worker deployment, remote D1 operation, R2 upload, secret write, domain binding, or other remote mutation was executed.

## Git Diff

The intended tracked change set contains only:

- `starter.site.json` — domain, production URL, and alignment to the existing contact email authority
- `wrangler.jsonc` — production site and media URL variables
- `src/instance/site.config.ts` — effective Instance domain and canonical URL
- `docs/release/BUDGET_TRAVEL_COMPASS_DOMAIN_CONFIG_REPORT.md` — this report

No article, local D1, import artifact, build output, secret, Framework, Theme, or unrelated website file is included.

## Remaining Cloudflare Dashboard Work

- Add the domain to a Cloudflare zone and verify nameservers
- Bind the Worker custom domain to `budgettravelcompass.com`
- Configure permanent `www` → apex redirect
- Bind `media.budgettravelcompass.com` as the R2 custom domain
- Configure production `ADMIN_PASSWORD`
- Configure production `SESSION_SECRET`
- Initialize the remote D1 schema
- Configure GitHub automatic deployment

## Final State

**PRODUCTION DOMAIN CONFIGURED LOCALLY**

- Worker: NOT deployed
- Remote D1: NOT initialized
- R2 domain: NOT bound
- Articles: NOT uploaded
- Articles: NOT published
- GitHub deployment: NOT configured

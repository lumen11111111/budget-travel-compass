# Budget Travel Compass Cloudflare Production Config Report

Date: 2026-08-17
Phase: 9A — Cloudflare Production Config

## D1

- Name: `budget-travel-compass`
- ID: `28e229c2-c032-4c09-9490-630c1b88df50`
- Binding: `DB`
- Effective binding count: 1
- Remote schema initialization: NOT performed
- Remote seed/import: NOT performed
- Existing `.wrangler` local state: preserved and Git-ignored

## R2

- Bucket: `budget-travel-compass-media`
- Binding: `MEDIA_BUCKET`
- Effective binding count: 1
- Objects uploaded by Phase 9A: 0
- Remote bucket contents were not queried or modified.

## Worker Name

`budget-travel-compass`

The effective Worker name in `wrangler.jsonc` and the Instance production resource manifest in `starter.site.json` are aligned.

## Canonical URL

**WAITING FOR DOMAIN CONFIGURATION**

`NEXT_PUBLIC_SITE_URL`, `siteConfig.url`, and canonical URL configuration remain on the explicit `https://example.com` placeholder. No domain was inferred.

## R2 Public URL

**WAITING FOR DOMAIN CONFIGURATION**

`R2_PUBLIC_BASE_URL` remains on the explicit `https://example.com/media` placeholder. R2.dev was not enabled and no public development URL was created.

## Required Secrets

The runtime expects these production secret names:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

No secret value was generated, configured, written to `wrangler.jsonc`, or added to an environment example file.

## Remote Writes

**0**

No remote D1 command, migration, seed, import, R2 upload, Worker deployment, secret write, domain operation, or Cloudflare mutation was executed.

## Doctor

`npm run doctor`: **PASS**

- 33 PASS
- 4 WARN
- 0 FAIL
- The real D1 ID and Worker name checks now pass.
- Remaining warnings concern the intentionally unresolved domain/canonical placeholder and secret-name marker scan.

`npm run manifest:check`: **PASS**

- 59 PASS
- 5 WARN
- 0 FAIL
- The D1 ID is recognized as a non-placeholder value.

## Typecheck

`npm run typecheck`: **PASS**

## Build

- `npm run build`: **PASS**
- `npm run deploy:build`: **PASS**
- The first OpenNext attempt encountered Windows `EPERM` because the project's local preview on port 3020 held `.open-next` open. After stopping only that local preview process group, the same build completed successfully.
- OpenNext emitted its standard Windows/WSL compatibility warning; bundle generation completed and no deployment occurred.

## Git Diff

The intended tracked change set contains only:

- `wrangler.jsonc` — effective Worker, D1, and R2 production resource configuration
- `starter.site.json` — aligned Instance GitHub and Cloudflare production resource manifest
- `docs/release/BUDGET_TRAVEL_COMPASS_CLOUDFLARE_PRODUCTION_CONFIG_REPORT.md` — this report

No article, local D1, import artifact, build output, secret, Framework, Theme, or website visual file is included.

## Remaining Production Configuration

- Canonical production domain and `NEXT_PUBLIC_SITE_URL`
- Public media domain and `R2_PUBLIC_BASE_URL`
- Production `ADMIN_PASSWORD` and `SESSION_SECRET`
- Remote D1 schema initialization
- Remote Draft article import
- R2 media upload
- Worker deployment
- Domain binding
- GitHub deployment configuration
- Publication approval
- GA and advertising configuration

## Final State

**CLOUDFLARE PRODUCTION RESOURCES CONFIGURED LOCALLY**

- Remote D1 schema: NOT initialized
- Remote D1 articles: NOT uploaded
- R2 objects uploaded by this phase: 0
- Worker: NOT deployed
- Domain: NOT configured
- GitHub deployment: NOT configured
- Articles: NOT published

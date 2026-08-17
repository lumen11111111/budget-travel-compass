# Budget Travel Compass — Production Git Baseline Report

Date: 2026-08-17  
Project: `E:\BudgetTravelCompass`  
Final state: **LOCAL GIT BASELINE READY**

## Gitignore Audit

The inherited ContentForge ignore policy was preserved and extended only for project-local generated and secret-bearing candidates.

Verified ignored:

- `node_modules/`
- `.next/`
- `.open-next/`
- `.wrangler/`
- `.contentforge/`
- `.env` and `.env.*`, except the approved example file
- `.dev.vars` and `.dev.vars.*`, except `.dev.vars.example`
- `tsconfig.tsbuildinfo`
- `data/admin-content.json`
- `data/d1-seed.sql`
- `data/import-jobs/`
- temporary import-plan and dry-run JSON records under `data/`
- `/content/import/`
- `.codex-preview/`
- `artifacts/`
- root `a.status`
- logs and temporary import verification files

The staged baseline contains 628 files totaling approximately 17.97 MB. The largest candidate is a required theme font at approximately 1.14 MB; no unexpected large generated file is included.

## Local D1 Exclusion

`.wrangler/` is ignored at the repository root. `git check-ignore` confirmed that both `.wrangler/` and `.wrangler/state/v3/d1` are excluded.

The validated local D1 remains on the development machine and was not deleted. Its 44 production drafts and six placeholders are local validation evidence only and are not treated as the future production content authority.

No SQLite file, Wrangler local state, D1 seed output, or local database snapshot is included in the Git baseline.

## Content Source Policy

- `content-preparation/research/` is included as the approved production article source/research workflow.
- `/content/import/` remains explicitly ignored under the existing ContentForge policy.
- Deterministic import artifacts were not force-added.
- Volatile import plans and job records remain ignored.
- Future production articles must be imported into Cloudflare D1 through the approved source/import workflow.

## Secrets Audit

No real secret environment file is present.

- `.dev.vars.example`: retained; all values are empty examples.
- `env.example`: retained; all values are empty examples.
- `wrangler.jsonc`: contains only `example.com`, example resource names, and an all-zero placeholder D1 ID.
- `starter.site.json`: no GA measurement ID and no AdSense client ID.
- Runtime secret names resolve through environment/config code rather than committed literal credentials.
- Literal password/secret strings found in test files are deliberate test fixtures; missing-secret strings in runtime code are sentinels, not credentials.
- No GitHub, OpenAI, AWS, private-key, or other recognized token prefix was found.

No Framework documentation or test fixture was removed merely to silence the scan.

## Generated Files

Excluded build and execution state includes `.next/`, `.open-next/`, `.wrangler/`, `node_modules/`, `.contentforge/`, logs, local D1 state, import plans, and import job manifests.

The four files currently under `.contentforge/` are dry-run/preflight/execute records and are correctly treated as volatile. Required project configuration remains versioned through `.contentforge-version`, `starter.site.json`, `site.theme.json`, `wrangler.jsonc`, and the normal runtime configuration files.

## QA Artifact Policy

- `artifacts/`: excluded; approximately 21.16 MB of temporary full-page visual QA screenshots with no runtime dependency.
- `docs/qa/`: retained; 13 curated screenshots totaling approximately 0.85 MB, directly referenced by Phase 4.2 and Phase 7B reports.

This keeps the production repository compact while preserving the small, documented QA evidence set.

## Runtime Files

The baseline includes the project runtime and required source/configuration assets:

- `src/`
- `public/`
- `scripts/`
- `tools/`
- `frontend-library/`
- `package.json` and `package-lock.json`
- `wrangler.jsonc`
- `starter.site.json` and example manifest
- `site.theme.json`
- TypeScript, Next.js, PostCSS, Tailwind, and ESLint configuration
- D1 schema/migration source
- necessary specifications, release/content reports, and approved research packages

## Framework Boundary

`E:\content-site-starter` was checked with `git status --short` and is clean. No Framework source file was modified or written back.

The Factory-provided botanical editorial Theme runtime copy inside Budget Travel Compass is part of this independent site baseline and is included normally.

## Doctor

`npm run doctor`: **PASS WITH EXPECTED WARNINGS**

- 32 PASS
- 5 WARN
- 0 FAIL

Warnings are the expected pre-production placeholders: no Git origin, `example.com` canonical/site URL, and the all-zero D1 database ID.

## Typecheck

`npm run typecheck`: **PASS**

## Tests

`npm run test:p0`: **PASS**

- 0 fail
- 0 error

## Build

`npm run build`: **PASS**

Next.js production compilation, TypeScript validation, page-data collection, static generation, and build trace collection completed successfully.

## Git Status

Repository initialized locally with branch `main`. Candidates were staged by explicit project categories rather than `git add .`.

The staged baseline was audited to exclude:

- `node_modules/`
- `.next/`
- `.open-next/`
- `.wrangler/` and local D1
- `.contentforge/`
- real env/secret files
- `/content/import/`
- volatile import plans/job records
- temporary `artifacts/`
- `a.status`

The first local baseline commit leaves no uncommitted non-ignored file.

## Commit

Local root commit created on branch `main` with message:

`feat: establish Budget Travel Compass production baseline`

No remote was configured and nothing was pushed.

## Remaining Production Placeholders

The six local D1 placeholders remain intentionally untouched. They do not enter Git and are not production authority.

Future production sequence remains:

1. Create and validate the remote Cloudflare D1 baseline.
2. Import the 44 approved articles as production drafts.
3. Validate the production draft corpus.
4. Remove remote placeholders under separate authorization.
5. Run Internal Link Pass 2 against real production canonical routes.

Current production boundaries:

- Cloudflare not configured
- GitHub remote not configured
- Production D1 not created
- Production R2 not created
- Domain not configured
- 44 articles not uploaded to production
- No articles published

**LOCAL GIT BASELINE READY**

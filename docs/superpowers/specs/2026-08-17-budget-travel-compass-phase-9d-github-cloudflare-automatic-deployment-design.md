# Budget Travel Compass Phase 9D GitHub to Cloudflare Automatic Deployment Design

Date: 2026-08-17
Status: Selected mechanism captured for user review

## Goal

Connect the existing GitHub repository and production branch to the existing Cloudflare Worker through Cloudflare Native Workers Builds so that future approved pushes to `main` build and deploy Budget Travel Compass automatically.

The integration must reuse the current OpenNext deployment chain and preserve the existing Worker, D1 database, R2 bucket, runtime variables, Worker secrets, custom domains, and remote content state.

## Fixed production identity

- GitHub repository: `lumen11111111/budget-travel-compass`
- Production branch: `main`
- Worker: `budget-travel-compass`
- Canonical site URL: `https://budgettravelcompass.com`
- D1 binding: `DB`
- D1 database: `budget-travel-compass`
- D1 ID: `28e229c2-c032-4c09-9490-630c1b88df50`
- R2 binding: `MEDIA_BUCKET`
- R2 bucket: `budget-travel-compass-media`
- Media URL: `https://media.budgettravelcompass.com`
- Required Worker secret names: `ADMIN_PASSWORD`, `SESSION_SECRET`

The Worker name in Cloudflare and `wrangler.jsonc` already match. The repository root already contains the OpenNext, Wrangler, D1, R2, and production URL configuration needed by the existing Worker.

## Approaches considered

### A. Cloudflare Native Workers Builds — selected

Connect the existing Worker directly to the GitHub repository. Cloudflare listens to `main`, installs the repository dependencies, executes the approved OpenNext build command, and deploys the resulting bundle to the same Worker.

This is the official Cloudflare Git integration path for an existing Worker and the OpenNext-recommended reproducible deployment path. Cloudflare manages the build/deploy authorization internally, so no Cloudflare API token needs to be stored in GitHub.

### B. GitHub Actions — rejected

A GitHub Actions workflow would require a second CI authority plus repository secrets such as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The current repository has no Actions workflow, Actions secrets, variables, or prior Actions deployment architecture. Adding it would duplicate the native Cloudflare build system.

### C. Direct Builds API orchestration — rejected

Creating repository connections, build tokens, and triggers through the Cloudflare Builds API requires additional user-scoped API credentials and a larger custom orchestration surface. It is unnecessary when the existing Worker can be connected through Native Workers Builds.

## Architecture

The deployment flow is:

```text
approved commit on GitHub main
  -> Cloudflare Native Workers Builds production trigger
  -> install dependencies from package-lock.json
  -> npx @opennextjs/cloudflare build
  -> npx @opennextjs/cloudflare deploy
  -> update existing Worker budget-travel-compass
  -> preserve existing bindings, secrets, domains, D1 data, and R2 objects
```

There is one production deployment authority. No GitHub Actions workflow, Pages project, second Worker, second Cloudflare application, or parallel deployment pipeline is created.

## Cloudflare Native Builds configuration

Connect the existing Worker `budget-travel-compass` under **Settings → Builds** to:

- Git provider: GitHub
- Repository: `lumen11111111/budget-travel-compass`
- Root directory: `/`
- Production branch: `main`
- Build command: `npx @opennextjs/cloudflare build`
- Deploy command: `npx @opennextjs/cloudflare deploy`
- Non-production branch builds: disabled
- Build watch include paths: `*`
- Build watch exclude paths: `docs/release/*`

The existing repository already contains `wrangler.jsonc`, `open-next.config.ts`, the OpenNext package, and a lockfile. Native Builds must use those files directly. Cloudflare autoconfiguration must not create or merge a framework-conversion pull request. If the connection flow proposes a second application, Pages project, replacement Worker, or incompatible autoconfiguration PR, stop without accepting it.

Build caching may remain at the Cloudflare default. No custom dependency-install command, Node-version file, preview Worker, or deploy hook is introduced unless a failed build later proves one is required and the user approves a spec revision.

## Build-time environment

Configure these non-secret Native Builds variables for the production trigger:

- `NEXT_PUBLIC_SITE_URL=https://budgettravelcompass.com`
- `R2_PUBLIC_BASE_URL=https://media.budgettravelcompass.com`

They must match the values already committed in `wrangler.jsonc`. They are build-time public URL authorities, not credentials.

Do not add `ADMIN_PASSWORD` or `SESSION_SECRET` to Native Builds variables or GitHub. They remain existing encrypted Worker runtime secrets. Native Builds uses Cloudflare-managed deployment authorization; no GitHub `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` secret is created.

## Resource preservation

The deployment reads the existing `wrangler.jsonc` and must retain exactly:

- `DB` → `budget-travel-compass`
- `MEDIA_BUCKET` → `budget-travel-compass-media`
- `NEXT_PUBLIC_SITE_URL` → `https://budgettravelcompass.com`
- `R2_PUBLIC_BASE_URL` → `https://media.budgettravelcompass.com`

The deploy command may upload the generated Worker bundle and Workers static assets because that is the purpose of Phase 9D. It must not execute any application article import, D1 seed, D1 migration, placeholder reset, R2 article-media upload, R2 delete, or content publication operation.

No deployment step may call:

- `npm run db:seed`
- `npm run db:d1-seed`
- `npm run db:d1-seed:write`
- `npm run d1:init`
- `npm run import:articles`
- `npm run publish`
- `wrangler d1 execute`
- `wrangler d1 migrations apply`
- `wrangler r2 object put`
- `wrangler r2 object delete`

These commands remain separate, explicitly authorized operations outside the automatic code deployment pipeline.

## Pre-configuration baseline capture

Before enabling Native Builds:

1. Confirm the worktree is clean and `main` tracks `origin/main`.
2. Confirm there is no existing `.github` deployment workflow or competing Cloudflare build connection.
3. Run sequentially:
   - `npm run typecheck`
   - `npm run test:p0`
   - `npm run build`
   - `npm run deploy:build`
4. Record the current active Worker deployment/version identifier.
5. List Worker secret names only and confirm `ADMIN_PASSWORD` and `SESSION_SECRET`; never read or print secret values.
6. Read-only query remote D1 and capture:
   - categories count;
   - articles count;
   - published count;
   - draft count;
   - ordered article slug/status baseline.
7. Record the current Worker bindings, including `DB` and `MEDIA_BUCKET`.

Expected D1 baseline:

- Categories: 6
- Articles: 6
- Published: 0
- Drafts: 6

Any mismatch blocks configuration until reviewed. Do not repair, seed, delete, or normalize the remote database in Phase 9D.

## One deployment-triggering push

The Phase 9D design specification is committed locally before implementation and remains ahead of `origin/main`. After Native Builds is configured, push that existing documentation-only commit to `main` as the single harmless automatic-deployment test.

Because the changed path is under `docs/superpowers/specs/`, it is not excluded by the production build watch rule and must trigger one Native Build. No website content, article, runtime source, D1 record, or R2 object is changed merely to trigger deployment.

Verify through Cloudflare build history and GitHub check status that:

1. the push is accepted;
2. exactly one production build starts for the pushed commit;
3. the build command succeeds;
4. the deploy command succeeds;
5. the resulting version becomes the active deployment of `budget-travel-compass`;
6. no second Worker or Pages project is created.

Do not use a manual `wrangler deploy` as a fallback if the automatic build fails. Record the failure, leave the existing active deployment unchanged where possible, and classify Phase 9D as blocked.

## Production smoke test

After the automatic deployment succeeds, verify:

- `https://budgettravelcompass.com` → 200
- `https://budgettravelcompass.com/about` → 200
- `https://budgettravelcompass.com/search` → 200
- `https://budgettravelcompass.com/sitemap.xml` → 200 and canonical apex URLs
- `https://budgettravelcompass.com/admin` → protected redirect or protected login response
- the admin login page remains reachable without submitting credentials
- `www` does not become a canonical authority

The smoke test is read-only. Do not log in, edit content, publish, upload media, or create an admin session unless a separate authorization explicitly requires it.

## Post-deployment regression

Repeat the same read-only D1 query and compare the ordered result with the pre-deployment baseline. Require:

- Categories: 6
- Articles: 6
- Published: 0
- Drafts: 6
- article slug/status set: unchanged

List the active Worker version and its bindings after deployment. Require:

- Worker name: `budget-travel-compass`
- `DB` binding unchanged
- `MEDIA_BUCKET` binding unchanged
- `ADMIN_PASSWORD` and `SESSION_SECRET` secret names still present
- canonical and media URL variables unchanged

Do not inspect secret values or mutate R2 objects. The absence of R2 write commands in the build configuration plus the unchanged `MEDIA_BUCKET` binding is the Phase 9D R2 safety evidence.

## Report and final Git synchronization

After verification, create:

`docs/release/BUDGET_TRAVEL_COMPASS_GITHUB_CLOUDFLARE_DEPLOYMENT_REPORT.md`

The report records the selected mechanism, repository, production branch, Worker target, build/deploy commands, secrets model, D1/R2 safety, automatic deployment result, production smoke test, D1 regression, active version, and Git state. It must not contain tokens or secret values.

Commit and push the report after the deployment test. This is a Git synchronization push, not a second deployment test: the `docs/release/*` build watch exclusion must cause the report-only push to skip a Worker build. Verify the skip and require:

- local worktree clean;
- local `main` equals `origin/main`;
- the active Worker version remains the version produced by the single deployment test.

If Cloudflare does not honor the report-path exclusion, stop and report the unexpected second build. Do not compensate by creating another pipeline or modifying site content.

## Failure behavior

Phase 9D fails closed for any of the following:

- initial worktree is dirty or `main` does not track `origin/main`;
- an existing competing deployment workflow or build trigger is found;
- the Cloudflare connection targets a new Worker, Pages project, or wrong account;
- Worker/repository/root-directory/branch mismatch;
- non-production branch builds cannot be disabled;
- required build variables cannot be aligned safely;
- any local validation fails;
- Native Build or deploy fails;
- production smoke test fails;
- active Worker bindings or secret names change unexpectedly;
- D1 counts or ordered slug/status baseline changes;
- any article, placeholder, publication state, or R2 object is mutated;
- a secret value appears in Git, GitHub, logs, or reports;
- final `main` differs from `origin/main` or the worktree is dirty.

No automatic rollback is authorized by this design. Capture the previous active version identifier so a separately authorized rollback remains possible. Do not create a workaround that duplicates the deployment architecture.

## Allowed changes and external actions

Allowed during implementation:

- connect the existing Worker to the named GitHub repository through Native Workers Builds;
- configure the approved production branch, commands, public build variables, branch control, and watch paths;
- commit and push the already-approved design document as the single deployment test;
- create, commit, and push the final report under the excluded report path;
- perform read-only GitHub, Cloudflare, HTTP, Worker metadata, secret-name, binding, and D1 verification.

Not allowed:

- GitHub Actions workflow or GitHub Cloudflare secrets;
- second Worker, Pages project, Cloudflare application, or preview production Worker;
- manual fallback deployment;
- remote D1 migration, seed, import, delete, or placeholder reset;
- article import, Internal Link Pass 2, or publication;
- R2 upload, delete, reset, or media pipeline;
- GA or advertising configuration;
- Framework, Theme, article, CMS schema, or production content modification.

## Completion criteria

Success requires all of the following:

- Native Workers Builds is connected to the existing Worker and GitHub `main`;
- approved build and deploy commands are configured;
- automatic non-production branch builds are disabled;
- no GitHub Actions workflow or GitHub Cloudflare secret exists;
- one harmless push triggers exactly one successful production build and deployment;
- production smoke tests pass;
- D1 baseline is exactly equivalent at the ordered slug/status level and count-equivalent at the summary level;
- Worker bindings, public variables, and secret names remain intact;
- the report-only push does not deploy;
- worktree is clean and `main = origin/main`;
- no prohibited content, D1, R2, publication, analytics, advertising, or duplicate-infrastructure operation occurred.

Final success state:

`GITHUB → CLOUDFLARE AUTOMATIC DEPLOYMENT READY`

Failure state:

`AUTOMATIC DEPLOYMENT BLOCKED`

## Stop boundary

After the report and final verification, stop. Do not begin the remote 44-article Draft Import, delete placeholders, run Internal Link Pass 2, publish articles, configure GA, or configure Ads.

## Authoritative references

- Cloudflare Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Workers Builds configuration: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Cloudflare build branches: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- Cloudflare build watch paths: https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/
- OpenNext Cloudflare deployment: https://opennext.js.org/cloudflare/howtos/dev-deploy

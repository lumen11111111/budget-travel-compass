# Budget Travel Compass Static Public Runtime Implementation Plan

Design: `docs/superpowers/specs/2026-11-10-budget-travel-compass-static-public-runtime-design.md`

## Execution boundary

- Keep the Cloudflare Workers Free plan and the existing `budget-travel-compass` Worker.
- Production D1 access is read-only until the final existing-Worker deployment.
- Do not create a second Worker, Pages project, D1 database, R2 bucket, or DNS record.
- Preserve all pre-existing working-tree changes and stage or commit none of them as part of implementation.
- Generated snapshots and static assets remain ignored build artifacts.

## Tasks

1. Add a fixed-query production snapshot exporter that verifies the authenticated Cloudflare account and configured D1 database, exports only Published/public rows, validates relationships, and records a SHA-256 manifest.
2. Convert the validated snapshot into a temporary local D1 fixture and preview Wrangler config; never bundle the snapshot into the production Worker or use it as a runtime fallback.
3. Add a static-public generator that builds OpenNext, starts a local preview against the temporary D1, captures all canonical public routes, creates clean-path HTML assets, and emits `_redirects`, `_headers`, search data, 404, sitemap, robots, and ads.txt.
4. Configure Workers Static Assets with clean HTML handling, static 404 handling, and a narrow Worker-first allowlist for Admin/upload/media paths.
5. Replace public Next.js navigation with full-page anchors and add a client-side search page backed by a compact generated `/search-index.json` asset.
6. Make Guides pagination use static path URLs and generate every active pagination route; fail generation if an uncaptured category/tag pagination route would be required.
7. Add focused tests for snapshot safety, route completeness, static navigation, search privacy, routing configuration, and deployment-command sequencing.
8. Run targeted tests, typecheck, relevant lint, OpenNext build, local static acceptance, Wrangler startup check, and deployment dry run.
9. After local acceptance, deploy only the existing Worker and Static Assets, then run repeated production sitemap/user-agent sampling and live-tail validation. Roll back on any 503, 1102, public Worker execution, or D1 integrity change.

## Acceptance

- Every canonical public URL resolves to an exact Static Asset or approved static redirect.
- Public links do not issue Next.js server-navigation/RSC requests.
- Public search works without sending raw queries to GA4.
- Production D1 counts and digest remain unchanged.
- Repeated Googlebot and Mediapartners-Google sampling produces zero 503/1102 responses.
- Public requests do not execute the OpenNext Worker; Admin remains explicitly Worker-first.
- The existing Worker remains the only deployed hosting target.

# Budget Travel Compass AdSense Remediation Implementation Plan

Design: `docs/superpowers/specs/2026-11-10-budget-travel-compass-adsense-remediation-design.md`

## Execution boundary

- Local files and local validation only.
- No Cloudflare deploy, remote D1 command, AdSense/CMP change, email send, commit, or push.
- Preserve unrelated working-tree changes and edit overlapping files surgically.

## Tasks

1. Remove the site-specific subscription section and disabled contact form; repair the contact layout.
2. Update Privacy, Cookie, and Editorial policy content and validate external policy links.
3. Add `/guides` archive/detail routes, permanent `/news` redirects, and migrate every canonical/internal/sitemap/structured-data path to `/guides` with `Article` schema.
4. Add nullable `editorial_updated_at` migration and propagate `editorialUpdatedAt` through schema, repositories, admin input, metadata, JSON-LD, and sitemap without falling back to system `updatedAt`.
5. Build a deterministic source manifest from the 44 existing research directories, render verified source links, and report gaps without fabricating entries.
6. Prevent raw search query values from entering GA4 page-location data.
7. Add focused regression tests and update existing route/date expectations.
8. Run focused tests, typecheck, lint, build, existing relevant tests, and rendered desktop/mobile read-back.

## Acceptance

- No public newsletter/subscription UI or disabled contact form.
- Privacy links and advertising-cookie disclosures are correct.
- `/guides` is canonical; `/news` permanently redirects.
- Article pages emit `Article`; public modification dates use only `editorialUpdatedAt`.
- Verified research sources render as safe external links.
- Search analytics strips raw `q` values.
- No production or account state is changed.

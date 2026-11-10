# Budget Travel Compass AdSense Remediation Design

## Status

Approved for local implementation on 2026-11-10. Production deployment, remote D1 writes, AdSense account changes, and external-service activation are excluded from this implementation pass.

## Objective

Resolve every repository-controlled failure identified by the 2026-11-10 AdSense audit while preserving existing public URLs through permanent redirects and keeping unrelated working-tree changes untouched.

The remediation must leave the site locally verifiable as a completed editorial website rather than presenting disabled contact or subscription features. It must also separate editorial publication metadata from routine system updates, use a canonical evergreen-guide route and schema, expose only research-backed public sources, and describe analytics, advertising, AI assistance, and generated imagery accurately.

Account-controlled facts remain evidence requirements rather than claims made in code. These include applicant age, duplicate-account status, domain ownership, the AdSense Sites `Ready` state, Publisher ID ownership, ads.txt dashboard status, mailbox delivery, traffic quality, audience configuration, and Google-certified CMP activation.

## Chosen Approach

Use a compatibility-focused full remediation:

- Remove nonfunctional site features instead of leaving them disabled.
- Introduce `/guides` as the only canonical article route while permanently redirecting existing `/news` URLs.
- Add a nullable editorial update field without repurposing or rewriting the system update timestamp.
- Publish sources only when they can be traced to existing research records.
- Update site policies to match actual code and editorial production.
- Validate locally without deploying or mutating remote services.

Two alternatives were rejected:

1. A narrow form-and-policy patch would leave route, schema, date, source, and image-disclosure failures unresolved.
2. A full CMS redesign with first-class source, revision-history, and media-provenance entities would be broader than the AdSense remediation objective.

## Scope and Safety Boundaries

### Included

- Site-owned homepage, contact, legal, SEO, route, sitemap, article rendering, data model, migration, and test code.
- A local D1 migration that adds one nullable column.
- Research-ledger parsing or a generated source manifest derived from existing repository evidence.
- Local type checking, linting, production build, HTTP/HTML read-back, and responsive smoke checks.

### Excluded

- Production deployment or Cloudflare configuration changes.
- Remote D1 migration execution or content mutation.
- AdSense, Analytics, CMP, DNS, registrar, mailbox, or advertising-account changes.
- Inventing an operator identity, jurisdiction, source, image licence, consent state, Publisher ID, or approval result.
- Deleting unrelated files or modifying unrelated dirty-worktree changes.
- Removing shared newsletter capabilities from the reusable theme library.

The currently published ads.txt record is not changed during this work because its account ownership has not been verified. The older 2026-09-21 design contains a different Publisher ID and is not evidence for changing the current record.

## Page and Feature Changes

### Subscription removal

Budget Travel Compass will no longer expose a newsletter or subscription feature.

- Remove the site-specific homepage newsletter section, email field, button, accessible status message, and related site-specific styles.
- Remove all public `Newsletter`, `Subscribe`, `Join the journey`, and `coming soon` subscription copy from the Budget Travel Compass runtime.
- Do not modify the reusable theme library's generic newsletter component because it is not active site functionality and may serve other instances.
- Leave the currently unused image asset in place during this non-destructive pass. Orphan-asset cleanup requires separate authorization.

### Contact page

- Remove the disabled form and its preview note.
- Present the existing mailto address as the primary contact method.
- Preserve the site-specific list of acceptable contact topics and the honest no-guaranteed-response-time statement.
- Use a compact content layout that does not leave a blank form column.
- Do not claim that the mailbox has been tested; delivery remains an external evidence item.

## Privacy, Cookie, and Editorial Policies

### Privacy Policy

The advertising disclosure must explicitly state that:

- Third-party vendors, including Google, may use cookies to serve ads.
- Google and its partners may use advertising cookies based on a visitor's prior visits to this site or other sites.
- Other third-party vendors or ad networks may also use cookies, web beacons, IP addresses, device information, or similar identifiers when enabled.
- Visitors can manage personalized advertising through Google Ads Settings and any applicable vendor controls.
- Advertising is not currently enabled and the policy will be updated if the actual vendor set changes.

URLs must be rendered as links whose punctuation is outside the href. The Google Privacy URL must resolve without the current trailing-period 404.

### Cookie Policy

Add a distinct `Advertising Cookies` section that describes the prospective AdSense behavior without implying that ads or a CMP are currently active. Keep the existing GA4 disclosure aligned with the actual unconditional public analytics load. Explain that browser cookie controls are not a substitute for a consent-management platform.

State that personalized advertising for applicable EEA, United Kingdom, or Switzerland traffic requires a Google-certified CMP integrated with IAB TCF before such advertising is enabled. The policy must not claim that this has already been configured.

### Editorial Policy

Describe the actual editorial process:

- AI or other tools may assist with research organization, drafting, editing, formatting, or image generation.
- Tool output is not treated as evidence by itself.
- Publication requires editorial review for relevance, factual support, first-hand-claim accuracy, and source fit.
- Generated or illustrative imagery is not documentary proof of an event, place condition, product test, or personal experience.
- The site does not claim personal visits, tests, interviews, expert review, or professional credentials unless an article expressly establishes them.
- Substantive corrections and editorial updates follow the correction and date rules in this design.

## Canonical Guide Route Migration

### New canonical routes

- `/guides`
- `/guides/[slug]`

These routes render the existing guide archive and article detail experiences. All site-owned links, metadata, sitemap entries, structured data, breadcrumbs, category cards, search results, related guides, and publication-aware internal links use `/guides`.

### Legacy routes

- `/news` permanently redirects to `/guides`.
- `/news/[slug]` permanently redirects to `/guides/[slug]`.
- Redirects preserve only the canonical path. They must not create a second renderable article copy.
- Unknown slugs reached through the canonical guide route remain 404.
- The redirect implementation must use a true permanent HTTP redirect and be covered by tests.

### Canonical and structured data

- Article Canonical, Open Graph URL, BreadcrumbList URLs, `mainEntityOfPage`, internal links, and Sitemap URLs must agree on `/guides/[slug]`.
- Evergreen guides use Schema.org `Article`, not `NewsArticle`.
- The archive page is labelled `Travel Guides`; no user-facing `news` terminology remains for the evergreen corpus.

## Editorial Date Model

### Storage

Add nullable `editorial_updated_at` to the D1 `articles` table and the corresponding application types. Retain:

- `published_at`: the public first-publication date.
- `updated_at`: an internal system mutation timestamp.
- `editorial_updated_at`: an optional public date for a substantive editorial revision.

The migration only adds the nullable column. It does not backfill existing batch timestamps because the audit found two import-like timestamp clusters that cannot prove substantive revisions.

### Write behavior

- Creating or first publishing an article sets or preserves `published_at` according to the existing publication workflow.
- Routine save operations continue updating internal `updated_at`.
- Reordering, pinning, tag assignment, media association, migrations, imports, and deployment do not set `editorial_updated_at`.
- The article editing workflow exposes an explicit optional editorial-update date. A value is submitted only when the editor is recording a substantive revision.
- Clearing the field removes the public modified date without changing publication history.

### Read behavior

- Public article models expose `editorialUpdatedAt` separately from `updatedAt`.
- Open Graph `modifiedTime`, JSON-LD `dateModified`, Sitemap `lastmod`, and any visible updated label use only `editorialUpdatedAt`.
- There is no fallback from `editorialUpdatedAt` to `updatedAt` or `publishedAt` for `dateModified`.
- When `editorialUpdatedAt` is absent, the modified date is omitted.
- `datePublished` continues using only `publishedAt`.

## Public Source Data

### Evidence inputs

Existing `content-preparation/research/<content-id>/` records are the only accepted source inputs for this pass. Relevant evidence may include:

- `CLAIM_SOURCE_LEDGER.md`
- `RESEARCH_NOTES.md`
- other directly associated research files that provide an identifiable source title, publisher, and URL

### Generated manifest

A deterministic script builds a repository-owned article-source manifest keyed by canonical slug. It must:

- Map content IDs to canonical slugs using existing manifests rather than title guessing.
- Accept only valid HTTP or HTTPS source URLs.
- Deduplicate repeated sources within an article.
- Preserve source title and publisher when available.
- Reject placeholders, example URLs, malformed URLs, and repository-internal notes as public sources.
- Produce a gap report for articles that contain consequential factual claims but have no publishable source record.

The generated result is reviewable and stable. The renderer must not parse Markdown research files during a production request.

### Rendering

- Article pages with verified sources show a `Sources` section after the article body and before related guides.
- Each entry displays a human-readable title or organization and a clickable source URL.
- Source links use safe external-link attributes.
- Articles without verified sources do not display an empty or invented section.
- A missing manifest entry does not crash production; it remains a validation gap.

## Analytics and PII Safeguard

The site currently sends automatic GA4 page views while search terms appear in the `q` query parameter. The implementation must prevent arbitrary search text from being included in analytics page-location data.

Use a code-level safeguard rather than assuming an account-side setting:

- Configure the public analytics page view so the search query value is excluded or redacted before transmission.
- Preserve useful path-level analytics for `/search` without sending the visitor's entered term.
- Add a focused test for a search URL containing an email-like value.

This safeguard does not claim that historical Analytics data is clean or that account-side redaction is configured.

## Error Handling and Compatibility

- A missing source entry, missing optional editorial date, or old database row must render safely.
- Invalid guide slugs return 404 rather than redirecting to an archive or homepage.
- Existing development preview isolation remains intact.
- The application must tolerate `editorial_updated_at = null` in every public and admin query.
- Migration ordering must be explicit so new code is not deployed before the database can satisfy its queries. Production rollout is documented but not performed.
- No fallback may silently restore `/news` as a canonical URL or reuse `updated_at` as a public editorial timestamp.

## Testing and Acceptance

### Automated checks

- Redirect tests for `/news` and `/news/[slug]`.
- Canonical, Open Graph, BreadcrumbList, JSON-LD, internal-link, and Sitemap assertions for `/guides`.
- `Article` schema assertion and negative `NewsArticle` assertion.
- Date tests proving that system `updated_at` changes do not create `dateModified` or Sitemap `lastmod`.
- Migration and query tests for null and populated `editorial_updated_at`.
- Reading-time regression test based on article body.
- Source-manifest parser tests covering valid, duplicate, malformed, placeholder, and missing source cases.
- Policy-copy tests for required advertising-cookie concepts and valid external URLs.
- Search analytics test proving that an email-like `q` value is not transmitted.
- Negative scans for public newsletter/subscription UI and disabled contact forms.

### Repository validation

Run in this order:

1. Focused remediation tests.
2. `npm run typecheck`.
3. `npm run lint`.
4. `npm run build`.
5. Existing relevant sitemap, publication-link, content-contract, and acceptance tests.

### Rendered validation

Start the local production-compatible runtime and verify:

- Homepage, contact, privacy, cookie, editorial, guide archive, representative guide, category, search, robots.txt, sitemap.xml, and ads.txt.
- Legacy redirect status and destination.
- Canonical guide status, metadata, `Article` schema, source links, and date omission/presence.
- No `Newsletter`, `Subscribe`, `Join the journey`, subscription `coming soon`, or disabled contact form appears in rendered HTML.
- Google Privacy and Ads Settings links resolve appropriately.
- Desktop and mobile homepage, contact, guide archive, and article layouts have no overflow or broken empty regions.

## Production Rollout Plan — Not Executed in This Pass

When separately authorized, production rollout must occur in this order:

1. Confirm the authenticated Cloudflare account and exact Worker/D1 resources.
2. Back up or export the relevant D1 schema and article metadata.
3. Apply the additive D1 migration.
4. Verify the new nullable column remotely.
5. Deploy the Worker code.
6. Read back redirects, canonical guide pages, policies, robots, sitemap, ads.txt, and representative articles.
7. Re-crawl production URLs and verify no old `/news` canonical remains.
8. Separately confirm mailbox delivery, AdSense Publisher ID ownership, Sites `Ready` status, ads.txt dashboard state, CMP behavior by applicable geography, traffic quality, image rights, and Analytics/AdSense audience settings.

Failure at any production step stops the rollout. A local build or successful migration command is not sufficient evidence of production acceptance.

## Completion Criteria

Local implementation is complete only when:

- Both nonfunctional forms are absent from rendered pages.
- Subscription functionality is removed from the Budget Travel Compass site.
- Required privacy, cookie, editorial, AI, and generated-image disclosures are present and accurate.
- The broken Google Privacy link is fixed.
- `/guides` is canonical and `/news` permanently redirects.
- Evergreen pages use `Article` schema.
- Public modification dates come only from `editorial_updated_at`.
- Verified public sources render from a deterministic manifest, with gaps reported rather than fabricated.
- Search analytics does not transmit raw `q` values.
- Focused tests, type checking, linting, build, and rendered checks pass or any unrelated pre-existing failure is documented with evidence.
- No production or account state is changed.


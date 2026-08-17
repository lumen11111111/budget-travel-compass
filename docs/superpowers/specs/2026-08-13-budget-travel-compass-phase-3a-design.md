# Budget Travel Compass Phase 3A Design

## Objective

Convert the independent ContentForge site instance in `E:\BudgetTravelCompass` from the generated ContentForge Demo identity to the baseline production identity for Budget Travel Compass.

This phase changes only the site instance. It does not modify `E:\content-site-starter`, redesign the botanical-editorial theme, import production articles, initialize Git, or create or modify Cloudflare, D1, R2, email, domain, or GitHub resources.

## Brand Identity

- Site name: `Budget Travel Compass`
- Tagline: `Practical Guides for Affordable Independent Travel`
- Description: `Practical budget travel guides for young independent travelers. Plan affordable trips, find cheaper flights and stays, pack smarter, and travel with confidence.`
- Homepage SEO title: `Budget Travel Compass | Affordable Trip Planning Guides`
- Homepage SEO description: the site description above
- Editorial identity: `Budget Travel Compass Editorial`

The domain remains `example.com`, the canonical URL remains `https://example.com`, and existing example email addresses remain placeholders.

## Navigation and Categories

The public header contains only these category links, in this order:

1. Inspiration — `/category/inspiration`
2. Trip Planning — `/category/trip-planning`
3. Flights & Stays — `/category/flights-stays`
4. Budget Tips — `/category/budget-tips`
5. Packing & Gear — `/category/packing-gear`
6. Travel Styles — `/category/travel-styles`

The logo remains responsible for returning to the homepage. Search remains the theme's separate search action. About and Contact remain in footer site navigation. Home, About, Contact, and Latest Articles are not added to the primary navigation.

The seed category collection and `starter.site.json` category manifest use the same six names and slugs. These categories are a revisable information-architecture baseline, not a permanent taxonomy.

## Homepage Configuration

The existing botanical-editorial homepage layout and components remain unchanged. Instance-level labels are rewritten to neutral travel-editorial language, including labels such as Featured Guides, Explore Travel Topics, Latest Guides, Start Planning, and Travel Inspiration.

The existing homepage configuration keys remain intact for runtime compatibility. Their category slug values are remapped at the instance layer to the new category slugs. No Framework Core or Theme Library code is changed.

## Placeholder Content

All six existing seed article records are retained so the CMS and data shape continue to have placeholder fixtures.

Each record is converted to an explicitly named placeholder and set to `draft`. Titles, summaries, bodies, SEO fields, and category relationships are neutralized so they do not retain ContentForge Demo identity and do not pretend to be production travel articles. Because all placeholder articles are drafts, public article listings and article routes do not present them as published Budget Travel Compass content.

Placeholder tags may remain as neutral CMS fixtures if they do not make unsupported public content claims. Category IDs and article category references remain internally consistent.

## SEO Baseline

The public archive uses:

- Title: `Travel Guides`
- Description: `Browse practical guides for affordable independent travel, including trip planning, flights, stays, budgeting, packing, and travel styles.`

Search uses a Budget Travel Compass title and this description:

`Search Budget Travel Compass for practical trip planning, budget travel, flights, stays, packing, and independent travel guides.`

Default and social metadata use the supplied brand positioning without promising specific destinations, visas, live prices, or other content that does not yet exist.

## Identity and Legal Baseline

Required publisher, operator, team, and author fields use neutral brand-level identity rather than fictional people, companies, experts, credentials, or office locations.

Legal pages are not comprehensively rewritten in this phase. Instance legal configuration is minimally neutralized so public pages do not claim that the site currently uses Google Analytics, personalized advertising, affiliate programs, or configured Cloudflare production services. It also avoids fictional operator-country, company, expert, and address claims. Existing placeholder email addresses may remain because the user explicitly required infrastructure and email placeholders rather than real contact addresses.

## Manifest and Infrastructure Placeholders

`starter.site.json` is synchronized for site name, tagline, description, package name, theme name, navigation, categories, homepage module labels where applicable, and default author.

The following values remain placeholders and are not invented or provisioned: domain, production URL, GitHub repository, Cloudflare Worker name, D1 database name and ID, R2 bucket name, and email addresses.

## Theme Protection

`site.theme.json` remains:

```json
{
  "theme": "botanical-editorial",
  "version": "botanical-editorial-theme-v1"
}
```

The `botanical-*` CSS and component namespace remains unchanged. No visual redesign, theme rename, bulk CSS-class rename, or Theme Library modification is included.

## Validation

After implementation:

1. Run `npm run doctor`.
2. Run `npm run typecheck`.
3. Run the existing stable `npm run build` script.
4. Scan for ContentForge Demo identity and old editorial labels.
5. Classify residue as public runtime, instance configuration, Framework/test/fixture-only, or valid theme namespace.

Build-time warnings caused solely by intentionally unconfigured production infrastructure are recorded separately from command exit status. Framework or factory sanitization issues are documented but not fixed in `E:\content-site-starter`.

## Completion Boundary

Phase 3A is complete only when the instance identity, navigation, categories, homepage labels, placeholder visibility, SEO baseline, and minimal legal baseline meet this specification and doctor, typecheck, and build finish successfully.

The work stops after the Phase 3A report. It does not proceed to UI redesign, production content import, GitHub, Cloudflare, D1, R2, deployment, or a later legal-content phase.

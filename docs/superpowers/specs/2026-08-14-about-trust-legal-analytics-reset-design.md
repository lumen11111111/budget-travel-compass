# About, Trust, Legal Baseline and Analytics/Ads Reset

Date: 2026-08-14
Status: Implemented and validated

## Objective

Complete the public About, Contact, Editorial, Privacy, Cookie, Terms, Affiliate, Disclaimer, and DMCA/Copyright baseline for Budget Travel Compass. Reuse the established Full-Site Visual System, make all public claims match current capabilities, disable active analytics and advertising configuration without removing reusable architecture, and verify the result at runtime.

Only `E:\BudgetTravelCompass` may be changed. Do not modify `E:\content-site-starter`, Framework Core, or the `botanical-editorial` Theme Library. Do not configure Cloudflare, D1, R2, GitHub, a domain, or other production infrastructure.

## Architecture

Use the existing Instance-owned structure:

- `src/instance/site.config.ts` remains the single source of public identity and contact details.
- `src/instance/legal.config.ts` remains the single source of About/Contact/Legal copy.
- Existing App Router pages continue to resolve their content from Instance configuration.
- `src/components/public/legal-page.tsx` remains the shared legal-page renderer.
- `src/instance/inner-pages.css` owns the Budget Travel Compass inner-page visual treatment.
- Existing shared Header and Footer remain in use.

Do not migrate these pages into CMS content and do not alter the article content state.

## Contact Identity

Use `budgettravelcompass@gmail.com` as the configured public contact, support, privacy, copyright, and legal email until the user provides separate channels. The address may appear as a real `mailto:` link.

Keep the existing Contact form UI disabled because no submission backend is configured. State clearly that the form does not send submissions and direct readers to the email address. Do not promise a response time or service-level commitment.

## About Page

Route: `/about`

Title: `About Budget Travel Compass`

Hero line: `Travel smarter. Go further.`

Use existing Budget Travel Compass photography and the established inner-page visual system. Include:

1. What Budget Travel Compass Is
2. Who It Is For
3. Our Approach to Budget Travel
4. What We Cover
5. How We Create Our Guides
6. Editorial Independence
7. Explore the Guides, linking all six real categories

Describe the site as an independent editorial travel website. Explain that affordable travel means spending intentionally and understanding trade-offs between price, convenience, and experience. Guide creation may reference research, comparison, editorial review, public information, and practical planning principles.

Do not claim a founder biography, founding year, registered company, office, employee count, destinations personally visited, awards, certifications, professional financial expertise, named team members, testimonials, media mentions, or universal first-hand visits.

## Contact Page

Route: `/contact`

Title: `Get in touch`

Cover general questions, editorial feedback, corrections, content concerns, copyright issues, and partnership enquiries. Present the configured Gmail address. Keep the form disabled and visibly marked as unavailable until a backend is configured. Do not imply that Budget Travel Compass is a booking service or promise response times.

## Legal Shell

All seven policy pages use one Budget Travel Compass Legal Shell:

1. Breadcrumb
2. `LEGAL` eyebrow
3. Page title
4. Introductory summary
5. Desktop left legal navigation and right content
6. Mobile collapsed legal navigation and full-width content

Use Header and Footer on every page. Avoid a large photography hero. Existing subtle compass or route artwork may be used without generating new assets. Remove the current malformed `Legal 路` label.

Footer legal navigation must link only to these existing routes:

- `/privacy-policy`
- `/terms-of-service`
- `/cookie-policy`
- `/editorial-policy`
- `/affiliate-disclosure`
- `/disclaimer`
- `/dmca-copyright`

## Editorial Policy

Cover purpose, research and sourcing, accuracy, updates, editorial independence, corrections, and neutral use of tools. For mutable travel details such as airline policies, baggage rules, visa requirements, schedules, accommodation policies, entry requirements, costs, insurance, and safety information, advise checking official or reliable sources. Do not claim a fixed update schedule, formal corrections database, all-human authorship, or all-AI authorship.

## Privacy Policy

Reflect only current processing:

- normal hosting/server logs
- voluntarily supplied contact information
- essential technical operation
- security and legal compliance

State that Google Analytics, GA4, Google advertising, AdSense, newsletter submissions, and affiliate tracking are not enabled. Do not describe nonexistent analytics or advertising partners.

## Cookie Policy

Distinguish the public site from administrative authentication. State that the public site does not currently use non-essential analytics, advertising, or personalization cookies. Necessary technical or admin-session cookies may exist where required. Explain that the policy must be updated before optional services are enabled.

## Terms of Service

Cover informational purpose, acceptable use, intellectual property, third-party links, absence of a booking relationship, changing prices/availability/schedules/entry requirements, changes to content, reasonable limitation language, and contact/legal notices.

State that Budget Travel Compass is not an airline, hotel, travel agency, tour operator, or booking provider. Do not invent a governing jurisdiction or legal entity.

## Affiliate Disclosure

State that no affiliate program or active affiliate links are currently confirmed. Budget Travel Compass may use affiliate relationships in the future; if enabled, relevant relationships will be disclosed and commissions will not solely determine editorial conclusions. Do not claim current earnings or membership in any named program.

## Disclaimer

Explain that travel information changes and that content is for general informational and educational purposes. Readers should verify booking, visa, entry, health, safety, insurance, and financial decisions against official or qualified sources appropriate to their circumstances. Keep the language clear and proportionate.

## DMCA / Copyright

Cover site-content copyright, unauthorized reproduction, copyright-concern reporting, and the information needed for a takedown request. Use the configured Gmail address as the contact channel. Do not invent a legal entity, office address, or jurisdiction.

## Analytics Reset

Audit all project references for Google Analytics, GA4, Google tags, `gtag`, `googletagmanager`, public GA environment variables, measurement IDs, analytics components, scripts, configuration, legal copy, documentation, and tests.

Classify findings as:

1. Framework capability
2. Instance configuration
3. Active runtime script or request
4. Legal copy
5. Documentation/test-only reference

The Budget Travel Compass public runtime must render no Google Analytics component, load no `gtag.js`, request no `googletagmanager.com` resource, send no `page_view`, and contain zero active measurement IDs. Preserve reusable Framework capability if found; disable or unset only effective Instance configuration.

## Advertising Reset

Keep `adsEnabled` false and the AdSense publisher ID empty or unset. Preserve reusable advertising architecture, but render no AdSense script, ad slot, or advertisement placeholder.

Keep `public/ads.txt` as a truly empty zero-byte file. It must contain zero publisher records, comments, placeholders, or example values. Runtime verification must report `ads.txt records: 0`.

## Affiliate and Newsletter State

Affiliate program status is inactive. Legal copy must not claim existing commission income or active affiliate links.

Newsletter submission remains inactive. Keep the current disabled Homepage form and its honest unavailable status; do not claim a working backend.

## Responsive Design

Check About, Contact, and at least one representative Legal page at 390, 430, 768, 1024, 1440, and 1920 CSS pixels. Verify Header, hero/header region, body width, legal navigation, Footer, typography, artwork, mobile spacing, and absence of horizontal overflow.

## Validation

After implementation:

1. Run a focused source-residue audit and classify remaining matches.
2. Start or reuse the local development server.
3. Inspect Homepage, About, Contact, and a representative Legal page.
4. Inspect rendered HTML and browser network/runtime evidence for Analytics and AdSense activity.
5. Request `/ads.txt` and confirm an empty response with zero records.
6. Verify all Footer legal routes exist and do not return dead links.
7. Run `npm run doctor`, `npm run typecheck`, and `npm run build` sequentially.
8. Assert `0 Published`, `6 Draft placeholders`, active theme `botanical-editorial-theme-v1`, and no Framework or Theme Library changes.

## Completion Boundary

Stop after the implementation, runtime checks, responsive QA, validation, and final result report. Do not configure production infrastructure or enter another phase.

## Self-review

- No TBD, TODO, fake publisher, fake measurement ID, placeholder email, or unresolved copy decision remains.
- The user-provided Gmail address is the sole public contact channel.
- Disabled runtime behavior and reusable future capability are clearly separated.
- Page content makes no unsupported business, team, travel, commercial, or technology claims.
- The work remains Instance-scoped and does not require CMS, Framework, Theme Library, or infrastructure changes.

# Budget Travel Compass Phase 4 Homepage Design

## Objective and Boundary

Build a distinctive Modern Independent Travel Editorial homepage for Budget Travel Compass while preserving the ContentForge instance, CMS, repository layer, and botanical-editorial theme identity.

Phase 4 may change only the homepage, public header, public footer, homepage-specific instance components and styles, generated homepage assets, and narrowly required instance adapters. It must not change `E:\content-site-starter`, Framework Core, the botanical Theme Library, article/category/search/static/legal page design, CMS production state, Cloudflare, D1, R2, GitHub, or deployment configuration.

`site.theme.json` remains `botanical-editorial` at `botanical-editorial-theme-v1`. Existing `botanical-*` compatibility namespaces remain intact.

## Architecture

The current `src/app/page.tsx` mixes repository access, theme resolution, visual fallback logic, and two homepage render paths in one large file. The botanical Theme runtime contract cannot express the requested Journey Strips, route map, asymmetric featured composition, alternating journal feed, travel note, utility strip, and photographic final CTA without adding site-specific concepts to the reusable Theme Library.

Phase 4 therefore introduces an instance-owned homepage presentation layer:

- `src/instance/homepage/` owns the Budget Travel Compass homepage renderer, preview data, asset contract, and homepage CSS.
- `src/components/public/` owns the Budget Travel Compass public header and footer because those shells are shared across the public homepage composition but remain site-specific.
- `src/app/page.tsx` remains the route and metadata boundary. It reads repository data and identity settings, passes them to the instance homepage adapter, and does not contain the detailed visual composition.
- Existing repository functions remain the only production-content source. The adapter never writes to the CMS or seed data.

No Theme Library file is modified.

## Content-State and Preview-Data Contract

Production public content remains authoritative. Phase 4 must preserve exactly six draft placeholder articles and zero published articles.

Because a visual implementation needs stable editorial examples, `src/instance/homepage/preview-data.ts` provides clearly isolated, compile-time homepage preview stories for positions 01 through 07. These records:

- are not exported through the database or repository layer;
- cannot appear in archive, article, category, search, RSS, or sitemap routes;
- do not create routable fake article pages;
- use category links and CTA links only;
- are replaced position-by-position by suitable published repository articles when real published content becomes available.

The visual adapter produces a homepage story model with a source marker of `published` or `preview`. Published stories use their real title, excerpt, category, cover URL, slug, and dates. Preview stories use the isolated visual copy and generated local photography. Links for preview stories lead to the corresponding category rather than a nonexistent article page.

## Photography and Asset Contract

All site-specific assets live under `public/brand/budget-travel-compass/`. They are not written into `frontend-library/botanical-editorial`.

The implementation uses generated realistic editorial travel photography, not illustrations, geometric placeholders, gradients, or one composite screenshot sliced into strips. The planned photographic set is:

- Journey strips: seven independently replaceable vertical crops covering alpine lake, Mediterranean coast, Asian city street, desert canyon, forest lake, historic European street, and scenic rail or mountain road.
- Featured journeys: three landscape photographs covering a coastal destination, traveler in a local market, and solo traveler in a mountain landscape.
- Latest guides: four landscape/detail photographs covering tropical coast, practical carry-on packing, atmospheric city street, and budget road-trip landscape.
- Newsletter: one wide mountain-lake destination photograph with a traveler in context.

Generated files are appropriately sized WebP or JPEG assets with descriptive filenames. Decorative Journey Strip images use empty alt text. Story images use concise contextual alt text. The asset map is centralized so later R2 or `coverUrl` replacement does not require changing visual component structure.

Only the first visually critical hero assets receive eager loading or high priority. Below-fold images use responsive sizes and lazy loading. Seven full-resolution originals are not all preloaded.

## Header

The public header is approximately 72px tall on desktop with deep navy `#0B2533`. It contains:

- a restrained compass mark built with the existing icon system or CSS line treatment;
- a two-line `BUDGET TRAVEL COMPASS` wordmark linked to `/`;
- the six existing primary category links;
- a standalone search control.

There are no Home, About, Contact, or Latest Articles links in desktop primary navigation. The header has no gradient, glass effect, floating capsule, or pill navigation.

At mobile widths, desktop navigation is replaced by a compact logo, search control, and menu button. The accessible menu exposes all six categories plus About and Contact in a secondary group. It supports keyboard use, focus visibility, escape/close behavior where applicable, 44px targets, and scroll-safe open state.

## Journey Strips Hero

Desktop uses a two-column hero: approximately 56% Journey Strips photography and 44% deep-navy copy panel.

Seven vertical photographs sit edge-to-edge with 2px visual separators. Their widths and crop positions vary slightly while the overall lower edge remains stable. Hovering or keyboard focusing a strip expands it modestly while siblings contract. Flex-basis animation is bounded, does not autoplay, and is disabled under `prefers-reduced-motion`.

The copy panel contains the eyebrow, `Travel further.` and teal `Spend smarter.` H1 treatment, a restrained orange route underline, supplied supporting copy, and a rectangular teal `START PLANNING` CTA linking to `/category/trip-planning`. Low-opacity contour and compass motifs may be rendered as decorative CSS or inline SVG line work; they never replace photography.

Mobile uses a purpose-built composition: compact header, seven Journey Strips, then a separate deep-navy copy panel. All seven strips remain visible without horizontal overflow or carousel behavior. Strip widths are viewport-derived and height stays between approximately 190px and 240px.

## Explore Your Route

Six linked category nodes form an itinerary line rather than a card grid. Desktop places them across one horizontal route with small dashed/dotted connectors. Mobile uses two rows of three nodes with connecting route segments.

Icons are sourced from the existing Lucide system: mountain, map, plane, wallet or savings, backpack, and compass. Node accents use teal, orange, blue, gold, green, and muted slate-purple while maintaining restrained editorial color balance.

## Featured Journeys

The section uses a 60/40 asymmetric composition on desktop: one large photographic story on the left and two smaller stacked stories on the right. Photo overlays carry editorial numbers 01–03, category, title, and read time. Radius remains 4–8px with no generic floating-card treatment or heavy shadows.

Mobile retains hierarchy: story 01 remains a full-width photographic feature; 02 and 03 become compact horizontal story rows rather than identical large cards.

## Latest Guides and Travel Note

Latest Guides uses story positions 04–07 in a journal-feed rhythm. At desktop sizes rows alternate image-left/content-right and content-left/image-right. Rows use white surfaces, subtle dividers, consistent image proportions, colored editorial numbers, category, read time, title, excerpt, and `READ GUIDE` link.

The Budget Travel Note is inserted into the feed rhythm as a cool-white note element with a one-to-two-degree rotation, restrained stamp/compass line motif, and the supplied quotation. It is not a beige page background or scrapbook system.

Mobile stacks story content into a readable number/category, image, title, excerpt, and link sequence, with only subtle alternating alignment differences and no horizontal overflow.

## Plan Smart, Travel Easy

A compact deep-navy utility strip follows the journal feed. It contains the two-line brand statement and five concise tips with existing line icons. Desktop presents five columns; mobile uses a compact two-column grid with the final item spanning cleanly where needed. It does not masquerade as article content.

## Newsletter and Final CTA

A wide generated mountain-lake photograph with dark overlay forms the pre-footer CTA. It contains `More adventures. Better travel.`, supplied supporting copy, an email field, and `JOIN THE JOURNEY` button.

There is no third-party email integration. The form is explicitly non-functional preview UI: submission is prevented or the controls are disabled with honest accessible labeling. It does not claim successful subscription behavior.

Mobile stacks the title, description, field, and button vertically with at least 44px controls.

## Footer

The public footer uses deep navy and contains:

- compass mark, brand name, and tagline;
- Explore links for all six categories;
- About Us and Contact links;
- all existing legal routes;
- a restrained low-opacity compass watermark;
- copyright and brand-level legal identity without a fictional location.

No social account links are shown because no legitimate social URLs exist.

## Typography and Color

The design uses the existing sans stack for UI and body text. Editorial headings use a high-quality local system serif stack rather than adding a fragile external font dependency. The visual direction is editorial and approachable rather than luxury-fashion styling.

Core colors:

- background: `#FFFFFF` and `#F8FAFB`;
- deep navy: `#0B2533`;
- dark ink: `#14252D`;
- teal: `#54A7AE`;
- travel orange: `#E86E32`;
- supporting green: `#697D5A`;
- supporting blue: `#5C88B2`;
- supporting gold: `#D9A637`.

No beige/cream main background, blue-purple gradient, neon, glassmorphism, pervasive pills, oversized radii, or identical three-column card grids are introduced.

## Responsive Requirements

Dedicated screenshot QA is required at:

- 390px: seven strips visible, two-by-three route, compact featured hierarchy, stacked journal feed, two-column utility tips, stacked CTA, accordion-style mobile footer/navigation without overflow.
- 430px: the same mobile architecture with improved breathing room and no accidental tablet transition.
- 768px: tablet-specific spacing, stable header/menu behavior, two-column opportunities only where readability allows, and preserved photographic hierarchy.
- 1024px: desktop composition activates without cramped navigation or clipped copy.
- 1440px: primary reference composition and section proportions.
- 1920px: bounded content width, deliberate edge treatment, no over-stretched typography or photography.

Desktop media rules are protected from mobile overrides. The page must have no horizontal overflow, text clipping, overlapping controls, giant blank areas, or image aspect-ratio shifts.

## Accessibility

- Semantic order is one H1 followed by section H2 headings and story H3 headings.
- All category and story interactions are keyboard accessible with visible focus.
- Menu controls expose accessible names and state.
- Decorative collage and route motifs are hidden from assistive technology.
- Meaningful images receive concise alt text.
- Text overlays meet contrast requirements.
- Touch controls are at least 44px.
- Motion is disabled or reduced under `prefers-reduced-motion`.

## Validation and Completion

Implementation validation includes:

1. Start the local development server and verify the rendered homepage rather than relying on HTTP status alone.
2. Capture and inspect screenshots at 390, 430, 768, 1024, 1440, and 1920 widths.
3. Inspect browser console errors and horizontal overflow.
4. Run `npm run doctor`, `npm run typecheck`, and `npm run build` sequentially.
5. Assert six draft placeholders and zero published seed articles.
6. Verify `site.theme.json` and theme version remain unchanged.
7. Scan source and generated output for old Demo identity, old generic homepage labels, and conflicting botanical visual copy while preserving legitimate `botanical-*` namespaces.

The final report documents files, architecture, every requested section, responsive QA for all six widths, photography strategy, accessibility, performance, content state, validation, Framework limitations, and remaining visual issues.

Phase 4 stops after that report. It does not proceed to article, category, search, About, Legal, CMS-content, infrastructure, deployment, or Phase 5 work.

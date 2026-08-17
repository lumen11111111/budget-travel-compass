# Explore Your Route Vertical Spacing Refinement

Date: 2026-08-14
Status: Implemented and validated

## Scope

Adjust only the Homepage `EXPLORE YOUR ROUTE` section in the Budget Travel Compass Instance. The change replaces the earlier compact vertical-spacing direction. Preserve the existing route line treatment, functional icons, node styling, label typography, links, content, and overall Homepage structure. Do not modify Framework, Theme Library, CMS, Utility Strip, or other sections.

## Layout Responsibility

The Route section owns all whitespace between the Hero and Featured Journeys. Do not add margins to the Hero or Featured Journeys and do not add a divider. This keeps the spacing intentional, isolated, and easy to tune without affecting neighboring components.

The section heading moves above the route map and aligns with the content-left edge used by `FEATURED JOURNEYS` and `LATEST GUIDES`. The previous independent left-side heading column is removed.

## Approved Spacing

### Desktop, 1440px reference

- Section top padding: 64px.
- Heading-to-route gap: 32px.
- Route-to-section-bottom padding: 64px.
- The resulting whitespace should establish the Route as a distinct editorial transition without making it appear detached from the page.

### Large desktop, 1920px

- Section top and bottom padding: 76px.
- Preserve the existing limited content container so route nodes do not spread indefinitely.
- Preserve a compact 32px heading-to-route gap.

### Narrow desktop, 1024px

- Section top padding: 52px.
- Heading-to-route gap: 28px.
- Section bottom padding: 56px.
- Keep six route nodes on one line when the available width supports them without clipping.

### Tablet, 768px

- Section top and bottom padding: 48px.
- Heading-to-route gap: 24px.
- Arrange route nodes in a compact three-column by two-row grid.

### Mobile, 390px and 430px

- Section top padding: 42px.
- Heading-to-route gap: 24px.
- Section bottom padding: 46px.
- Preserve the compact three-column by two-row route grid.

## Route Internals

- Keep the icon-to-label gap at 10px, within the requested 10–13px range.
- Do not increase node height, line spacing, or label spacing as a side effect of increasing section padding.
- Preserve route continuity and existing icon and label styles.
- Responsive line artwork may adapt only as already required by the existing one-row and two-row structures.

## Responsive CSS Strategy

- Make `.btc-route-section` a single-column grid at all widths.
- Use explicit breakpoint values for the six required QA widths instead of one broad fluid formula.
- Keep the default desktop values targeted at 1440px.
- Apply the existing large-screen breakpoint for 1920px spacing.
- Apply narrower desktop values within the current `max-width: 1180px` range.
- Apply the three-column route grid and tablet spacing at `max-width: 920px`.
- Apply the mobile values at `max-width: 760px`.
- Keep the heading left-aligned at every width.

## Validation

Check 390, 430, 768, 1024, 1440, and 1920 CSS-pixel widths. At each width verify:

- The Hero-to-Route and Route-to-Featured transitions have visible editorial breathing room.
- The heading shares the correct left edge with other section headings.
- Route nodes remain internally compact and visually connected.
- No large empty void, clipping, horizontal overflow, or unintended change appears elsewhere.
- The 768px and mobile route maps are three columns by two rows.

Run `npm run typecheck` and `npm run build` sequentially after implementation.

## Self-review

- No placeholders, unresolved decisions, or contradictory spacing values remain.
- The Route section is the sole owner of the new whitespace.
- The layout behavior is explicit for every required QA width.
- External section whitespace and internal route spacing are clearly separated.
- The scope is limited to one existing Instance stylesheet; no JSX change is required.

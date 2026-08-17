# Utility Strip Typography and Alignment Refinement

Date: 2026-08-14
Status: Implemented and validated

## Scope

Adjust only the Homepage `PLAN SMART, TRAVEL EASY` utility strip in the Budget Travel Compass Instance. Preserve its five existing artwork assets, copy, navy treatment, separators, and responsive content structure. Do not modify Framework, Theme Library, CMS, or any other Homepage section.

## Approved Direction

- Use the existing sans-serif family throughout the strip; no serif typography.
- Render the statement as exactly two controlled lines: `PLAN SMART,` and `TRAVEL EASY`.
- Desktop statement token: 20px, weight 700, line-height 1.1, letter-spacing 0.018em.
- Desktop tip-title token: 15px, weight 600, line-height 1.24.
- Desktop supporting token: 12px, weight 400, line-height 1.4, white at 76% opacity.
- Keep the existing artwork files and display them at 40px on desktop and 38px on mobile.
- Give the statement approximately 19% of the desktop strip, with a safe minimum width so 1024px does not force extra line wrapping.
- Keep five equal centered tip columns on desktop. Use a consistent title minimum height to align supporting-copy baselines.
- Keep separators at low contrast within the requested 12–18% range.
- Keep the 1440px strip compact, targeting approximately 140px and remaining within 125–155px.

## Responsive Behavior

- At 920px and below, place the statement above the tip grid.
- At 768px, retain five tip columns when they fit without clipping; the statement remains exactly two lines.
- At 390px and 430px, preserve the existing two-column tip grid with the fifth item spanning both columns.
- Mobile statement token: 18px, weight 700.
- Mobile tip-title token: 14px, weight 600.
- Mobile supporting token: 12px, weight 400.
- Mobile cards must remain compact and free of clipping or horizontal overflow.

## Validation

- Visual QA at 390, 430, 768, 1024, 1440, and 1920 CSS pixels.
- Confirm the statement is exactly two lines at every width.
- Confirm all titles and supporting lines share their respective tokens and baselines.
- Confirm icons remain sharp, unchanged as assets, and vertically aligned.
- Confirm no clipping, horizontal overflow, cramped 1024px layout, or excessive mobile height.
- Run `npm run typecheck` and `npm run build` sequentially.

## Self-review

- All typography and sizing decisions are explicit.
- The fixed line break is semantic and responsive-safe.
- The desktop minimum width protects the statement without changing the wider page layout.
- The work is limited to the existing Instance component and its stylesheet.
- No image generation, CMS work, Framework/Theme edits, or next-phase work is included.

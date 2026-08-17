# Homepage Card 04 Image Fix

## Goal

Restore the missing image in homepage Latest Guides card 04. The card must display the existing tropical-coast asset configured in `preview-data.ts`.

## Scope

- Keep the current card order, alternating desktop layout, copy, routes, dimensions, and responsive behavior.
- Do not change cards 05–07 or unrelated homepage sections.
- Do not replace or regenerate the existing image asset.

## Approach

Trace card 04 from `buildHomepageStories()` through `JournalStory` to the rendered image request. Fix the narrowest verified cause of the failed or hidden image while preserving the existing component and layout structure.

If the issue is specific to Next.js image optimization for this asset, align card 04 with the repository's established local-brand-asset rendering behavior instead of adding a new fallback system.

## Verification

- Card 04 visibly shows `latest-tropical-coast.webp` on desktop.
- The image remains visible at the mobile breakpoint.
- Cards 05–07 and the alternating layout remain unchanged.
- The page has no new image-loading or browser-console errors.
- Run the relevant TypeScript/build validation after the edit.

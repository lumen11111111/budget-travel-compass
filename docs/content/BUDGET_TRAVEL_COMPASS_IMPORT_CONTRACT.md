# Budget Travel Compass — Import Contract

Status: **APPROVED CONTRACT FOR FUTURE IMPORT PREPARATION — NO IMPORT FILES CREATED**  
Scope: deterministic authority mapping for the 44-article approved corpus.  
Boundary: this document does not authorize Import, Publish, Seed, CMS schema changes, D1/R2/Cloudflare work, route creation, or website changes.

## 1. Authority order

Every field has one authority. Import Preparation must fail closed when a required authority is missing or conflicts with a lower-level representation; it must not select “whichever value is present.”

| Contract field | Deterministic authority | Consistency check | CMS treatment |
|---|---|---|---|
| Content ID | Research Package directory name `content-preparation/research/BTC-NNN/`, confirmed against the matching Manifest row | Any frontmatter `content_id`, report row, or package heading must match; absence in frontmatter is allowed | **EDITORIAL-ONLY**; do not add a CMS column |
| Production Title | `docs/content/BUDGET_TRAVEL_COMPASS_PRODUCTION_CONTENT_MANIFEST.md` | Draft frontmatter `production_title` or `title` and the leading H1 must equal the Manifest Production Title | CMS `articles.title` |
| Slug | Production Manifest canonical slug | Draft frontmatter `slug` must equal the Manifest; uniqueness, lowercase and hyphen validation are mandatory | CMS `articles.slug` |
| Category | Production Manifest primary category | Draft frontmatter `category`, when present, must match; map the exact category name to the existing category slug table below | CMS `articles.category_id` through existing category slug; no category creation |
| Cluster | Production Manifest cluster | Draft frontmatter `cluster`, when present, must match | **EDITORIAL-ONLY**; do not use Tags or add a CMS column |
| Role | Production Manifest role | Eligibility Matrix role must match | **EDITORIAL-ONLY**; do not add a CMS column |
| SEO Title | Final `seo_title` in the matching `ARTICLE_DRAFT.md` frontmatter | Must be present, accurate, and unique across the 44-article corpus | CMS `articles.seo_title` |
| Meta Description | Final `meta_description` in the matching `ARTICLE_DRAFT.md` frontmatter | Must be present and accurately bounded by the body | CMS `articles.seo_description` |
| Excerpt | Final `excerpt` in the matching `ARTICLE_DRAFT.md` frontmatter | Must be present, distinct from Meta Description, and not broaden the promise | CMS `articles.summary` |
| Freshness | `docs/content/BUDGET_TRAVEL_COMPASS_FRESHNESS_REGISTER.md` | Article ID and risk level must resolve; publication recheck gates remain active | **EDITORIAL-ONLY**; never expose the register as public copy or add a CMS column |
| Body | Matching `ARTICLE_DRAFT.md` after its YAML frontmatter | Strip the leading H1 during future Markdown-to-HTML conversion because CMS renders `articles.title` as the page H1; retain all subsequent article content and Source notes unless a later approved editorial pass says otherwise | CMS `articles.body_html` |
| Planned Internal Links | `docs/content/BUDGET_TRAVEL_COMPASS_INTERNAL_LINK_PLAN.md` | Resolve only against real imported routes in Pass 2; no guessed or future-hub URL may be emitted | Pass 1: none generated. Pass 2: body links only after route validation |
| Status | `docs/content/BUDGET_TRAVEL_COMPASS_IMPORT_ELIGIBILITY_MATRIX.md` controls eligibility; the future import operation supplies the CMS state | Only `ELIGIBLE` articles may enter Import Preparation; eligibility never authorizes publication | CMS `articles.status` must be `draft` for Pass 1 |

## 2. Existing category mapping

The future importer must use these existing category records and must not create or rename categories:

| Editorial category | Existing CMS category slug |
|---|---|
| Inspiration | `inspiration` |
| Trip Planning | `trip-planning` |
| Flights & Stays | `flights-stays` |
| Budget Tips | `budget-tips` |
| Packing & Gear | `packing-gear` |
| Travel Styles | `travel-styles` |

## 3. Metadata compatibility rules

Research Packages currently use two accepted editorial frontmatter shapes:

- `title` identifies the Production Title; or
- `production_title` identifies the Production Title, with `content_id` optionally present.

This variation does not change field authority. Import Preparation reads the Manifest first, locates the package by Content ID, and then requires the relevant draft field to equal the Manifest value. It must not rewrite all 44 frontmatter blocks merely to normalize syntax.

Required draft metadata for every article is:

- Production Title represented by `title` or `production_title`;
- `slug`;
- `seo_title`;
- `meta_description`;
- `excerpt`.

`category` and `cluster` may be recorded in the draft for editorial readability, but the Manifest remains authoritative. An omitted draft category or cluster is not permission to infer a different value.

## 4. Two-pass internal-link contract

### Pass 1 — Draft routes

- Import all authorized articles as `draft` only.
- Stabilize every actual article route and verify canonical slug equality.
- Do not generate planned article links or cluster-hub links.
- Do not implement `/cluster/short-breaks/` or `/cluster/experience-led-travel/` from this contract.

### Pass 2 — Resolved links

- Read the Final Internal Link Plan only after all target articles have real imported routes.
- Resolve each planned article edge to the actual route generated from the canonical slug.
- Treat `/cluster/experience-led-travel/` → BTC-017, BTC-018 and BTC-019 as a locked planning contract, not an existing route.
- Retain `/cluster/short-breaks/` as a planned hub contract only.
- Fail a link row rather than emitting a guessed, missing, redirected, or unpublished target.

## 5. Freshness and publication gates

The Freshness Register is an internal editorial control. It is not imported as article copy, taxonomy, tags, or CMS metadata. Before any later publication decision, the responsible editor must execute the listed rechecks and update or remove claims that no longer match current primary evidence.

`ELIGIBLE` means only that an article may enter Draft Import Preparation. It does not mean ready to publish. All future imports remain draft until a separate publication gate is explicitly approved.

## 6. Fail-closed conditions

Import Preparation must stop for an article when any of the following is true:

- package Content ID cannot resolve exactly one Manifest row;
- Production Title, slug or Category conflicts with the Manifest;
- SEO Title, Meta Description or Excerpt is missing;
- slug is duplicated, malformed or differs from the Manifest;
- Eligibility Matrix is not `ELIGIBLE`;
- Body is missing;
- a Pass 2 link target does not resolve to a verified imported route;
- a required freshness recheck is incomplete at the later publication gate.

This contract changes no CMS schema and creates no import artifact.

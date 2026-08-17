# Budget Travel Compass — Corpus Final Fix Backlog

Status: **ALL PHASE 5 ITEMS CLOSED — READY FOR IMPORT PREPARATION**  
Publication boundary: **NOT READY FOR PUBLICATION**  
Scope rule: only the approved Phase 5 minimum changes were made; no import file, CMS record, route or production resource was created.

## Required fixes

| Status | Priority | Type | IDs / file | Closure evidence |
|---|---|---|---|---|
| CLOSED | P0 | METADATA FIX | BTC-016–020, 026, 028, 029 | 44/44 drafts contain Production Title, Slug, SEO Title, Meta Description and Excerpt; exact Meta/Excerpt copies: 0. |
| CLOSED | P0 | METADATA / SLUG FIX | BTC-039, BTC-045 | Manifest and drafts agree on `pack-for-long-trip` and `plan-solo-weekend-city-break`; duplicate or malformed slugs: 0. |
| CLOSED | P0 | RESEARCH FIX | BTC-002, 005, 016–019, 025, 026, 029, 041, 043 | All 11 Ledgers directly map sourced consequential claims to URL, source type, access/publication date, freshness and limitations; affected URLs revalidated. |
| CLOSED | P0 | ARCHITECTURE FIX | Content Architecture | Packing & Gear = 7; Travel Styles = 8; Accommodation Decisions uses BTC-001 accessible lodging. |
| CLOSED | P1 | METADATA FIX | BTC-023 | Excerpt now uses “Identify”; non-clinical boundary retained. |
| CLOSED | P1 | EDITORIAL FIX | BTC-036 | Expanded to 676 words with load domains, observable signals, early intervention, reduction ladder and BTC-020/037/038/040 handoffs; Editorial QA records LENGTH_OK. |
| CLOSED | P1 | EDITORIAL FIX | BTC-004, 020, 021, 023, 025, 027, 030, 036, 037, 041, 043 | All 11 openings now enter through a concrete task, scene, dependency, constraint or reader goal; semantic all-corpus scan found no repeated opening sentence. |
| CLOSED | P1 | INTERNAL LINK FIX | BTC-017, 019, 028, 040; hub plans | Four generic BTC-035 edges removed; `/cluster/experience-led-travel/`→017/018/019 locked as a planning contract; true orphans: 0 with planned hubs. |
| CLOSED | P1 | IMPORT CONTRACT | all packages | `BUDGET_TRAVEL_COMPASS_IMPORT_CONTRACT.md` defines one fail-closed authority for every field without normalizing all frontmatter or changing CMS schema. |

## Non-blocking review items

- Preserve BTC-022 as canonical capsule/outfit method and BTC-039 as long-trip reset/replenishment method.
- Preserve BTC-029 as generic city-break time/geography planner and BTC-045 as bounded solo test-trip execution.
- Keep BTC-014 and BTC-045 at zero sources unless a current factual example is introduced; do not add decorative citations.
- Treat all monetization candidates as `FUTURE MONETIZATION CANDIDATE` only.
- Keep every Content Gap item `BACKLOG_ONLY`.

## Required revalidation after fixes

1. Corpus integrity, metadata completeness, duplicate title/slug and Manifest/draft equality.
2. Claim-Ledger URL presence and URL health for changed rows.
3. BTC-036 intent/depth and sibling-boundary review.
4. Intro semantic-pattern scan on all 44 drafts.
5. Internal article/hub graph and BTC-035 link-quality review.
6. CMS assertion: 0 Published, 6 Draft placeholders.

All Phase 5 P0 and applicable P1 items pass. Draft Import Preparation may begin only under a separately authorized phase; publication remains unauthorized.

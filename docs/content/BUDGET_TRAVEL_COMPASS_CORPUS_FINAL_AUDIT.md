# Budget Travel Compass — Corpus Final Editorial Audit

Date: 14 August 2026  
Scope: 44 production research packages  
Audit state: **CORPUS NEEDS FINAL FIXES**  
Publication state: **NOT READY FOR PUBLICATION**

## 1. Executive decision

The 44-article corpus is coherent enough to retain the approved six-category architecture, all 44 commissioned search intents, and all current production articles. No article requires exclusion or merge, no HIGH search-intent collision was found, and no source URL tested as broken.

The corpus is **not yet ready for Import Preparation** because the final import contract is not metadata-complete or fully research-traceable:

1. BTC-016, 017, 018, 019, 020, 026, 028 and 029 lack SEO Title and Excerpt.
2. BTC-039 and BTC-045 use draft slugs that conflict with the approved Manifest.
3. Eleven Claim Ledgers cite source names while the corresponding URLs exist only in Research Notes; Editorial Standard v1 requires URL-level claim mapping.
4. BTC-023's excerpt uses “Diagnose” for a non-medical gear decision and needs a metadata wording change.
5. Negative/contrast openings occur at corpus scale. A minimum targeted copyedit is needed to break the repeated rhetorical signature without removing necessary safety and scope limitations.
6. BTC-036 is a 315-word Pillar whose utility is present but whose search-intent explanation is compressed enough to require editorial depth review.
7. The Architecture document has two count labels and one cluster-member label inconsistent with the Manifest.

These are bounded final fixes. No new article, category or merge is recommended.

## 2. Corpus integrity

| Assertion | Required | Actual | Result |
|---|---:|---:|---|
| Original topics | 45 | 45 | PASS |
| Merged topics | 1 | 1 | PASS |
| Production articles | 44 | 44 | PASS |
| Research Packages | 44 | 44 | PASS |
| ARTICLE_DRAFT | 44 | 44 | PASS |
| RESEARCH_NOTES | 44 | 44 | PASS |
| CLAIM_SOURCE_LEDGER | 44 | 44 | PASS |
| EDITORIAL_QA | 44 | 44 | PASS |

BTC-003 has no independent production package and remains merged into BTC-004. There is no missing article, duplicate package ID, duplicate production title, duplicate draft slug, orphan package or extra production package.

Two draft-to-Manifest slug conflicts are not duplicate slugs, but must be resolved before import:

- BTC-039: Manifest `pack-for-long-trip`; draft `pack-long-trip-without-packing-more`.
- BTC-045: Manifest `plan-solo-weekend-city-break`; draft `solo-weekend-city-break`.

## 3. Status normalization

Historical Pilot/Batch statuses were treated as evidence of completed human gates, not as Import eligibility.

| Corpus-level recommendation | Articles | Count |
|---|---|---:|
| CORPUS_APPROVED | BTC-001, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 022, 024, 031, 032, 033, 034, 035, 038, 040, 042, 044 | 22 |
| CORPUS_NEEDS_METADATA_FIX | BTC-020, 023, 028, 039, 045 | 5 |
| CORPUS_NEEDS_EDITORIAL_FIX | BTC-004, 021, 027, 030, 036, 037 | 6 |
| CORPUS_NEEDS_RESEARCH_FIX | BTC-002, 005, 016, 017, 018, 019, 025, 026, 029, 041, 043 | 11 |
| CORPUS_NEEDS_ARCHITECTURE_FIX | none at article level | 0 |

`CORPUS_APPROVED` means the article can enter Draft Import Preparation after the corpus-level fixes are closed; it does not mean published.

## 4. Category audit and distribution

| Category | Definition / boundary result | Actual | Required | Result |
|---|---|---:|---:|---|
| Inspiration | Trip idea or experience before execution; distinct from audience/mode | 5 | 5 | PASS |
| Trip Planning | Execution sequence and resilience; distinct from money and product comparison | 7 | 7 | PASS |
| Flights & Stays | Flight/accommodation search, comparison and verification | 11 | 11 | PASS |
| Budget Tips | Funding, allocation and total-cost reduction | 6 | 6 | PASS |
| Packing & Gear | Carrying and organizing systems; current carrier rules remain sourced dependencies | 7 | 7 | PASS |
| Travel Styles | Defined audience or durable mode/rhythm of travel | 8 | 8 | PASS |
| **Total** | | **44** | **44** | **PASS** |

Boundary retest:

- Trip Planning vs Budget Tips: BTC-035/038 answer “how much/where does money go”; BTC-027/029/030/040 answer “what sequence or fallback should I use.” Clear.
- Trip Planning vs Flights & Stays: BTC-011–015 end in a fare/airport decision; BTC-027/030 use flights or stays as dependencies inside a trip workflow. Clear.
- Inspiration vs Travel Styles: BTC-016–020 begin with experience choice; BTC-004/005/036/037/042–045 are audience- or mode-specific. Clear.

Documentation fixes: Architecture headings say `Packing & Gear (6)` and `Travel Styles (9)` although their listed entries and Manifest correctly resolve to 7 and 8. The Accommodation Decisions cluster row says “BTC-005 accessible lodging”; the intended member is BTC-001, while BTC-005 remains a cross-cluster senior city-planning support article.

## 5. Cluster / Pillar relationship map

| Cluster | Pillar / hub | Supporting articles | Cross-cluster dependencies | Result |
|---|---|---|---|---|
| Affordable Flights | BTC-013 | 011, 012, 014, 015 | 022, 030, 035; future airport-city guide | PASS |
| Accommodation Decisions | BTC-007 | 001, 006, 008, 009, 010 | 004, 025, 028, 029, 041, 043 | PASS after label correction |
| Family, Senior & Accessible | BTC-004 | 001, 002, 005 | Accommodation, Packing, Short Breaks | PASS |
| Short Breaks & Microtrips | non-article hub | 016, 018, 020, 029, 033, 035, 045; 019 as cross-member | Accommodation, budgets, solo, rhythm | PASS; hub required |
| Packing Systems | BTC-022 | 002, 021, 023, 024, 039 | 011, 025, 030, 038, 040 | PASS; monitor 022/039 |
| Travel Technology | BTC-026 | 025; 012 and 037 as cross-members | Flights, accommodation, rhythm | PASS |
| Group Trip Planning | BTC-028 | 006, 031 | Accommodation and budgets | PASS |
| Solo Female Travel | BTC-042 | 010, 041, 043, 044, 045 | Accommodation and Short Breaks | PASS; monitor 029/045 |
| Saving & Trip Budgets | BTC-035 | 032, 033, 034; 031/038 cross-members | Flights, Group, Rhythm | PASS with narrow-pillar caution |
| Sustainable Travel Rhythm | BTC-036 | 037, 038, 040; 020 cross-member | Tech, Packing, Short Breaks | REVIEW BTC-036 depth |
| First-Trip Planning & Resilience | BTC-027 | 030, 041 | Solo, weather, budget, future insurance/visa | PASS |
| Experience-Led Budget Travel | non-article hub | 017, 018, 019 | Short Breaks, budgets, accommodation | PASS; hub required |

No two competing pillars were found. The two non-article hubs are legitimate editorial navigation objects and should not be replaced with forced articles.

## 6. Search Intent Collision Matrix

| Pair / set | Shared surface | Distinguishing reader outcome | Risk |
|---|---|---|---|
| BTC-022 / BTC-039 | clothing quantity, laundry cycle | capsule/outfit compatibility vs long-trip reset interval and replenishment | MEDIUM |
| BTC-029 / BTC-045 | compact city break planning | generic three-day usable-hours plan vs two-night first-solo execution | MEDIUM |
| BTC-013 / BTC-015 | date flexibility | normalized fare search vs destination-specific seasonal value window | LOW |
| BTC-011 / BTC-014 | total flight cost | fare-family extras vs alternate-airport door-to-door cost | LOW |
| BTC-007 / BTC-008 | choosing lodging | lodging-type operating model vs boutique premium verification | LOW |
| BTC-004 / BTC-005 | mixed-age travel | whole-family coordination vs one senior traveler's city effort/access plan | LOW |
| BTC-016 / BTC-029 | short event/city trip | fixed-event anchor vs generic three-day geographic/time blocks | LOW |
| BTC-018 / BTC-020 | low-intensity short break | restorative nature effort vs one-base slow-travel rhythm | LOW |
| BTC-027 / BTC-042 | first trip preparation | first international dependency chain vs first solo female readiness | LOW |
| BTC-036 / BTC-040 | trip strain | cumulative overload reduction vs acute road-trip reset | LOW |
| BTC-035 / BTC-038 | travel budgeting | weekend go/no-go ceiling vs recurring long-trip living system | LOW |
| BTC-042 / BTC-045 | first solo travel | full readiness framework vs bounded two-night test trip | LOW |

No HIGH collision exists. Medium pairs retain clear canonical articles and do not block the corpus by themselves; metadata and internal links must preserve the stated handoffs.

## 7. Metadata, title and slug audit

Results:

- Duplicate Production Title: 0
- Duplicate slug: 0
- Duplicate SEO Title: 0 among populated fields
- Near-duplicate SEO Title requiring revision: 0
- Meta/Excerpt near-copy requiring revision: 0 among populated pairs
- Missing SEO Title: 8
- Missing Excerpt: 8 (same eight articles)
- Slug/Manifest conflicts: 2
- Invalid slug syntax, uppercase, underscores or year-lock: 0

Eighteen of 44 Production Titles begin with “How to” (40.9%). They align with procedural queries and do not require stylistic rewriting. The system includes questions, declarative systems, checklists and action titles, so title repetition is not mechanically excessive.

BTC-023 metadata needs a narrow wording correction: “Diagnose the hardest part…” conflicts with its own non-medical boundary. Replace with a non-clinical verb during the final fix phase.

Frontmatter schemas also vary (`production_title` vs `title`, and inconsistent presence of `content_id`, `category`, and `cluster`). The five editorial metadata fields are the current audit blocker; schema normalization must be specified before building import files.

## 8. Practical Utility audit

Primary functional classification (one primary class per article):

| Utility family | Count | IDs |
|---|---:|---|
| Checklist | 8 | 002, 009, 017, 019, 027, 036, 041, 042 |
| Matrix | 10 | 004, 006, 007, 015, 018, 023, 024, 030, 043 plus 005's access planner as comparison matrix |
| Worksheet | 8 | 001, 010, 013, 016, 026, 028, 031, 033 |
| Formula | 2 | 014, 034 |
| Calculator | 3 | 011, 022, 039 |
| Decision Tree | 1 | 040 |
| Canvas | 1 | 020 |
| Planner | 5 | 029, 035, 037, 038, 045 |
| Audit | 3 | 008, 025, 032 |
| Other | 3 | 012 rules card, 021 loadout map, 044 pressure ladder |
| **Total** | **44** | |

Matrices are the largest family but their underlying decisions differ: lodging weighting, seasonal trade-off, weather trigger, layer response, effort/access and support-format selection. No repeated `Concern / Action / Notes` hidden template was found. Practical-function diversity passes.

## 9. Article length audit

Corpus body-word statistics:

- Mean: **858.4**
- Median: **735.5**
- Minimum: **315** (BTC-036)
- Maximum: **1,863** (BTC-042)

| Dimension | Mean | Median | Min–Max |
|---|---:|---:|---:|
| Inspiration | 761.6 | 701 | 589–922 |
| Trip Planning | 891.9 | 810 | 354–1,777 |
| Flights & Stays | 1,270.3 | 1,360 | 725–1,674 |
| Budget Tips | 661.7 | 481.5 | 425–1,619 |
| Packing & Gear | 796.3 | 723 | 561–1,361 |
| Travel Styles | 525.1 | 333.5 | 315–1,863 |
| Tier A | 1,096.4 | 1,227 | 316–1,863 |
| Tier B | 689.3 | 698.5 | 315–1,619 |
| Tier C | 656.7 | 589 | 323–1,361 |
| Pillar | 1,198.3 | 1,372.5 | 315–1,863 |
| Support | 758.4 | 712 | 316–1,454 |

BTC-036 is **REVIEW_TOO_THIN** because it is a Pillar and compresses load types, intervention timing and route redesign into a very small treatment. BTC-004, 005, 037, 041, 043 and 045 are short but retain bounded promises and complete tools: **LENGTH_OK**. No article is `REVIEW_TOO_BROAD`; the longest Pillars remain within their commissioned scope.

## 10. Intro, conclusion and AI-style audit

Machine checks across all drafts found:

- exact paragraphs ≥120 characters: 0 duplicates;
- exact sentences ≥10 words: 0 duplicates;
- complete H2 sequences: 0 duplicates;
- repeated 12-word intro fingerprints: 0;
- repeated 12-word ending fingerprints: 0;
- prohibited stock AI phrases: 0.

Semantic review nevertheless found a corpus signature: 40 of 44 first-two-paragraph intros contain a negative limiter (`not`, `cannot`, `does not`, `without`), and at least 27 use a recognizable contrast-based opening. Across the corpus there are 485 instances of `not`, 87 of `does not`, and 89 em dashes. Many are necessary claim/sensitivity controls, but their concentration makes independently useful drafts sound commissioned from one rhetorical mold.

Minimum fix: revise the openings of BTC-004, 020, 021, 023, 025, 027, 030, 036, 037, 041 and 043 so at least several begin with a concrete task, scene, dependency or decision rather than a negated misconception. Preserve all substantive safety and non-coverage limits elsewhere. Conclusions are more varied and require only the article-specific changes already listed.

## 11. Claim, source and URL audit

Package-level sources:

- Unique source URLs across Research Notes, Ledgers and drafts: **77**
- Unique URLs directly present in Claim Ledgers: **54**
- Tier A: 19 articles, 72 package URL mentions, 2 with zero sources
- Tier B: 16 articles, 21 package URL mentions, 7 with zero sources
- Tier C: 9 articles, 2 package URL mentions, 8 with zero sources

The two zero-source Tier A articles are justified:

- BTC-014 uses an original comparison method and fictional arithmetic; it specifies an itinerary-date evidence gate.
- BTC-045 names no destination/current fact and specifies route/property/operator evidence at the pre-publication gate.

Zero-source Tier B/C editorial methods are not automatically failures. However, BTC-002, 005, 016, 017, 018, 019, 025, 026, 029, 041 and 043 have source URLs in Research Notes while their Claim Ledgers use unresolved source labels. That fails Editorial Standard v1's URL-level ledger requirement and is a bounded `RESEARCH FIX`.

Source quality classification:

| Type | Unique URLs |
|---|---:|
| Government | 25 |
| Regulator | 11 |
| Official Operator, including airlines | 7 |
| Platform First-Party | 31 |
| Manufacturer / Standards Body | 2 |
| High-Quality Secondary | 1 |
| Community / Experience Signal | 0 |
| Other / unknown | 0 |

No content farm, SEO affiliate authority, scraped source or unknown authority was found. First-party platform/operator pages are confined to their own features, policies or exact product fields; none is used as independent evidence of superiority.

Direct URL test results for all 77 package URLs:

| Health result | Count |
|---|---:|
| HTTP 200 | 47 |
| HTTP 206 (successful ranged response) | 23 |
| HTTP 202 / JavaScript verification | 1 |
| HTTP 403 / bot-limited | 6 |
| Broken | 0 |
| Rate-limited | 0 |
| Redirect needing normalization | 0 |
| Malformed syntax | 0 |

Bot-limited does not mean broken. Search retrieval confirmed the expected TfL, Leave No Trace and U.S. State Department page scope; other 403 pages returned the expected official domain/title. Claim scope remains bounded in the ledgers.

## 12. Freshness, sensitivity and independence

Freshness distribution:

- HIGH: 19
- MEDIUM: 16
- LOW: 9

Every article has either explicit package-level recheck requirements or a statement that current claims require new primary evidence. The separate Freshness Register records the exact gate per article.

Corpus sensitivity scan covered gender, age, family, accessibility, health, wellbeing, safety, law and finance. No stereotype, victim-blaming, universal safety guarantee, identity-essentialist ability assumption, fear framing or financial moralizing was found. BTC-010 and BTC-042 explicitly reject victim responsibility; BTC-004/005 ask the individual rather than infer from age; BTC-036/044 maintain non-clinical boundaries.

Commercial review found no affiliate link, fake partnership, unsourced “best” product claim or commission-led recommendation. Brand mentions serve a bounded first-party evidence example. Possible future monetization candidates are BTC-007–009, 011–015, 021–025, 031, 035 and 043, but they remain `FUTURE MONETIZATION CANDIDATE` only. No Affiliate Disclosure change is authorized.

## 13. Content Gap interaction

All P1/P2/P3 backlog intents remain `BACKLOG_ONLY`. The core corpus references some future guides but does not fully absorb Airport-to-City, cancellation/refunds, accommodation hidden fees/taxes, travel money, insurance comparison, SIM/eSIM, destination-safety research, food budgeting, local transport budgeting, complete-trip budgeting or visa verification.

No `BACKLOG_REVIEW` item is required and no new content was commissioned.

## 14. Operational boundary

Read-only inspection still shows:

- CMS Published: **0**
- CMS Draft placeholders: **6**

No Import, Publish, seed, D1, R2, Cloudflare, GitHub, GA, Ads, Framework, Theme, Website or Content Gap article action was performed.

## Final decision

**CORPUS NEEDS FINAL FIXES**

The fixes are enumerated in `BUDGET_TRAVEL_COMPASS_CORPUS_FIX_BACKLOG.md`. After those fixes, rerun only the affected metadata, ledger, intro/length and architecture assertions before authorizing Import Preparation. This audit does not authorize publication.

# Budget Travel Compass — Article Research & Rewrite Batch 3 Report

Date: 14 August 2026  
Scope: BTC-016, BTC-017, BTC-018, BTC-019, BTC-020, BTC-026, BTC-028, BTC-029 only  
Final batch status: **BATCH 3 READY FOR REVIEW**

Human Content Review Gate: **BATCH 3 CONTENT REVIEW APPROVED**

Import / publication state: **NOT READY FOR IMPORT OR PUBLICATION**

## 1. Authority and completion boundary

Batch 3 was produced against:

1. `BUDGET_TRAVEL_COMPASS_CONTENT_ARCHITECTURE.md`
2. `BUDGET_TRAVEL_COMPASS_PRODUCTION_CONTENT_MANIFEST.md`
3. `BUDGET_TRAVEL_COMPASS_EDITORIAL_STANDARD_V1.md`

The old article bodies were not used as rewrite bases and their source lists were not inherited. This run did not import, publish, alter CMS data, create seed/import files, change D1/R2/Cloudflare, modify Framework/Theme/site presentation, configure analytics/ads, touch GitHub, process the Content Gap Backlog, or start Batch 4.

Batch 2's human gate was recorded as **BATCH 2 CONTENT REVIEW APPROVED**, with an explicit **NOT READY FOR IMPORT OR PUBLICATION** boundary.

## 2. Package completion

All 32 required files exist:

| Article | Research notes | Claim ledger | Draft | Editorial QA | Final article status |
|---|---:|---:|---:|---:|---|
| BTC-016 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |
| BTC-017 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |
| BTC-018 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |
| BTC-019 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |
| BTC-020 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |
| BTC-026 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |
| BTC-028 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |
| BTC-029 | yes | yes | yes | yes | READY_FOR_CONTENT_REVIEW |

Word counts are intentionally non-uniform and follow reader need rather than a batch template: BTC-016 922; BTC-017 900; BTC-018 701; BTC-019 696; BTC-020 589; BTC-026 876; BTC-028 737; BTC-029 754. Metadata descriptions are natural and range from 139 to 156 characters.

## 3. Article decisions

### BTC-016 — Plan a Microtrip Around a Concert, Festival, or Game

- **Answer:** turn the fixed event into a compact, worthwhile journey through stay-zone choice, a consequence-sized arrival buffer, one experience on each side, a commitment budget, and a fallback.
- **Utility:** Event-Anchor Worksheet.
- **Freshness gate:** exact event, venue, ticket, transport, accommodation, access, and refund terms.
- **Boundary:** does not become BTC-029's general three-day framework.

### BTC-017 — How to Explore a Destination Through Markets and Grocery Stores

- **Answer:** use one observational question, ordinary staples, a small tasting basket, and respectful customer behavior to find affordable cultural context.
- **Utility:** compact visit-and-tasting card; the body remains editorial rather than checklist-led.
- **Freshness gate:** local allergen labeling, food safety, customs, payment, and etiquette.
- **Boundary:** no cultural generalization from a single store and no edible-souvenir assumption.

### BTC-018 — How to Plan a Restorative Nature Weekend

- **Answer:** match the total door-to-trail effort and one gentle anchor to the energy the reader is willing to spend, while protecting unassigned time.
- **Utility:** Recovery-versus-Effort Matrix.
- **Freshness gate:** land-manager access, permits, closures, warnings, weather, fires, and site rules.
- **Boundary:** “restorative” is an editorial planning objective, not a medical or psychological claim.

### BTC-019 — How to Plan a Set-Jetting Trip Without Chasing the Screen

- **Answer:** separate Screen Image from Real Place, verify identity/ownership/access, and build a place-led trip with community-respect and a substitute.
- **Utility:** Screen-to-Reality Check.
- **Freshness gate:** exact owner/manager, hours, prices, access, permits, transport, season, and local-impact guidance.
- **Boundary:** method, not a filming-location list or photo scavenger hunt.

### BTC-020 — How to Practice Slow Travel on a Short Break

- **Answer:** remove a move, use one base and small radius, repeat an ordinary pleasure, and protect an open block.
- **Utility:** One-Base Canvas.
- **Source decision:** no external citations because the draft contains editorial method, not consequential factual claims.
- **Boundary:** does not reproduce BTC-018's effort/recovery decision or BTC-029's usable-hour blocks.

### BTC-026 — How to Use AI to Plan a Trip Without Trusting It Blindly

- **Answer:** give AI low-authority work—brainstorming, organization, comparison of supplied evidence, and structure—while moving every consequential travel fact to an official-source verification queue.
- **Utilities:** Prompt Brief and Claim Verification Sheet.
- **Freshness gate:** exact tool capability, privacy, retention, review, deletion and connected-app documentation, plus the official authority for every travel fact.
- **Boundary:** no app ranking, ChatGPT tutorial, universal error claim, or replacement for BTC-027's international-trip dependency plan.

### BTC-028 — How to Plan a Group Trip: From Agreement to Booking

- **Answer:** expose false consensus, agree constraints and a decision rule, set a budget band and deadline, name owners, and define a humane change process.
- **Utilities:** Group Decision Worksheet and Owner Grid.
- **Source decision:** no decorative citation; exact transaction policies must come from primary booking documents.
- **Boundary:** BTC-006 retains lodging configuration; BTC-031 retains expense classification and settlement.

### BTC-029 — How to Plan a Three-Day City Break

- **Answer:** convert calendar dates to usable hours, choose a stay zone by repeated journeys, group geography, place limited reservations, and prepare same-area rain/fatigue swaps.
- **Utility:** Three-Day Time-Block Template.
- **Freshness gate:** operator schedules/fares, attraction hours/booking/access, weather, tax, and current prices.
- **Boundary:** no universal city itinerary and no absorption of BTC-045's solo two-night framework.

## 4. Source and URL validation

The Batch 3 packages contain 12 unique direct source URLs.

| Check | Result |
|---|---:|
| Syntactically malformed URLs | 0 |
| Broken URLs remaining after correction | 0 |
| HTTP 200 via direct request | 11 |
| Redirects requiring normalization | 0 |
| Bot-limited / command-line 403 | 1 |
| Rate-limited | 0 |
| JS-only with unverified content | 0 |

Verification used two methods:

1. `curl -L` checked direct status and final effective URL.
2. Web retrieval checked official domain, page title, readable content, and whether the content supported the ledger's actual claim scope.

Leave No Trace returned 403 to command-line retrieval but its official page rendered through web retrieval and exposed the named seven principles; it is recorded as **bot-limited, content verified**, not broken. An initially identified NPS PDF URL returned 404 and was replaced before completion with the current official NPS Trip Planning Guide webpage, which returned 200. No rate-limited or unverified JS-only source was accepted.

Source burden follows claim burden. BTC-020 and BTC-028 deliberately have no external citations. Product, policy, customs, allergen, land-access, and visitor-condition claims use current first-party or responsible-authority sources and remain bounded to their jurisdiction/product.

## 5. Structural variation QA

| Article | Dominant editorial movement | Practical utility |
|---|---|---|
| BTC-016 | fixed event expanding into a worthwhile microtrip | anchor worksheet |
| BTC-017 | observational walk through an everyday food space | visit/tasting card |
| BTC-018 | subtraction and effort budgeting | recovery-effort matrix |
| BTC-019 | image-to-place evidence audit | screen-reality check |
| BTC-020 | continuity through removal and repetition | one-base canvas |
| BTC-026 | authority split between generation and verification | prompt + claim sheet |
| BTC-028 | social commitment from false consensus to owners | decision sheet + owner grid |
| BTC-029 | time-and-geography assembly | time-block template |

No two Batch 3 articles share an H2 sequence, intro device, conclusion move, or Practical Utility structure. Inspiration drafts do not open with a risk ledger. BTC-017 carries the strongest observational voice; BTC-018 stays calm without wellness promises; BTC-020 remains editorial and lightly sourced.

## 6. Duplicate and cross-batch template audit

Machine comparison covered all Pilot, Batch 2, and Batch 3 `ARTICLE_DRAFT.md` files (21 drafts total).

- Exact duplicate paragraphs of 120+ characters: **0**
- Exact duplicate sentences of 10+ words: **0**
- Exact duplicate H2 sequences, excluding the standard source-note label: **0**
- Exact duplicate introductions: **0**
- Exact duplicate conclusions: **0**
- Repeated generic transitions requiring revision: **0**
- Repeated Practical Utility structures requiring revision: **0**
- Repeated source blocks: **0**
- Old template residue: **0**
- Banned AI phrasing in Batch 3: **0**

Human review also compared rhetorical shape, section cadence, utility function, source density, and closing move. Shared editorial infrastructure such as metadata fields and `Source notes` labels was not treated as article-template duplication.

## 7. Cannibalization QA

- **BTC-016 / BTC-029:** BTC-016 begins with a fixed event and protects it; BTC-029 begins with usable city hours and geographic blocks.
- **BTC-018 / BTC-020:** BTC-018 chooses a nature plan through recovery-versus-effort; BTC-020 creates depth through continuity, radius, and repetition.
- **BTC-020 / BTC-029:** BTC-020 deliberately subtracts and repeats; BTC-029 allocates limited hours across geographic blocks.
- **BTC-026 / BTC-027:** BTC-026 governs AI authority and claim verification; BTC-027 owns the dependency-ordered first international trip.
- **BTC-028 / BTC-006 / BTC-031:** BTC-028 ends at agreement, ownership, and booking commitment; BTC-006 owns stay configuration; BTC-031 owns cost-sharing and settlement.
- **BTC-029 / BTC-045:** BTC-029 is a generic three-day time/geography method; BTC-045 retains solo-specific two-night safety, dining, autonomy, and fallback decisions.

No pair targets the same complete reader outcome or produces an interchangeable utility. Explicit handoffs are present where they help the reader without importing sibling content.

## 8. Editorial and claim QA

- All eight intros establish the reader problem and article answer promptly.
- All high-consequence/freshness-sensitive claims appear in a ledger.
- No fixed price, schedule, opening hour, visa/entry rule, safety state, or booking policy is presented as evergreen.
- No unsupported health/wellness, AI-accuracy-rate, cultural, platform-wide, or universal destination claim remains.
- No fake first-person field experience, affiliate preference, decorative source, or inherited legacy prose remains.
- All eight meta descriptions accurately describe their own article and differ from sibling intent.
- Each article includes a specific pre-publication recheck or freshness control.

## 9. CMS and operational boundary assertion

Read-only inspection of `src/db/seed-data.ts` confirms:

- Published: **0**
- Draft placeholders: **6**

The count and state were not changed. No import file, seed change, CMS mutation, D1/R2/Cloudflare action, publish action, or site/Framework/Theme modification was performed.

Pilot articles remain `READY_FOR_FINAL_PILOT_REVIEW`. Batch 2 article packages remain `READY_FOR_CONTENT_REVIEW`, while the Batch 2 human gate is recorded as approved. Neither status means ready for import.

## Final decision

**BATCH 3 READY FOR REVIEW**

Stop boundary reached. Do not start Batch 4 and do not import or publish.

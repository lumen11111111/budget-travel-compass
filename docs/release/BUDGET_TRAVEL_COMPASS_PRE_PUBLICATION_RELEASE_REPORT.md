# Budget Travel Compass — Pre-Publication Freshness & Release Gate

Date: 2026-08-17  
Production domain: `https://budgettravelcompass.com`  
Remote D1: `budget-travel-compass` (`28e229c2-c032-4c09-9490-630c1b88df50`)

## Decision

**RELEASE GATE BLOCKED**

All 44 articles pass the article-level freshness gate and have no unresolved factual HOLD. The blocker is publication mechanics: the 129 approved article-to-article links form a graph whose only sink strongly connected component contains 42 articles. The remaining two articles lead into that component. Consequently, there is no 5–8 article Wave 1 whose stored links resolve only to articles in the same wave. Publishing any current article subset would expose links to Draft routes that correctly return 404.

No article was published. No Production D1 body, metadata, status, schema, R2 object, framework, theme, analytics, or advertising configuration was changed.

## Freshness Distribution

The row-level authority in `BUDGET_TRAVEL_COMPASS_FRESHNESS_REGISTER.md` contains:

| Freshness | Articles |
| --- | ---: |
| HIGH | 21 |
| MEDIUM | 14 |
| LOW | 9 |
| **Total** | **44** |

The register summary previously said 19 HIGH / 16 MEDIUM / 9 LOW. Its two summary counts were corrected to match the 44 authoritative article rows; no article classification changed.

## HIGH Rechecks

All 21 HIGH articles were checked only against their registered claims and sources. Named legal, platform, airline, accommodation, safety, entry, weather, accessibility, transport, AI/privacy, and product examples remain within their stated jurisdiction and scope.

| Content ID | Claims rechecked | Sources reopened | Result | Notes |
| --- | ---: | ---: | --- | --- |
| BTC-001 | 5 | 5 | PASS | Accessibility labels remain discovery signals; property-specific verification remains required. |
| BTC-005 | 1 | 1 | PASS | TfL identity and accessible-journey scope verified through the official accessibility index. |
| BTC-006 | 5 | 5 | PASS | FTC, Airbnb, and Vrbo fee/payment/cancellation framing remains bounded and current. |
| BTC-007 | 5 | 5 | PASS | Fee-display and property-specific cancellation/room-format framing remains current. |
| BTC-008 | 4 | 4 | PASS | Location, access, price-field, and property-evidence claims remain bounded. |
| BTC-009 | 4 | 4 | PASS | Workspace/connectivity guidance remains property/provider-specific. |
| BTC-010 | 5 | 6 | PASS | Advisory, route-tool, and crime-data limitations remain accurate and nationality/source scoped. |
| BTC-011 | 6 | 6 | PASS | DOT ancillary-fee framework, Delta Main Basic, American Basic Economy, Google bag estimates, and refund scope verified. |
| BTC-012 | 6 | 5 | PASS | Google/KAYAK alert, prediction, seller, and baggage-estimate behavior remains accurately qualified. |
| BTC-013 | 6 | 5 | PASS | Flexible-date tools, coverage limits, fare-family and checkout verification remain accurate. |
| BTC-014 | 6 method/input checks | 0 | PASS | No live fare, ground-price, schedule, or airport example is instantiated; all numbers are fictional arithmetic. |
| BTC-015 | 2 sourced claims | 2 | PASS | Climate/normal distinction remains current; no live fare/event claim is present. |
| BTC-019 | 2 | 2 | PASS | Lacock ownership/film identity and current visitor-field structure verified; no live value is copied. |
| BTC-025 | 6 consequential claims | 6 | PASS | FAA battery carriage and Google offline-map limitations remain current; exact carrier/device checks remain required. |
| BTC-026 | 4 | 3 | PASS | Gemini limitations, activity controls, retention, and human-review qualifications remain accurate. Source update date corrected in editorial records only. |
| BTC-027 | 7 | 5 | PASS | Entry/passport/visa/health/insurance/finance guidance remains a nationality- and itinerary-specific handoff. |
| BTC-030 | 3 | 3 | PASS | Climate, forecast, warning, and authority-first decision framing remains current. |
| BTC-041 | 2 | 2 | PASS | Heathrow/TfL are examples of current operator evidence; no route time or service promise is copied. |
| BTC-042 | 5 | 5 | PASS | Government solo/women traveler guidance remains destination- and nationality-scoped without a safety guarantee. |
| BTC-043 | 2 | 2 | PASS | Hostel room/age variability and Intrepid product-field examples remain present and explicitly non-endorsing. |
| BTC-045 | 3 method/boundary checks | 0 | PASS | No city, route, hours, entry rule, or property is instantiated. |

## MEDIUM Rechecks

Only consequential decision, safety, fee, availability, transport, or platform claims were reopened. Stable editorial methods were not re-researched.

| Content ID | Consequential claims rechecked | Sources reopened | Result | Notes |
| --- | ---: | ---: | --- | --- |
| BTC-002 | 2 | 2 | PASS | Official beach-hazard and sunscreen handoffs remain current; destination/carrier specifics are not asserted. |
| BTC-004 | 0 added claims | 0 | PASS_BY_STABILITY | No transport, health, insurance, or destination example was added. |
| BTC-016 | 3 | 3 | PASS | Event-status/cancellation and route-tool behavior remains current and event-specific. |
| BTC-017 | 2 | 2 | PASS | Allergy-label and customs/import handoffs remain authority-specific. |
| BTC-018 | 2 | 2 | PASS | Land-manager/access and minimum-impact guidance remains appropriately scoped. |
| BTC-023 | 0 added restrictions | 0 | PASS_BY_STABILITY | No carrier, security, medical, hydration, or circulation rule is asserted. |
| BTC-029 | 1 | 1 | PASS | Map timing remains an estimate and local operator verification is required. |
| BTC-031 | 0 named-service claims | 0 | PASS_BY_STABILITY | No payment-app fee, exchange, cancellation, or refund term is instantiated. |
| BTC-033 | 0 live-price claims | 0 | PASS_BY_STABILITY | No current fare, fuel, parking, or access price is present. |
| BTC-035 | 4 | 4 | PASS | Budgeting and advertised-airfare distinctions remain current; scenario values are not market claims. |
| BTC-036 | 0 added health/safety claims | 0 | PASS_BY_STABILITY | The draft remains a non-clinical planning method. |
| BTC-037 | 0 added legal/provider claims | 0 | PASS_BY_STABILITY | No visa, labor, tax, coworking, connectivity, or health rule is introduced. |
| BTC-038 | 0 live-property/price claims | 0 | PASS_BY_STABILITY | Real property, food-safety, transport, and fee inputs remain reader-side checks. |
| BTC-040 | 3 | 3 | PASS | NHTSA pull-over guidance, 511 scope, and official-warning priority remain current and bounded. |

## LOW Stability Pass

BTC-020, BTC-021, BTC-022, BTC-024, BTC-028, BTC-032, BTC-034, BTC-039, and BTC-044 contain no publication-date-sensitive factual statement that is presented as a current universal rule. Their destination, carrier, venue, weather, product, price, or property references are explicit future verification instructions.

Result: **9/9 PASS_BY_STABILITY**.

## Sources Reopened

The gate performed 93 article-source checks representing 76 unique HIGH/MEDIUM URLs. This was not a full-corpus research rerun: LOW sources were not reopened, and MEDIUM articles without consequential named claims received stability review only.

- 68 unique URLs returned HTTP 200 with matching page identity.
- NOAA Climate.gov returned HTTP 202 while retaining the expected official page identity through the indexed official page.
- Seven direct requests were bot-limited (HTTP 403): TfL, two Hostelworld pages, three Travel.State.gov pages, and the FBI UCR page. They were not treated as failures. Official indexes/search-visible first-party copies confirmed identity and claim scope.
- No registered URL required replacement in public Source Notes.

Key current authorities included [U.S. DOT What's New](https://www.transportation.gov/airconsumer/latest-news), [U.S. DOT Buying a Ticket](https://www.transportation.gov/individuals/aviation-consumer-protection/buying-ticket), [FAA PackSafe Lithium Batteries](https://www.faa.gov/hazmat/packsafe/lithium-batteries), [FTC Fee Rule notice](https://search.ftc.gov/news-events/news/press-releases/2025/05/ftc-rule-unfair-or-deceptive-fees-take-effect-may-12-2025), [Google Flights bag-fee help](https://support.google.com/travel/answer/9074247?hl=en-GB), [Gemini Apps Privacy Hub](https://support.google.com/gemini/answer/13594961?hl=en), [GOV.UK Foreign Travel Checklist](https://www.gov.uk/guidance/foreign-travel-checklist), and [Travel.State.gov International Travel Checklist](https://travel.state.gov/en/international-travel/planning/checklist.html).

## Changed Claims

No article claim changed materially. No claim received `PATCH_REQUIRED` or `HOLD`.

The Gemini Apps Privacy Hub now identifies its latest update as 2026-07-15 rather than the 2026-06-29 date recorded in BTC-026's research package. The article's qualified privacy statement remains accurate.

## Targeted Patches

No Production D1 patch was required or executed.

Editorial-only corrections:

- `content-preparation/research/BTC-026/CLAIM_SOURCE_LEDGER.md`: corrected two Privacy Hub update-date entries to 2026-07-15 and recorded the 2026-08-17 recheck.
- `content-preparation/research/BTC-026/RESEARCH_NOTES.md`: corrected the same official-page update date.
- `docs/content/BUDGET_TRAVEL_COMPASS_FRESHNESS_REGISTER.md`: corrected summary counts from 19/16/9 to the row-derived 21/14/9.

`ARTICLE_DRAFT.md`, Remote D1 body HTML, metadata, tables, Source Notes, and internal-link targets were unchanged.

## Internal Link Preservation

Remote D1 verification after the gate:

- Draft articles scanned: 44
- Internal article links: 129
- Invalid target slugs: 0
- Editorial leakage hits: 0
- Production body patches: 0

The approved 129-link target set remains intact.

### Controlled-release graph constraint

The directed graph contains:

- one sink strongly connected component with 42 articles;
- BTC-016, whose links lead into that component;
- BTC-019, whose links lead to BTC-016 and the component.

There is no outbound-closed subset of 5–8 articles. Current public repositories correctly expose only `status='published'` articles, but links already stored inside an article body are not filtered by target publication status. A partial publish would therefore create public links to 404 Draft routes.

## Release Eligibility Matrix

Article-level eligibility is based on factual freshness only. System-level release remains blocked by the controlled-wave link behavior described above.

| Content ID | Freshness | Claims rechecked | Sources reopened | Result | Patch | Release eligibility | Reason |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| BTC-001 | HIGH | 5 | 5 | PASS | None | READY | Current bounded accessibility workflow. |
| BTC-002 | MEDIUM | 2 | 2 | PASS | None | READY | Safety/source handoffs current. |
| BTC-004 | MEDIUM | 0 | 0 | PASS_BY_STABILITY | None | READY | No added consequential example. |
| BTC-005 | HIGH | 1 | 1 | PASS | None | READY | Official operator scope current. |
| BTC-006 | HIGH | 5 | 5 | PASS | None | READY | Current bounded lodging rules. |
| BTC-007 | HIGH | 5 | 5 | PASS | None | READY | Current fee/policy framing. |
| BTC-008 | HIGH | 4 | 4 | PASS | None | READY | Current bounded property evidence. |
| BTC-009 | HIGH | 4 | 4 | PASS | None | READY | Current provider/property checks. |
| BTC-010 | HIGH | 5 | 6 | PASS | None | READY | Current advice/tool limitations. |
| BTC-011 | HIGH | 6 | 6 | PASS | None | READY | Current fare/bag/refund framework. |
| BTC-012 | HIGH | 6 | 5 | PASS | None | READY | Current alert/platform qualifications. |
| BTC-013 | HIGH | 6 | 5 | PASS | None | READY | Current flexible-search qualifications. |
| BTC-014 | HIGH | 6 method checks | 0 | PASS | None | READY | No live itinerary input. |
| BTC-015 | HIGH | 2 | 2 | PASS | None | READY | Climate distinction current; no live fare. |
| BTC-016 | MEDIUM | 3 | 3 | PASS | None | READY | Event-specific handoffs current. |
| BTC-017 | MEDIUM | 2 | 2 | PASS | None | READY | Allergy/customs handoffs current. |
| BTC-018 | MEDIUM | 2 | 2 | PASS | None | READY | Land-manager handoffs current. |
| BTC-019 | HIGH | 2 | 2 | PASS | None | READY | Current owner/visitor fields verified. |
| BTC-020 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | No date-sensitive assertion. |
| BTC-021 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | No current restriction asserted. |
| BTC-022 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | Carrier/weather checks remain conditional. |
| BTC-023 | MEDIUM | 0 | 0 | PASS_BY_STABILITY | None | READY | No medical/carrier rule asserted. |
| BTC-024 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | No product-performance claim. |
| BTC-025 | HIGH | 6 | 6 | PASS | None | READY | Current battery/offline limits. |
| BTC-026 | HIGH | 4 | 3 | PASS | Editorial date only | READY | Claim current; research date corrected. |
| BTC-027 | HIGH | 7 | 5 | PASS | None | READY | Current official handoff workflow. |
| BTC-028 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | No live provider term. |
| BTC-029 | MEDIUM | 1 | 1 | PASS | None | READY | Route estimate remains qualified. |
| BTC-030 | HIGH | 3 | 3 | PASS | None | READY | Warning/authority framing current. |
| BTC-031 | MEDIUM | 0 | 0 | PASS_BY_STABILITY | None | READY | No named payment-service behavior. |
| BTC-032 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | Editorial worksheet only. |
| BTC-033 | MEDIUM | 0 | 0 | PASS_BY_STABILITY | None | READY | No live price input. |
| BTC-034 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | Fictional arithmetic only. |
| BTC-035 | MEDIUM | 4 | 4 | PASS | None | READY | Budget/airfare distinctions current. |
| BTC-036 | MEDIUM | 0 | 0 | PASS_BY_STABILITY | None | READY | Non-clinical method unchanged. |
| BTC-037 | MEDIUM | 0 | 0 | PASS_BY_STABILITY | None | READY | No legal/provider rule introduced. |
| BTC-038 | MEDIUM | 0 | 0 | PASS_BY_STABILITY | None | READY | No live price/property assertion. |
| BTC-039 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | Restrictions remain conditional. |
| BTC-040 | MEDIUM | 3 | 3 | PASS | None | READY | Safety/road-information scope current. |
| BTC-041 | HIGH | 2 | 2 | PASS | None | READY | No live route promise. |
| BTC-042 | HIGH | 5 | 5 | PASS | None | READY | Current bounded government guidance. |
| BTC-043 | HIGH | 2 | 2 | PASS | None | READY | Current product/platform field examples. |
| BTC-044 | LOW | Stability scan | 0 | PASS_BY_STABILITY | None | READY | No date-sensitive dining rule. |
| BTC-045 | HIGH | 3 method checks | 0 | PASS | None | READY | No city-specific fact instantiated. |

Summary: **44 READY / 0 article HOLD**.

## Production Integrity

Read-only Remote D1 results:

| Check | Result |
| --- | ---: |
| Categories | 6 |
| Articles | 44 |
| Drafts | 44 |
| Published | 0 |
| Placeholders | 0 |
| Media assets | 0 |
| Article-tag assignments | 0 |
| Internal links | 129 |
| Invalid internal targets | 0 |
| Editorial leakage | 0 |

Leakage rules for raw YAML, raw Markdown strong/emphasis, raw pipe tables, replacement characters, editorial filenames/labels, preparation paths, and Windows paths all returned zero.

## Public Isolation

- 44/44 canonical Production Draft routes returned HTTP 404.
- Homepage, six category routes, search, and sitemap returned HTTP 200 with zero Production Draft links.
- No temporary publication was used for QA.

## Publication Mechanics

The current CMS mechanics are internally consistent for a single article transition:

- Admin publish intent changes status to `published` and supplies `published_at` when blank.
- Public repositories filter articles through the published-only contract.
- Homepage, category, search, `/news`, related-article selection, and sitemap consume published-only results.
- Public article metadata produces the canonical `/news/<slug>` URL.
- Public article rendering enables Article and Breadcrumb JSON-LD; authenticated Draft Preview disables structured data.
- Existing inline internal links remain stored in `body_html` and are not publication-status aware.

The final item blocks the required controlled 5–8 article release. The gate does not authorize implementing a runtime or content fix.

## Wave 1 Recommendation

After a separately approved publication-safe link mechanism exists, use this provisional six-article cross-category wave:

| Content ID | Category | Freshness | Structural role |
| --- | --- | --- | --- |
| BTC-020 | Inspiration | LOW | One-base slow-travel editorial method |
| BTC-028 | Trip Planning | LOW | Group decision and ownership workflow |
| BTC-014 | Flights & Stays | HIGH | Fictional total-cost comparison with no live fare claim |
| BTC-032 | Budget Tips | LOW | Spending-swap worksheet |
| BTC-021 | Packing & Gear | LOW | Modular daypack setup |
| BTC-044 | Travel Styles | LOW | Solo-dining pressure ladder |

This selection covers all six categories, multiple article structures, five LOW articles, and one HIGH article whose consequential inputs are explicitly fictional. It is a recommendation only; it must not be published while its outbound links can resolve to Draft 404 routes.

Acceptable pre-publish remedies require separate authorization. The preferred option is a minimal public-render rule that leaves stored approved HTML intact but renders an internal article link as a link only when its target is published. A temporary D1 link-removal/restoration pass is less desirable because it creates content drift and repeated production writes.

## Remaining Holds

Article-level HOLDs: **none**.

System-level blocker:

- `PUB-LINK-001`: controlled Wave 1 would expose approved links to unpublished Draft routes. Resolve and validate publication-status-aware internal-link rendering (or another explicitly approved equivalent) before any Publish action.

After that mechanism is approved and validated, rerun only the publication mechanics regression and the selected Wave 1 link closure check. A new full freshness research pass is not required unless the publication date materially slips or a monitored source changes.

## Final Status

**RELEASE GATE BLOCKED**

**44 ARTICLE-LEVEL READY**  
**0 ARTICLE HOLDS**  
**0 PUBLISHED**

Await controlled publication-mechanics remediation and explicit Controlled Publish authorization.

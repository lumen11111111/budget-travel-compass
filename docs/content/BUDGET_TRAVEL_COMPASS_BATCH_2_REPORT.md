# Budget Travel Compass — Article Research & Rewrite Batch 2 Report

Completed: 2026-08-14  
Scope: BTC-001, BTC-006, BTC-007, BTC-008, BTC-009, BTC-010, BTC-011, BTC-012 only  
Category: Flights & Stays  
Final batch status: **BATCH 2 READY FOR REVIEW**

Human Content Review Gate: **BATCH 2 CONTENT REVIEW APPROVED**

Import / publication state: **NOT READY FOR IMPORT OR PUBLICATION**

## 1. Production authority and boundary

Batch 2 was produced against these three governing documents:

1. `BUDGET_TRAVEL_COMPASS_CONTENT_ARCHITECTURE.md`
2. `BUDGET_TRAVEL_COMPASS_PRODUCTION_CONTENT_MANIFEST.md`
3. `BUDGET_TRAVEL_COMPASS_EDITORIAL_STANDARD_V1.md`

Pilot Final Review approval has been recorded in the Editorial Standard as **APPROVED EDITORIAL STANDARD V1**. This approval is an editorial production standard only. It does not authorize CMS import or publication.

No legacy article body was used as a rewrite base. No legacy source list was inherited. Batch 3, the Content Gap Backlog, original source files, Architecture, Manifest, Framework, Theme, site, CMS, D1, R2, Cloudflare, GitHub, GA, and Ads were not modified.

The five pilot articles remain `READY_FOR_FINAL_PILOT_REVIEW`.

## 2. Package completion

Each Batch 2 article has the required four-file research package:

- `RESEARCH_NOTES.md`
- `CLAIM_SOURCE_LEDGER.md`
- `ARTICLE_DRAFT.md`
- `EDITORIAL_QA.md`

All eight drafts have the only applicable successful Batch 2 article status:

**READY_FOR_CONTENT_REVIEW**

## 3. Article decisions

### BTC-001 — How to Verify Accessible Accommodation for a Family Trip

- **Intent delivered:** converts individual access requirements into measurable property questions, direct evidence, written confirmation, and a fallback.
- **Structure:** journey through the property—traveler profile, arrival route, room/bathroom, common areas, confirmation, fallback.
- **Practical utility:** Property Accessibility Question Sheet.
- **Research:** ADA.gov reservation rules are explicitly U.S.-limited; GOV.UK guidance and Airbnb feature definitions support direct, feature-level verification.
- **Boundary:** does not provide a multigenerational itinerary, universal accessibility definition, or legal compliance advice.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

### BTC-006 — How to Choose Accommodation for a Group Trip

- **Intent delivered:** exposes room allocation, privacy, gathering, total commitment, house-rule, payment, and headcount-change trade-offs.
- **Structure:** room-plan design followed by configuration patterns and a one-change stress test.
- **Practical utility:** Group Accommodation Comparison Matrix.
- **Research:** current Airbnb, Vrbo, and FTC primary material supports platform-specific fee/payment/cancellation examples and U.S.-specific total-price disclosure.
- **Boundary:** begins after the group has agreed to travel; it does not reproduce BTC-028 consensus or BTC-031 settlement workflows.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

### BTC-007 — Hotel vs Hostel vs Vacation Rental: Which Stay Fits Your Trip?

- **Intent delivered:** compares total stay commitment, morning/evening routines, location, privacy, services, guest workload, and disruption response.
- **Structure:** a “day in the trip” comparison, not a category pros/cons list.
- **Practical utility:** Weighted Lodging Decision Matrix.
- **Research:** FTC, Airbnb, and Hostelworld first-party material is used only for bounded price/cancellation/channel examples.
- **Boundary:** does not recommend individual properties or absorb group, accessibility, boutique, or remote-work verification guides.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

### BTC-008 — How to Choose a Local Boutique Hotel Without Paying for Style Alone

- **Intent delivered:** tests whether a visual/identity premium survives room, route, staffing, noise, amenity, policy, and total-price evidence.
- **Structure:** promise → proof → friction → deliberate alternative → verdict.
- **Practical utility:** Boutique-Stay Verification Scorecard with separate evidence-strength and trip-value scoring.
- **Research:** current FTC, Expedia Group, Google, and ADA.gov documentation supports total-price fields, planned-time route tools, and feature-level evidence.
- **Boundary:** does not redo hotel/hostel/rental selection.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

### BTC-009 — How to Choose a Stay for Remote Work

- **Intent delivered:** works backward from the reader's highest-consequence work hour and verifies connection, workspace, power, privacy, noise, time-zone fit, and independent backups.
- **Structure:** failure-consequence and evidence hierarchy.
- **Practical utility:** Remote-Work Stay Readiness Checklist with criticality and Pass/Unresolved/Fail gates.
- **Research:** Airbnb feature definitions and Microsoft Teams application-owned bandwidth guidance are narrow and current; no universal Mbps threshold is created.
- **Boundary:** excludes visas, tax, complete nomad routine, and the device/offline packing system.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

### BTC-010 — How to Check Whether a Neighborhood Is Right for Your Stay

- **Intent delivered:** replaces broad safety reputation with the traveler's actual routes, times, official context, recent signals, access needs, location burden, uncertainty, and fallback.
- **Structure:** four evidence lenses plus explicit uncertainty handling.
- **Practical utility:** Neighborhood Evidence Worksheet; intentionally no numeric safety score.
- **Research:** nationality scope is preserved for U.S. State Department and UK FCDO advice; FBI crime-data limitations and Google route-tool limitations are explicit.
- **Sensitivity:** no universal safe/unsafe label, stereotype, false assurance, or victim-blaming. The draft states that preparation does not transfer responsibility for harmful conduct to the traveler.
- **Boundary:** does not reproduce BTC-041's complete arrival protocol.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

### BTC-011 — Basic Economy and Baggage Fees: Compare the Real Flight Cost

- **Intent delivered:** normalizes fares only after traveler-required bags, seats, flexibility, channel terms, and unavoidable itinerary costs are applied.
- **Structure:** calculator workshop using a traveler requirement card, dated fare evidence, cost calculation, channel check, and fictional demonstration.
- **Practical utility:** True-Flight-Cost Calculator.
- **Research correction:** the draft does not rely on the vacated 2024 U.S. ancillary-fee disclosure mandates. Current July 2026 DOT guidance is used instead, alongside current Delta, American, and Google documentation.
- **Arithmetic QA:** fictional values recalculated: `420 + 80 + 30 = 530`; `490 + 0 + 0 = 490`; difference `40` units.
- **Boundary:** does not provide a packing list, flexible-date search, or cheapest-airline claim.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

### BTC-012 — How to Use Flight Fare Alerts Without Checking Prices All Day

- **Intent delivered:** turns monitoring into a bounded experiment with a defined question, comparable baseline, small alert set, scheduled review, buy conditions, and stop rule.
- **Structure:** monitoring hypothesis → baseline → signals → decision review → purchase validation → shutdown.
- **Practical utility:** Fare-Alert Rules Card.
- **Research:** current Google and KAYAK first-party documentation supports alert types, notification/management controls, prediction limitations, and seller/servicer distinction.
- **Boundary:** does not predict a cheapest booking day or reproduce BTC-013's date search and BTC-011's full fare calculator.
- **Status:** `READY_FOR_CONTENT_REVIEW`.

## 4. Source and claim QA

- Unique ledger URLs: **34**.
- Malformed URL syntax: **0** after normalizing the State Department Travel Advisories link to its current `/en/international-travel/` route.
- Broken source URLs: **0 found**.
- Most sources opened directly to the expected official page during the 2026-08-14 review. A small number of JavaScript/rate-limited pages returned an extraction error in direct-open testing but were confirmed through current indexed results on the same official domain with the expected title and claim text.
- Consequential and freshness-sensitive claims are represented in a Claim-to-Source Ledger.
- Platform sources support only their own features or terms.
- U.S. and UK legal/government statements retain jurisdiction or traveler-nationality scope.
- No decorative citation was added to ordinary editorial judgment.
- Every research package includes a specific pre-publication recheck list.

## 5. Structural variation QA

All eight H2 sequences are unique. The practical outputs are related to their manifest briefs but structurally different:

| Article | Dominant structure | Practical utility shape |
|---|---|---|
| BTC-001 | Physical property journey | Feature-level question sheet |
| BTC-006 | Group room/configuration design | Weighted configuration matrix |
| BTC-007 | Day-in-the-trip comparison | Lodging-type decision matrix |
| BTC-008 | Marketing claim evidence audit | Evidence/value scorecard |
| BTC-009 | Work-failure consequence ladder | Gated readiness checklist |
| BTC-010 | Multi-source evidence lenses | Uncertainty worksheet |
| BTC-011 | Cost-normalization workshop | Calculator + fictional arithmetic |
| BTC-012 | Bounded monitoring experiment | Rules card with stop condition |

The two matrices do not perform the same job: BTC-006 compares group room configurations after allocation; BTC-007 weights lodging operating models against a trip day. The two gate/checklist-like outputs also differ: BTC-001 requests property evidence, while BTC-009 rejects unresolved work-critical failures.

“Practical” was not interpreted as eight checklists.

## 6. Cross-article duplication QA

Machine-assisted exact-match review across the eight article drafts found:

- duplicated paragraphs of 120+ characters across articles: **0**;
- duplicated sentences of 10+ words across articles: **0**;
- duplicated full H2 sequences: **0**;
- unique H2 sequences: **8 / 8**.

Manual review found:

- repeated intros: **none**;
- repeated conclusions: **none**;
- repeated generic transition sequence: **none requiring revision**;
- repeated Practical Utility structure: **none that performs the same reader task**;
- old pilot/template skeleton residue: **none found**;
- banned Editorial Standard AI phrasing: **0 matches**.

Source-note conventions and pre-publication freshness language recur because they are audit fields, not article-body templates.

## 7. Sibling cannibalization QA

- **BTC-001 vs BTC-007:** BTC-001 verifies an individual's access requirements; BTC-007 chooses among lodging operating types.
- **BTC-006 vs BTC-007:** BTC-006 starts from group room allocation; BTC-007 starts from a general trip's daily operating pattern.
- **BTC-007 vs BTC-008:** BTC-007 selects a lodging type; BTC-008 audits the value premium inside one hotel subtype.
- **BTC-007/BTC-009:** BTC-007 mentions trip pattern; BTC-009 owns work-critical proof, application requirements, and backups.
- **BTC-008/BTC-010:** BTC-008 uses location as one boutique-value factor; BTC-010 owns the full route/evidence/uncertainty method.
- **BTC-010/BTC-041:** BTC-010 chooses a stay area; BTC-041 retains a door-to-door solo arrival protocol.
- **BTC-011/BTC-013:** BTC-011 normalizes an existing fare; BTC-013 discovers date combinations.
- **BTC-012/BTC-013:** BTC-012 monitors a pre-approved route/window; BTC-013 performs the flexible-date search.
- **BTC-011/BTC-012:** BTC-011 owns the detailed true-cost calculator; BTC-012 uses only a baseline sufficient to keep alerts comparable.

No article requires merging or scope reduction at this gate.

## 8. Metadata and package QA

- Article word counts by the Batch 2 ASCII-token QA method range from approximately **1,200 to 1,450 words**, excluding front matter.
- Meta descriptions range from approximately **140 to 155 characters** after final adjustment.
- Eight production titles and slugs match the Manifest.
- Excerpts are distinct from meta descriptions.
- All eight `ARTICLE_DRAFT.md` and `EDITORIAL_QA.md` files state `READY_FOR_CONTENT_REVIEW`.
- No live internal link to an unpublished route was created.

## 9. CMS and operational boundary assertion

The existing seed/content state remains:

- Published: **0**
- Draft placeholders: **6**

No import, publish, seed, CMS, D1, R2, Cloudflare, Framework, Theme, website, deployment, analytics, advertising, commit, or push operation was performed.

## 10. Human Content Review Gate

Batch 2 is ready for human review of the actual drafts and Research Packages. Review should pay particular attention to:

- accessibility and neighborhood sensitivity;
- the distinction between evidence and guarantee;
- jurisdiction limits;
- the current 2026 DOT ancillary-fee posture;
- the usability of all eight practical components on mobile;
- pre-publication freshness requirements.

`READY_FOR_CONTENT_REVIEW` does not mean `READY FOR IMPORT` or `READY FOR PUBLICATION`.

## Final decision

**BATCH 2 READY FOR REVIEW**

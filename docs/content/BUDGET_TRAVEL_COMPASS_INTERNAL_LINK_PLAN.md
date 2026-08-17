# Budget Travel Compass — Final Internal Link Plan

Status: **PLANNING ONLY — NO LIVE LINKS CREATED**  
Source: Production Manifest planned links plus corpus-level reader-next-problem review.

## Rules

- Pillars/hubs introduce supporting decisions; supports return to their canonical pillar/hub.
- Cross-cluster links remain only when the linked article is the reader's plausible next problem.
- Counts below describe production-article edges. Non-article hub paths are recorded separately.
- Link labels must describe the destination problem; do not use generic “read more.”

## Article graph

| ID | Parent pillar / hub | Incoming planned article links | Outgoing planned links | Link quality action |
|---|---|---|---|---|
| BTC-001 | BTC-004 | 004, 005, 007 | 004, 007, 010 | KEEP |
| BTC-002 | BTC-022 | 004, 024 | 022, 004, 024 | KEEP |
| BTC-004 | Family/Senior/Accessible pillar | 001, 002, 005 | 001, 002, 005, 006 | KEEP |
| BTC-005 | BTC-004 | 004 | 004, 001, 029 | KEEP |
| BTC-006 | BTC-028 | 004, 007, 028, 031 | 028, 031, 007 | KEEP |
| BTC-007 | Accommodation Decisions pillar | 001, 006, 008, 009, 010, 043 | 006, 008, 009, 001 | KEEP; add visible path to BTC-010 from pillar/hub navigation |
| BTC-008 | BTC-007 | 007 | 007, 010, 029 | KEEP |
| BTC-009 | BTC-007 | 007, 025, 037 | 007, 037, 025 | KEEP |
| BTC-010 | BTC-007 | 001, 008, 016, 019, 029, 041, 042 | 007, 041, 029 | KEEP; high incoming count is intentional constraint reuse |
| BTC-011 | BTC-013 | 013, 022 | 013, 022, 035 | KEEP |
| BTC-012 | BTC-013 | 013 | 013, 015, 035 | KEEP |
| BTC-013 | Affordable Flights pillar | 011, 012, 014, 015, 035 | 011, 012, 014, 015 | KEEP |
| BTC-014 | BTC-013 | 013 | 013, 035 | KEEP; future airport-city guide remains BACKLOG_ONLY |
| BTC-015 | BTC-013 | 012, 013 | 013, 030, 035 | KEEP |
| BTC-016 | Short Breaks hub | 019 | 029, 035, 010 | KEEP; hub incoming path required |
| BTC-017 | Experience-Led hub | 020, 044 | 033 | KEEP BTC-033; generic BTC-035 edge removed |
| BTC-018 | Short Breaks / Experience-Led hubs | 030, 033 | 020, 030, 024 | KEEP |
| BTC-019 | Experience-Led hub | required hub path; none from article graph | 016, 010 | LOCK `/cluster/experience-led-travel/`→019; KEEP 016/010; generic BTC-035 edge removed |
| BTC-020 | Short Breaks hub | 018, 036 | 029, 036, 017 | KEEP |
| BTC-021 | BTC-022 | 023 | 022, 025, 024, 023 | KEEP |
| BTC-022 | Packing Systems pillar | 002, 011, 021, 023, 024, 039 | 024, 039, 011 | KEEP |
| BTC-023 | BTC-022 | 021, 040 | 022, 021, 025, 040 | KEEP |
| BTC-024 | BTC-022 | 002, 018, 021, 022, 030, 039 | 022, 030, 002 | KEEP |
| BTC-025 | BTC-026 / Travel Technology bridge | 009, 021, 023, 026, 037 | 026, 009 | KEEP; future SIM/eSIM guide remains BACKLOG_ONLY |
| BTC-026 | Travel Technology pillar | 025 | 027, 030, 025 | KEEP |
| BTC-027 | First-Trip/Resilience pillar | 026, 030, 041 | 041, 030, 035 | KEEP |
| BTC-028 | Group Trip pillar | 006, 031 | 006, 031 | KEEP 006/031; weekend-specific BTC-035 edge removed |
| BTC-029 | Short Breaks hub | 005, 008, 010, 016, 020, 045 | 010, 030, 035 | KEEP |
| BTC-030 | BTC-027 | 015, 018, 024, 026, 027, 029 | 027, 024, 018 | KEEP |
| BTC-031 | BTC-028 | 006, 028 | 028, 006 | KEEP; future Travel Money guide remains BACKLOG_ONLY |
| BTC-032 | BTC-035 | 034 | 035, 034 | KEEP |
| BTC-033 | Short Breaks hub / BTC-035 | 017, 035 | 035, 018 | KEEP |
| BTC-034 | BTC-035 | 032, 035 | 035, 032 | KEEP |
| BTC-035 | Saving & Trip Budgets pillar | 011, 012, 014, 015, 016, 027, 029, 032, 033, 034 | 034, 033, 013 | Four generic incoming edges removed; remaining links are contextual; ADD explicit pillar path to BTC-032 |
| BTC-036 | Sustainable Travel Rhythm pillar | 020, 037, 038, 040 | 037, 038, 040, 020 | KEEP |
| BTC-037 | BTC-036 | 009, 036, 038 | 036, 009, 025, 038 | KEEP |
| BTC-038 | BTC-036; budget cross-member | 036, 037, 039 | 036, 037, 039 | KEEP |
| BTC-039 | BTC-022 | 022, 038 | 022, 038, 024 | KEEP; anchors must preserve 022/039 scope boundary |
| BTC-040 | BTC-036 | 023, 036 | 036, 023 | KEEP 036/023; generic BTC-035 edge removed |
| BTC-041 | BTC-042 / First-Trip bridge | 010, 027, 042, 045 | 042, 010, 027 | KEEP |
| BTC-042 | Solo Female Travel pillar | 041, 043, 044, 045 | 041, 010, 043, 045 | KEEP; pillar should also expose BTC-044 |
| BTC-043 | BTC-042 | 042, 044 | 042, 044, 007 | KEEP |
| BTC-044 | BTC-042 | 043 | 042, 043, 017 | KEEP |
| BTC-045 | BTC-042 / Short Breaks hub | 042 | 042, 041, 029 | KEEP; anchors must preserve 029/045 scope boundary |

## Hub paths

| Non-article hub | Required outgoing members | Action |
|---|---|---|
| `/cluster/short-breaks/` | 016, 018, 020, 029, 033, 035, 045 | RETAIN as a planning route only; no route implementation in this phase |
| `/cluster/experience-led-travel/` | 017, 018, 019 | LOCK as a planning contract; this is BTC-019's required incoming path; no route implementation in this phase |

With the locked planned hub paths, there is no true orphan. In the article-only graph BTC-019 has zero incoming edges, so `/cluster/experience-led-travel/` is a required planning dependency rather than optional decoration.

## Over-link review

- BTC-035 has 10 planned incoming article edges after removing the four generic edges from BTC-017, BTC-019, BTC-028 and BTC-040.
- BTC-010 has seven incoming links, all tied to address/route fit for accommodation, arrival or a compact trip. Retain.
- No article has more than four outgoing planned article links, so there is no outbound-density problem.

## Link anchors

Examples of acceptable descriptive handoffs:

- BTC-039 → BTC-022: “build outfit compatibility inside the reset interval.”
- BTC-045 → BTC-029: “allocate the usable hours of a compact city break.”
- BTC-014 → BTC-013: “compare flexible dates before testing alternate airports.”
- BTC-041 → BTC-042: “return to the complete first-solo readiness plan.”

Do not create these as live links until the target routes exist in the authorized import/site phase.

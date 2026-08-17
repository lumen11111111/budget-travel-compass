# BTC-025 Research Notes

## Production brief
- Title: **A Minimal Travel Tech Kit That Still Works Offline**; slug: `minimal-travel-tech-kit`.
- Query: `travel tech packing list`; Tier A / HIGH.
- Promise: assign every device a job, model its failure, and provide an offline or secondary backup; remove gadgets with no unique job.
- Boundary: no app/eSIM/power-bank/adapter ranking, remote-work stay test, or destination plug guide.
- Utility: Device-Role and Redundancy Audit.

## Claim plan and research findings
1. Battery carriage: FAA currently places spare lithium batteries and power banks in carry-on only and requires removal from a gate-checked bag; airline and international rules may be stricter.
2. Offline maps: Google Maps can download areas, but offline limitations include unavailable transit, cycling and walking directions on the cited Android page; availability varies by place. This is a bounded example, not a universal app claim.
3. Plug vs voltage: IEC documents plug/socket systems and travel-adaptor standards. Physical compatibility does not establish a device's accepted input. The draft requires the traveler's exact manufacturer label/specification before use and does not recommend a converter.
4. Account access: CISA recommends MFA and travel-data backups. The draft adds a non-cloud-only recovery path without claiming one method fits every account.

## Sources
1. FAA, “PackSafe — Lithium Batteries” — https://www.faa.gov/hazmat/packsafe/lithium-batteries
2. FAA, “Carry-On Baggage Tips” — https://www.faa.gov/travelers/prepare_fly/baggage
3. Google Maps Help, “Download areas and navigate offline” — https://support.google.com/maps/answer/6291838?hl=en
4. IEC TR 60083 — https://webstore.iec.ch/en/publication/23628
5. IEC 60884-2-5 travel-adaptor scope — https://webstore.iec.ch/en/publication/31112
6. CISA, “Cybersecurity When Traveling” — https://www.cisa.gov/sites/default/files/publications/cybersecurity_when_traveling_tip_sheet_2022_092022.pdf

## Planned internal links
BTC-026 for AI tool authority/privacy; BTC-009 for remote-work accommodation; future SIM/eSIM guide for plan/provider comparison.

## Outline validation
The structure follows digital jobs, not devices: define critical jobs, assign the smallest owner set, model failure/offline backup, solve power compatibility, protect access/recovery, and remove redundancy.

## Pre-publication recheck
Re-open FAA and exact airline rules, exact device/charger input labels, destination plug system, current app offline limitations, account recovery settings and any connectivity provider terms.

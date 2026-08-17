# Budget Travel Compass — Wave 1 Publish Report

Date: 2026-08-17

Phase: 12 — Controlled Wave 1 Publish

Status: **WAVE 1 PUBLISH BLOCKED**

## Published IDs

The exact six-article allowlist was verified as Draft before execution. Publishing was staged with BTC-014 as the first canary.

| Content ID | Slug | Result |
| --- | --- | --- |
| BTC-014 | `nearby-airport-total-cost-test` | Published canary; integrity blocker detected |
| BTC-020 | `slow-travel-short-break` | Not changed |
| BTC-021 | `travel-daypack-setup` | Not changed |
| BTC-028 | `plan-group-trip` | Not changed |
| BTC-032 | `pre-trip-spending-swap-list` | Not changed |
| BTC-044 | `solo-dining-while-traveling` | Not changed |

Execution stopped immediately after the canary integrity failure. The remaining five allowlisted articles and all other articles were untouched.

## D1 Counts

Pre-publish baseline:

- Articles: 44
- Drafts: 44
- Published: 0
- Placeholders: 0
- Stored internal links: 129
- Aggregate `body_html` characters: 293,835
- Media rows: 0

Current fail-closed state:

- Articles: 44
- Drafts: 43
- Published: 1
- Placeholders: 0
- Stored internal links: 129
- Aggregate `body_html` characters: 293,862
- Media rows: 0

## Route Status

BTC-014 public route became HTTP 200 after the CMS Publish action:

- `https://budgettravelcompass.com/news/nearby-airport-total-cost-test`: 200

The remaining five Wave 1 articles were not published.

## Canonical

Not advanced to full six-route canonical QA because the fast-failure rule stopped the phase immediately after the canary integrity mismatch.

## Draft Isolation

No publication attempt was made for the remaining five Wave 1 articles or the other 38 articles. Current database counts show 43 Drafts and one Published canary.

## Sitemap

Not advanced to the final six-article sitemap gate because Wave 1 did not reach the required 6 Published / 38 Draft state.

## Category / Search

Not advanced to the final six-article category and search gate because the canary failed the body-integrity requirement.

## Link Safety

The stored internal-link count remains 129. Publication-aware link validation was not used to waive the body-integrity failure.

## Smoke QA

Not advanced to the BTC-014/BTC-044 1440px and 390px smoke matrix because the phase stopped before the six-article publish operation completed.

## Major Issues

The existing CMS Publish form successfully changed BTC-014 from Draft to Published and set:

- `published_at = 2026-08-17T00:00:00.000Z`
- `updated_at = 2026-08-17T10:13:15.447Z`

However, the same action also changed stored `body_html`:

- approved Phase 10.1 hash: `5a0c97bd7f16d207cc738e58db3c4ad0272f67d48d75025f614c270d2765de71`
- post-publish hash: `40fc93957ef4c725a214a688cf9743d884ebbc65eea3524d54474b7af2df2996`
- aggregate corpus body-character delta: `+27`

This violates the Phase 12 requirement that publishing change only status and publication time while leaving `body_html` unchanged. The six source bodies had passed a preflight preserve/sanitize stability check, but the live rich-editor form submission still produced a different stored body.

No direct SQL correction, Time Travel restore, runtime change, deployment, seed, R2 write, GA configuration, or Ads configuration was performed.

The pre-canary D1 Time Travel bookmark was captured read-only:

`00000016-00000034-000050ca-088199b37a318627ce443cc567c5bc10`

A restore is destructive and was not authorized by the Phase 12 specification, so it was not executed.

Worker version remains unchanged:

`d5ab9b59-57fd-4311-b3ff-77333cf476e5`

## Decision

**WAVE 1 PUBLISH BLOCKED**

The blocker must be resolved before publishing the remaining five articles. Current production state is 1 Published / 43 Draft, not the required 6 Published / 38 Draft.

# BTC-012 Research Notes

## Commission

- Production title: **How to Use Flight Fare Alerts Without Checking Prices All Day**
- Query: `how to use flight price alerts`
- Tier / freshness: Tier A / HIGH
- Outcome: create a bounded alert experiment with a comparable baseline, limited alert set, review cadence, buy conditions, and stop rule.
- Does not cover: predicting the cheapest booking day or performing the full flexible-date search.

## Claim plan

1. Define a route/date/fare specification before monitoring.
2. Establish a current comparable baseline, not a remembered “good price.”
3. Describe current alert features narrowly from platform documentation.
4. Treat forecasts and alert prices as signals, not guaranteed future or checkout prices.
5. Require airline/seller verification and turn off tracking after the decision.

## Source findings

- Google Flights lets signed-in users track routes, specific flights, searched dates, and in some cases “Any dates,” and send emails on significant changes; users can disable notifications or remove tracked items.
- Google says its price predictions are based on past trends and can be wrong.
- KAYAK currently documents multiple alerts, daily refresh plus real-time significant-change updates, management controls, and expiry conditions.
- KAYAK states that it is a search engine rather than the ticket seller; the airline or agency controls the transaction and refund policy.
- Google says bag-fee estimates come from partners and directs users to airline policy for actual limits and prices.

## Structural decision

The draft uses a monitoring-experiment structure: hypothesis, baseline, signal design, decision meeting, validation, shutdown. The Fare-Alert Rules Card is intentionally unlike BTC-011's calculator and BTC-013's search log.

## Planned internal links

BTC-013, BTC-015, BTC-035. No live links.

## Pre-publication recheck

Platform alert availability, sign-in, tracked-date options, notification behavior, management/deletion controls, prediction language, displayed inclusions, price availability, seller identity, and the chosen airline fare rules.


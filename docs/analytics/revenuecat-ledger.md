# RevenueCat Offline Ledger

Implemented October 7, 2026. This is an offline importer and reporting contract,
not a webhook receiver, a new RevenueCat destination, or evidence that production
delivery has been configured.

## Source Gate

Before exporting data, the billing/analytics operator must inspect the existing
RevenueCat destinations and choose the existing authoritative webhook archive.
Do not enable a competing stream of client-generated money events.

The archive producer must verify webhook authentication using the configured
RevenueCat integration. The engine cannot verify this from an exported JSON file.
`authenticated_webhook_archive` is a producer assertion, explicitly labelled in
every report. Use `unverified_archive` if verification has not been performed:
these events remain available for diagnostics but cannot contribute money.

Keep a private operational record of the actual destination, project/apps,
authentication verification, export method, pagination and lag policy. Do not put
tokens, signatures, subscriber attributes, email addresses or receipts into the
analytics archive or repository. Owner assignment and production acceptance are
still pending; importing a fixture does not satisfy them.

## Archive Contract

```json
{
  "format": "revenuecat_webhook_archive_v1",
  "exported_at": "2026-10-07T10:00:00Z",
  "source": {
    "provider": "revenuecat",
    "project_id": "actual-rc-project-id",
    "source_id": "existing-authenticated-archive",
    "app_ids": ["actual-rc-app-id"],
    "environments": ["PRODUCTION", "SANDBOX"],
    "verification_basis": "authenticated_webhook_archive",
    "verified_at": "2026-10-07T09:00:00Z"
  },
  "coverage": {
    "time_basis": "revenuecat_event_generated_at",
    "pagination_complete": true,
    "truncated": false,
    "window_start": "2026-10-05T22:00:00Z",
    "window_end": "2026-10-06T22:00:00Z",
    "delivery_watermark": "2026-10-07T08:00:00Z"
  },
  "events": []
}
```

Each `events` entry is the original `{ "api_version": "1.0", "event": { ... } }`
RevenueCat webhook envelope, optionally with a separately observed `received_at`.
An export timestamp is never substituted for webhook receipt time. Empty events
are valid; completeness still requires the producer's explicit coverage proof.
The manifest above is an example, not evidence for any real day.
Declare only the environments actually covered by the existing destination.
A sandbox-only archive cannot establish production coverage or zero production
money.

Event generation, receipt and export timestamps must be timezone-aware and
ordered. Source `app_ids` constrain the import; IDs from another app are rejected.
The engine retains a bounded whitelist of subscription/financial identifiers,
timestamps, amounts and lifecycle metadata, not arbitrary subscriber properties.

```bash
cd analytics-engine
python -B -m prawko_analytics ingest-revenuecat /private/path/revenuecat-archive.json
python -B -m prawko_analytics finance --start 2026-10-06 --end 2026-10-07 --out /tmp/prawko-finance.json
```

Dates are exclusive Warsaw window bounds. Optional `--as-of` is an explicit
timezone-aware timestamp. `context` includes the separate `financial` report;
`build_health(..., financial=report)` retains it without scoring a fake
single-currency revenue metric.

## Financial Passport

- Grain: `(RevenueCat project, app, environment, store, transaction, effect kind)`.
- Source: declared authenticated RevenueCat webhook archive, not client prices.
- Time: RevenueCat event generation in the report window. `purchased_at` remains
  separate; an adjustment is not silently moved back to the original sale day.
- Basis: `revenuecat_reported_gross_event_activity`, not store proceeds, settled
  revenue, bank payout, cash receipt or an FX estimate.
- Currency: purchased-currency decimal totals remain separate. Optional
  provider-converted USD is a separately labelled basis; missing USD is not zero.
- Effects: positive initial/non-recurring/renewal charges, signed refunds and
  refund reversals. Trial access, family sharing, restore, transfer, cancellation
  intent and temporary grants create no new financial charge.
- Completeness: producer coverage for every declared project/app, as-of export.
  Coverage manifests retain their original delivery watermark after a partial
  reimport. Delivery completeness does not establish financial settlement.
- Integrity: repeated provider ID/body is deduplicated; conflicting bodies remain
  visible and quarantined. Repeated transaction effects add no money. Conflicting
  amounts or ambiguous repeated refund/reversal cycles restrict the report.

An opt-in `include_history=True` view retains bounded available observations,
verification/provider-conflict/lifecycle/money-issue flags and canonical or
quarantined business effects. It does not change the default financial report.
`financial_scope_covered()` checks one explicit project/app independently of
unrelated incomplete sources; production coverage cannot come from sandbox.
The separate [financial cohort passport](./acquisition-finance.md) defines the
reviewed native/ASA/Apple/RevenueCat mapping and first-observed D7/D30 join.
The history also retains expiry, cancel reason, conversion flag and money kind.
The separate [billing-start learning passport](./billing-learning.md) uses
native/RevenueCat mappings independent of advertising, not current entitlement.
It can retain known paid-start learning despite conflicting refund amounts;
that does not weaken this ledger's strict monetary conflict gates.

Lifecycle observations separately retain trial start/conversion, renewal,
non-recurring purchase, auto-renew cancellation/resumption, billing issue,
expiration, pause, product change and transfer. Their count is explicitly provider
event grain, not distinct subscribers or unique payers. Historical subscription
lineage uses `original_transaction_id`; no account merger is inferred from aliases.

## Reconciliation

Client `purchase_succeeded` and `purchase_access_confirmed` are compared by
transaction, product and the existing installation ID. A fully supplied matching
project/app/store/environment is `matched`. A unique transaction/identity
candidate with missing scope is `unique_candidate_scope_incomplete`, not an exact
match. Missing IDs, conflicting identity/product, ambiguous scope and invalid
client payloads remain explicit.

Historical transactions can match a current access-confirmation observation
without entering the current report's financial window. Both
`financial_charge_observed` and `financial_charge_in_report_window` distinguish
known ownership from a new charge in the selected window.

A matched trial webhook proves observed trial access, not a charge. Client display
price never enters the financial sum. A renewal without a client capture is
expected; restore is not a new purchase. `paywall_view_id` is retained only as
client context, never fabricated on a server transaction. These are diagnostic
joins with unverified client export coverage, not an attribution rate.

## Acceptance

Local fixtures cover paid purchase, trial conversion, renewal without app events,
non-recurring purchase, cancellation/resumption, billing/expiry, refund/reversal,
duplicate delivery/business observations, conflicts, sandbox, partial/empty
coverage, immutable historical as-of, currency precision, PII stripping and
failed atomic replacement.

Still required externally: inspect existing destinations, export real data with
provenance, perform controlled production/sandbox acceptance and compare with
store/RevenueCat financial reports. Store proceeds and real acquisition D7/D30
reconciliation need authoritative financial/spend inputs and production mappings.
Do not declare the full
audit complete from the importer or its unit tests.

Primary schema reference: RevenueCat documentation,
`docs/integrations/webhooks/event-types-and-fields`, checked October 7, 2026.

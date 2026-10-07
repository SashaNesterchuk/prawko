# Acquisition And Spend Source Gates

The full N requirement is not complete. This passport covers the offline
Apple Ads aggregate importer/report. Installation-scoped ASA observations and
client/learning cohorts have their own [passport](./acquisition-cohorts.md).
The separate [financial cohort passport](./acquisition-finance.md) implements
source-gated D7/D30 gross associations and an exact-window expense diagnostic.
Store proceeds, paid engagement and ROAS are not established.
No new MMP, remote API, collection policy or native SDK call is introduced.

## Available Local Inputs

Inspected October 7, 2026:

| File | Declared Source Window | Currency / Timezone | Grain |
| --- | --- | --- | --- |
| `apple/Apple Ads Campaigns.csv` | September 12-20, 2026 date labels | EUR / UTC | campaign report-window aggregate |
| `apple/Apple Ads Campaign 2144614494 Keywords.csv` | same date labels | EUR / UTC | campaign/ad-group/keyword report-window aggregate |
| `apple/Apple Ads Campaign 2144614496 Keywords.csv` | same date labels | EUR / UTC | campaign/ad-group/keyword report-window aggregate |
| `apple/admob-report.csv` | dated rows September 12-20, 2026 | estimated USD earnings; timezone not present | UTF-16 tab-separated daily earnings, not spend |

The Apple Ads files carry no account ID, numeric app ID, actual export timestamp
or authenticated provenance assertion. Campaign start dates in entity rows are
not the report start. The CSV end-date label alone does not select inclusive or
exclusive calendar semantics. These must come from a reviewed source manifest.
No real manifest or fresh production import has been invented for these files.
Parser tests pair their actual formats with explicitly synthetic metadata.

Campaign and keyword spend are alternative granularities of the same source
costs. Their aggregate footer is not another entity. AdMob estimated earnings
are never Apple Ads acquisition spend or RevenueCat money.

## Manifest And Import

```bash
cd analytics-engine
.venv/bin/prawko-analytics ingest-spend /private/path/apple-ads.csv \
  --manifest /private/path/source-manifest.json
.venv/bin/prawko-analytics spend --start 2026-09-12 --end 2026-09-21 \
  --timezone UTC --granularity campaign_window --out /tmp/prawko-spend.json
```

The following is a **synthetic schema example**, not an authoritative manifest
for the existing CSVs. Replace scope IDs, clocks and end-date semantics using
actual export evidence; do not infer them from filenames or file modification
time. `reviewed_vendor_export` is a supplied source assertion, not parser
authentication.

```json
{
  "format": "apple_ads_csv_manifest_v1",
  "exported_at": "2026-09-22T12:00:00Z",
  "source": {
    "provider": "apple_ads",
    "source_id": "synthetic-source",
    "account_id": 123,
    "app_id": 456,
    "verification_basis": "unverified_csv"
  },
  "report": {
    "granularity": "campaign_window",
    "currency": "EUR",
    "timezone": "UTC",
    "date_end_basis": "inclusive_calendar_date",
    "window_start": "2026-09-12T00:00:00Z",
    "window_end": "2026-09-21T00:00:00Z"
  },
  "coverage": {
    "complete_scope": false,
    "entity_scope": "all_campaigns_for_app"
  }
}
```

`keyword_window` additionally requires `report.campaign_id` matching the CSV
preamble, `coverage.entity_scope=campaign_keywords`, and explicit keyword/ad-group
IDs. `campaign_window` permits `all_campaigns_for_app` or `filtered_campaigns`.
Scope is never promoted from filtered campaigns to the whole account/app.
Optional absent counters remain unknown, not zero.

Currency, timezone, report dates, absolute boundaries, granularity, entity IDs,
decimal money, count shapes, footer reconciliation and export/completeness
consistency are validated before writing. Daily/custom headers, unscoped entity
rows and empty CSVs are rejected rather than silently certified as a complete
zero-cost period. UTF-16 AdMob inputs are not accepted by the Apple Ads adapter.

The private ledger is `warehouse/spend/apple_ads/observations.json`. Imports are
idempotent and atomically replace only after a successful write. Separate
observations remain retained when source metadata or immutable bodies differ;
conflicting amounts/currencies/count bodies are not repaired by last-write
overwrite. Keyword and campaign names, bids, raw queries and country labels are
not persisted or exported by this adapter.

## Report Passport

`apple-ads-spend-v1` reports whole source windows only. It never prorates an
aggregate into days or combines campaign and keyword views. Overlapping
fully-contained aggregates for the same account/app/entity are not additive.
Partial-window observations remain unallocated and do not erase exact source
evidence. UTC and Warsaw calendar labels are not interchangeable.

Amounts use exact bounded Decimal arithmetic and stay separate by account, app
and currency. `--account-id` / `--app-id` select explicit namespaces. No FX rate
or campaign-to-exam-country mapping is inferred.

`unconflicted_observed_spend` is an observed subset, not a complete-period cost.
`declared_scope_spend` is present only for clean, whole-window source observations
with a reviewed and complete declaration on the same observation. It is still a
manifest-declared slice, not verified account lifetime or the entire requested
window. Independent partial/reviewed declarations are not combined into an
invented approved complete source.

Missing and nonoverlapping sources remain unknown/not loaded, not zero current
spend. Exact source zero amounts remain observed zero. `as_of` filters explicit
export timestamps; neither report dates nor the current machine clock become
receipt/export timestamps. Historical reports otherwise use the available
retrospective archive view.

`context.spend` exposes the default campaign report separately from
`context.financial`. Health accepts a supplied `spend` report in
`monetization.spend`; it does not reload a warehouse or compute a financial
ratio. Source expense is not a settled invoice, revenue or causal channel lift.
`roas=null` and `financial_reconciliation=not_joined` remain explicit.

## Acceptance And Remaining Work

Local tests cover actual CSV formats, synthetic manifests, atomic/idempotent
imports, source namespace isolation, exact decimals, conflicts, overlaps,
partial boundaries, timezone/currency/as-of gates and CLI/context/health
consumption. They do not authenticate the underlying vendor exports.

Still required: approved current source manifests and fresh exports, explicit
source-correction/revision policy, required additional daily adapters, financial
production app-scope declarations and real mature D7/D30 reconciliation with the RevenueCat ledger, dashboard
consumption and owner/external acceptance. ASA unavailable/Android/old builds
must not become organic; visit entry is never acquisition. Purchase checks
may resolve after a purchase, so event-time proximity is not an install join.

The complete remaining scope stays in [the A-R ledger](./handbook-implementation.md).

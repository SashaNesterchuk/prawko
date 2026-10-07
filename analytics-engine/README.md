# Prawko analytics engine

Deterministic layer for Prawko product analytics. The design is fixed in [docs/analytics/engine.md](../docs/analytics/engine.md). This package does not call a model.

```bash
cd analytics-engine
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/pytest

.venv/bin/prawko-analytics ingest ../docs/analytics/prawko-posthog-dump-2026-10-03.json
.venv/bin/prawko-analytics context --day 2026-10-03 --out /tmp/prawko-2026-10-03.json
```

`ingest` writes `warehouse/events/day=YYYY-MM-DD/events.parquet`. That directory is gitignored. Re-imports merge and deduplicate by provider UUID or scoped client event ID; overlapping partial dumps never replace previously observed rows. Writes use an atomic file replacement after a successful Parquet write.

Different client bodies sharing an event ID remain retained and quarantined with
`_warehouse_import_conflict`; they restrict rates and verified joins. Receipt/SDK
enrichment drift is separate from a client-body conflict.

Cross-partition `data-quality-v1` additionally observes business-operation
duplicates/conflicts, inherited pre-window replays and explicit receipt lag.
Dataset counts remain raw; analytical activity uses canonical observations.
Unknown metadata is not backfilled and repeated resume/abandon episodes are not
collapsed by session ID. Client financial reconciliation and identity history
retain source restrictions without changing server money or SDK identities.

```bash
.venv/bin/prawko-analytics data-quality --day 2026-10-03 --out /tmp/prawko-quality.json
```

See [quality grains, receipt-lag passport and acceptance](../docs/analytics/data-quality.md).

The quality report's `client_payload_validation` distinguishes legacy/v1/v2,
valid/invalid/not-defined and malformed/unsupported annotations at retained-row
grain. It never revalidates old events with current client rules. Unusable
annotations restrict dependent metrics/client transaction matching without
erasing independent learning or changing RevenueCat source money.
See [critical payload QA and local acceptance](../docs/analytics/payload-contracts.md).

`paywall-observations-v1` separately reports eligibility request/product outcomes
and immutable paywall/checkout input origins. Available pre-window stages,
scoped replay/conflicts, detached callbacks and unknown terminals remain
explicit. Current/native package refresh does not rewrite input origin.
Old journals have no invented current configuration; eligibility callbacks
do not manufacture calendar return or learning activity. This is count-only,
not trial exposure, billing, money or native-delivery acceptance.

```bash
.venv/bin/prawko-analytics paywall-observations --day 2026-10-03 --out /tmp/prawko-paywall-observations.json
```

Context includes `paywall_observations`; health derives supplied-row diagnostics
or accepts the warehouse report explicitly. See
[eligibility/origin contracts and remaining acceptance](../docs/analytics/paywall-observations.md).

Contract version 2 requires explicit export coverage before rates are eligible:

```json
{
  "coverage": {
    "pagination_complete": true,
    "truncated": false,
    "window_start": "2026-10-02T22:00:00Z",
    "window_end": "2026-10-03T22:00:00Z",
    "delivery_watermark": "2026-10-04T06:00:00Z",
    "application_ids": ["synthetic.native.bundle"]
  }
}
```

The producer must establish this coverage, including its delivery-lag policy. Do not invent it from `exportedAt`, a filename, or the last event. The watermark is a source assertion, not inferred from `capture()`. Historical dumps without the manifest remain usable for observed counts, but rates are prohibited with `incomplete_coverage`. Late imports update observed rows; coverage remains explicitly as-of, not a guarantee against all future offline events.

`context` retains the original grain throughout ordered funnel joins. The diagnostic paywall funnel has a 24-hour horizon; the version-2 install-level paywall conversion metric has an explicit one-hour horizon. Immature views are reported as `censored_units`, not failures. Missing join IDs and invalid critical client payloads prohibit rates.

`learning_d7_return` is separate from the historical any-product-event `d7_return`. Its `learning-v1` rule requires five unique accepted questions in a completed training, or a completed exam with every target question answered. It uses durable first-observed metadata, not native install time. `learning_time_to_value` reports achieved and censored observations together; its median applies only to achieved outcomes, not the whole cohort.

Health drilldowns now use installation-scoped training/exam session IDs. Legacy time pairing is labelled as a proxy, not a verified completion rate. Exam attempt completion uses a 24-hour mature horizon; newer starts are censored. `build_health(..., coverage_complete=True)` requires the caller to establish the same verified source coverage. The default is false: no reliable rates or ranked drops from an unverified window.

`compare` reads two context files and marks attribution `limited`, `prohibited`, or `not_applicable`. No client purchase outcome is verified revenue.

RevenueCat has a separate offline archive/ledger, without a new production receiver:

```bash
.venv/bin/prawko-analytics ingest-revenuecat /private/path/revenuecat-archive.json
.venv/bin/prawko-analytics finance --start 2026-10-06 --end 2026-10-07 --out /tmp/prawko-finance.json
```

The [source gate and financial passport](../docs/analytics/revenuecat-ledger.md) define provenance, decimal currency totals, trial/lifecycle separation, adjustments, dedupe, as-of coverage and scoped reconciliation. `context.financial` is source-reported gross event activity, not settled revenue or store proceeds. Existing production destinations and real store transactions still require external acceptance.

Spend reconciliation and collection-purpose controls remain tracked in [implementation status](../docs/analytics/handbook-implementation.md).

Apple Ads campaign/keyword CSVs now have a separate offline manifest-gated
importer. Whole source aggregates stay separate by account/app/currency/grain;
overlaps, conflicts and partial windows are not allocated or double-counted.
Old September sources never become current spend. No ASA or RevenueCat ROAS
join is inferred from this importer.

```bash
.venv/bin/prawko-analytics ingest-spend /private/path/apple-ads.csv --manifest /private/path/source-manifest.json
.venv/bin/prawko-analytics spend --start 2026-09-12 --end 2026-09-21 --timezone UTC
```

See [source manifest, spend passport and remaining N work](../docs/analytics/acquisition-spend.md).

ASA now has a separate installation-scoped observer and first-observed D7/D30
client/learning cohort report. Only explicit iOS terminals establish attribution;
super properties, visit entries and fallback SDK/account IDs do not. Available
history supports delayed attribution, including purchase before the ASA response.
Unknowns, invalid anchors, conflicts, maturity and coverage remain explicit.
Client purchase observations are not RevenueCat money or store proceeds.

```bash
.venv/bin/prawko-analytics acquisition --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --out /tmp/prawko-acquisition.json
```

Context includes `acquisition` / `acquisition_mix`; health accepts a supplied
history report or reports its limited supplied-row history. Compare adds both
window mixtures and an installation-grain confounder, never a causal effect.
The observation horizon is event time, not a historical delivery-as-of.
The client-only report does not fill financial D7/D30 or ROAS. See
[ASA identity, cohort and acceptance passports](../docs/analytics/acquisition-cohorts.md).

The separate first-observed financial report joins only explicit reviewed
native/ASA/Apple/RevenueCat app namespaces and available original transaction
lineage. D7/D30 source-gross activity retains per-currency adjustments,
production coverage, monetary horizons and unknown/conflicting ownership.
An exact same-currency campaign-window expense comparison is a subset
diagnostic, never store proceeds or ROAS.

```bash
.venv/bin/prawko-analytics ingest-acquisition-mapping /private/path/app-scope.json
.venv/bin/prawko-analytics acquisition-finance --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --as-of 2026-10-07T12:00:00Z \
  --out /tmp/prawko-financial-cohorts.json
```

`context.financial_cohorts` uses the context event-time horizon; health accepts a
supplied history report under `monetization.financial_cohorts`. Unknown sources,
legacy missing app namespaces and immature cohorts cannot become complete zero.
No real production app mapping or authoritative export has been invented.
See [mapping, financial passports and acceptance](../docs/analytics/acquisition-finance.md).

The separate `billing-learning-v1` report observes learning after available
trial starts or first positive canonical charges with an observed original
lineage. Its native/RevenueCat mapping does not depend on advertising IDs.
Activation, elapsed D7/D30, verified bounded trial revisions, cancellation
usage and post-activation calendar return retain maturity and independent
answer/open/start/outcome gates. It is not current paid access or money.
Client fractions additionally require producer-declared
`coverage.application_ids`, never app coverage inferred from observed rows.

```bash
.venv/bin/prawko-analytics ingest-billing-mapping /private/path/billing-scope.json
.venv/bin/prawko-analytics billing-learning --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --as-of 2026-10-07T12:00:00Z \
  --out /tmp/prawko-billing-learning.json
```

Context includes `billing_learning` with its own observation horizon; health
accepts a supplied report under `monetization.billing_learning`. Multiple
lineages and trial/paid memberships overlap and are not additive unique people.
No actual production source or review is created by the importer. See
[billing-start learning passports and acceptance](../docs/analytics/billing-learning.md).

The separate `onboarding-activation-v1` report keeps durable first-observed
roots distinct from persistent onboarding attempts. Accepted local completion,
foreground Home, open, entry, usable question, accepted answer, meaningful
learning and an ordered same-session chain retain independent gates.
Attempt learning is explicitly a temporal post-Home installation association,
bounded by the next observed attempt/reset, not a direct or causal join.
Elapsed 24-hour/D7/D30 and first-observed post-activation Warsaw calendar D1/D7
retain nonachievers, maturity, app coverage and unknown-root restrictions.

```bash
.venv/bin/prawko-analytics onboarding --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --out /tmp/prawko-onboarding.json
```

Context includes `onboarding`; health accepts a supplied history report or
returns `history_not_supplied`. Native install time, SDK install markers,
settings, steps and generic Home views do not create verified first-run
completion/activation. See
[onboarding/activation passports and acceptance](../docs/analytics/onboarding-activation.md).

`context.identity_links` derives observed installation/account intervals and
historical SDK identity quality signals without merging people or transferring
access. `context.feature_access` and health reports group local expected/observed
feature diagnostics, not verified paid access or automatic defects.

```bash
.venv/bin/prawko-analytics identity-links --start 2026-10-03 --end 2026-10-04 --out /tmp/prawko-identity-links.json
```

See [identity/access contracts and limits](../docs/analytics/identity-access.md).

`context.content_observations` and health reports separate selected locale fields,
declared mapper source provenance, actual rendered explanation fingerprints and
installation/session-scoped historical exam-rule observations. Missing origins
are not replaced by current app config; conflicts remain quarantined.

`context.repeat_answers` / health `repeat_answers` use `repeat-answer-v1`: ordered
accepted baseline -> explanation/review -> next distinct logical answer, with
seven-day censoring, revision/language/selection controls and scoped business
dedupe. Exam edits are not repeated learning. Descriptive fractions require
mature comparable pairs, clean integrity and verified coverage, and are never
causal explanation lift.

See [content/repeat-answer passports and acceptance](../docs/analytics/content-observations.md).

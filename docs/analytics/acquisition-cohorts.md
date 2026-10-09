# ASA Installation Observations And Cohorts

Implemented locally October 7, 2026. Full audit N is still active: this report
does not itself join spend or RevenueCat money, compute proceeds/ROAS, add an MMP or
change mobile attribution collection, retry scheduling, consent policy or SDK IDs.
Spend source gates remain in [acquisition-spend.md](./acquisition-spend.md).
The separate source-gated gross cohort join is documented in
[acquisition-finance.md](./acquisition-finance.md), not inferred from client
purchase observations.

## Sources And Identity

`asa-installation-v1` uses only explicit
`apple_search_ads_attribution_resolved` terminals and the primary, bounded
`app_user_id` installation identity. Provider person IDs, SDK fallback IDs,
account links and visit entries do not join acquisitions or purchases.
`asa_*` super properties on other events are not additional acquisitions or
substitutes for a missing terminal. No keyword text or campaign name is inferred.

An identical terminal replay contributes one installation observation. Different
results, IDs, claim/conversion types, dates or unavailable reasons on the same
installation quarantine that installation's attribution; last-write selection
does not repair it. Primary-ID import conflicts and invalid client payloads
remain source restrictions. Positive JS-safe integer source IDs are required
when present; strings, booleans and oversized values are not coerced. Optional
IDs remain null. A null keyword is not proof of Search Match, and a missing
org/campaign namespace cannot join a spend source.

Only explicit iOS terminals can establish `attributed`, `organic` or
`unavailable`. Missing checks are `unknown`; Android/web without a terminal are
`ineligible`, never organic. Platform disagreement on an installation quarantines
the terminal. `unavailable` remains a separate diagnostic result, not an organic
check. An inherited property alone cannot establish a terminal.

## Mix Passport

The mix grain is one `app_user_id` observed in `[start,end)`, not event rows,
unique accounts, new downloads or physical installations. ASA result plus
org/campaign/ad-group/keyword/ad and claim/conversion IDs define buckets; missing
dimensions stay explicit. All events carrying a primary identity can establish
an observed population member; this does not claim product activity or learning.

Available pre-window partitions can supply a terminal for a returning
installation. The report also retains their conflicts. `history_partitions_complete`
describes only available partition history, not installation-lifetime coverage
or historically delivered-as-of data.

Observed counts remain available under incomplete coverage. Mix shares require
verified metadata-v2 coverage of the requested observation window and clean
attribution/identity/platform integrity. `unavailable` report status means no
usable terminal in the observed mix, not a zero paid-acquisition count.
Unknown/unavailable/ineligible buckets are retained in the denominator; a known
subset is not promoted to the whole population.

`context.acquisition_mix` replaces the old fixed unavailable placeholder;
`context.acquisition` holds the full passport, installation observations and
cohorts. `compare.acquisition_comparison` exposes both windows and their
installation-grain bucket shift. With clean comparable mixtures, a shift at the
contract's ten-percentage-point threshold prohibits metric-change attribution.
Missing/invalid coverage or incompatible/legacy mixture shapes are `unverified`,
not stable. No causal attribution becomes allowed. The legacy
`compare.acquisition_mix` field still contains the baseline mixture.

## Cohort Passports

Cohorts use a unique durable `installation_observation_id` and
`first_observed_at`, version 1 and `first_local_observation`. The anchor can be
repeated on later events but is not moved to their event date, native install
time, purchase date or ASA response date. Memory-only/recovery, invalid/future/
naive anchors, conflicting timestamps/IDs and observation IDs shared between
installations are excluded and reported. Learning reset does not create another
acquisition. These are first-observed instrumentation cohorts, not verified
physical-new-install or Apple download cohorts.

For each ASA scope and D7/D30:

- Cumulative client purchase fraction uses the half-open elapsed horizon
  `[first_observed_at, first_observed_at + N * 24 hours)`.
- Its numerator is installations with a valid `purchase_succeeded` observation,
  explicit native completion, product ID and purchase attempt ID. Scoped
  transaction replays do not create new purchases; cross-installation transaction
  reuse and contradictory product/attempt observations are quarantined.
- Restore, `purchase_access_confirmed`, Plus flags and client prices do not enter
  this numerator or any money total. It remains a client observation, not a
  verified charge or a complete purchase history.
- ASA can resolve after the purchase or after the cohort selection window.
  Installation identity supplies the association, not proximity. The
  before-terminal diagnostic uses strictly earlier event time; tied ordering
  is not inferred.
- Cumulative meaningful-learning fraction uses the same elapsed horizon and
  the existing `learning-v1` threshold: completed training with five unique
  accepted questions, or a completed exam with every target question answered.
- Calendar learning return is separate: a meaningful completion on Warsaw
  calendar D+7 or D+30. Its entire return day must be observed; elapsed D7
  maturity alone does not mature the calendar-return denominator. Opens are
  not meaningful learning.

Each denominator retains only horizon-mature anchored observations. Immature
observations remain `censored_installations`, not failures, and observed
nonachievers remain in the mature denominator. Invalid purchase evidence
restricts purchase fractions, not an otherwise clean learning fraction; invalid
learning evidence similarly does not suppress purchase counts. Outcome issues
outside a horizon do not invalidate that horizon's outcome fraction.
Unjoinable identities restrict the dependent fraction. Channel fractions
require attributed/organic classification, clean dependent integrity and
verified full observation coverage. Small descriptive subsets are not benchmarks
or causal effects; excluded anchors and unknown scopes are explicit.

## Ordered Product Funnel

`product_funnel` is a separate client observation on the same ASA scope and
anchored installation. It does not join spend or RevenueCat proceeds. Steps, in
strictly later event time: accepted answer, completed practice exam,
`paywall_viewed`, `purchase_started`, `purchase_succeeded`. A purchase that
skips an earlier step stays in `purchase_outside_ordered_funnel`. The horizon
is 30 elapsed days from `first_observed_at`; an unfinished horizon is censored.
Successful purchases keep checkout-origin country, `plans`/`lifetime`, and
subscription versus lifetime. A later `exam_country` does not rewrite that
origin. Counts stay available when a fraction is withheld.

## Observation Horizon And Consumption

```bash
cd analytics-engine
.venv/bin/prawko-analytics acquisition --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --out /tmp/prawko-acquisition.json
```

`--end` is an exclusive Warsaw cohort/mix selection date. `--observe-through`
is a separate exclusive timezone-aware **event-time** horizon for delayed
attribution, learning and client purchase observations. It defaults to end and
must not precede it. It is not an export cutoff, provider receipt or verified
historical delivery-as-of. The loader reads available history through that
horizon and requires every overlapping requested day, including partial days.
No source coverage is manufactured from event dates or export time.

Context uses its own window end as the observation horizon. Health's default
observer sees only supplied current-window rows and declares that history scope.
`build_health(..., acquisition=report)` can retain a separately supplied
warehouse/history report without pretending the default rows supplied it.

## Acceptance And Remaining Work

Local fixtures cover producer terminal shapes, duplicate/conflicting histories,
super-property exclusion, primary installation namespace isolation, delayed
resolution, cross-install transaction/anchor conflicts, half-open elapsed and
Warsaw calendar horizons, nonachievers/censoring, scoped integrity, missing
partitions and CLI/context/health/comparison consumption. Extreme dates and
numeric IDs are handled conservatively. These tests do not establish native ASA
response delivery, actual historical completeness or ownership of source IDs.

ASA-cohort continuation verification, before the separate financial extension:
443 Python tests passed / one skipped for the missing
gitignored October 3 production dump; 52 mobile suites / 388 tests passed.
Typecheck retains the same five baseline errors documented in the A-R ledger.
`git diff --check` passed. That ASA-cohort continuation changed no mobile runtime
source and ran no native build, Maestro, simulator, Xcode, checkout, commit or
deployment. Current financial verification is recorded in the A-R ledger.

The separate `acquisition-financial-cohorts-v1` implements explicit app mapping
and source-gated mature gross D7/D30 associations. It requires native application
observations and reviewed declarations; none is invented for production.
Still required: actual reviewed production mappings and authoritative archives,
store proceeds, approved fresh spend manifests and correction/daily-source policies, paid/trial
engagement cohorts, dashboard consumption and owner/production acceptance.
`financial_reconciliation=not_joined` and `roas=null` remain deliberate.
No financial metric is filled from these client cohorts.

The full remaining A-R scope stays in
[handbook-implementation.md](./handbook-implementation.md).

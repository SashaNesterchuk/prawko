# Observed Billing-Start Learning

Implemented locally October 7, 2026. `billing-learning-v1` observes learning
after an available RevenueCat trial or first positive charge with an observed
original lineage. It is not a current-paid/active-trial entitlement timeline.
Full M/N and the [A-R ledger](./handbook-implementation.md) remain active.

Only offline analytics changes. Offers, checkout, restore, access, quotas,
scoring, training, identity and scheduling are unchanged. PL remains
`P1W/P1M/P3M`; CZ/SK remain one-time lifetime. No approved collection purpose,
production review, delivered source window or native acceptance is invented.

## Sources And Mapping

The existing [RevenueCat archive](./revenuecat-ledger.md) supplies production
start/lineage observations, canonical positive charges and lifecycle metadata.
`include_history=True` additionally retains expiry, cancellation reason,
trial-conversion flag and monetary classification. The default finance report
and its strict financial integrity rules remain unchanged.

Billing mapping is independent of ASA/Apple Ads: Android or an unattributed
installation does not need an advertising namespace to join its billing
observations. Every native app, RevenueCat project/app and store is explicit.
This **synthetic, unreviewed example** does not declare a real mapping:

```json
{
  "format": "billing_app_scope_manifest_v1",
  "declared_at": "2026-10-07T12:00:00Z",
  "source": {
    "source_id": "synthetic-operator",
    "verification_basis": "unreviewed_mapping"
  },
  "scope": {
    "application_id": "pl.synthetic.bundle",
    "revenuecat_project_id": "synthetic-project",
    "revenuecat_app_id": "synthetic-app",
    "store": "APP_STORE",
    "environment": "PRODUCTION",
    "identity_basis": "shared_installation_app_user_id"
  },
  "validity": {
    "window_start": "2026-09-01T00:00:00Z",
    "window_end": "2026-11-01T00:00:00Z"
  }
}
```

Only `reviewed_app_scope_mapping`, with `reviewed_at <= declared_at`, can pass
the mapping gate. The declaration must cover the entire observed half-open
measurement interval. Overlapping incompatible scopes and reuse of a
native/store or RevenueCat app namespace restrict the join; "latest review"
does not resolve conflicts. `warehouse/revenuecat/app-scopes.json` retains
declarations atomically/idempotently, including unreviewed ones.
Both review and archive authentication remain producer/operator assertions.

Client joins require primary `app_user_id` and
`application_id_basis=native_application_id`. Country, language, Plus state,
SDK fallbacks and accounts cannot supply missing namespaces or ownership.
Original subscriber IDs and aliases must agree on the shared installation;
transfers and provider/charge conflicts remain explicit restrictions.
An unrelated app with independent store transactions cannot suppress a clean
cohort. Reuse of a store transaction across apps is a conflict, not independence.

## Start And Learning Passports

- Grain: RevenueCat project/app/store/original lineage/start kind. Subscription
  origins require an observed initial purchase and original transaction ID;
  non-recurring purchases use their own transaction.
- Selection: billing-start generation in `[start,end)`. Trial starts use the
  observed initial `TRIAL`; paid starts use the first available positive
  canonical charge with an observed origin, not a Plus boolean, display price,
  restored access or latest subscriber ID.
- Paid kinds: `direct_paid`, `non_recurring_paid`, explicit `trial_conversion`,
  `first_observed_paid_after_trial`, or `first_observed_paid` after a zero-price
  nontrial origin. A missing conversion flag is not inferred. Renewals without
  an origin are not reanchored as new customers.
- Membership: trial and paid units and multiple lineages can overlap. Cohort
  people, session and answer counts are not additive unique populations.
- Segmentation: latest unambiguous, usable native-app client snapshot at or
  before start generation supplies country/category/locale/bank revision.
  Later outcomes cannot supply origin dimensions; missing context stays null.
- Learning: unchanged `learning-v1`, five unique accepted training questions
  in a completed training, or a completed exam with all target questions
  answered. Partial/short completion and app opening are not meaningful learning.
- Answers: installation/session/answer IDs and valid correctness are required;
  exam answers require `answer_action=create` and an answer revision ID.
  `update`, automatic timeouts, provider replays and business replays do not
  add accepted answers. Starts and `app_visit_started` are separate observations.
- Denominator: all mature observed start candidates in that group, including
  covered nonachievers. Uncertain membership or a dependent integrity defect
  prohibits the corresponding fraction; diagnostic counts can remain visible.
- Windows: `activation_24h`, elapsed `d7`/`d30`, and bounded `trial_phase`.
  Upper bounds are exclusive. Immature units remain censored, never failed.
- Post-activation: first meaningful completion observed within D30 anchors
  Warsaw calendar D1/D7 learning return. These are not rolling 24-hour or
  app-open retention. The activation prefix has its own integrity gate;
  unrelated late D30 defects cannot erase an earlier clean anchor.
- TTV: time from billing generation to observed meaningful completion.
  Nonachievers and censored units remain counted. Median scope is observed
  achievers only, not the whole cohort or study time.

Common ownership/mapping/source issues and answer/open/start/outcome issues
remain separate. A bad answer cannot erase clean completion/open rates; a bad
completion cannot erase clean accepted-answer/open rates or cancellation usage.
Conflicting refund amounts do not erase a known positive paid start: this
consumer does not compute money. Financial cohorts retain their stricter
refund/adjustment gates.

## Trial Phase And Cancellation

Trial phase starts at observed trial generation and uses the initial declared
expiry, revised by verified `SUBSCRIPTION_EXTENDED` observations bound to the
same trial transaction/product. Revisions require continuity before the
previous expiry and a non-regressing declared expiry. Tied contradictory
contracts are not ordered by provider IDs. Identical tied contracts retain their
provider IDs as one revision observation, not multiple trial periods.

Earlier canonical paid generation or verified original-trial `EXPIRATION`
caps the phase. Later normal-period amendments do not rewrite a closed trial.
Missing initial expiry, gaps, ambiguous products/periods and conflicting
revisions make the phase unknown; no fixed three-day trial is invented.
Possible paid/expiry events with missing scope/amount restrict the affected
trial phase or cancellation prefix without erasing unrelated post-start
learning. Phase amendments are not evidence of current active entitlement.

Verified `CANCELLATION`, `UNSUBSCRIBE`, `TRIAL` observations retain provider
event grain. Usage is accepted answering in `[trial_start,cancel_generation)`,
not an app opening or learning completion. Same-time/later answers are not
prior usage. Clean original-period/source/answer evidence yields `used` or
`unused`; unknown phase/coverage/contracts yield `unknown`. Missing expiry
does not hide an observed cancellation.

Repeated identical provider delivery deduplicates in the archive. Distinct
provider IDs can represent multiple observations, including repeated
cancel/resume cycles; they are not collapsed into guessed physical cancellations.
`trial_cancel_usage` counts provider observations; `trial_cancel_observed_units`
counts units with at least one observed cancellation. Neither is unique people,
churn or revocation of access.

## Coverage And Clocks

Every overlapping client partition must retain verified metadata-v2 coverage
and a bounded explicit `coverage.application_ids` list containing the mapped
native application. Pagination/truncation, timestamps and watermark must cover
the measurement. Malformed retained coverage restricts rates without crashing.
Observed event namespaces cannot manufacture coverage for empty app activity.
Legacy app-unscoped coverage keeps diagnostics but cannot establish zero usage.

RevenueCat coverage must separately cover the mapped production project/app
interval. Sandbox/family-share records create neither start membership nor
production zero. Available history is not installation-lifetime coverage.

`observe_through` is the exclusive event-time horizon, defaults to end and
cannot precede it. `as_of` cuts RevenueCat exports and mapping declarations.
Without an explicit cutoff, mapping availability uses the financial export
as-of. Historical client delivery-as-of remains unverified. Client event clocks
and RevenueCat generation are normalized, not proven synchronized.

## Consumption And Acceptance

```bash
cd analytics-engine
python -B -m prawko_analytics ingest-billing-mapping /private/path/billing-scope.json
python -B -m prawko_analytics billing-learning --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --as-of 2026-10-07T12:00:00Z \
  --out /tmp/prawko-billing-learning.json
```

CLI dates are exclusive Warsaw start-selection bounds. Context serializes
`billing_learning` using its own end as observation horizon, so new D7/D30
cohorts stay censored. Health accepts
`build_health(..., billing_learning=report)` under `monetization.billing_learning`;
it does not pretend to load archive history or verified money.

Local fixtures exercise mappings, scope/transaction isolation, ownership,
source coverage, nonachievers, domain-specific integrity, answers/replays,
trial revisions/caps/gaps, cancellation grain/timing, maturity, as-of and
CLI/context/health serialization. Completed broad verification passes 615 Python
tests / one skipped for the missing gitignored October 3 production dump and
53 mobile suites / 398 tests. Typecheck retains the five baseline product-path
errors in the A-R ledger; `git diff --check` passes. No build, Maestro,
simulator, Xcode, native checkout, production mutation, commit or deployment ran.

Still required: reviewed real production mappings, authoritative archives and
app-scoped delivered client windows, synchronized-clock validation, actual
native billing/lifecycle acceptance, outcome-specific country/content and
acquisition-specific paid/trial segmentation, current-entitlement timelines if separately required, dashboard
consumption and approved privacy purposes. No local unit test proves these.

Primary schema reference: RevenueCat documentation,
`docs/integrations/webhooks/event-types-and-fields`, checked October 7, 2026.

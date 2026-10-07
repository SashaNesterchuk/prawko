# Observed Onboarding And Activation

Implemented locally October 7, 2026. `onboarding-activation-v1` reports durable
first-observed installations separately from persistent onboarding attempts.
It is not a physical-install, person, native-delivery or causal-onboarding report.
Full G/M and the [A-R ledger](./handbook-implementation.md) remain active.

Only analytics changes. No onboarding steps, routing, reset operations,
questions, scoring, access, quotas, identity or billing rules change. PL remains
`P1W/P1M/P3M`; CZ/SK remain one-time lifetime. No production export, approved
collection purpose, native acceptance or owner assignment is invented.

## Source And Root Passports

| Population | Grain | Selection And Evidence |
| --- | --- | --- |
| `first_observed` | Durable `installation_observation_id`, bound to a primary installation ID. | Declared `first_observed_at` in `[start,end)`, observation contract v1 and `first_local_observation`; not native installation time or an SDK install marker. |
| `onboarding_attempt` | Installation-scoped persistent `onboarding_attempt_id`. | Declared `onboarding_started_at` in `[start,end)`, flow `category_schedule_v1` / `onboarding`, persistent storage and a usable explicit entry. Restarts preserve the same root; reset can create another attempt, not another installation. |

Sources are the actual client producers:
`mobile/src/analytics/install-observation.ts`,
`mobile/src/analytics/onboarding-observation.ts` and
`mobile/src/analytics/AnalyticsScreenTracker.tsx`. The persistent attempt snapshot
is observed on `onboarding_flow_viewed`, `onboarding_flow_completed` and
`onboarding_home_arrived`. `settings` events do not create first-run attempts.

First-observed declarations require an aware nonfuture clock, strict numeric
version 1, a safe observation ID and primary `app_user_id`. Attempt candidates
retain missing/invalid views, orphan completion, clock/binding conflicts,
memory-only/recovery observations and shared IDs as explicit limitations,
not clean denominator members. Nullable completion/Home/reset fields must
actually be present: a missing key is not a verified null.

Application namespace must use `application_id_basis=native_application_id`.
The earliest first-observed declaration cannot obtain a missing native namespace
from later learning. Account, SDK fallback, person, country and locale IDs
cannot supply missing ownership or application scope. Conflicting namespaces
or observation IDs shared by primary owners prohibit clean root claims.

Country/category/locale/bank revision are retained from the earliest usable
root declarations, or null if missing/ambiguous. For attempt origins this is
the explicit view snapshot, not a later Home/learning snapshot. Conflicting
start-reason/reset bindings become unknown; input/export order does not choose
one of the alleged origins.

Malformed/unjoinable v1 roots cannot be dropped to improve fractions. Their
possible selection interval restricts the corresponding application population;
missing app scope restricts all candidate app scopes. A future declared clock
cannot prove that a root is outside selection. An exact already-confirmed
first-observed binding on a nonprimary learning observation does not create
another unknown root: its dependent domain remains restricted and the outcome
is still not joined through the observation ID.

## Milestones And Fractions

Every measurement retains distinct domains:

- `local_completed`: usable explicit completion with
  `completion_source=finalize_local` and
  `completion_scope=local_store_operations_returned`. Its declared
  `onboarding_completed_at` is accepted local calls returning, not physical
  storage flush, capture time or delivery.
- `home_observed`: usable explicit foreground Home with
  `home_arrival_basis=foreground_route_observed`. Its declared
  `onboarding_home_observed_at` is separate from completion and capture time.
- `ordered_home`: the Home snapshot additionally has the same accepted clock
  as an observed explicit completion from that attempt. Missing/contradictory
  binding restricts this domain, not an independently clean Home observation.
- `opened`: valid `app_visit_started` / visit ID, not learning.
- `learning_entry`: observed training/exam start or resume with a session ID,
  not a usable question or a completed attempt.
- `usable_question`: `learning_screen_ready` with training/exam feature and
  session/question IDs, actual ready reason/scope, nonnegative wall/foreground
  durations and `media_readiness=not_measured`. It does not prove media playback.
- `accepted_answer`: valid installation/session/answer/question IDs and
  boolean correctness. Exam observations additionally require
  `answer_action=create` and a revision ID. Updates, automatic timeouts and
  provider/business replays do not add accepted activity.
- `meaningful`: unchanged `learning-v1`, completed training with at least five
  accepted unique questions, or a completed exam with every target question
  answered. Short/partial sessions do not qualify.
- `ordered_learning_chain`: entry -> usable question -> accepted answer ->
  meaningful completion in the same installation-scoped training/exam session.
  Real timestamps or a matching app-run sequence prove order; input/export order
  and legacy runtime IDs do not. Contradictory/unknown order restricts the chain
  without erasing independently clean stage observations.

For attempts, learning domains are named `after_home_*`. Product learning events
do not carry the persistent onboarding attempt ID. Association is therefore
explicitly temporal within the same installation, after observed Home until the
next observed attempt or confirmed reset, not a direct attempt or causal join.
Later attempts outside root selection still bound an older selected attempt.
Same-clock Home/learning needs actual order evidence. Tied distinct attempt
origins or an unbound reset tied with origin restrict learning association,
not independently observed completion/Home. A reset tied with its own matching
origin operation is not another supersession. Canonical reset delivery is used;
a delayed replay cannot clip learning again.

Malformed/unjoinable later attempts or reset confirmations restrict the
affected post-Home horizons instead of creating clean zero/nonzero association.
Reset intent without a verified confirmation has its own uncertain boundary:
a failed helper is not proof of either a successful reset or an unchanged
product state. These restrictions do not erase first-observed learning or
independently clean completion/Home. An uncertain late boundary after a known
supersession does not reopen that already-closed association. Unknown root
selection clocks still have the broader population-membership gate; capture
time cannot narrow their unknown membership to a later horizon.

Denominator is all mature observed candidates in the group, including covered
nonachievers. Numerator is the mature candidates with the corresponding observed
milestone. Uncertain root membership, common coverage/identity defects or that
domain's integrity defect make its fraction null; diagnostic observed counts
remain available. A bad answer does not erase clean completion/open fractions;
a bad explicit local completion does not erase a clean Home/learning observation.
Home alone and onboarding steps are never meaningful activation.

## Windows, Clocks And Coverage

Elapsed windows are `activation_24h`, `d7` and `d30`, anchored to the selected
root's declared clock, not a changed native-install/reset timestamp.
Upper bounds are exclusive. Immature roots stay censored, not abandoned.
Valid or malformed completion/Home stages outside a measurement horizon cannot
create its milestone or its missing-binding restriction. Retained immutable
provider/business conflicts are not repaired with a first/last-write policy.
Late capture can still supply an earlier declared acceptance/Home observation;
this is not historical delivery-as-of.

For first-observed units only, first meaningful learning observed within D30
can anchor `post_activation_calendar_d1` / `post_activation_calendar_d7`.
These are Warsaw calendar days, not rolling 24-hour windows or app-open return.
The activation prefix has its own integrity/coverage gate, so an unrelated
later D30 outcome defect does not erase an earlier clean activation anchor.
Attempt post-Home frames and first-observed frames overlap and are not additive
unique people.

TTV is elapsed root-to-observed meaningful-completion time. Each frame retains
observed achievers, not-achieved-as-of units and mature/censored counts.
`median_achieved_seconds` requires clean relevant evidence and applies only
to observed achievers, not the whole cohort or minutes of focused study.

Every overlapping client partition requires metadata version 2 and producer
coverage with complete pagination, no truncation, bounded explicit
`coverage.application_ids`, valid window bounds and delivery watermark covering
the application/measurement interval. Malformed retained coverage restricts
fractions without crashing. Observed event namespaces, filenames, the last event
or `exportedAt` do not establish full coverage or zero learning.
`client_source.py` shares this gate/history reader with billing-learning without
weakening financial/archive/mapping gates.

Available pre-window client partitions support roots, replay detection and
boundaries, not installation-lifetime completeness. `observe_through` is the
exclusive event-time horizon, defaults to end, and cannot precede it. Source
coverage is a producer assertion, not proof of native SDK delivery or
synchronized clocks; historical delivery-as-of remains unverified.

## Consumption And Acceptance

```bash
cd analytics-engine
python -B -m prawko_analytics onboarding --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --out /tmp/prawko-onboarding.json
```

CLI dates are exclusive Warsaw root-selection bounds. `context.onboarding`
uses the context end as its horizon, retaining immature cohorts. Health accepts
`build_health(..., onboarding=report)` as `health.onboarding`; without a supplied
report it returns `history_not_supplied`, not invented app-scoped history.
Context JSON serialization preserves the report and its gates.

Synthetic acceptance fixtures cover distinct roots, restart/reset/history,
nonachievers, stage/domain isolation, wrong Home/completion binding,
delayed capture, exclusive/mature bounds, Warsaw calendar return,
unknown/future/malformed roots, app scope, nullable fields, safe provider IDs,
business replays, tied/uncertain attempts/resets, intent without confirmation,
known closed associations, ordered same-session learning,
malformed coverage and CLI/context/health integration. Controlled mobile
producer/screen-tracker tests remain separate from native navigation acceptance.
Exact broad verification is recorded in the A-R ledger.

Still required: actual delivered application-scoped production windows,
native storage/navigation/callback acceptance, clock validation, approved
privacy purposes/controls, assigned metric owners, outcome/acquisition-specific
segmentation and separate dashboard consumption. Local tests do not establish
these, exactly-once product/analytics transactions or causal onboarding lift.

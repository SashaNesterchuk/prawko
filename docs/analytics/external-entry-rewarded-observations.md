# External Entry And Rewarded Observations

Implemented locally October 7, 2026 as part of the still-active A-R audit.
These observations do not change routing, notification scheduling, checkout,
access, scoring, ad policy or reward grant behavior. No native build, Maestro,
simulator, Xcode, production destination change or real checkout is performed.

## External Entry Contract

`entry_observation_version=1` records an analytics-only `entry_observation_id`,
signal kind/origin, signal receipt and processing timestamps, explicit scope
and normalized target metadata. `client_signal_processing_not_tap` is the time
basis: neither a live response nor the cached last OS response supplies a tap
timestamp. Legacy `entry_attributed` remains a live/cached signal flag; the new
scope, not that flag alone, determines report eligibility.

- Scope is installation + entry ID + explicitly bound foreground visit.
  Account/person identity and nearby timestamps never replace these IDs.
- An inactive/cold signal can bind within sixty seconds. A response waiting in
  the existing storage queue cannot bind to a different processing visit or a
  much later foreground visit. Failed receipt clocks are not replaced by
  processing time.
- Cached OS responses remain unattributed and do not supersede a live entry.
  The existing serialized storage queue and last-fifty response dedupe remain
  unchanged. A cached response can later receive live resolution without another
  `notification_opened`.
- A duplicate live response in the same observation/visit preserves the first
  entry ID, receipt time and horizon. Warehouse duplicate response fingerprints
  under different entry IDs restrict learning fractions instead of adding taps.
- Dynamic entities use the screen tracker's first scalar parameter precedence:
  `sessionId`, `session`, `signId`, `categoryId`, `topicId`. Unrelated lower
  priority parameters are not conflicts; selected path/query disagreements are.
  IDs leave the parser only as `content-v1` comparison fingerprints.
- Targets and actual destinations retain normalized route patterns. Analytics
  comparisons recognize tabs/onboarding route-group aliases. Unknown routes,
  rejected entities and malformed URLs remain explicit; raw URLs/query text
  never enter these observations.

`external_entry_destination_observed` records route/entity match, normalized
phase and whether it was a preexisting route snapshot, later route transition
or view-state observation. `question_with_error` is usable because the exam
source explicitly marks its question ready; this is not an error-free rendering
claim. Loading, blocked, error, other and unverified entity states stay separate.

Destination observation has a half-open sixty-second horizon and a bounded
thirty-two-observation limit. `external_entry_destination_ended` is observation
termination, not a routing failure. Association can continue in the same visit
for the half-open one-hour horizon, ending at background, supersession or an
observer/clock boundary. `external_entry_ended` never changes product timers.
Capture/ID/clock/listener failures cannot drive navigation.

## Notification Learning Passport

`context.external_entries` and `health.external_entries` expose
`external-entry-v1` with the same window and coverage policy.

- Source grain is an installation-scoped entry observation with a bound visit;
  the paired entry-resolution/notification-open events do not add root units.
  Cached, queued-unattributed and unbound entries remain separate diagnostic
  outcomes, not live attribution.
- Learning requires an ID-linked training/exam start or resume after the source,
  a newly accepted logical answer in that attempt after start/resume, and a
  subsequent `meaningful_learning()` completion in the same explicit foreground
  visit and association horizon.
- Meaningful training declares at least five unique accepted questions.
  Meaningful exam declares all target questions answered and completed status.
  Existing result views, replayed completions/answers and exam answer edits are
  not new learning. Exam creates require an observed answer revision ID.
- Equal timestamps require `app_run_id` and ordered `event_sequence`.
  Input/export order and a legacy `runtime_id` do not establish order.
- A known visit/association closure or a same-visit checkpoint reaching the
  horizon establishes follow-up. Missing visit tails, early observer unmount,
  invalid clocks and short report windows are censored even when an early
  completion was observed. `observed_achieved_units` retains those positives
  separately from mature achievements.
- Mature nonachievers remain in the denominator. The mature learning fraction
  requires verified import coverage and clean entry/destination/learning
  integrity. Orphans, conflicting bindings, late foreground binding, duplicate
  business scopes and invalid payloads prohibit the fraction.

Destination snapshots are not dispatcher/native success, notification delivery
or proof the link caused navigation. Learning associations have a low confidence
ceiling and never establish causal reminder lift or acquisition attribution.
No schedule-to-delivery rate or openers-versus-nonopeners effect is fabricated.

## Rewarded SDK Contract

Ads remain disabled by the existing `enableAds=false` configuration.
Versioned rewarded observations use installation + request + impression/SDK
instance IDs, placement `exam_unlock`, test/configured unit basis and whether
native load invocation or fullscreen opening was observed.

- `ad_requested` is an opportunity, not proof that SDK load ran.
  Disabled and missing-unit outcomes stay separate.
- `ad_native_request_started` observes the existing `load()` invocation.
  It is not a loaded ad or network/provider receipt.
- `ad_shown` observes `OPENED`, not a dedicated impression callback.
  Installed `react-native-google-mobile-ads` 16.3.4 exposes no fullscreen
  `AdEventType.IMPRESSION` callback; its Android fullscreen `onAdImpression()`
  is unimplemented. This does not describe banner/native-ad APIs.
- `ad_impression_observed` explicitly uses valid SDK `PAID` callback evidence,
  once per rewarded instance. `ad_impression_revenue` retains currency,
  precision, callback sequence and whether the product terminal was already seen.
- Only the optional PAID listener remains for two seconds after settlement.
  Existing product listeners detach and the result promise resolves immediately.
  PAID never grants exam credit; existing `EARNED_REWARD` behavior is unchanged.
  Native constructor rejection remains a rejection.
- `ad_failed` gains a normalized failure category/stage, including disabled,
  missing unit, no-fill, network, invalid request, internal and unspecified SDK
  failure. Codes/messages are not exported by this observer.
- `ad_observation_failed` is optional listener/payload failure, not product ad
  failure or reward revocation. Its exceptions are contained.

## Rewarded Report Passport

`context.rewarded_ads` and `health.rewarded_ads` expose `rewarded-sdk-v1`.
Stages separately count opportunity, SDK load invocation, fullscreen opening,
PAID impression evidence, earned callback and terminal observations.

Scoped PAID values require ordered native request and PAID impression evidence.
Identical callbacks add one impression/value. Conflicting amounts, currencies,
precisions, request/instance bindings or invalid payloads stay visible and are
quarantined from sums. Currency decimal amounts remain separate; unversioned
interstitial observations are not silently migrated into the rewarded contract.
Late PAID callbacks remain inspectable and add no reward grants.

`sdk_paid_values.basis=client_sdk_paid_value_not_settled_money`: even clean values
are client SDK observations, not settled revenue, store proceeds, AdMob financial
reconciliation or verified production delivery. They never enter RevenueCat
financial totals. Optional observation failures limit the report, not the
product result. Missing terminals remain unknown, not successful grants.

## Verification And Remaining Acceptance

Local tests cover pure observers, actual lifecycle hook wiring with controlled
OS/storage adapters, queued/cached/live boundaries, aliases/entity precedence,
both horizons, failures/privacy, ordered learning/dedupe/censoring, SDK failures,
late/duplicate/conflicting PAID, import/context/health/CLI and QA propagation.
Interpretation IDs are added without rewriting earlier meanings.

The completed local broad runs pass 52 mobile suites / 388 tests and 273 Python
tests / one skipped missing production dump. Typecheck retains the five
pre-existing errors listed in the implementation ledger; no new analytics error
remains. Local test results are not production/native acceptance.

Controlled adapters are not rendered native navigation, real SDK callbacks,
notification delivery or queue-delivery acceptance. Production exports,
native ad acceptance before any separately approved re-enable, AdMob financial
reconciliation, real reminder/link traces and separate dashboard consumption
remain unverified. Other A-R requirements stay in
[handbook-implementation.md](./handbook-implementation.md).

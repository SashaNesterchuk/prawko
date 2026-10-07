# Critical Payload QA

`analytics_payload_contract_version=2` describes client observation QA, not
the engine contract or `analytics_schema_version`. Event names, triggers,
business decisions and SDK identities keep their previous meanings.

## Producer Contracts

`AnalyticsTrack` requires an explicit payload argument for every catalog name.
Event-specific fields currently cover checkout/restore/recovery, paywall
view/CTA/selection/availability/eligibility, training/exam milestones, media,
identity/install/onboarding, and the new external-entry/rewarded observations.
The foreground app/screen lifecycle, usable-learning readiness and access-state
snapshots, learning intents/operation failures, screen observations, reminder
permission/schedule helpers, offline-pack operations and progress reset also
have event-specific contracts. Core learning interactions additionally cover
feedback, result/review exposure/actions, abandonment/empty, exam
launch/resume/end/navigation/flags, explanation/diagnostic/reminder intents,
result restart, offline blocks and category mismatch.
The source/type-checker inventory is
**113 typed events / 176 canonical names**, with 113 explicit runtime contracts;
**63 names remain without event-specific caller contracts**.
The remaining catalog still accepts scalar `AnalyticsProperties`; this is not
full-catalog typing or acceptance.

`NoInfer<EventName>` prevents a wrong payload from broadening the literal event
name during type inference. The checks in `src/analytics/type-tests/` are
included by `mobile/tsconfig.json`. They reject missing IDs, wrong fields/enums,
unsupported domain meanings and mismatched event payloads. They additionally
check canonical names, runtime registry coverage, required caller keys and
exhaustive checkout status/stage/error-category lists.
Optional caller keys are not treated as globally required; the included
operation fixtures separately check required keys in conditional download vs
remove and route vs inline-review branches.
The core interaction fixtures exhaustively declare positive payloads for all
31 added names; the runtime matrix consumes the same included fixture file.
Empty/offline reason and restart-choice coverage is checked against the domain
types. Watch-ad selection requires an observed `ad_shown` boolean; runtime QA
additionally rejects this field on non-ad choices.

Caller types allow explicit nullable operational metadata where a limited
observation must remain representable: for example, unknown SKU, unresolved
install clocks or failed ad scope factories. This does not make such inputs
valid native outcomes. Runtime QA runs after base/scope enrichment and
sanitization; final native checkout and ad impression/load observations require
known IDs. Shared nullable diagnostics cannot override an event-specific
required ID.

Eligibility `pending` is screen-local state, not a completed SDK response.
Resolved observations have a bounded basis and normalized error category.
Unknown, unsupported, empty, missing-response, request-error and detached
callbacks retain distinct evidence without changing the UI filter or SDK calls.

Lifecycle capture/emitter signatures use the same event-specific API. Its
internal composition assertions are confined to existing app/screen scopes;
runtime QA still checks route/state metadata. Cumulative checkpoints require a
positive integer index and a declared clock/engagement policy. Engaged time
cannot exceed foreground time. Lifecycle wall time is a different clock:
system-clock jumps are not rejected by comparing it to monotonic foreground.
Navigation observed while inactive remains representable. Missing process-kill
tails do not gain fabricated end events, and counters remain neither additive
checkpoint samples nor study time.

Readiness carries the actual training/exam/sign session and question scope.
Nullable operational context stays capturable, while final QA requires known
session/question IDs. Reason and duration scope must agree; foreground latency
cannot exceed elapsed latency measured by the same clock. Media readiness
remains `not_measured`. Access snapshots require bounded previous/current
sources and consistent initial/state-change context; they never establish
paid/trial/charge status.

Reminder outcomes retain `enable|disable|sync` operation scopes and the existing
helper return/state meaning. A denied sync is `disabled`, not a denied enable
flow. Failed helpers may retain an enabled schedule. Schedule counts and
`helper_result_not_delivery` never prove OS delivery or cancellation. Optional
permission/error fields are checked when present and retain success/denial/error
distinctions; falsy rejected values remain capturable incomplete diagnostics.

Offline download terminals require operation/category, question count, elapsed
time, nullable observed asset/byte counts and stage. The existing remove failure
shares `offline_pack_download_failed` but has its own `operation=remove` branch;
it does not gain invented transfer counters/duration. Stop intent may have a
null operation ID and is not a cancellation terminal. Reset confirmation is
only `helper_resolved_best_effort_cleanup`, never an atomic physical wipe.

`screen_viewed.screen_observation_scope=route|inline_review` preserves both
actual producers. Inline exam review occurs inside the result screen, without
route navigation, and requires its exam session rather than invented onboarding
metadata. Route observations preserve pending/resolved/not-applicable attempt
states. Learning intent composition adds only the existing analytics route ID;
unknown modes/limits are diagnosed without rewriting business route parameters.
Failure observation retains known operation names, an operation ID/source,
normalized error code and explicit user-visible/background context.

Result and review observations do not create session completions. Stored
results and review returns retain their actual origins; `missing_question`
remains a review state rather than invented rendered content. Review positions
are 1-based, and viewed counts are distinct available question IDs, not locale,
revision or repeated position exposures. The current exam resume producer can
observe position 0; QA retains it rather than changing its route or indexing.
`view_unmounted` is not learner-finished review, and component-visit foreground
duration is not study time.

`exam_session_ended` includes learner finish with `status=completed`, timer
expiry and abandonment; it is not universally an abandonment observation.
Reason/status and result status/outcome pairs retain these meanings. Counter,
position, navigation direction, answer-presence and correctness inconsistencies
remain invalid captured diagnostics, not scoring or navigation repairs.

`exam_restart_*` describes result-screen interactions, never a Home/daily cap.
Plus selection does not require a preceding modal. `ad_shown` does not prove an
earned reward or a PAID callback. Diagnostic reminder resolutions
`enable|later|dismiss` are intents, not permission or schedule success.

Offline blocks retain their observed gate snapshot and caller feature/screen,
not an entitlement defect; retry starts a new observation scope. Category
mismatch actions remain intents. Resolution compares the originally observed
current/session categories with the actual ready matching category, without
performing or inferring a category switch from the action.

## Runtime Meaning

The validator checks required scalar types, IDs, enums, finite nonnegative
numbers and integer counters. Conditional access/content/rules/origin/entry/ad
metadata has its own rules.

Semantic v2 checks include native purchase stage/completion, bounded
pending/unknown reasons, restore outcome/access consistency, recovered-attempt
flags, eligibility platform/query/outcome/count evidence, learning counters
and explicit install/onboarding/origin clocks. A structurally valid short
training, incomplete exam or expired outcome remains observable; QA does not
change `learning-v1`, completion behavior or scoring.

Capture records `analytics_payload_contract_status=valid|invalid|not_defined`,
`analytics_payload_valid` and static `analytics_payload_invalid_keys`.
Rejected values, receipts and raw error text are not copied into diagnostics.
Invalid observations remain captured and increase the local payload-failure
counter. No validation result guards purchases, access, restore, rewards,
navigation, storage operations or learning.

`not_defined` with `analytics_payload_valid=true` means no applicable rule
rejected the input, not that this event has a defined payload contract.
Capture counters and local logs do not acknowledge SDK queue delivery.

The lifecycle/readiness/access, operation and core interaction additions retain annotation
version 2: they define previously `not_defined` event families without rewriting
the previously defined v2 event contracts. Historical v2 `not_defined` rows keep
that reported status; the
warehouse does not promote or retrospectively validate them under the expanded
catalog. A version alone is not evidence of full-catalog coverage.

## Warehouse Passport

`context.data_quality.client_payload_validation`, the `data-quality` CLI and
health expose `client-payload-validation-observations-v1`. Its grain is a
retained observation row after provider/client import merge, not a business
operation, attempted delivery or validator execution. Same-window business
replays can contribute multiple diagnostic rows without adding operations.

The bounded counts distinguish unreported observations, legacy flag-only
annotations, reported v1/v2 valid/invalid/not-defined states, unsupported
versions and malformed annotations. `v2_validation_observed_rows` counts only
reported v2 valid/invalid, not v1, legacy or not-defined rows.

The engine does not retrospectively apply v2 rules to older payloads. Missing
annotations retain legacy semantics, and consistent v1 annotations do not
become v2 proof. Existing `analytics_payload_valid=false` remains a source gate.
Contradictory flags/statuses, malformed annotation types and unsupported
declared versions also limit dependent observations. Raw source annotations
are preserved, not rewritten to a fabricated validator result.

Paywall conversion restricts dependent stages. A checkout defect does not erase
an independently confirmed learning root/outcome, meaningful-learning D7 or
TTV. Conversely, a learning defect does not prohibit a clean paywall conversion.
Learning root/outcome defects and unmatched/malformed ancillary anchor evidence
still restrict learning metrics. Generic calendar return retains its broader
product-event dependency; it is not meaningful-learning return.

Client financial matching uses the same annotation gate. Invalid/unverified
client observations cannot establish a clean transaction match, but never
change independently sourced RevenueCat monetary totals.

## Local Acceptance

Controlled native adapters exercise the actual checkout coordinator/journal,
not a reimplemented state machine: successful native result with nullable
transaction, pending SDK completion followed by matching access, eight native
error categories, preflight/adapter/journal preparation failures, restore
empty/success/failure with concurrent access, and capture failure containment.
Existing origin golden traces cover PL refresh/retry/restart, CZ/SK lifetime
recovery/country switch and absent old-journal origins.

The semantic matrix, actual capture hook, external-entry lifecycle and rewarded
callback tests cover enrichment, safe invalid capture, censored scopes and
unchanged SDK/reward decisions. A missing ad scope remains invalid diagnostic
evidence without suppressing an earned reward; OPENED does not become PAID
impression evidence.

Python acceptance exercises CLI/context/health, version/malformed annotation
handling, retained raw flags, operation replay, dependent-rate isolation,
legacy semantics, learning D7/TTV and unchanged server money.

Actual activity tracker traces additionally cover cumulative checkpoints, idle
cutoff/inactive accounting, navigation/entity changes, background returns,
visits without screens, wall-clock jumps, unknown tails and emitter failures.
Actual readiness/duration hooks use controlled React/AppState/clock adapters
for focus, pending-to-usable latency, inactive/background returns and all four
feature contexts. The tests retain the existing pending-readiness clock reset
on active return rather than changing the hook to satisfy a guessed duration.
The capture hook proves that nullable readiness remains an invalid captured
observation, not a product guard. These are not native rendering acceptance.

Actual notification runtime wrappers, with controlled native/store adapters,
exercise granted/requested/provisional/denied permissions, enable/disable/sync,
best-effort cancellation, stale local IDs, retained state after failure,
optional pending push token, normalized/falsy exceptions and capture failure.
Return values, original rejections, locale/19:00 scheduling and SDK call counts
remain unchanged. No OS schedule or delivery acceptance is claimed.

Actual learning-operation helpers retain route fields, existing/new operation
IDs, nullable metadata and normalized errors. Actual screen-tracker traces
validate route scope. Offline/remove/reset and inline-review contracts have
compile/runtime fixtures; no mounted native offline/profile/result-handler
acceptance is claimed. Warehouse regressions retain historical `not_defined`
annotations for all 16 new families and keep independently confirmed learning
D7/TTV despite invalid auxiliary operation observations.

Actual training-result hooks additionally validate result/review payloads,
stored-result focus returns, next/previous/missing-item traces and unique
viewed-question counts despite extra locale/revision exposures. Actual offline
and category mismatch hooks retain focus/visibility/dedupe, retry IDs, original
snapshots and action vs ready resolution, without calling refresh or changing
product state. The actual capture hook retains caller screen context, reports
offline blocks as non-entitlement observations and captures inconsistent
interactions/null IDs without a product guard. These controlled hook adapters
are not native rendering or full session/result-handler acceptance.

Warehouse regressions retain historical v2 `not_defined` for all 31 additional
interaction families. Invalid interaction annotations do not erase independently
confirmed meaningful-learning D7 or TTV with a consistent root. Even reported
valid result/review/end/restart/explanation observations with completion-like
fields cannot manufacture a meaningful session completion. Warehouse QA still
uses source annotations, not a retroactive replay of mobile contracts.

The earlier eligibility continuation incorrectly claimed that fixtures inside
`__tests__` were typechecked; that directory is excluded by `tsconfig.json`.
Those fixtures have now moved to the included `type-tests` directory. Only
the subsequent actual `tsc --noEmit` checks establish their compilation.

No native build, Maestro, simulator, Xcode, real checkout, vendor mutation,
commit or deployment is part of this acceptance. Full-catalog typing/golden
coverage, owners, privacy policy and native/production/dashboard gates remain
open in [the full A-R ledger](./handbook-implementation.md).

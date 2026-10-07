# Handbook Implementation

Started October 7, 2026 from the audit in [keys.md](./keys.md).

The full implementation remains active. This is a requirements ledger, not a claim that every audit item or production integration is complete.

## Invariants

- Only analytics, analytics metadata retention and deterministic reporting change.
- PL stays subscription-only (`P1W/P1M/P3M`); CZ/SK retain the existing lifetime flow.
- Product selection, purchase invocation, access, restore, quotas, gates, navigation, scoring and question content are unchanged.
- The shared RevenueCat/PostHog install ID remains stable. No RevenueCat logout or entitlement migration.
- `exam_restart_*` remains the result-screen modal. No reinterpretation as a Home/daily cap.
- No Maestro, app build, simulator, Xcode, native checkout or production-vendor mutation is performed.
- New observation callbacks cannot throw into store, media, auth or onboarding operations.

## Requirements Ledger

| Audit | Current Source Evidence | Remaining Work |
| --- | --- | --- |
| A: offer race | Screen selector reads current offerings; synchronous Zustand regression tests cover delayed/cached load, refresh, fallback, unsupported PL packages, hidden outcome and capture failure. | A mounted-screen/native acceptance trace is not available in this environment. No real purchase failure is inferred. |
| B: verified money | Separate offline RevenueCat webhook archive/ledger and CLI report retain lifecycle/lineage, producer verification, original timestamps, signed adjustments and per-currency decimals. Provider/business duplicates, conflicts, partial/as-of coverage and sandbox are handled explicitly. Client prices never enter totals; transaction reconciliation labels incomplete scope. | Inspect existing production destinations and establish the authoritative archive; run controlled real-money/sandbox/refund/restore acceptance and reconcile with store reports. Webhook gross activity is not settled money or proceeds. See `revenuecat-ledger.md`. |
| C: conversion | Contract v2 keeps root grain through ordered joins and retries. Health now links learning attempts by installation-scoped session IDs; legacy time pairing is explicitly a proxy. Question updates/replayed starts do not add answers/attempts. Exam completion has a mature 24-hour horizon and censored starts; missing IDs, invalid payloads, conflicting outcomes and unverified coverage restrict rates. Comparison additionally retains both ASA install mixtures and their clean/unknown/shifted confounder status, not a causal channel effect. | Complete remaining metric passports and ID-aware association/pattern consumers; propagate verified coverage/financial reports into the separate dashboard and reconcile its consumption. |
| D: delivery/import | Partial reimports merge, dedupe provider/client IDs and atomically replace files after successful writes. `data-quality-v1` additionally reads available pre-window partitions for scoped critical-operation dedupe/conflicts, preserves historical replay restrictions and separates explicit client/receipt lag from a provider-time proxy. Immutable conflicts are retained/quarantined; receipt/SDK enrichment drift is not a body conflict. Context/health/identity/client-finance consumers retain source gates; partial-day reads include every overlapping day. Coverage requires pagination/truncation/watermark proof; empty verified days exist. See `data-quality.md`. | Native queue/revocation and actual delivery acceptance; suitable delivered historical windows and dashboard consumption. Missing legacy business IDs cannot be reconstructed into verified operations. No custom universal outbox is assumed necessary. |
| E: privacy | Sanitizers additionally reject oversized strings and obvious email/URL/bearer/JWT content under allowed keys. | Purpose policy, persisted choices/ledger, SDK queue cleanup, late opt-in handling, deletion orchestration and vendor/export retention. Legal basis cannot be inferred from SDK configuration. |
| F: identity | Automatic account aliases removed; versioned install/account observations record link, unlink and direct switch without changing SDK IDs or entitlements. Warehouse `identity-links`/context ledger includes pre-window history, observed intervals, guest/switch/cross-device boundaries, ID/order conflicts, base-context disagreement and legacy SDK alias/person/ID quality signals. Invalid observations create unknown boundaries. Automatic account joins remain disabled. | Inspect actual historical exports/SDK profiles and define any approved account-level migration/retention scope. Available partition coverage is not installation-lifetime coverage; historical delivery-as-of remains unverified. No claim of repaired historical person profiles. See `identity-access.md`. |
| G: cohorts/onboarding | First-observed and onboarding attempt metadata persist separately from native installation time and survive learning reset. Attempt identity restores across process restart; a successful reset creates another analytics attempt, not another install. Completion records accepted local store calls, not physical storage flush. `onboarding_home_arrived` separately observes a foreground Home route after that acceptance. Separate `onboarding-activation-v1` / CLI `onboarding`, context and supplied-health consumers retain distinct roots, declared completion/Home clocks, mature nonachievers, temporal post-Home learning bounded by next attempts/reset, unknown-root/app coverage and independent stage/learning gates. See `onboarding-activation.md`. | Actual app-scoped delivered windows, native navigation/storage/clock and dashboard acceptance remain unavailable; observation-only metadata does not create an atomic product/analytics outbox. Assigned metric owners and outcome-specific segmentation remain required. |
| H: checkout recovery | Journal retains plan/offer/variant/default/trial/eligibility/config/period metadata and separate immutable paywall/checkout input origins. Actual coordinator/journal controlled golden traces retain PL origins through refreshed native package, restart/access confirmation and cancelled retry; CZ/SK lifetime through restart/country switch; access-center restore and old v1 absence. See `paywall-observations.md`. | Native queue/checkout/restart acceptance and delivered traces remain unavailable. Existing recovery/business tests remain required; local golden traces do not prove actual store delivery or money. |
| I: displayed offer | View/CTA/dismiss/selection snapshots describe the selected package; live ready events derive the fallback plan from current offers. Separate optional observation-v1 request/product outcomes retain actual SDK known/unknown/missing/no-intro/error, unsupported/unconfigured/empty paths and detached callbacks without changing filtering/query count. Immutable local screen/input origins survive recovery; focused exposure stays separate from wall time. `paywall-observations-v1` / CLI/context/health retain scoped historical replay/conflicts, order/missing stages and independent snapshot evidence, never a trial-exposure or financial rate. See `paywall-observations.md`. | Native SDK/render/queue acceptance, real delivered windows, exact request-list membership, remote configuration revision provenance and separate dashboard consumption remain unverified. |
| J: access mismatch | Existing access-state observer and checkout confirmation preserved. Canonical gate/content events now compare a fresh local store snapshot with the observed feature surface, with rule version, source/override and CustomerInfo age/clock basis. PL free-topic marks, ordinary paywall/upsells, offline dependencies and ambiguous roadmap prerequisites are not entitlement defects. Context/health group potential mismatches without fake error rates. | Native surface acceptance and actual server/access freshness remain unverified. School/remote verification age is explicitly unavailable; paid/trial/restore history requires B, not a Plus boolean. See `identity-access.md`. |
| K: content versions | Preserved mapper provenance separately observes prompt/choices/explanation source language/kind and selected fields, without changing fallbacks or inferring old caches. Actual rendered explanation revisions/variants enrich training feedback and training/diagnostic/exam review. New exams retain a protected creation-profile/parameter binding; cached capture records historical country/category/targets/duration/navigation separately from current config. Context/health group bounded provenance/display/rules and quarantine scoped conflicts. See `content-observations.md`. | Native surface/delivery acceptance, actual server revision provenance and media bytes remain unverified. General content accuracy/report-rate passports and dashboard consumption are not implied by diagnostic groups or the separate controlled repeat-answer fraction. |
| L: media | Native image/video callbacks observe load start, ready, normalized failure, actual playback start/end and censored buffering with one load ID. Training/exam/review pass question context. | Native callback acceptance unavailable; extend native crash/vitals sources only when an existing runtime integration can be verified. |
| M: learning | Meaningful-learning D7 is separate from calendar/open return. `learning-v1` and TTV retain nonachievers/censoring, reject uncertain/conflicting anchors and never call foreground time study time. `onboarding-activation-v1` separately adds first-observed 24h/D7/D30, post-activation Warsaw calendar D1/D7, explicit entry/usable/answer/outcome milestones and ordered same-session chains, without rewriting generic retention. Separate `billing-learning-v1` / CLI `billing-learning` and context/supplied-health consumers join available verified trial/first-positive-charge origins with native/RevenueCat mapping independent of ASA. Activation, elapsed D7/D30, bounded trial revisions, cancellation usage and post-activation calendar D1/D7 retain overlapping lineage membership, origin country/content snapshots, maturity, explicit app-scoped client/archive coverage and independent answer/open/start/outcome gates. See `billing-learning.md` and `onboarding-activation.md`. | Actual reviewed production mappings/archives/client app coverage, synchronized clocks, native billing/lifecycle and dashboard acceptance; outcome-specific country/content and acquisition-specific paid/trial segmentation, and any separately required current-entitlement timeline. No Plus-to-paid or causal lift inference. |
| N: acquisition/spend | Existing ASA behavior preserved; visit entry is not acquisition. `asa-installation-v1` / CLI `acquisition` read explicit terminal history for observed install-ID mixtures and durable first-observed D7/D30 client/learning cohorts. Delayed resolution, unknowns, anchor/identity/platform/transaction conflicts, dependent outcome integrity, elapsed/calendar maturity and full source coverage remain explicit. Context/health/comparison consume the reports without treating client purchase observations as money. Manifest-gated `ingest-spend` / `spend` retain Apple Ads account/app/currency/window scope, exact decimals, conflicts and source assertions without adding alternative grains, overlaps or partial windows. Local September 12-20 EUR/UTC aggregates are not current costs. Separate `acquisition-financial-cohorts-v1` / `acquisition-finance` retain explicit reviewed native/ASA/Apple/RevenueCat mapping and source-gross D7/D30 original-lineage associations, app-scoped production coverage and exact-window same-currency expense diagnostics. Missing scopes, aliases/transfers, monetary horizons, as-of cuts and censored cohorts remain explicit; proceeds/ROAS stay null. Independent post-billing-start learning is available under M / `billing-learning.md`. See `acquisition-spend.md`, `acquisition-cohorts.md` and `acquisition-finance.md`. | Real reviewed production mappings, authoritative current manifests/fresh archives, realised D7/D30 reconciliation with B and actual store proceeds, correction policy and required daily adapters, acquisition-specific paid/trial engagement segmentation, dashboard and external acceptance. No new MMP or remote channel without an actual channel requirement. |
| O: reminders/links | Versioned observer binds live/cold signals to explicit foreground visits; cached and queued-unattributed scopes stay separate. Bounded route/entity/state destinations retain preexisting snapshots, aliases and unknowns. Context/health require ordered start/resume -> new accepted answer -> meaningful completion, business integrity, coverage and observed visit tails; missing tails remain censored. Controlled lifecycle/storage tests retain existing dedupe/scheduling/routing. See `external-entry-rewarded-observations.md`. | Native destination/response/delivery acceptance, actual delivered windows and separate dashboard consumption remain unverified. No schedule-to-delivery rate or causal reminder lift is inferred. |
| P: QA/contracts | Explicit typed payload arguments and `NoInfer` cover checkout/restore/recovery, paywall/eligibility, learning, media, identity/install/onboarding, new external-entry/rewarded events, foreground lifecycle, usable-learning readiness, access snapshots, learning intents/failures, screen scopes, reminder helpers, offline operations and progress reset. Core learning interactions additionally cover results/reviews, feedback, abandonment/empty, exam launch/resume/end/navigation/flags, explanation/diagnostic/reminder intents, result restart, offline blocks and category mismatch. There are 113 typed names/explicit runtime contracts out of 176 canonical names. Included fixtures check names, required keys including conditional variants, rejection cases and exhaustive domain enums. Runtime QA v2 checks scalar/counter/clock and outcome consistency without suppressing capture or guarding product decisions; strict event IDs cannot be weakened by nullable shared observations. Actual coordinator golden traces retain native call counts, preparation/pending/error/restore/recovery and capture-failure decisions; actual tracker/readiness traces retain cumulative clocks, focus/inactive/background behavior and unknown tails. Actual notification/learning helpers retain SDK calls, return/rejection shapes, route fields and safe diagnostics. Actual training-result/offline/mismatch hooks retain distinct viewed-question counts, stored results, focus/dedupe/retry scopes and intent vs observed resolution. Warehouse CLI/context/health expose bounded legacy/v1/v2/undefined/malformed/unsupported annotations without retroactive v2 validation; gates restrict dependent rates/client matching, not independently verified learning D7/TTV or server money. See `payload-contracts.md`, `data-quality.md` and `paywall-observations.md`. | Event-specific TypeScript payloads for the remaining 63 names, complete conditional/producer golden traces including untested handlers within already typed families, assigned owners and native/production/dashboard acceptance beyond the local quality gate. |
| Q: disabled ads | `enableAds=false` is unchanged. Rewarded request/instance scopes distinguish SDK load invocation, OPENED, explicit PAID-impression evidence, earned reward and terminal. Late PAID stays optional for two seconds without delaying settlement; normalized SDK failure categories and observation failures do not change rewards. Context/health dedupe identical PAID, quarantine conflicting scopes/values and keep per-currency SDK amounts separate from finance. See `external-entry-rewarded-observations.md`. | Native callback/queue and configured-unit acceptance before any separately approved re-enable, AdMob financial reconciliation, production delivery and separate dashboard consumption remain unverified. Client SDK values are never settled money. |
| R: optional features | Context/health `repeat-answer-v1` joins accepted baseline -> observed explanation/review -> next distinct logical answer, with installation/session IDs, revision/language/selection controls, business dedupe, a seven-day horizon and censoring. Exam edits do not create repeated learning; changed/unknown content and missing baselines stay explicit. Mature comparable-pair fractions require verified coverage and clean integrity, never causal lift. Existing support/share/review intents keep their meaning; no real-exam outcome or optional product feature is invented. | Validate actual delivered traces, suitable historical windows and dashboard consumption. A new self-report/referral/replay product feature requires a separate product decision. See `content-observations.md`. |

## Current Contracts

The raw provider UUID and client `properties.event_id` remain distinct. Loaded events expose `provider_event_id`, `client_event_id`, `client_occurred_at` and optional `received_at`; export time is not receipt time.

Coverage is an explicit, as-of source assertion. Do not retrofit it onto old dumps without pagination and delivery evidence. Previously verified coverage can survive a partial overlapping merge, retaining its original watermark. Old metadata without version 2 is not trusted as complete.

Diagnostic paywall funnel: 24 hours, grain `paywall_view_id`. Install-level conversion: one-hour fully observed horizon, versioned by engine contract 2. Retries do not increase converted views. This is not a business timeout or verified revenue metric.

Learning rule `learning-v1`: completed training with at least five unique accepted questions, or completed exam with all target questions answered. It does not change session size, finish behavior, score, access or reminders.

## Verification

Use installed Jest directly from `mobile/` and isolated Python test dependencies outside the project. Do not run build or Maestro commands.

```bash
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent \
  src/analytics/__tests__ src/features/entitlements/__tests__ \
  src/features/paywall2/__tests__ src/features/onboarding/__tests__ \
  src/features/monetization/__tests__ src/features/monetization/v2/__tests__ \
  src/features/notifications/__tests__ src/features/ads/__tests__ src/identity/__tests__ \
  src/features/exam/__tests__/exam-entry.test.ts \
  src/features/exam/__tests__/exam-config.test.ts \
  src/features/exam/__tests__/local-exam-lifecycle.test.ts \
  src/features/exam/__tests__/czech-local-exam.test.ts \
  src/features/questions/__tests__/supabase-question-v2-record.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Python tests run from `analytics-engine/` with `/tmp/prawko-analytics-audit-venv/bin/python -B -m pytest -p no:cacheprovider -q`.

The mobile typecheck currently reports five pre-existing errors outside the edited analytics paths: nullable access in `local-exam.ts:198` (previously 196, shifted by analytics imports); `never` in `question-topics/catalog.ts:50`; two nullable-number uses in `TrainerModesView.tsx:260/376`; duplicate JSX attribute in `SignTestSessionScreen.tsx:403`. Do not repair these by changing product logic as part of this analytics task.

Production PostHog/RevenueCat/Apple Ads configuration and the separate dashboard are not verified. Local tests do not establish native queue delivery, real financial effects or legal compliance.

October 7 continuation: exam lifecycle fixture setup implements `multiGet` and
awaits pending persistence before seeding an expired snapshot; no exam source logic
was modified. RevenueCat acceptance exercises CLI/context/health integration.
Onboarding acceptance includes factory restart/reset/storage/clock cases and the
actual screen tracker hook wiring with controlled route/effect/native adapters,
not a rendered native navigation test.

The preceding content/repeat broad runs passed **49 mobile suites / 350 tests** and
**217 Python tests / 1 skipped**. The October 7 identity/access continuation adds
feature diagnostics capture wiring, warehouse historical identity links and
retained import conflicts, including rejected legacy contact/token identifiers
and conflict-restricted meaningful-learning/TTV reporting. The missing gitignored
October 3 production dump remains the Python skip. Typecheck still reports only
the five pre-existing errors listed above; `git diff --check` passes.

October 7 content/repeat continuation adds K provenance/display/origin consumers,
conditional observed-rule parameter contracts, a controlled training-review hook
trace and R ordered repeat-answer cohorts. Those completed broad runs include
separate create/update overlay meanings, half-open horizon boundaries,
contradictory selection guards and scoped duplicate/order tests. Full A-R remains
active: privacy purpose/revocation/deletion, acquisition/spend, universal
business-dedupe/lag, complete typed/golden QA, remaining cohort/metric consumers
and the separately listed external acceptance still require work.

October 7 external-entry/rewarded continuation adds O/Q client observers,
controlled lifecycle wiring, scoped context/health reports, new overlay IDs and
QA gates. Unknown foreground-visit tails remain censored; cached responses do
not gain current attribution; SDK PAID values do not enter verified finance.
The latest completed broad runs pass **52 mobile suites / 388 tests** and
**273 Python tests / 1 skipped**. The skip remains the missing gitignored October
3 production dump. The final typecheck reports exactly the same five pre-existing
errors above; no new analytics-path error remains. `git diff --check` passes.
No native build, Maestro, simulator, Xcode, checkout, commit or deployment was
performed. These runs verify the selected local audit paths, not the external
acceptance requirements or completion of the full A-R ledger.

October 7 data-quality continuation integrates the previously standalone draft
into context/health, historical identity source quality, client financial
reconciliation and a dedicated CLI. The registry uses actual producer operation
IDs; canonical activity excludes pre-window business replays without erasing raw
diagnostics. Immutable/terminal/order conflicts restrict dependent fractions,
not unrelated paywall events in the same slice. Receipt lag separates explicit
client/receipt pairs from a provider-time proxy and never uses export time.
Partial-day partition reads include the last overlapping day. The completed
broad runs pass **52 mobile suites / 388 tests** and **327 Python tests / 1
skipped**; the same missing October 3 dump remains skipped. Typecheck reports
exactly the same five baseline errors; `git diff --check` passes. No mobile
runtime/product logic changed in this continuation. Full A-R remains active,
including purpose approval, typed/golden QA, acquisition/spend, remaining
cohort/passport consumers and external/native/dashboard acceptance.

October 7 spend-source continuation adds manifest-gated Apple Ads aggregate CSV
ingest/report and CLI/context/supplied-health consumption. The actual three local
Apple Ads formats are exercised with synthetic scope/export metadata, not an
invented production manifest. Account/app/currency/granularity/window boundaries,
exact Decimal sums, duplicate imports, conflicting bodies, overlap/partial
windows, same-observation review/completeness and atomic write failure are
covered. AdMob estimated earnings, client prices and RC money remain separate;
ROAS is not computed. The final broad Python run passes **369 tests / 1 skipped**.
The preceding **52 mobile suites / 388 tests** and five baseline typecheck errors
remain the latest mobile checks; no mobile runtime code changed in either the
quality or spend-source continuation. `git diff --check` passes. No production
spend import, purpose-policy change, native build/checkout, Maestro, simulator,
Xcode, commit or deployment was performed. N still requires approved fresh
sources/correction policy, ASA/cohort/financial joins and external/dashboard
acceptance; the full A-R goal remains active.

October 7 ASA-cohort continuation adds `asa-installation-v1` and CLI
`acquisition`, replacing the fixed context mix placeholder with explicit
installation terminal/history observations. First-observed D7/D30 client and
meaningful-learning cohorts retain delayed attribution, unknown/Android scopes,
anchor/platform/transaction conflicts, dependent outcome integrity, nonachievers
and elapsed/calendar censoring. Super properties and visit entries do not create
acquisitions; restore/access confirmation and client prices never become charges
or money. Health retains supplied history reports without inventing default
history. Comparison exposes both window mixtures and gates attribution on an
exact installation-bucket shift, including the ten-percentage-point boundary.
Original interpretation IDs retain their meanings; new explicit iOS overlays
have new IDs. See `acquisition-cohorts.md`.

The final broad runs pass **443 Python tests / 1 skipped** and **52 mobile suites
/ 388 tests**. The missing gitignored October 3 production dump remains the
skip. Typecheck reports exactly the same five baseline errors; `git diff --check`
passes. No mobile runtime/business source, ASA retry/collection policy, SDK
identity, production vendor, native build/checkout, Maestro, simulator, Xcode,
commit or deployment changed in this continuation. The full A-R goal remains
active. Financial app mapping and mature source-gross D7/D30 reconciliation,
actual proceeds, approved spend revisions/daily sources, paid/trial engagement,
privacy decisions, remaining typed/golden/metric consumers and
dashboard/native/production acceptance still require work.

October 7 financial-cohort continuation adds explicit retained/atomic/idempotent
native/ASA/Apple/RevenueCat mapping declarations, an optional bounded RevenueCat
history view and per-app production source coverage. New application namespace
properties read the existing native ID without country/locale/SDK fallback;
optional getter failure remains contained. No PL/CZ/SK offer, checkout, access,
restore, identity, quota, learning, content, routing or scheduling behavior
changes. See `acquisition-finance.md`.

`acquisition-financial-cohorts-v1` / CLI `acquisition-finance` and context/health
consumption retain first-observed D7/D30 source-gross associations by observed
original transaction lineage, not the latest RevenueCat subscriber ID. Missing
scopes, aliases/transfers, unverified sources, provider/business conflicts,
earlier origins and contradictory effect generation restrict dependent
associations. Monetary defects and missing lineage evidence restrict their own
half-open horizons, so a late D8 defect does not erase a clean D7. Missing scope
with a known transaction can broaden candidate restrictions without assigning
ownership or money. Sandbox-only and missing coverage cannot establish zero
production payers; unrelated clean app scopes remain independent.

Supplied acquisition report contracts/clocks, duplicate/conflicting installation
rows, shared observation IDs, malformed counters/scopes and platform/terminal
disagreement have explicit gates. Exact campaign-window same-currency expense
can yield only a mature, source-complete first-observed subset diagnostic.
Identical namespace declarations with different validity windows do not duplicate
expense; partial maturity, partial/overlapping sources, conflicts, zero expense
and FX guesses cannot produce the diagnostic. Source/declaration export-as-of
cuts are separate from event-time horizons and unverified historical client
delivery-as-of. Proceeds and ROAS always remain null.

The final broad runs pass **536 Python tests / 1 skipped** and **53 mobile
suites / 398 tests**. The skip remains the missing gitignored October 3
production dump. The new native-scope mock and actual base-properties wiring
pass, including optional getter failure. Typecheck reports exactly the same
five baseline errors; `git diff --check` passes. No native build, Maestro,
simulator, Xcode, checkout, production mutation, commit or deployment ran.
Full A-R remains active: approved privacy purposes/controls, real production
mappings/archives, store proceeds, spend revisions/daily adapters, paid/trial
engagement, remaining metric/golden/typed consumers and
dashboard/native/production acceptance still require work.

October 7 billing-learning continuation adds an independent retained/atomic
native/RevenueCat mapping, CLI `ingest-billing-mapping` / `billing-learning`,
`context.billing_learning` and supplied-health consumption. Source trial starts
and first available canonical positive charges require observed original
lineage, not Plus, display prices, restore, accounts or advertising IDs.
Activation, elapsed D7/D30, origin country/category/locale/bank snapshots,
post-activation calendar return, nonachievers and censoring remain explicit.
See `billing-learning.md`.

Trial phase honors the initial declared expiry and verified continuous
`SUBSCRIPTION_EXTENDED` revisions, capped by earlier canonical paid generation
or original-trial expiration. Missing expiry, continuity, period/product or tied
contract proof cannot create a complete phase or current access claim.
Cancellation usage has provider-event grain with explicit IDs and a separate
observed-unit count; only accepted answers before intent count as previous
usage. Bad completion does not erase clean accepted usage. Unknown phase or
coverage keeps observed cancellations but makes their usage unknown.

Fractions additionally require every overlapping client partition's explicit
`coverage.application_ids`; malformed retained coverage restricts without
crashing. Refund economics do not erase a known positive start in the learning
consumer, while the financial consumer retains its default strict lineage gate.
The initially failing isolation fixture reused one store transaction ID in
two apps. Independent transactions now prove scope isolation, while a separate
collision test preserves quarantine rather than weakening financial checks.

The final broad runs pass **615 Python tests / 1 skipped** and **53 mobile
suites / 398 tests**. The skip remains the missing gitignored October 3
production dump. Typecheck reports exactly the same five baseline errors;
`git diff --check` passes. No mobile runtime/business source changed in this
continuation. No native build, Maestro, simulator, Xcode, checkout, production
mutation, commit or deployment ran. Full A-R remains active: approved privacy
purposes/controls, onboarding/activation and eligibility consumers, remaining
typed/golden/metric consumers, real mappings/archives/proceeds/spend policies,
outcome/acquisition-specific segmentation and dashboard/native/production
acceptance still require work.

October 7 onboarding/activation continuation adds `onboarding-activation-v1`,
CLI `onboarding`, `context.onboarding` and supplied `health.onboarding`.
Durable first-observed roots and persistent onboarding attempts remain distinct;
settings/steps/SDK markers do not create whole-flow completion or physical
installs. Local acceptance and foreground Home use their own declared clocks,
not delayed capture or physical storage flush. See `onboarding-activation.md`.

Elapsed 24h/D7/D30, first-observed post-activation Warsaw calendar D1/D7,
nonachievers/censoring and achiever-only TTV retain explicit app-scoped coverage.
Open, entry, usable question, accepted answer, meaningful completion and
ordered same-session chains have separate source/order gates. Product events
do not gain a persistent onboarding ID: post-Home learning remains a temporal
installation association, bounded by the next verified observed attempt/reset.
`client_source.py` shares available history and app coverage with
billing-learning without weakening its financial/archive/mapping gates.

Late valid/malformed Home stages outside D7 cannot add a D7 missing-completion
restriction. Unknown/future/malformed roots cannot improve denominators.
An already-confirmed exact first-observed binding limits unknown-root
membership on a nonprimary dependent observation without joining its outcome.
Conflicting origin bindings remain unknown, independent of input order.
Safe fixture provider IDs separately retain actual provider-conflict quarantine.

Canonical reset replays cannot clip learning again. Tied attempts/unbound
origin resets and horizon-scoped malformed/unjoinable later boundaries
restrict post-Home association, not independent completion/Home or
first-observed learning. Reset intent without verified confirmation is neither
success nor proof of unchanged product state after failure. Late uncertainty
does not reopen a known closed association; a reused unowned attempt ID with
another declared clock does not become a clean old attempt. Unknown root
selection clocks retain their broader membership restriction.

The final broad runs pass **705 Python tests / 1 skipped** and **53 mobile
suites / 398 tests**. The skip remains the missing gitignored October 3
production dump. Typecheck reports exactly the same five baseline errors;
tracked and newly added continuation files have no whitespace warnings.
No mobile runtime/business source changed in this continuation. No native
build, Maestro, simulator, Xcode, checkout, production mutation, commit or
deployment ran. Full A-R remains active: approved privacy purposes/controls,
eligibility/origin outcomes, remaining typed/golden/metric consumers, actual
production mappings/archives/proceeds/spend revisions and daily adapters,
outcome/acquisition-specific segmentation, assigned owners and
dashboard/native/production acceptance still require work.

October 7 paywall eligibility/origin continuation adds optional request/product
observation-v1 events, event-specific TypeScript payloads and compile-only
rejection fixtures. Raw iOS known/unknown/missing/no-intro status stays separate
from the unchanged UI filter. Android/unconfigured/empty paths retain their
existing returns and native query count; rejection retains the original error.
Superseded callbacks remain diagnostic and cannot replace the current snapshot.
See `paywall-observations.md`.

Immutable paywall-local config and checkout-input/package origins stay separate
from refreshed native fields and survive the existing v1 journal. Actual
coordinator/journal golden traces with mocked native adapters cover PL refresh,
restart/access confirmation, cancelled monthly retry preserving the original
quarterly attempt, CZ/SK lifetime restart/country switch, access-center restore
and legacy origin absence. No current origin is invented for an old record.

`paywall-observations-v1` / CLI `paywall-observations`, context and health retain
request/product grains, strict source/count/outcome/query gates, available
pre-window stages, historical replay/conflicts, ordered/missing terminals,
detached/future product evidence and immutable origin disagreements. Current
country/native SKU/price changes are not origin conflicts. Observed products
are separate from complete requests; no resolution/display/trial/conversion
or financial rate is computed. Request-list membership, remote revision and
native rendering are not inferred.

The three diagnostic events do not count as product/calendar-return or health
activity. Their own integrity defects do not erase an independent clean
conversion, return or learning-TTV measurement. Old offer/checkout meanings
remain unchanged; the new interpretation overlays are optional.

The final broad runs pass **773 Python tests / 1 skipped** and **56 mobile
suites / 420 tests**. The skip remains the missing gitignored October 3
production dump. Typecheck reports exactly the same five baseline errors above.
Correction: the new compile-only eligibility fixtures were inside excluded
`__tests__` and were not checked by that run. Their actual included compilation
is verified only in the payload-QA continuation below.
`git diff --check` and explicit checks of newly added files report
no whitespace warnings. No native build, Maestro, simulator, Xcode, checkout,
production mutation, SDK identity migration, commit or deployment ran.

Full A-R remains active: approved privacy purposes/controls, event-specific
typing/golden QA for the remaining catalog, metric owners/consumers and
outcome/acquisition-specific segmentation, real reviewed mappings/archives,
store proceeds/spend revisions/daily adapters, native callbacks/render/queue
delivery and separate dashboard/production acceptance still require work.

October 7 typed-payload/QA continuation completes the current critical draft,
not full P or the full A-R ledger. Required event payload arguments, event-name
inference isolation, caller required-key/runtime registry parity and exhaustive
checkout enums are now checked from included `src/analytics/type-tests`.
The previously excluded eligibility fixtures moved there. Terminal eligibility
basis excludes screen-local `pending`; normalized error categories remain
bounded. New O/Q observation payloads have typed scope/outcome fields and
producer composition. Common nullable rewarded diagnostics no longer weaken
the strict native-load/impression IDs.

Runtime QA now declares `analytics_payload_contract_version=2` for the expanded
scalar/enum/integer/counter/clock/outcome rules. Nullable incomplete operational
inputs remain capturable and can fail QA; no product guards, fabricated
metadata, billing choices or SDK identity changes are introduced. Actual
coordinator traces cover successful SDK response with nullable transaction,
pending SDK completion -> later matching access, eight native error categories,
preflight/adapter/journal failure, restore empty/success/failure with concurrent
access, and capture failure while access/journal behavior remains unchanged.
Existing PL/CZ/SK origin/recovery traces remain passing.

Warehouse `client-payload-validation-observations-v1` is now part of
`data-quality` / CLI/context/health. It distinguishes source-reported legacy/v1/v2
valid/invalid/not-defined from malformed/unsupported annotations at retained-row
grain. Old bodies are not revalidated under v2 and raw annotations are not
overwritten. Shared source gates also reach client financial matching without
changing authoritative RevenueCat totals.

New acceptance exposed and corrected overly broad learning source gates:
checkout defects do not erase independently verified learning D7/TTV, and
learning defects do not prohibit a clean paywall rate. Invalid root/outcome
observations and unmatched/malformed ancillary anchor evidence still restrict
learning; generic calendar return retains its broader product dependencies.
Malformed list-valued installation IDs cannot crash the timing consumer.
See `payload-contracts.md` for the exact passport and acceptance boundary.

The final broad runs pass **835 Python tests / 1 skipped** and **58 mobile
suites / 484 tests**. The skip remains the missing gitignored October 3
production dump. Included type-fixtures leave exactly the same five baseline
errors above; no new analytics/type-fixture error remains. Tracked and new
continuation files have no whitespace warnings. No Maestro, app build,
simulator, Xcode, native checkout, production mutation, commit or deployment
ran.

Full A-R remains active: approved privacy purposes/revocation/deletion,
remaining catalog typing/golden traces and metric/passport/segmentation owners,
real reviewed mappings/archives/store proceeds/spend corrections and daily
adapters, actual native callbacks/render/queue delivery and separate
production/dashboard acceptance still require work.

October 7 core-contract continuation adds nine event-specific contracts for
foreground app/screen visits, learning-screen readiness and access snapshots.
The actual source/type-checker inventory is now **66 typed names / 176
canonical events**, with 66 explicit runtime contracts and 110 remaining
event-specific caller contracts. Lifecycle capture/emitter types no longer
accept broad scalar records for typed events; internal scope composition
assertions remain bounded and checked at runtime. No event name/trigger, clock,
timer, navigation, learning/access decision or business operation changed.

Actual tracker traces cover cumulative checkpoints rather than summed samples,
engagement idle cutoff, inactive accounting, screen/entity transitions, nullable
last-screen IDs, wall-clock jumps, unknown visit tails and capture failures.
Actual readiness/duration hooks cover focus, pending readiness, active returns
and training/exam/sign contexts. An initially failing fixture assumed a duration
the existing hook does not promise; the fixture now retains the existing
pending-readiness reset on active return. No runtime timing logic was repaired
or changed to satisfy that assumption. Capture wiring keeps nullable operational
readiness observable as invalid QA without guarding learning.

Annotation version 2 is retained for previously undefined event families;
existing event contracts and historical reported `not_defined` states are not
rewritten or retrospectively promoted. See `payload-contracts.md`.

The final broad runs pass **835 Python tests / 1 skipped** and **61 mobile
suites / 539 tests**. The skip remains the missing gitignored October 3
production dump. Included TypeScript fixtures report exactly the same five
baseline errors listed above, with no new analytics-path error. Tracked and
newly added files have no whitespace warnings. No Maestro, app build,
simulator, Xcode, native checkout, production mutation, commit or deployment
ran. This pass stops at the core observations; it is not completion of A-R.
Privacy, the remaining catalog/metric/segmentation/owner work and the native,
production and separate-dashboard acceptance requirements remain open.

October 7 operation-contract continuation adds 16 event-specific contracts:
learning intents/failures, screen scopes, notification permissions/scheduling,
offline pack states/download/cancel/remove and progress reset. Source/type-checker
inventory is now **82 typed names / 176 canonical events**, with 82 explicit
runtime contracts and 94 names without event-specific caller contracts.
Included fixtures separately prove required keys for conditional remove/download
and route/inline-review branches rather than making optional fields required.

Both actual `screen_viewed` producers now declare observation scope. Result
inline review remains an existing event before the existing local view change;
it does not become route navigation or acquire fabricated onboarding metadata.
Other producer edits are type annotations only. PL/CZ/SK billing,
checkout, entitlement decisions, learning operations, errors/returns, routing,
reminder scheduling and reset cleanup are unchanged.

Actual notification helpers with controlled native/store adapters retain
permission/native call counts, provisional/denied/requested cases, 19:00/locale
copy, enable/disable/sync return shapes, best-effort cancellation, stale local
IDs and existing state after failure. Optional push token does not delay the
helper. Falsy native exceptions are rethrown unchanged and remain invalid
captured diagnostics; capture failures do not change scheduling.

Actual learning helpers preserve route parameters and generated/existing IDs,
normalize errors and contain optional reporting failures. Offline/remove/reset
and inline-review coverage is compile/runtime contract coverage, not mounted
native screen-handler acceptance. Warehouse regressions retain historical v2
`not_defined` states for all 16 families and keep independently verified learning
D7/TTV despite invalid auxiliary operation observations. No warehouse runtime
consumer changed. A broad-test failure exposed an incomplete configuration mock
in the access fixture; it now preserves actual category/mode exports without
adding a production fallback.

The final broad runs pass **857 Python tests / 1 skipped** and **64 mobile
suites / 599 tests**. The skip remains the missing gitignored October 3
production dump. Included TypeScript fixtures leave exactly the same five
baseline errors above; no new analytics-path error remains. Tracked and new
continuation files have no whitespace warnings. No Maestro, app build,
simulator, Xcode, native checkout, production mutation, commit or deployment
ran. Full A-R remains active: remaining catalog/conditional golden traces,
privacy decisions/controls, metric/passport/segmentation owners and actual
native, production and separate-dashboard acceptance are still open.

October 7 core learning-interaction continuation completes local contract
acceptance for the 31 previously unfinished additions: feedback/result/review,
abandonment/empty, exam launch/resume/end/navigation/flags, explanation,
diagnostic/reminder intents, result restart, offline blocks and category mismatch.
The actual TypeScript checker inventory is **113 typed names / 176 canonical
events**, with 113 explicit runtime contracts and 63 names without
event-specific caller contracts. Included exhaustive positive fixtures are
shared with the runtime matrix; negative fixtures retain nullable operational
inputs, required restart ad-show evidence and bounded domain meanings.
The 117-scenario matrix checks required scalar fields and conditional
counter/position/status/outcome/navigation/gate consistency.

Actual training-result hook traces validate emitted payloads, stored-result
focus returns, review-return origins, next/previous/missing items and distinct
viewed-question counts despite repeated/locale/revision observations. Actual
offline/mismatch hooks retain focused visibility, dedupe, retry IDs, original
scope and action vs ready resolution without performing product operations.
Capture wiring preserves caller feature/screen context, labels offline blocks
as non-entitlement observations and captures invalid/null-ID interactions.
These controlled adapters do not prove native rendering or untested screen
handlers. Producer edits in this pass are type-only; no billing, access,
learning, routing, SDK call or warehouse runtime consumer changed.

Warehouse regressions preserve reported historical v2 `not_defined` for all 31
families and independently confirmed meaningful-learning D7/TTV despite invalid
interaction annotations with a consistent root. Reported valid
result/review/end/restart/explanation observations with completion-like fields
cannot manufacture a meaningful session completion. Annotation version 2 and
source-reported, non-retroactive warehouse QA are unchanged.

The final broad runs pass **927 Python tests / 1 skipped** and **66 mobile
suites / 727 tests**. The skip remains the missing gitignored October 3
production dump. Included TypeScript fixtures leave exactly the five baseline
errors above; no new analytics-path diagnostic remains. Tracked and touched
untracked files have no whitespace warnings. No Maestro, app build, simulator,
Xcode, native checkout, production mutation, commit or deployment ran.
Full A-R remains active: the remaining 63 caller contracts, full conditional
producer golden traces, privacy decisions/controls, metric/passport/segmentation
owners and native/production/separate-dashboard acceptance remain open.

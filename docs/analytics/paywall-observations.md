# Paywall Eligibility And Origin Observations

Implemented locally October 7, 2026 under the still-active A-R audit.
Only observation metadata and deterministic reporting change. Product selection,
SDK query count, eligibility filtering, checkout/recovery guards, restore,
access and navigation remain unchanged. PL retains P1W/P1M/P3M subscriptions;
CZ/SK retain the existing lifetime flow.

## Eligibility Producer

Three optional events use `trial_eligibility_observation_version=1`:

| Event | Grain And Meaning |
| --- | --- |
| `paywall_trial_eligibility_started` | Installation + `eligibility_request_id`; existing helper invocation, not proof a native query ran. |
| `paywall_trial_eligibility_resolved` | Installation + request + `eligibility_product_id`; one normalized product outcome. |
| `paywall_trial_eligibility_completed` | Installation + request; helper terminal, not checkout or a displayed offer. |

Every event binds the request to `paywall_view_id` and declares
`eligibility_scope=request_not_display`. Requested and distinct product counts
are separate: a duplicate SKU in helper input does not add a product outcome.
The requested SKU list is not exported; exact request-list membership cannot
be independently reconstructed from these counts.

Product outcomes are `eligible`, `ineligible`, `unknown`, `no_intro_offer` and
`error`. Request outcomes are `resolved`, `unsupported`, `not_configured`,
`no_products` and `error`.

- Actual known iOS SDK status uses `revenuecat_ios_status`. Unknown and missing
  SDK entries use `sdk_status_unknown` / `missing_product_response`; neither
  is converted into proven ineligibility.
- The original iOS UI filter still returns every SKU whose status is not
  eligible, including unknown/missing. Reporting observes the SDK result
  independently rather than interpreting that filter as eligibility.
- The original non-iOS helper returns an empty filter without a native
  eligibility query. Its product outcome remains unknown with
  `unsupported_platform`; a shown trial does not establish checked eligibility.
- Unconfigured and empty-input paths retain their original empty returns.
  SDK rejection retains the original error object and exports only a normalized
  category, never raw error text, receipts or account data.
- Each invocation captures its initial context. A superseded/stopped request
  can still emit diagnostic outcomes but cannot replace the current product
  snapshot. Repeated observer callbacks do not add stages.
- `eligibility_observer_active` and `eligibility_view_visible` describe callback
  observation scope. Visibility includes mounted/focused/foreground state;
  neither flag is native render acceptance.
- `eligibility_duration_ms` is helper-observation wall duration, not focused
  paywall time or study time. Missing terminal is unknown, not abandonment.

The version-1 selected-plan snapshot separately retains `trial_eligibility`,
`trial_eligibility_basis`, `trial_eligibility_request_id`, `trial_days` and
`trial_shown`. `no_intro_offer` maps to snapshot `no_trial`; a package without a
free trial has its separate `product_has_no_free_trial` basis. Missing raw
evidence remains unknown (`legacy_filter_only`), not inferred eligible.
`trial_shown` follows the existing resolved plan's trial days independently.
These are selected-plan metadata observations, not proof of native rendering,
trial start, entitlement or conversion.

## Immutable Origins

`paywall_origin_version=1` records initial screen/country configuration:
variant, offer kind, default plan, local config version, country/category/locale,
monetization version, presentation and entry source/surface.
`paywall_origin_basis=local_screen_config_not_remote_revision` explicitly does
not establish a remote RevenueCat revision.

`checkout_origin_version=1` records acquisition-time checkout input and selected
package, including plan/default/variant/config, country/category/locale,
SKU/package/offering/period, price/currency and trial metadata.
`checkout_origin_basis` distinguishes input with and without a selected package.
Restore from access center can have no selected product or paywall origin; it
does not acquire an invented purchase or paywall view.

Current/native package fields stay separate. A refresh can change the actual
native SKU or price without overwriting the input origin or creating an origin
conflict. Neither price belongs in verified-money totals.

The existing v1 checkout journal retains the safe scalar origin fields and
raw eligibility references. Journal keys, product validation, retry/restore
decisions and purchase invocation are unchanged. Original uncertain attempts
and new retries retain their own origins. A process restart or learning-country
switch does not rewrite the old origin. Old v1 records without origin metadata
remain `legacy_unobserved`; observer failure remains `observation_failed`.
Current configuration never backfills missing history.

## Diagnostic Passport

`paywall-observations-v1` is available through CLI `paywall-observations`,
`context.paywall_observations` and `health.paywall_observations`.

```bash
cd analytics-engine
.venv/bin/prawko-analytics paywall-observations --day 2026-10-03 \
  --out /tmp/prawko-paywall-observations.json
```

- Selection is operations with a new canonical observation in the half-open
  report window. Available pre-window stages can pair with a current terminal;
  a replay of an old completed operation does not add a current request.
- Warehouse CLI/context read available partitions before window end.
  Health's default is supplied rows only; callers can supply the warehouse
  report explicitly. Neither scope proves installation-lifetime history or
  historical delivery-as-of.
- `data-quality-v1` deduplicates request start/terminal and request-product
  outcomes by their declared installation-scoped grains. Reused request/view,
  platform/count bindings, contradictory outcomes and provider/client identity
  conflicts remain quarantined across available partitions.
- Source version must be integer 1, not boolean, a coerced string or another
  version. Counts, normalized outcome/basis combinations, native-query flags,
  error categories and declared clocks have independent strict gates.
- Request completion requires a valid observed start, ordered product outcomes
  and terminal, matching delivered distinct-product count and consistent
  request/product outcomes. Equal timestamps need actual `app_run_id` and
  `event_sequence`, not file/input order.
- `observed_product_outcomes` counts usable normalized product observations.
  It is not a complete-request population. Missing starts/products/terminals
  and scope conflicts remain explicit in request status/quality.
- Selected-plan evidence joins only explicit installation/request/product/view
  IDs with an earlier usable active product observation. A pending snapshot
  cannot borrow future evidence; a detached callback cannot prove current
  eligibility. Linked products and complete-request links are counted separately.
- Origin scopes are installation + view or purchase/restore attempt.
  Current country/native package changes do not conflict with a stable origin;
  changed origins, malformed values and mixed legacy/observed history do.
  Safe store labels such as `$rc_monthly` and named offerings are metadata,
  not account or business join keys.
- The report is count-only: `resolution_rate` and `displayed_trial_rate` remain
  null. Source coverage is explicit but cannot prove native delivery, render,
  eligibility outside the request, or missing callbacks.

The three eligibility events are not product-return activity, even when a
callback arrives after background/unmount or in a later calendar day.
Context calendar retention, health activity and learning TTV do not use them
as return/learning evidence. Their own integrity defects do not erase an
independent clean learning/purchase measurement.
Original offer/checkout interpretation IDs remain unchanged; the new
eligibility overlays are optional.

## Verification And Remaining Acceptance

Controlled SDK/helper tests retain original return/filter/error identity and
query counts across known/unknown/missing statuses, Android, unconfigured/empty
input, context/capture failure, stale requests and repeated callbacks.
Actual checkout/journal tests with mocked native adapters retain PL origins
through native package refresh/restart/access confirmation and cancelled retry;
CZ/SK lifetime through restart/country switch; access-center restore; and old
journal absence. These are not native purchases or rendered screen acceptance.

Engine acceptance covers strict source gates, request/product business grains,
historical replay/conflicts, order, detached/future product evidence, immutable
origins, current/native metadata differences, activity isolation, independent
conversion/TTV and CLI/context/health parity.
Completed broad results and pre-existing typecheck failures are recorded in
[handbook-implementation.md](./handbook-implementation.md).

Native SDK status/callback and queue delivery, actual rendered paywall traces,
production exports, complete request membership, remote revision provenance
and separate dashboard consumption remain unverified. No native build,
Maestro, simulator, Xcode, real checkout, production mutation, commit or
deployment is performed. Typed/golden QA for the rest of the catalog,
approved privacy purposes/controls, financial production acceptance and the
other full A-R requirements remain open.

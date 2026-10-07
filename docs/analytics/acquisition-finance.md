# First-Observed Financial Cohorts

Implemented locally October 7, 2026. `acquisition-financial-cohorts-v1` joins
explicit application namespaces, first-observed ASA installations and available
RevenueCat source-gross activity. It does not establish store proceeds, settled
money, physical-new-install ownership, a complete paid-download population or
ROAS. Full B/N and the [A-R ledger](./handbook-implementation.md) remain active.

This is offline analytics only. It changes no offering, purchase, restore,
entitlement, quota, score, route, ASA collection policy or SDK installation ID.
No production mapping, source review, webhook destination or consent is invented.

## Source And Application Gate

The client reads the existing native `Application.applicationId` into common
product/screen properties as `application_id`, with
`application_id_basis=native_application_id`. An absent/unsafe value remains
null with `not_available`; a getter failure remains null with
`observation_failed`. No country, locale, package name or SDK identity fallback
fills it. The optional observation does not write product state or interrupt
capture. Legacy records without this namespace cannot gain it retrospectively.

The separate operator manifest declares every namespace; ASA org and Apple Ads
account IDs are distinct, not assumed equal. The following is a **synthetic
schema example**, not a reviewed production mapping:

```json
{
  "format": "acquisition_app_scope_manifest_v1",
  "declared_at": "2026-10-07T12:00:00Z",
  "source": {
    "source_id": "synthetic-operator",
    "verification_basis": "unreviewed_mapping"
  },
  "scope": {
    "application_id": "pl.synthetic.bundle",
    "asa_org_id": 123,
    "apple_account_id": 124,
    "apple_app_id": 456,
    "revenuecat_project_id": "synthetic-rc-project",
    "revenuecat_app_id": "synthetic-rc-app",
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

Only `reviewed_app_scope_mapping`, with an explicit `source.reviewed_at` no
later than the declaration, can pass the mapping gate. A reviewed declaration
must cover the installation's entire half-open financial horizon. Review is an
operator assertion, not authentication by the engine. Numeric IDs must be
positive JS-safe integers; strings are bounded non-PII namespaces.
Report mapping summaries retain source ID, review/declaration clocks and
validity bounds, not just the selected namespace IDs.

`warehouse/acquisition/app-scopes.json` retains all declarations. Imports are
atomic/idempotent; newer conflicting declarations do not overwrite older ones.
Overlapping different bindings for an application, ASA-org disagreement and
reuse of its RevenueCat or Apple Ads app scope by another application restrict
the join. No exam-country-to-app or alias/account mapping is inferred.

## Identity And Financial Association

The grain is one durable `installation_observation_id`, bound to the primary
`app_user_id` and `first_observed_at` described in
[acquisition-cohorts.md](./acquisition-cohorts.md). Financial groups additionally
include native application ID, ASA result, org and campaign. This does not change
the ASA mix grain or version.

RevenueCat `app_user_id` can describe the latest subscriber identity, not the
original purchaser. Therefore an observed initial purchase/trial origin and
explicit original transaction lineage are required. Primary/original/alias IDs
must agree on the existing shared installation identity. A renewal without a
client capture can join its observed origin; a renewal without that origin
cannot be assigned to its latest subscriber by guesswork.

Non-recurring charges and their adjustments retain their transaction lineage.
Transfers, conflicting owners, provider/business conflicts and contradictory
lineage quarantine dependent associations rather than merging accounts.
Family-share access, lifecycle-only records, restore and client access
confirmation create no financial charge. An original subscription preceding
the first-observed anchor is not reanchored as a new acquisition; an effect
generated before its observed origin is also restricted.

The optional RevenueCat history view retains bounded available observations,
verification/conflict/money-issue flags and canonical/quarantined effects.
Default `finance` output is unchanged. This is available archive history, not
proof of installation-lifetime delivery.

## D7 And D30 Passports

- Selection: durable first observations in the requested `[start,end)` window,
  not ASA-response, native-install or purchase dates.
- Horizon: `[first_observed_at, first_observed_at + N * 24 hours)` for N=7/30.
  An event exactly at the upper bound belongs outside that horizon.
- Money clock: canonical RevenueCat event generation, not `purchased_at`.
  Refunds/reversals retain their signed effects at their own event generation.
- Source: declared authenticated RevenueCat archives for the exact mapped
  project/app, `APP_STORE` and `PRODUCTION`; never client display prices.
- Currency: exact Decimal charges/refunds/reversals remain separate. No FX,
  take-home estimate, commission deduction or settlement inference is added.
- Denominator: all horizon-mature anchored installations in the group.
  Immature installations stay censored; covered nonpayers remain included.
- `financial_payer_fraction`: mature installations with at least one associated
  positive canonical charge, divided by that mature denominator. A refund
  does not erase the fact that a charge was observed.
- Complete cohort values require clean dependent integrity, reviewed full
  mapping validity, verified PostHog observation coverage and explicit
  per-app production financial coverage of every mature horizon.

An authenticated empty production archive with complete coverage can establish
zero observed payers. No archive, partial coverage or sandbox-only coverage is
unknown, never complete zero. An unrelated app/project's incomplete source does
not invalidate a clean mapped scope.

Missing/unknown financial app, store or environment and unrecognized event types
restrict potentially affected horizons. Known identities scope these monetary
restrictions; missing identities leave an affected-app restriction. Monetary
restrictions also include known original transaction candidates when a missing
namespace is paired with a different latest subscriber ID; this can only
broaden restrictions, never create an ownership or money join. Monetary
defects after D7 do not erase clean D7 merely because D30 is incomplete.
Known valid gross effects may remain observed diagnostics, while complete totals
and payer fractions stay null. Ownership/provider/business conflicts remain
conservative restrictions over available history, not just a monetary horizon.

Supplied acquisition reports must match the explicit contract and all requested
clocks. Identical installation rows deduplicate; contradictory rows are not
first-write/last-write selected. Shared observation IDs restrict both owners.
Malformed supplied anchors/metadata restrict dependent cohorts rather than
silently improving denominators. The engine does not mutate the supplied report.

## Spend Diagnostic And Clocks

Expense requires the reviewed account/app/campaign from the mapping and one clean
whole campaign source window exactly equal to the cohort selection `[start,end)`.
Distinct declarations with identical namespace scopes can describe different
installation horizons without duplicating the campaign expense.
Partial/overlapping/conflicting windows, keyword children, unreviewed sources
and zero expense never generate a ratio. UTC and Warsaw bounds are not equated.
Source gates remain in [acquisition-spend.md](./acquisition-spend.md).

Only a fully mature, source-complete cohort and same-currency exact expense can
produce `gross_activity_to_declared_spend`. This is a first-observed cohort
**subset diagnostic**, not a complete paid-download cost denominator, realised
proceeds or ROAS. `proceeds=null` and `roas=null` always remain explicit.

`observe_through` is an exclusive event-time horizon, defaults to end and cannot
precede it. `as_of` separately filters available RevenueCat/spend exports and
mapping declarations. With an explicit cutoff, a mapping review after the last
financial export can be considered if it is available by that cutoff; its
financial coverage still comes only from the retained archive manifests.
Without an explicit cutoff, the latest available financial export supplies the
mapping/spend cutoff. `financial_as_of` and `mapping_spend_as_of` expose these
separate scopes. With no financial source, mappings remain diagnostic only.
Historical client delivery-as-of remains unverified.

The separate [billing-learning report](./billing-learning.md) observes
post-trial/post-paid-start learning with independent native/RevenueCat mappings.
It shares original-lineage ownership checks, but does not total money or require
clean refund economics to retain an already known positive start. This financial
consumer keeps the default strict charge/refund/adjustment lineage gate;
trial-phase revisions do not change financial effect generation or amounts.

## Consumption And Acceptance

```bash
cd analytics-engine
python -B -m prawko_analytics ingest-acquisition-mapping /private/path/app-scope.json
python -B -m prawko_analytics acquisition-finance --start 2026-09-01 --end 2026-09-02 \
  --observe-through 2026-10-03T00:00:00Z --as-of 2026-10-07T12:00:00Z \
  --out /tmp/prawko-financial-cohorts.json
```

CLI date bounds are exclusive Warsaw dates, not interchangeable with a UTC
spend report. Context includes `financial_cohorts` using its own window end as
observation horizon; newly anchored D7/D30 observations therefore stay censored.
Health accepts `build_health(..., financial_cohorts=report)` without pretending
it loaded warehouse history. Context serialization retains the report and its
null/limited source gates; no ranked causal or revenue conclusion is added.

Local fixtures cover source/mapping isolation, late ASA and renewal observations,
trials/conversions, non-recurring charges, refunds/reversals, aliases/transfers,
conflicts, malformed scopes, exact boundaries, censoring, sandbox/empty coverage,
historical export/declaration cuts, spend gates, atomic imports, supplied-report
integrity and CLI/context/health consumption. Mobile tests cover the helper and
actual base-properties wiring, including optional native getter failure.

Financial-cohort baseline verification: 536 Python tests passed / one skipped for the
missing gitignored October 3 production dump; 53 mobile suites / 398 tests
passed. Typecheck retains exactly the five baseline product-path errors in the
A-R ledger; no new analytics-path error was reported. `git diff --check` passes.
No native build, Maestro, simulator, Xcode, checkout, commit or deployment ran.
The subsequent billing-learning continuation passes 615 Python tests / one
skipped, including this consumer's strict financial gates. Its exact scope is
recorded in the A-R ledger and billing-learning passport.

Still required: real reviewed production app mappings, authoritative fresh
archives and spend manifests, store proceeds/reconciliation, correction/daily
source policies, acquisition-specific paid/trial engagement segmentation, separate dashboard integration
and owner/native/production acceptance. Local tests do not establish native
delivery, authenticated vendor configuration, financial settlement or an
approved privacy purpose.

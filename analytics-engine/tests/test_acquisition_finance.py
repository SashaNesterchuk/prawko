import json
from datetime import date, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest

from prawko_analytics.acquisition import observed_acquisition
from prawko_analytics.acquisition_finance import financial_cohort_report
from prawko_analytics.acquisition_mapping import (
    FORMAT, ingest_acquisition_mapping, ledger_path, mapping_declarations, select_mapping,
)
from prawko_analytics.cli import main
from prawko_analytics.context import build_context, day_window
from prawko_analytics.health import build_health
from prawko_analytics.revenuecat import financial_report, ingest_revenuecat
from prawko_analytics.spend import ingest_spend
from tests.test_acquisition import END, FIRST, START, THROUGH, _asa, _ingest_days, _row
from tests.test_revenuecat import _event
from tests.test_spend import csv_input, manifest

APP = "pl.synthetic.bundle"
EXPORT = THROUGH + timedelta(days=3)


def _mapping(tmp_path, warehouse, *, name="mapping", **changes):
    body = {
        "format": FORMAT, "declared_at": START.isoformat(),
        "source": {"source_id": "synthetic-operator", "verification_basis": "reviewed_app_scope_mapping",
                   "reviewed_at": START.isoformat()},
        "scope": {
            "application_id": APP, "asa_org_id": 123, "apple_account_id": 124, "apple_app_id": 456,
            "revenuecat_project_id": "rc-project", "revenuecat_app_id": "rc-app-ios",
            "store": "APP_STORE", "environment": "PRODUCTION", "identity_basis": "shared_installation_app_user_id",
        },
        "validity": {"window_start": START.isoformat(), "window_end": EXPORT.isoformat()},
    }
    for key, value in changes.items():
        body[key] = {**body[key], **value} if isinstance(value, dict) and key in body else value
    path = tmp_path / f"{name}.json"
    path.write_text(json.dumps(body))
    return ingest_acquisition_mapping(path, warehouse)


def _server(kind="INITIAL_PURCHASE", *, at=FIRST + timedelta(minutes=10), user="install-a", **changes):
    return _event(kind, at=at, **{
        "event_id": f"{kind}-{at.strftime('%Y%m%dT%H%M%S')}",
        "app_user_id": user, "original_app_user_id": user, "aliases": [user],
        "transaction_id": "tx-origin", "original_transaction_id": "tx-origin", **changes,
    })


def _source(tmp_path, warehouse, events, *, name="source", verified=True, coverage=True,
            exported=EXPORT, coverage_end=THROUGH, app="rc-app-ios", project="rc-project",
            environments=None):
    body = {
        "format": "revenuecat_webhook_archive_v1", "exported_at": exported.isoformat(),
        "source": {
            "provider": "revenuecat", "source_id": "synthetic-archive", "project_id": project, "app_ids": [app],
            "environments": environments if environments is not None else ["PRODUCTION", "SANDBOX"],
            "verification_basis": "authenticated_webhook_archive" if verified else "unverified_archive",
            "verified_at": START.isoformat(),
        },
        "coverage": {
            "time_basis": "revenuecat_event_generated_at", "pagination_complete": True, "truncated": False,
            "window_start": START.isoformat(), "window_end": coverage_end.isoformat(),
            "delivery_watermark": exported.isoformat(),
        } if coverage else None,
        "events": events,
    }
    path = tmp_path / f"{name}.json"
    path.write_text(json.dumps(body))
    return ingest_revenuecat(path, warehouse)


def _acquisition(rows=None, *, complete=True):
    return observed_acquisition(
        rows if rows is not None else [_asa(application_id=APP, application_id_basis="native_application_id")],
        start=START, end=END, observe_through=THROUGH, coverage_complete=complete,
    )


def _report(warehouse, **options):
    return financial_cohort_report(warehouse, **{
        "start": START, "end": END, "observe_through": THROUGH, "acquisition": _acquisition(), **options,
    })


def _cohort(report, days=7, campaign=456):
    return next(row for row in report["cohorts"] if row["days"] == days and row["asa_campaign_id"] == campaign)


def _warehouse(tmp_path, events=None, **source_options):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse)
    _source(tmp_path, warehouse, events if events is not None else [_server()], **source_options)
    return warehouse


def test_missing_mapping_and_money_are_unknown_not_zero(tmp_path):
    warehouse = tmp_path / "warehouse"
    assert _report(warehouse)["status"] == "mapping_not_loaded"
    assert _cohort(_report(warehouse))["financial_payer_fraction"] is None
    _mapping(tmp_path, warehouse)
    report = _report(warehouse)
    assert report["status"] == "financial_source_not_loaded"
    assert _cohort(report)["currencies"] == []
    assert _cohort(report)["financial_payer_fraction"] is None


def test_source_gross_is_installed_cohort_activity_not_client_prices_or_proceeds(tmp_path):
    warehouse = _warehouse(tmp_path)
    result = _report(warehouse)
    cohort = _cohort(result)
    assert cohort["status"] == "observed_mature_cohort_as_of"
    assert cohort["financial_payer_fraction"] == 1
    assert cohort["currencies"] == [{
        "currency": "PLN", "charges": "19.99", "refunds": "0", "refund_reversals": "0",
        "observed_net_gross": "19.99", "mature_cohort_net_gross": "19.99",
    }]
    assert cohort["app_scope_mappings"][0]["apple_account_id"] == 124
    assert result["proceeds"] is None and result["roas"] is None
    assert "revenuecat_reported_gross" in result["money_basis"]


def test_delayed_attribution_and_renewal_without_client_capture_use_original_installation(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(), _server("RENEWAL", at=FIRST + timedelta(days=2), transaction_id="renewal", event_id="renewal"),
    ])
    result = _report(warehouse, acquisition=_acquisition([
        _row("install_observation_resolved", application_id=APP, application_id_basis="native_application_id"),
        _asa(at=FIRST + timedelta(days=3), application_id=APP, application_id_basis="native_application_id"),
    ]))
    assert _cohort(result)["associated_effects"] == 2
    assert _cohort(result)["currencies"][0]["observed_net_gross"] == "39.98"
    assert _cohort(result)["observed_charged_installations"] == 1


def test_trials_are_not_payers_but_verified_conversion_is_a_charge(tmp_path):
    warehouse = _warehouse(tmp_path, [_server(period_type="TRIAL", price=0, price_in_purchased_currency=0)])
    trial = _cohort(_report(warehouse))
    assert trial["financial_payer_fraction"] == 0 and trial["currencies"] == []
    _source(tmp_path, warehouse, [
        _server("RENEWAL", at=FIRST + timedelta(days=2), transaction_id="conversion",
                event_id="conversion", is_trial_conversion=True),
    ], name="converted", coverage=False)
    assert _cohort(_report(warehouse))["financial_payer_fraction"] == 1
    assert _cohort(_report(warehouse))["currencies"][0]["observed_net_gross"] == "19.99"


def test_refunds_reversals_and_generation_horizons_are_not_backdated_to_sale(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(),
        _server("CANCELLATION", at=FIRST + timedelta(days=8), event_id="refund",
                cancel_reason="CUSTOMER_SUPPORT", price="-5", price_in_purchased_currency="-19.99"),
        _server("REFUND_REVERSED", at=FIRST + timedelta(days=10), event_id="reversal"),
    ])
    result = _report(warehouse)
    assert _cohort(result)["currencies"][0]["observed_net_gross"] == "19.99"
    d30 = _cohort(result, days=30)["currencies"][0]
    assert d30["refunds"] == "-19.99" and d30["refund_reversals"] == "19.99"


def test_half_open_horizon_and_immature_d30_are_censored(tmp_path):
    warehouse = _warehouse(tmp_path, [_server(at=FIRST + timedelta(days=7))])
    through = FIRST + timedelta(days=7)
    acquisition = observed_acquisition(
        [_asa(application_id=APP, application_id_basis="native_application_id")],
        start=START, end=END, observe_through=through, coverage_complete=True,
    )
    result = _report(warehouse, observe_through=through, acquisition=acquisition)
    assert _cohort(result)["financial_payer_fraction"] == 0
    assert _cohort(result, days=30)["censored_installations"] == 1
    assert _cohort(result, days=30)["financial_payer_fraction"] is None


def test_zero_production_scope_requires_explicit_production_coverage(tmp_path):
    warehouse = _warehouse(tmp_path, [])
    assert _cohort(_report(warehouse))["financial_payer_fraction"] == 0
    incomplete = tmp_path / "incomplete"
    _mapping(tmp_path, incomplete)
    _source(tmp_path, incomplete, [], coverage=False, name="partial")
    assert _cohort(_report(incomplete))["financial_payer_fraction"] is None


def test_sandbox_only_source_does_not_establish_zero_production_payers(tmp_path):
    warehouse = _warehouse(tmp_path, [_server(environment="SANDBOX")], environments=["SANDBOX"])
    cohort = _cohort(_report(warehouse))
    assert cohort["financially_covered_installations"] == 0
    assert cohort["financial_payer_fraction"] is None
    assert cohort["currencies"] == []


def test_family_sharing_and_nonfinancial_lifecycle_do_not_invent_or_require_a_charge_origin(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(is_family_share=True),
        _server("EXPIRATION", transaction_id="old-transaction", original_transaction_id="old-origin"),
    ])
    cohort = _cohort(_report(warehouse))
    assert cohort["financial_payer_fraction"] == 0
    assert cohort["status"] == "observed_mature_cohort_as_of"
    assert cohort["currencies"] == []


@pytest.mark.parametrize("changes", [
    {"store": None}, {"store": "unknown-store"}, {"app_id": None},
    {"environment": None}, {"environment": "unknown-environment"},
    {"transaction_id": None}, {"type": "UNKNOWN_FINANCIAL_TYPE"},
])
def test_unknown_financial_scope_or_schema_is_not_a_complete_zero(tmp_path, changes):
    warehouse = _warehouse(tmp_path, [_server(**changes)])
    cohort = _cohort(_report(warehouse))
    assert cohort["financial_payer_fraction"] is None
    assert cohort["integrity_restricted_installations"] == 1
    assert cohort["currencies"] == []


def test_unknown_store_without_identity_restricts_the_potentially_affected_app_scope(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(store=None, app_user_id=None, original_app_user_id=None, aliases=[]),
    ])
    assert _cohort(_report(warehouse))["issues"]["financial_store_scope_unknown"] == 1


def test_explicit_other_store_does_not_restrict_the_app_store_cohort(tmp_path):
    warehouse = _warehouse(tmp_path, [_server(store="PLAY_STORE")])
    assert _cohort(_report(warehouse))["financial_payer_fraction"] == 0


@pytest.mark.parametrize("changes", [
    {"price_in_purchased_currency": None},
    {"currency": None},
    {"store": None},
    {"environment": None},
    {"original_transaction_id": None},
    {"original_transaction_id": "origin-not-observed"},
])
def test_late_monetary_defect_restricts_d30_without_erasing_clean_d7(tmp_path, changes):
    warehouse = _warehouse(tmp_path, [
        _server(),
        _server("RENEWAL", at=FIRST + timedelta(days=8), transaction_id="renewal",
                event_id="late-renewal", **changes),
    ])
    report = _report(warehouse)
    d7, d30 = _cohort(report), _cohort(report, days=30)
    assert d7["financial_payer_fraction"] == 1
    assert d7["currencies"][0]["mature_cohort_net_gross"] == "19.99"
    assert d30["financial_payer_fraction"] is None


def test_malformed_refund_outside_d7_is_not_a_d7_money_conflict(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(),
        _server("CANCELLATION", at=FIRST + timedelta(days=8), event_id="refund",
                cancel_reason="CUSTOMER_SUPPORT", price=None, price_in_purchased_currency=None),
    ])
    result = _report(warehouse)
    assert _cohort(result)["financial_payer_fraction"] == 1
    assert _cohort(result, days=30)["issues"]["financial_amount_missing"] == 1
    assert _cohort(result, days=30)["currencies"][0]["mature_cohort_net_gross"] is None


def test_later_ownership_conflict_still_restricts_historical_financial_associations(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(),
        _server("RENEWAL", at=FIRST + timedelta(days=8), transaction_id="renewal",
                event_id="late-renewal", aliases=["install-a", "other-account"]),
    ])
    assert _cohort(_report(warehouse))["financial_payer_fraction"] is None


def test_monetary_defect_at_exact_d7_boundary_is_outside_d7(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(),
        _server("RENEWAL", at=FIRST + timedelta(days=7), transaction_id="renewal",
                event_id="boundary-renewal", price_in_purchased_currency=None),
    ])
    assert _cohort(_report(warehouse))["financial_payer_fraction"] == 1
    assert _cohort(_report(warehouse), days=30)["financial_payer_fraction"] is None


def test_effect_generated_before_observed_origin_is_not_allocated_as_verified_money(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(at=FIRST + timedelta(days=2)),
        _server("RENEWAL", at=FIRST + timedelta(days=1), transaction_id="renewal", event_id="renewal"),
    ])
    assert _cohort(_report(warehouse))["issues"]["transaction_origin_generation_after_effect"] == 1


@pytest.mark.parametrize("properties", [
    {"aliases": ["install-a", "account-b"]}, {"original_app_user_id": "legacy-anonymous"},
    {"original_app_user_id": None}, {"original_transaction_id": None},
])
def test_alias_account_or_missing_lineage_is_not_automatically_joined(properties, tmp_path):
    warehouse = _warehouse(tmp_path, [_server(**properties)])
    cohort = _cohort(_report(warehouse))
    assert cohort["financial_payer_fraction"] is None
    assert cohort["currencies"] == []
    assert cohort["integrity_restricted_installations"] == 1


def test_transfer_and_duplicate_provider_identity_conflicts_are_not_repaired(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(),
        _server("TRANSFER", event_id="transfer", transaction_id=None,
                transferred_from=["install-a"], transferred_to=["install-b"]),
    ])
    assert _cohort(_report(warehouse))["issues"]["subscriber_transfer_observed"] == 1
    other = tmp_path / "other"
    _mapping(tmp_path, other)
    _source(tmp_path, other, [
        _server(), _server(user="install-b", event_id=_server()["event"]["id"]),
    ], name="conflicted")
    assert _cohort(_report(other))["financial_payer_fraction"] is None


def test_duplicate_charge_under_different_subscriber_ids_never_first_wins(tmp_path):
    warehouse = _warehouse(tmp_path, [_server(), _server(user="install-b", event_id="duplicate-charge")])
    assert _cohort(_report(warehouse))["financial_payer_fraction"] is None
    assert _cohort(_report(warehouse))["currencies"] == []


def test_unknown_original_owner_does_not_assign_a_renewal_to_latest_install(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server("RENEWAL", transaction_id="renewal", event_id="renewal"),
    ])
    assert _cohort(_report(warehouse))["financial_payer_fraction"] is None
    assert _cohort(_report(warehouse))["observed_charged_installations"] == 0


def test_existing_subscription_before_first_observation_is_not_reanchored(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(at=FIRST - timedelta(hours=1)),
        _server("RENEWAL", at=FIRST + timedelta(days=2), transaction_id="renewal", event_id="renewal"),
    ])
    assert _cohort(_report(warehouse))["issues"]["transaction_origin_precedes_observation_anchor"] == 1


def test_nonrecurring_lifetime_charge_and_refund_keep_transaction_identity(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server("NON_RENEWING_PURCHASE", original_transaction_id="provider-lineage", period_type=None,
                currency="CZK", price_in_purchased_currency="299"),
        _server("CANCELLATION", at=FIRST + timedelta(days=2), event_id="refund",
                original_transaction_id="provider-lineage", cancel_reason="CUSTOMER_SUPPORT",
                currency="CZK", price="-5", price_in_purchased_currency="-299"),
    ])
    cohort = _cohort(_report(warehouse))
    assert cohort["financial_payer_fraction"] == 1
    assert cohort["currencies"][0]["mature_cohort_net_gross"] == "0"


def test_unverified_source_sandbox_and_missing_financial_coverage_are_not_zero(tmp_path):
    for index, options in enumerate(({"verified": False}, {"coverage": False})):
        warehouse = tmp_path / str(index)
        _mapping(tmp_path, warehouse, name=f"map-{index}")
        _source(tmp_path, warehouse, [_server()], name=f"source-{index}", **options)
        cohort = _cohort(_report(warehouse))
        assert cohort["financial_payer_fraction"] is None
        if not options.get("verified", True):
            assert cohort["currencies"] == []
    sandbox = _warehouse(tmp_path, [_server(environment="SANDBOX")])
    assert _cohort(_report(sandbox))["financial_payer_fraction"] == 0


def test_other_app_incomplete_coverage_does_not_suppress_clean_mapped_scope(tmp_path):
    warehouse = _warehouse(tmp_path)
    _source(tmp_path, warehouse, [
        _server(app_id="other-app", transaction_id="other-transaction", original_transaction_id="other-transaction"),
    ], app="other-app", name="other", coverage=False)
    assert _cohort(_report(warehouse))["financial_payer_fraction"] == 1


def test_other_project_and_other_app_unknown_store_do_not_suppress_clean_mapped_scope(tmp_path):
    warehouse = _warehouse(tmp_path)
    _source(tmp_path, warehouse, [_server(store=None, app_id="other-app")],
            app="other-app", name="other-app", coverage=False)
    _source(tmp_path, warehouse, [_server(store=None)],
            project="other-project", name="other-project", coverage=False)
    assert _cohort(_report(warehouse))["financial_payer_fraction"] == 1


def test_unknown_store_issue_with_another_identity_does_not_suppress_clean_installation(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(), _server(user="install-b", store=None, event_id="other-identity",
                          transaction_id="other-transaction", original_transaction_id="other-transaction"),
    ])
    assert _cohort(_report(warehouse))["financial_payer_fraction"] == 1


@pytest.mark.parametrize("changes", [
    {"store": None}, {"app_id": None}, {"environment": None},
    {"store": None, "type": "RENEWAL", "transaction_id": "new-renewal"},
])
def test_unknown_scope_with_known_transaction_restricts_its_original_owner_not_only_latest_id(tmp_path, changes):
    warehouse = _warehouse(tmp_path, [
        _server(), _server(user="install-b", event_id="unknown-scope-owner", **changes),
    ])
    cohort = _cohort(_report(warehouse))
    assert cohort["financial_payer_fraction"] is None
    assert cohort["currencies"][0]["mature_cohort_net_gross"] is None
    assert cohort["gross_activity_to_declared_spend"] == []


def test_business_effect_conflict_quarantines_dependent_installation(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(), _server(event_id="conflicting-business", price_in_purchased_currency="29.99"),
    ])
    cohort = _cohort(_report(warehouse))
    assert cohort["financial_payer_fraction"] is None
    assert cohort["issues"]["quarantined_transaction_observation"] >= 1


def test_missing_or_conflicting_native_app_id_cannot_be_guessed_from_country(tmp_path):
    warehouse = _warehouse(tmp_path)
    missing = _report(warehouse, acquisition=_acquisition([_asa()]))
    assert _cohort(missing)["issues"]["application_scope_not_observed"] == 1
    conflicted = _report(warehouse, acquisition=_acquisition([
        _asa(application_id=APP, application_id_basis="native_application_id"),
        _row("profile_action_selected", application_id="cz.other.bundle", application_id_basis="native_application_id"),
    ]))
    assert _cohort(conflicted)["financial_payer_fraction"] is None


def test_posthog_coverage_keeps_observed_money_but_no_complete_cohort_metric(tmp_path):
    warehouse = _warehouse(tmp_path)
    cohort = _cohort(_report(warehouse, acquisition=_acquisition(complete=False)))
    assert cohort["currencies"][0]["observed_net_gross"] == "19.99"
    assert cohort["currencies"][0]["mature_cohort_net_gross"] is None
    assert cohort["financial_payer_fraction"] is None


def test_earlier_export_as_of_never_uses_late_money_or_mapping_review(tmp_path):
    warehouse = _warehouse(tmp_path)
    past = _report(warehouse, as_of=THROUGH)
    assert _cohort(past)["financial_payer_fraction"] is None
    assert _cohort(past)["currencies"] == []
    late = tmp_path / "late"
    _mapping(tmp_path, late, declared_at=EXPORT.isoformat(), source={"reviewed_at": EXPORT.isoformat()}, name="late-map")
    _source(tmp_path, late, [_server()], exported=THROUGH, name="early-source")
    assert _report(late, as_of=THROUGH)["status"] == "mapping_not_loaded"


def test_explicit_as_of_can_include_review_after_last_financial_export(tmp_path):
    warehouse = tmp_path / "warehouse"
    review = THROUGH + timedelta(days=1)
    _mapping(tmp_path, warehouse, declared_at=review.isoformat(), source={"reviewed_at": review.isoformat()})
    _source(tmp_path, warehouse, [_server()], exported=THROUGH)
    assert _report(warehouse, as_of=THROUGH)["status"] == "mapping_not_loaded"
    report = _report(warehouse, as_of=EXPORT)
    assert report["financial_as_of"] == THROUGH.isoformat()
    assert report["mapping_spend_as_of"] == EXPORT.isoformat()
    assert _cohort(report)["financial_payer_fraction"] == 1


def test_identical_supplied_installation_rows_cannot_double_count_money(tmp_path):
    warehouse = _warehouse(tmp_path)
    acquisition = _acquisition()
    acquisition["installations"].append(dict(acquisition["installations"][0]))
    report = _report(warehouse, acquisition=acquisition)
    assert _cohort(report)["installations"] == 1
    assert _cohort(report)["associated_effects"] == 1
    assert _cohort(report)["currencies"][0]["mature_cohort_net_gross"] == "19.99"
    assert report["excluded"]["duplicate_supplied_installation_rows"] == 1


def test_supplied_observation_id_shared_between_installations_restricts_both(tmp_path):
    warehouse = _warehouse(tmp_path)
    acquisition = _acquisition([
        _asa(application_id=APP, application_id_basis="native_application_id"),
        _asa(user="install-b", application_id=APP, application_id_basis="native_application_id"),
    ])
    acquisition["installations"][1]["installation_observation_id"] = acquisition["installations"][0]["installation_observation_id"]
    cohort = _cohort(_report(warehouse, acquisition=acquisition))
    assert cohort["installations"] == 2
    assert cohort["integrity_restricted_installations"] == 2
    assert cohort["financial_payer_fraction"] is None


def test_conflicting_supplied_installation_records_are_not_first_write_wins(tmp_path):
    warehouse = _warehouse(tmp_path)
    acquisition = _acquisition([
        _asa(application_id=APP, application_id_basis="native_application_id"),
        _asa(user="install-b", application_id=APP, application_id_basis="native_application_id"),
    ])
    acquisition["installations"].append({
        **acquisition["installations"][0], "first_observed_at": (FIRST + timedelta(minutes=1)).isoformat(),
    })
    result = _report(warehouse, acquisition=acquisition)
    assert result["excluded"]["conflicting_supplied_installation_rows"] == 1
    assert _cohort(result)["installations"] == 1
    assert _cohort(result)["financial_payer_fraction"] is None


@pytest.mark.parametrize("changes", [
    {"attribution": ["unsafe"]},
    {"attribution": {"asa_org_id": True}},
    {"application_id": []},
    {"quality_issues": {"problem": True}},
    {"quality_issues": {"problem": -1}},
    {"cohort_selected": "true"},
])
def test_malformed_supplied_metadata_cannot_silently_improve_other_cohorts(tmp_path, changes):
    warehouse = _warehouse(tmp_path)
    acquisition = _acquisition([
        _asa(application_id=APP, application_id_basis="native_application_id"),
        _asa(user="install-b", application_id=APP, application_id_basis="native_application_id"),
    ])
    acquisition["installations"][1].update(changes)
    result = _report(warehouse, acquisition=acquisition)
    assert result["excluded"]["invalid_supplied_cohort_metadata"] == 1
    assert _cohort(result)["financial_payer_fraction"] is None


@pytest.mark.parametrize("changes", [
    {"rule_version": "unknown"}, {"installations": {}}, {"coverage_complete": "true"},
    {"quality_issues": {"missing_primary_installation_identity": "0"}},
    {"excluded_anchor_installations": ["unsafe"]},
    {"window_start": END.isoformat()},
])
def test_incompatible_supplied_report_is_rejected_without_guessing_metadata(tmp_path, changes):
    acquisition = {**_acquisition(), **changes}
    with pytest.raises(ValueError):
        _report(_warehouse(tmp_path), acquisition=acquisition)


def test_zero_issue_counters_do_not_restrict_a_clean_supplied_cohort(tmp_path):
    acquisition = _acquisition()
    acquisition["installations"][0]["quality_issues"]["absent_problem"] = 0
    assert _cohort(_report(_warehouse(tmp_path), acquisition=acquisition))["financial_payer_fraction"] == 1


@pytest.mark.parametrize("changes", [
    {"platform": "android"}, {"attribution": {"asa_result": "organic", "asa_org_id": 123, "asa_campaign_id": 456}},
])
def test_supplied_platform_and_terminal_disagreement_cannot_be_promoted_to_a_paid_scope(tmp_path, changes):
    acquisition = _acquisition()
    acquisition["installations"][0].update(changes)
    assert _cohort(_report(_warehouse(tmp_path), acquisition=acquisition))["financial_payer_fraction"] is None


def _spend(tmp_path, warehouse, *, currency="PLN", cost="10", name="spend", start="Sep 1, 2026",
           end="Sep 1, 2026", source_end=END, reviewed=True):
    csv_path = csv_input(tmp_path / f"{name}.csv", currency=currency, start=start, end=end,
                         rows=[["456", "private label", cost, "10"]])
    body = manifest(
        exported_at=EXPORT.isoformat(),
        source={"account_id": 124, "app_id": 456,
                "verification_basis": "reviewed_vendor_export" if reviewed else "unverified_csv"},
        coverage={"complete_scope": True},
        report={"currency": currency, "window_start": START.isoformat(), "window_end": source_end.isoformat()},
    )
    path = tmp_path / f"{name}-manifest.json"
    path.write_text(json.dumps(body))
    ingest_spend(csv_path, path, warehouse)


def test_exact_campaign_spend_ratio_is_explicit_gross_diagnostic_not_roas(tmp_path):
    warehouse = _warehouse(tmp_path)
    _spend(tmp_path, warehouse)
    result = _report(warehouse)
    cohort = _cohort(result)
    assert cohort["expense"]["exact_campaign_window"] is True
    ratio = cohort["gross_activity_to_declared_spend"][0]
    assert ratio["ratio"] == "1.999"
    assert ratio["declared_campaign_spend"] == "10"
    assert "not_roas" in ratio["basis"]
    assert cohort["roas"] is None and result["proceeds"] is None


def test_equivalent_scopes_with_distinct_validity_declarations_keep_one_campaign_expense(tmp_path):
    warehouse = tmp_path / "warehouse"
    later = FIRST + timedelta(hours=1)
    _mapping(tmp_path, warehouse, name="early", validity={"window_end": (FIRST + timedelta(days=7)).isoformat()})
    _mapping(tmp_path, warehouse, name="later", validity={"window_start": later.isoformat()})
    _source(tmp_path, warehouse, [_server()])
    _spend(tmp_path, warehouse)
    acquisition = _acquisition([
        _asa(application_id=APP, application_id_basis="native_application_id"),
        _asa(user="install-b", at=later + timedelta(minutes=5), first_observed_at=later.isoformat(),
             application_id=APP, application_id_basis="native_application_id"),
    ])
    cohort = _cohort(_report(warehouse, acquisition=acquisition))
    assert cohort["financial_payer_fraction"] == 0.5
    assert len(cohort["app_scope_mappings"]) == 2
    assert all(row["reviewed_at"] and row["validity"] for row in cohort["app_scope_mappings"])
    assert cohort["gross_activity_to_declared_spend"][0]["declared_campaign_spend"] == "10"
    assert cohort["gross_activity_to_declared_spend"][0]["ratio"] == "1.999"


def test_partially_mature_cohort_keeps_censored_nonpayers_out_of_the_fraction_and_expense_ratio(tmp_path):
    warehouse = _warehouse(tmp_path)
    _spend(tmp_path, warehouse)
    through = FIRST + timedelta(days=7)
    later = FIRST + timedelta(hours=1)
    acquisition = observed_acquisition([
        _asa(application_id=APP, application_id_basis="native_application_id"),
        _asa(user="install-b", at=later + timedelta(minutes=5), first_observed_at=later.isoformat(),
             application_id=APP, application_id_basis="native_application_id"),
    ], start=START, end=END, observe_through=through, coverage_complete=True)
    cohort = _cohort(_report(warehouse, observe_through=through, acquisition=acquisition))
    assert cohort["status"] == "partially_mature_cohort"
    assert cohort["mature_installations"] == 1 and cohort["censored_installations"] == 1
    assert cohort["financial_payer_fraction"] == 1
    assert cohort["expense"]["exact_campaign_window"] is True
    assert cohort["gross_activity_to_declared_spend"] == []


def test_explicit_as_of_can_include_cost_after_last_financial_export(tmp_path):
    warehouse = _warehouse(tmp_path, exported=THROUGH)
    _spend(tmp_path, warehouse)
    assert _cohort(_report(warehouse))["gross_activity_to_declared_spend"] == []
    result = _report(warehouse, as_of=EXPORT)
    assert result["financial_as_of"] == THROUGH.isoformat()
    assert result["mapping_spend_as_of"] == EXPORT.isoformat()
    assert _cohort(result)["gross_activity_to_declared_spend"][0]["ratio"] == "1.999"


@pytest.mark.parametrize("options", [
    {"currency": "EUR"}, {"cost": "0"}, {"reviewed": False},
    {"end": "Sep 2, 2026", "source_end": END + timedelta(days=1)},
])
def test_fx_zero_unreviewed_and_partial_spend_never_produce_a_ratio(tmp_path, options):
    warehouse = _warehouse(tmp_path)
    _spend(tmp_path, warehouse, **options)
    assert _cohort(_report(warehouse))["gross_activity_to_declared_spend"] == []


def test_conflicting_spend_is_retained_and_ratio_is_unknown(tmp_path):
    warehouse = _warehouse(tmp_path)
    _spend(tmp_path, warehouse)
    _spend(tmp_path, warehouse, cost="20", name="different")
    cohort = _cohort(_report(warehouse))
    assert cohort["expense"]["exact_campaign_window"] is False
    assert cohort["gross_activity_to_declared_spend"] == []


def test_mapping_idempotence_conflicts_as_of_and_no_country_names_or_secret_retention(tmp_path):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse, extra="private-secret")
    assert _mapping(tmp_path, warehouse, extra="private-secret")["duplicate_declarations"] == 1
    assert "private-secret" not in ledger_path(warehouse).read_text()
    _mapping(tmp_path, warehouse, name="conflict", scope={"revenuecat_app_id": "other-app"})
    _, status = select_mapping(mapping_declarations(warehouse), application_id=APP, asa_org_id=123, start=FIRST, end=THROUGH)
    assert status == "conflicting_app_scope_mapping"
    assert len(mapping_declarations(warehouse)) == 2


@pytest.mark.parametrize("scope", [
    {"application_id": "cz.other.bundle"},
    {"application_id": "cz.other.bundle", "revenuecat_app_id": "other-rc-app"},
])
def test_reuse_of_rc_or_apple_scope_for_another_application_is_not_automatic_mapping(tmp_path, scope):
    warehouse = _warehouse(tmp_path)
    _mapping(tmp_path, warehouse, name="other-application", scope=scope)
    assert _cohort(_report(warehouse))["issues"]["cross_application_mapping_ambiguity"] == 1


def test_mapping_review_full_validity_and_asa_org_must_match(tmp_path):
    warehouse = _warehouse(tmp_path)
    rows = mapping_declarations(warehouse)
    for altered, org, status in (
        ([{**rows[0], "verification_basis": "unreviewed_mapping"}], 123, "mapping_review_or_full_validity_missing"),
        ([{**rows[0], "validity": {**rows[0]["validity"], "window_end": (FIRST + timedelta(days=6)).isoformat()}}],
         123, "mapping_review_or_full_validity_missing"),
        (rows, 999, "asa_org_mapping_disagreement"),
    ):
        _, actual = select_mapping(altered, application_id=APP, asa_org_id=org,
                                   start=FIRST, end=FIRST + timedelta(days=7))
        assert actual == status


@pytest.mark.parametrize("changes", [
    {"scope": {"apple_app_id": True}}, {"scope": {"apple_app_id": "456"}},
    {"scope": {"application_id": "learner@example.com"}}, {"scope": {"environment": "SANDBOX"}},
    {"scope": {"identity_basis": "account_alias"}},
    {"source": {"reviewed_at": EXPORT.isoformat()}},
    {"validity": {"window_end": START.isoformat()}},
    {"declared_at": "2026-09-01T00:00:00"},
])
def test_invalid_mapping_is_not_written(tmp_path, changes):
    warehouse = tmp_path / "warehouse"
    with pytest.raises(ValueError):
        _mapping(tmp_path, warehouse, **changes)
    assert not ledger_path(warehouse).exists()


def test_mapping_atomic_failure_retains_prior_declarations(tmp_path):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse)
    before = ledger_path(warehouse).read_bytes()
    with patch("pathlib.Path.replace", side_effect=OSError("synthetic write failure")):
        with pytest.raises(OSError):
            _mapping(tmp_path, warehouse, name="changed", scope={"revenuecat_app_id": "other"})
    assert ledger_path(warehouse).read_bytes() == before


def test_cli_mapping_import_keeps_explicit_namespace_and_duplicate_declaration(tmp_path, capsys):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse)
    main(["ingest-acquisition-mapping", str(tmp_path / "mapping.json"), "--warehouse", str(warehouse)])
    result = json.loads(capsys.readouterr().out)
    assert result["retained_declarations"] == 1
    assert result["duplicate_declarations"] == 1


def test_opt_in_financial_history_does_not_change_the_default_financial_report(tmp_path):
    warehouse = _warehouse(tmp_path)
    report = financial_report(warehouse, start=START, end=THROUGH)
    expanded = financial_report(warehouse, start=START, end=THROUGH, include_history=True)
    history = expanded.pop("history")
    assert expanded == report
    assert history["observations"][0]["lifecycle_kind"] == "initial_purchase"
    assert history["canonical_effects"][0]["amount"] == "19.99"
    assert history["scope"] == "available_archive_events_as_of_not_installation_lifetime"


def test_cli_context_health_and_golden_money_lineage(tmp_path, capsys):
    native = {"application_id": APP, "application_id_basis": "native_application_id"}
    warehouse = _ingest_days(tmp_path, [_row("install_observation_resolved", **native), _asa(**native)], days=34)
    _mapping(tmp_path, warehouse)
    _source(tmp_path, warehouse, [_server()])
    main([
        "acquisition-finance", "--start", "2026-09-01", "--end", "2026-09-02",
        "--observe-through", THROUGH.isoformat(), "--warehouse", str(warehouse),
    ])
    payload = json.loads(capsys.readouterr().out)
    assert _cohort(payload)["financial_payer_fraction"] == 1
    context = build_context(warehouse, day_window(date(2026, 9, 1)))
    assert context.financial_cohorts["money_basis"] == payload["money_basis"]
    assert _cohort(context.financial_cohorts)["censored_installations"] == 1
    assert _cohort(context.financial_cohorts)["financial_payer_fraction"] is None
    assert context.model_validate_json(context.model_dump_json()).financial_cohorts == context.financial_cohorts
    health = build_health([], window_start=START, window_end=END, financial_cohorts=payload)
    assert health.monetization["financial_cohorts"] == payload
    assert health.monetization["revenuecat"] == "not_loaded"

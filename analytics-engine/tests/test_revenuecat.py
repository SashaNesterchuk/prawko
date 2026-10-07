import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import PreparedRow, build_context, day_window
from prawko_analytics.health import build_health
from prawko_analytics.revenuecat import financial_report, ingest_revenuecat, ledger_path
from tests.support import event, write_dump
from prawko_analytics.ingest import ingest_dump

UTC = timezone.utc
START = datetime(2026, 10, 3, tzinfo=UTC)
END = START + timedelta(days=1)
EXPORT = END + timedelta(hours=12)


def _ms(moment):
    return int(moment.timestamp() * 1000)


def _event(kind="INITIAL_PURCHASE", *, event_id="event-1", at=START, **fields):
    body = {
        "id": event_id,
        "type": kind,
        "app_id": "rc-app-ios",
        "event_timestamp_ms": _ms(at),
        "purchased_at_ms": _ms(at),
        "expiration_at_ms": _ms(at + timedelta(days=30)),
        "app_user_id": "usr_install",
        "original_app_user_id": "usr_install",
        "aliases": ["usr_install"],
        "entitlement_ids": ["premium"],
        "product_id": "pl.month",
        "transaction_id": "store-txn-1",
        "original_transaction_id": "store-lineage",
        "environment": "PRODUCTION",
        "store": "APP_STORE",
        "period_type": "NORMAL",
        "currency": "PLN",
        "price": "5",
        "price_in_purchased_currency": "19.99",
        "tax_percentage": "0.23",
        "commission_percentage": "0.15",
        "takehome_percentage": "0.7",
    }
    body.update(fields)
    return {"api_version": "1.0", "event": body, "received_at": (at + timedelta(seconds=2)).isoformat()}


def _archive(tmp_path, events, *, name="archive.json", exported=EXPORT, verified=True, coverage=True, **changes):
    payload = {
        "format": "revenuecat_webhook_archive_v1",
        "exported_at": exported.isoformat(),
        "source": {
            "provider": "revenuecat",
            "project_id": "rc-project",
            "source_id": "production-webhooks",
            "app_ids": ["rc-app-ios"],
            "environments": ["PRODUCTION", "SANDBOX"],
            "verification_basis": "authenticated_webhook_archive" if verified else "unverified_archive",
            "verified_at": START.isoformat(),
        },
        "events": events,
        "coverage": {
            "time_basis": "revenuecat_event_generated_at",
            "pagination_complete": True,
            "truncated": False,
            "window_start": START.isoformat(),
            "window_end": END.isoformat(),
            "delivery_watermark": exported.isoformat(),
        } if coverage else None,
    }
    payload.update(changes)
    path = tmp_path / name
    path.write_text(json.dumps(payload))
    return path


def _report(warehouse, **options):
    return financial_report(warehouse, start=START, end=END, **options)


def _client(*, event_name="purchase_succeeded", user="usr_install", at=START, **props):
    return PreparedRow(
        event_id="client-1", client_event_id="runtime:1", event=event_name,
        timestamp=at, dump_id="client-dump", properties={
            "transaction_id": "store-txn-1", "product_id": "pl.month",
            "purchase_attempt_id": "checkout-1", "paywall_view_id": "view-1",
            "price": 999999, "app_user_id": user, **props,
        },
        analysis_key=user, key_source="primary", app_version="1.0.31", schema=3,
        interpretation_id=None, match_status="no_contract",
    )


def test_missing_source_is_unknown_not_zero(tmp_path):
    report = _report(tmp_path)
    assert report["status"] == "not_loaded"
    assert report["currencies"] == []
    assert report["as_of"] is None


def test_controlled_lifecycle_preserves_gross_currency_and_adjustments(tmp_path):
    events = [
        _event(period_type="TRIAL", price=0, price_in_purchased_currency=0, event_id="trial", transaction_id="trial"),
        _event("RENEWAL", event_id="conversion", transaction_id="paid-1", is_trial_conversion=True, at=START + timedelta(hours=1)),
        _event("RENEWAL", event_id="renew", transaction_id="paid-2", is_trial_conversion=False, at=START + timedelta(hours=2)),
        _event("CANCELLATION", event_id="cancel", cancel_reason="UNSUBSCRIBE", price=0,
               price_in_purchased_currency=0, at=START + timedelta(hours=3)),
        _event("UNCANCELLATION", event_id="resume", price=0, price_in_purchased_currency=0, at=START + timedelta(hours=4)),
        _event("BILLING_ISSUE", event_id="billing", at=START + timedelta(hours=5)),
        _event("EXPIRATION", event_id="expiry", expiration_reason="BILLING_ERROR", at=START + timedelta(hours=6)),
        _event("CANCELLATION", event_id="refund", transaction_id="paid-1", cancel_reason="CUSTOMER_SUPPORT",
               price="-5", price_in_purchased_currency="-19.99", at=START + timedelta(hours=7)),
        _event("REFUND_REVERSED", event_id="reverse", transaction_id="paid-1", at=START + timedelta(hours=8)),
        _event("NON_RENEWING_PURCHASE", event_id="lifetime", product_id="cz.lifetime", transaction_id="lifetime",
               currency="CZK", price_in_purchased_currency="299", at=START + timedelta(hours=9)),
        _event("TRANSFER", event_id="transfer", transaction_id=None, transferred_to=["usr_other"]),
        _event(event_id="sandbox", transaction_id="sandbox", environment="SANDBOX"),
    ]
    ingest_revenuecat(_archive(tmp_path, events), tmp_path / "warehouse")
    report = _report(tmp_path / "warehouse")
    assert report["status"] == "observed_complete_as_of"
    assert report["lifecycle"]["trial_started"] == 1
    assert report["lifecycle"]["trial_converted"] == 1
    assert report["lifecycle"]["renewal"] == 1
    assert report["lifecycle"]["non_recurring_purchase"] == 1
    assert report["lifecycle"]["auto_renew_cancelled"] == 1
    assert report["lifecycle"]["auto_renew_resumed"] == 1
    assert report["lifecycle"]["billing_issue"] == 1
    assert report["lifecycle"]["expired"] == 1
    assert report["lifecycle"]["transfer"] == 1
    assert report["excluded"]["environment_sandbox"] == 1
    amounts = {item["currency"]: item for item in report["currencies"]}
    assert amounts["PLN"] == {
        "currency": "PLN", "charges": "39.98", "refunds": "-19.99",
        "refund_reversals": "19.99", "net_gross": "39.98",
    }
    assert amounts["CZK"]["net_gross"] == "299"
    assert report["usd"]["net_gross"] == "15"
    assert len(report["effects"]) == 5
    assert "store_proceeds" in report["must_not_claim"]
    expiry = next(item for item in report["lifecycle_observations"] if item["event_id"] == "expiry")
    assert expiry["expires_at"] is not None
    assert expiry["original_transaction_id"] == "store-lineage"


def test_reimport_and_repeated_transaction_never_add_another_charge(tmp_path):
    warehouse = tmp_path / "warehouse"
    archive = _archive(tmp_path, [_event()])
    ingest_revenuecat(archive, warehouse)
    duplicate = ingest_revenuecat(archive, warehouse)
    assert duplicate["duplicate_rows"] == 1
    same_transaction = _event(event_id="different-provider-id", at=START + timedelta(minutes=1))
    ingest_revenuecat(_archive(tmp_path, [same_transaction], name="partial.json", coverage=False), warehouse)
    report = _report(warehouse)
    assert report["complete"] is True
    assert report["currencies"][0]["net_gross"] == "19.99"
    assert report["duplicate_business_observations"] == 1
    ledger = json.loads(ledger_path(warehouse).read_text())
    assert len(ledger["events"]) == 2
    assert len(ledger["imports"]) == 2


def test_partial_and_unverified_archives_do_not_assert_complete_money(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()], verified=False), warehouse)
    unverified = _report(warehouse)
    assert unverified["status"] == "limited"
    assert unverified["currencies"] == []
    assert unverified["excluded"]["unverified_source"] == 1
    ingest_revenuecat(_archive(tmp_path, [_event()], name="verified.json", coverage=False), warehouse)
    verified = _report(warehouse)
    assert verified["complete"] is False
    assert verified["currencies"][0]["net_gross"] == "19.99"


def test_past_as_of_cannot_use_late_delivery_or_late_verification(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()], exported=END, verified=False), warehouse)
    ingest_revenuecat(_archive(tmp_path, [_event(), _event(event_id="late", transaction_id="late")],
                              name="late.json", exported=EXPORT), warehouse)
    past = _report(warehouse, as_of=END)
    assert past["currencies"] == []
    assert past["excluded"]["unverified_source"] == 1
    present = _report(warehouse)
    assert present["currencies"][0]["net_gross"] == "39.98"


def test_as_of_receipt_does_not_use_metadata_from_a_later_archive(tmp_path):
    warehouse = tmp_path / "warehouse"
    first = _event()
    first.pop("received_at")
    ingest_revenuecat(_archive(tmp_path, [first], exported=END), warehouse)
    ingest_revenuecat(_archive(tmp_path, [_event()], name="later.json"), warehouse)
    past = _report(warehouse, as_of=END)
    assert past["lifecycle_observations"][0]["received_at"] is None
    assert _report(warehouse)["lifecycle_observations"][0]["received_at"] is not None


def test_app_less_transfer_is_retained_but_never_a_financial_effect(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [
        _event(), _event("TRANSFER", event_id="transfer", app_id=None, transaction_id=None),
    ]), warehouse)
    report = _report(warehouse)
    assert report["lifecycle"]["transfer"] == 1
    assert report["issues"]["lifecycle_app_scope_missing"] == 1
    assert report["currencies"][0]["net_gross"] == "19.99"


def test_unknown_cancellation_reason_is_not_renewal_intent_or_an_invented_refund(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [
        _event("CANCELLATION", cancel_reason="UNKNOWN", price="-5", price_in_purchased_currency="-19.99"),
    ]), warehouse)
    report = _report(warehouse)
    assert report["lifecycle"] == {"cancellation_observed": 1}
    assert report["issues"]["unclassified_negative_adjustment"] == 1
    assert report["currencies"] == []


def test_unknown_enums_remain_distinct_conflicts_and_cannot_prove_production_money(tmp_path):
    warehouse = tmp_path / "warehouse"
    first = _event(environment="NEW_ENVIRONMENT")
    ingest_revenuecat(_archive(tmp_path, [first]), warehouse)
    report = _report(warehouse)
    assert report["issues"]["environment_unknown"] == 1
    assert report["currencies"] == []
    ingest_revenuecat(_archive(tmp_path, [
        _event(environment="OTHER_ENVIRONMENT"),
    ], name="different-enum.json"), warehouse)
    assert _report(warehouse)["issues"]["provider_id_conflicts"] == 1


def test_repeated_refund_after_a_reversal_is_not_silently_business_deduped(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [
        _event(),
        _event("CANCELLATION", event_id="refund", cancel_reason="CUSTOMER_SUPPORT",
               price="-5", price_in_purchased_currency="-19.99", at=START + timedelta(hours=1)),
        _event("REFUND_REVERSED", event_id="reversal", at=START + timedelta(hours=2)),
        _event("CANCELLATION", event_id="refund-again", cancel_reason="CUSTOMER_SUPPORT",
               price="-5", price_in_purchased_currency="-19.99", at=START + timedelta(hours=3)),
    ]), warehouse)
    report = _report(warehouse)
    assert report["issues"]["ambiguous_adjustment_cycle"] == 1
    assert report["currencies"] == []
    assert report["status"] == "limited"


def test_provider_and_business_conflicts_are_quarantined_not_overwritten(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()]), warehouse)
    imported = ingest_revenuecat(_archive(tmp_path, [
        _event(price_in_purchased_currency="30"),
    ], name="conflict.json"), warehouse)
    assert imported["conflicting_provider_ids"] == 1
    report = _report(warehouse)
    assert report["issues"]["provider_id_conflicts"] == 1
    assert report["currencies"] == []
    assert report["status"] == "limited"

    other = tmp_path / "other"
    ingest_revenuecat(_archive(tmp_path, [
        _event(), _event(event_id="different-event", price_in_purchased_currency="30"),
    ]), other)
    report = _report(other)
    assert report["issues"]["business_effect_conflicts"] == 1
    assert report["currencies"] == []


def test_refund_is_observed_in_adjustment_window_not_original_purchase_day(tmp_path):
    warehouse = tmp_path / "warehouse"
    refund = _event("CANCELLATION", cancel_reason="CUSTOMER_SUPPORT", price="-5",
                    price_in_purchased_currency="-19.99", purchased_at_ms=_ms(START - timedelta(days=30)))
    ingest_revenuecat(_archive(tmp_path, [refund]), warehouse)
    report = _report(warehouse)
    assert report["currencies"][0]["net_gross"] == "-19.99"
    assert report["window_basis"] == "revenuecat_event_generated_at"


@pytest.mark.parametrize("fields,issue", [
    ({"cancel_reason": "CUSTOMER_SUPPORT", "price_in_purchased_currency": "19.99"}, "financial_amount_sign_conflict"),
    ({"cancel_reason": "CUSTOMER_SUPPORT", "price_in_purchased_currency": None}, "financial_amount_missing"),
    ({"cancel_reason": "CUSTOMER_SUPPORT", "store": "UNKNOWN"}, "financial_scope_missing"),
])
def test_unproven_refund_amounts_do_not_become_money(tmp_path, fields, issue):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event("CANCELLATION", **fields)]), warehouse)
    report = _report(warehouse)
    assert report["issues"][issue] == 1
    assert report["currencies"] == []
    assert report["status"] == "limited"


def test_decimal_precision_and_missing_usd_are_explicit(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [
        _event(price=None, price_in_purchased_currency="0.1"),
        _event(event_id="two", transaction_id="two", price=None, price_in_purchased_currency="0.2"),
    ]), warehouse)
    report = _report(warehouse)
    assert report["currencies"][0]["net_gross"] == "0.3"
    assert report["usd"]["net_gross"] is None
    assert report["usd"]["missing_effects"] == 2


def test_reconciliation_does_not_guess_scope_identity_or_missing_transactions(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()]), warehouse)
    exact = _client(store="APP_STORE", store_environment="PRODUCTION",
                    revenuecat_app_id="rc-app-ios", revenuecat_project_id="rc-project")
    clients = [
        exact, exact,
        _client(purchase_attempt_id="two"),
        _client(purchase_attempt_id="three", transaction_id=None),
        _client(purchase_attempt_id="four", user="usr_other"),
        _client(purchase_attempt_id="five", product_id="other"),
        _client(purchase_attempt_id="six", transaction_id="missing"),
    ]
    report = _report(warehouse, client_rows=clients)
    reconciliation = report["reconciliation"]
    assert reconciliation["counts"] == {
        "matched": 1, "unique_candidate_scope_incomplete": 1, "transaction_id_missing": 1,
        "installation_identity_mismatch": 1, "product_mismatch": 1, "server_transaction_not_observed": 1,
    }
    assert reconciliation["duplicate_client_observations"] == 1
    assert reconciliation["exact_paywall_attribution"] is False
    assert report["currencies"][0]["net_gross"] == "19.99"


@pytest.mark.parametrize("marker,status", [
    ("_warehouse_business_conflict", "client_business_identity_conflict"),
    ("_warehouse_business_invalid", "invalid_client_business_observation"),
    ("_warehouse_business_order_uncertain", "client_business_order_unproven"),
])
def test_business_integrity_restricts_client_reconciliation_without_changing_server_money(tmp_path, marker, status):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()]), warehouse)
    client = _client(store="APP_STORE", store_environment="PRODUCTION",
                     revenuecat_app_id="rc-app-ios", revenuecat_project_id="rc-project", **{marker: True})
    result = _report(warehouse, client_rows=[client])
    assert result["reconciliation"]["counts"] == {status: 1}
    assert result["reconciliation"]["server_only"]
    assert result["currencies"][0]["net_gross"] == "19.99"


@pytest.mark.parametrize("annotation", [
    {"analytics_payload_valid": False},
    {"analytics_payload_contract_version": 1, "analytics_payload_contract_status": "invalid",
     "analytics_payload_valid": False},
    {"analytics_payload_contract_version": 2, "analytics_payload_contract_status": "invalid",
     "analytics_payload_valid": False},
    {"analytics_payload_contract_version": 3, "analytics_payload_contract_status": "valid",
     "analytics_payload_valid": True},
    {"analytics_payload_contract_version": 2, "analytics_payload_contract_status": "invalid",
     "analytics_payload_valid": True},
])
def test_payload_annotations_restrict_client_matching_but_never_authoritative_server_money(tmp_path, annotation):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()]), warehouse)
    client = _client(store="APP_STORE", store_environment="PRODUCTION",
                     revenuecat_app_id="rc-app-ios", revenuecat_project_id="rc-project", **annotation)
    result = _report(warehouse, client_rows=[client])
    assert result["reconciliation"]["counts"] == {"invalid_client_payload": 1}
    assert result["reconciliation"]["server_only"]
    assert result["currencies"][0]["net_gross"] == "19.99"


def test_historical_client_replay_is_not_a_new_reconciled_outcome(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()]), warehouse)
    result = _report(warehouse, client_rows=[
        _client(_warehouse_business_duplicate_before_window=True, _warehouse_business_duplicate=True),
        _client(_warehouse_business_duplicate=True),
    ])
    assert result["reconciliation"]["items"] == []
    assert result["reconciliation"]["pre_window_business_replays"] == 1
    assert result["reconciliation"]["duplicate_client_observations"] == 1
    assert result["currencies"][0]["net_gross"] == "19.99"


def test_bad_legacy_client_identifiers_do_not_crash_or_reexpose_contact_data(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()]), warehouse)
    report = _report(warehouse, client_rows=[_client(
        purchase_attempt_id={"email": "private@example.org"},
        transaction_id="private@example.org",
        paywall_view_id="https://private.example",
    )])
    assert report["reconciliation"]["counts"]["invalid_client_identifiers"] == 1
    assert "private" not in json.dumps(report)
    assert report["currencies"][0]["net_gross"] == "19.99"


def test_trial_checkout_is_reconciled_as_access_not_a_financial_charge(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event(period_type="TRIAL", price=0, price_in_purchased_currency=0)]), warehouse)
    report = _report(warehouse, client_rows=[_client()])
    item = report["reconciliation"]["items"][0]
    assert item["status"] == "unique_candidate_scope_incomplete"
    assert item["server_period_type"] == "TRIAL"
    assert item["financial_charge_observed"] is False
    assert report["currencies"] == []


def test_access_confirmation_of_old_ownership_does_not_add_a_new_charge(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event(at=START - timedelta(days=1))]), warehouse)
    report = _report(warehouse, client_rows=[_client(event_name="purchase_access_confirmed")])
    item = report["reconciliation"]["items"][0]
    assert item["status"] == "unique_candidate_scope_incomplete"
    assert item["financial_charge_observed"] is True
    assert item["financial_charge_in_report_window"] is False
    assert report["currencies"] == []
    assert report["effects"] == []


def test_same_transaction_id_in_different_store_is_ambiguous(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [
        _event(), _event(event_id="play", store="PLAY_STORE"),
    ]), warehouse)
    report = _report(warehouse, client_rows=[_client()])
    assert report["reconciliation"]["counts"]["transaction_scope_ambiguous"] == 1
    assert len(report["effects"]) == 2


def test_same_store_transaction_across_apps_is_not_summed_twice(tmp_path):
    warehouse = tmp_path / "warehouse"
    archive = _archive(tmp_path, [_event(), _event(event_id="other-app", app_id="rc-app-other")])
    payload = json.loads(archive.read_text())
    payload["source"]["app_ids"].append("rc-app-other")
    archive.write_text(json.dumps(payload))
    ingest_revenuecat(archive, warehouse)
    report = _report(warehouse)
    assert report["issues"]["cross_app_transaction_ambiguity"] == 1
    assert report["currencies"] == []
    assert report["usd"]["net_gross"] is None
    assert report["status"] == "limited"


def test_renewal_without_a_client_event_is_expected_not_a_missing_charge(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event("RENEWAL")]), warehouse)
    report = _report(warehouse, client_rows=[])
    assert report["reconciliation"]["server_only"][0]["reason"] == "renewal_without_client_expected"
    assert report["currencies"][0]["net_gross"] == "19.99"


def test_verified_empty_window_is_loaded_but_unproven_empty_window_is_not_complete(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, []), warehouse)
    report = _report(warehouse)
    assert report["status"] == "observed_complete_as_of"
    assert report["complete"] is True
    assert report["currencies"] == []
    other = tmp_path / "other"
    ingest_revenuecat(_archive(tmp_path, [], coverage=False), other)
    assert _report(other)["complete"] is False


def test_sandbox_only_source_cannot_assert_complete_production_or_zero_usd(tmp_path):
    warehouse = tmp_path / "warehouse"
    archive = _archive(tmp_path, [_event(environment="SANDBOX")])
    payload = json.loads(archive.read_text())
    payload["source"]["environments"] = ["SANDBOX"]
    archive.write_text(json.dumps(payload))
    ingest_revenuecat(archive, warehouse)
    report = _report(warehouse)
    assert report["complete"] is False
    assert report["status"] == "limited"
    assert report["usd"]["net_gross"] is None
    assert report["excluded"]["environment_sandbox"] == 1


def test_whitelist_does_not_retain_subscriber_attributes_or_purchase_receipts(tmp_path):
    warehouse = tmp_path / "warehouse"
    raw = _event(subscriber_attributes={"email": {"value": "sensitive@example.org"}},
                 receipt="sensitive receipt", presented_offering_context={"url": "https://secret.example"})
    ingest_revenuecat(_archive(tmp_path, [raw]), warehouse)
    contents = ledger_path(warehouse).read_text()
    assert "sensitive" not in contents
    assert "subscriber_attributes" not in contents
    assert '"receipt"' not in contents
    assert "https://" not in contents


def test_invalid_import_and_failed_replace_leave_previous_ledger_intact(tmp_path):
    warehouse = tmp_path / "warehouse"
    ingest_revenuecat(_archive(tmp_path, [_event()]), warehouse)
    before = ledger_path(warehouse).read_text()
    invalid = _archive(tmp_path, [_event(app_user_id="person@example.org")], name="invalid.json")
    with pytest.raises(ValueError, match="non-PII"):
        ingest_revenuecat(invalid, warehouse)
    assert ledger_path(warehouse).read_text() == before
    replacement = _archive(tmp_path, [_event(event_id="new", transaction_id="new")], name="new.json")
    with patch.object(Path, "replace", side_effect=OSError("write interrupted")):
        with pytest.raises(OSError, match="write interrupted"):
            ingest_revenuecat(replacement, warehouse)
    assert ledger_path(warehouse).read_text() == before


def test_context_health_and_cli_expose_separate_financial_source(tmp_path, capsys):
    warehouse = tmp_path / "warehouse"
    archive = _archive(tmp_path, [_event()])
    main(["ingest-revenuecat", str(archive), "--warehouse", str(warehouse)])
    assert json.loads(capsys.readouterr().out)["event_rows"] == 1
    main(["finance", "--start", "2026-10-03", "--end", "2026-10-04", "--warehouse", str(warehouse)])
    assert json.loads(capsys.readouterr().out)["basis"] == "revenuecat_reported_gross_event_activity"
    main(["finance", "--start", "2026-10-03", "--end", "2026-10-04", "--warehouse", str(warehouse),
          "--as-of", EXPORT.isoformat().replace("+00:00", "Z")])
    assert json.loads(capsys.readouterr().out)["as_of"] == EXPORT.isoformat()
    dump = write_dump(tmp_path / "client.json", day="2026-10-03", exported_at=EXPORT.isoformat(), events=[
        event("purchase_succeeded", START.isoformat(), "usr_install",
              transaction_id="store-txn-1", product_id="pl.month", purchase_attempt_id="checkout-1"),
    ])
    ingest_dump(dump, warehouse)
    context = build_context(warehouse, day_window(START.date()))
    assert context.financial["currencies"][0]["net_gross"] == "19.99"
    health = build_health([_client()], window_start=START, window_end=END, financial=_report(warehouse))
    assert health.monetization["revenuecat"] == "observed_complete_as_of"
    metric = next(item for item in health.metrics if item.id == "revenuecat_revenue")
    assert metric.reliable is False
    assert metric.numerator is None
    assert "not settled revenue" in metric.note

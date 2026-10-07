import json
from dataclasses import replace
from datetime import date, datetime

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import _prepare, build_context, day_window, load_prepared_rows
from prawko_analytics.contract import load_contract
from prawko_analytics.data_quality import observe_data_quality
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.payload_validation import (
    KEYS, STATUS, VALID, VERSION, invalid_client_payload, payload_validation_report, payload_validation_state,
)
from prawko_analytics.quality import observation_integrity_issue, observation_usable
from tests.support import LEARNING_INTERACTION_EVENTS, event, write_dump


WINDOW = day_window(date(2026, 10, 3))
CONTRACT = load_contract()


def annotation(version=2, status="valid", **changes):
    return {VERSION: version, STATUS: status, VALID: status != "invalid", KEYS: None, **changes}


def prepared(raw):
    return _prepare({
        **raw, "event_id": raw["uuid"],
        "timestamp": datetime.fromisoformat(raw["timestamp"].replace("Z", "+00:00")),
    }, CONTRACT)


@pytest.mark.parametrize("properties,state,unusable", [
    ({}, "unreported", False),
    ({VALID: True}, "legacy_valid_flag", False),
    ({VALID: False}, "legacy_invalid_flag", True),
    (annotation(1), "v1_valid", False),
    (annotation(), "v2_valid", False),
    (annotation(1, "invalid"), "v1_invalid", True),
    (annotation(2, "invalid"), "v2_invalid", True),
    (annotation(1, "not_defined"), "v1_not_defined", False),
    (annotation(2, "not_defined"), "v2_not_defined", False),
    (annotation(3), "unsupported_version", True),
    (annotation(-1), "unsupported_version", True),
    (annotation(10 ** 400), "unsupported_version", True),
    (annotation(True), "malformed_annotation", True),
    (annotation(2.0), "malformed_annotation", True),
    (annotation("2"), "malformed_annotation", True),
    (annotation(None), "malformed_annotation", True),
    (annotation(**{VALID: "false"}), "malformed_annotation", True),
    (annotation(**{VALID: 1}), "malformed_annotation", True),
    (annotation(**{STATUS: None}), "malformed_annotation", True),
    (annotation(**{STATUS: ["valid"]}), "malformed_annotation", True),
    (annotation(**{STATUS: "unknown-status"}), "malformed_annotation", True),
    (annotation(**{VALID: False}), "malformed_annotation", True),
    (annotation(2, "invalid", **{VALID: True}), "malformed_annotation", True),
    (annotation(2, "not_defined", **{VALID: False}), "malformed_annotation", True),
    (annotation(**{KEYS: "answer_id"}), "malformed_annotation", True),
    (annotation(**{KEYS: ["answer_id"]}), "malformed_annotation", True),
    ({STATUS: "valid", VALID: True}, "malformed_annotation", True),
    ({VALID: None}, "malformed_annotation", True),
    ({KEYS: None}, "malformed_annotation", True),
])
def test_annotation_states_are_bounded_without_reinterpreting_event_payloads(properties, state, unusable):
    assert payload_validation_state(properties) == state
    assert invalid_client_payload(properties) is unusable
    assert observation_integrity_issue(properties) is unusable
    assert observation_usable(properties) is not unusable


def test_missing_invalid_keys_does_not_erase_an_explicit_failure_after_sanitization():
    for version in (1, 2):
        properties = annotation(version, "invalid")
        del properties[KEYS]
        assert invalid_client_payload(properties)
        assert payload_validation_state(properties) == f"v{version}_invalid"
    assert invalid_client_payload({VALID: False, KEYS: None})


def test_report_separates_undefined_legacy_and_actual_reported_v2_validation_without_echoing_values():
    properties = [
        {}, {VALID: True}, {VALID: False}, annotation(1), annotation(),
        annotation(1, "invalid"), annotation(2, "invalid"),
        annotation(1, "not_defined"), annotation(2, "not_defined"),
        annotation(3), annotation(**{STATUS: "private@example.com"}),
    ]
    rows = [prepared(event("profile_action_selected", f"2026-10-03T10:{index:02}:00Z", "usr_i", **props))
            for index, props in enumerate(properties)]
    result = payload_validation_report(rows)
    assert set(result["counts"].values()) == {1}
    assert sum(result["counts"].values()) == len(rows)
    assert result["unusable_annotation_rows"] == 5
    assert result["v2_validation_observed_rows"] == 2
    assert result["retroactive_v2_validation"] is False
    assert result["basis"] == "source_reported_annotations_not_warehouse_revalidation"
    assert "private@example.com" not in json.dumps(result)


def test_empty_report_does_not_claim_catalog_coverage_or_delivery():
    result = payload_validation_report([])
    assert sum(result["counts"].values()) == 0
    assert result["v2_validation_observed_rows"] == result["unusable_annotation_rows"] == 0
    assert {"native_delivery", "full_catalog_schema_coverage"} <= set(result["must_not_be_interpreted_as"])


@pytest.mark.parametrize("event_name", [
    "learning_intent_requested", "learning_operation_failed", "screen_viewed",
    "notification_schedule_resolved", "notification_permission_requested", "notification_permission_resolved",
    "offline_pack_state_viewed", "offline_pack_download_started", "offline_pack_download_completed",
    "offline_pack_download_cancelled", "offline_pack_download_failed", "offline_pack_cancel_requested",
    "offline_pack_removed", "progress_reset_started", "progress_reset_failed", "progress_reset_confirmed",
] + list(LEARNING_INTERACTION_EVENTS))
def test_new_client_contracts_do_not_revalidate_historical_not_defined_observations(event_name):
    props = annotation(2, "not_defined")
    row = prepared(event(event_name, "2026-10-03T10:00:00Z", "usr_i", **props))
    # Business rules may separately reject missing operation evidence; client QA is not rerun.
    assert payload_validation_state(row.properties) == "v2_not_defined"
    assert not invalid_client_payload(row.properties)
    result = payload_validation_report([row])
    assert result["counts"]["v2_not_defined"] == 1
    assert result["v2_validation_observed_rows"] == 0
    assert result["retroactive_v2_validation"] is False
    assert all(row.properties[key] == value for key, value in props.items())


def purchase_trace():
    return [
        event("paywall_viewed", "2026-10-03T10:00:00Z", "usr_i", paywall_view_id="view-one"),
        event("paywall_offer_ready", "2026-10-03T10:01:00Z", "usr_i", paywall_view_id="view-one",
              offer_load_id="load-one", product_id="sku", currency="PLN", price=49.99),
        event("paywall_cta_selected", "2026-10-03T10:02:00Z", "usr_i", paywall_view_id="view-one", action="purchase"),
        event("purchase_started", "2026-10-03T10:03:00Z", "usr_i", paywall_view_id="view-one",
              checkout_view_id="view-one", purchase_attempt_id="purchase-one", product_id="sku",
              step="purchase_package", ui="package"),
        event("purchase_succeeded", "2026-10-03T10:04:00Z", "usr_i", paywall_view_id="view-one",
              checkout_view_id="view-one", purchase_attempt_id="purchase-one", product_id="sku",
              transaction_id=None, native_purchase_completed=True, confirmation_source="purchase_result"),
    ]


def learning_trace():
    anchor = {
        "installation_observation_id": "installation-one", "first_observed_at": "2026-10-03T09:00:00Z",
        "observation_detection_method": "first_local_observation", "observation_contract_version": 1,
    }
    return [
        event("install_observation_resolved", "2026-10-03T09:00:00Z", "usr_i", **anchor),
        event("training_session_completed", "2026-10-03T11:00:00Z", "usr_i", **anchor,
              training_session_id="training-one", mode="learning", accepted_unique_question_count=5,
              learning_outcome_rule_version="learning-v1", answered_count=5, correct_count=4,
              incorrect_count=1, passed=True, question_total=5, score_percent=80),
    ]


def context_for(tmp_path, rows):
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(tmp_path / "client.json", day="2026-10-03",
                           exported_at="2026-10-04T08:00:00Z", events=rows), warehouse)
    contract = replace(CONTRACT, metrics=tuple(replace(metric, min_denominator=1) for metric in CONTRACT.metrics))
    return warehouse, build_context(warehouse, WINDOW, contract)


def conversion(context):
    return next(item for item in context.metrics if item.id == "paywall_purchase_conversion")


@pytest.mark.parametrize("props", [annotation(1, "invalid"), annotation(2, "invalid"), annotation(3),
                                  annotation(**{VALID: False}), annotation(**{STATUS: "invalid"})])
@pytest.mark.parametrize("has_anchor", [False, True])
def test_unusable_purchase_annotation_restricts_only_dependent_rate_and_retains_raw_evidence(tmp_path, props, has_anchor):
    rows = purchase_trace()
    rows[-1]["properties"].update(props)
    if has_anchor:
        rows[-1]["properties"].update({
            key: learning_trace()[0]["properties"][key] for key in (
                "installation_observation_id", "first_observed_at", "observation_detection_method",
                "observation_contract_version",
            )
        })
    warehouse, context = context_for(tmp_path, rows + learning_trace())
    metric = conversion(context)
    assert metric.invalid_payload_rows == 1 and metric.value is None
    assert not metric.lead_visible
    assert any(reason.rule == "invalid_client_payload" for reason in metric.eligibility.reasons)
    assert context.learning_time_to_value.status == "observed"
    assert context.learning_time_to_value.achieved == 1
    assert context.learning_time_to_value.invalid_observation_rows == 0
    loaded = load_prepared_rows(warehouse, WINDOW)
    emitted = next(row for row in loaded if row.event == "purchase_succeeded")
    assert all(emitted.properties[key] == value for key, value in props.items())
    assert context.dataset.event_rows == len(rows) + 2


@pytest.mark.parametrize("observation_id,first_at", [
    ("installation-one", "2026-10-03T08:00:00Z"),
    ("installation-unknown", "2026-10-03T09:00:00Z"),
    (["installation-one"], "2026-10-03T09:00:00Z"),
    ("installation-one", "invalid"),
])
def test_invalid_ancillary_observation_with_conflicting_root_still_limits_learning_ttv(tmp_path, observation_id, first_at):
    rows = purchase_trace()
    rows[-1]["properties"].update({
        **annotation(2, "invalid"), "installation_observation_id": observation_id,
        "first_observed_at": first_at, "observation_contract_version": 1,
        "observation_detection_method": "first_local_observation",
    })
    _warehouse, context = context_for(tmp_path, rows + learning_trace())
    assert context.learning_time_to_value.status == "limited_integrity"
    assert context.learning_time_to_value.invalid_observation_rows == 1
    assert context.learning_time_to_value.median_achieved_seconds is None


def test_invalid_learning_does_not_erase_clean_purchase_conversion(tmp_path):
    learning = learning_trace()
    learning[-1]["properties"].update(annotation(2, "invalid", **{KEYS: "answered_count"}))
    _warehouse, context = context_for(tmp_path, purchase_trace() + learning)
    metric = conversion(context)
    assert metric.value == 1 and metric.invalid_payload_rows == 0
    assert context.learning_time_to_value.status == "limited_integrity"
    assert context.learning_time_to_value.achieved == 0
    assert context.learning_time_to_value.invalid_observation_rows == 1


@pytest.mark.parametrize("props,state", [({}, "unreported"), ({VALID: True}, "legacy_valid_flag"),
                                       (annotation(1), "v1_valid")])
def test_old_validation_is_not_upgraded_or_revalidated_against_new_v2_native_fields(tmp_path, props, state):
    rows = purchase_trace()
    rows[-1]["properties"].update(props)
    del rows[-1]["properties"]["native_purchase_completed"]
    del rows[-1]["properties"]["confirmation_source"]
    _warehouse, context = context_for(tmp_path, rows)
    assert conversion(context).value == 1
    report = context.data_quality["client_payload_validation"]
    assert report["counts"][state] >= 1
    assert report["v2_validation_observed_rows"] == 0
    assert report["retroactive_v2_validation"] is False


def test_cli_context_and_health_share_source_annotations_without_mutating_the_sdk_flags(tmp_path):
    rows = purchase_trace()
    rows[-1]["properties"].update(annotation(3))
    warehouse, context = context_for(tmp_path, rows)
    loaded = load_prepared_rows(warehouse, WINDOW)
    health = build_health(loaded, window_start=WINDOW.start, window_end=WINDOW.end, coverage_complete=True)
    report = context.data_quality["client_payload_validation"]
    assert report == health.data_quality["client_payload_validation"]
    assert report["counts"]["unsupported_version"] == 1
    assert health.data_quality["counts"]["invalid_client_payload_rows"] == 1
    assert next(row for row in loaded if row.event == "purchase_succeeded").properties[VALID] is True
    output = tmp_path / "quality.json"
    main(["data-quality", "--warehouse", str(warehouse), "--day", "2026-10-03", "--out", str(output)])
    assert json.loads(output.read_text())["client_payload_validation"] == report


def test_annotated_business_replays_remain_observations_not_additional_validation_operations():
    raw = learning_trace()[-1]
    raw["properties"].update(annotation())
    replay = event("training_session_completed", "2026-10-03T12:00:00Z", "usr_i", **raw["properties"])
    rows, report = observe_data_quality([prepared(raw), prepared(replay)], start=WINDOW.start, end=WINDOW.end,
                                        coverage_complete=True)
    assert report["counts"]["analysis_observation_rows"] == 1
    assert report["counts"]["duplicate_observation_rows"] == 1
    assert report["client_payload_validation"]["counts"]["v2_valid"] == 2
    assert report["client_payload_validation"]["grain"] == "retained_observation_row_not_business_operation"
    assert all(observation_usable(row.properties) for row in rows)

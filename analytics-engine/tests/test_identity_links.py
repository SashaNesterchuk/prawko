import json
from datetime import date, datetime, timezone

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import build_context, day_window
from prawko_analytics.identity import identity_link_report, observed_identity_links
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump


START = datetime(2026, 10, 3, tzinfo=timezone.utc)
END = datetime(2026, 10, 4, tzinfo=timezone.utc)


def link(hour, account, *, install="usr_i", previous=None, reason="initial", **props):
    return {
        "event": "analytics_identity_observed", "timestamp": START.replace(hour=hour),
        "event_id": f"provider-{install}-{hour}", "distinct_id": install,
        "properties": {
            "app_user_id": install, "supabase_user_id": account,
            "previous_supabase_user_id": previous, "identity_observation_reason": reason,
            "identity_scope": "install", "identity_link_version": 1, **props,
        },
    }


def report(rows, **kwargs):
    return observed_identity_links(rows, start=START, end=END, history_complete=True, **kwargs)


def test_guest_a_unlink_b_keeps_install_grain_and_temporal_boundaries():
    result = report([
        link(1, None), link(2, "account-A", reason="account_link"),
        link(3, None, previous="account-A", reason="account_unlink"),
        link(4, "account-B", reason="account_link"),
    ])
    assert result["status"] == "observed"
    assert [item["supabase_user_id"] for item in result["links"]] == [None, "account-A", None, "account-B"]
    assert result["links"][1]["observed_until"] == START.replace(hour=3).isoformat()
    assert result["links"][-1]["right_censored"]
    assert result["person_merging_enabled"] is False
    assert result["entitlement_transfer_inferred"] is False
    assert result["automatic_account_joins_enabled"] is False


def test_direct_account_switch_and_cross_device_observations_do_not_merge_installations():
    result = report([
        link(1, "account-A"), link(2, "account-B", previous="account-A", reason="account_switch"),
        link(3, "account-A", install="usr_second"),
    ])
    assert result["cross_device_accounts"] == 1
    assert result["installations_with_observations"] == 2
    assert result["links"][1]["start_reason"] == "account_switch"
    assert result["links"][0]["context_consistent"] is True


def test_runtime_restart_can_repeat_initial_state_without_multiplying_links():
    result = report([link(1, "account-A"), link(2, "account-A")])
    assert len(result["links"]) == 1
    assert result["links"][0]["observations"] == 2
    changed = report([link(1, "account-A"), link(2, "account-B")])
    assert changed["issues"]["unobserved_account_transition"] == 1
    assert changed["status"] == "limited"


def test_missing_previous_observation_is_not_backfilled_from_a_claimed_previous_account():
    result = report([link(2, "account-B", previous="account-A", reason="account_switch")])
    assert len(result["links"]) == 1
    assert result["links"][0]["supabase_user_id"] == "account-B"
    assert result["issues"]["previous_state_unobserved"] == 1
    conflict = report([link(1, "account-A"), link(2, "account-B", previous="account-C", reason="account_switch")])
    assert conflict["issues"]["previous_account_disagreement"] == 1
    assert conflict["links"][0]["context_consistent"] is False


def test_ordering_collision_is_unknown_unless_same_runtime_sequence_proves_order():
    a = link(1, "account-A")
    b = link(1, "account-B", previous="account-A", reason="account_switch")
    b["event_id"] = "another-provider"
    result = report([a, b, link(2, "account-B")])
    assert result["issues"]["ambiguous_observation_order"] == 1
    assert [item["supabase_user_id"] for item in result["links"]] == ["account-B"]
    a["properties"].update(app_run_id="run-a", event_sequence=1)
    b["properties"].update(app_run_id="run-a", event_sequence=2)
    ordered = report([b, a])
    assert ordered["issues"] == {}
    assert ordered["accepted_observations"] == 2
    assert ordered["links"][0]["supabase_user_id"] == "account-B"


def test_duplicate_observations_and_conflicting_event_ids_are_not_silently_resolved():
    a = link(1, "account-A", event_id="client-one")
    result = report([a, {**a, "event_id": "redelivered"}])
    assert result["accepted_observations"] == 1
    assert result["issues"]["duplicate_observation"] == 1
    conflict = link(2, "account-B", event_id="client-one")
    result = report([a, conflict])
    assert result["issues"]["conflicting_observation_id"] == 1
    assert result["links"] == []
    assert result["status"] == "limited"


@pytest.mark.parametrize("change", [
    {"supabase_user_id": "learner@example.com"},
    {"supabase_user_id": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsZWFybmVyIn0.fake-signature"},
    {"previous_supabase_user_id": []},
    {"identity_link_version": True},
    {"identity_observation_reason": "account_link", "supabase_user_id": None},
    {"analytics_payload_valid": False},
    {"_warehouse_import_conflict": True},
])
def test_bad_identity_payloads_are_quarantined_without_exposing_rejected_values(change):
    result = report([link(1, "account-A", **change)] if "supabase_user_id" not in change else [
        {**link(1, "account-A"), "properties": {**link(1, "account-A")["properties"], **change}},
    ])
    assert result["links"] == []
    assert result["issues"]["invalid_link_observation"] == 1
    assert "learner@example.com" not in json.dumps(result)
    assert "eyJhbGci" not in json.dumps(result)


def test_context_disagreement_and_sdk_person_collisions_are_quality_signals_not_mergers():
    a = link(1, "account-A")
    a["person_id"] = "sdk-person"
    context = {
        "event": "screen_viewed", "timestamp": START.replace(hour=2),
        "distinct_id": "usr_i", "person_id": "sdk-person",
        "properties": {"app_user_id": "usr_i", "supabase_user_id": "account-B"},
    }
    result = report([a, context])
    assert result["sdk_person_multiple_accounts"] == 1
    assert result["issues"]["event_context_disagreement"] == 1
    assert result["links"][0]["context_consistent"] is False
    assert report([context])["links"] == []
    assert report([context])["context_only_installations"] == 1


def test_legacy_aliases_and_distinct_id_install_collisions_are_visible_without_migration():
    first = link(1, "account-A")
    second = link(2, "account-B", previous="account-A", reason="account_switch")
    third = link(3, "account-A", install="usr_second")
    third["distinct_id"] = "usr_i"
    aliases = [{
        "event": "$create_alias", "timestamp": START.replace(hour=4), "distinct_id": "usr_i",
        "properties": {"alias": account},
    } for account in ["account-A", "account-B"]]
    result = report([first, second, third, *aliases])
    assert result["sdk_distinct_id_install_collisions"] == 1
    assert result["legacy_alias_events"] == 2
    assert result["legacy_alias_account_collisions"] == 2


def test_end_is_exclusive_and_later_account_switch_cannot_close_a_historical_interval():
    future = link(2, "account-B", previous="account-A", reason="account_switch")
    future["timestamp"] = END
    result = report([link(1, "account-A"), future])
    assert result["accepted_observations"] == 1
    assert result["links"][0]["observed_until"] is None
    assert result["historical_delivery_as_of_verified"] is False


def test_warehouse_context_and_cli_include_pre_window_history_and_keep_person_id(tmp_path):
    warehouse = tmp_path / "warehouse"
    first = event(
        "analytics_identity_observed", "2026-10-02T10:00:00Z", "usr_i",
        identity_link_version=1, identity_scope="install", identity_observation_reason="initial",
        supabase_user_id="account-A", previous_supabase_user_id=None,
    )
    second = event(
        "analytics_identity_observed", "2026-10-03T10:00:00Z", "usr_i",
        identity_link_version=1, identity_scope="install", identity_observation_reason="account_switch",
        supabase_user_id="account-B", previous_supabase_user_id="account-A",
    )
    for day, item in [("2026-10-02", first), ("2026-10-03", second)]:
        ingest_dump(write_dump(
            tmp_path / f"{day}.json", day=day, exported_at="2026-10-04T10:00:00Z", events=[item],
        ), warehouse)
    window = day_window(date(2026, 10, 3))
    result = identity_link_report(warehouse, start=window.start, end=window.end)
    assert result["history_coverage_complete"] is True
    assert result["links"][0]["supabase_user_id"] == "account-A"
    assert result["links"][0]["left_censored"] is True
    assert result["sdk_person_multiple_accounts"] == 1
    context = build_context(warehouse, window)
    assert context.identity.primary_analysis_key == "app_user_id"
    assert context.identity_links == result
    out = tmp_path / "links.json"
    main(["identity-links", "--start", "2026-10-03", "--end", "2026-10-04", "--warehouse", str(warehouse), "--out", str(out)])
    assert json.loads(out.read_text()) == result


def test_missing_history_coverage_stays_limited_and_invalid_windows_are_rejected(tmp_path):
    empty = identity_link_report(tmp_path / "warehouse", start=START, end=END)
    assert empty["status"] == "not_observed"
    assert empty["history_coverage_complete"] is False
    for start, end in [(END, START), (START.replace(tzinfo=None), END)]:
        with pytest.raises(ValueError):
            identity_link_report(tmp_path, start=start, end=end)


def test_invalid_account_observation_closes_prior_link_without_assigning_a_new_account():
    invalid = link(2, "account-B", identity_link_version=2)
    result = report([link(1, "account-A"), invalid, link(3, "account-C")])
    assert result["links"][0]["observed_until"] == START.replace(hour=2).isoformat()
    assert result["links"][0]["context_consistent"] is False
    assert result["links"][1]["supabase_user_id"] == "account-C"
    assert result["issues"]["invalid_state_boundary"] == 1


def test_importer_preserves_conflicting_account_observations_for_warehouse_quality_review(tmp_path):
    first = event(
        "analytics_identity_observed", "2026-10-03T10:00:00Z", "usr_i",
        event_id="run:1", identity_link_version=1, identity_scope="install",
        identity_observation_reason="initial", supabase_user_id="account-A", previous_supabase_user_id=None,
    )
    second = {
        **first, "uuid": "another-provider",
        "properties": {**first["properties"], "supabase_user_id": "account-B"},
    }
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(
        tmp_path / "dump.json", day="2026-10-03", exported_at="2026-10-04T10:00:00Z", events=[first, second],
    ), warehouse)
    context = build_context(warehouse, day_window(date(2026, 10, 3)))
    assert context.dataset.event_rows == 2
    assert context.identity_links["links"] == []
    assert context.identity_links["issues"]["invalid_link_observation"] == 2
    assert any(item.id == "identity_links_limited" for item in context.qa)


def test_provider_id_conflicts_are_checked_even_when_client_ids_differ():
    a = link(1, "account-A", event_id="client-a")
    b = link(2, "account-B", event_id="client-b")
    b["event_id"] = a["event_id"]
    result = report([a, b])
    assert result["links"] == []
    assert result["issues"]["conflicting_observation_id"] == 1


def test_historical_alias_review_does_not_require_new_link_events():
    contexts = [{
        "event": "screen_viewed", "timestamp": START.replace(hour=hour), "distinct_id": "usr_i",
        "properties": {"app_user_id": "usr_i", "supabase_user_id": account},
    } for hour, account in [(1, "account-A"), (2, "account-B")]]
    aliases = [{
        "event": "$create_alias", "timestamp": START.replace(hour=3), "distinct_id": "usr_i",
        "properties": {"alias": account},
    } for account in ["account-A", "account-B"]]
    result = report([*contexts, *aliases])
    assert result["links"] == []
    assert result["status"] == "not_observed"
    assert result["legacy_alias_account_collisions"] == 1
    assert result["historical_sdk_quality_status"] == "review_required"


def test_simultaneous_base_context_disagreement_remains_uncertain():
    context = {
        "event": "screen_viewed", "timestamp": START.replace(hour=1),
        "properties": {"app_user_id": "usr_i", "supabase_user_id": "account-B"},
    }
    result = report([link(1, "account-A"), context])
    assert result["issues"]["same_time_context_disagreement"] == 1
    assert result["links"][0]["context_consistent"] is False
    assert result["status"] == "limited"


def test_cross_partition_identity_id_collision_with_another_event_creates_unknown_boundary(tmp_path):
    first = event("analytics_identity_observed", "2026-10-02T10:00:00Z", "usr_i",
                  event_id="run:one", supabase_user_id="account-A", previous_supabase_user_id=None,
                  identity_observation_reason="initial", identity_scope="install", identity_link_version=1)
    second = event("screen_viewed", "2026-10-03T10:00:00Z", "usr_i",
                   event_id="run:one", supabase_user_id="account-A", screen_name="home")
    warehouse = tmp_path / "warehouse"
    for day, raw in (("2026-10-02", first), ("2026-10-03", second)):
        ingest_dump(write_dump(tmp_path / f"{day}.json", day=day,
                               exported_at="2026-10-04T08:00:00Z", events=[raw]), warehouse)
    result = identity_link_report(warehouse, start=START, end=END)
    assert result["links"] == []
    assert result["status"] == "limited"
    assert result["issues"]["invalid_link_observation"] == 1
    assert result["source_integrity"]["counts"]["import_conflict_rows"] == 2

import json
from datetime import date, datetime

import pytest

from prawko_analytics.cli import main
from prawko_analytics.content import content_observations_report
from prawko_analytics.context import _prepare, build_context, day_window
from prawko_analytics.contract import load_contract
from prawko_analytics.health import build_health
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump


QUESTION = "content-v1:1111111111111111"
EXPLANATION = "content-v1:2222222222222222"
DISPLAY = "content-v1:3333333333333333"
PARAMETERS = "content-v1:4444444444444444"
PROFILE = "content-v1:5555555555555555"
OTHER = "content-v1:6666666666666666"


def prepared(raw):
    timestamp = raw["timestamp"]
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    return _prepare({**raw, "timestamp": timestamp}, load_contract())


def content_event(name="training_question_answered", timestamp="2026-10-03T10:00:00Z", install="usr_i", **changes):
    return event(name, timestamp, install, **{
        "question_id": "q-1", "question_revision": QUESTION, "explanation_revision": EXPLANATION,
        "training_session_id": "training-1", "answer_id": "answer-1", "is_correct": False,
        "content_revision_algorithm": "content-v1", "content_requested_locale": "ua",
        "content_language_basis": "selected_text_field", "content_language": "ua", "explanation_language": "ua",
        "content_provenance_version": 1, "content_observation_status": "observed",
        "content_text_field": "ua", "content_source_language": "cs", "content_source_kind": "question_content",
        "content_source_language_basis": "mapper_fallback_provenance",
        "explanation_text_field": "ua", "explanation_source_language": "cs", "explanation_source_kind": "ai_explanation",
        "explanation_source_language_basis": "mapper_fallback_provenance",
        "choice_source_languages": "cs,en", "choice_unknown_source_count": 0,
        "content_source_language_verification": "declared_input_locale_not_language_detection", **changes,
    })


def display_event(timestamp="2026-10-03T10:01:00Z", **changes):
    return content_event("answer_explanation_viewed", timestamp, **{
        "explanation_display_observation_version": 1, "explanation_display_variant": "full",
        "explanation_rendered_state": "text", "explanation_display_revision": DISPLAY,
        "explanation_display_revision_basis": "rendered_text_value",
        "explanation_display_matches_selected_field": True, **changes,
    })


def rule_event(timestamp="2026-10-03T10:00:00Z", install="usr_i", **changes):
    return event("exam_session_started", timestamp, install, **{
        "exam_session_id": "exam-1", "exam_rules_observation_version": 1,
        "exam_session_rules_status": "observed", "exam_session_rules_revision": PARAMETERS,
        "exam_session_rules_revision_basis": "persisted_session_parameters",
        "exam_origin_profile_revision": PROFILE, "exam_origin_profile_basis": "persisted_creation_profile",
        "exam_origin_country": "PL", "exam_origin_category": "B", "exam_origin_mode": "exam",
        "exam_origin_question_total": 32, "exam_origin_total_points": 74, "exam_origin_pass_points": 68,
        "exam_origin_duration_seconds": 1500, "exam_origin_navigation": "forward_only",
        "exam_rules_revision": OTHER, "exam_rules_revision_basis": "current_country_config", **changes,
    })


def report(*raws, complete=True):
    return content_observations_report([prepared(raw) for raw in raws], coverage_complete=complete)


def test_source_provenance_is_separate_from_selected_field_and_no_text_is_exported():
    result = report(content_event(question_text="private prompt", explanation_text="private explanation"))
    assert result["provenance"]["content_source_field_difference_rows"] == 1
    assert result["provenance"]["groups"][0]["content_text_field"] == "ua"
    assert result["provenance"]["groups"][0]["content_source_language"] == "cs"
    assert result["status"] == "observed"
    assert "private" not in json.dumps(result)
    assert "rate" not in result


def test_changed_question_translation_and_explanation_revisions_are_not_pooled():
    result = report(
        content_event(),
        content_event(timestamp="2026-10-03T11:00:00Z", question_revision=OTHER),
        content_event(timestamp="2026-10-03T12:00:00Z", explanation_revision=OTHER, explanation_source_kind="legacy_explanation"),
    )
    assert len(result["provenance"]["groups"]) == 3
    assert result["provenance"]["conflicting_source_bindings"] == 0


def test_spanish_request_retains_english_field_and_declared_czech_source():
    result = report(content_event(
        content_requested_locale="es", content_language="en", content_text_field="en",
        explanation_language="en", explanation_text_field="en",
    ))
    assert result["provenance"]["groups"][0]["content_requested_locale"] == "es"
    assert result["provenance"]["groups"][0]["content_source_language"] == "cs"


def test_old_cache_unknown_and_stale_provenance_are_never_guessed_from_locale():
    unknown = content_event(
        content_source_language=None, content_source_kind=None, content_source_language_basis="not_recorded",
        explanation_source_language=None, explanation_source_kind=None, explanation_source_language_basis="not_recorded",
        choice_source_languages=None, choice_unknown_source_count=2,
    )
    stale = content_event(
        timestamp="2026-10-03T11:00:00Z", content_source_language=None, content_source_kind=None,
        content_source_language_basis="provenance_revision_mismatch",
    )
    result = report(unknown, stale, event("training_question_viewed", "2026-10-03T12:00:00Z", "usr_i", question_id="q-1"))
    assert result["status"] == "limited"
    assert result["provenance"]["unknown_content_source_rows"] == 2
    assert result["provenance"]["stale_provenance_rows"] == 1
    assert result["provenance"]["legacy_events"] == 1
    assert result["provenance"]["invalid_observations"] == 0


@pytest.mark.parametrize("changes", [
    {"content_provenance_version": True},
    {"content_provenance_version": 2},
    {"content_source_language": ["cs"]},
    {"content_source_language_basis": "not_recorded"},
    {"content_language": "en"},
    {"question_revision": "raw-source-text"},
    {"content_requested_locale": "learner@example.com"},
    {"app_user_id": "learner@example.com"},
    {"choice_source_languages": "cs,cs"},
    {"choice_source_languages": "en,cs"},
    {"choice_unknown_source_count": True},
    {"analytics_payload_valid": False},
    {"_warehouse_import_conflict": True},
])
def test_malformed_provenance_and_source_quality_failures_do_not_enter_groups(changes):
    result = report(content_event(**changes))
    assert result["provenance"]["invalid_observations"] == 1
    assert not result["provenance"]["groups"]
    assert "learner@example.com" not in json.dumps(result)
    assert "raw-source-text" not in json.dumps(result)


def test_same_revision_with_different_declared_provenance_is_a_quality_conflict():
    result = report(content_event(), content_event(timestamp="2026-10-03T11:00:00Z", content_source_language="en"))
    assert result["provenance"]["conflicting_source_bindings"] == 1
    assert result["status"] == "limited"


def test_full_marked_locked_empty_and_rendered_variants_remain_distinct():
    result = report(
        display_event(),
        display_event("2026-10-03T10:02:00Z", explanation_display_variant="free_topic_marked"),
        display_event("2026-10-03T10:03:00Z", explanation_display_variant="locked",
                      explanation_rendered_state="locked", explanation_display_revision=None,
                      explanation_display_matches_selected_field=None),
        display_event("2026-10-03T10:04:00Z", explanation_rendered_state="empty",
                      explanation_display_revision=None, explanation_display_matches_selected_field=False),
        display_event("2026-10-03T10:05:00Z", explanation_display_revision=OTHER,
                      explanation_display_matches_selected_field=False),
    )
    groups = result["explanations"]["groups"]
    assert len(groups) == 5
    assert {group["explanation_revision"] for group in groups} == {EXPLANATION}
    assert len([group for group in groups if group["explanation_display_revision"] == DISPLAY]) == 2
    assert result["explanations"]["rendered_variant_differs_rows"] == 2


@pytest.mark.parametrize("changes", [
    {"explanation_display_observation_version": True},
    {"explanation_display_variant": "locked"},
    {"explanation_display_revision": "unverified"},
    {"explanation_rendered_state": "empty"},
    {"explanation_display_matches_selected_field": []},
    {"analytics_payload_valid": False},
])
def test_invalid_display_observations_cannot_become_text_exposure(changes):
    result = report(display_event(**changes))
    assert result["explanations"]["invalid_observations"] == 1
    assert not result["explanations"]["groups"]


def test_explicit_failed_source_and_display_observations_are_visible_but_not_backfilled():
    result = report(display_event(
        content_observation_status="failed", explanation_rendered_state="not_observed",
        explanation_display_revision=None, explanation_display_revision_basis="observation_failed",
        explanation_display_matches_selected_field=None,
    ))
    assert result["provenance"]["failed_observations"] == 1
    assert result["explanations"]["failed_observations"] == 1
    assert result["explanations"]["groups"][0]["question_revision"] is None
    assert result["status"] == "limited"


def test_creation_profile_category_and_parameters_do_not_follow_current_app_config():
    result = report(rule_event(exam_country="CZ", category="A", exam_rules_revision=OTHER))
    group = result["exam_rules"]["groups"][0]
    assert group["exam_origin_profile_revision"] == PROFILE
    assert group["exam_origin_country"] == "PL"
    assert group["exam_origin_category"] == "B"
    assert "exam_rules_revision" not in group
    assert result["exam_rules"]["conflicting_sessions"] == 0


def test_same_session_id_on_different_installations_is_not_a_conflict():
    result = report(rule_event(), rule_event(install="usr_other", exam_origin_profile_revision=OTHER))
    assert result["exam_rules"]["observed_parameter_rows"] == 2
    assert result["exam_rules"]["conflicting_sessions"] == 0


@pytest.mark.parametrize("changes", [
    {"exam_session_rules_revision": OTHER},
    {"exam_origin_pass_points": 70},
    {"exam_origin_category": "A"},
    {"exam_origin_profile_revision": OTHER},
])
def test_session_parameter_or_profile_conflicts_quarantine_all_scoped_rows(changes):
    result = report(rule_event(), rule_event("2026-10-03T11:00:00Z", **changes))
    assert result["exam_rules"]["conflicting_sessions"] == 1
    assert result["exam_rules"]["quarantined_parameter_rows"] == 2
    assert not result["exam_rules"]["groups"]
    assert result["status"] == "limited"


@pytest.mark.parametrize("changes", [
    {"exam_rules_observation_version": True},
    {"exam_origin_pass_points": 75},
    {"exam_origin_question_total": 0},
    {"exam_origin_question_total": True},
    {"exam_origin_duration_seconds": float("nan")},
    {"exam_origin_duration_seconds": 10 ** 400},
    {"exam_origin_navigation": "linear"},
    {"exam_origin_category": "learner@example.com"},
    {"exam_origin_country": []},
    {"exam_origin_profile_basis": "current_country_config"},
    {"_warehouse_import_conflict": True},
])
def test_invalid_exam_metadata_quarantines_only_the_matching_install_session(changes):
    result = report(rule_event(), rule_event("2026-10-03T11:00:00Z", **changes), rule_event(install="usr_other"))
    assert result["exam_rules"]["invalid_observations"] == 1
    assert result["exam_rules"]["observed_parameter_rows"] == 1
    assert result["exam_rules"]["quarantined_sessions"] == 1
    assert "learner@example.com" not in json.dumps(result)


def test_legacy_unknown_profile_and_cache_miss_are_not_replaced_by_a_known_session_origin():
    result = report(
        rule_event(),
        rule_event("2026-10-03T11:00:00Z", exam_origin_profile_revision=None, exam_origin_profile_basis="not_recorded"),
        rule_event("2026-10-03T12:00:00Z", exam_session_rules_revision=None,
                   exam_session_rules_revision_basis="unavailable", exam_session_rules_status="snapshot_not_cached",
                   exam_origin_profile_revision=None, exam_origin_profile_basis="not_recorded"),
        event("exam_session_resumed", "2026-10-03T13:00:00Z", "usr_i",
              exam_session_id="exam-1", exam_rules_revision=PROFILE),
    )
    rules = result["exam_rules"]
    assert rules["origin_profile_unknown_rows"] == 1
    assert rules["unobserved_status_counts"] == {"snapshot_not_cached": 1}
    assert rules["legacy_events"] == 1
    assert rules["conflicting_sessions"] == 0
    assert {group["exam_origin_profile_revision"] for group in rules["groups"]} == {PROFILE, None}


def test_unverified_coverage_keeps_observed_counts_without_clean_rates():
    result = report(content_event(), display_event(), rule_event(), complete=False)
    assert result["status"] == "limited"
    assert result["provenance"]["observed_events"] == 2
    assert result["coverage_complete"] is False
    assert "accuracy" not in result


def test_context_health_cli_and_quality_gate_consume_the_same_content_report(tmp_path):
    raws = [
        content_event(), display_event(),
        rule_event("2026-10-03T10:02:00Z"), rule_event("2026-10-03T11:00:00Z", exam_origin_pass_points=70),
    ]
    warehouse = tmp_path / "warehouse"
    ingest_dump(write_dump(tmp_path / "dump.json", day="2026-10-03",
                           exported_at="2026-10-04T08:00:00Z", events=raws), warehouse)
    window = day_window(date(2026, 10, 3))
    context = build_context(warehouse, window)
    health = build_health([prepared(raw) for raw in raws], window_start=window.start,
                          window_end=window.end, coverage_complete=True)
    assert context.content_observations == health.content_observations
    assert any(item.id == "content_observations_limited" for item in context.qa)
    out = tmp_path / "context.json"
    main(["context", "--day", "2026-10-03", "--warehouse", str(warehouse), "--out", str(out)])
    assert json.loads(out.read_text())["content_observations"] == context.content_observations

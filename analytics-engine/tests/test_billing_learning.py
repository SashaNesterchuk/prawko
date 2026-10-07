import json
from datetime import date, timedelta
from unittest.mock import patch

import pytest

from prawko_analytics.billing_learning import observed_billing_learning, warehouse_billing_learning_report
from prawko_analytics.billing_mapping import (
    FORMAT, billing_mapping_declarations, ingest_billing_mapping, ledger_path, select_billing_mapping,
)
from prawko_analytics.cli import main
from prawko_analytics.context import build_context, range_window
from prawko_analytics.health import build_health
from prawko_analytics.ingest import WARSAW, ingest_dump
from prawko_analytics.revenuecat import financial_report
from tests.support import event, write_dump
from tests.test_acquisition import END, FIRST, START, THROUGH, _row
from tests.test_acquisition_finance import APP, EXPORT, _server, _source

ANCHOR = FIRST + timedelta(minutes=10)
NATIVE = {"application_id": APP, "application_id_basis": "native_application_id"}


def _mapping(tmp_path, warehouse, *, name="billing-mapping", **changes):
    tmp_path.mkdir(parents=True, exist_ok=True)
    body = {
        "format": FORMAT, "declared_at": START.isoformat(),
        "source": {"source_id": "synthetic-billing-operator", "verification_basis": "reviewed_app_scope_mapping",
                   "reviewed_at": START.isoformat()},
        "scope": {
            "application_id": APP, "revenuecat_project_id": "rc-project", "revenuecat_app_id": "rc-app-ios",
            "store": "APP_STORE", "environment": "PRODUCTION", "identity_basis": "shared_installation_app_user_id",
        },
        "validity": {"window_start": START.isoformat(), "window_end": EXPORT.isoformat()},
    }
    for key, value in changes.items():
        body[key] = {**body[key], **value} if isinstance(value, dict) and key in body else value
    path = tmp_path / f"{name}.json"
    path.write_text(json.dumps(body))
    return ingest_billing_mapping(path, warehouse)


def _warehouse(tmp_path, events=None, *, mapping=True, **source_options):
    tmp_path.mkdir(parents=True, exist_ok=True)
    warehouse = tmp_path / "warehouse"
    if mapping:
        _mapping(tmp_path, warehouse)
    _source(tmp_path, warehouse, events if events is not None else [_server()], **source_options)
    return warehouse


def _learn(at=ANCHOR + timedelta(minutes=20), *, user="install-a", **props):
    return _row("training_session_completed", at=at, user=user, **{
        **NATIVE, "training_session_id": f"training-{user}-{at.strftime('%Y%m%dT%H%M%S')}",
        "accepted_unique_question_count": 5, "learning_outcome_rule_version": "learning-v1", **props,
    })


def _answer(at=ANCHOR + timedelta(minutes=1), *, user="install-a", exam=False, **props):
    return _row("exam_question_answered" if exam else "training_question_answered", at=at, user=user, **{
        **NATIVE, "exam_session_id" if exam else "training_session_id": "session-a",
        "answer_id": f"answer-{at.strftime('%Y%m%dT%H%M%S')}", "question_id": "question-a", "is_correct": True,
        **({"answer_revision_id": f"revision-{at.strftime('%Y%m%dT%H%M%S')}", "answer_action": "create"} if exam else {}),
        **props,
    })


def _report(warehouse, rows=None, *, through=THROUGH, covered=True, as_of=None, selection_end=END):
    return observed_billing_learning(
        rows or [], start=START, end=selection_end, observe_through=through,
        financial=financial_report(warehouse, start=START, end=through, as_of=as_of, include_history=True),
        mappings=billing_mapping_declarations(warehouse, as_of=as_of),
        coverage=lambda app, left, right: covered and app == APP,
    )


def _cohort(report, *, kind="paid", start_type=None):
    return next(item for item in report["cohorts"]
                if item["cohort_kind"] == kind and (start_type is None or item["start_type"] == start_type))


def _frame(report, name="d7", *, kind="paid"):
    return _cohort(report, kind=kind)["frames"][name]


def test_paid_cohort_is_source_positive_start_not_plus_price_or_restore(tmp_path):
    warehouse = _warehouse(tmp_path)
    report = _report(warehouse, [
        _row("purchase_access_confirmed", at=FIRST, **NATIVE, price=999999, is_plus=True),
        _learn(),
    ])
    cohort = _cohort(report)
    assert cohort["start_type"] == "direct_paid" and cohort["verified_start_candidates"] == 1
    assert _frame(report)["meaningful_learning_fraction"] == 1
    assert _frame(report, "activation_24h")["median_achieved_seconds"] == 1200
    assert report["grain"] == "revenuecat_scope_original_lineage_start_kind"
    assert "active_paid_access" in report["must_not_claim"]


def test_verified_nonachiever_is_retained_not_conditioned_on_opening_or_learning(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(), _server(user="install-b", event_id="other-paid",
                          transaction_id="tx-b", original_transaction_id="tx-b"),
    ])
    report = _report(warehouse, [_learn()])
    assert _cohort(report)["start_candidates"] == 2
    assert _frame(report)["mature_units"] == 2 and _frame(report)["observed_meaningful_units"] == 1
    assert _frame(report)["meaningful_learning_fraction"] == 0.5
    assert _frame(report)["ttv_not_achieved_as_of"] == 1


def test_verified_empty_activity_is_zero_only_with_both_scope_coverages(tmp_path):
    warehouse = _warehouse(tmp_path)
    assert _frame(_report(warehouse))["meaningful_learning_fraction"] == 0
    assert _frame(_report(warehouse, covered=False))["meaningful_learning_fraction"] is None
    incomplete = tmp_path / "incomplete"
    _mapping(tmp_path, incomplete, name="incomplete")
    _source(tmp_path, incomplete, [_server()], coverage=False, name="partial")
    assert _frame(_report(incomplete))["meaningful_learning_fraction"] is None


def test_open_return_and_short_or_partial_completion_are_not_meaningful_learning(tmp_path):
    report = _report(_warehouse(tmp_path), [
        _row("app_visit_started", at=ANCHOR + timedelta(days=7), **NATIVE),
        _learn(accepted_unique_question_count=4),
        _row("exam_session_completed", at=ANCHOR + timedelta(hours=1), **NATIVE,
             exam_session_id="exam-a", answered_count=1, question_total=25, completion_status="completed",
             learning_outcome_rule_version="learning-v1"),
    ])
    assert _frame(report)["meaningful_learning_fraction"] == 0
    assert _frame(report)["observed_completed_training_sessions"] == 1
    assert _frame(report)["observed_completed_exam_sessions"] == 1


def test_trial_phase_stops_at_expiry_or_earlier_paid_start_without_fixed_trial_days(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0,
                expiration_at_ms=int((ANCHOR + timedelta(days=3)).timestamp() * 1000)),
        _server("RENEWAL", at=ANCHOR + timedelta(days=2), event_id="conversion", transaction_id="paid",
                is_trial_conversion=True),
    ])
    report = _report(warehouse, [_learn(ANCHOR + timedelta(days=2, minutes=1))],
                     selection_end=END + timedelta(days=3))
    assert _cohort(report, kind="paid")["start_type"] == "trial_conversion"
    assert _frame(report, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 0
    assert _frame(report, kind="trial")["meaningful_learning_fraction"] == 1
    assert _frame(report)["meaningful_learning_fraction"] == 1


def test_trial_with_no_expiry_does_not_invent_a_three_day_phase(tmp_path):
    report = _report(_warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0, expiration_at_ms=None),
    ]), [_learn()])
    assert "trial_phase" not in _cohort(report, kind="trial")["frames"]
    assert report["units"][0]["trial_period_status"] == "expiry_not_observed"


def test_trial_cancel_intent_segments_usage_before_cancel_not_access_revocation(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0,
                expiration_at_ms=int((ANCHOR + timedelta(days=3)).timestamp() * 1000)),
        _server("CANCELLATION", at=ANCHOR + timedelta(days=1), event_id="cancel", period_type="TRIAL",
                cancel_reason="UNSUBSCRIBE", price=0, price_in_purchased_currency=0),
    ])
    used = _report(warehouse, [_answer(), _learn(ANCHOR + timedelta(days=2))])
    assert _cohort(used, kind="trial")["trial_cancel_usage"] == {"used": 1}
    assert _frame(used, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 1
    unused = _report(warehouse)
    assert _cohort(unused, kind="trial")["trial_cancel_usage"] == {"unused": 1}
    unknown = _report(warehouse, covered=False)
    assert _cohort(unknown, kind="trial")["trial_cancel_usage"] == {"unknown": 1}
    assert used["units"][0]["trial_cancellations"][0]["does_not_mean"] == "access_revoked_or_subscription_churn"


def test_exam_create_is_one_accepted_answer_and_update_or_timeout_is_not_another(tmp_path):
    create = _answer(exam=True)
    report = _report(_warehouse(tmp_path), [
        create, create,
        _answer(ANCHOR + timedelta(minutes=2), exam=True, answer_id=create.properties["answer_id"],
                answer_action="update", is_correct=False),
        _answer(ANCHOR + timedelta(minutes=3), exam=True, timed_out=True),
    ])
    assert _frame(report)["observed_accepted_answers"] == 1
    assert _frame(report)["accepted_answer_fraction"] == 1


def test_answer_defect_does_not_erase_a_valid_completion_fraction(tmp_path):
    report = _report(_warehouse(tmp_path), [_learn(), _answer(answer_id=None)])
    assert _frame(report)["meaningful_learning_fraction"] == 1
    assert _frame(report)["accepted_answer_fraction"] is None


def test_invalid_completion_restricts_outcome_rate_but_stays_scoped_to_its_horizon(tmp_path):
    report = _report(_warehouse(tmp_path), [
        _learn(), _learn(ANCHOR + timedelta(days=8), accepted_unique_question_count=True),
    ])
    assert _frame(report)["meaningful_learning_fraction"] == 1
    assert _frame(report, "d30")["meaningful_learning_fraction"] is None


def test_half_open_horizon_and_maturity_keep_censored_units(tmp_path):
    warehouse = _warehouse(tmp_path)
    report = _report(warehouse, [_learn(ANCHOR + timedelta(days=7))], through=ANCHOR + timedelta(days=7))
    assert _frame(report)["meaningful_learning_fraction"] == 0
    assert _frame(report, "d30")["censored_units"] == 1
    assert _frame(report, "d30")["meaningful_learning_fraction"] is None


def test_post_activation_calendar_return_is_not_an_open_or_rolling_day(tmp_path):
    activation = ANCHOR + timedelta(minutes=20)
    d7 = activation.astimezone(WARSAW).date() + timedelta(days=7)
    return_at = activation.replace(hour=0, minute=30) + timedelta(days=7)
    assert return_at.astimezone(WARSAW).date() == d7
    report = _report(_warehouse(tmp_path), [_learn(), _learn(return_at)])
    assert _frame(report, "post_activation_calendar_d7")["meaningful_learning_fraction"] == 1
    opened = _report(_warehouse(tmp_path / "opened"), [
        _learn(), _row("app_visit_started", at=return_at, **NATIVE),
    ])
    assert _frame(opened, "post_activation_calendar_d7")["meaningful_learning_fraction"] == 0


@pytest.mark.parametrize("fields", [
    {"aliases": ["install-a", "account-b"]}, {"original_app_user_id": None},
    {"app_user_id": None, "original_app_user_id": None, "aliases": []},
])
def test_ambiguous_original_owner_does_not_join_latest_client_or_account(fields, tmp_path):
    report = _report(_warehouse(tmp_path, [_server(**fields)]), [_learn()])
    assert _cohort(report)["verified_start_candidates"] == 0
    assert _frame(report)["meaningful_learning_fraction"] is None
    assert _frame(report)["observed_meaningful_units"] == 0


def test_transfer_or_provider_conflict_is_not_repaired_by_later_identity(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(), _server("TRANSFER", event_id="transfer", transaction_id=None,
                          transferred_from=["install-a"], transferred_to=["install-b"]),
    ])
    assert _frame(_report(warehouse, [_learn()]))["meaningful_learning_fraction"] is None
    conflicted = _warehouse(tmp_path / "conflicted", [
        _server(), _server(event_id=_server()["event"]["id"], aliases=["account-b"]),
    ])
    assert _frame(_report(conflicted, [_learn()]))["meaningful_learning_fraction"] is None


def test_renewal_without_origin_is_not_reanchored_as_new_paid_start(tmp_path):
    report = _report(_warehouse(tmp_path, [
        _server("RENEWAL", transaction_id="renewal", event_id="renewal"),
    ]), [_learn()])
    assert report["units"] == []
    assert report["excluded"]["lineages_without_observed_origin"] == 1
    assert report["status"] == "limited"


def test_renewal_without_client_capture_does_not_create_a_second_paid_cohort(tmp_path):
    report = _report(_warehouse(tmp_path, [
        _server(), _server("RENEWAL", at=ANCHOR + timedelta(days=2), transaction_id="renewal", event_id="renewal"),
    ]))
    assert _cohort(report)["start_candidates"] == 1


def test_lifetime_nonrecurring_start_is_supported_without_a_subscription_trial(tmp_path):
    report = _report(_warehouse(tmp_path, [
        _server("NON_RENEWING_PURCHASE", period_type=None, original_transaction_id="provider-lineage"),
    ]), [_learn()])
    assert _cohort(report)["start_type"] == "non_recurring_paid"
    assert _frame(report)["meaningful_learning_fraction"] == 1
    assert len(report["cohorts"]) == 1


def test_sandbox_and_family_access_do_not_become_paid_or_trial_starts(tmp_path):
    report = _report(_warehouse(tmp_path, [_server(environment="SANDBOX"), _server(is_family_share=True, event_id="family")]))
    assert report["units"] == []
    assert report["status"] == "no_observed_starts"


def test_missing_scope_and_unverified_sources_do_not_become_complete_zero(tmp_path):
    report = _report(_warehouse(tmp_path, [_server(store=None)]))
    assert report["status"] == "limited"
    assert report["excluded"]["billing_scope_unavailable_start_observations"] == 1
    unverified = _report(_warehouse(tmp_path / "unverified", verified=False), [_learn()])
    assert _frame(unverified)["meaningful_learning_fraction"] is None


def test_native_application_scope_cannot_be_recovered_from_country_language_or_plus(tmp_path):
    warehouse = _warehouse(tmp_path)
    for fields in ({"application_id": None}, {"application_id": "other.bundle"}, {"application_id_basis": "guessed"}):
        report = _report(warehouse, [_learn(**fields)])
        assert _frame(report)["meaningful_learning_fraction"] is None


def test_country_content_segmentation_uses_pre_start_snapshot_not_later_outcome(tmp_path):
    before = _row("profile_action_selected", at=FIRST, **NATIVE, exam_country="CZ", locale="uk", bank_revision="bank-old")
    report = _report(_warehouse(tmp_path), [before, _learn(exam_country="SK", bank_revision="bank-new")])
    cohort = _cohort(report)
    assert cohort["exam_country"] == "CZ" and cohort["locale"] == "uk" and cohort["bank_revision"] == "bank-old"
    assert _frame(report)["meaningful_learning_fraction"] == 1
    unknown = _cohort(_report(_warehouse(tmp_path / "unknown"), [_learn(exam_country="SK")]))
    assert unknown["exam_country"] is None


def test_export_as_of_does_not_use_late_money_or_review(tmp_path):
    warehouse = _warehouse(tmp_path)
    report = _report(warehouse, [_learn()], as_of=THROUGH)
    assert report["units"] == []
    assert report["status"] == "billing_source_unavailable_as_of"


def test_post_activation_return_survives_an_unrelated_late_outcome_defect(tmp_path):
    report = _report(_warehouse(tmp_path), [
        _learn(), _learn(ANCHOR + timedelta(days=8), accepted_unique_question_count=True),
    ])
    assert _frame(report, "d30")["meaningful_learning_fraction"] is None
    assert _frame(report, "post_activation_calendar_d1")["meaningful_learning_fraction"] == 0
    assert _frame(report, "post_activation_calendar_d7")["meaningful_learning_fraction"] == 0


def test_open_answer_and_meaningful_fractions_have_independent_integrity_domains(tmp_path):
    report = _report(_warehouse(tmp_path), [
        _answer(), _row("app_visit_started", at=ANCHOR + timedelta(hours=1), **NATIVE),
        _learn(accepted_unique_question_count=True),
    ])
    frame = _frame(report)
    assert frame["meaningful_learning_fraction"] is None
    assert frame["accepted_answer_fraction"] == 1
    assert frame["observed_open_fraction"] == 1


def test_missing_trial_expiry_is_an_explicit_limited_phase_not_complete_trial_usage(tmp_path):
    report = _report(_warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0, expiration_at_ms=None),
    ]))
    assert report["status"] == "limited"
    assert _cohort(report, kind="trial")["trial_phase_unknown_units"] == 1


def test_verified_trial_expiration_can_bound_phase_before_the_original_contract_date(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0,
                expiration_at_ms=int((ANCHOR + timedelta(days=3)).timestamp() * 1000)),
        _server("EXPIRATION", at=ANCHOR + timedelta(days=1), event_id="expired", period_type="TRIAL"),
    ])
    report = _report(warehouse, [_learn(ANCHOR + timedelta(days=2))])
    assert _frame(report, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 0


def _trial():
    return _server(period_type="TRIAL", price=0, price_in_purchased_currency=0,
                   expiration_at_ms=int((ANCHOR + timedelta(days=3)).timestamp() * 1000))


def _extension(*, day=1, expiry_day=5, event_id="extended", **changes):
    return _server("SUBSCRIPTION_EXTENDED", at=ANCHOR + timedelta(days=day), event_id=event_id,
                   **{"period_type": "TRIAL", "price": 0, "price_in_purchased_currency": 0,
                      "expiration_at_ms": int((ANCHOR + timedelta(days=expiry_day)).timestamp() * 1000), **changes})


def test_continuous_verified_trial_extensions_include_learning_after_initial_expiry(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _trial(), _extension(), _extension(day=4, expiry_day=7, event_id="extended-again"),
        _server("CANCELLATION", at=ANCHOR + timedelta(days=6), event_id="cancel-extended", period_type="TRIAL",
                cancel_reason="UNSUBSCRIBE", price=0, price_in_purchased_currency=0),
    ])
    report = _report(warehouse, [_learn(ANCHOR + timedelta(days=5)), _answer(ANCHOR + timedelta(days=5))])
    phase = _frame(report, "trial_phase", kind="trial")
    assert phase["meaningful_learning_fraction"] == 1
    assert _cohort(report, kind="trial")["trial_cancel_usage"] == {"used": 1}
    period = report["units"][0]["trial_period"]
    assert period["initial_expiry_at"] == (ANCHOR + timedelta(days=3)).isoformat()
    assert len(period["revisions"]) == 2
    assert "current_entitlement" in report["must_not_claim"]


@pytest.mark.parametrize("changes", [
    {"expiration_at_ms": None}, {"expiration_at_ms": int((ANCHOR + timedelta(days=2)).timestamp() * 1000)},
    {"period_type": "NORMAL"}, {"transaction_id": "another-period"}, {"product_id": "another-product"},
])
def test_uncertain_trial_extension_restricts_phase_not_post_start_learning(tmp_path, changes):
    report = _report(_warehouse(tmp_path, [_trial(), _extension(**changes)]), [_learn()])
    assert _frame(report, kind="trial")["meaningful_learning_fraction"] == 1
    assert "trial_phase" not in _cohort(report, kind="trial")["frames"]
    assert report["status"] == "limited"
    assert report["units"][0]["trial_period"]["issues"]


def test_trial_extension_after_declared_expiry_does_not_invent_continuous_access(tmp_path):
    report = _report(_warehouse(tmp_path, [_trial(), _extension(day=4)]), [_learn()])
    assert "trial_phase" not in _cohort(report, kind="trial")["frames"]
    assert report["units"][0]["trial_period"]["issues"] == {"trial_extension_continuity_unproven": 1}


def test_tied_extension_conflicts_are_not_selected_by_provider_id(tmp_path):
    report = _report(_warehouse(tmp_path, [
        _trial(), _extension(), _extension(expiry_day=6, event_id="another-extended"),
    ]))
    assert "trial_phase" not in _cohort(report, kind="trial")["frames"]
    assert "simultaneous_trial_extension_contract_conflict" in report["units"][0]["trial_period"]["issues"]


def test_same_extension_contract_at_same_time_is_one_revision_not_two_periods(tmp_path):
    report = _report(_warehouse(tmp_path, [
        _trial(), _extension(), _extension(event_id="second-provider"),
    ]))
    revisions = report["units"][0]["trial_period"]["revisions"]
    assert len(revisions) == 1
    assert revisions[0]["provider_event_ids"] == ["extended", "second-provider"]


@pytest.mark.parametrize("terminal_kind", ["RENEWAL", "EXPIRATION"])
def test_paid_or_trial_expiration_bounds_an_extended_phase(tmp_path, terminal_kind):
    terminal = _server(terminal_kind, at=ANCHOR + timedelta(days=4), event_id="terminal",
                       **({"transaction_id": "paid", "is_trial_conversion": True}
                          if terminal_kind == "RENEWAL" else {"period_type": "TRIAL"}))
    report = _report(_warehouse(tmp_path, [_trial(), _extension(), terminal]), [
        _learn(ANCHOR + timedelta(days=4, minutes=1)),
    ])
    assert _frame(report, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 0
    assert _frame(report, kind="trial")["meaningful_learning_fraction"] == 1


def test_extension_maturity_and_archive_as_of_do_not_use_later_observations(tmp_path):
    warehouse = _warehouse(tmp_path, [_trial()], exported=THROUGH)
    _source(tmp_path, warehouse, [_extension()], name="later-revision", coverage=False)
    learn = _learn(ANCHOR + timedelta(days=4))
    before = _report(warehouse, [learn], as_of=THROUGH)
    after = _report(warehouse, [learn], as_of=EXPORT)
    assert _frame(before, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 0
    assert _frame(after, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 1
    censored = _report(warehouse, [learn], through=ANCHOR + timedelta(days=4))
    assert _frame(censored, "trial_phase", kind="trial")["censored_units"] == 1
    assert _frame(censored, "trial_phase", kind="trial")["meaningful_learning_fraction"] is None


def test_nontrial_extension_after_conversion_does_not_rewrite_trial_phase(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _trial(),
        _server("RENEWAL", at=ANCHOR + timedelta(days=2), event_id="paid", transaction_id="paid"),
        _extension(day=4, expiry_day=9, transaction_id="paid", period_type="NORMAL"),
    ])
    report = _report(warehouse, [_learn(ANCHOR + timedelta(days=3))])
    assert _frame(report, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 0
    assert report["units"][0]["trial_period"]["revisions"] == []


def test_later_other_period_expiration_does_not_erase_a_clean_closed_trial(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _trial(),
        _server("RENEWAL", at=ANCHOR + timedelta(days=2), event_id="paid", transaction_id="paid"),
        _server("EXPIRATION", at=ANCHOR + timedelta(days=5), event_id="later-expired",
                transaction_id="paid", period_type="TRIAL"),
    ])
    report = _report(warehouse, [_learn()])
    assert _frame(report, "trial_phase", kind="trial")["meaningful_learning_fraction"] == 1


def test_tied_expiration_contracts_are_not_resolved_by_provider_id_order(tmp_path):
    at = ANCHOR + timedelta(days=1)
    warehouse = _warehouse(tmp_path, [
        _trial(),
        _server("EXPIRATION", at=at, event_id="a-expired", period_type="TRIAL"),
        _server("EXPIRATION", at=at, event_id="z-other-period", period_type="TRIAL", transaction_id="wrong-period"),
    ])
    report = _report(warehouse, [_learn()])
    assert "trial_phase" not in _cohort(report, kind="trial")["frames"]
    assert "trial_expiration_contract_disagrees" in report["units"][0]["trial_period"]["issues"]


def test_extension_without_an_observed_origin_product_is_not_an_exact_period_binding(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0, product_id=None,
                expiration_at_ms=int((ANCHOR + timedelta(days=3)).timestamp() * 1000)),
        _extension(product_id=None),
    ])
    report = _report(warehouse, [_learn()])
    assert _frame(report, kind="trial")["meaningful_learning_fraction"] == 1
    assert "trial_phase" not in _cohort(report, kind="trial")["frames"]


def test_cancel_with_unknown_phase_is_retained_as_unknown_usage(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0, expiration_at_ms=None),
        _server("CANCELLATION", at=ANCHOR + timedelta(days=1), event_id="cancel", period_type="TRIAL",
                cancel_reason="UNSUBSCRIBE", price=0, price_in_purchased_currency=0),
    ])
    report = _report(warehouse, [_answer()])
    assert _cohort(report, kind="trial")["trial_cancel_usage"] == {"unknown": 1}


def test_cancel_answer_at_or_after_intent_is_not_previous_usage(tmp_path):
    at = ANCHOR + timedelta(days=1)
    warehouse = _warehouse(tmp_path, [
        _trial(), _server("CANCELLATION", at=at, event_id="cancel", period_type="TRIAL",
                         cancel_reason="UNSUBSCRIBE", price=0, price_in_purchased_currency=0),
    ])
    report = _report(warehouse, [_answer(at), _answer(at + timedelta(minutes=1))])
    assert _cohort(report, kind="trial")["trial_cancel_usage"] == {"unused": 1}
    assert _frame(report, "trial_phase", kind="trial")["observed_accepted_answers"] == 2


def test_unknown_paid_boundary_only_restricts_trial_phase_and_cancel_usage(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _trial(),
        _server("RENEWAL", at=ANCHOR + timedelta(days=1), event_id="missing-paid-amount",
                transaction_id="paid", price_in_purchased_currency=None),
        _server("CANCELLATION", at=ANCHOR + timedelta(days=2), event_id="cancel", period_type="TRIAL",
                cancel_reason="UNSUBSCRIBE", price=0, price_in_purchased_currency=0),
    ])
    report = _report(warehouse, [_learn(), _answer()])
    assert _frame(report, kind="trial")["meaningful_learning_fraction"] == 1
    assert _frame(report, "trial_phase", kind="trial")["meaningful_learning_fraction"] is None
    assert _cohort(report, kind="trial")["trial_cancel_usage"] == {"unknown": 1}


def test_first_paid_without_conversion_flag_is_not_claimed_as_verified_trial_conversion(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0),
        _server("RENEWAL", at=ANCHOR + timedelta(hours=1), event_id="first-paid", transaction_id="first-paid",
                is_trial_conversion=None),
    ])
    assert _cohort(_report(warehouse))["start_type"] == "first_observed_paid_after_trial"


def test_play_store_binding_is_explicit_and_does_not_require_asa_or_apple_ad_ids(tmp_path):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse, scope={"store": "PLAY_STORE"})
    _source(tmp_path, warehouse, [_server(store="PLAY_STORE")])
    report = _report(warehouse, [_learn(platform="android")])
    assert _cohort(report)["store"] == "PLAY_STORE"
    assert _frame(report)["meaningful_learning_fraction"] == 1


def test_other_project_or_app_with_a_different_identity_does_not_suppress_clean_cohort(tmp_path):
    warehouse = _warehouse(tmp_path)
    _source(tmp_path, warehouse, [_server(user="install-b", app_id="other-app", event_id="other-paid",
                                        transaction_id="other-tx", original_transaction_id="other-tx")],
            app="other-app", name="other-app", coverage=False)
    report = _report(warehouse, [_learn(), _learn(user="install-b", application_id="other.bundle")])
    clean = next(row for row in report["cohorts"] if row["revenuecat_app_id"] == "rc-app-ios")
    assert clean["frames"]["d7"]["meaningful_learning_fraction"] == 1


def test_reused_store_transaction_in_another_app_is_not_a_clean_independent_source(tmp_path):
    warehouse = _warehouse(tmp_path)
    _source(tmp_path, warehouse, [_server(user="install-b", app_id="other-app", event_id="other-paid")],
            app="other-app", name="other-app", coverage=False)
    report = _report(warehouse, [_learn()])
    clean = next(row for row in report["cohorts"] if row["revenuecat_app_id"] == "rc-app-ios")
    assert clean["frames"]["d7"]["meaningful_learning_fraction"] is None
    assert "quarantined_transaction_observation" in clean["frames"]["d7"]["issues"]


def test_cancel_usage_has_provider_grain_and_independent_answer_integrity(tmp_path):
    cancel = _server("CANCELLATION", at=ANCHOR + timedelta(days=1), event_id="cancel-one", period_type="TRIAL",
                     cancel_reason="UNSUBSCRIBE", price=0, price_in_purchased_currency=0)
    warehouse = _warehouse(tmp_path, [
        _server(period_type="TRIAL", price=0, price_in_purchased_currency=0,
                expiration_at_ms=int((ANCHOR + timedelta(days=3)).timestamp() * 1000)),
        cancel, cancel,
        _server("CANCELLATION", at=ANCHOR + timedelta(days=2), event_id="cancel-two", period_type="TRIAL",
                cancel_reason="UNSUBSCRIBE", price=0, price_in_purchased_currency=0),
    ])
    report = _report(warehouse, [_answer(), _learn(accepted_unique_question_count=True)])
    cohort = _cohort(report, kind="trial")
    assert cohort["trial_cancel_usage"] == {"used": 2}
    assert cohort["trial_cancel_observed_units"] == 1
    cancellations = report["units"][0]["trial_cancellations"]
    assert [item["provider_event_id"] for item in cancellations] == ["cancel-one", "cancel-two"]
    assert all(item["measurement"]["issues"] for item in cancellations)


def test_no_original_transaction_binding_is_explicitly_unknown_not_no_paid_activity(tmp_path):
    report = _report(_warehouse(tmp_path, [_server(original_transaction_id=None)]), [_learn()])
    assert report["status"] == "limited"
    assert report["excluded"]["billing_start_lineage_missing"] == 1


def test_conflicting_refund_amounts_do_not_erase_a_known_paid_start_or_learning(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(),
        _server("CANCELLATION", at=ANCHOR + timedelta(days=8), event_id="refund-one",
                cancel_reason="CUSTOMER_SUPPORT", price="-5", price_in_purchased_currency="-19.99"),
        _server("CANCELLATION", at=ANCHOR + timedelta(days=8, minutes=1), event_id="refund-two",
                cancel_reason="CUSTOMER_SUPPORT", price="-5", price_in_purchased_currency="-29.99"),
    ])
    report = _report(warehouse, [_learn()])
    assert _cohort(report)["verified_start_candidates"] == 1
    assert _frame(report)["meaningful_learning_fraction"] == 1
    assert _frame(report, "d30")["meaningful_learning_fraction"] == 1


def test_zero_nontrial_origin_followed_by_a_renewal_is_not_fabricated_direct_paid(tmp_path):
    warehouse = _warehouse(tmp_path, [
        _server(price=0, price_in_purchased_currency=0, period_type="INTRO"),
        _server("RENEWAL", at=ANCHOR + timedelta(hours=1), transaction_id="first-positive", event_id="first-positive"),
    ])
    assert _cohort(_report(warehouse))["start_type"] == "first_observed_paid"


@pytest.mark.parametrize("changes", [
    {"source": {"verification_basis": "unreviewed_mapping"}},
    {"validity": {"window_end": (ANCHOR + timedelta(days=6)).isoformat()}},
])
def test_review_and_full_observed_horizon_validity_are_required(tmp_path, changes):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse, **changes)
    _source(tmp_path, warehouse, [_server()])
    assert _frame(_report(warehouse, [_learn()]))["meaningful_learning_fraction"] is None


def test_mapping_declaration_as_of_is_independent_of_archive_export_cut(tmp_path):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse, declared_at=EXPORT.isoformat(), source={"reviewed_at": EXPORT.isoformat()})
    _source(tmp_path, warehouse, [_server()], exported=THROUGH)
    assert _report(warehouse, [_learn()], as_of=THROUGH)["status"] == "mapping_not_loaded"
    assert _frame(_report(warehouse, [_learn()], as_of=EXPORT))["meaningful_learning_fraction"] == 1


def test_same_native_store_mapping_to_two_rc_apps_is_not_selected_by_latest_review(tmp_path):
    warehouse = _warehouse(tmp_path)
    _mapping(tmp_path, warehouse, name="other-rc", scope={"revenuecat_app_id": "other-app"})
    assert _frame(_report(warehouse, [_learn()]))["meaningful_learning_fraction"] is None


@pytest.mark.parametrize("application_ids", [[], ["wrong.app"], [True], ["learner@example.com"]])
def test_missing_or_invalid_application_coverage_does_not_establish_empty_learning(tmp_path, application_ids):
    warehouse = _warehouse(tmp_path)
    _client_days(tmp_path, warehouse, [], application_ids=application_ids)
    report = warehouse_billing_learning_report(warehouse, start=START, end=END, observe_through=THROUGH)
    assert _frame(report)["meaningful_learning_fraction"] is None


@pytest.mark.parametrize("changes", [
    {"scope": {"application_id": "learner@example.com"}}, {"scope": {"store": "UNKNOWN"}},
    {"scope": {"environment": "SANDBOX"}}, {"scope": {"identity_basis": "account_alias"}},
    {"source": {"reviewed_at": EXPORT.isoformat()}}, {"declared_at": "2026-09-01"},
    {"validity": {"window_end": START.isoformat()}},
])
def test_invalid_mapping_is_not_written(tmp_path, changes):
    with pytest.raises(ValueError):
        _mapping(tmp_path, tmp_path / "warehouse", **changes)
    assert not ledger_path(tmp_path / "warehouse").exists()


def test_mapping_idempotence_conflicts_full_validity_and_failed_atomic_write(tmp_path):
    warehouse = tmp_path / "warehouse"
    _mapping(tmp_path, warehouse)
    assert _mapping(tmp_path, warehouse)["duplicate_declarations"] == 1
    before = ledger_path(warehouse).read_bytes()
    with patch("pathlib.Path.replace", side_effect=OSError("write failure")):
        with pytest.raises(OSError):
            _mapping(tmp_path, warehouse, name="failure", scope={"application_id": "other.app"})
    assert ledger_path(warehouse).read_bytes() == before
    _mapping(tmp_path, warehouse, name="conflict", scope={"application_id": "other.app"})
    _, status = select_billing_mapping(billing_mapping_declarations(warehouse), project_id="rc-project",
                                      app_id="rc-app-ios", store="APP_STORE", start=ANCHOR, end=THROUGH)
    assert status == "conflicting_billing_app_scope_mapping"


def _client_days(tmp_path, warehouse, rows, *, application_ids=None):
    for offset in range(33):
        day = date(2026, 9, 1) + timedelta(days=offset)
        path = write_dump(tmp_path / f"client-{day}.json", day=day.isoformat(), exported_at=EXPORT.isoformat(),
                          events=[item for item in rows if moment_string(item["timestamp"]).astimezone(WARSAW).date() == day])
        body = json.loads(path.read_text())
        if application_ids is not None:
            body["coverage"]["application_ids"] = application_ids
        path.write_text(json.dumps(body))
        ingest_dump(path, warehouse)


def moment_string(value):
    from datetime import datetime
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def test_warehouse_requires_explicit_application_coverage_even_for_verified_empty_days(tmp_path):
    warehouse = _warehouse(tmp_path)
    raw = event("training_session_completed", (ANCHOR + timedelta(minutes=20)).isoformat(), "install-a", **{
        **NATIVE, "training_session_id": "training-a", "accepted_unique_question_count": 5,
        "learning_outcome_rule_version": "learning-v1",
    })
    _client_days(tmp_path, warehouse, [raw])
    report = warehouse_billing_learning_report(warehouse, start=START, end=END, observe_through=THROUGH)
    assert _frame(report)["observed_meaningful_units"] == 1
    assert _frame(report)["meaningful_learning_fraction"] is None
    _client_days(tmp_path, warehouse, [raw], application_ids=[APP])
    report = warehouse_billing_learning_report(warehouse, start=START, end=END, observe_through=THROUGH)
    assert _frame(report)["meaningful_learning_fraction"] == 1


@pytest.mark.parametrize("source", [
    True, "bad-coverage", [APP], {},
    {"application_ids": [APP]},
    {"application_ids": [APP], "pagination_complete": True, "truncated": False,
     "window_start": "bad-time", "window_end": THROUGH.isoformat(), "delivery_watermark": EXPORT.isoformat()},
])
def test_malformed_retained_coverage_restricts_rates_without_crashing(tmp_path, source):
    warehouse = _warehouse(tmp_path)
    _client_days(tmp_path, warehouse, [], application_ids=[APP])
    path = warehouse / "events" / "day=2026-09-01" / "partition.json"
    metadata = json.loads(path.read_text())
    metadata["coverage"] = source
    path.write_text(json.dumps(metadata))
    report = warehouse_billing_learning_report(warehouse, start=START, end=END, observe_through=THROUGH)
    assert _frame(report)["meaningful_learning_fraction"] is None
    assert "client_or_billing_scope_coverage_unverified" in _frame(report)["issues"]


def test_cli_context_health_and_serialization_retain_source_gates(tmp_path, capsys):
    warehouse = _warehouse(tmp_path)
    _client_days(tmp_path, warehouse, [], application_ids=[APP])
    main(["ingest-billing-mapping", str(tmp_path / "billing-mapping.json"), "--warehouse", str(warehouse)])
    assert json.loads(capsys.readouterr().out)["duplicate_declarations"] == 1
    main(["billing-learning", "--start", "2026-09-01", "--end", "2026-09-02",
          "--observe-through", THROUGH.isoformat(), "--warehouse", str(warehouse)])
    report = json.loads(capsys.readouterr().out)
    assert _frame(report)["meaningful_learning_fraction"] == 0
    context = build_context(warehouse, range_window("billing", date(2026, 9, 1), date(2026, 9, 2)))
    assert _frame(context.billing_learning)["censored_units"] == 1
    assert context.model_validate_json(context.model_dump_json()).billing_learning == context.billing_learning
    health = build_health([], window_start=START, window_end=END, billing_learning=report)
    assert health.monetization["billing_learning"] == report
    assert health.monetization["financial"] is None

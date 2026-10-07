from prawko_analytics.contract import load_contract
from prawko_analytics.interpret import select_interpretation


def _gate():
    return load_contract().events["premium_gate_viewed"].interpretations


def test_inline_lock_is_not_purchase_intent():
    interpretation, status = select_interpretation(
        _gate(),
        schema=3,
        app_version="1.0.29",
        properties={"presentation": "inline_lock"},
    )
    assert status == "matched"
    assert interpretation is not None
    assert interpretation.id == "inline_lock_after_answer"
    assert "purchase_intent" in interpretation.must_not_be_interpreted_as
    assert interpretation.intent_signal is False


def test_schema_3_gate_without_presentation_is_a_visible_limit():
    interpretation, status = select_interpretation(
        _gate(),
        schema=3,
        app_version="1.0.29",
        properties={},
    )
    assert status == "matched"
    assert interpretation is not None
    assert interpretation.id == "limit_or_entry_visible"


def test_missing_schema_does_not_inherit_schema_3_meaning():
    interpretation, status = select_interpretation(
        _gate(),
        schema=None,
        app_version="1.0.28",
        properties={"presentation": "inline_lock"},
    )
    assert status == "matched"
    assert interpretation is not None
    assert interpretation.id == "legacy_unscoped_gate"


def test_restart_gate_is_not_a_daily_cap():
    contract = load_contract()
    interpretation, status = select_interpretation(
        contract.events["exam_restart_gate_shown"].interpretations,
        schema=None,
        app_version="1.0.25",
        properties={"source": "exam_result"},
    )
    assert status == "matched"
    assert interpretation is not None
    assert "daily_exam_cap" in interpretation.must_not_be_interpreted_as


def test_disabled_ads_are_not_a_failure():
    contract = load_contract()
    interpretation, status = select_interpretation(
        contract.events["ad_skipped"].interpretations,
        schema=3,
        app_version="1.0.29",
        properties={"should_show": "no", "why": "disabled"},
    )
    assert status == "matched"
    assert interpretation is not None
    assert interpretation.id == "policy_disabled"
    assert "broken_ads" in interpretation.must_not_be_interpreted_as

from prawko_analytics.eligibility import decide_eligibility


CEILINGS = {
    "deterministic_fact": "high",
    "descriptive_metric": "high",
    "association": "medium",
    "causal_hypothesis": "low",
}


def test_small_denominator_is_prohibited():
    decision = decide_eligibility(
        evidence_class="descriptive_metric",
        ceilings=CEILINGS,
        numerator=0,
        denominator=6,
        min_denominator=30,
        maturity_met=True,
        identity_blocks_user_metric=False,
        ambiguous=False,
        concentration_warning=True,
    )
    assert decision.status == "prohibited"
    assert decision.confidence_ceiling is None
    assert decision.reasons[0].rule == "min_denominator"
    assert decision.reasons[0].actual == 6
    assert decision.reasons[0].required == 30


def test_immature_cohort_does_not_also_blame_sample_size():
    decision = decide_eligibility(
        evidence_class="descriptive_metric",
        ceilings=CEILINGS,
        numerator=0,
        denominator=0,
        min_denominator=30,
        maturity_met=False,
        identity_blocks_user_metric=False,
        ambiguous=False,
        concentration_warning=False,
    )
    assert [reason.rule for reason in decision.reasons] == ["cohort_not_mature"]


def test_concentration_can_only_lower_an_allowed_metric():
    decision = decide_eligibility(
        evidence_class="descriptive_metric",
        ceilings=CEILINGS,
        numerator=10,
        denominator=40,
        min_denominator=30,
        maturity_met=True,
        identity_blocks_user_metric=False,
        ambiguous=False,
        concentration_warning=True,
    )
    assert decision.status == "limited"
    assert decision.confidence_ceiling == "medium"


def test_causal_ceiling_stays_low():
    decision = decide_eligibility(
        evidence_class="causal_hypothesis",
        ceilings=CEILINGS,
        numerator=80,
        denominator=100,
        min_denominator=30,
        maturity_met=True,
        identity_blocks_user_metric=False,
        ambiguous=False,
        concentration_warning=False,
    )
    assert decision.confidence_ceiling == "low"

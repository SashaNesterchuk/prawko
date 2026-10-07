"""Eligibility and confidence ceilings. The model may not raise a ceiling."""

from __future__ import annotations

from dataclasses import dataclass


CEILING_ORDER = ("low", "medium", "high")


@dataclass(frozen=True)
class Reason:
    rule: str
    actual: int | None = None
    required: int | None = None
    detail: str | None = None


@dataclass(frozen=True)
class EligibilityDecision:
    status: str
    reasons: tuple[Reason, ...]
    confidence_ceiling: str | None


def drop_ceiling(ceiling: str | None) -> str | None:
    if ceiling is None:
        return None
    index = CEILING_ORDER.index(ceiling)
    return CEILING_ORDER[max(0, index - 1)]


def decide_eligibility(
    *,
    evidence_class: str,
    ceilings: dict[str, str],
    numerator: int,
    denominator: int,
    min_denominator: int,
    maturity_met: bool,
    identity_blocks_user_metric: bool,
    ambiguous: bool,
    concentration_warning: bool,
) -> EligibilityDecision:
    reasons: list[Reason] = []
    if ambiguous:
        reasons.append(Reason("ambiguous_interpretation"))
    if identity_blocks_user_metric:
        reasons.append(Reason("identity_degraded"))
    if not maturity_met:
        reasons.append(Reason("cohort_not_mature"))
    elif denominator < min_denominator:
        reasons.append(Reason("min_denominator", actual=denominator, required=min_denominator))

    if reasons:
        return EligibilityDecision("prohibited", tuple(reasons), None)

    status = "allowed"
    ceiling = ceilings[evidence_class]
    if evidence_class == "causal_hypothesis":
        ceiling = "low"
    if concentration_warning and evidence_class in {"descriptive_metric", "association"}:
        status = "limited"
        ceiling = drop_ceiling(ceiling)
        reasons.append(Reason("event_concentration"))
    return EligibilityDecision(status, tuple(reasons), ceiling)

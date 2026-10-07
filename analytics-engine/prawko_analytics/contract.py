"""Load and validate the interpretation contract."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import yaml

from prawko_analytics.paths import CONTRACT_PATH, REPO_ROOT
from prawko_analytics.paywall_contract import ELIGIBILITY_EVENTS


class ContractError(ValueError):
    pass


@dataclass(frozen=True)
class Interpretation:
    id: str
    since_schema: int | None
    until_schema: int | None
    since_app_version: str | None
    until_app_version: str | None
    when_properties: dict
    meaning: str
    intent_signal: bool
    must_not_be_interpreted_as: tuple[str, ...]
    zero_events_mean: str
    funnel_role: str

    @property
    def tightness(self) -> int:
        bounds = (
            self.since_schema,
            self.until_schema,
            self.since_app_version,
            self.until_app_version,
        )
        return sum(bound is not None for bound in bounds)


@dataclass(frozen=True)
class EventContract:
    interpretations: tuple[Interpretation, ...]


@dataclass(frozen=True)
class FunnelStep:
    event: str
    when_properties: dict
    join: str | None


@dataclass(frozen=True)
class Funnel:
    id: str
    grain: str
    slice_by: tuple[str, ...]
    steps: tuple[FunnelStep, ...]
    never_required_steps: tuple[str, ...]
    conversion_window_seconds: int = 86400


@dataclass(frozen=True)
class MetricDef:
    id: str
    evidence_class: str
    funnel: str | None
    grain: str | None
    numerator_event: str | None
    numerator_where: dict
    denominator_event: str | None
    cohort_event: str | None
    count: str
    homogeneity: tuple[str, ...]
    min_denominator: int
    maturity_days: int | None
    definition: str | None
    conversion_window_seconds: int | None = None
    cohort_timestamp_property: str | None = None
    return_rule: str | None = None


@dataclass(frozen=True)
class ErrorSignature:
    id: str
    event: str
    match: dict
    evidence_class: str


@dataclass(frozen=True)
class Change:
    id: str
    at: date
    affects_metrics: tuple[str, ...]


@dataclass(frozen=True)
class Contract:
    version: int
    timezone: str
    primary_analysis_key: str
    fallback_analysis_key: str
    never_analysis_key: tuple[str, ...]
    unusable_missing_primary_share: float
    recommendations_enabled: bool
    causal_hypotheses_enabled: bool
    mix_shift_pp: float
    confounders: tuple[str, ...]
    acquisition_mix: str
    concentration_top_n: int
    concentration_warning_share: float
    confidence_ceilings: dict[str, str]
    sdk_events: frozenset[str]
    changes: tuple[Change, ...]
    events: dict[str, EventContract]
    funnels: dict[str, Funnel]
    metrics: tuple[MetricDef, ...]
    error_signatures: tuple[ErrorSignature, ...]
    catalog_keys: frozenset[str] = field(default_factory=frozenset)

    def is_product_event(self, event: str) -> bool:
        return event not in self.sdk_events and event != "$set" and event not in ELIGIBILITY_EVENTS


def catalog_event_keys(catalog_path: Path) -> set[str]:
    text = catalog_path.read_text()
    start = text.index("export const ANALYTICS_EVENTS")
    end = text.index("export const ANALYTICS_SCREENS")
    return set(re.findall(r'key:\s*"([^"]+)"', text[start:end]))


def load_contract(path: Path | None = None, repo_root: Path | None = None) -> Contract:
    contract_path = path or CONTRACT_PATH
    root = repo_root or REPO_ROOT
    raw = yaml.safe_load(contract_path.read_text())
    catalog_ref = raw["catalog_ref"]
    catalog_path = root / catalog_ref
    if not catalog_path.is_file():
        raise ContractError(f"Catalog not found: {catalog_path}")
    keys = catalog_event_keys(catalog_path)
    contract = _parse(raw, keys)
    _validate(contract)
    return contract


def _parse(raw: dict, catalog_keys: set[str]) -> Contract:
    identity = raw["identity"]
    lead = raw["lead"]
    comparison = raw["comparison"]
    concentration = raw["concentration"]
    events: dict[str, EventContract] = {}
    for event_name, body in raw["events"].items():
        interpretations = tuple(
            _interpretation(event_name, item) for item in body["interpretations"]
        )
        events[event_name] = EventContract(interpretations)
    funnels = {item["id"]: _funnel(item) for item in raw["funnels"]}
    metrics = tuple(_metric(item) for item in raw["metrics"])
    signatures = tuple(
        ErrorSignature(
            id=item["id"],
            event=item["event"],
            match=dict(item["match"]),
            evidence_class=item["evidence_class"],
        )
        for item in raw["error_signatures"]
    )
    changes = tuple(
        Change(
            id=item["id"],
            at=item["at"] if isinstance(item["at"], date) else date.fromisoformat(str(item["at"])),
            affects_metrics=tuple(item["affects_metrics"]),
        )
        for item in raw.get("changes") or []
    )
    return Contract(
        version=int(raw["contract_version"]),
        timezone=raw["time"]["product_timezone"],
        primary_analysis_key=identity["primary_analysis_key"],
        fallback_analysis_key=identity["fallback_analysis_key"],
        never_analysis_key=tuple(identity["never_analysis_key"]),
        unusable_missing_primary_share=float(identity["unusable_missing_primary_share"]),
        recommendations_enabled=bool(lead["recommendations_enabled"]),
        causal_hypotheses_enabled=bool(lead["causal_hypotheses_enabled"]),
        mix_shift_pp=float(comparison["mix_shift_pp"]),
        confounders=tuple(comparison["confounders"]),
        acquisition_mix=comparison["acquisition_mix"],
        concentration_top_n=int(concentration["top_n"]),
        concentration_warning_share=float(concentration["warning_event_share"]),
        confidence_ceilings=dict(raw["confidence_ceilings"]),
        sdk_events=frozenset(raw["sdk_events"]),
        changes=changes,
        events=events,
        funnels=funnels,
        metrics=metrics,
        error_signatures=signatures,
        catalog_keys=frozenset(catalog_keys),
    )


def _interpretation(event_name: str, item: dict) -> Interpretation:
    required = ("id", "meaning", "intent_signal", "zero_events_mean", "funnel_role")
    missing = [key for key in required if key not in item]
    if missing:
        raise ContractError(f"{event_name} interpretation missing {missing}")
    return Interpretation(
        id=item["id"],
        since_schema=item.get("since_schema"),
        until_schema=item.get("until_schema"),
        since_app_version=item.get("since_app_version"),
        until_app_version=item.get("until_app_version"),
        when_properties=dict(item.get("when_properties") or {}),
        meaning=item["meaning"],
        intent_signal=bool(item["intent_signal"]),
        must_not_be_interpreted_as=tuple(item.get("must_not_be_interpreted_as") or ()),
        zero_events_mean=item["zero_events_mean"],
        funnel_role=item["funnel_role"],
    )


def _funnel(item: dict) -> Funnel:
    steps = tuple(
        FunnelStep(
            event=step["event"],
            when_properties=dict(step.get("when_properties") or {}),
            join=step.get("join"),
        )
        for step in item["steps"]
    )
    return Funnel(
        id=item["id"],
        grain=item["grain"],
        slice_by=tuple(item["slice_by"]),
        steps=steps,
        never_required_steps=tuple(item.get("never_required_steps") or ()),
        conversion_window_seconds=int(item.get("conversion_window_seconds", 86400)),
    )


def _metric(item: dict) -> MetricDef:
    eligibility = item["eligibility"]
    maturity = eligibility.get("maturity") or item.get("maturity")
    maturity_days = None if not maturity else int(maturity["n"])
    return MetricDef(
        id=item["id"],
        evidence_class=item["evidence_class"],
        funnel=item.get("funnel"),
        grain=item.get("grain"),
        numerator_event=item.get("numerator_event"),
        numerator_where=dict(item.get("numerator_where") or {}),
        denominator_event=item.get("denominator_event"),
        cohort_event=item.get("cohort_event"),
        count=item.get("count", "analysis_keys"),
        homogeneity=tuple(item.get("homogeneity") or ()),
        min_denominator=int(eligibility["min_denominator"]),
        maturity_days=maturity_days,
        definition=item.get("definition"),
        conversion_window_seconds=item.get("conversion_window_seconds"),
        cohort_timestamp_property=item.get("cohort_timestamp_property"),
        return_rule=item.get("return_rule"),
    )


def _validate(contract: Contract) -> None:
    known = set(contract.catalog_keys) | set(contract.sdk_events)
    for event_name, body in contract.events.items():
        if event_name not in known:
            raise ContractError(f"{event_name} is not in the catalog or sdk_events")
        ids = [item.id for item in body.interpretations]
        if len(ids) != len(set(ids)):
            raise ContractError(f"{event_name} has duplicate interpretation ids")
        _reject_tied_overlaps(event_name, body.interpretations)
        for item in body.interpretations:
            if item.zero_events_mean not in {"not_observed", "feature_not_in_current_ui", "unknown"}:
                raise ContractError(f"{event_name}.{item.id} has unknown zero_events_mean")
            if item.funnel_role not in {"never_required", "optional", "required_when_in_scope"}:
                raise ContractError(f"{event_name}.{item.id} has unknown funnel_role")
    for funnel in contract.funnels.values():
        if funnel.conversion_window_seconds <= 0:
            raise ContractError(f"Funnel {funnel.id} must have a positive conversion window")
        for step in funnel.steps:
            if step.event not in known:
                raise ContractError(f"Funnel {funnel.id} step {step.event} is not a known event")
            if step.event in funnel.never_required_steps:
                raise ContractError(f"Funnel {funnel.id} requires inactive step {step.event}")
            body = contract.events.get(step.event)
            if body and body.interpretations and all(
                item.funnel_role == "never_required" for item in body.interpretations
            ):
                raise ContractError(f"Funnel {funnel.id} uses never-required event {step.event}")
        for inactive in funnel.never_required_steps:
            if inactive not in known:
                raise ContractError(f"Funnel {funnel.id} names unknown inactive step {inactive}")
    metric_ids = {metric.id for metric in contract.metrics}
    for metric in contract.metrics:
        if metric.return_rule not in {None, "learning-v1"}:
            raise ContractError(f"Metric {metric.id} has an unsupported return rule")
        if metric.cohort_timestamp_property not in {None, "first_observed_at"}:
            raise ContractError(f"Metric {metric.id} has an unsupported cohort anchor")
        if metric.maturity_days is not None and metric.maturity_days <= 0:
            raise ContractError(f"Metric {metric.id} must have positive cohort maturity")
        if metric.conversion_window_seconds is not None and metric.conversion_window_seconds <= 0:
            raise ContractError(f"Metric {metric.id} must have a positive conversion window")
        if metric.funnel and metric.funnel not in contract.funnels:
            raise ContractError(f"Metric {metric.id} references unknown funnel {metric.funnel}")
        if metric.evidence_class not in contract.confidence_ceilings:
            raise ContractError(f"Metric {metric.id} has unknown evidence class")
    for change in contract.changes:
        unknown = set(change.affects_metrics) - metric_ids
        if unknown:
            raise ContractError(f"Change {change.id} affects unknown metrics {sorted(unknown)}")
    for signature in contract.error_signatures:
        if signature.event not in known:
            raise ContractError(f"Signature {signature.id} uses unknown event {signature.event}")
        if signature.evidence_class not in contract.confidence_ceilings:
            raise ContractError(f"Signature {signature.id} has unknown evidence class")


def _reject_tied_overlaps(event_name: str, interpretations: tuple[Interpretation, ...]) -> None:
    for left_index, left in enumerate(interpretations):
        for right in interpretations[left_index + 1 :]:
            if left.when_properties != right.when_properties:
                continue
            if left.tightness != right.tightness:
                continue
            if _ranges_overlap(
                left.since_schema, left.until_schema, right.since_schema, right.until_schema
            ) and _ranges_overlap(
                _version_bound(left.since_app_version),
                _version_bound(left.until_app_version),
                _version_bound(right.since_app_version),
                _version_bound(right.until_app_version),
            ):
                raise ContractError(
                    f"{event_name} interpretations {left.id} and {right.id} overlap with equal specificity"
                )


def _version_bound(value: str | None) -> tuple[int, ...] | None:
    if value is None:
        return None
    return tuple(int(part) for part in value.split("."))


def _ranges_overlap(left_since, left_until, right_since, right_until) -> bool:
    """Half-open bounds. None means unbounded. Unbounded overlaps every range."""
    if left_since is None and left_until is None:
        return True
    if right_since is None and right_until is None:
        return True
    left_start = left_since
    right_start = right_since
    if left_start is not None and right_until is not None and left_start >= right_until:
        return False
    if right_start is not None and left_until is not None and right_start >= left_until:
        return False
    return True

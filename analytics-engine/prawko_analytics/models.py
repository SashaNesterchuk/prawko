"""JSON shape of a validated analysis context."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class WindowModel(BaseModel):
    kind: str
    start: datetime
    end: datetime
    complete: bool
    label: str


class DatasetModel(BaseModel):
    dump_ids: list[str]
    timezone: str
    window: WindowModel
    event_rows: int
    analysis_keys: int


class IdentityModel(BaseModel):
    primary_analysis_key: str
    quality: str
    fallback_rows: int
    unresolved_rows: int
    issues: list[str]


class VersionCount(BaseModel):
    version: str | None
    event_rows: int
    analysis_keys: int


class SchemaVersionCount(BaseModel):
    version: int | None
    event_rows: int
    analysis_keys: int


class VersionsModel(BaseModel):
    app_versions: list[VersionCount]
    analytics_schema_versions: list[SchemaVersionCount]
    analysis_keys_are_partition: bool


class ReportPolicy(BaseModel):
    status: str
    recommendations_enabled: bool
    causal_hypotheses_enabled: bool
    fatal_ids: list[str]


class ReasonModel(BaseModel):
    rule: str
    actual: int | None = None
    required: int | None = None
    detail: str | None = None


class QaItem(BaseModel):
    id: str
    severity: str
    effect: str
    summary: str
    metric_id: str | None = None


class ObservationModel(BaseModel):
    event: str
    interpretation_id: str
    app_version: str | None
    analytics_schema_version: int | None
    event_rows: int
    analysis_keys: int
    intent_signal: bool
    must_not_be_interpreted_as: list[str]
    funnel_role: str


class DeclaredAbsenceModel(BaseModel):
    event: str
    interpretation_id: str
    event_rows: int = 0
    zero_events_mean: str
    must_not_be_interpreted_as: list[str]
    funnel_role: str


class UninterpretedModel(BaseModel):
    event: str
    event_rows: int
    analysis_keys: int
    reason: str


class ErrorSignatureModel(BaseModel):
    id: str
    evidence_class: str
    event: str
    event_rows: int
    analysis_keys: int
    confidence_ceiling: str
    match: dict[str, Any]
    lead_visible: bool


class FunnelStepModel(BaseModel):
    event: str
    units: int
    analysis_keys: int


class FunnelModel(BaseModel):
    id: str
    grain: str
    slice: dict[str, Any]
    steps: list[FunnelStepModel]


class EligibilityModel(BaseModel):
    status: str
    reasons: list[ReasonModel]


class MetricModel(BaseModel):
    id: str
    evidence_class: str
    slice: dict[str, Any]
    numerator: int
    denominator: int
    eligibility: EligibilityModel
    confidence_ceiling: str | None
    value: float | None
    lead_visible: bool


class MixBucket(BaseModel):
    value: str | None
    event_rows: int
    share: float


class AcquisitionMix(BaseModel):
    status: str


class SegmentModel(BaseModel):
    label: str
    numerator: int
    denominator: int
    rate: float | None


class FindingModel(BaseModel):
    id: str
    layer: str
    evidence_class: str
    grain: str
    segments: list[SegmentModel]
    eligibility: EligibilityModel
    confidence_ceiling: str | None
    non_causal_clause: str
    do_not_claim: list[str]
    excluded_keys: int
    lead_visible: bool


class ValidatedContext(BaseModel):
    context_version: int = 1
    contract_version: int
    dataset: DatasetModel
    identity: IdentityModel
    versions: VersionsModel
    report_policy: ReportPolicy
    qa: list[QaItem]
    observations: list[ObservationModel]
    declared_absences: list[DeclaredAbsenceModel]
    uninterpreted_events: list[UninterpretedModel]
    error_signatures: list[ErrorSignatureModel]
    funnels: list[FunnelModel]
    metrics: list[MetricModel]
    findings: list[FindingModel]
    mixes: dict[str, list[MixBucket]]
    acquisition_mix: AcquisitionMix


class ConfounderStatus(BaseModel):
    dimension: str
    status: str


class AttributionModel(BaseModel):
    status: str
    reasons: list[str]


class MetricComparison(BaseModel):
    id: str
    slice: dict[str, Any]
    baseline: MetricModel | None
    current: MetricModel | None
    confounders: list[ConfounderStatus]
    attribution: AttributionModel


class ComparisonReport(BaseModel):
    comparison_version: int = 1
    baseline_window: WindowModel
    current_window: WindowModel
    metrics: list[MetricComparison]
    acquisition_mix: AcquisitionMix = Field(default_factory=lambda: AcquisitionMix(status="unavailable"))

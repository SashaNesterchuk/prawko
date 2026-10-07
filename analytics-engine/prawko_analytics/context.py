"""Build a validated analysis context from the warehouse."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from prawko_analytics.contract import Contract, MetricDef, load_contract
from prawko_analytics.eligibility import decide_eligibility
from prawko_analytics.ingest import WARSAW, load_events, partition_days
from prawko_analytics.interpret import select_interpretation, values_equal
from prawko_analytics.patterns import discover_patterns
from prawko_analytics.models import (
    AcquisitionMix,
    DatasetModel,
    DeclaredAbsenceModel,
    EligibilityModel,
    ErrorSignatureModel,
    FunnelModel,
    FunnelStepModel,
    IdentityModel,
    MetricModel,
    MixBucket,
    ObservationModel,
    QaItem,
    ReasonModel,
    ReportPolicy,
    SchemaVersionCount,
    UninterpretedModel,
    ValidatedContext,
    VersionCount,
    VersionsModel,
    WindowModel,
)


@dataclass(frozen=True)
class AnalysisWindow:
    kind: str
    start: datetime
    end: datetime
    label: str


@dataclass
class PreparedRow:
    event_id: str
    event: str
    timestamp: datetime
    dump_id: str
    properties: dict
    analysis_key: str | None
    key_source: str
    app_version: str | None
    schema: int | None
    interpretation_id: str | None
    match_status: str
    distinct_id: str | None = None


def day_window(day) -> AnalysisWindow:
    start = datetime.combine(day, time.min, tzinfo=WARSAW)
    return AnalysisWindow("day", start, start + timedelta(days=1), day.isoformat())


def range_window(kind: str, start_day, end_day) -> AnalysisWindow:
    start = datetime.combine(start_day, time.min, tzinfo=WARSAW)
    end = datetime.combine(end_day, time.min, tzinfo=WARSAW)
    return AnalysisWindow(kind, start, end, f"{start_day.isoformat()}/{end_day.isoformat()}")


def load_prepared_rows(
    warehouse: Path,
    window: AnalysisWindow,
    contract: Contract | None = None,
) -> list[PreparedRow]:
    contract = contract or load_contract()
    partitions = partition_days(warehouse, window.start, window.end)
    paths = [path for _day, path, _meta in partitions if path is not None]
    return [_prepare(raw, contract) for raw in load_events(paths, window.start, window.end)]


def build_context(
    warehouse: Path,
    window: AnalysisWindow,
    contract: Contract | None = None,
) -> ValidatedContext:
    contract = contract or load_contract()
    partitions = partition_days(warehouse, window.start, window.end)
    missing_days = [day for day, path, _meta in partitions if path is None]
    complete = bool(partitions) and not missing_days and all(
        meta is not None and meta.get("complete") is True
        for _day, path, meta in partitions
        if path is not None
    )
    paths = [path for _day, path, _meta in partitions if path is not None]
    raw_rows = load_events(paths, window.start, window.end)
    rows = [_prepare(raw, contract) for raw in raw_rows]
    identity, identity_qa = _identity(rows, contract)
    qa: list[QaItem] = list(identity_qa)
    if missing_days:
        qa.append(
            QaItem(
                id="missing_partition",
                severity="WARNING",
                effect="limit_window",
                summary="Missing day partitions: " + ", ".join(day.isoformat() for day in missing_days),
            )
        )
    concentration_warning = _concentration_warning(rows, contract, qa)
    ambiguous_events = sorted({row.event for row in rows if row.match_status == "ambiguous"})
    for event_name in ambiguous_events:
        qa.append(
            QaItem(
                id="ambiguous_interpretation",
                severity="BLOCKS_METRIC",
                effect="prohibit_metric",
                summary=f"{event_name} matched more than one interpretation",
            )
        )
    qa.append(
        QaItem(
            id="acquisition_unavailable",
            severity="INFO",
            effect="none",
            summary="Apple Search Ads ids may be on apple_search_ads_attribution_resolved. This mix is not computed from them. app_entry_resolved is a visit entry, not acquisition.",
        )
    )
    observations = _observations(rows, contract)
    absences = _absences(rows, contract)
    uninterpreted = _uninterpreted(rows, contract)
    signatures = _signatures(rows, contract, identity.quality)
    funnels = _funnels(rows, contract)
    metrics = _metrics(
        rows,
        contract,
        window,
        identity.quality,
        concentration_warning,
        set(ambiguous_events),
    )
    findings = discover_patterns(rows, concentration_warning=concentration_warning)
    fatal_ids = [item.id for item in qa if item.severity == "FATAL"]
    if fatal_ids:
        status = "blocked"
    elif any(item.severity in {"BLOCKS_METRIC", "WARNING"} for item in qa):
        status = "limited"
    else:
        status = "open"
    if status == "blocked":
        metrics = [metric.model_copy(update={"lead_visible": False}) for metric in metrics]
        signatures = [item.model_copy(update={"lead_visible": False}) for item in signatures]
        findings = [finding.model_copy(update={"lead_visible": False}) for finding in findings]
    dump_ids = sorted({row.dump_id for row in rows if row.dump_id})
    return ValidatedContext(
        contract_version=contract.version,
        dataset=DatasetModel(
            dump_ids=dump_ids,
            timezone=contract.timezone,
            window=WindowModel(
                kind=window.kind,
                start=window.start,
                end=window.end,
                complete=complete,
                label=window.label,
            ),
            event_rows=len(rows),
            analysis_keys=len({row.analysis_key for row in rows if row.analysis_key}),
        ),
        identity=identity,
        versions=_versions(rows),
        report_policy=ReportPolicy(
            status=status,
            recommendations_enabled=contract.recommendations_enabled,
            causal_hypotheses_enabled=contract.causal_hypotheses_enabled,
            fatal_ids=fatal_ids,
        ),
        qa=qa,
        observations=observations,
        declared_absences=absences,
        uninterpreted_events=uninterpreted,
        error_signatures=signatures,
        funnels=funnels,
        metrics=metrics,
        findings=findings,
        mixes=_mixes(rows, contract),
        acquisition_mix=AcquisitionMix(status=contract.acquisition_mix),
    )


def _prepare(raw: dict, contract: Contract) -> PreparedRow:
    properties = raw["properties"]
    if isinstance(properties, str):
        properties = json.loads(properties)
    timestamp = raw["timestamp"]
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=ZoneInfo("UTC"))
    elif isinstance(timestamp, datetime):
        timestamp = timestamp.astimezone(ZoneInfo("UTC"))
    app_user_id = properties.get(contract.primary_analysis_key)
    distinct_id = raw.get("distinct_id")
    if isinstance(app_user_id, str) and app_user_id:
        analysis_key, key_source = app_user_id, "primary"
    elif isinstance(distinct_id, str) and distinct_id:
        analysis_key, key_source = distinct_id, "fallback"
    else:
        analysis_key, key_source = None, "missing"
    app_version = properties.get("app_version")
    app_version = str(app_version) if app_version else None
    schema = _schema(properties.get("analytics_schema_version"))
    event_name = str(raw["event"])
    event_contract = contract.events.get(event_name)
    if event_contract is None:
        interpretation_id, match_status = None, "no_contract"
    else:
        interpretation, match_status = select_interpretation(
            event_contract.interpretations,
            schema=schema,
            app_version=app_version,
            properties=properties,
        )
        interpretation_id = None if interpretation is None else interpretation.id
    return PreparedRow(
        event_id=str(raw.get("event_id") or ""),
        event=event_name,
        timestamp=timestamp,
        dump_id=str(raw.get("dump_id") or ""),
        properties=properties,
        analysis_key=analysis_key,
        key_source=key_source,
        app_version=app_version,
        schema=schema,
        interpretation_id=interpretation_id,
        match_status=match_status,
        distinct_id=distinct_id if isinstance(distinct_id, str) and distinct_id else None,
    )


def _schema(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _identity(rows: list[PreparedRow], contract: Contract) -> tuple[IdentityModel, list[QaItem]]:
    product = [row for row in rows if contract.is_product_event(row.event)]
    missing_primary = [row for row in product if row.key_source != "primary"]
    unresolved = [row for row in rows if row.key_source == "missing"]
    primary_keys = {row.analysis_key for row in rows if row.key_source == "primary"}
    fallback_outside = {
        row.analysis_key
        for row in rows
        if row.key_source == "fallback" and row.analysis_key not in primary_keys
    }
    share = (len(missing_primary) / len(product)) if product else 0.0
    issues: list[str] = []
    if missing_primary:
        issues.append(f"product_rows_missing_primary={len(missing_primary)}")
    if fallback_outside:
        issues.append(f"fallback_keys_outside_primary={len(fallback_outside)}")
    if unresolved:
        issues.append(f"unresolved_rows={len(unresolved)}")
    if product and share >= contract.unusable_missing_primary_share:
        quality = "unusable"
    elif missing_primary or unresolved or fallback_outside:
        quality = "degraded"
    else:
        quality = "ok"
    qa: list[QaItem] = []
    if quality == "unusable":
        qa.append(
            QaItem(
                id="primary_key_unusable",
                severity="FATAL",
                effect="block_report",
                summary="Product events do not reliably carry app_user_id",
            )
        )
    elif quality == "degraded":
        qa.append(
            QaItem(
                id="identity_degraded",
                severity="WARNING",
                effect="exclude_keys_without_primary_id",
                summary=(
                    "Keys without app_user_id are excluded from user-level metrics. "
                    f"{len(fallback_outside)} such keys."
                ),
            )
        )
    return (
        IdentityModel(
            primary_analysis_key=contract.primary_analysis_key,
            quality=quality,
            fallback_rows=sum(row.key_source == "fallback" for row in rows),
            unresolved_rows=len(unresolved),
            issues=issues,
        ),
        qa,
    )


def _concentration_warning(rows: list[PreparedRow], contract: Contract, qa: list[QaItem]) -> bool:
    if not rows:
        return False
    counts = Counter(row.analysis_key for row in rows if row.analysis_key)
    top = sum(sorted(counts.values(), reverse=True)[: contract.concentration_top_n])
    share = top / len(rows)
    if share < contract.concentration_warning_share:
        return False
    qa.append(
        QaItem(
            id="event_concentration",
            severity="WARNING",
            effect="limit_aggregate_metrics",
            summary=(
                f"top {contract.concentration_top_n} analysis keys produce "
                f"{share:.1%} of event rows"
            ),
        )
    )
    return True


def _observations(rows: list[PreparedRow], contract: Contract) -> list[ObservationModel]:
    grouped: dict[tuple, list[PreparedRow]] = defaultdict(list)
    for row in rows:
        if row.match_status != "matched" or row.interpretation_id is None:
            continue
        grouped[(row.event, row.interpretation_id, row.app_version, row.schema)].append(row)
    observations = []
    for (event_name, interpretation_id, app_version, schema), bucket in sorted(grouped.items(), key=_group_sort):
        interpretation = _interpretation(contract, event_name, interpretation_id)
        observations.append(
            ObservationModel(
                event=event_name,
                interpretation_id=interpretation_id,
                app_version=app_version,
                analytics_schema_version=schema,
                event_rows=len(bucket),
                analysis_keys=len({row.analysis_key for row in bucket if row.analysis_key}),
                intent_signal=interpretation.intent_signal,
                must_not_be_interpreted_as=list(interpretation.must_not_be_interpreted_as),
                funnel_role=interpretation.funnel_role,
            )
        )
    return observations


def _absences(rows: list[PreparedRow], contract: Contract) -> list[DeclaredAbsenceModel]:
    seen = {(row.event, row.interpretation_id) for row in rows if row.interpretation_id}
    absences = []
    for event_name in sorted(contract.events):
        for interpretation in contract.events[event_name].interpretations:
            if (event_name, interpretation.id) in seen:
                continue
            absences.append(
                DeclaredAbsenceModel(
                    event=event_name,
                    interpretation_id=interpretation.id,
                    zero_events_mean=interpretation.zero_events_mean,
                    must_not_be_interpreted_as=list(interpretation.must_not_be_interpreted_as),
                    funnel_role=interpretation.funnel_role,
                )
            )
    return absences


def _uninterpreted(rows: list[PreparedRow], contract: Contract) -> list[UninterpretedModel]:
    grouped: dict[tuple[str, str], list[PreparedRow]] = defaultdict(list)
    for row in rows:
        if row.match_status == "matched":
            continue
        reason = {
            "no_contract": "no_contract_entry",
            "none": "unmatched_properties",
            "ambiguous": "ambiguous_interpretation",
        }[row.match_status]
        grouped[(row.event, reason)].append(row)
    return [
        UninterpretedModel(
            event=event_name,
            reason=reason,
            event_rows=len(bucket),
            analysis_keys=len({row.analysis_key for row in bucket if row.analysis_key}),
        )
        for (event_name, reason), bucket in sorted(grouped.items())
    ]


def _signatures(rows: list[PreparedRow], contract: Contract, quality: str) -> list[ErrorSignatureModel]:
    found = []
    for signature in contract.error_signatures:
        matched = [
            row
            for row in rows
            if row.event == signature.event
            and all(values_equal(expected, row.properties.get(key)) for key, expected in signature.match.items())
        ]
        if not matched:
            continue
        found.append(
            ErrorSignatureModel(
                id=signature.id,
                evidence_class=signature.evidence_class,
                event=signature.event,
                event_rows=len(matched),
                analysis_keys=len({row.analysis_key for row in matched if row.analysis_key}),
                confidence_ceiling=contract.confidence_ceilings[signature.evidence_class],
                match=dict(signature.match),
                lead_visible=quality != "unusable",
            )
        )
    return found


def _funnels(rows: list[PreparedRow], contract: Contract) -> list[FunnelModel]:
    models = []
    for funnel in contract.funnels.values():
        slices: dict[tuple, list[PreparedRow]] = defaultdict(list)
        for row in rows:
            key = tuple(_slice_value(row, dimension) for dimension in funnel.slice_by)
            slices[key].append(row)
        for key in sorted(slices, key=_slice_sort):
            slice_rows = slices[key]
            if not any(_step_match(row, step) for row in slice_rows for step in funnel.steps):
                continue
            carried_rows: list[PreparedRow] = []
            steps = []
            for index, step in enumerate(funnel.steps):
                matched = [row for row in slice_rows if _step_match(row, step)]
                if index == 0:
                    units = {_unit(row, funnel.grain) for row in matched}
                else:
                    join_key = step.join or funnel.grain
                    previous_ids = {
                        _text(row.properties.get(join_key))
                        for row in carried_rows
                        if row.properties.get(join_key) not in (None, "")
                    }
                    matched = [
                        row
                        for row in matched
                        if _text(row.properties.get(join_key)) in previous_ids
                    ]
                    units = {
                        _text(row.properties.get(join_key))
                        for row in matched
                        if row.properties.get(join_key) not in (None, "")
                    }
                carried_rows = matched
                steps.append(
                    FunnelStepModel(
                        event=step.event,
                        units=len(units),
                        analysis_keys=len({row.analysis_key for row in matched if row.analysis_key}),
                    )
                )
            models.append(
                FunnelModel(
                    id=funnel.id,
                    grain=funnel.grain,
                    slice=_slice_dict(funnel.slice_by, key),
                    steps=steps,
                )
            )
    return models


def _rows_for_metric(rows: list[PreparedRow], count: str) -> list[PreparedRow]:
    if count != "analysis_keys":
        return rows
    primary = {row.analysis_key for row in rows if row.key_source == "primary" and row.analysis_key}
    return [row for row in rows if row.analysis_key in primary]


def _metrics(
    rows: list[PreparedRow],
    contract: Contract,
    window: AnalysisWindow,
    quality: str,
    concentration_warning: bool,
    ambiguous_events: set[str],
) -> list[MetricModel]:
    models = []
    for metric in contract.metrics:
        if metric.cohort_event and metric.maturity_days:
            models.append(
                _cohort_metric(rows, metric, contract, window, quality, concentration_warning, ambiguous_events)
            )
            continue
        groups: dict[tuple, dict[str, set[str]]] = defaultdict(lambda: {"num": set(), "den": set()})
        metric_rows = _rows_for_metric(rows, metric.count)
        for row in metric_rows:
            if metric.count == "analysis_keys" and not row.analysis_key:
                continue
            key = tuple(_slice_value(row, dimension) for dimension in metric.homogeneity)
            unit = _metric_unit(row, metric)
            if row.event == metric.denominator_event:
                groups[key]["den"].add(unit)
            if row.event == metric.numerator_event and all(
                values_equal(expected, row.properties.get(prop))
                for prop, expected in metric.numerator_where.items()
            ):
                groups[key]["num"].add(unit)
        if not groups:
            groups[tuple(None for _dimension in metric.homogeneity)] = {"num": set(), "den": set()}
        dependent = {metric.numerator_event, metric.denominator_event} - {None}
        ambiguous = bool(dependent & ambiguous_events)
        for key in sorted(groups, key=_slice_sort):
            numerator = len(groups[key]["num"])
            denominator = len(groups[key]["den"])
            models.append(
                _metric_model(
                    metric,
                    contract,
                    _slice_dict(metric.homogeneity, key),
                    numerator,
                    denominator,
                    maturity_met=True,
                    quality=quality,
                    concentration_warning=concentration_warning,
                    ambiguous=ambiguous,
                )
            )
    return models


def _cohort_metric(
    rows: list[PreparedRow],
    metric: MetricDef,
    contract: Contract,
    window: AnalysisWindow,
    quality: str,
    concentration_warning: bool,
    ambiguous_events: set[str],
) -> MetricModel:
    installs: dict[str, set] = defaultdict(set)
    product_days: dict[str, set] = defaultdict(set)
    for row in _rows_for_metric(rows, metric.count):
        if not row.analysis_key:
            continue
        day = row.timestamp.astimezone(WARSAW).date()
        if row.event == metric.cohort_event:
            installs[row.analysis_key].add(day)
        if contract.is_product_event(row.event):
            product_days[row.analysis_key].add(day)
    window_start = window.start.astimezone(WARSAW).date()
    window_end = window.end.astimezone(WARSAW).date()
    mature: set[str] = set()
    returned: set[str] = set()
    assert metric.maturity_days is not None
    for key, days in installs.items():
        for day in days:
            return_day = day + timedelta(days=metric.maturity_days)
            inside = window_start <= day < window_end and window_start <= return_day < window_end
            if not inside:
                continue
            mature.add(key)
            if return_day in product_days.get(key, set()):
                returned.add(key)
    return _metric_model(
        metric,
        contract,
        {},
        len(returned),
        len(mature),
        maturity_met=bool(mature),
        quality=quality,
        concentration_warning=concentration_warning,
        ambiguous=metric.cohort_event in ambiguous_events,
    )


def _metric_model(
    metric: MetricDef,
    contract: Contract,
    slice_values: dict[str, Any],
    numerator: int,
    denominator: int,
    *,
    maturity_met: bool,
    quality: str,
    concentration_warning: bool,
    ambiguous: bool,
) -> MetricModel:
    identity_blocks = quality == "unusable"
    decision = decide_eligibility(
        evidence_class=metric.evidence_class,
        ceilings=contract.confidence_ceilings,
        numerator=numerator,
        denominator=denominator,
        min_denominator=metric.min_denominator,
        maturity_met=maturity_met,
        identity_blocks_user_metric=identity_blocks,
        ambiguous=ambiguous,
        concentration_warning=concentration_warning,
    )
    value = None
    if decision.status != "prohibited" and denominator:
        value = numerator / denominator
    return MetricModel(
        id=metric.id,
        evidence_class=metric.evidence_class,
        slice=slice_values,
        numerator=numerator,
        denominator=denominator,
        eligibility=EligibilityModel(
            status=decision.status,
            reasons=[
                ReasonModel(rule=reason.rule, actual=reason.actual, required=reason.required, detail=reason.detail)
                for reason in decision.reasons
            ],
        ),
        confidence_ceiling=decision.confidence_ceiling,
        value=value,
        lead_visible=decision.status != "prohibited" and quality != "unusable",
    )


def _versions(rows: list[PreparedRow]) -> VersionsModel:
    app = _count_versions(rows, lambda row: row.app_version)
    schema = _count_versions(rows, lambda row: row.schema)
    unique_keys = {row.analysis_key for row in rows if row.analysis_key}
    partitioned = (
        sum(keys for _version, _count, keys in app) == len(unique_keys)
        and sum(keys for _version, _count, keys in schema) == len(unique_keys)
    )
    return VersionsModel(
        app_versions=[
            VersionCount(version=version, event_rows=count, analysis_keys=keys)
            for version, count, keys in app
        ],
        analytics_schema_versions=[
            SchemaVersionCount(version=version, event_rows=count, analysis_keys=keys)
            for version, count, keys in schema
        ],
        analysis_keys_are_partition=partitioned,
    )


def _count_versions(rows: list[PreparedRow], getter) -> list[tuple[Any, int, int]]:
    counts: Counter = Counter()
    keys: dict[Any, set[str]] = defaultdict(set)
    for row in rows:
        value = getter(row)
        counts[value] += 1
        if row.analysis_key:
            keys[value].add(row.analysis_key)
    ranked = sorted(counts, key=lambda value: (-counts[value], str(value)))
    return [(value, counts[value], len(keys[value])) for value in ranked]


def _mixes(rows: list[PreparedRow], contract: Contract) -> dict[str, list[MixBucket]]:
    total = len(rows)
    mixes = {}
    for dimension in contract.confounders:
        counts: Counter = Counter(_mix_value(row, dimension) for row in rows)
        ranked = sorted(counts, key=lambda value: (-counts[value], str(value)))
        mixes[dimension] = [
            MixBucket(
                value=value,
                event_rows=counts[value],
                share=(counts[value] / total) if total else 0.0,
            )
            for value in ranked
        ]
    return mixes


def _mix_value(row: PreparedRow, dimension: str) -> str | None:
    if dimension == "app_version":
        return row.app_version
    if dimension == "analytics_schema_version":
        return None if row.schema is None else str(row.schema)
    value = row.properties.get(dimension)
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None or value == "":
        return None
    return str(value)


def _slice_value(row: PreparedRow, dimension: str) -> Any:
    if dimension == "app_version":
        return row.app_version
    if dimension == "analytics_schema_version":
        return row.schema
    return _mix_value(row, dimension)


def _slice_dict(dimensions: tuple[str, ...], key: tuple) -> dict[str, Any]:
    return dict(zip(dimensions, key, strict=True))


def _slice_sort(key: tuple) -> tuple:
    return tuple("" if value is None else str(value) for value in key)


def _group_sort(item) -> tuple:
    event_name, interpretation_id, app_version, schema = item[0]
    return (event_name, interpretation_id, app_version or "", -1 if schema is None else schema)


def _interpretation(contract: Contract, event_name: str, interpretation_id: str):
    for item in contract.events[event_name].interpretations:
        if item.id == interpretation_id:
            return item
    raise KeyError(interpretation_id)


def _step_match(row: PreparedRow, step) -> bool:
    return row.event == step.event and all(
        values_equal(expected, row.properties.get(prop)) for prop, expected in step.when_properties.items()
    )


def _unit(row: PreparedRow, grain: str) -> str:
    value = row.properties.get(grain)
    if value not in (None, ""):
        return str(value)
    return row.event_id


def _metric_unit(row: PreparedRow, metric: MetricDef) -> str:
    if metric.count == "grain" and metric.grain:
        return _unit(row, metric.grain)
    if row.analysis_key:
        return row.analysis_key
    return row.event_id


def _text(value: Any) -> str:
    return "" if value is None else str(value)

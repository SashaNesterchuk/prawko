"""Build a validated analysis context from the warehouse."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from prawko_analytics.contract import Contract, Funnel, MetricDef, load_contract
from prawko_analytics.eligibility import decide_eligibility
from prawko_analytics.ingest import WARSAW, load_events, partition_days
from prawko_analytics.interpret import select_interpretation, values_equal
from prawko_analytics.patterns import discover_patterns
from prawko_analytics.learning import (
    learning_source_dependency, learning_time_to_value, meaningful_learning, observation_anchors,
)
from prawko_analytics.revenuecat import financial_report
from prawko_analytics.identity import identity_link_report
from prawko_analytics.access import feature_access_report
from prawko_analytics.content import content_observations_report
from prawko_analytics.repeat_answers import repeat_answer_report
from prawko_analytics.external_entries import external_entry_report
from prawko_analytics.rewarded_ads import rewarded_ad_report
from prawko_analytics.data_quality import canonical_observations, diagnostic_observations, warehouse_data_quality
from prawko_analytics.spend import spend_report
from prawko_analytics.acquisition import warehouse_acquisition_report
from prawko_analytics.acquisition_finance import financial_cohort_report
from prawko_analytics.billing_learning import warehouse_billing_learning_report
from prawko_analytics.onboarding import warehouse_onboarding_report
from prawko_analytics.paywall_observations import warehouse_paywall_report
from prawko_analytics.paywall_contract import ELIGIBILITY_EVENTS
from prawko_analytics.payload_validation import invalid_client_payload
from prawko_analytics.quality import observation_usable
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
    client_event_id: str | None = None
    client_occurred_at: str | None = None
    received_at: str | None = None


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
    return load_quality_observations(warehouse, window, contract)[0]


def load_quality_observations(
    warehouse: Path,
    window: AnalysisWindow,
    contract: Contract | None = None,
) -> tuple[list[PreparedRow], dict]:
    contract = contract or load_contract()
    partitions = partition_days(warehouse, window.start, window.end)
    paths = [path for _day, path, _meta in partitions if path is not None]
    rows = [_prepare(raw, contract) for raw in load_events(paths, window.start, window.end)]
    complete = bool(partitions) and all(
        path is not None and meta is not None and meta.get("metadata_version") == 2 and meta.get("complete") is True
        for _day, path, meta in partitions
    )
    return warehouse_data_quality(
        warehouse, rows, start=window.start, end=window.end, prepare=lambda raw: _prepare(raw, contract),
        coverage_complete=complete,
    )


def build_context(
    warehouse: Path,
    window: AnalysisWindow,
    contract: Contract | None = None,
) -> ValidatedContext:
    contract = contract or load_contract()
    partitions = partition_days(warehouse, window.start, window.end)
    missing_days = [day for day, path, _meta in partitions if path is None]
    complete = bool(partitions) and not missing_days and all(
        meta is not None and meta.get("metadata_version") == 2 and meta.get("complete") is True
        for _day, path, meta in partitions
        if path is not None
    )
    rows, data_quality = load_quality_observations(warehouse, window, contract)
    analytical_rows = canonical_observations(rows)
    diagnostic_rows = diagnostic_observations(rows)
    identity_links = identity_link_report(warehouse, start=window.start, end=window.end)
    content_observations = content_observations_report(diagnostic_rows, coverage_complete=complete)
    repeat_answers = repeat_answer_report(
        diagnostic_rows, start=window.start, end=window.end, coverage_complete=complete, content_quality=content_observations,
    )
    external_entries = external_entry_report(diagnostic_rows, start=window.start, end=window.end, coverage_complete=complete)
    rewarded_ads = rewarded_ad_report(diagnostic_rows, coverage_complete=complete)
    paywall_observations = warehouse_paywall_report(
        warehouse, start=window.start, end=window.end, contract=contract,
    )
    acquisition = warehouse_acquisition_report(
        warehouse, start=window.start, end=window.end, contract=contract,
    )
    financial_cohorts = financial_cohort_report(
        warehouse, start=window.start, end=window.end, acquisition=acquisition,
    )
    identity, identity_qa = _identity(rows, contract)
    qa: list[QaItem] = list(identity_qa)
    if paywall_observations["quality_issue_count"]:
        qa.append(QaItem(
            id="paywall_observations_limited", severity="WARNING", effect="prohibit_eligibility_origin_conclusions",
            summary="Eligibility request/product bindings or origin snapshots are invalid, conflicting or unverified. "
                    "These observations do not establish trial exposure, billing or native delivery.",
        ))
    if external_entries["quality_issue_count"]:
        qa.append(QaItem(
            id="external_entry_observations_limited", severity="WARNING", effect="prohibit_entry_learning_rates",
            summary="External entries have invalid, orphaned or conflicting scope/destination/learning observations. "
                    "No notification delivery or causal reminder effect is inferred.",
        ))
    if rewarded_ads["quality_issue_count"]:
        qa.append(QaItem(
            id="rewarded_ad_observations_limited", severity="WARNING", effect="prohibit_ad_revenue_conclusions",
            summary="Rewarded request/impression or PAID observations have missing scope or integrity conflicts. "
                    "Client SDK values are not settled money or verified production delivery.",
        ))
    if content_observations["quality_issue_count"]:
        qa.append(QaItem(
            id="content_observations_limited", severity="WARNING", effect="prohibit_content_revision_rates",
            summary="Content provenance/display or persisted exam-rule observations have invalid or conflicting "
                    "metadata. Diagnostic counts do not establish clean revision-specific rates.",
        ))
    if repeat_answers["quality_issue_count"]:
        qa.append(QaItem(
            id="repeat_answer_observations_limited", severity="WARNING", effect="prohibit_repeat_answer_rates",
            summary="Repeat-answer observations have incomplete join metadata, conflicting answers or uncertain order. "
                    "No causal explanation/review effect is inferred.",
        ))
    if identity_links["status"] == "limited" or identity_links["historical_sdk_quality_status"] == "review_required":
        qa.append(QaItem(
            id="identity_links_limited", severity="WARNING", effect="prohibit_automatic_account_joins",
            summary="Observed account links have incomplete history or identity quality signals. "
                    "Install-level analysis remains separate; SDK profiles and entitlement transfers are not inferred.",
        ))
    if missing_days:
        qa.append(
            QaItem(
                id="missing_partition",
                severity="WARNING",
                effect="limit_window",
                summary="Missing day partitions: " + ", ".join(day.isoformat() for day in missing_days),
            )
        )
    if not complete:
        qa.append(QaItem(
            id="incomplete_coverage", severity="BLOCKS_METRIC", effect="prohibit_metric",
            summary="Pagination/delivery coverage is not verified for the full window. Observed counts are not complete rates.",
        ))
    concentration_warning = _concentration_warning(rows, contract, qa)
    ambiguous_events = sorted({row.event for row in rows if row.match_status == "ambiguous"})
    invalid_payloads = sum(invalid_client_payload(row.properties) for row in rows)
    if invalid_payloads:
        qa.append(QaItem(
            id="invalid_client_payload", severity="BLOCKS_METRIC", effect="prohibit_dependent_metric",
            summary=f"{invalid_payloads} client events have invalid, contradictory or unsupported payload annotations.",
        ))
    import_conflicts = sum(row.properties.get("_warehouse_import_conflict") is True for row in rows)
    if import_conflicts:
        qa.append(QaItem(
            id="import_identity_conflict", severity="BLOCKS_METRIC", effect="prohibit_metric",
            summary=f"{import_conflicts} retained rows have conflicting bodies for the same provider/client event ID.",
        ))
    for field, qa_id, summary in (
        ("conflicting_business_rows", "business_identity_conflict", "conflicting installation-scoped business observations"),
        ("invalid_business_rows", "invalid_business_observation", "invalid business IDs or declared immutable fields"),
        ("uncertain_business_order_rows", "business_order_unproven", "unproven order among earliest business observations"),
    ):
        count = data_quality["counts"].get(field, 0)
        if count:
            qa.append(QaItem(
                id=qa_id, severity="BLOCKS_METRIC", effect="prohibit_dependent_metric",
                summary=f"{count} retained rows have {summary}. Raw evidence is retained; no first/last-write repair is inferred.",
            ))
    for event_name in ambiguous_events:
        qa.append(
            QaItem(
                id="ambiguous_interpretation",
                severity="BLOCKS_METRIC",
                effect="prohibit_metric",
                summary=f"{event_name} matched more than one interpretation",
            )
        )
    if acquisition["mix"]["status"] == "unavailable":
        qa.append(QaItem(
            id="acquisition_unavailable", severity="INFO", effect="none",
            summary="No usable installation-scoped ASA terminal is observed for current primary identities. "
                    "Missing results, Android and visit entries are not organic acquisition.",
        ))
    if acquisition["quality_issue_count"] or acquisition["outcome_quality_issue_count"]:
        qa.append(QaItem(
            id="acquisition_observations_limited", severity="WARNING", effect="prohibit_dependent_acquisition_rates",
            summary="ASA installation/platform/anchor or dependent client-purchase/learning observations are invalid or conflicting. "
                    "Client purchases are not verified money; financial app mapping remains separate.",
        ))
    observations = _observations(rows, contract)
    absences = _absences(rows, contract)
    uninterpreted = _uninterpreted(rows, contract)
    signatures = _signatures(analytical_rows, contract, identity.quality)
    funnels = _funnels(analytical_rows, contract)
    metrics = _metrics(
        rows,
        contract,
        window,
        identity.quality,
        concentration_warning,
        set(ambiguous_events),
        complete=complete,
    )
    findings = discover_patterns(analytical_rows, concentration_warning=concentration_warning)
    if not complete or import_conflicts or invalid_payloads or data_quality["quality_issue_count"]:
        findings = [finding.model_copy(update={"lead_visible": False}) for finding in findings]
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
        acquisition_mix=AcquisitionMix.model_validate(acquisition["mix"]),
        learning_time_to_value=learning_time_to_value(
            rows, start=window.start, end=window.end, complete=complete,
        ),
        financial=financial_report(
            warehouse, start=window.start, end=window.end, client_rows=rows,
        ),
        identity_links=identity_links,
        feature_access=feature_access_report(rows, coverage_complete=complete),
        content_observations=content_observations,
        repeat_answers=repeat_answers,
        external_entries=external_entries,
        rewarded_ads=rewarded_ads,
        data_quality=data_quality,
        spend=spend_report(warehouse, start=window.start, end=window.end),
        acquisition=acquisition,
        financial_cohorts=financial_cohorts,
        billing_learning=warehouse_billing_learning_report(
            warehouse, start=window.start, end=window.end, contract=contract,
        ),
        onboarding=warehouse_onboarding_report(warehouse, start=window.start, end=window.end, contract=contract),
        paywall_observations=paywall_observations,
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
        client_event_id=_text(properties.get("event_id")) or None,
        client_occurred_at=_text(properties.get("client_occurred_at")) or None,
        received_at=_text(raw.get("received_at")) or None,
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
            and observation_usable(row.properties)
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
            steps, _origins, _paths = _funnel_paths(slice_rows, funnel)
            models.append(
                FunnelModel(
                    id=funnel.id,
                    grain=funnel.grain,
                    slice=_slice_dict(funnel.slice_by, key),
                    steps=steps,
                    conversion_window_seconds=funnel.conversion_window_seconds,
                    missing_join_rows=_missing_funnel_join_rows(slice_rows, funnel),
                )
            )
    return models


def _funnel_paths(rows: list[PreparedRow], funnel: Funnel, *, horizon: int | None = None):
    """Carry the original grain through retries; joins never change the counting unit."""
    rows = [row for row in rows if observation_usable(row.properties)]
    horizon = horizon if horizon is not None else funnel.conversion_window_seconds
    first = [row for row in rows if _step_match(row, funnel.steps[0])]
    origins = {}
    for row in sorted(first, key=lambda item: item.timestamp):
        root = (row.analysis_key, _unit(row, funnel.grain))
        origins.setdefault(root, row)
    paths = {root: [(row, row)] for root, row in origins.items()}
    steps = [FunnelStepModel(
        event=funnel.steps[0].event, units=len(origins),
        analysis_keys=len({row.analysis_key for row in origins.values() if row.analysis_key}),
    )]
    for step in funnel.steps[1:]:
        join = step.join or funnel.grain
        index: dict[tuple, list[PreparedRow]] = defaultdict(list)
        for row in rows:
            value = _text(row.properties.get(join))
            if value and row.analysis_key and _step_match(row, step):
                index[(row.analysis_key, value)].append(row)
        next_paths = {}
        for root, candidates in paths.items():
            reached = {}
            for origin, previous in candidates:
                value = _text(previous.properties.get(join))
                for row in index.get((previous.analysis_key, value), []):
                    if _ordered(previous, row) and row.timestamp <= origin.timestamp + timedelta(seconds=horizon):
                        reached[id(row)] = (origin, row)
            if reached:
                next_paths[root] = list(reached.values())
        paths = next_paths
        steps.append(FunnelStepModel(
            event=step.event, units=len(paths),
            analysis_keys=len({root[0] for root in paths if root[0]}),
        ))
    return steps, origins, paths


def _ordered(previous: PreparedRow, current: PreparedRow) -> bool:
    if current.timestamp != previous.timestamp:
        return current.timestamp > previous.timestamp
    run = previous.properties.get("app_run_id")
    before = previous.properties.get("event_sequence")
    after = current.properties.get("event_sequence")
    if run and run == current.properties.get("app_run_id") and isinstance(before, int) and isinstance(after, int):
        return after >= before
    return True


def _missing_funnel_join_rows(rows: list[PreparedRow], funnel: Funnel) -> int:
    missing = set()
    for index, step in enumerate(funnel.steps):
        required = {step.join or funnel.grain}
        if index + 1 < len(funnel.steps):
            required.add(funnel.steps[index + 1].join or funnel.grain)
        for row in rows:
            if _step_match(row, step) and any(not _text(row.properties.get(key)) for key in required):
                missing.add(id(row))
    return len(missing)


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
    *,
    complete: bool = True,
) -> list[MetricModel]:
    models = []
    for metric in contract.metrics:
        if metric.cohort_event and metric.maturity_days:
            models.append(
                _cohort_metric(rows, metric, contract, window, quality, concentration_warning, ambiguous_events)
            )
            continue
        groups: dict[tuple, list[PreparedRow]] = defaultdict(list)
        metric_rows = _rows_for_metric(rows, metric.count)
        dependent = {metric.numerator_event, metric.denominator_event} - {None}
        if metric.funnel:
            dependent.update(step.event for step in contract.funnels[metric.funnel].steps)
        for row in metric_rows:
            if metric.count == "analysis_keys" and not row.analysis_key:
                continue
            key = tuple(_slice_value(row, dimension) for dimension in metric.homogeneity)
            if row.event in dependent:
                groups[key].append(row)
        if not groups:
            groups[tuple(None for _dimension in metric.homogeneity)] = []
        ambiguous = bool(dependent & ambiguous_events)
        for key in sorted(groups, key=_slice_sort):
            group = groups[key]
            censored = 0
            unjoinable = 0
            invalid_payload_rows = sum(invalid_client_payload(row.properties) for row in group)
            import_conflict_rows = sum(row.properties.get("_warehouse_import_conflict") is True for row in group)
            business_conflict_rows = sum(row.properties.get("_warehouse_business_conflict") is True for row in group)
            invalid_business_rows = sum(row.properties.get("_warehouse_business_invalid") is True for row in group)
            business_order_uncertain_rows = sum(row.properties.get("_warehouse_business_order_uncertain") is True for row in group)
            analytical_group = [row for row in canonical_observations(group) if observation_usable(row.properties)]
            if metric.funnel:
                funnel = contract.funnels[metric.funnel]
                horizon = metric.conversion_window_seconds or funnel.conversion_window_seconds
                _steps, origins, paths = _funnel_paths(analytical_group, funnel, horizon=horizon)
                mature = {
                    root for root, origin in origins.items()
                    if origin.timestamp + timedelta(seconds=horizon) <= window.end
                }
                censored = len({_metric_unit(origin, metric) for root, origin in origins.items() if root not in mature})
                denominator_units = {_metric_unit(origin, metric) for root, origin in origins.items() if root in mature}
                numerator_units = {
                    _metric_unit(origins[root], metric) for root, candidates in paths.items()
                    if root in mature and any(
                        last.event == metric.numerator_event and all(
                            values_equal(expected, last.properties.get(prop))
                            for prop, expected in metric.numerator_where.items()
                        ) for _origin, last in candidates
                    )
                }
                unjoinable = _missing_funnel_join_rows(group, funnel)
            else:
                denominator_rows = [row for row in analytical_group if row.event == metric.denominator_event]
                denominator_units = {_metric_unit(row, metric) for row in denominator_rows}
                numerator_units = {
                    _metric_unit(row, metric) for row in analytical_group
                    if row.event == metric.numerator_event
                    and all(values_equal(expected, row.properties.get(prop)) for prop, expected in metric.numerator_where.items())
                    and any(_metric_unit(before, metric) == _metric_unit(row, metric) and _ordered(before, row)
                            for before in denominator_rows)
                } & denominator_units
            numerator = len(numerator_units)
            denominator = len(denominator_units)
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
                ).model_copy(update={
                    "grain": metric.grain or metric.count,
                    "conversion_window_seconds": metric.conversion_window_seconds,
                    "censored_units": censored,
                    "unjoinable_rows": unjoinable,
                    "invalid_payload_rows": invalid_payload_rows,
                    "import_conflict_rows": import_conflict_rows,
                    "business_conflict_rows": business_conflict_rows,
                    "invalid_business_rows": invalid_business_rows,
                    "business_order_uncertain_rows": business_order_uncertain_rows,
                })
            )
    for index, model in enumerate(models):
        reasons = list(model.eligibility.reasons)
        if not complete:
            reasons.append(ReasonModel(rule="incomplete_coverage"))
        if model.unjoinable_rows:
            reasons.append(ReasonModel(rule="missing_join_id", actual=model.unjoinable_rows, required=0))
        if model.invalid_payload_rows:
            reasons.append(ReasonModel(rule="invalid_client_payload", actual=model.invalid_payload_rows, required=0))
        if model.import_conflict_rows:
            reasons.append(ReasonModel(rule="import_identity_conflict", actual=model.import_conflict_rows, required=0))
        for field, rule in (
            ("business_conflict_rows", "business_identity_conflict"),
            ("invalid_business_rows", "invalid_business_observation"),
            ("business_order_uncertain_rows", "business_order_unproven"),
        ):
            count = getattr(model, field)
            if count:
                reasons.append(ReasonModel(rule=rule, actual=count, required=0))
        if (not complete or model.unjoinable_rows or model.invalid_payload_rows or model.import_conflict_rows
                or model.business_conflict_rows or model.invalid_business_rows or model.business_order_uncertain_rows):
            models[index] = model.model_copy(update={
                "eligibility": EligibilityModel(status="prohibited", reasons=reasons),
                "confidence_ceiling": None, "value": None, "lead_visible": False,
            })
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
    rows = [row for row in rows if row.event not in ELIGIBILITY_EVENTS]
    installs: dict[str, set] = defaultdict(set)
    product_days: dict[str, set] = defaultdict(set)
    anchors, _excluded = observation_anchors(rows) if metric.cohort_timestamp_property else ({}, set())
    quality_rows = (
        [row for row in rows if learning_source_dependency(row, anchors)]
        if metric.return_rule == "learning-v1" else rows
    )
    for row in canonical_observations(_rows_for_metric(rows, metric.count)):
        if not row.analysis_key or not observation_usable(row.properties):
            continue
        day = row.timestamp.astimezone(WARSAW).date()
        unit = row.analysis_key
        if metric.count == "grain":
            if not metric.grain or not isinstance(row.properties.get(metric.grain), str) or not row.properties[metric.grain]:
                continue
            unit = f"{row.analysis_key}:{row.properties[metric.grain]}"
        if row.event == metric.cohort_event:
            anchor = anchors.get((row.analysis_key, row.properties.get(metric.grain))) if metric.cohort_timestamp_property else row.timestamp
            if anchor is not None:
                installs[unit].add(anchor.astimezone(WARSAW).date())
        is_return = meaningful_learning(row) if metric.return_rule == "learning-v1" else contract.is_product_event(row.event)
        if is_return and observation_usable(row.properties):
            product_days[unit].add(day)
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
    ).model_copy(update={
        "grain": metric.grain or metric.count,
        "invalid_payload_rows": sum(
            invalid_client_payload(row.properties)
            for row in quality_rows
            if metric.return_rule == "learning-v1" or row.event == metric.cohort_event or contract.is_product_event(row.event)
        ),
        "import_conflict_rows": sum(
            row.properties.get("_warehouse_import_conflict") is True for row in quality_rows
        ),
        "business_conflict_rows": sum(
            row.properties.get("_warehouse_business_conflict") is True for row in quality_rows
        ),
        "invalid_business_rows": sum(
            row.properties.get("_warehouse_business_invalid") is True for row in quality_rows
        ),
        "business_order_uncertain_rows": sum(
            row.properties.get("_warehouse_business_order_uncertain") is True for row in quality_rows
        ),
    })


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
    return value if isinstance(value, str) else ""

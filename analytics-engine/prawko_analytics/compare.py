"""Compare two validated contexts. Attribution is never fully allowed."""

from __future__ import annotations

from datetime import datetime, time

from prawko_analytics.contract import Change, Contract
from prawko_analytics.ingest import WARSAW
from prawko_analytics.models import (
    AttributionModel,
    ComparisonReport,
    ConfounderStatus,
    MetricComparison,
    MetricModel,
    ValidatedContext,
)


def build_comparison(
    baseline: ValidatedContext,
    current: ValidatedContext,
    contract: Contract,
) -> ComparisonReport:
    confounders = _confounders(baseline, current, contract)
    shifted = [item.dimension for item in confounders if item.status == "shifted"]
    metrics = []
    current_by_key = {_metric_key(metric): metric for metric in current.metrics}
    seen = set()
    for metric in baseline.metrics:
        key = _metric_key(metric)
        seen.add(key)
        metrics.append(
            _compare_metric(
                metric,
                current_by_key.get(key),
                confounders,
                shifted,
                _crossed_changes(baseline, current, contract.changes, metric.id),
            )
        )
    for metric in current.metrics:
        key = _metric_key(metric)
        if key in seen:
            continue
        metrics.append(
            _compare_metric(
                None,
                metric,
                confounders,
                shifted,
                _crossed_changes(baseline, current, contract.changes, metric.id),
            )
        )
    return ComparisonReport(
        baseline_window=baseline.dataset.window,
        current_window=current.dataset.window,
        metrics=metrics,
        acquisition_mix=baseline.acquisition_mix,
    )


def _compare_metric(
    baseline: MetricModel | None,
    current: MetricModel | None,
    confounders: list[ConfounderStatus],
    shifted: list[str],
    crossed: list[str],
) -> MetricComparison:
    sample = current or baseline
    assert sample is not None
    reasons: list[str] = []
    prohibited = any(
        metric is not None and metric.eligibility.status == "prohibited"
        for metric in (baseline, current)
    )
    if prohibited or baseline is None or current is None:
        reasons.append("metric_prohibited")
    if shifted:
        reasons.extend(f"{dimension}_mix_shifted" for dimension in shifted)
    if crossed:
        reasons.extend(f"product_change:{change_id}" for change_id in crossed)
    if "metric_prohibited" in reasons:
        status = "not_applicable"
    elif shifted or crossed:
        status = "prohibited"
    else:
        status = "limited"
        reasons.append("observational_window_comparison")
    return MetricComparison(
        id=sample.id,
        slice=sample.slice,
        baseline=baseline,
        current=current,
        confounders=confounders,
        attribution=AttributionModel(status=status, reasons=reasons),
    )


def _confounders(
    baseline: ValidatedContext,
    current: ValidatedContext,
    contract: Contract,
) -> list[ConfounderStatus]:
    threshold = contract.mix_shift_pp / 100
    statuses = []
    for dimension in contract.confounders:
        before = {bucket.value: bucket.share for bucket in baseline.mixes.get(dimension, [])}
        after = {bucket.value: bucket.share for bucket in current.mixes.get(dimension, [])}
        values = set(before) | set(after)
        shifted = any(abs(before.get(value, 0.0) - after.get(value, 0.0)) >= threshold for value in values)
        statuses.append(ConfounderStatus(dimension=dimension, status="shifted" if shifted else "stable"))
    return statuses


def _crossed_changes(
    baseline: ValidatedContext,
    current: ValidatedContext,
    changes: tuple[Change, ...],
    metric_id: str,
) -> list[str]:
    windows = sorted(
        (baseline.dataset.window, current.dataset.window),
        key=lambda window: window.start,
    )
    start = windows[0].start
    end = windows[-1].end
    crossed = []
    for change in changes:
        if metric_id not in change.affects_metrics:
            continue
        moment = datetime.combine(change.at, time.min, tzinfo=WARSAW)
        if start <= moment < end:
            crossed.append(change.id)
    return crossed


def _metric_key(metric: MetricModel) -> tuple:
    return (metric.id, tuple(sorted((key, _stable(value)) for key, value in metric.slice.items())))


def _stable(value):
    return "" if value is None else value

"""Compare two validated contexts. Attribution is never fully allowed."""

from __future__ import annotations

from datetime import datetime, time
from fractions import Fraction
from math import isclose

from prawko_analytics.contract import Change, Contract
from prawko_analytics.ingest import WARSAW
from prawko_analytics.acquisition import DIMENSIONS, ENUM_FIELDS, ID_FIELDS, MAX_ID, POPULATION, RULE
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
    acquisition_comparison = _acquisition_comparison(baseline.acquisition_mix, current.acquisition_mix, contract)
    confounders.append(ConfounderStatus(
        dimension="acquisition_installation", status=acquisition_comparison["status"],
    ))
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
        acquisition_comparison=acquisition_comparison,
    )


def _acquisition_shares(mix):
    if (
        mix.status != "observed" or mix.rule_version != RULE or not mix.coverage_complete
        or mix.grain != "app_user_id_installation"
        or mix.population != POPULATION
        or type(mix.installations) is not int or not 0 < mix.installations <= MAX_ID
        or type(mix.terminal_observations) is not int or not 0 < mix.terminal_observations <= mix.installations
        or mix.quality_issue_count
    ):
        return None
    shares = {}
    total, terminals = 0, 0
    for bucket in mix.buckets:
        count, share = bucket.get("installations"), bucket.get("share")
        result = bucket.get("asa_result")
        if (
            result not in ("attributed", "organic", "unavailable", "unknown", "ineligible")
            or type(count) is not int or not 0 < count <= mix.installations
            or type(share) not in (int, float) or not 0 <= share <= 1
            or not isclose(share, count / mix.installations, rel_tol=1e-9, abs_tol=1e-12)
            or any(bucket.get(field) is not None and (
                type(bucket[field]) is not int or not 0 < bucket[field] <= MAX_ID
            ) for field in ID_FIELDS)
            or any(bucket.get(field) is not None and (
                not isinstance(bucket[field], str) or bucket[field] not in values
            ) for field, values in ENUM_FIELDS.items())
            or (result != "attributed" and any(bucket.get(field) is not None for field in (*ID_FIELDS, *ENUM_FIELDS)))
        ):
            return None
        key = tuple(bucket.get(field) for field in DIMENSIONS)
        if key in shares:
            return None
        shares[key] = Fraction(count, mix.installations)
        total += count
        terminals += count if result in ("attributed", "organic", "unavailable") else 0
    return shares if total == mix.installations and terminals == mix.terminal_observations else None


def _acquisition_comparison(baseline, current, contract):
    before, after = _acquisition_shares(baseline), _acquisition_shares(current)
    maximum = None
    if before is not None and after is not None:
        maximum = max((abs(before.get(key, 0) - after.get(key, 0)) for key in set(before) | set(after)), default=0)
    return {
        "rule_version": RULE, "grain": "app_user_id_installation",
        "population": "primary_installation_identities_observed_in_each_window_not_new_installs",
        "status": "unverified" if maximum is None else
            "shifted" if maximum >= Fraction(str(contract.mix_shift_pp)) / 100 else "stable",
        "max_bucket_shift_pp": float(maximum * 100) if maximum is not None else None,
        "threshold_pp": contract.mix_shift_pp,
        "baseline": baseline.model_dump(mode="json"), "current": current.model_dump(mode="json"),
        "must_not_claim": ["causal_channel_lift", "new_install_mix", "spend_mix", "financial_roas"],
    }


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

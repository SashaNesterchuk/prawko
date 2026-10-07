from dataclasses import replace
from datetime import date

from prawko_analytics.compare import build_comparison
from prawko_analytics.context import build_context, day_window
from prawko_analytics.contract import Change, load_contract
from prawko_analytics.ingest import ingest_dump
from tests.support import event, write_dump


def _paywall_dump(path, day: str, exported: str, counts: dict[str, int]):
    timestamp = f"{day}T10:00:00Z"
    events = [
        event(
            "paywall_viewed",
            timestamp,
            f"usr_{day}_{version}_{index}",
            app_version=version,
        )
        for version, users in counts.items()
        for index in range(users)
    ]
    write_dump(path, day=day, exported_at=exported, events=events)


def _contexts(tmp_path, left: dict[str, int], right: dict[str, int]):
    left_path = tmp_path / "left.json"
    right_path = tmp_path / "right.json"
    _paywall_dump(left_path, "2026-09-01", "2026-09-02T01:00:00Z", left)
    _paywall_dump(right_path, "2026-09-08", "2026-09-09T01:00:00Z", right)
    warehouse = tmp_path / "warehouse"
    ingest_dump(left_path, warehouse)
    ingest_dump(right_path, warehouse)
    baseline = build_context(warehouse, day_window(date(2026, 9, 1)))
    current = build_context(warehouse, day_window(date(2026, 9, 8)))
    return baseline, current


def _paywall(report, version: str):
    matches = [
        item
        for item in report.metrics
        if item.id == "paywall_purchase_conversion"
        and item.slice.get("app_version") == version
        and item.slice.get("analytics_schema_version") == 3
    ]
    assert len(matches) == 1
    return matches[0]


def test_version_shift_prohibits_attribution(tmp_path):
    baseline, current = _contexts(
        tmp_path,
        {"1.0.28": 40, "1.0.29": 40},
        {"1.0.28": 10, "1.0.29": 70},
    )
    report = build_comparison(baseline, current, load_contract())
    comparison = _paywall(report, "1.0.29")
    assert comparison.baseline is not None and comparison.baseline.denominator == 40
    assert comparison.current is not None and comparison.current.denominator == 70
    assert comparison.baseline.eligibility.status == "allowed"
    assert comparison.current.eligibility.status == "allowed"
    assert comparison.attribution.status == "prohibited"
    assert "app_version_mix_shifted" in comparison.attribution.reasons
    assert all(item.attribution.status != "allowed" for item in report.metrics)


def test_stable_mix_stays_observational(tmp_path):
    baseline, current = _contexts(tmp_path, {"1.0.29": 40}, {"1.0.29": 40})
    report = build_comparison(baseline, current, load_contract())
    comparison = _paywall(report, "1.0.29")
    assert comparison.baseline is not None and comparison.baseline.eligibility.status == "allowed"
    assert comparison.current is not None and comparison.current.eligibility.status == "allowed"
    assert comparison.attribution.status == "limited"
    assert comparison.attribution.reasons == ["observational_window_comparison"]


def test_registered_ship_date_blocks_attribution(tmp_path):
    baseline, current = _contexts(tmp_path, {"1.0.29": 40}, {"1.0.29": 40})
    contract = replace(
        load_contract(),
        changes=(
            Change(
                id="paywall_v2",
                at=date(2026, 9, 3),
                affects_metrics=("paywall_purchase_conversion",),
            ),
        ),
    )
    report = build_comparison(baseline, current, contract)
    comparison = _paywall(report, "1.0.29")
    assert comparison.attribution.status == "prohibited"
    assert "product_change:paywall_v2" in comparison.attribution.reasons
    d7 = next(item for item in report.metrics if item.id == "d7_return")
    assert "product_change:paywall_v2" not in d7.attribution.reasons

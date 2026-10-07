from dataclasses import replace
from datetime import date

from prawko_analytics.compare import build_comparison
from prawko_analytics.context import build_context, day_window
from prawko_analytics.contract import Change, load_contract
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.models import AcquisitionMix
from tests.support import event, write_dump


def _paywall_dump(path, day: str, exported: str, counts: dict[str, int]):
    timestamp = f"{day}T10:00:00Z"
    events = [
        event(
            "paywall_viewed",
            timestamp,
            f"usr_{day}_{version}_{index}",
            app_version=version,
            paywall_view_id=f"view_{day}_{version}_{index}",
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


def _acquisition(counts, **fields):
    total = sum(counts.values())
    return AcquisitionMix(
        **{
            "status": "observed", "rule_version": "asa-installation-v1",
            "grain": "app_user_id_installation",
            "population": "primary_installation_identities_observed_in_window_not_new_installs",
            "coverage_complete": True, "installations": total, "terminal_observations": total,
            "buckets": [
                {"asa_result": "attributed", "asa_org_id": 123, "asa_campaign_id": campaign,
                 "installations": count, "share": count / total}
                for campaign, count in counts.items()
            ], **fields,
        }
    )


def test_acquisition_install_mix_shift_prohibits_attribution_with_stable_event_mix(tmp_path):
    baseline, current = _contexts(tmp_path, {"1.0.29": 40}, {"1.0.29": 40})
    baseline.acquisition_mix = _acquisition({456: 30, 789: 10})
    current.acquisition_mix = _acquisition({456: 10, 789: 30})
    report = build_comparison(baseline, current, load_contract())
    comparison = _paywall(report, "1.0.29")
    assert comparison.attribution.status == "prohibited"
    assert "acquisition_installation_mix_shifted" in comparison.attribution.reasons
    assert report.acquisition_comparison["status"] == "shifted"
    assert report.acquisition_comparison["max_bucket_shift_pp"] == 50
    assert report.acquisition_comparison["current"]["buckets"] == current.acquisition_mix.buckets


def test_unverified_acquisition_is_not_declared_stable(tmp_path):
    baseline, current = _contexts(tmp_path, {"1.0.29": 40}, {"1.0.29": 40})
    baseline.acquisition_mix = _acquisition({456: 40})
    current.acquisition_mix = _acquisition({456: 40}, coverage_complete=False)
    report = build_comparison(baseline, current, load_contract())
    assert report.acquisition_comparison["status"] == "unverified"
    assert report.acquisition_comparison["max_bucket_shift_pp"] is None
    assert _paywall(report, "1.0.29").attribution.status == "limited"


def test_malformed_acquisition_buckets_never_become_a_verified_confounder(tmp_path):
    baseline, current = _contexts(tmp_path, {"1.0.29": 40}, {"1.0.29": 40})
    baseline.acquisition_mix = _acquisition({456: 40})
    current.acquisition_mix = _acquisition(
        {456: 40}, buckets=[{"asa_result": "attributed", "asa_campaign_id": [], "installations": 40, "share": 1}],
    )
    report = build_comparison(baseline, current, load_contract())
    assert report.acquisition_comparison["status"] == "unverified"


def test_exact_ten_percentage_point_shift_is_not_lost_to_float_rounding(tmp_path):
    baseline, current = _contexts(tmp_path, {"1.0.29": 40}, {"1.0.29": 40})
    baseline.acquisition_mix = _acquisition({456: 30, 789: 30, 999: 40})
    current.acquisition_mix = _acquisition({456: 20, 789: 35, 999: 45})
    report = build_comparison(baseline, current, load_contract())
    assert report.acquisition_comparison["status"] == "shifted"
    assert report.acquisition_comparison["max_bucket_shift_pp"] == 10

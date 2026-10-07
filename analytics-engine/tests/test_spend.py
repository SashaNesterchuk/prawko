import csv
import io
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from prawko_analytics.cli import main
from prawko_analytics.context import build_context, range_window
from prawko_analytics.health import build_health
from prawko_analytics.spend import ingest_spend, ledger_path, spend_report


START = datetime(2026, 9, 12, tzinfo=timezone.utc)
END = datetime(2026, 9, 21, tzinfo=timezone.utc)
SOURCE_DIR = Path(__file__).resolve().parents[2] / "docs" / "analytics" / "apple"


def manifest(**changes):
    result = {
        "format": "apple_ads_csv_manifest_v1", "exported_at": "2026-09-22T12:00:00Z",
        "source": {"provider": "apple_ads", "source_id": "synthetic-source",
                   "account_id": 123, "app_id": 456, "verification_basis": "unverified_csv"},
        "report": {"granularity": "campaign_window", "currency": "EUR", "timezone": "UTC",
                   "date_end_basis": "inclusive_calendar_date", "window_start": START.isoformat(),
                   "window_end": END.isoformat()},
        "coverage": {"complete_scope": False, "entity_scope": "all_campaigns_for_app"},
    }
    for key, value in changes.items():
        result[key] = {**result[key], **value} if isinstance(value, dict) and key in result else value
    return result


def csv_input(path, *, rows=None, currency="EUR", start="Sep 12, 2026", end="Sep 20, 2026", keyword=False):
    text = io.StringIO()
    writer = csv.writer(text)
    if keyword:
        writer.writerow(["Campaign: Private campaign label (ID: 100)"])
    writer.writerows([[f"Start Date: {start}"], [f"End Date: {end}"], [f"Currency: {currency}"], ["Time Zone: UTC"], [""]])
    writer.writerow(["Keyword ID", "Keyword", "Ad Group ID", "Spend", "Impressions"] if keyword
                    else ["Campaign ID", "Campaign Name", "Spend", "Impressions"])
    writer.writerows(rows if rows is not None else [
        ["1", "Private campaign label", "0.10", "10"], ["2", "Other campaign", "0.20", "20"],
        ["", "", "0.30", "30"],
    ])
    path.write_text(text.getvalue(), encoding="utf-8-sig")
    return path


def ingest(tmp_path, *, csv_path=None, body=None, name="input"):
    csv_path = csv_path or csv_input(tmp_path / f"{name}.csv")
    manifest_path = tmp_path / f"{name}-manifest.json"
    manifest_path.write_text(json.dumps(body or manifest()))
    warehouse = tmp_path / "warehouse"
    return warehouse, ingest_spend(csv_path, manifest_path, warehouse)


def report(warehouse, **changes):
    return spend_report(warehouse, start=changes.pop("start", START), end=changes.pop("end", END), **changes)


def test_actual_campaign_csv_is_parsed_as_declared_old_utc_window_not_fresh_daily_money(tmp_path):
    warehouse, result = ingest(tmp_path, csv_path=SOURCE_DIR / "Apple Ads Campaigns.csv")
    observed = report(warehouse)
    assert result["input_rows"] == 4 and result["aggregate_footer_rows"] == 1
    assert observed["currencies"][0]["unconflicted_observed_spend"] == "42.84"
    assert observed["currencies"][0]["declared_scope_spend"] is None
    assert observed["status"] == "limited_source"
    assert observed["available_source_windows"] == [{
        "start": START.isoformat(), "end": END.isoformat(), "timezone": "UTC", "currency": "EUR",
    }]
    current = report(warehouse, start=datetime(2026, 10, 7, tzinfo=timezone.utc),
                     end=datetime(2026, 10, 8, tzinfo=timezone.utc))
    assert current["status"] == "no_matching_source_window"
    assert current["currencies"] == [] and current["roas"] is None


@pytest.mark.parametrize("campaign,expected", [(2144614494, "22.12"), (2144614496, "20.72")])
def test_actual_keyword_exports_have_separate_grain_and_no_keyword_text_in_ledger(tmp_path, campaign, expected):
    body = manifest(report={"granularity": "keyword_window", "campaign_id": campaign},
                    coverage={"entity_scope": "campaign_keywords"})
    warehouse, _result = ingest(tmp_path, body=body,
                                csv_path=SOURCE_DIR / f"Apple Ads Campaign {campaign} Keywords.csv")
    observed = report(warehouse, granularity="keyword_window")
    assert observed["currencies"][0]["unconflicted_observed_spend"] == expected
    assert report(warehouse)["currencies"] == []
    ledger = ledger_path(warehouse).read_text()
    assert "prawo jazdy" not in ledger and "autoškola" not in ledger
    assert "Keyword" not in ledger


def test_campaign_and_keyword_grains_cannot_be_double_counted(tmp_path):
    warehouse, _result = ingest(tmp_path)
    body = manifest(report={"granularity": "keyword_window", "campaign_id": 100},
                    coverage={"entity_scope": "campaign_keywords"})
    keyword = csv_input(tmp_path / "keyword.csv", keyword=True, rows=[["7", "private keyword", "8", "0.30", "30"]])
    ingest(tmp_path, body=body, csv_path=keyword, name="keyword")
    assert report(warehouse)["currencies"][0]["unconflicted_observed_spend"] == "0.3"
    assert report(warehouse, granularity="keyword_window")["currencies"][0]["unconflicted_observed_spend"] == "0.3"
    with pytest.raises(ValueError):
        report(warehouse, granularity="all")


def test_repeat_import_is_idempotent_and_source_footer_is_not_added_as_a_campaign(tmp_path):
    warehouse, result = ingest(tmp_path)
    _warehouse, again = ingest(tmp_path)
    assert result["input_rows"] == 2 and result["retained_rows"] == 2
    assert again["retained_rows"] == 2 and again["duplicate_import_rows"] == 2
    assert report(warehouse)["matched_source_units"] == 2
    assert len(json.loads(ledger_path(warehouse).read_text())["rows"]) == 2


def test_verified_complete_scope_must_be_on_the_same_source_observation(tmp_path):
    reviewed_partial = manifest(source={"verification_basis": "reviewed_vendor_export"})
    warehouse, _result = ingest(tmp_path, body=reviewed_partial, name="reviewed")
    complete_unreviewed = manifest(coverage={"complete_scope": True})
    ingest(tmp_path, body=complete_unreviewed, name="complete")
    observed = report(warehouse)
    assert observed["status"] == "limited_source"
    assert observed["currencies"][0]["declared_scope_spend"] is None
    assert observed["quality"]["no_reviewed_complete_source_units"] == 2
    assert observed["source_authentication"] == "manifest_assertion_not_verified_by_parser"


def test_reviewed_complete_manifest_allows_only_declared_whole_source_scope(tmp_path):
    body = manifest(source={"verification_basis": "reviewed_vendor_export"}, coverage={"complete_scope": True})
    warehouse, _result = ingest(tmp_path, body=body)
    observed = report(warehouse)
    assert observed["status"] == "observed_declared_scope"
    assert observed["currencies"][0]["declared_scope_spend"] == "0.3"
    assert observed["requested_window_coverage"] == "not_verified"
    assert observed["financial_reconciliation"] == "not_joined" and observed["roas"] is None


def test_decimal_amounts_and_precision_are_exact_not_binary_float_or_default_decimal_rounding(tmp_path):
    large = "999999999999999999.123456789012"
    source = csv_input(tmp_path / "large.csv", rows=[
        ["1", "", large, "1"], ["2", "", "0.000000000001", "1"],
    ])
    warehouse, _result = ingest(tmp_path, csv_path=source)
    amount = report(warehouse)["currencies"][0]["unconflicted_observed_spend"]
    assert amount == "999999999999999999.123456789013"
    assert Decimal(amount) == Decimal("999999999999999999.123456789013")


def test_equal_decimal_representations_and_metadata_redelivery_do_not_create_conflicts(tmp_path):
    warehouse, _result = ingest(tmp_path)
    body = manifest(exported_at="2026-09-23T12:00:00Z")
    source = csv_input(tmp_path / "redelivery.csv", rows=[["1", "", "0.100", "10"], ["2", "", "0.200", "20"]])
    ingest(tmp_path, body=body, csv_path=source, name="again")
    observed = report(warehouse)
    assert observed["quality"]["duplicate_source_observations"] == 2
    assert observed["currencies"][0]["unconflicted_observed_spend"] == "0.3"
    assert not observed["quality"].get("conflicting_source_units")


def test_conflicting_same_scope_money_is_retained_not_last_write_wins(tmp_path):
    warehouse, _result = ingest(tmp_path)
    source = csv_input(tmp_path / "conflict.csv", rows=[["1", "", "0.50", "10"]])
    ingest(tmp_path, csv_path=source, name="conflict")
    observed = report(warehouse)
    assert observed["quality"]["conflicting_source_units"] == 1
    assert observed["currencies"][0]["unconflicted_observed_spend"] == "0.2"
    assert observed["currencies"][0]["declared_scope_spend"] is None
    assert len(json.loads(ledger_path(warehouse).read_text())["rows"]) == 3


def test_overlapping_aggregate_windows_are_not_prorated_or_summed(tmp_path):
    warehouse, _result = ingest(tmp_path)
    source = csv_input(tmp_path / "overlap.csv", start="Sep 15, 2026", end="Sep 23, 2026",
                       rows=[["1", "", "1.00", "10"]])
    body = manifest(exported_at="2026-09-25T12:00:00Z",
                    report={"window_start": "2026-09-15T00:00:00Z", "window_end": "2026-09-24T00:00:00Z"})
    ingest(tmp_path, csv_path=source, body=body, name="overlap")
    observed = report(warehouse, end=datetime(2026, 9, 25, tzinfo=timezone.utc))
    assert observed["quality"]["overlapping_aggregate_units"] == 2
    assert observed["currencies"][0]["unconflicted_observed_spend"] == "0.2"
    assert observed["currencies"][0]["declared_scope_spend"] is None


def test_same_dates_warsaw_do_not_cover_same_dates_utc_and_partial_boundaries_are_not_allocated(tmp_path):
    warehouse, _result = ingest(tmp_path)
    window = range_window("spend", date(2026, 9, 12), date(2026, 9, 21))
    observed = spend_report(warehouse, start=window.start, end=window.end)
    assert observed["quality"]["partial_window_units_not_allocated"] == 2
    assert observed["currencies"][0]["unconflicted_observed_spend"] is None
    assert observed["currencies"][0]["declared_scope_spend"] is None


def test_currencies_and_accounts_are_not_fx_converted_or_cross_joined(tmp_path):
    warehouse, _result = ingest(tmp_path)
    source = csv_input(tmp_path / "usd.csv", currency="USD", rows=[["1", "", "2.00", "10"]])
    body = manifest(source={"account_id": 999}, report={"currency": "USD"})
    ingest(tmp_path, csv_path=source, body=body, name="usd")
    observed = report(warehouse)
    assert [(row["currency"], row["unconflicted_observed_spend"]) for row in observed["currencies"]] == [
        ("EUR", "0.3"), ("USD", "2"),
    ]


def test_same_account_scope_changed_currency_is_a_conflict_not_two_expenses(tmp_path):
    warehouse, _result = ingest(tmp_path)
    source = csv_input(tmp_path / "usd.csv", currency="USD", rows=[["1", "", "0.20", "10"]])
    ingest(tmp_path, csv_path=source, body=manifest(report={"currency": "USD"}), name="usd")
    observed = report(warehouse)
    assert observed["quality"]["conflicting_source_units"] == 1
    assert all(row["declared_scope_spend"] is None for row in observed["currencies"])


def test_account_app_namespaces_are_kept_separate_and_can_be_selected(tmp_path):
    warehouse, _result = ingest(tmp_path)
    source = csv_input(tmp_path / "other-app.csv", rows=[["1", "", "5", "10"]])
    ingest(tmp_path, csv_path=source, body=manifest(source={"app_id": 999}), name="other-app")
    observed = report(warehouse)
    assert [(row["app_id"], row["unconflicted_observed_spend"]) for row in observed["currencies"]] == [
        (456, "0.3"), (999, "5"),
    ]
    assert report(warehouse, app_id=456)["currencies"][0]["unconflicted_observed_spend"] == "0.3"
    assert report(warehouse, account_id=999)["status"] == "no_matching_source_window"


def test_partial_other_window_does_not_erase_exact_source_evidence_but_stays_unallocated(tmp_path):
    warehouse, _result = ingest(tmp_path)
    source = csv_input(tmp_path / "overlap.csv", start="Sep 15, 2026", end="Sep 23, 2026",
                       rows=[["1", "", "1", "10"]])
    body = manifest(exported_at="2026-09-25T12:00:00Z",
                    report={"window_start": "2026-09-15T00:00:00Z", "window_end": "2026-09-24T00:00:00Z"})
    ingest(tmp_path, csv_path=source, body=body, name="overlap")
    observed = report(warehouse)
    assert observed["quality"]["partial_window_units_not_allocated"] == 1
    assert not observed["quality"].get("overlapping_aggregate_units")
    assert observed["currencies"][0]["unconflicted_observed_spend"] == "0.3"
    assert observed["currencies"][0]["declared_scope_spend"] is None


def test_exact_zero_source_amounts_are_observations_not_missing_money(tmp_path):
    source = csv_input(tmp_path / "zero.csv", rows=[["1", "", "0.00", "0"]])
    warehouse, _result = ingest(tmp_path, csv_path=source)
    assert report(warehouse)["currencies"][0]["unconflicted_observed_spend"] == "0"
    assert report(warehouse)["currencies"][0]["declared_scope_spend"] is None


def test_as_of_filters_source_exports_not_source_period_or_current_clock(tmp_path):
    warehouse, _result = ingest(tmp_path)
    observed = report(warehouse, as_of=datetime(2026, 9, 21, tzinfo=timezone.utc))
    assert observed["status"] == "no_matching_source_window" and observed["currencies"] == []
    assert report(warehouse)["as_of"] == "2026-09-22T12:00:00+00:00"


@pytest.mark.parametrize("changes", [
    {"format": "other"}, {"exported_at": "2026-09-22T12:00:00"},
    {"source": {"account_id": True}}, {"source": {"app_id": 2 ** 53}},
    {"source": {"source_id": "private@example.com"}}, {"source": {"verification_basis": ["approved"]}},
    {"report": {"timezone": "Unknown/Zone"}}, {"report": {"currency": "USD"}},
    {"report": {"date_end_basis": None}}, {"report": {"window_end": "2026-09-20T00:00:00Z"}},
    {"report": {"granularity": "campaign_day"}}, {"coverage": {"complete_scope": "true"}},
    {"coverage": {"entity_scope": ["all_campaigns_for_app"]}},
    {"coverage": {"complete_scope": True}, "exported_at": "2026-09-20T12:00:00Z"},
])
def test_invalid_manifest_rejects_before_mutating_existing_ledger(tmp_path, changes):
    warehouse, _result = ingest(tmp_path)
    before = ledger_path(warehouse).read_bytes()
    body = manifest()
    for key, value in changes.items():
        body[key] = {**body[key], **value} if isinstance(value, dict) and key in body else value
    with pytest.raises(ValueError):
        ingest(tmp_path, body=body, name="bad")
    assert ledger_path(warehouse).read_bytes() == before


@pytest.mark.parametrize("value", ["NaN", "-1", "1,00", "1e3", "", "Infinity"])
def test_invalid_money_is_not_zero_or_rounded_into_an_expense(tmp_path, value):
    source = csv_input(tmp_path / "bad.csv", rows=[["1", "", value, "1"]])
    with pytest.raises(ValueError):
        ingest(tmp_path, csv_path=source)
    assert not ledger_path(tmp_path / "warehouse").exists()


def test_bad_footer_missing_scope_and_admob_earnings_are_not_valid_spend_inputs(tmp_path):
    source = csv_input(tmp_path / "bad-footer.csv", rows=[["1", "", "1", "1"], ["", "", "2", "1"]])
    with pytest.raises(ValueError, match="footer"):
        ingest(tmp_path, csv_path=source)
    with pytest.raises(ValueError):
        ingest(tmp_path, csv_path=SOURCE_DIR / "admob-report.csv")
    source = csv_input(tmp_path / "empty.csv", rows=[["", "", "0", "0"]])
    with pytest.raises(ValueError, match="without scoped"):
        ingest(tmp_path, csv_path=source)


def test_failed_atomic_replacement_preserves_existing_source_ledger(tmp_path, monkeypatch):
    warehouse, _result = ingest(tmp_path)
    before = ledger_path(warehouse).read_bytes()

    def fail_replace(_self, _target):
        raise OSError("simulated local replacement failure")

    monkeypatch.setattr(Path, "replace", fail_replace)
    with pytest.raises(OSError):
        ingest(tmp_path, name="new-export", body=manifest(exported_at="2026-09-23T12:00:00Z"))
    assert ledger_path(warehouse).read_bytes() == before


def test_missing_source_is_unknown_not_zero_and_source_does_not_fill_revenuecat_or_acquisition(tmp_path):
    assert report(tmp_path)["status"] == "not_loaded"
    assert report(tmp_path)["currencies"] == []
    warehouse, _result = ingest(tmp_path)
    window = range_window("spend", date(2026, 9, 12), date(2026, 9, 22))
    context = build_context(warehouse, window)
    assert context.spend["currencies"][0]["unconflicted_observed_spend"] == "0.3"
    assert context.financial["status"] == "not_loaded"
    assert context.acquisition_mix.status == "unavailable"
    health = build_health([], window_start=window.start, window_end=window.end, spend=context.spend)
    assert health.monetization["spend"] == context.spend
    assert health.monetization["revenuecat"] == "not_loaded"


def test_cli_import_and_timezone_report_use_same_source_contract(tmp_path, capsys):
    source = csv_input(tmp_path / "source.csv")
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest()))
    warehouse = tmp_path / "warehouse"
    main(["ingest-spend", str(source), "--manifest", str(path), "--warehouse", str(warehouse)])
    assert json.loads(capsys.readouterr().out)["retained_rows"] == 2
    out = tmp_path / "report.json"
    main(["spend", "--start", "2026-09-12", "--end", "2026-09-21", "--timezone", "UTC",
          "--warehouse", str(warehouse), "--out", str(out)])
    assert json.loads(out.read_text()) == report(warehouse)
    with pytest.raises(SystemExit):
        main(["spend", "--start", "2026-09-12", "--end", "2026-09-21", "--timezone", "bad-zone"])

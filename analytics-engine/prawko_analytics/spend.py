"""Declared Apple Ads CSV observations, never invoices or settled revenue."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import tempfile
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, localcontext
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from prawko_analytics.identity import safe_identity_id


FORMAT = "apple_ads_csv_manifest_v1"
GRAINS = {"campaign_window", "keyword_window"}
COUNTS = {
    "impressions": "Impressions", "taps": "Taps", "installs_total": "Installs (Total)",
    "new_downloads_total": "New Downloads (Total)", "redownloads_total": "Redownloads (Total)",
    "installs_tap_through": "Installs (Tap-Through)", "installs_view_through": "Installs (View-Through)",
}
MONTHS = {name: index for index, name in enumerate(
    ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1,
)}


def ledger_path(warehouse: Path) -> Path:
    return warehouse / "spend" / "apple_ads" / "observations.json"


def _time(value):
    if not isinstance(value, str):
        raise ValueError("Spend source clocks must be timezone-aware ISO strings.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed.astimezone(timezone.utc)
    except ValueError as error:
        raise ValueError("Spend source clocks must be timezone-aware ISO strings.") from error


def _id(value):
    if isinstance(value, str) and re.fullmatch(r"[1-9][0-9]{0,15}", value):
        value = int(value)
    if type(value) is not int or not 0 < value <= 2 ** 53 - 1:
        raise ValueError("Apple Ads scope IDs must be positive safe integers.")
    return value


def _amount(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,18}(?:\.[0-9]{1,12})?", value):
        raise ValueError("Spend must be a nonnegative decimal string without locale/FX inference.")
    return Decimal(value)


def _count(value):
    if value in (None, "", "N/A"):
        return None
    if not re.fullmatch(r"[0-9]{1,18}", value):
        raise ValueError("Spend report counts must be nonnegative integers or explicitly unavailable.")
    return int(value)


def _date_label(value):
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return date.fromisoformat(value)
        match = re.fullmatch(r"([A-Za-z]{3}) ([0-9]{1,2}), ([0-9]{4})", value)
        if match:
            return date(int(match[3]), MONTHS[match[1]], int(match[2]))
    except (KeyError, ValueError):
        pass
    raise ValueError("Unsupported source report date label.")


def _hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _key(row):
    return (
        row["account_id"], row["app_id"], row["granularity"], row["window_start"], row["window_end"],
        row["campaign_id"], row["ad_group_id"], row["keyword_id"],
    )


def _body(row):
    return _hash({
        key: row[key] for key in ("currency", "spend", "source_timezone", *COUNTS)
    })


def _add(left, right):
    # The parser bounds each amount to 30 digits; warehouse-sized sums stay exact.
    with localcontext() as context:
        context.prec = 64
        return left + right


def _parse(csv_path: Path, manifest: dict) -> tuple[list[dict], dict]:
    if not isinstance(manifest, dict) or manifest.get("format") != FORMAT:
        raise ValueError(f"Spend input requires {FORMAT}.")
    source, report = manifest.get("source"), manifest.get("report")
    if not isinstance(source, dict) or not isinstance(report, dict):
        raise ValueError("Spend input requires explicit source and report scope.")
    source_id = safe_identity_id(source.get("source_id"))
    if source.get("provider") != "apple_ads" or not source_id:
        raise ValueError("Spend input requires a bounded Apple Ads source_id.")
    verification = source.get("verification_basis")
    if not isinstance(verification, str) or verification not in {"unverified_csv", "reviewed_vendor_export"}:
        raise ValueError("Spend verification basis must be explicitly supplied, not inferred from CSV headers.")
    account, app = _id(source.get("account_id")), _id(source.get("app_id"))
    grain = report.get("granularity")
    if not isinstance(grain, str) or grain not in GRAINS:
        raise ValueError("Only campaign_window and keyword_window source aggregates are supported.")
    if not isinstance(report.get("date_end_basis"), str) or report["date_end_basis"] not in {"inclusive_calendar_date", "exclusive_calendar_date"}:
        raise ValueError("Source end-date semantics require an explicit manifest declaration.")
    currency, zone_name = report.get("currency"), report.get("timezone")
    if not isinstance(currency, str) or not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("Spend source requires an explicit three-letter currency.")
    try:
        zone = ZoneInfo(zone_name)
    except (TypeError, ValueError, ZoneInfoNotFoundError) as error:
        raise ValueError("Spend source requires a known explicit report timezone.") from error
    exported = _time(manifest.get("exported_at"))
    start, end = _time(report.get("window_start")), _time(report.get("window_end"))
    if not start < end or start > exported:
        raise ValueError("Spend source window and export clocks are inconsistent.")
    coverage = manifest.get("coverage")
    if not isinstance(coverage, dict) or type(coverage.get("complete_scope")) is not bool:
        raise ValueError("Spend scope completeness must be explicitly declared.")
    expected_scopes = {"all_campaigns_for_app", "filtered_campaigns"} if grain == "campaign_window" else {"campaign_keywords"}
    if not isinstance(coverage.get("entity_scope"), str) or coverage["entity_scope"] not in expected_scopes:
        raise ValueError("Spend entity scope must match its granularity.")
    if coverage["complete_scope"] and exported < end:
        raise ValueError("A complete spend window cannot end after its declared export time.")
    raw = csv_path.read_bytes()
    try:
        lines = list(csv.reader(io.StringIO(raw.decode("utf-8-sig")), strict=True))
    except (UnicodeError, csv.Error) as error:
        raise ValueError("Apple Ads inputs must be UTF-8 CSV, not AdMob earnings or an inferred format.") from error
    id_column = "Campaign ID" if grain == "campaign_window" else "Keyword ID"
    header_index = next((index for index, row in enumerate(lines) if row and row[0] == id_column), None)
    if header_index is None:
        raise ValueError("CSV entity header does not match manifest granularity.")
    header = lines[header_index]
    if len(set(header)) != len(header) or "Spend" not in header or "Date" in header:
        raise ValueError("Ambiguous/custom/daily CSV requires a separately defined source adapter.")
    preamble = {}
    campaign = None
    for row in lines[:header_index]:
        text = ",".join(row).strip()
        for label in ("Start Date", "End Date", "Currency", "Time Zone"):
            if text.startswith(label + ":"):
                if label in preamble:
                    raise ValueError("Repeated source metadata is ambiguous.")
                preamble[label] = text.split(":", 1)[1].strip()
        if text.startswith("Campaign:"):
            match = re.search(r"\(ID: ([0-9]+)\)$", text)
            if not match or campaign is not None:
                raise ValueError("Keyword source campaign scope is ambiguous.")
            campaign = _id(match[1])
    if preamble.get("Currency") != currency or preamble.get("Time Zone") != zone_name:
        raise ValueError("CSV currency/timezone must exactly match the source manifest.")
    source_start = datetime.combine(_date_label(preamble.get("Start Date", "")), time.min, tzinfo=zone)
    end_day = _date_label(preamble.get("End Date", ""))
    if report["date_end_basis"] == "inclusive_calendar_date":
        end_day += timedelta(days=1)
    source_end = datetime.combine(end_day, time.min, tzinfo=zone)
    if source_start != start or source_end != end:
        raise ValueError("CSV report labels do not match the declared absolute source window.")
    if grain == "keyword_window" and (campaign is None or _id(report.get("campaign_id")) != campaign):
        raise ValueError("Keyword import requires the same explicit campaign ID as the CSV preamble.")
    rows, totals = [], []
    for values in lines[header_index + 1:]:
        if not values or not any(value.strip() for value in values):
            continue
        if len(values) != len(header):
            raise ValueError("Spend CSV row width does not match its header.")
        fields = dict(zip(header, values, strict=True))
        spend = _amount(fields["Spend"])
        if not fields[id_column]:
            if fields.get("Keyword") or fields.get("Ad Group ID") or fields.get("Campaign Name"):
                raise ValueError("An unscoped entity row is not silently treated as an aggregate footer.")
            totals.append(spend)
            continue
        entity = _id(fields[id_column])
        row = {
            "source_id": source_id, "account_id": account, "app_id": app,
            "verification_basis": verification, "complete_scope": coverage["complete_scope"],
            "entity_scope": coverage["entity_scope"], "exported_at": exported.isoformat(),
            "source_timezone": zone_name, "window_start": start.isoformat(), "window_end": end.isoformat(),
            "currency": currency, "granularity": grain,
            "spend": format(spend, "f").rstrip("0").rstrip(".") if "." in format(spend, "f") else format(spend, "f"),
            "campaign_id": entity if grain == "campaign_window" else campaign,
            "ad_group_id": _id(fields.get("Ad Group ID")) if grain == "keyword_window" else None,
            "keyword_id": entity if grain == "keyword_window" else None,
            **{name: _count(fields.get(column)) for name, column in COUNTS.items()},
        }
        rows.append(row)
    unique = {(_key(row), _body(row)): row for row in rows}
    entity_total = Decimal(0)
    for row in unique.values():
        entity_total = _add(entity_total, _amount(row["spend"]))
    if totals and (len(totals) != 1 or totals[0] != entity_total):
        raise ValueError("CSV aggregate footer does not reconcile with its canonical entity spend.")
    if not rows:
        raise ValueError("A CSV without scoped entity rows is not silently certified as zero spend.")
    archive_id = _hash({"csv_sha256": hashlib.sha256(raw).hexdigest(), "manifest": manifest})
    for row in rows:
        row["archive_id"] = archive_id
    return rows, {"archive_id": archive_id, "granularity": grain, "input_rows": len(rows),
                  "aggregate_footer_rows": len(totals)}


def ingest_spend(csv_path: Path, manifest_path: Path, warehouse: Path) -> dict:
    rows, diagnostic = _parse(csv_path, json.loads(manifest_path.read_text()))
    path = ledger_path(warehouse)
    previous = json.loads(path.read_text()) if path.is_file() else {"format": "apple_ads_spend_ledger_v1", "rows": []}
    seen, merged = set(), []
    for row in previous["rows"] + rows:
        fingerprint = _hash(row)
        if fingerprint not in seen:
            merged.append(row)
        seen.add(fingerprint)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=path.parent) as directory:
        temporary = Path(directory) / "observations.json"
        temporary.write_text(json.dumps({"format": "apple_ads_spend_ledger_v1", "rows": merged}, indent=2) + "\n")
        temporary.replace(path)
    return {**diagnostic, "retained_rows": len(merged),
            "duplicate_import_rows": len(previous["rows"]) + len(rows) - len(merged),
            "source_authentication": "manifest_assertion_not_verified_by_parser"}


def spend_report(
    warehouse: Path, *, start: datetime, end: datetime, granularity="campaign_window", as_of=None,
    account_id=None, app_id=None, campaign_id=None,
) -> dict:
    if start.tzinfo is None or end.tzinfo is None or not start < end:
        raise ValueError("Spend report requires ordered timezone-aware bounds.")
    if not isinstance(granularity, str) or granularity not in GRAINS:
        raise ValueError("Select one spend granularity; campaign and keyword aggregates cannot be summed together.")
    if as_of is not None and (not isinstance(as_of, datetime) or as_of.tzinfo is None):
        raise ValueError("Spend as_of must be timezone-aware.")
    account_id = _id(account_id) if account_id is not None else None
    app_id = _id(app_id) if app_id is not None else None
    campaign_id = _id(campaign_id) if campaign_id is not None else None
    report = {
        "rule_version": "apple-ads-spend-v1", "status": "not_loaded", "granularity": granularity,
        "time_basis": "whole_source_report_windows", "currencies": [], "quality": {},
        "source_authentication": "manifest_assertion_not_verified_by_parser",
        "requested_window_coverage": "not_verified",
        "selected_scope": {"account_id": account_id, "app_id": app_id, "campaign_id": campaign_id},
        "financial_reconciliation": "not_joined", "roas": None,
        "must_not_be_interpreted_as": [
            "current_spend_without_current_source", "daily_allocation_of_aggregate", "settled_invoice",
            "revenuecat_revenue", "admob_earnings", "verified_roas", "causal_channel_lift",
        ],
    }
    path = ledger_path(warehouse)
    if not path.is_file():
        return report
    loaded = json.loads(path.read_text())["rows"]
    rows = [row for row in loaded if row["granularity"] == granularity
            and (as_of is None or _time(row["exported_at"]) <= as_of)
            and (account_id is None or row["account_id"] == account_id)
            and (app_id is None or row["app_id"] == app_id)]
    rows = [row for row in rows if campaign_id is None or row["campaign_id"] == campaign_id]
    report["available_account_app_scopes"] = [
        {"account_id": account, "app_id": app} for account, app in sorted({
            (row["account_id"], row["app_id"]) for row in rows
        })
    ]
    report["available_source_windows"] = [
        dict(zip(("start", "end", "timezone", "currency"), key))
        for key in sorted({(row["window_start"], row["window_end"], row["source_timezone"], row["currency"]) for row in rows})
    ]
    report["as_of"] = as_of.isoformat() if as_of else max((row["exported_at"] for row in rows), default=None)
    quality = Counter()
    groups = defaultdict(list)
    for row in rows:
        groups[_key(row)].append(row)
    conflicts = {key for key, items in groups.items() if len({_body(row) for row in items}) != 1}
    # Aggregate windows are indivisible; overlap is not allocated or double-counted.
    by_entity = defaultdict(list)
    for key, items in groups.items():
        row = items[0]
        if not start <= _time(row["window_start"]) or not _time(row["window_end"]) <= end:
            continue
        by_entity[(row["account_id"], row["app_id"], row["campaign_id"], row["ad_group_id"], row["keyword_id"])].append(key)
    overlapping = set()
    for keys in by_entity.values():
        longest = None
        for key in sorted(keys, key=lambda item: (_time(item[3]), _time(item[4]))):
            if longest is not None and _time(key[3]) < _time(longest[4]):
                overlapping.update((longest, key))
            if longest is None or _time(key[4]) > _time(longest[4]):
                longest = key
    currencies = defaultdict(lambda: {"amount": Decimal(0), "units": 0, "restricted": False})
    matched_units = 0
    for key, items in groups.items():
        row = items[0]
        source_start, source_end = _time(row["window_start"]), _time(row["window_end"])
        if not source_start < end or not start < source_end:
            continue
        matched_units += 1
        quality["duplicate_source_observations"] += len(items) - 1 if key not in conflicts else 0
        if not start <= source_start or not source_end <= end:
            quality["partial_window_units_not_allocated"] += 1
            for item in items:
                currencies[(item["account_id"], item["app_id"], item["currency"])]["restricted"] = True
            continue
        if key in conflicts or key in overlapping:
            quality["conflicting_source_units" if key in conflicts else "overlapping_aggregate_units"] += 1
            for item in items:
                currencies[(item["account_id"], item["app_id"], item["currency"])]["restricted"] = True
            continue
        amount = currencies[(row["account_id"], row["app_id"], row["currency"])]
        amount["amount"] = _add(amount["amount"], _amount(row["spend"]))
        amount["units"] += 1
        reviewed = any(item["verification_basis"] == "reviewed_vendor_export" for item in items)
        complete = any(item["complete_scope"] for item in items)
        reviewed_complete = any(item["verification_basis"] == "reviewed_vendor_export" and item["complete_scope"] for item in items)
        if not reviewed_complete:
            amount["restricted"] = True
            quality["no_reviewed_complete_source_units"] += 1
            quality["unreviewed_source_units"] += not reviewed
            quality["incomplete_scope_units"] += not complete
    issue_count = sum(quality[key] for key in (
        "conflicting_source_units", "overlapping_aggregate_units", "partial_window_units_not_allocated",
        "no_reviewed_complete_source_units",
    ))
    report.update({
        "status": "no_matching_source_window" if not matched_units else "limited_source" if issue_count else "observed_declared_scope",
        "matched_source_units": matched_units, "quality": dict(quality), "quality_issue_count": issue_count,
        "currencies": [
            {"account_id": account, "app_id": app, "currency": currency,
             "unconflicted_observed_spend": format(value["amount"], "f") if value["units"] else None,
             "declared_scope_spend": format(value["amount"], "f") if value["units"] and not value["restricted"] else None,
             "source_units": value["units"], "scope_is": "manifest_declared_not_verified_account_lifetime"}
            for (account, app, currency), value in sorted(currencies.items())
        ],
    })
    return report


def exact_campaign_spend_report(warehouse, *, start, end, account_id, app_id, campaign_id, as_of=None):
    """One indivisible campaign window, not a complete install cohort or ROAS."""
    report = spend_report(
        warehouse, start=start, end=end, account_id=account_id, app_id=app_id,
        campaign_id=campaign_id, as_of=as_of,
    )
    exact = bool(report.get("available_source_windows")) and all(
        _time(window["start"]) == start and _time(window["end"]) == end
        for window in report.get("available_source_windows", [])
        if _time(window["start"]) < end and start < _time(window["end"])
    ) and any(
        _time(window["start"]) == start and _time(window["end"]) == end
        for window in report.get("available_source_windows", [])
    )
    report["exact_campaign_window"] = exact and report["status"] == "observed_declared_scope"
    if not report["exact_campaign_window"]:
        for currency in report["currencies"]:
            currency["declared_scope_spend"] = None
    return report

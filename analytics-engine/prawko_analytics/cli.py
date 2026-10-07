"""Command line for ingest, context, and comparison."""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from prawko_analytics.compare import build_comparison
from prawko_analytics.context import build_context, day_window, load_quality_observations, range_window
from prawko_analytics.contract import load_contract
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.models import ValidatedContext
from prawko_analytics.paths import DEFAULT_WAREHOUSE
from prawko_analytics.revenuecat import financial_report, ingest_revenuecat
from prawko_analytics.identity import identity_link_report
from prawko_analytics.spend import ingest_spend, spend_report
from prawko_analytics.acquisition import warehouse_acquisition_report
from prawko_analytics.acquisition_mapping import ingest_acquisition_mapping
from prawko_analytics.acquisition_finance import financial_cohort_report
from prawko_analytics.billing_learning import warehouse_billing_learning_report
from prawko_analytics.billing_mapping import ingest_billing_mapping
from prawko_analytics.onboarding import warehouse_onboarding_report
from prawko_analytics.paywall_observations import warehouse_paywall_report


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="prawko-analytics")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest = subparsers.add_parser("ingest", help="Write a PostHog dump into day partitions")
    ingest.add_argument("dump", type=Path)
    ingest.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)

    revenuecat = subparsers.add_parser("ingest-revenuecat", help="Merge an offline RevenueCat webhook archive")
    revenuecat.add_argument("archive", type=Path)
    revenuecat.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)

    finance = subparsers.add_parser("finance", help="Report RevenueCat lifecycle and scoped transaction reconciliation")
    finance.add_argument("--start", type=date.fromisoformat, required=True)
    finance.add_argument("--end", type=date.fromisoformat, required=True, help="Exclusive Warsaw date")
    finance.add_argument("--as-of", type=_as_of)
    finance.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    finance.add_argument("--out", type=Path)

    identity_links = subparsers.add_parser("identity-links", help="Inspect observed install/account links without merging people")
    identity_links.add_argument("--start", type=date.fromisoformat, required=True)
    identity_links.add_argument("--end", type=date.fromisoformat, required=True, help="Exclusive Warsaw date")
    identity_links.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    identity_links.add_argument("--out", type=Path)

    quality = subparsers.add_parser("data-quality", help="Inspect cross-partition event/business integrity and observed receipt lag")
    quality.add_argument("--day", type=date.fromisoformat)
    quality.add_argument("--start", type=date.fromisoformat)
    quality.add_argument("--end", type=date.fromisoformat, help="Exclusive Warsaw date")
    quality.add_argument("--kind", default="quality")
    quality.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    quality.add_argument("--out", type=Path)

    paywall = subparsers.add_parser("paywall-observations", help="Inspect scoped eligibility and origin snapshots, not exposure or money")
    paywall.add_argument("--day", type=date.fromisoformat)
    paywall.add_argument("--start", type=date.fromisoformat)
    paywall.add_argument("--end", type=date.fromisoformat, help="Exclusive Warsaw date")
    paywall.add_argument("--kind", default="paywall-observations")
    paywall.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    paywall.add_argument("--out", type=Path)

    spend_import = subparsers.add_parser("ingest-spend", help="Merge declared Apple Ads CSV observations with an explicit source manifest")
    spend_import.add_argument("csv", type=Path)
    spend_import.add_argument("--manifest", type=Path, required=True)
    spend_import.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)

    spend = subparsers.add_parser("spend", help="Report whole-window Apple Ads aggregates without allocation or FX")
    spend.add_argument("--start", type=date.fromisoformat, required=True)
    spend.add_argument("--end", type=date.fromisoformat, required=True, help="Exclusive date in --timezone")
    spend.add_argument("--timezone", type=_zone, default=ZoneInfo("Europe/Warsaw"))
    spend.add_argument("--granularity", choices=("campaign_window", "keyword_window"), default="campaign_window")
    spend.add_argument("--as-of", type=_as_of)
    spend.add_argument("--account-id", type=int)
    spend.add_argument("--app-id", type=int)
    spend.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    spend.add_argument("--out", type=Path)

    acquisition = subparsers.add_parser("acquisition", help="Report ASA install observations and first-observed learning/client cohorts")
    acquisition.add_argument("--start", type=date.fromisoformat, required=True)
    acquisition.add_argument("--end", type=date.fromisoformat, required=True, help="Exclusive Warsaw cohort date")
    acquisition.add_argument("--observe-through", type=_as_of, help="Exclusive event-time horizon, not a historical delivery as-of")
    acquisition.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    acquisition.add_argument("--out", type=Path)

    mapping = subparsers.add_parser("ingest-acquisition-mapping", help="Retain explicit reviewed/unreviewed app-scope declarations")
    mapping.add_argument("manifest", type=Path)
    mapping.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)

    cohort_finance = subparsers.add_parser("acquisition-finance", help="Report first-observed D7/D30 source-gross cohorts, not proceeds or ROAS")
    cohort_finance.add_argument("--start", type=date.fromisoformat, required=True)
    cohort_finance.add_argument("--end", type=date.fromisoformat, required=True, help="Exclusive Warsaw cohort date")
    cohort_finance.add_argument("--observe-through", type=_as_of, help="Exclusive PostHog/financial event-time observation horizon")
    cohort_finance.add_argument("--as-of", type=_as_of, help="RevenueCat/spend export and mapping-declaration cutoff")
    cohort_finance.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    cohort_finance.add_argument("--out", type=Path)

    billing_mapping = subparsers.add_parser("ingest-billing-mapping", help="Retain explicit native/RevenueCat billing mappings")
    billing_mapping.add_argument("manifest", type=Path)
    billing_mapping.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)

    billing_learning = subparsers.add_parser("billing-learning", help="Report observed trial/paid-start learning, not current entitlement")
    billing_learning.add_argument("--start", type=date.fromisoformat, required=True)
    billing_learning.add_argument("--end", type=date.fromisoformat, required=True, help="Exclusive Warsaw billing-start date")
    billing_learning.add_argument("--observe-through", type=_as_of)
    billing_learning.add_argument("--as-of", type=_as_of)
    billing_learning.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    billing_learning.add_argument("--out", type=Path)

    onboarding = subparsers.add_parser("onboarding", help="Report persistent onboarding and first-observed activation cohorts")
    onboarding.add_argument("--start", type=date.fromisoformat, required=True)
    onboarding.add_argument("--end", type=date.fromisoformat, required=True, help="Exclusive Warsaw root-selection date")
    onboarding.add_argument("--observe-through", type=_as_of, help="Exclusive client event-time horizon, not delivery-as-of")
    onboarding.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    onboarding.add_argument("--out", type=Path)

    context = subparsers.add_parser("context", help="Build a validated analysis context")
    context.add_argument("--day", type=date.fromisoformat)
    context.add_argument("--start", type=date.fromisoformat)
    context.add_argument("--end", type=date.fromisoformat, help="Exclusive Warsaw date")
    context.add_argument("--kind", default="trailing_days")
    context.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)
    context.add_argument("--out", type=Path)

    compare = subparsers.add_parser("compare", help="Compare two context JSON files")
    compare.add_argument("--baseline", type=Path, required=True)
    compare.add_argument("--current", type=Path, required=True)
    compare.add_argument("--out", type=Path)

    args = parser.parse_args(argv)
    if args.command == "ingest":
        written = ingest_dump(args.dump, args.warehouse)
        for partition in written:
            flag = "complete" if partition.complete else "partial"
            print(f"{partition.day.isoformat()} {partition.event_rows} {flag} {partition.path}")
        return
    if args.command == "context":
        window = _window(args)
        result = build_context(args.warehouse, window)
        _emit(result.model_dump(mode="json", exclude_none=True), args.out)
        return
    if args.command == "ingest-revenuecat":
        _emit(ingest_revenuecat(args.archive, args.warehouse), None)
        return
    if args.command == "finance":
        from prawko_analytics.context import load_prepared_rows

        window = range_window("finance", args.start, args.end)
        rows = load_prepared_rows(args.warehouse, window)
        _emit(financial_report(
            args.warehouse, start=window.start, end=window.end, client_rows=rows, as_of=args.as_of,
        ), args.out)
        return
    if args.command == "identity-links":
        window = range_window("identity", args.start, args.end)
        _emit(identity_link_report(args.warehouse, start=window.start, end=window.end), args.out)
        return
    if args.command == "data-quality":
        _rows, report = load_quality_observations(args.warehouse, _window(args))
        _emit(report, args.out)
        return
    if args.command == "paywall-observations":
        window = _window(args)
        _emit(warehouse_paywall_report(args.warehouse, start=window.start, end=window.end), args.out)
        return
    if args.command == "ingest-spend":
        _emit(ingest_spend(args.csv, args.manifest, args.warehouse), None)
        return
    if args.command == "spend":
        _emit(spend_report(
            args.warehouse, start=datetime.combine(args.start, time.min, tzinfo=args.timezone),
            end=datetime.combine(args.end, time.min, tzinfo=args.timezone),
            granularity=args.granularity, as_of=args.as_of,
            account_id=args.account_id, app_id=args.app_id,
        ), args.out)
        return
    if args.command == "acquisition":
        window = range_window("acquisition", args.start, args.end)
        _emit(warehouse_acquisition_report(
            args.warehouse, start=window.start, end=window.end, observe_through=args.observe_through,
        ), args.out)
        return
    if args.command == "ingest-acquisition-mapping":
        _emit(ingest_acquisition_mapping(args.manifest, args.warehouse), None)
        return
    if args.command == "acquisition-finance":
        window = range_window("acquisition_finance", args.start, args.end)
        _emit(financial_cohort_report(
            args.warehouse, start=window.start, end=window.end,
            observe_through=args.observe_through, as_of=args.as_of,
        ), args.out)
        return
    if args.command == "ingest-billing-mapping":
        _emit(ingest_billing_mapping(args.manifest, args.warehouse), None)
        return
    if args.command == "billing-learning":
        window = range_window("billing_learning", args.start, args.end)
        _emit(warehouse_billing_learning_report(
            args.warehouse, start=window.start, end=window.end, observe_through=args.observe_through, as_of=args.as_of,
        ), args.out)
        return
    if args.command == "onboarding":
        window = range_window("onboarding", args.start, args.end)
        _emit(warehouse_onboarding_report(
            args.warehouse, start=window.start, end=window.end, observe_through=args.observe_through,
        ), args.out)
        return
    if args.command == "compare":
        contract = load_contract()
        baseline = ValidatedContext.model_validate_json(args.baseline.read_text())
        current = ValidatedContext.model_validate_json(args.current.read_text())
        report = build_comparison(baseline, current, contract)
        _emit(report.model_dump(mode="json", exclude_none=True), args.out)


def _window(args):
    if args.day:
        return day_window(args.day)
    if not args.start or not args.end:
        raise SystemExit("Pass --day or both --start and --end")
    return range_window(args.kind, args.start, args.end)


def _as_of(value: str) -> datetime:
    try:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if moment.tzinfo is None or moment.utcoffset() is None:
            raise ValueError("timezone is required")
        return moment
    except ValueError as error:
        raise argparse.ArgumentTypeError("Pass a timezone-aware ISO timestamp for --as-of.") from error


def _zone(value: str) -> ZoneInfo:
    try:
        return ZoneInfo(value)
    except (ValueError, ZoneInfoNotFoundError) as error:
        raise argparse.ArgumentTypeError("Pass a known IANA report timezone.") from error


def _emit(payload: dict, path: Path | None) -> None:
    text = json.dumps(payload, indent=2) + "\n"
    if path is None:
        print(text, end="")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)

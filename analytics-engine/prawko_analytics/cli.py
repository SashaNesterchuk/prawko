"""Command line for ingest, context, and comparison."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from prawko_analytics.compare import build_comparison
from prawko_analytics.context import build_context, day_window, range_window
from prawko_analytics.contract import load_contract
from prawko_analytics.ingest import ingest_dump
from prawko_analytics.models import ValidatedContext
from prawko_analytics.paths import DEFAULT_WAREHOUSE


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="prawko-analytics")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest = subparsers.add_parser("ingest", help="Write a PostHog dump into day partitions")
    ingest.add_argument("dump", type=Path)
    ingest.add_argument("--warehouse", type=Path, default=DEFAULT_WAREHOUSE)

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


def _emit(payload: dict, path: Path | None) -> None:
    text = json.dumps(payload, indent=2) + "\n"
    if path is None:
        print(text, end="")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)

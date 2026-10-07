"""Observed install/account history, never an SDK person merger."""

from __future__ import annotations

import json
import re
from bisect import bisect_right
from collections import Counter, defaultdict
from datetime import datetime
from itertools import groupby
from pathlib import Path

from prawko_analytics.ingest import WARSAW, load_events, partition_days
from prawko_analytics.quality import observation_usable


def safe_identity_id(value) -> str | None:
    if (
        isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,200}", value)
        and not re.fullmatch(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", value)
    ):
        return value
    return None


def _properties(row: dict) -> dict:
    value = row.get("properties")
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def identity_link_report(warehouse: Path, *, start: datetime, end: datetime) -> dict:
    """Derive the ledger from available warehouse history, including pre-window links."""
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ValueError("Identity report requires ordered timezone-aware window bounds.")
    paths = sorted((warehouse / "events").glob("day=*/events.parquet"))
    if not paths:
        return observed_identity_links([], start=start, end=end, history_complete=False)
    days = []
    for path in paths:
        try:
            days.append(datetime.fromisoformat(path.parent.name.removeprefix("day=")).replace(tzinfo=WARSAW))
        except ValueError:
            continue
    days = [day for day in days if day < end]
    if not days:
        return observed_identity_links([], start=start, end=end, history_complete=False)
    history_start = min(days)
    partitions = partition_days(warehouse, history_start, end)
    history_complete = bool(partitions) and all(
        path is not None and meta is not None and meta.get("metadata_version") == 2
        and meta.get("complete") is True
        for _day, path, meta in partitions
    )
    rows = load_events([path for _day, path, _meta in partitions if path is not None], history_start, end)
    from prawko_analytics.data_quality import observe_raw_data_quality

    rows, source_quality = observe_raw_data_quality(
        rows, start=history_start, end=end, coverage_complete=history_complete,
    )
    report = observed_identity_links(rows, start=start, end=end, history_complete=history_complete)
    report["source_integrity"] = {
        "rule_version": source_quality["rule_version"], "counts": source_quality["counts"],
        "historical_delivery_as_of": "not_verified",
    }
    report["history_available_from"] = history_start.isoformat()
    report["historical_coverage_scope"] = "available_partitions_only_not_install_lifetime"
    return report


def observed_identity_links(
    rows: list[dict], *, start: datetime, end: datetime, history_complete: bool = False,
) -> dict:
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ValueError("Identity report requires ordered timezone-aware window bounds.")
    issues: Counter = Counter()
    observations: dict[str, list[dict]] = defaultdict(list)
    contexts: dict[str, list[tuple]] = defaultdict(list)
    sdk_installs: dict[str, set[str]] = defaultdict(set)
    person_accounts: dict[str, set[str]] = defaultdict(set)
    account_installs: dict[str, set[str]] = defaultdict(set)
    aliases: list[tuple[str | None, str | None]] = []
    identity_rows = 0
    seen_observations: dict[tuple, tuple] = {}
    quarantined_bodies: set[tuple] = set()
    for row in rows:
        moment = row.get("timestamp")
        if not isinstance(moment, datetime) or moment.tzinfo is None:
            issues["invalid_timestamp"] += 1
            continue
        if moment >= end:
            continue
        props = _properties(row)
        install = safe_identity_id(props.get("app_user_id"))
        account = safe_identity_id(props.get("supabase_user_id"))
        sdk = safe_identity_id(row.get("distinct_id"))
        person = safe_identity_id(row.get("person_id"))
        if row.get("event") in {"$create_alias", "$alias"}:
            aliases.append((safe_identity_id(props.get("alias")), sdk))
        if observation_usable(props):
            if install and sdk:
                sdk_installs[sdk].add(install)
            if person and account:
                person_accounts[person].add(account)
            if install and "supabase_user_id" in props:
                if props["supabase_user_id"] is None or account:
                    contexts[install].append((moment, account, row.get("event")))
        if row.get("event") != "analytics_identity_observed":
            continue
        identity_rows += 1
        previous = safe_identity_id(props.get("previous_supabase_user_id"))
        reason = props.get("identity_observation_reason")
        version = props.get("identity_link_version")
        valid = (
            observation_usable(props) and install is not None
            and type(version) is int and version == 1 and props.get("identity_scope") == "install"
            and "supabase_user_id" in props and (props["supabase_user_id"] is None or account is not None)
            and "previous_supabase_user_id" in props
            and (props["previous_supabase_user_id"] is None or previous is not None)
            and (
                (reason == "initial" and previous is None)
                or (reason == "account_link" and previous is None and account is not None)
                or (reason == "account_unlink" and previous is not None and account is None)
                or (reason == "account_switch" and previous is not None and account is not None and previous != account)
            )
        )
        if not valid:
            issues["invalid_link_observation"] += 1
            if install:
                observations[install].append({
                    "at": moment, "account": None, "conflict": True, "invalid_boundary": True,
                })
            continue
        provider_id = safe_identity_id(row.get("event_id"))
        client_id = safe_identity_id(props.get("event_id"))
        run = safe_identity_id(props.get("app_run_id"))
        sequence = props.get("event_sequence")
        sequence = sequence if type(sequence) is int and sequence > 0 else None
        # IDs are scoped: one client's event ID never deduplicates another install.
        dedupe_keys = []
        if client_id:
            dedupe_keys.append((install, "client", client_id))
        if provider_id:
            dedupe_keys.append(("provider", provider_id))
        body = (install, moment, account, previous, reason, run, sequence)
        prior_bodies = {seen_observations[key] for key in dedupe_keys if key in seen_observations}
        if any(prior != body for prior in prior_bodies) or body in quarantined_bodies:
            issues["conflicting_observation_id"] += 1
            for prior in prior_bodies | {body}:
                prior_install, prior_moment, *_rest = prior
                observations[prior_install] = [
                    item for item in observations[prior_install] if item.get("body") != prior
                ]
                observations[prior_install].append({"at": prior_moment, "account": None, "conflict": True})
                quarantined_bodies.add(prior)
            for key in dedupe_keys:
                seen_observations.setdefault(key, body)
            continue
        for key in dedupe_keys:
            seen_observations[key] = body
        if prior_bodies:
            issues["duplicate_observation"] += 1
            continue
        observations[install].append({
            "at": moment, "account": account, "previous": previous, "reason": reason,
            "run": run, "sequence": sequence, "event_id": client_id or provider_id,
            "body": body,
        })

    segments = []
    observation_count = 0
    for install, items in sorted(observations.items()):
        current = None
        install_segments = []
        ordered = []
        for moment, group in groupby(sorted(items, key=lambda item: item["at"]), key=lambda item: item["at"]):
            tied = list(group)
            states = {item["account"] for item in tied}
            runs = {item.get("run") for item in tied}
            sequences = [item.get("sequence") for item in tied]
            has_order = (
                len(runs) == 1 and None not in runs and None not in sequences
                and len(set(sequences)) == len(sequences)
            )
            if any(item.get("conflict") for item in tied) or (len(states) > 1 and not has_order):
                issues["invalid_state_boundary" if any(item.get("invalid_boundary") for item in tied)
                       else "ambiguous_observation_order"] += 1
                ordered.append({"at": moment, "conflict": True})
            else:
                ordered.extend(sorted(tied, key=lambda item: (item.get("sequence") or 0, item.get("event_id") or "")))
        for item in ordered:
            moment = item["at"]
            if item.get("conflict"):
                if current is not None:
                    current["observed_until"] = moment.isoformat()
                    current["end_basis"] = "ambiguous_next_observation"
                    current["context_consistent"] = False
                current = None
                continue
            observation_count += 1
            account = item["account"]
            if account:
                account_installs[account].add(install)
            if current is not None and item["reason"] != "initial" and item["previous"] != current["supabase_user_id"]:
                issues["previous_account_disagreement"] += 1
                current["context_consistent"] = False
            elif current is None and item["reason"] != "initial":
                issues["previous_state_unobserved"] += 1
            if current is not None and current["supabase_user_id"] == account:
                current["observations"] += 1
                continue
            if current is not None:
                current["observed_until"] = moment.isoformat()
                current["end_basis"] = "next_explicit_observation"
                if item["reason"] == "initial":
                    issues["unobserved_account_transition"] += 1
            current = {
                "app_user_id": install, "supabase_user_id": account,
                "observed_from": moment.isoformat(), "observed_until": None,
                "start_reason": item["reason"], "start_event_id": item["event_id"],
                "end_basis": "not_observed", "observations": 1,
                "context_consistent": True, "link_basis": "explicit_client_observation",
                "account_ownership_verified": False,
            }
            install_segments.append(current)
        beginnings = [datetime.fromisoformat(segment["observed_from"]) for segment in install_segments]
        for moment, account, event in contexts[install]:
            if event == "analytics_identity_observed":
                continue
            index = bisect_right(beginnings, moment) - 1
            if index < 0:
                continue
            segment = install_segments[index]
            ended = datetime.fromisoformat(segment["observed_until"]) if segment["observed_until"] else end
            if beginnings[index] <= moment < ended and account != segment["supabase_user_id"]:
                issues["event_context_disagreement" if beginnings[index] < moment
                       else "same_time_context_disagreement"] += 1
                segment["context_consistent"] = False
        for segment in install_segments:
            began = datetime.fromisoformat(segment["observed_from"])
            ended = datetime.fromisoformat(segment["observed_until"]) if segment["observed_until"] else end
            if began < ended and began < end and ended > start:
                segments.append({
                    **segment, "left_censored": began < start,
                    "right_censored": segment["observed_until"] is None,
                    "reported_until": min(ended, end).isoformat(),
                })

    account_ids = set(account_installs) | {
        account for values in contexts.values() for _moment, account, _event in values if account
    }
    alias_accounts: dict[str, set[str]] = defaultdict(set)
    for alias, sdk in aliases:
        if alias in account_ids and sdk:
            for install in sdk_installs.get(sdk, set()):
                alias_accounts[install].add(alias)
    distinct_collisions = sum(len(installs) > 1 for installs in sdk_installs.values())
    person_collisions = sum(len(accounts) > 1 for accounts in person_accounts.values())
    alias_collisions = sum(len(accounts) > 1 for accounts in alias_accounts.values())
    context_only = len(set(contexts) - set(observations))
    quality_issues = sum(count for key, count in issues.items() if key != "duplicate_observation")
    status = "not_observed" if not identity_rows else "limited" if (
        quality_issues or distinct_collisions or person_collisions or alias_collisions or not history_complete
    ) else "observed"
    return {
        "ledger_version": 1, "status": status,
        "grain": "installation_account_observation", "primary_analysis_key": "app_user_id",
        "account_key": "supabase_user_id", "person_merging_enabled": False,
        "automatic_account_joins_enabled": False, "entitlement_transfer_inferred": False,
        "time_basis": "exported_event_timestamp", "event_window_start": start.isoformat(),
        "event_window_end": end.isoformat(), "historical_delivery_as_of_verified": False,
        "history_coverage_complete": history_complete,
        "history_available_from": None, "historical_coverage_scope": "supplied_observations_only",
        "identity_event_rows": identity_rows, "accepted_observations": observation_count,
        "installations_with_observations": len(observations),
        "context_only_installations": context_only,
        "cross_device_accounts": sum(len(installs) > 1 for installs in account_installs.values()),
        "sdk_distinct_id_install_collisions": distinct_collisions,
        "sdk_person_multiple_accounts": person_collisions,
        "historical_sdk_quality_status": "review_required" if distinct_collisions or person_collisions or alias_collisions
            else "no_observed_collisions",
        "legacy_alias_events": len(aliases), "legacy_alias_account_collisions": alias_collisions,
        "issues": dict(sorted(issues.items())), "links": segments,
        "limitations": [
            "Installations remain the product and billing analysis grain, not unique people.",
            "A link observes local account context, not authentication, account ownership, or server access.",
            "Intervals end at the next observation; missing transitions and process gaps remain unverified.",
            "Exported historical SDK alias/person IDs are inspected, not verified or repaired in the vendor.",
            "Cross-device account observations do not merge installations or transfer RevenueCat access.",
        ],
    }

"""Event-time order; export/input order and legacy runtime_id are not evidence."""

from prawko_analytics.identity import safe_identity_id


def observed_before(left, right) -> bool:
    if left.timestamp != right.timestamp:
        return left.timestamp < right.timestamp
    lp, rp = left.properties, right.properties
    run = safe_identity_id(lp.get("app_run_id"))
    ls, rs = lp.get("event_sequence"), rp.get("event_sequence")
    return bool(run and run == safe_identity_id(rp.get("app_run_id"))
                and type(ls) is int and type(rs) is int and 0 <= ls < rs)

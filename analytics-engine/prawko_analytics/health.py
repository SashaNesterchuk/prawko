"""Product health for one window.

Statuses come from majority, sample size, and the largest funnel drop.
A missing RevenueCat export is unknown revenue, not zero revenue.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from prawko_analytics.context import PreparedRow
from prawko_analytics.access import feature_access_report
from prawko_analytics.content import content_observations_report
from prawko_analytics.repeat_answers import repeat_answer_report
from prawko_analytics.external_entries import external_entry_report
from prawko_analytics.rewarded_ads import rewarded_ad_report
from prawko_analytics.data_quality import canonical_observations, diagnostic_observations, observe_data_quality
from prawko_analytics.paywall_contract import ELIGIBILITY_EVENTS
from prawko_analytics.payload_validation import invalid_client_payload
from prawko_analytics.paywall_observations import paywall_observations_report
from prawko_analytics.quality import observation_integrity_issue, observation_usable
from prawko_analytics.identity import safe_identity_id
from prawko_analytics.acquisition import observed_acquisition

WARSAW = ZoneInfo("Europe/Warsaw")

QUESTION_EVENTS = frozenset({"training_question_answered", "exam_question_answered"})
MIN_RELIABLE = 30
MAJORITY = 0.70
OUTCOME_WATCH = 0.30
DROP_USERS = 10
DROP_RATE = 0.15


@dataclass
class Step:
    id: str
    label: str
    users: int
    cohort: str = ""


@dataclass
class Funnel:
    id: str
    title: str
    grain: str
    steps: list[Step]


@dataclass
class Drop:
    funnel_id: str
    label: str
    lost_users: int
    from_users: int
    to_users: int
    rate: float


@dataclass
class Transition:
    label: str
    from_users: int
    to_users: int
    rate: float | None
    note: str


@dataclass
class AreaMetric:
    area: str
    id: str
    label: str
    numerator: int | None
    denominator: int | None
    unit: str
    reliable: bool
    tone: str
    note: str


@dataclass
class Person:
    install: datetime | None = None
    home: datetime | None = None
    question: datetime | None = None
    finished: datetime | None = None
    exam_start: datetime | None = None
    exam_after_training: datetime | None = None
    exam_done: datetime | None = None
    training_done: datetime | None = None
    paywall: datetime | None = None
    purchase: datetime | None = None
    days: set = field(default_factory=set)
    exam_results: list = field(default_factory=list)
    exam_marks: list = field(default_factory=list)


@dataclass
class Health:
    users: int
    installs: int
    metrics: list[AreaMetric]
    funnels: list[Funnel]
    drops: list[Drop]
    transitions: list[Transition]
    monetization: dict
    reliability_label: str
    reportable_metrics: int
    health_metrics: int
    coverage_complete: bool = False
    identity_grain: str = "app_user_id_installation"
    attempt_quality: dict = field(default_factory=dict)
    feature_access: dict = field(default_factory=dict)
    content_observations: dict = field(default_factory=dict)
    repeat_answers: dict = field(default_factory=dict)
    external_entries: dict = field(default_factory=dict)
    rewarded_ads: dict = field(default_factory=dict)
    data_quality: dict = field(default_factory=dict)
    acquisition: dict = field(default_factory=dict)
    onboarding: dict = field(default_factory=dict)
    paywall_observations: dict = field(default_factory=dict)


def build_health(
    rows: list[PreparedRow],
    *,
    window_start: datetime,
    window_end: datetime,
    financial: dict | None = None,
    spend: dict | None = None,
    acquisition: dict | None = None,
    financial_cohorts: dict | None = None,
    billing_learning: dict | None = None,
    onboarding: dict | None = None,
    paywall_observations: dict | None = None,
    coverage_complete: bool = False,
) -> Health:
    if window_start.tzinfo is None or window_end.tzinfo is None:
        raise ValueError("Health window bounds must have an explicit timezone.")
    if window_start >= window_end:
        raise ValueError("window_start must be before window_end")
    rows = [row for row in rows if _utc(window_start) <= _utc(row.timestamp) < _utc(window_end)]
    rows, data_quality = observe_data_quality(
        rows, start=window_start, end=window_end, coverage_complete=coverage_complete,
    )
    analytical_rows = canonical_observations(rows)
    activity_rows = [row for row in analytical_rows if row.event not in ELIGIBILITY_EVENTS]
    activity_integrity = sum(
        observation_integrity_issue(row.properties) for row in rows if row.event not in ELIGIBILITY_EVENTS
    )
    diagnostic_rows = diagnostic_observations(rows)
    reconstructed = reconstruct_attempts(activity_rows)
    people, attempts = _people(activity_rows, reconstructed)
    installers = {key: person for key, person in people.items() if person.install is not None}
    d1_num, d1_den = _return_rate(installers, window_end, days=1)
    d7_num, d7_den = _return_rate(installers, window_end, days=7)
    first_pass, first_n = _first_exam_pass(people)
    horizon = timedelta(hours=24)
    exams = [attempt for attempt in reconstructed if attempt.kind == "exam"]
    mature = [attempt for attempt in exams if attempt.started_at + horizon <= _utc(window_end)]
    paired_starts = len(mature)
    paired_done = sum(
        attempt.completed and attempt.completed_at <= attempt.started_at + horizon
        for attempt in mature
    )
    quality = {
        "grain": "installation_scoped_learning_session_id",
        "exam_horizon_seconds": int(horizon.total_seconds()),
        "exam_censored": len(exams) - len(mature),
        "id_linked_attempts": sum(attempt.join_basis == "session_id" for attempt in reconstructed),
        "legacy_time_paired_attempts": sum(attempt.join_basis == "legacy_time_pairing" for attempt in reconstructed),
        "unlinked_attempts": sum(attempt.join_basis == "missing_attempt_id" for attempt in reconstructed),
        "invalid_payload_rows": sum(invalid_client_payload(row.properties) for row in rows),
        "import_conflict_rows": sum(row.properties.get("_warehouse_import_conflict") is True for row in rows),
        "business_conflict_rows": sum(row.properties.get("_warehouse_business_conflict") is True for row in rows),
        "invalid_business_rows": sum(row.properties.get("_warehouse_business_invalid") is True for row in rows),
        "business_order_uncertain_rows": sum(row.properties.get("_warehouse_business_order_uncertain") is True for row in rows),
        "ambiguous_attempts": sum(bool(attempt.join_issues) for attempt in reconstructed),
        "activity_integrity_issue_count": activity_integrity,
        "missing_exam_join_rows": sum(
            row.event in {
                "exam_session_started", "exam_session_resumed", "exam_session_completed",
                "exam_session_ended", "exam_empty_exit", "exam_question_answered",
            } and _session_id(row, "exam") is None for row in rows
        ),
    }
    attempt_reliable = coverage_complete and bool(mature) and all(
        attempt.join_basis == "session_id" and not attempt.join_issues for attempt in mature
    ) and not activity_integrity and not quality["missing_exam_join_rows"]
    restart_num, restart_den = attempts

    funnels = [
        _ordered_funnel(
            "activation",
            "Acquisition → activation",
            "install cohort",
            installers,
            (
                ("install", "Install"),
                ("home", "Opened Home"),
                ("question", "Answered a question"),
            ),
            cohort_label="install cohort",
        ),
        _ordered_funnel(
            "learning",
            "Activation → learning",
            "all people in the window",
            {key: person for key, person in people.items() if person.question is not None},
            (
                ("question", "Answered a question"),
                ("finished", "Finished a training or exam"),
            ),
            cohort_label="all people in the window",
        ),
        _ordered_funnel(
            "exam",
            "Learning → exam",
            "optional transition, not a required next step",
            {key: person for key, person in people.items() if person.training_done is not None},
            (
                ("training_done", "Finished a training"),
                ("exam_after_training", "Started an exam after that"),
            ),
            cohort_label="people who finished a training",
        ),
        _ordered_funnel(
            "exam_result",
            "Exam → result",
            "people who started an exam",
            {key: person for key, person in people.items() if person.exam_start is not None},
            (
                ("exam_start", "Started an exam"),
                ("exam_done", "Completed an exam"),
            ),
            cohort_label="people who started an exam",
        ),
        Funnel(
            "retry",
            "Exam → repeat",
            "failed exam completions",
            [
                Step("failed", "Failed an exam", restart_den, "failed exam completions"),
                Step("restarted", "Started another exam", restart_num, "failed exam completions"),
            ],
        ),
        _ordered_funnel(
            "premium",
            "Premium → purchase",
            "people who saw the paywall",
            {key: person for key, person in people.items() if person.paywall is not None},
            (
                ("paywall", "Saw the paywall"),
                ("purchase", "Purchase event"),
            ),
            cohort_label="people who saw the paywall",
        ),
    ]
    ranked = _ranked_drops([
        funnel for funnel in funnels
        if funnel.id in {"activation", "learning"}
        or (funnel.id == "exam_result" and attempt_reliable and not quality["exam_censored"])
    ]) if coverage_complete and not activity_integrity else []
    transitions = [_as_transition(next(funnel for funnel in funnels if funnel.id == "exam"))]
    if not coverage_complete or activity_integrity:
        for transition in transitions:
            transition.rate = None
            transition.note += " Full source coverage and clean business integrity are required for a fraction."
    paywall_users = sum(person.paywall is not None for person in people.values())
    purchase_users = sum(person.purchase is not None for person in people.values())
    purchase_events = sum(
        1
        for row in analytical_rows
        if row.event == "purchase_succeeded" and observation_usable(row.properties)
        and _user_key(row, _primary_by_distinct(analytical_rows))
    )
    metrics = _metrics(
        users=len(people),
        installs=len(installers),
        home=_step(funnels, "activation", "home"),
        question=_step(funnels, "activation", "question"),
        install_n=_step(funnels, "activation", "install"),
        finished=_step(funnels, "learning", "finished"),
        question_n=_step(funnels, "learning", "question"),
        exam_start_after=_step(funnels, "exam", "exam_after_training"),
        finished_n=_step(funnels, "exam", "training_done"),
        exam_done=_step(funnels, "exam_result", "exam_done"),
        exam_start_n=_step(funnels, "exam_result", "exam_start"),
        paired_done=paired_done,
        paired_starts=paired_starts,
        first_pass=first_pass,
        first_n=first_n,
        restart_num=restart_num,
        restart_den=restart_den,
        d1_num=d1_num,
        d1_den=d1_den,
        d7_num=d7_num,
        d7_den=d7_den,
        paywall_users=paywall_users,
        purchase_users=purchase_users,
        biggest=ranked[0] if ranked else None,
    )
    attempt_metric = next(metric for metric in metrics if metric.id == "exam_attempt_completion")
    attempt_metric.label = "Observed exam starts completed within 24 hours"
    attempt_metric.note = (
        f"Installation-scoped session ID; {quality['exam_censored']} starts are censored. "
        "Legacy time pairing and missing/conflicting IDs are descriptive proxies only."
    )
    if not attempt_reliable:
        attempt_metric.reliable = False
        attempt_metric.tone = "unknown"
    if quality["ambiguous_attempts"]:
        for metric in metrics:
            if metric.area == "exam":
                metric.reliable = False
                metric.tone = "unknown"
                metric.note += " Conflicting or unjoinable attempt observations restrict this summary."
    if not coverage_complete or activity_integrity:
        for metric in metrics:
            if metric.unit == "rate":
                metric.reliable = False
                metric.tone = "unknown"
                metric.note += " Full source coverage, valid client payloads and clean business integrity are required for a rate."
    financial_status = financial.get("status", "not_loaded") if financial else "not_loaded"
    if financial_status != "not_loaded":
        revenue_metric = next(metric for metric in metrics if metric.id == "revenuecat_revenue")
        revenue_metric.label = "RevenueCat source-reported gross event activity"
        revenue_metric.note = (
            "Separate currency amounts and refunds are in monetization.financial. "
            "Producer verification and coverage are explicit as-of assertions; this is not settled revenue or proceeds."
        )
    reportable = sum(metric.reliable for metric in metrics if metric.unit != "source")
    scored = sum(metric.unit != "source" for metric in metrics)
    content_observations = content_observations_report(diagnostic_rows, coverage_complete=coverage_complete)
    return Health(
        users=len(people),
        installs=len(installers),
        metrics=metrics,
        funnels=funnels,
        drops=ranked[:3],
        transitions=transitions,
        monetization={
            "revenuecat": financial_status,
            "financial": financial,
            "spend": spend,
            "financial_cohorts": financial_cohorts,
            "billing_learning": billing_learning,
            "purchase_events": purchase_events,
            "purchase_users": purchase_users,
            "paywall_users": paywall_users,
            "attribution": "unavailable" if paywall_users < MIN_RELIABLE else "limited",
        },
        reliability_label="Limited" if reportable < scored else "Open",
        reportable_metrics=reportable,
        health_metrics=scored,
        coverage_complete=coverage_complete,
        attempt_quality=quality,
        feature_access=feature_access_report(diagnostic_rows, coverage_complete=coverage_complete),
        content_observations=content_observations,
        repeat_answers=repeat_answer_report(
            diagnostic_rows, start=window_start, end=window_end, coverage_complete=coverage_complete,
            content_quality=content_observations,
        ),
        external_entries=external_entry_report(
            diagnostic_rows, start=window_start, end=window_end, coverage_complete=coverage_complete,
        ),
        rewarded_ads=rewarded_ad_report(diagnostic_rows, coverage_complete=coverage_complete),
        data_quality=data_quality,
        acquisition=acquisition if acquisition is not None else observed_acquisition(
            rows, start=window_start, end=window_end, coverage_complete=coverage_complete,
        ),
        onboarding=onboarding if onboarding is not None else {
            "status": "history_not_supplied", "rule_version": "onboarding-activation-v1",
            "source_scope": "supplied_health_rows_are_not_verified_app_scoped_history",
        },
        paywall_observations=paywall_observations if paywall_observations is not None else paywall_observations_report(
            rows, start=window_start, end=window_end, coverage_complete=coverage_complete,
        ),
    )


def _people(
    rows: list[PreparedRow],
    reconstructed: list[ReconstructedAttempt],
) -> tuple[dict[str, Person], tuple[int, int]]:
    linked = _primary_by_distinct(rows)
    people: dict[str, Person] = {}
    fails = 0
    restarts = 0
    starts: dict[str, list[datetime]] = {}
    completions: dict[str, list[tuple[datetime, bool]]] = {}
    for row in rows:
        if not observation_usable(row.properties):
            continue
        key = _user_key(row, linked)
        if key is None:
            continue
        person = people.setdefault(key, Person())
        moment = _utc(row.timestamp)
        person.days.add(moment.astimezone(WARSAW).date())
        if row.event == "Application Installed":
            _mark(person, "install", moment)
        elif row.event == "screen_viewed" and row.properties.get("screen_name") == "home":
            _mark(person, "home", moment)
        elif row.event in QUESTION_EVENTS:
            _mark(person, "question", moment)
        elif row.event == "training_session_completed":
            _mark(person, "finished", moment)
            _mark(person, "training_done", moment)
        elif row.event == "exam_session_completed":
            _mark(person, "finished", moment)
        if row.event == "exam_session_started":
            _mark(person, "exam_start", moment)
            person.exam_marks.append((moment, "start"))
        elif row.event == "exam_session_completed":
            passed = row.properties.get("passed")
            if isinstance(passed, bool):
                person.exam_results.append((moment, passed))
            person.exam_marks.append((moment, "complete"))
        elif row.event == "paywall_viewed":
            _mark(person, "paywall", moment)
        elif row.event == "purchase_succeeded":
            _mark(person, "purchase", moment)
    for attempt in reconstructed:
        if attempt.kind != "exam":
            continue
        starts.setdefault(attempt.person, []).append(attempt.started_at)
        if not attempt.completed or attempt.join_issues:
            continue
        person = people[attempt.person]
        _mark(person, "exam_done", attempt.completed_at)
        if attempt.passed is not None:
            completions.setdefault(attempt.person, []).append((attempt.completed_at, attempt.passed))
    for key, attempts in completions.items():
        later = sorted(starts.get(key, []))
        for moment, passed in attempts:
            if passed:
                continue
            fails += 1
            if any(start > moment for start in later):
                restarts += 1
    for key, person in people.items():
        if person.training_done is None:
            continue
        later = [moment for moment in starts.get(key, []) if moment >= person.training_done]
        if later:
            person.exam_after_training = min(later)
    return people, (restarts, fails)


def _primary_by_distinct(rows: list[PreparedRow]) -> dict[str, str]:
    candidates: dict[str, set[str]] = {}
    for row in rows:
        if observation_usable(row.properties) and row.key_source == "primary" and row.distinct_id and row.analysis_key:
            candidates.setdefault(row.distinct_id, set()).add(row.analysis_key)
    return {distinct: next(iter(keys)) for distinct, keys in candidates.items() if len(keys) == 1}


def _user_key(row: PreparedRow, linked: dict[str, str]) -> str | None:
    if row.key_source == "primary" and row.analysis_key:
        return row.analysis_key
    if row.event == "Application Installed" and row.distinct_id and row.distinct_id in linked:
        return linked[row.distinct_id]
    return None


def _mark(person: Person, name: str, moment: datetime) -> None:
    current = getattr(person, name)
    if current is None or moment < current:
        setattr(person, name, moment)


def _utc(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=ZoneInfo("UTC"))
    return moment.astimezone(ZoneInfo("UTC"))


def _ordered_funnel(
    funnel_id: str,
    title: str,
    grain: str,
    cohort: dict[str, Person],
    steps: tuple,
    *,
    cohort_label: str,
) -> Funnel:
    counts = []
    for index, (step_id, _label) in enumerate(steps):
        count = 0
        for person in cohort.values():
            previous = None
            ok = True
            for earlier_id, _earlier_label in steps[: index + 1]:
                moment = getattr(person, earlier_id)
                if moment is None or (previous is not None and moment < previous):
                    ok = False
                    break
                previous = moment
            count += int(ok)
        counts.append(count)
    return Funnel(
        funnel_id,
        title,
        grain,
        [Step(step_id, label, count, cohort_label) for (step_id, label), count in zip(steps, counts, strict=True)],
    )


def _return_rate(installers: dict[str, Person], window_end: datetime, *, days: int) -> tuple[int, int]:
    end_day = window_end.astimezone(WARSAW).date()
    eligible = 0
    returned = 0
    for person in installers.values():
        if person.install is None:
            continue
        origin = person.install.astimezone(WARSAW).date()
        target = origin + timedelta(days=days)
        if target >= end_day:
            continue
        eligible += 1
        if target in person.days:
            returned += 1
    return returned, eligible


def _first_exam_pass(people: dict[str, Person]) -> tuple[int, int]:
    passed = 0
    total = 0
    for person in people.values():
        if not person.exam_results:
            continue
        total += 1
        _moment, ok = min(person.exam_results)
        passed += int(ok)
    return passed, total


def _as_transition(funnel: Funnel) -> Transition:
    left, right = funnel.steps
    rate = right.users / left.users if left.users else 0
    return Transition(
        f"{left.label} → {right.label}",
        left.users,
        right.users,
        rate,
        "Not a loss. A finished training does not have to be followed by an exam in the same window.",
    )


def _ranked_drops(funnels: list[Funnel]) -> list[Drop]:
    found: list[Drop] = []
    for funnel in funnels:
        for left, right in zip(funnel.steps, funnel.steps[1:], strict=False):
            lost = left.users - right.users
            if left.users < MIN_RELIABLE or lost < DROP_USERS:
                continue
            rate = lost / left.users
            if rate < DROP_RATE:
                continue
            found.append(
                Drop(
                    funnel.id,
                    f"{left.label} → {right.label}",
                    lost,
                    left.users,
                    right.users,
                    rate,
                )
            )
    return sorted(found, key=lambda item: (item.lost_users, item.rate), reverse=True)


def _step(funnels: list[Funnel], funnel_id: str, step_id: str) -> int:
    funnel = next(item for item in funnels if item.id == funnel_id)
    return next(step.users for step in funnel.steps if step.id == step_id)


def _metrics(**values) -> list[AreaMetric]:
    biggest: Drop | None = values["biggest"]
    home_rate = _rate(values["home"], values["install_n"])
    question_rate = _rate(values["question"], values["install_n"])
    finished_rate = _rate(values["finished"], values["question_n"])
    exam_after_rate = _rate(values["exam_start_after"], values["finished_n"])
    exam_user_rate = _rate(values["exam_done"], values["exam_start_n"])
    paired_rate = _rate(values["paired_done"], values["paired_starts"])
    first_rate = _rate(values["first_pass"], values["first_n"])
    retry_rate = _rate(values["restart_num"], values["restart_den"])
    d1_rate = _rate(values["d1_num"], values["d1_den"])
    return [
        _count("acquisition", "installs", "Installs linked to a person", values["installs"]),
        _count("acquisition", "users", "People with app_user_id", values["users"]),
        _rate_metric(
            "activation",
            "home_after_install",
            "Opened Home after install",
            values["home"],
            values["install_n"],
            home_rate,
            _majority_tone(home_rate, values["install_n"]),
            "Share of installs that later opened Home.",
        ),
        _rate_metric(
            "activation",
            "question_after_install",
            "Answered a question after install",
            values["question"],
            values["install_n"],
            question_rate,
            _majority_tone(question_rate, values["install_n"]),
            "Training or exam question, after Home, in install order.",
        ),
        _rate_metric(
            "learning",
            "finished_after_question",
            "Finished a session after a question",
            values["finished"],
            values["question_n"],
            finished_rate,
            _majority_tone(finished_rate, values["question_n"]),
            "Training or exam completion after the first question.",
        ),
        _rate_metric(
            "exam",
            "exam_after_finished",
            "Started an exam after finishing a training",
            values["exam_start_after"],
            values["finished_n"],
            exam_after_rate,
            _majority_tone(exam_after_rate, values["finished_n"]),
            "Exam start at or after the first finished training.",
        ),
        _rate_metric(
            "exam",
            "exam_user_completion",
            "People who completed an exam they started",
            values["exam_done"],
            values["exam_start_n"],
            exam_user_rate,
            _majority_tone(exam_user_rate, values["exam_start_n"]),
            "Person grain. A later completion counts.",
        ),
        _rate_metric(
            "exam",
            "exam_attempt_completion",
            "Observed exam starts completed within 24 hours",
            values["paired_done"],
            values["paired_starts"],
            paired_rate,
            _majority_tone(paired_rate, values["paired_starts"]),
            "Requires complete coverage, mature starts and installation-scoped session IDs.",
        ),
        _rate_metric(
            "exam",
            "first_exam_pass",
            "First observed exam result passed",
            values["first_pass"],
            values["first_n"],
            first_rate,
            _outcome_tone(first_rate, values["first_n"]),
            "Earliest known pass/fail completion per installation in this window, not the first-ever exam.",
        ),
        _rate_metric(
            "exam",
            "retry_after_fail",
            "Failed exams followed by another exam start",
            values["restart_num"],
            values["restart_den"],
            retry_rate,
            _majority_tone(retry_rate, values["restart_den"]),
            "Any later start in the window, not a daily cap.",
        ),
        _rate_metric(
            "retention",
            "d1_return",
            "Returned the next day after install",
            values["d1_num"],
            values["d1_den"],
            d1_rate,
            _majority_tone(d1_rate, values["d1_den"]),
            "Install day plus one calendar day in Europe/Warsaw, still inside the window.",
        ),
        _rate_metric(
            "retention",
            "d7_return",
            "Returned on day 7 after install",
            values["d7_num"],
            values["d7_den"],
            _rate(values["d7_num"], values["d7_den"]) if values["d7_den"] >= MIN_RELIABLE else None,
            "unknown",
            "Shown only as a sample until 30 installs are old enough.",
            force_unreliable=values["d7_den"] < MIN_RELIABLE,
        ),
        AreaMetric(
            "monetization",
            "revenuecat_revenue",
            "RevenueCat revenue",
            None,
            None,
            "source",
            False,
            "unknown",
            "No RevenueCat export is loaded. Client events are not settled revenue.",
        ),
        _rate_metric(
            "monetization",
            "paywall_purchase",
            "Paywall viewers with a purchase event",
            values["purchase_users"],
            values["paywall_users"],
            None,
            "unknown",
            "PostHog can see the paywall. It cannot yet attribute a purchase reliably.",
            force_unreliable=True,
        ),
        AreaMetric(
            "learning",
            "largest_drop",
            biggest.label if biggest else "Largest funnel drop",
            biggest.lost_users if biggest else 0,
            biggest.from_users if biggest else None,
            "drop",
            bool(biggest),
            "loss" if biggest else "unknown",
            (
                f"{biggest.lost_users} people, {round(biggest.rate * 100)}% of the previous step."
                if biggest
                else "No step loses 10 or more people from a base of at least 30."
            ),
        ),
    ]


def _count(area: str, metric_id: str, label: str, numerator: int) -> AreaMetric:
    return AreaMetric(area, metric_id, label, numerator, None, "count", numerator >= MIN_RELIABLE, "steady", "")


def _rate_metric(
    area: str,
    metric_id: str,
    label: str,
    numerator: int,
    denominator: int,
    rate: float | None,
    tone: str,
    note: str,
    *,
    force_unreliable: bool = False,
) -> AreaMetric:
    reliable = denominator >= MIN_RELIABLE and not force_unreliable and rate is not None
    return AreaMetric(area, metric_id, label, numerator, denominator, "rate", reliable, tone if reliable or force_unreliable else "unknown", note)


def _majority_tone(rate: float | None, sample: int) -> str:
    if sample < MIN_RELIABLE or rate is None:
        return "unknown"
    if rate >= MAJORITY:
        return "good"
    if rate < OUTCOME_WATCH:
        return "watch"
    return "steady"


def _outcome_tone(rate: float | None, sample: int) -> str:
    if sample < MIN_RELIABLE or rate is None:
        return "unknown"
    if rate < OUTCOME_WATCH:
        return "watch"
    if rate >= MAJORITY:
        return "good"
    return "steady"


def _rate(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


# A strong path is a majority. If that same transition is also a ranked drop,
# it stays only in leakage so the screen does not praise and flag one step.
_LEAK_METRIC = {
    "activation": "question_after_install",
    "learning": "finished_after_question",
    "exam_result": "exam_user_completion",
}
_TRANSITION_METRICS = frozenset({"exam_after_finished"})
_UNSCORED = ("first_exam_pass", "d7_return", "revenuecat_revenue", "paywall_purchase")


def presentation(health: Health) -> tuple[list[AreaMetric], list[Drop], list[AreaMetric]]:
    leaked = {_LEAK_METRIC[drop.funnel_id] for drop in health.drops if drop.funnel_id in _LEAK_METRIC}
    strong = [
        metric
        for metric in health.metrics
        if metric.tone == "good" and metric.id not in leaked
        and metric.id not in _TRANSITION_METRICS and metric.id not in _UNSCORED
    ]
    unscored = [metric for metric in health.metrics if metric.id in _UNSCORED]
    return strong, list(health.drops), unscored


@dataclass
class ReconstructedAttempt:
    kind: str
    completed: bool
    answers: int
    close: str
    next_action: str
    returned: str
    next_detail: str
    saw_screen: bool
    friction: str
    open_seconds: float | None
    home_within_2s: bool
    person: str
    attempt_index: int
    later_exam_seconds: float | None
    app_after: str
    stop_day: date
    later_days: tuple[str, ...]
    started_at: datetime | None = None
    completed_at: datetime | None = None
    passed: bool | None = None
    attempt_id: str | None = None
    join_basis: str = "legacy_time_pairing"
    join_issues: tuple[str, ...] = ()


def reconstruct_attempts(rows: list[PreparedRow]) -> list[ReconstructedAttempt]:
    """Use installation-scoped IDs. Time pairing is an explicitly labelled legacy proxy."""
    owned = _events_by_person(rows)
    found: list[ReconstructedAttempt] = []
    for person, events in owned.items():
        found.extend(_attempts_for(events, "training", person))
        found.extend(_attempts_for(events, "exam", person))
    return found


def _attempts_for(events: list[PreparedRow], kind: str, person: str) -> list[ReconstructedAttempt]:
    events = sorted(events, key=_row_order)
    field = f"{kind}_session_id"
    start_name = f"{kind}_session_started"
    roots: dict[str, PreparedRow] = {}
    for row in events:
        identifier = _session_id(row, kind)
        if row.event == start_name and identifier is not None:
            roots.setdefault(identifier, row)
    legacy = [
        row for row in events
        if observation_usable(row.properties)
        and (not row.event.startswith(f"{kind}_") or _session_id(row, kind) is None)
    ]
    attempts = _legacy_attempts_for(legacy, kind, person)
    legacy_roots = [row for row in legacy if row.event == start_name]
    for attempt, root in zip(attempts, legacy_roots, strict=True):
        if root.schema is not None and root.schema >= 3:
            attempt.join_basis = "missing_attempt_id"
            attempt.join_issues = ("start_missing_session_id",)
    for identifier, root in roots.items():
        start = _utc(root.timestamp)
        matching = [row for row in events if row.properties.get(field) == identifier]
        valid = [
            row for row in matching
            if observation_usable(row.properties)
            and (row is root or _follows(row, root))
        ]
        done = [row for row in valid if row.event == f"{kind}_session_completed"]
        close_names = {"exam_session_ended", "exam_empty_exit"} if kind == "exam" else {"training_session_abandoned"}
        closes = [row for row in valid if row.event in close_names]
        issues = []
        if any(invalid_client_payload(row.properties) for row in matching):
            issues.append("invalid_payload")
        if any(row.properties.get("_warehouse_import_conflict") is True for row in matching):
            issues.append("import_identity_conflict")
        for marker, issue in (
            ("_warehouse_business_conflict", "business_identity_conflict"),
            ("_warehouse_business_invalid", "invalid_business_observation"),
            ("_warehouse_business_order_uncertain", "business_order_unproven"),
        ):
            if any(row.properties.get(marker) is True for row in matching):
                issues.append(issue)
        if any(
            row.event == f"{kind}_session_completed" and not _follows(row, root)
            for row in matching
        ):
            issues.append("completion_order_unproven")
        if kind == "exam" and done and any(
            row.event == "exam_empty_exit"
            or row.properties.get("status") in ("abandoned", "expired")
            or row.properties.get("end_reason") in ("user_ended_early", "miss_click_empty_exit", "timeout", "expired")
            for row in closes
        ):
            issues.append("conflicting_terminal_observation")
        passed_values = {row.properties.get("passed") for row in done if isinstance(row.properties.get("passed"), bool)}
        if len(passed_values) > 1:
            issues.append("conflicting_exam_result")
        completion = done[0] if done and not issues else None
        close = closes[-1] if closes else None
        questions = [row for row in valid if row.event == f"{kind}_question_answered"]
        stop_row = completion or close or (questions[-1] if questions else root)
        stop = _utc(stop_row.timestamp)
        answers = _unique_answers(questions)
        count = stop_row.properties.get("answered_count")
        if isinstance(count, int) and not isinstance(count, bool) and count >= answers:
            answers = count
        screen, friction, open_seconds, home_soon = _entry_facts(kind, events, start, stop, close)
        later_exam_seconds, app_after, stop_day, later_days = _after_stop(events, stop)
        attempts.append(ReconstructedAttempt(
            kind, completion is not None, answers,
            "Completed" if completion else _attempt_close(kind, close, valid, start, False),
            _next_learning(events, stop, kind=kind, attempt_id=identifier),
            _return_bucket(events, stop),
            _next_detail(events, stop, kind=kind, attempt_id=identifier),
            screen, friction, open_seconds, home_soon, person, 0,
            later_exam_seconds, app_after, stop_day, later_days,
            started_at=start,
            completed_at=_utc(completion.timestamp) if completion else None,
            passed=next(iter(passed_values)) if len(passed_values) == 1 else None,
            attempt_id=identifier,
            join_basis="session_id",
            join_issues=tuple(issues),
        ))
    attempts.sort(key=lambda attempt: (attempt.started_at, attempt.attempt_id or ""))
    for index, attempt in enumerate(attempts):
        attempt.attempt_index = index + 1
    return attempts


def _session_id(row: PreparedRow, kind: str) -> str | None:
    return safe_identity_id(row.properties.get(f"{kind}_session_id"))


def _row_order(row: PreparedRow) -> tuple:
    sequence = row.properties.get("event_sequence")
    sequence = sequence if isinstance(sequence, int) and not isinstance(sequence, bool) else 0
    return _utc(row.timestamp), str(row.properties.get("app_run_id") or ""), sequence, row.event_id


def _follows(row: PreparedRow, root: PreparedRow) -> bool:
    if _utc(row.timestamp) != _utc(root.timestamp):
        return _utc(row.timestamp) > _utc(root.timestamp)
    run = row.properties.get("app_run_id")
    sequence, origin = row.properties.get("event_sequence"), root.properties.get("event_sequence")
    return (
        isinstance(run, str) and bool(run) and run == root.properties.get("app_run_id")
        and isinstance(sequence, int) and not isinstance(sequence, bool)
        and isinstance(origin, int) and not isinstance(origin, bool) and sequence > origin
    )


def _unique_answers(events: list[PreparedRow]) -> int:
    slots = set()
    for row in events:
        props = row.properties
        identifier = props.get("answer_id")
        index = props.get("question_index")
        question = props.get("question_id")
        if isinstance(index, int) and not isinstance(index, bool) and index > 0:
            slots.add(("index", index))
        elif isinstance(identifier, str) and identifier:
            slots.add(("answer", identifier))
        elif isinstance(question, str) and question:
            slots.add(("question", question))
    return len(slots)


def _legacy_attempts_for(events: list[PreparedRow], kind: str, person: str) -> list[ReconstructedAttempt]:
    start_name = f"{kind}_session_started"
    done_name = f"{kind}_session_completed"
    question_name = f"{kind}_question_answered"
    close_name = "exam_session_ended" if kind == "exam" else "training_session_abandoned"
    starts = sorted(_utc(row.timestamp) for row in events if row.event == start_name)
    attempts: list[ReconstructedAttempt] = []
    for index, start in enumerate(starts):
        nxt = starts[index + 1] if index + 1 < len(starts) else None
        inside = [
            row
            for row in events
            if start <= _utc(row.timestamp) and (nxt is None or _utc(row.timestamp) < nxt)
        ]
        completed = any(row.event == done_name and _utc(row.timestamp) > start for row in inside)
        answers = _attempt_answers(inside, question_name, close_name if kind == "training" else None)
        closes = [row for row in inside if row.event == close_name and _utc(row.timestamp) >= start]
        close = closes[-1] if closes else None
        stop = _utc(close.timestamp) if close is not None else start
        if close is None and answers:
            question_times = [_utc(row.timestamp) for row in inside if row.event == question_name]
            if question_times:
                stop = max(question_times)
        screen, friction, open_seconds, home_soon = _entry_facts(kind, events, start, stop, close)
        later_exam_seconds, app_after, stop_day, later_days = _after_stop(events, stop)
        attempts.append(
            ReconstructedAttempt(
                kind,
                completed,
                answers,
                _attempt_close(kind, close, inside, start, nxt is not None),
                _next_learning(events, stop),
                _return_bucket(events, stop),
                _next_detail(events, stop),
                screen,
                friction,
                open_seconds,
                home_soon,
                person,
                index + 1,
                later_exam_seconds,
                app_after,
                stop_day,
                later_days,
                started_at=start,
                completed_at=min(
                    (_utc(row.timestamp) for row in inside if row.event == done_name and _utc(row.timestamp) > start),
                    default=None,
                ),
                passed=next((
                    row.properties["passed"] for row in inside
                    if row.event == done_name and isinstance(row.properties.get("passed"), bool)
                ), None),
            )
        )
    return attempts


def _attempt_answers(events: list[PreparedRow], question_name: str, abandon_name: str | None) -> int:
    indexes = [
        row.properties.get("question_index")
        for row in events
        if row.event == question_name and isinstance(row.properties.get("question_index"), int)
    ]
    if indexes:
        return max(value for value in indexes if isinstance(value, int) and value >= 0)
    if abandon_name is not None:
        abandons = [row for row in events if row.event == abandon_name]
        if abandons:
            recorded = abandons[-1].properties.get("answered_count")
            if isinstance(recorded, int):
                return recorded
            if isinstance(recorded, str) and recorded.isdigit():
                return int(recorded)
    return sum(row.event == question_name for row in events)


def _attempt_close(kind: str, close: PreparedRow | None, events: list[PreparedRow], start: datetime, has_next_start: bool) -> str:
    if close is not None:
        reason = close.properties.get("end_reason")
        if reason in {"timeout", "expired"}:
            return "Timeout"
        if kind == "exam" and reason == "learner_finish":
            return "Learner finish without a completion event"
        if kind == "training":
            answered = close.properties.get("answered_count")
            if answered in (0, "0"):
                return "Explicit exit, 0 answers"
            return "Explicit exit"
        return "Explicit exit"
    background = any(row.event == "Application Backgrounded" and _utc(row.timestamp) >= start for row in events)
    if background:
        return "App background"
    if not has_next_start:
        return "Window ended"
    return "New exam started" if kind == "exam" else "Another training started"


def _next_learning(
    events: list[PreparedRow],
    stop: datetime,
    *,
    kind: str | None = None,
    attempt_id: str | None = None,
) -> str:
    after = [row for row in events if _utc(row.timestamp) > stop]
    for row in after:
        if row.event == "training_session_resumed":
            if attempt_id is not None and (kind != "training" or _session_id(row, "training") != attempt_id):
                return "Another training"
            return "Same training later"
        if row.event == "training_session_started":
            return "Another training"
        if row.event == "exam_session_started":
            return "New exam"
    if not after:
        return "Window ended"
    background = next((row for row in after if row.event == "Application Backgrounded"), None)
    home = next(
        (
            row
            for row in after
            if row.event == "screen_viewed" and row.properties.get("screen_name") == "home"
        ),
        None,
    )
    if background is not None and (home is None or _utc(background.timestamp) <= _utc(home.timestamp)):
        return "App closed, no later training or exam"
    if home is not None:
        return "Home, no later training or exam"
    return "Other, no later training or exam"


def _next_detail(
    events: list[PreparedRow],
    stop: datetime,
    *,
    kind: str | None = None,
    attempt_id: str | None = None,
) -> str:
    after = [row for row in events if _utc(row.timestamp) > stop]
    learn = next(
        (
            row
            for row in after
            if row.event in {"training_session_started", "training_session_resumed", "exam_session_started"}
        ),
        None,
    )
    if learn is None:
        if not after:
            return "Window ended"
        background = next((row for row in after if row.event == "Application Backgrounded"), None)
        home = next(
            (
                row
                for row in after
                if row.event == "screen_viewed" and row.properties.get("screen_name") == "home"
            ),
            None,
        )
        if background is not None and (home is None or _utc(background.timestamp) <= _utc(home.timestamp)):
            return "App closed, no later training or exam"
        if home is not None:
            return "Home, no later training or exam"
        return "Other, no later training or exam"
    delta = _utc(learn.timestamp) - stop
    if learn.event == "training_session_resumed":
        kind = (
            "Training" if attempt_id is not None and
            (kind != "training" or _session_id(learn, "training") != attempt_id)
            else "Same training"
        )
    elif learn.event == "training_session_started":
        kind = "Training"
    else:
        kind = "New exam"
    if delta <= timedelta(seconds=15):
        when = "within 15 seconds"
    elif delta <= timedelta(minutes=15):
        when = "within 15 minutes"
    else:
        when = "later"
    return f"{kind}, {when}"


def _entry_facts(
    kind: str,
    events: list[PreparedRow],
    start: datetime,
    stop: datetime,
    close: PreparedRow | None,
) -> tuple[bool, str, float | None, bool]:
    if close is not None:
        end_bound = stop
        open_seconds = (stop - start).total_seconds()
    else:
        background = next(
            (
                row
                for row in events
                if row.event == "Application Backgrounded" and _utc(row.timestamp) > start
            ),
            None,
        )
        end_bound = _utc(background.timestamp) if background is not None else start + timedelta(seconds=15)
        open_seconds = (end_bound - start).total_seconds()
    span = [row for row in events if start <= _utc(row.timestamp) <= end_bound]
    screen_name = "question_training" if kind == "training" else "exam_session"
    saw_screen = any(
        row.event == "screen_viewed" and row.properties.get("screen_name") == screen_name
        for row in span
    )
    friction = "none"
    for row in span:
        if row.event in {"exam_start_failed", "client_error_logged"} or "error" in row.event:
            friction = "technical"
            break
        if row.event in {"paywall_viewed", "premium_gate_viewed", "ad_shown"}:
            friction = "paywall_or_ad"
    home_within_2s = any(
        row.event == "screen_viewed"
        and row.properties.get("screen_name") == "home"
        and stop < _utc(row.timestamp) <= stop + timedelta(seconds=2)
        for row in events
    )
    return saw_screen, friction, open_seconds, home_within_2s


def _return_bucket(events: list[PreparedRow], stop: datetime) -> str:
    after = [row for row in events if _utc(row.timestamp) > stop]
    learn = next(
        (
            row
            for row in after
            if row.event in {"training_session_started", "training_session_resumed", "exam_session_started"}
        ),
        None,
    )
    if learn is None:
        return "Did not return"
    delta = _utc(learn.timestamp) - stop
    if delta <= timedelta(minutes=15):
        return "Within 15 minutes"
    if delta <= timedelta(hours=24):
        return "Within 24 hours"
    return "Later in the window"


def _after_stop(events: list[PreparedRow], stop: datetime) -> tuple[float | None, str, date, tuple[str, ...]]:
    stop_day = _utc(stop).astimezone(WARSAW).date()
    exam = next(
        (row for row in events if row.event == "exam_session_started" and _utc(row.timestamp) > stop),
        None,
    )
    later_exam_seconds = None if exam is None else (_utc(exam.timestamp) - stop).total_seconds()
    later = [row for row in events if _utc(row.timestamp) > stop + timedelta(seconds=2)]
    later_days = tuple(
        sorted(
            {
                _utc(row.timestamp).astimezone(WARSAW).date().isoformat()
                for row in later
                if _utc(row.timestamp).astimezone(WARSAW).date() > stop_day
            }
        )
    )
    if not later:
        app_after = "No later event in the window"
    elif later_days:
        app_after = "Back on a later day"
    else:
        app_after = "Same day only"
    return later_exam_seconds, app_after, stop_day, later_days


def _day_return(items: list[ReconstructedAttempt], offset: int, window_end: date | None) -> tuple[int, int, int]:
    if window_end is None:
        return 0, 0, len(items)
    back = 0
    mature = 0
    for item in items:
        target = item.stop_day + timedelta(days=offset)
        if target >= window_end:
            continue
        mature += 1
        if target.isoformat() in item.later_days:
            back += 1
    return back, mature, len(items) - mature


def _exam_again_after_training(seconds: float | None) -> str:
    if seconds is None:
        return "No later exam in this window"
    if seconds <= 15 * 60:
        return "Later exam within 15 minutes"
    if seconds <= 24 * 3600:
        return "Later exam within 24 hours"
    return "Later exam later in the window"


def _attempt_drill(attempts: list[ReconstructedAttempt], kind: str, drill_id: str, window_end: date | None) -> dict:
    selected = [item for item in attempts if item.kind == kind]
    done = sum(item.completed for item in selected)
    unfinished = [item for item in selected if not item.completed]
    if kind == "exam":
        return _exam_attempt_drill(drill_id, selected, done, unfinished, window_end)
    depth: Counter[str] = Counter()
    nxt: Counter[str] = Counter()
    for item in unfinished:
        depth["0 answers" if item.answers <= 0 else _depth_bucket(item.answers)] += 1
        nxt[item.next_action] += 1
    switched = nxt.get("Another training", 0)
    exams = nxt.get("New exam", 0)
    no_return_items = [item for item in unfinished if item.next_action in _NO_RETURN]
    no_return = len(no_return_items)
    people = len({item.person for item in no_return_items})
    app: Counter[str] = Counter(item.app_after for item in no_return_items)
    day1_back, day1_mature, day1_early = _day_return(no_return_items, 1, window_end)
    day7_back, day7_mature, day7_early = _day_return(no_return_items, 7, window_end)
    groups = [
        _group(
            "No later training or exam",
            {label: nxt[label] for label in _NO_RETURN},
            _NO_RETURN,
            base=no_return or None,
            drop_empty=True,
        ),
        _group("Back in the app", app, _APP_AFTER, base=no_return or None, drop_empty=True),
        _group("What happened next", nxt, _NEXT_ORDER, base=len(unfinished), drop_empty=True),
        _group("Answers before it stopped", depth, _DEPTH_ORDER, base=len(unfinished)),
    ]
    _append_day_groups(groups, "No later learning", day1_back, day1_mature, day1_early, day7_back, day7_mature, day7_early, window_end)
    return {
        "id": drill_id,
        "title": "Training attempts with no later learning",
        "people": no_return,
        "tailPeople": people,
        "started": len(selected),
        "completed": done,
        "cohort": f"{no_return} attempts, {people} installation identities. {_join_label(selected, kind)}",
        "identityGrain": "app_user_id_installation",
        "joinQuality": dict(Counter(item.join_basis for item in selected)),
        "note": (
            f"{no_return} attempts and {people} installation identities had no later training or exam in the observed data. "
            f"{switched} of {len(unfinished)} incomplete attempts were followed by another training and {exams} by an exam, "
            f"so {len(unfinished)} of {len(selected)} is not scored as a drop-off. "
            "A later completion does not erase the earlier attempt."
        ),
        "groups": groups,
    }


def _append_day_groups(
    groups: list[dict],
    prefix: str,
    day1_back: int,
    day1_mature: int,
    day1_early: int,
    day7_back: int,
    day7_mature: int,
    day7_early: int,
    window_end: date | None,
) -> None:
    if window_end is None:
        return
    base = day1_mature + day1_early
    groups.append(
        _group(
            f"{prefix} — next calendar day",
            {
                "Back the next calendar day": day1_back,
                "No event the next calendar day": day1_mature - day1_back,
                "Next day is outside this window": day1_early,
            },
            [
                "Back the next calendar day",
                "No event the next calendar day",
                "Next day is outside this window",
            ],
            base=base or None,
        )
    )
    groups.append(
        _group(
            f"{prefix} — day 7",
            {
                "Back on day 7": day7_back,
                "No event on day 7": day7_mature - day7_back,
                "Day 7 is outside this window": day7_early,
            },
            ["Back on day 7", "No event on day 7", "Day 7 is outside this window"],
            base=base or None,
        )
    )


def _exam_attempt_drill(
    drill_id: str,
    selected: list[ReconstructedAttempt],
    done: int,
    unfinished: list[ReconstructedAttempt],
    window_end: date | None,
) -> dict:
    nxt: Counter[str] = Counter()
    zeros = [item for item in unfinished if item.answers <= 0]
    zero_next: Counter[str] = Counter()
    for item in unfinished:
        nxt[item.next_detail] += 1
    for item in zeros:
        zero_next[item.next_detail] += 1
    new_exam = sum(count for label, count in nxt.items() if label.startswith("New exam"))
    training = sum(count for label, count in nxt.items() if label.startswith("Training") or label.startswith("Same training"))
    quick_restart = zero_next.get("New exam, within 15 seconds", 0)
    screen = sum(item.saw_screen for item in zeros)
    left_quickly = sum(item.open_seconds is not None and item.open_seconds <= 15 for item in zeros)
    home_soon = sum(item.home_within_2s for item in zeros)
    paywall = sum(item.friction == "paywall_or_ad" for item in zeros)
    technical = sum(item.friction == "technical" for item in zeros)
    tail = [item for item in unfinished if item.next_detail in _NO_RETURN]
    tail_people = len({item.person for item in tail})
    switched = [
        item
        for item in unfinished
        if item.next_detail.startswith("Training") or item.next_detail.startswith("Same training")
    ]
    again: Counter[str] = Counter(_exam_again_after_training(item.later_exam_seconds) for item in switched)
    again_people = len({item.person for item in switched if item.later_exam_seconds is not None})
    tail_depth: Counter[str] = Counter(
        "0 answers" if item.answers <= 0 else _depth_bucket(item.answers) for item in tail
    )
    start_no: Counter[str] = Counter(
        "First exam start in this window" if item.attempt_index == 1 else f"Exam start {item.attempt_index} in this window"
        for item in tail
    )
    app: Counter[str] = Counter(item.app_after for item in tail)
    day1_back, day1_mature, day1_early = _day_return(tail, 1, window_end)
    day7_back, day7_mature, day7_early = _day_return(tail, 7, window_end)
    came_back = sum(again.values()) - again.get("No later exam in this window", 0)
    groups = [
        _group("What happened next", nxt, _EXAM_NEXT_ORDER, base=len(unfinished), drop_empty=True),
        _group("After training, a later exam", again, _LOOP_ORDER, base=len(switched) or None, drop_empty=True),
        _group("No later learning — answers", tail_depth, _DEPTH_ORDER, base=len(tail) or None, drop_empty=True),
        _group("No later learning — which start", start_no, base=len(tail) or None, drop_empty=True),
        _group("No later learning — back in the app", app, _APP_AFTER, base=len(tail) or None, drop_empty=True),
        _group("0 answers — what happened next", zero_next, _EXAM_NEXT_ORDER, base=len(zeros), drop_empty=True),
        _group(
            "0 answers — on the exam screen",
            {
                "Exam screen opened": screen,
                "Left within 15 seconds": left_quickly,
                "Home within 2 seconds": home_soon,
                "Paywall or ad before the exit": paywall,
                "Technical error before the exit": technical,
            },
            [
                "Exam screen opened",
                "Left within 15 seconds",
                "Home within 2 seconds",
                "Paywall or ad before the exit",
                "Technical error before the exit",
            ],
        ),
    ]
    _append_day_groups(groups, "No later learning", day1_back, day1_mature, day1_early, day7_back, day7_mature, day7_early, window_end)
    return {
        "id": drill_id,
        "title": "Exam attempts with no later learning",
        "people": len(tail),
        "tailPeople": tail_people,
        "started": len(selected),
        "completed": done,
        "cohort": (
            f"{len(tail)} attempts, {tail_people} installation identities. "
            f"{_join_label(selected, 'exam')} "
            "Each list adds up on its own."
        ),
        "identityGrain": "app_user_id_installation",
        "joinQuality": dict(Counter(item.join_basis for item in selected)),
        "note": (
            f"{len(selected)} starts, {done} completed, {len(unfinished)} not completed. "
            f"{new_exam + training} of {len(unfinished)} continued in another exam or training. "
            f"{len(tail)} attempts, {tail_people} people, had no later training or exam. "
            f"Of {len(switched)} that went to training, {came_back} started an exam again"
            f"{f', across {again_people} people' if came_back else ''}. "
            f"Of {len(zeros)} with 0 answers, the exam screen opened {screen} times. "
            f"Paywall or ad before the exit: {paywall}. Technical error before the exit: {technical}. "
            f"{quick_restart} restarted an exam within 15 seconds. "
            "A later exam after training is a sequence, not a reason they left. "
            "A later completion does not erase the earlier attempt."
        ),
        "groups": groups,
    }


def describe_drills(rows: list[PreparedRow], window_end: date | None = None) -> list[dict]:
    attempts = reconstruct_attempts(rows)
    return [
        _attempt_drill(attempts, "training", "activity_unfinished", window_end),
        _attempt_drill(attempts, "exam", "exam_unfinished", window_end),
    ]


def _join_label(selected: list[ReconstructedAttempt], kind: str) -> str:
    counts = Counter(item.join_basis for item in selected)
    return (
        f"{counts['session_id']} attempts joined by installation-scoped {kind}_session_id. "
        f"{counts['legacy_time_pairing']} reconstructed {kind} attempts paired by time (legacy proxy). "
        f"{counts['missing_attempt_id']} starts missing required IDs. "
        f"{sum(bool(item.join_issues) for item in selected)} attempts have join/validation issues."
    )


def _events_by_person(rows: list[PreparedRow]) -> dict[str, list[PreparedRow]]:
    linked = _primary_by_distinct(rows)
    grouped: dict[str, list[PreparedRow]] = {}
    for row in rows:
        key = row.analysis_key if row.key_source == "primary" and row.analysis_key else None
        if key is None and row.distinct_id:
            key = linked.get(row.distinct_id)
        if key is None:
            continue
        grouped.setdefault(key, []).append(row)
    return grouped



_DEPTH_ORDER = ["0 answers", "1–5 questions", "6–15 questions", "16–25 questions", "26+ questions"]
_NO_RETURN = [
    "Home, no later training or exam",
    "App closed, no later training or exam",
    "Other, no later training or exam",
    "Window ended",
]
_EXAM_NEXT_ORDER = [
    "New exam, within 15 seconds",
    "New exam, within 15 minutes",
    "New exam, later",
    "Training, within 15 seconds",
    "Training, within 15 minutes",
    "Training, later",
    "Same training, within 15 seconds",
    "Same training, within 15 minutes",
    "Same training, later",
    *_NO_RETURN,
]
_APP_AFTER = ["No later event in the window", "Same day only", "Back on a later day"]
_LOOP_ORDER = [
    "Later exam within 15 minutes",
    "Later exam within 24 hours",
    "Later exam later in the window",
    "No later exam in this window",
]
_NEXT_ORDER = [
    "Another training",
    "New exam",
    "Same training later",
    "Home, no later training or exam",
    "App closed, no later training or exam",
    "Window ended",
    "Other, no later training or exam",
]


def _depth_bucket(count: int) -> str:
    if count <= 0:
        return "No question"
    if count <= 5:
        return "1–5 questions"
    if count <= 15:
        return "6–15 questions"
    if count <= 25:
        return "16–25 questions"
    return "26+ questions"




def _group(title: str, counts, order: list[str] | None = None, base: int | None = None, drop_empty: bool = False) -> dict:
    if order is None:
        rows = [{"label": label, "count": count} for label, count in counts.items()]
        rows.sort(key=lambda item: item["count"], reverse=True)
    else:
        rows = [{"label": label, "count": counts.get(label, 0)} for label in order]
        extra = [label for label in counts if label not in order and counts[label]]
        rows.extend({"label": label, "count": counts[label]} for label in extra)
    if drop_empty:
        rows = [row for row in rows if row["count"]]
    group: dict = {"title": title, "rows": rows}
    if base:
        group["base"] = base
    return group

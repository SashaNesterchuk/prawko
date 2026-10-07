"""Shared dump builders for engine tests."""

from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


LEARNING_INTERACTION_EVENTS = (
    "training_feedback_continued", "training_result_viewed", "training_result_action",
    "training_answers_review_opened", "training_answers_review_question_viewed",
    "training_answers_review_closed", "training_session_abandoned", "training_session_empty",
    "exam_session_resumed", "exam_session_ended", "exam_empty_exit", "exam_result_viewed",
    "exam_result_action", "exam_answers_review_opened", "exam_answers_review_question_viewed",
    "exam_answers_review_closed", "exam_question_navigation_requested", "exam_question_flag_changed",
    "exam_restart_gate_shown", "exam_restart_selected", "answer_explanation_viewed",
    "diagnostic_result_action", "diagnostic_reminder_shown", "diagnostic_reminder_resolved",
    "exam_start_requested", "exam_start_failed", "learning_access_blocked", "learning_access_block_action",
    "exam_category_mismatch_viewed", "exam_category_mismatch_resolved", "exam_category_mismatch_action",
)


def write_dump(path: Path, *, day: str, exported_at: str, events: list[dict]) -> Path:
    parsed_day = date.fromisoformat(day)
    zone = ZoneInfo("Europe/Warsaw")
    path.write_text(
        json.dumps(
            {
                "exportedAt": exported_at,
                "day": day,
                "timezone": "Europe/Warsaw",
                "events": events,
                "coverage": {
                    "pagination_complete": True,
                    "truncated": False,
                    "window_start": datetime.combine(parsed_day, time.min, tzinfo=zone).isoformat(),
                    "window_end": datetime.combine(parsed_day + timedelta(days=1), time.min, tzinfo=zone).isoformat(),
                    "delivery_watermark": exported_at,
                },
            }
        )
    )
    return path


def event(name: str, timestamp: str, user: str, **properties) -> dict:
    body = {
        "app_user_id": user,
        "app_version": "1.0.29",
        "analytics_schema_version": 3,
        "exam_country": "PL",
        "locale": "pl",
        "platform": "ios",
        "is_plus": False,
        "auth_mode": "guest",
    }
    body.update(properties)
    return {
        "uuid": f"{name}-{user}-{timestamp}",
        "event": name,
        "timestamp": timestamp,
        "distinct_id": user,
        "person_id": "person",
        "session_id": "session",
        "properties": body,
    }

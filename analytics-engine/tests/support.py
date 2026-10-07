"""Shared dump builders for engine tests."""

from __future__ import annotations

import json
from pathlib import Path


def write_dump(path: Path, *, day: str, exported_at: str, events: list[dict]) -> Path:
    path.write_text(
        json.dumps(
            {
                "exportedAt": exported_at,
                "day": day,
                "timezone": "Europe/Warsaw",
                "events": events,
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

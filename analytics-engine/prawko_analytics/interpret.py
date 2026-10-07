"""Pick the single interpretation that applies to one event row."""

from __future__ import annotations

from prawko_analytics.contract import Interpretation


def values_equal(expected, actual) -> bool:
    if isinstance(expected, bool):
        if isinstance(actual, bool):
            return actual is expected
        if isinstance(actual, str):
            return actual.lower() == ("true" if expected else "false")
        return False
    if isinstance(expected, int) and not isinstance(expected, bool):
        try:
            return int(actual) == expected
        except (TypeError, ValueError):
            return False
    if actual is None:
        return False
    return str(actual) == str(expected)


def schema_matches(interpretation: Interpretation, schema: int | None) -> bool:
    """A missing schema matches only an unbounded interpretation."""
    if schema is None:
        return interpretation.since_schema is None and interpretation.until_schema is None
    if interpretation.since_schema is not None and schema < interpretation.since_schema:
        return False
    if interpretation.until_schema is not None and schema >= interpretation.until_schema:
        return False
    return True


def version_matches(interpretation: Interpretation, app_version: str | None) -> bool:
    if app_version is None:
        return (
            interpretation.since_app_version is None
            and interpretation.until_app_version is None
        )
    parsed = _version(app_version)
    if interpretation.since_app_version is not None and parsed < _version(interpretation.since_app_version):
        return False
    if interpretation.until_app_version is not None and parsed >= _version(interpretation.until_app_version):
        return False
    return True


def select_interpretation(
    interpretations: tuple[Interpretation, ...] | list[Interpretation],
    *,
    schema: int | None,
    app_version: str | None,
    properties: dict,
) -> tuple[Interpretation | None, str]:
    matched = [
        item
        for item in interpretations
        if schema_matches(item, schema)
        and version_matches(item, app_version)
        and _properties_match(item.when_properties, properties)
    ]
    if not matched:
        return None, "none"
    best_properties = max(len(item.when_properties) for item in matched)
    matched = [item for item in matched if len(item.when_properties) == best_properties]
    best_tightness = max(item.tightness for item in matched)
    matched = [item for item in matched if item.tightness == best_tightness]
    if len(matched) != 1:
        return None, "ambiguous"
    return matched[0], "matched"


def _properties_match(expected: dict, properties: dict) -> bool:
    return all(
        type(properties.get(key)) is int and properties[key] == value
        if key == "trial_eligibility_observation_version"
        else values_equal(value, properties.get(key))
        for key, value in expected.items()
    )


def _version(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in value.split("."))

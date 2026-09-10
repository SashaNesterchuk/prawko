from __future__ import annotations

import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
UA = "PrawkoExplanationRewrite/1.0 (local; driving-theory corpus)"


def work_dir(country: str) -> Path:
    path = REPO / "supabase" / "backups" / "rewrite-explanations-v2" / country.lower()
    path.mkdir(parents=True, exist_ok=True)
    return path


def cache_dir(country: str) -> Path:
    path = work_dir(country) / "cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def legal_dir(country: str) -> Path:
    path = REPO / "data" / "legal" / country.lower()
    path.mkdir(parents=True, exist_ok=True)
    (path / "raw").mkdir(exist_ok=True)
    return path


def parse_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if not match:
            continue
        values[match.group(1)] = match.group(2).strip().strip("'\"")
    return values


OPENAI_ONLY_KEYS = ("OPENAI_API_KEY", "EXPLANATION_REWRITE_MODEL")
DASHBOARD_ENV_FILES = (
    Path("/Users/sashanesterchuk/mind-jar/mindjar-dashboard/.env"),
    Path("/Users/sashanesterchuk/mind-jar/mindjar-dashboard/.env.local"),
)


def load_env() -> dict[str, str]:
    merged: dict[str, str] = {}
    for path in (
        REPO / ".env.local",
        REPO / "mobile" / ".env.local",
        REPO.parent / ".env.local",
    ):
        merged.update(parse_env_file(path))
    # Dashboard env has OpenAI, but its Supabase project is not Prawko.
    for path in DASHBOARD_ENV_FILES:
        extra = parse_env_file(path)
        for key in OPENAI_ONLY_KEYS:
            if extra.get(key) and not merged.get(key):
                merged[key] = extra[key]
    for key, value in os.environ.items():
        if value:
            merged[key] = value
    return merged


def atomic_write(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def strip_diacritics(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )


def tokenize(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", strip_diacritics(value.lower()))


def localized(holder: object, locale: str, *fallbacks: str) -> str:
    if isinstance(holder, str):
        return clean_text(holder)
    if not isinstance(holder, dict):
        return ""
    for key in (locale, *fallbacks):
        value = holder.get(key)
        if isinstance(value, str) and value.strip():
            return clean_text(value)
    return ""


def http_get(url: str, timeout: int = 90, retries: int = 5) -> bytes:
    last_error: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code in {429, 502, 503} and attempt < retries - 1:
                time.sleep(min(40, 3 * (2**attempt)))
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(min(20, 2**attempt))
    raise last_error or RuntimeError(f"GET failed: {url}")


def http_json(
    method: str,
    url: str,
    headers: dict[str, str],
    body=None,
    timeout: int = 180,
):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:1200]
        raise RuntimeError(f"{method} {url} -> {exc.code}: {detail}") from exc

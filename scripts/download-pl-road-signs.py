#!/usr/bin/env python3
"""Download PL road sign SVGs from Wikimedia Commons gallery page."""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import unquote

PAGE_URL = "https://commons.wikimedia.org/wiki/Road_signs_of_Poland"
OUT_DIR = Path(__file__).resolve().parents[1] / "data" / "pl-road-signs-wikimedia"
UA = "Prawko/1.0 (https://github.com/mindjar/prawko; local asset fetch)"
HEADERS = {"User-Agent": UA, "Referer": "https://commons.wikimedia.org/"}


def fetch_page() -> str:
    req = urllib.request.Request(PAGE_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8")


def thumb_to_original(thumb_url: str) -> str | None:
    # .../commons/thumb/a/ab/File.svg/120px-File.svg.png -> .../commons/a/ab/File.svg
    m = re.match(
        r"(https://upload\.wikimedia\.org/wikipedia/commons)/thumb/([^/]+/[^/]+/(.+?))/\d+px-",
        thumb_url,
    )
    if not m:
        return None
    return f"{m.group(1)}/{m.group(2)}"


def collect_files(page_html: str) -> dict[str, str]:
    files: dict[str, str] = {}
    for m in re.finditer(
        r'href="/wiki/File:(PL_road_sign_[^"]+)" class="mw-file-description"[^>]*>.*?src="(https://upload\.wikimedia\.org[^"]+)"',
        page_html,
        flags=re.DOTALL,
    ):
        name = unquote(m.group(1))
        original = thumb_to_original(m.group(2))
        if original and name not in files:
            files[name] = original
    return dict(sorted(files.items()))


def download(url: str, dest: Path, retries: int = 6) -> None:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=120) as resp:
                dest.write_bytes(resp.read())
            return
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            raise


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Fetching {PAGE_URL}")
    page = fetch_page()
    files = collect_files(page)
    print(f"Found {len(files)} PL road sign files")

    existing = {p.name for p in OUT_DIR.glob("PL_road_sign_*.svg")}
    todo = [(name, url) for name, url in files.items() if name not in existing]
    print(f"Already downloaded: {len(existing)}, remaining: {len(todo)}")

    failed: list[tuple[str, str]] = []
    for idx, (name, url) in enumerate(todo, 1):
        try:
            download(url, OUT_DIR / name)
        except Exception as exc:  # noqa: BLE001
            failed.append((name, str(exc)))
        if idx % 25 == 0:
            print(f"  {idx}/{len(todo)}")
        time.sleep(1.2)

    total = sorted(p.name for p in OUT_DIR.glob("PL_road_sign_*.svg"))
    manifest = {
        "source": PAGE_URL,
        "license_note": "Wikimedia Commons — check each file page for license details.",
        "count": len(total),
        "failed": [{"file": n, "error": e} for n, e in failed],
        "files": total,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Done: {len(total)}/{len(files)} on disk, {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

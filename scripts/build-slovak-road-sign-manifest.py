#!/usr/bin/env python3
"""Build the SK road-sign catalogue from Wikimedia Commons SVG titles.

Images stay remote (PNG thumbs). Nothing is copied into the app bundle.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "data" / "sk-road-signs-wikimedia"
COMMONS_CACHE = OUT_DIR / "commons-files.json"
API = "https://commons.wikimedia.org/w/api.php"
UA = "PrawkoSKSigns/1.0 (local catalog build; https://github.com/mindjar/prawko)"
FILE_RE = re.compile(r"^File:(\d{3}(?:[-,]\d+)*)\s+(.+)\.svg$", re.I)
SKIP_TITLES = {
    "File:SK road sign 230.svg",
    "File:SK road sign 231.svg",
    "File:SK road sign 270.svg",
}


def category_id(code: str) -> str:
    head = int(code.split("-")[0].split(",")[0])
    if 101 <= head <= 199:
        return "A"
    if head in {201, 202, 203} or 301 <= head <= 304:
        return "G"
    if head in {215, 216}:
        return "B"
    if 210 <= head <= 214 or 220 <= head <= 229 or head in {250, 251, 260, 261}:
        return "C"
    if 230 <= head <= 247 or 253 <= head <= 271:
        return "B"
    if head in {248, 249}:
        return "D"
    if 272 <= head <= 339:
        return "D"
    if 340 <= head <= 399:
        return "E"
    if 401 <= head <= 499:
        return "D"
    if 501 <= head <= 599:
        return "T"
    if 700 <= head <= 729:
        return "F"
    if head >= 730:
        return "S"
    return "D"


def fetch(**params):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code in {429, 503} and attempt < 7:
                time.sleep(4 * (attempt + 1))
                continue
            raise


def file_path_url(filename: str, width: int | None = None) -> str:
    quoted = urllib.parse.quote(filename)
    url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{quoted}"
    if width:
        return f"{url}?width={width}"
    return url


def unique_id(code: str, used: dict[str, int]) -> str:
    count = used.get(code, 0)
    used[code] = count + 1
    if count == 0:
        return code
    return f"{code}{chr(ord('a') + count)}"


def load_commons_files() -> list[dict]:
    if not COMMONS_CACHE.exists():
        raise SystemExit(f"Missing {COMMONS_CACHE}; fetch Commons category members first.")
    return json.loads(COMMONS_CACHE.read_text())


def imageinfo_for(titles: list[str]) -> dict[str, dict]:
    info: dict[str, dict] = {}
    batch_size = 40
    for start in range(0, len(titles), batch_size):
        batch = titles[start : start + batch_size]
        data = fetch(
            action="query",
            titles="|".join(batch),
            prop="imageinfo",
            iiprop="url|mime|size",
            iiurlwidth="256",
        )
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            title = page.get("title")
            imageinfo = (page.get("imageinfo") or [None])[0]
            if title and imageinfo:
                info[title] = imageinfo
        time.sleep(1.1)
        print(f"  imageinfo {min(start + batch_size, len(titles))}/{len(titles)}")
    return info


def main() -> int:
    files = load_commons_files()
    used: dict[str, int] = {}
    parsed: list[dict] = []
    for entry in files:
        title = entry["title"]
        if title in SKIP_TITLES:
            continue
        match = FILE_RE.match(title)
        if not match:
            print("skip unparsed", title)
            continue
        code = match.group(1).replace(",", "-")
        name = match.group(2).rstrip()
        filename = title.removeprefix("File:")
        parsed.append(
            {
                "id": unique_id(code, used),
                "code": code,
                "name": name,
                "categoryId": category_id(code),
                "commonsTitle": title,
                "filename": filename,
                "commonsCategory": entry["category"],
            }
        )

    print(f"parsed {len(parsed)} signs")
    info = imageinfo_for([item["commonsTitle"] for item in parsed])
    signs = []
    missing = 0
    for item in parsed:
        image = info.get(item["commonsTitle"])
        if image:
            image_url = image["url"].split("?")[0]
            preview_url = (image.get("thumburl") or file_path_url(item["filename"], 256)).split("?")[0]
        else:
            missing += 1
            image_url = file_path_url(item["filename"])
            preview_url = file_path_url(item["filename"], 256)
        signs.append(
            {
                **item,
                "imageUrl": image_url,
                "previewUrl": preview_url,
            }
        )

    signs.sort(key=lambda sign: tuple(int(part) if part.isdigit() else part for part in re.split(r"(\d+)", sign["id"])))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": {
            "commonsRoot": "Category:SVG road signs in Slovakia",
            "law": "30/2020 Z. z.",
        },
        "count": len(signs),
        "missingImageInfo": missing,
        "signs": signs,
    }
    out_path = OUT_DIR / "manifest.json"
    out_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    slim = {
        "generatedAt": manifest["generatedAt"],
        "count": manifest["count"],
        "signs": [
            {
                "id": sign["id"],
                "code": sign["code"],
                "name": sign["name"],
                "categoryId": sign["categoryId"],
                "filename": sign["filename"],
                "imageUrl": sign["imageUrl"],
                "previewUrl": sign["previewUrl"],
            }
            for sign in signs
        ],
    }
    slim_path = (
        REPO / "mobile" / "variants" / "slovak" / "source-manifest.json"
    )
    slim_path.write_text(json.dumps(slim, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {out_path} ({len(signs)} signs, missing imageinfo={missing})")
    print(f"wrote {slim_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

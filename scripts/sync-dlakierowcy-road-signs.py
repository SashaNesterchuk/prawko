#!/usr/bin/env python3
"""Sync Polish road-sign catalog from Figma-linked dlakierowcy lists + Wikimedia SVGs."""

from __future__ import annotations

import json
import re
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

UA = "Prawko/1.0 (https://github.com/mindjar/prawko; catalog sync)"
HEADERS = {"User-Agent": UA, "Referer": "https://znaki-drogowe.dlakierowcy.info/"}
BASE = "https://znaki-drogowe.dlakierowcy.info"

CATEGORY_PAGES = {
    "A": ("10950", "Znaki ostrzegawcze"),
    "B": ("10951", "Znaki zakazu"),
    "C": ("10953", "Znaki nakazu"),
    "D": ("10954", "Znaki informacyjne"),
    "E": ("10955", "Znaki kierunku i miejscowości"),
    "F": ("10956", "Znaki uzupełniające"),
    "T": ("10959", "Tabliczki do znaków drogowych"),
    "G": ("10957", "Znaki dodatkowe"),
    "P": ("27379", "Znaki drogowe poziome"),
    "S": ("10958", "Znaki świetlne"),
}

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "pl-road-signs-wikimedia"
MOBILE_DIR = ROOT / "mobile" / "assets" / "pl-road-signs-wikimedia"
CACHE_DIR = Path("/tmp/prawko-dlakierowcy")
METADATA_PATH = DATA_DIR / "dlakierowcy.metadata.json"

WIKI_CANDIDATES = {
    "E": ["File:Znak {code}.svg"],
    "P": ["File:Znak {code}.svg"],
    "S": ["File:Sygnalizator {code}.svg", "File:Znak {code}.svg"],
    "F": ["File:PL road sign {code}.svg", "File:Znak {code}.svg"],
    "T": ["File:Znak {code}.svg", "File:PL road sign {code}.svg"],
    "D": ["File:PL road sign {code}.svg", "File:Znak {code}.svg"],
}


def fetch_bytes(url: str, retries: int = 6) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise
        except urllib.error.URLError:
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    raise RuntimeError(f"Failed to fetch {url}")


def fetch_text(url: str) -> str:
    return fetch_bytes(url).decode("utf-8", "replace")


def strip_html(value: str) -> str:
    text = unescape(value)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.replace("\xa0", " ").strip()


def normalize_code(raw: str) -> str:
    compact = re.sub(r"\s+", "", raw)
    match = re.match(r"^([A-Z]+-\d+)([A-Za-z]*)$", compact)
    if not match:
        return compact
    return match.group(1) + match.group(2).lower()


def parse_list_item(block: str) -> dict | None:
    href_match = re.search(
        r"href=['\"](/s/4089/77039-lista/\d+-[^'\"]+)['\"]", block, flags=re.I
    )
    img_match = re.search(
        r"src=['\"]/img/wo/(obrazek_maly_\d+\.png)['\"]", block, flags=re.I
    )
    title_match = re.search(
        r'class="wo_l_tytul"><a[^>]*>(.*?)</a>', block, flags=re.S | re.I
    )
    intro_match = re.search(
        r'class="wo_l_wstep">(.*?)</div>', block, flags=re.S | re.I
    )
    if not href_match or not title_match:
        return None

    title = strip_html(title_match.group(1))
    code_match = re.match(r"Znak\s+([A-Z]+-\s*\d+[A-Za-z]*)\s*(.*)$", title)
    if not code_match:
        return None

    code = normalize_code(code_match.group(1))
    name = code_match.group(2).strip(" –-") or code
    return {
        "id": code,
        "categoryId": code.split("-")[0],
        "name": name,
        "description": strip_html(intro_match.group(1) if intro_match else ""),
        "detailPath": href_match.group(1),
        "thumb": f"{BASE}/img/wo/{img_match.group(1)}" if img_match else None,
    }


def parse_list_page(html: str) -> list[dict]:
    blocks = re.findall(
        r'<div CLASS="nr_ramkaartykulu">(.*?)</div></div>',
        html,
        flags=re.S | re.I,
    )
    items = []
    seen = set()
    for block in blocks:
        item = parse_list_item(block)
        if not item or item["id"] in seen:
            continue
        seen.add(item["id"])
        items.append(item)
    return items


def parse_detail_page(html: str) -> tuple[str, str]:
    intro = strip_html(
        (re.search(r'<div class="wo_wstep">(.*?)</div>', html, flags=re.S) or [None, ""])[1]
    )
    body = strip_html(
        (re.search(r'<div class="wo_tekst">(.*?)</div>', html, flags=re.S) or [None, ""])[1]
    )
    return intro, body


def first_sentence(value: str) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    if not text:
        return ""
    match = re.match(r"(.+?[.!?])(?:\s|$)", text)
    return (match.group(1) if match else text).strip()


def scrape_categories() -> list[dict]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    signs: list[dict] = []
    for category_id, (page_id, _title) in CATEGORY_PAGES.items():
        url = f"{BASE}/s/4089/77039-lista.htm?c1_1={page_id}"
        cache_path = CACHE_DIR / f"list-{category_id}.html"
        if cache_path.exists():
            html = cache_path.read_text(encoding="utf-8")
        else:
            html = fetch_text(url)
            cache_path.write_text(html, encoding="utf-8")
            time.sleep(0.4)
        items = parse_list_page(html)
        print(f"  {category_id}: {len(items)} signs from list")
        signs.extend(items)
    return signs


def enrich_descriptions(signs: list[dict]) -> None:
    for index, sign in enumerate(signs, 1):
        if sign["description"]:
            continue
        cache_path = CACHE_DIR / f"detail-{sign['id']}.html"
        if cache_path.exists():
            html = cache_path.read_text(encoding="utf-8")
        else:
            html = fetch_text(BASE + sign["detailPath"])
            cache_path.write_text(html, encoding="utf-8")
            time.sleep(0.35)
        intro, body = parse_detail_page(html)
        sign["description"] = intro or first_sentence(body) or sign["name"]
        if index % 20 == 0:
            print(f"  details {index}/{len(signs)}")


def wiki_file_urls(titles: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for offset in range(0, len(titles), 40):
        chunk = titles[offset : offset + 40]
        params = {
            "action": "query",
            "titles": "|".join(chunk),
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "format": "json",
        }
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
        data = json.loads(fetch_text(url))
        for page in data.get("query", {}).get("pages", {}).values():
            if page.get("missing") is not None or "imageinfo" not in page:
                continue
            info = page["imageinfo"][0]
            if not str(info.get("mime", "")).endswith("svg+xml") and not str(
                info.get("url", "")
            ).endswith(".svg"):
                continue
            found[page["title"]] = info["url"].split("?")[0]
        time.sleep(0.15)
    return found


def resolve_wikimedia_svgs(missing_codes: list[str]) -> dict[str, str]:
    titles: list[str] = []
    wanted: dict[str, list[str]] = {}
    for code in missing_codes:
        category_id = code.split("-")[0]
        patterns = WIKI_CANDIDATES.get(
            category_id, ["File:PL road sign {code}.svg", "File:Znak {code}.svg"]
        )
        for pattern in patterns:
            title = pattern.format(code=code)
            titles.append(title)
            wanted.setdefault(code, []).append(title)
    found_titles = wiki_file_urls(titles)
    resolved: dict[str, str] = {}
    for code, candidates in wanted.items():
        for title in candidates:
            if title in found_titles:
                resolved[code] = found_titles[title]
                break
    return resolved


def download_svg(url: str, dest: Path) -> None:
    dest.write_bytes(fetch_bytes(url, retries=8))


def local_codes() -> set[str]:
    return {
        path.name.replace("PL_road_sign_", "").replace(".svg", "")
        for path in DATA_DIR.glob("PL_road_sign_*.svg")
    }


def rewrite_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def update_url_manifests(new_files: dict[str, str]) -> None:
    for directory in (DATA_DIR, MOBILE_DIR):
        urls_path = directory / "urls.json"
        urls = json.loads(urls_path.read_text(encoding="utf-8"))
        urls.update(new_files)
        rewrite_json(urls_path, dict(sorted(urls.items())))

        files = sorted(path.name for path in directory.glob("PL_road_sign_*.svg"))
        manifest_path = directory / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["count"] = len(files)
        manifest["files"] = files
        rewrite_json(manifest_path, manifest)


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MOBILE_DIR.mkdir(parents=True, exist_ok=True)
    print("Scraping dlakierowcy category lists")
    signs = scrape_categories()
    print(f"Enriching empty descriptions ({sum(1 for s in signs if not s['description'])} empty)")
    enrich_descriptions(signs)

    metadata = {
        sign["id"]: {
            "id": sign["id"],
            "categoryId": sign["categoryId"],
            "name": sign["name"],
            "description": sign["description"] or sign["name"],
            "source": "dlakierowcy",
            "sourceCode": sign["id"],
            "matchedVia": "source-exact",
            "detailPath": sign["detailPath"],
            "thumb": sign["thumb"],
        }
        for sign in signs
    }
    rewrite_json(METADATA_PATH, dict(sorted(metadata.items())))
    print(f"Wrote {len(metadata)} metadata entries")

    existing = local_codes()
    missing = [code for code in metadata if code not in existing]
    print(f"Missing local SVGs: {len(missing)} -> {missing}")

    resolved = resolve_wikimedia_svgs(missing)
    still_missing = [code for code in missing if code not in resolved]
    print(f"Wikimedia SVG hits: {len(resolved)}; still missing: {still_missing}")

    new_files: dict[str, str] = {}
    for index, (code, url) in enumerate(sorted(resolved.items()), 1):
        filename = f"PL_road_sign_{code}.svg"
        dest = DATA_DIR / filename
        if not dest.exists():
            print(f"  download {filename}")
            download_svg(url, dest)
            time.sleep(0.8)
        shutil.copy2(dest, MOBILE_DIR / filename)
        new_files[filename] = url
        if index % 15 == 0:
            print(f"  {index}/{len(resolved)}")

    if new_files:
        update_url_manifests(new_files)

    print("Done")
    print(json.dumps({"added": sorted(new_files), "noSvg": still_missing}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

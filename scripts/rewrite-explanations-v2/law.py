"""Download each country's traffic laws once, parse paragraphs, retrieve locally."""

from __future__ import annotations

import json
import math
import re
from html import unescape
from pathlib import Path

from packs import CountryPack, LawSource
from util import (
    atomic_write,
    clean_text,
    http_get,
    legal_dir,
    read_json,
    tokenize,
    write_json,
)

def articles_path(pack: CountryPack) -> Path:
    return legal_dir(pack.code) / "articles.json"


def prepare_law(pack: CountryPack, refresh: bool = False) -> list[dict]:
    path = articles_path(pack)
    if path.exists() and not refresh:
        articles = read_json(path)
        print(json.dumps({"lawCached": True, "articles": len(articles), "path": str(path)}))
        return articles
    articles: list[dict] = []
    raw_root = legal_dir(pack.code) / "raw"
    for source in pack.law_sources:
        html = _load_source_html(pack, source, raw_root, refresh)
        parsed = parse_articles(html, source, pack.paragraph_marker)
        articles.extend(parsed)
        print(json.dumps({"source": source.id, "articles": len(parsed)}), flush=True)
    if not articles:
        raise SystemExit(
            f"No law articles parsed for {pack.code}. Save HTML into {raw_root} and rerun prepare-law."
        )
    write_json(path, articles)
    write_json(
        legal_dir(pack.code) / "meta.json",
        {
            "country": pack.code,
            "articleCount": len(articles),
            "sources": [source.id for source in pack.law_sources],
        },
    )
    print(json.dumps({"lawPrepared": True, "articles": len(articles), "path": str(path)}))
    return articles


def load_articles(pack: CountryPack) -> list[dict]:
    path = articles_path(pack)
    if not path.exists():
        raise SystemExit(f"Law index missing: {path}. Run prepare-law first.")
    return read_json(path)


def _load_source_html(pack: CountryPack, source: LawSource, raw_root: Path, refresh: bool) -> str:
    dest = raw_root / f"{source.id}.html"
    if dest.exists() and not refresh:
        return dest.read_text(encoding="utf-8", errors="replace")
    last_error: Exception | None = None
    for url in source.urls:
        try:
            data = http_get(url)
            text = data.decode("utf-8", "replace")
            if len(text) < 2000:
                raise RuntimeError(f"{url} returned a short page ({len(text)} bytes)")
            atomic_write(dest, text)
            return text
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(json.dumps({"downloadFailed": url, "error": str(exc)[:300]}), flush=True)
    if dest.exists():
        return dest.read_text(encoding="utf-8", errors="replace")
    raise SystemExit(
        f"Could not download {source.id} ({last_error}). "
        f"Save the HTML manually to {dest} and rerun prepare-law."
    )


def strip_html(html: str) -> str:
    html = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?>.*?</style>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>", "\n", html)
    html = re.sub(r"(?i)</(p|div|h[1-6]|li|tr|section)>", "\n", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    html = unescape(html)
    html = html.replace("\xa0", " ")
    html = re.sub(r"[ \t]+", " ", html)
    html = re.sub(r"\n[ \t]+", "\n", html)
    html = re.sub(r"\n{3,}", "\n\n", html)
    return html


def parse_articles(html: str, source: LawSource, marker: str) -> list[dict]:
    text = strip_html(html)
    split = re.compile(rf"(?:^|\n)\s*(?:{marker})\s*(\d+[a-z]?)\b", re.I)
    matches = list(split.finditer(text))
    articles: list[dict] = []
    for index, match in enumerate(matches):
        number = match.group(1)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = clean_text(text[match.end() : end])
        if len(body) < 40:
            continue
        heading = ""
        heading_match = re.match(r"^(.{3,80}?)(?:\s{2,}|\.\s)", body)
        if heading_match and len(heading_match.group(1).split()) <= 12:
            heading = heading_match.group(1).strip(" .")
        citation = (
            f"§ {number} {source.short_cite}"
            if "§" in marker
            else f"art. {number} {source.short_cite}"
        )
        articles.append(
            {
                "id": f"{source.id}:{number}",
                "actId": source.id,
                "actTitle": source.title,
                "actCite": source.short_cite,
                "num": number,
                "heading": heading,
                "cite": citation,
                "text": body[:4000],
            }
        )
    return articles


class LawIndex:
    def __init__(self, articles: list[dict]):
        self.articles = articles
        self._docs = [tokenize(f"{row.get('heading', '')} {row.get('text', '')} {row.get('num', '')}") for row in articles]
        df: dict[str, int] = {}
        for tokens in self._docs:
            for token in set(tokens):
                df[token] = df.get(token, 0) + 1
        n = max(len(articles), 1)
        self._idf = {token: math.log((n + 1) / (count + 0.5)) for token, count in df.items()}

    def retrieve(self, query: str, limit: int = 3, extra_codes: list[str] | None = None) -> list[dict]:
        q_tokens = tokenize(query)
        if not q_tokens and not extra_codes:
            return []
        scored: list[tuple[float, int]] = []
        extra = [code.lower().replace(" ", "") for code in (extra_codes or [])]
        for index, tokens in enumerate(self._docs):
            if not tokens:
                continue
            tf: dict[str, int] = {}
            for token in tokens:
                tf[token] = tf.get(token, 0) + 1
            score = 0.0
            for token in q_tokens:
                if token in tf:
                    score += self._idf.get(token, 0) * (1 + math.log(tf[token]))
            body = (self.articles[index].get("text") or "").lower().replace(" ", "").replace("-", "")
            heading = (self.articles[index].get("heading") or "").lower().replace(" ", "").replace("-", "")
            for code in extra:
                compact = code.replace("-", "")
                if compact and compact in body:
                    score += 18
                if compact and compact in heading:
                    score += 8
            if score > 0:
                scored.append((score, index))
        scored.sort(reverse=True)
        picked = []
        seen_acts_nums: set[str] = set()
        for score, index in scored:
            article = self.articles[index]
            key = article["id"]
            if key in seen_acts_nums:
                continue
            seen_acts_nums.add(key)
            picked.append(
                {
                    **article,
                    "text": article["text"][:700],
                    "score": round(score, 3),
                }
            )
            if len(picked) >= limit:
                break
        return picked

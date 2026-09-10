from __future__ import annotations

import re

from packs import CountryPack
from util import clean_text, strip_diacritics

SIGN_RE = re.compile(r"\b([A-Z]{1,3})\s*-?\s*(\d+)([a-z]?)\b")
SK_SIGN_RE = re.compile(r"\b(\d{3}(?:-\d{2,3})?)\b")
PARA_RE = re.compile(r"(?:§|art\.)\s*(\d+[a-z]?)", re.I)


def normalize_code(value: str) -> str:
    text = re.sub(r"\s+", "", str(value or ""))
    text = re.sub(r"([A-Za-z]+)(\d)", r"\1-\2", text)
    return text.upper()


def expected_header(pack: CountryPack, question: dict) -> str:
    return expected_headers(pack, question)[0]


def _option_text(option: dict, pack: CountryPack) -> str:
    text = option.get("text")
    if isinstance(text, dict):
        text = text.get(pack.locale) or text.get("cs") or text.get("en") or ""
    return clean_text(text).lower().rstrip(".")


def expected_headers(pack: CountryPack, question: dict) -> list[str]:
    kind = question.get("answer_kind")
    correct = str(question.get("correct_option_id") or "").strip()
    headers: list[str] = []
    if kind == "boolean":
        yes = correct.lower() in {"true", "yes", "ano", "tak", "áno"}
        headers.append(pack.start_yes if yes else pack.start_no)
    else:
        letter = correct.upper() if correct else "A"
        if letter in {"TRUE", "YES", "ANO", "TAK"}:
            headers.append(pack.start_yes)
        elif letter in {"FALSE", "NO", "NE", "NIE"}:
            headers.append(pack.start_no)
        else:
            headers.append(pack.start_correct.format(letter=letter))
    content = question.get("content") or {}
    options = content.get("options") or []
    if not options:
        options = ((question.get("context") or {}).get("context") or {}).get("answers") or []
    for option in options:
        if str(option.get("id") or "").upper() != correct.upper():
            continue
        label = _option_text(option, pack)
        if label in {"ano", "yes", "tak", "áno"} or label.startswith("ano"):
            if pack.start_yes not in headers:
                headers.append(pack.start_yes)
        elif label in {"ne", "no", "nie"} or label.startswith("ne"):
            if pack.start_no not in headers:
                headers.append(pack.start_no)
    return headers


def collect_option_letters(question: dict) -> tuple[str, list[str]]:
    correct = str(question.get("correct_option_id") or "").upper()
    content = question.get("content") or {}
    ids = [str(option.get("id") or "").upper() for option in content.get("options") or []]
    if not ids:
        ctx = (question.get("context") or {}).get("context") or {}
        ids = [str(option.get("id") or "").upper() for option in ctx.get("answers") or []]
    incorrect = [item for item in ids if item and item != correct]
    return correct, incorrect


def codes_in_text(text: str, known: dict[str, str], pack: CountryPack) -> list[str]:
    found: list[str] = []
    for match in SIGN_RE.finditer(text or ""):
        code = normalize_code(f"{match.group(1)}-{match.group(2)}{match.group(3)}")
        if code in known:
            found.append(known[code])
    if pack.code == "SK":
        for match in SK_SIGN_RE.finditer(text or ""):
            code = match.group(1)
            if code in known:
                found.append(known[code])
    # preserve order, unique
    seen = set()
    ordered = []
    for code in found:
        if code not in seen:
            seen.add(code)
            ordered.append(code)
    return ordered


def paragraphs_in_text(text: str) -> list[str]:
    return [item.lower() for item in PARA_RE.findall(text or "")]


def validate_item(
    pack: CountryPack,
    question: dict,
    item: dict,
    known_signs: dict[str, str],
    retrieved: list[dict],
    context_codes: list[str],
) -> list[str]:
    errors: list[str] = []
    locale = pack.locale
    text = clean_text(item.get(locale) or "")
    if not text:
        return ["empty"]
    if len(text) < pack.min_chars:
        errors.append("too_short")
    if len(text) > pack.max_chars:
        errors.append("too_long")
    headers = expected_headers(pack, question)
    if not any(text.lower().startswith(header.lower().rstrip(".")) for header in headers):
        errors.append("bad_header")
    lower = text.lower()
    for phrase in pack.banned_phrases:
        if phrase in lower:
            errors.append("banned:" + phrase[:40])
            break
    if not any(word in lower for word in pack.causal_words):
        errors.append("no_cause")
    if pack.sign_word in lower and not codes_in_text(text, known_signs, pack) and not context_codes:
        errors.append("uncoded_sign")
    required_codes = [code for code in context_codes if code in known_signs]
    for code in required_codes:
        if code not in text:
            errors.append("missing_code:" + code)
            break
    declared = item.get("signCodes") or []
    if not isinstance(declared, list):
        errors.append("bad_sign_codes")
        declared = []
    for code in declared:
        canonical = known_signs.get(normalize_code(str(code))) or known_signs.get(str(code))
        if not canonical:
            errors.append("unknown_code:" + str(code))
            break
        if canonical not in text:
            errors.append("declared_code_absent:" + canonical)
            break
    allowed_nums = {str(article["num"]).lower() for article in retrieved}
    prompt = ""
    content = question.get("content") or {}
    prompt = clean_text((content.get("prompt") or {}).get(pack.locale) if isinstance(content.get("prompt"), dict) else "")
    allowed_from_question = set(paragraphs_in_text(prompt))
    allowed_nums |= allowed_from_question
    cited = paragraphs_in_text(text)
    for num in cited:
        if num not in allowed_nums:
            errors.append("invented_paragraph:" + num)
            break
    correct, incorrect = collect_option_letters(question)
    if question.get("answer_kind") == "choice" and incorrect:
        missing_letters = [letter for letter in incorrect if not re.search(rf"\b{letter}\b", text)]
        if missing_letters:
            errors.append("missing_wrong_options")
    extra = pack.write_locales[1:] if len(pack.write_locales) > 1 else ()
    for extra_locale in extra:
        extra_text = clean_text(item.get(extra_locale) or "")
        if extra_text and len(extra_text) < 80:
            errors.append(f"{extra_locale}_short")
        for code in required_codes:
            if extra_text and code not in extra_text:
                errors.append(f"{extra_locale}_missing_code")
                break
    if pack.locale in {"cs", "sk", "pl"}:
        folded = strip_diacritics(text)
        if len(text) > 80 and folded == text:
            errors.append("no_diacritics")
    return errors

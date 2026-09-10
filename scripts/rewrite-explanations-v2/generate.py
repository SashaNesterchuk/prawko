from __future__ import annotations

import json
import random
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from law import LawIndex
from media import extract_media_assets, prompt_locale, resolve_media_blocks, should_attach_media
from packs import CountryPack
from util import (
    atomic_write,
    clean_text,
    http_json,
    load_env,
    localized,
    read_json,
    work_dir,
    write_json,
)
from validate import codes_in_text, normalize_code, validate_item

BATCH_TEXT = 1
MAX_ATTEMPTS = 3
LAW_HITS = 3
LAW_CHARS = 600


def load_sign_catalog(pack: CountryPack) -> dict[str, str]:
    payload = read_json(pack.sign_catalog_path)
    known: dict[str, str] = {}
    for raw in payload.get("signs") or []:
        code = raw.get("id") or raw.get("code")
        if not code:
            continue
        canonical = str(code)
        known[canonical] = canonical
        known[normalize_code(canonical)] = canonical
        known[canonical.replace("-", "")] = canonical
        name = raw.get("name") or raw.get("name_cs") or ""
        if name:
            known[f"name:{canonical}"] = str(name)
    return known


def sign_name(known: dict[str, str], code: str) -> str:
    return known.get(f"name:{code}") or known.get(f"name:{normalize_code(code)}") or ""


def context_sign_codes(question: dict, known: dict[str, str]) -> list[str]:
    ctx = (question.get("context") or {}).get("context") or {}
    codes = []
    for item in ctx.get("verified_signs") or []:
        code = item.get("code") if isinstance(item, dict) else item
        canonical = known.get(normalize_code(str(code or ""))) or known.get(str(code or ""))
        if canonical:
            codes.append(canonical)
    return list(dict.fromkeys(codes))


def option_payload(pack: CountryPack, question: dict) -> list[dict]:
    content = question.get("content") or {}
    options = []
    for option in content.get("options") or []:
        options.append(
            {
                "id": option.get("id"),
                "text": localized(option.get("text"), pack.locale, *pack.write_locales),
                "correct": str(option.get("id") or "").upper() == str(question.get("correct_option_id") or "").upper(),
            }
        )
    if options:
        return options
    ctx = (question.get("context") or {}).get("context") or {}
    for option in ctx.get("answers") or []:
        options.append(
            {
                "id": option.get("id"),
                "text": option.get(f"text_{pack.locale}") or option.get("text_cs") or option.get("text") or "",
                "correct": bool(option.get("is_correct")),
            }
        )
    return options


def scene_payload(pack: CountryPack, question: dict) -> dict:
    ctx = (question.get("context") or {}).get("context") or {}
    visual = ctx.get("visual_analysis") or {}
    return {
        "status": visual.get("status"),
        "scene": visual.get(f"scene_{pack.locale}") or visual.get("scene_cs") or visual.get("scene"),
        "decisiveFacts": ctx.get(f"decisive_facts_{pack.locale}") or ctx.get("decisive_facts_cs") or ctx.get("decisive_facts"),
        "verifiedSigns": [
            item.get("code") if isinstance(item, dict) else item
            for item in ((question.get("context") or {}).get("context") or {}).get("verified_signs") or []
        ],
    }


def existing_is_useful(pack: CountryPack, question: dict) -> bool:
    expl = question.get("explanation") or {}
    version = expl.get("explanation_version") or ""
    if version in pack.keep_explanation_versions:
        return True
    text = ((expl.get("explanations") or {}).get(pack.locale) or "").lower()
    if not text or any(phrase in text for phrase in pack.banned_phrases):
        return False
    return len(text) >= 80


def existing_explanation(pack: CountryPack, question: dict) -> dict:
    expl = question.get("explanation") or {}
    texts = expl.get("explanations") or {}
    useful = existing_is_useful(pack, question)
    payload = {
        "version": expl.get("explanation_version") or "",
        "useful": useful,
    }
    if useful:
        payload[pack.locale] = clean_text(texts.get(pack.locale) or "")[: pack.max_chars + 80]
    return payload


def candidate_signs(pack: CountryPack, question: dict, known: dict[str, str], prompt: str) -> list[dict]:
    options = option_payload(pack, question)
    existing = existing_explanation(pack, question)
    blob = " ".join(
        [
            prompt,
            *[str(option["text"]) for option in options],
            existing.get(pack.locale) or "",
        ]
    )
    ctx_codes = context_sign_codes(question, known)
    extracted = codes_in_text(blob, known, pack)
    codes = list(dict.fromkeys([*ctx_codes, *extracted]))
    return [{"code": code, "name": sign_name(known, code)} for code in codes[:12]]


def build_query(pack: CountryPack, question: dict, prompt: str, signs: list[dict]) -> str:
    extras = pack.topic_query_extra.get(str(question.get("primary_topic_id") or ""), "")
    option_text = " ".join(str(option["text"]) for option in option_payload(pack, question))
    sign_text = " ".join(f"{item['code']} {item['name']}" for item in signs)
    facts = scene_payload(pack, question).get("decisiveFacts") or []
    fact_text = " ".join(facts) if isinstance(facts, list) else str(facts)
    existing_text = existing_explanation(pack, question).get(pack.locale) or ""
    return " ".join([prompt, option_text, sign_text, extras, fact_text, existing_text])


def system_prompt(pack: CountryPack) -> str:
    locales = ", ".join(pack.write_locales)
    return f"""You write driving-exam explanations that a learner reads after a wrong answer.
Return one JSON object only, no markdown.
Schema:
{{"items":[{{"sourceId":"...","{pack.locale}":"...","signCodes":["A-8"],"lawCitations":["{pack.citation_example}"],"needsManualReview":false{"".join(', "' + loc + '":"..."' for loc in pack.write_locales if loc != pack.locale)}}}]}}

Hard rules:
- Write the primary explanation in {pack.locale}. Also fill: {locales}.
- Start {pack.locale} with exactly this shape: "{pack.start_correct.format(letter="A")}" or "{pack.start_yes}" / "{pack.start_no}".
- 2 to 4 sentences. {pack.min_chars}-{pack.max_chars} characters in {pack.locale}.
- Teach the distinction the exam is testing. Name the rule in plain language, then the practical consequence.
- For A/B/C, say why the other options fail using the actual difference (a word, number, sign, duty). Never say they fail because they "do not match the assignment".
- If a traffic sign is decisive, write its exact catalogue code (example A-2, B-29, C-2e). Do not write a generic "{pack.sign_word}" without a code. Codes must come from candidateSigns or verifiedSignCodes. If unsure, omit the code.
- Cite a legal paragraph ONLY if it is in retrievedLaw for that item and clearly applies. Copy the citation form like: {pack.citation_example}. If unsure, explain the rule without a paragraph number. Never invent a §.
- Use only facts from the question, answers, context, retrievedLaw, existingExplanation when useful, and attached images. Do not invent what a photo shows if no image is attached.
- Never invent road layout, other vehicles, weather, traffic lights, or hlavní/vedlejší unless that fact is in the question, an option, context.scene, or clearly visible in an attached image.
- If mediaAttached is true, the picture decides priority and yes/no. Describe only what you can see. If a sign/signal is unreadable, set needsManualReview true and explain from the written options — do not guess a sign number or a side road.
- A wrong legal paragraph is worse than none. Cite retrievedLaw only when it clearly matches the visible/stated facts; otherwise explain the rule without §.
- If existingExplanation.useful is true, keep its facts (the distinction, sign codes, why other options fail). Rewrite only to match the start/length rules. Do not drop a correct sign code that is already in it.
- If existingExplanation.useful is false, ignore any previous wording.
- Do not quote the full question. Do not use filler templates.
Forbidden phrases: {"; ".join(pack.banned_phrases)}.
- signCodes = every code used in the explanation. Empty array if none.
- needsManualReview = true if the image is unreadable or the law citation is uncertain.
One item per input question, same sourceId."""


def item_input(
    pack: CountryPack,
    question: dict,
    known: dict[str, str],
    retrieved: list[dict],
    media_attached: bool,
) -> dict:
    prompt = prompt_locale(pack, question)
    signs = candidate_signs(pack, question, known, prompt)
    ctx_codes = context_sign_codes(question, known)
    payload = {
        "sourceId": question["source_id"],
        "answerKind": question.get("answer_kind"),
        "correctOption": question.get("correct_option_id"),
        "topic": question.get("primary_topic_id"),
        "prompt": prompt,
        "options": option_payload(pack, question),
        "context": scene_payload(pack, question),
        "verifiedSignCodes": ctx_codes,
        "candidateSigns": signs,
        "existingExplanation": existing_explanation(pack, question),
        "retrievedLaw": [
            {
                "cite": row["cite"],
                "heading": row.get("heading"),
                "text": (row.get("text") or "")[:LAW_CHARS],
            }
            for row in retrieved
        ],
        "mediaAttached": media_attached,
        "visionRules": (
            "Use the attached image. Do not invent vehicles, signs, weather, or vedlejší/hlavní not visible."
            if media_attached
            else "No image attached. Do not invent what a photo would show."
        ),
    }
    return payload


def openai_chat(key: str, model: str, messages: list[dict]) -> dict:
    parsed = http_json(
        "POST",
        "https://api.openai.com/v1/chat/completions",
        {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        {
            "model": model,
            "temperature": 0,
            "max_tokens": 5000,
            "response_format": {"type": "json_object"},
            "messages": messages,
        },
        timeout=180,
    )
    content = parsed["choices"][0]["message"]["content"]
    content = re.sub(r"^```json\s*|\s*```$", "", str(content).strip())
    return json.loads(content)


def load_openai_key() -> str:
    env = load_env()
    key = env.get("OPENAI_API_KEY") or ""
    if not key:
        raise SystemExit("OPENAI_API_KEY missing.")
    return key


SOFT_VALIDATE = {
    "no_cause",
    "missing_wrong_options",
    "uncoded_sign",
    "too_long",
    "en_short",
    "en_missing_code",
}


def parse_items(payload: dict, batch: list[dict]) -> dict[str, dict]:
    if not isinstance(payload, dict):
        raise RuntimeError("response is not an object")
    items = payload.get("items")
    if isinstance(payload.get("sourceId"), str) and payload.get("sourceId"):
        items = [payload]
    if not isinstance(items, list) or not items:
        raise RuntimeError("batch missing items")
    expected = {row["source_id"] for row in batch}
    by_id: dict[str, dict] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        source_id = str(item.get("sourceId") or "")
        if source_id in expected and source_id not in by_id:
            by_id[source_id] = item
    if not by_id:
        raise RuntimeError("no matching sourceIds")
    return by_id


def is_hard_error(err: str) -> bool:
    if err in SOFT_VALIDATE:
        return False
    if err.startswith(("missing_code:", "declared_code_absent:", "unknown_code:")):
        return False
    return True


def accepted_row(pack: CountryPack, question: dict, item: dict, model: str, used_media: bool) -> dict:
    row = {
        "question_id": question["id"],
        "source_id": question["source_id"],
        "signCodes": item.get("signCodes") or [],
        "lawCitations": item.get("lawCitations") or [],
        "needsManualReview": bool(item.get("needsManualReview")),
        "usedMedia": used_media,
        "provider": "openai",
        "model": model,
        "confidence": 0.62 if item.get("needsManualReview") else 0.88,
        "reason": "learner-explanation-rewrite",
    }
    for locale in pack.write_locales:
        text = clean_text(item.get(locale) or "")
        if locale == pack.locale and len(text) > pack.max_chars:
            cut = text[: pack.max_chars]
            dot = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
            text = (cut[: dot + 1] if dot >= pack.min_chars else cut).strip()
        row[locale] = text
    return row


def generate_batch(
    pack: CountryPack,
    batch: list[dict],
    known: dict[str, str],
    law_index: LawIndex,
    key: str,
    model: str,
    dry_run: bool,
    media_mode: str = "auto",
    image_detail: str = "low",
) -> dict[str, dict]:
    media_blocks: dict[str, list[dict]] = {}
    retrieved_by_id: dict[str, list[dict]] = {}
    inputs = []
    for question in batch:
        prompt = prompt_locale(pack, question)
        signs = candidate_signs(pack, question, known, prompt)
        codes = [item["code"] for item in signs]
        retrieved = law_index.retrieve(build_query(pack, question, prompt, signs), limit=LAW_HITS, extra_codes=codes)
        retrieved_by_id[question["source_id"]] = retrieved
        attach = should_attach_media(media_mode, pack, question, prompt)
        blocks, used_media = (
            resolve_media_blocks(pack, question, detail=image_detail) if attach else ([], False)
        )
        media_blocks[question["source_id"]] = blocks
        inputs.append(item_input(pack, question, known, retrieved, used_media))
    if dry_run:
        prompt_path = work_dir(pack.code) / "prompts" / f"{batch[0]['source_id']}.json"
        write_json(
            prompt_path,
            {
                "system": system_prompt(pack),
                "user": inputs,
                "mediaBlocks": sum(len(value) for value in media_blocks.values()),
            },
        )
        return {}
    inputs_by_id = {item["sourceId"]: item for item in inputs}
    remaining = batch
    last_error: Exception | None = None
    accepted: dict[str, dict] = {}
    for attempt in range(1, MAX_ATTEMPTS + 1):
        remaining_inputs = [inputs_by_id[row["source_id"]] for row in remaining]
        user_payload = {"items": remaining_inputs}
        if attempt > 1 and last_error:
            user_payload["previousError"] = str(last_error)[:800]
        user_text = json.dumps(user_payload, ensure_ascii=False)
        content = [{"type": "text", "text": user_text}]
        has_media = False
        for question in remaining:
            blocks = media_blocks[question["source_id"]]
            if blocks:
                has_media = True
                content.extend(blocks)
        try:
            payload = openai_chat(
                key,
                model,
                [
                    {"role": "system", "content": system_prompt(pack)},
                    {"role": "user", "content": content if has_media else user_text},
                ],
            )
            parsed = parse_items(payload, remaining)
            failed = []
            for question in remaining:
                item = parsed.get(question["source_id"])
                if not item:
                    failed.append((question, ["missing_from_model"], {}))
                    continue
                errors = validate_item(
                    pack,
                    question,
                    item,
                    known,
                    retrieved_by_id[question["source_id"]],
                    context_sign_codes(question, known),
                )
                hard = [err for err in errors if is_hard_error(err)]
                if hard:
                    failed.append((question, hard, item))
                    continue
                if errors:
                    item["needsManualReview"] = True
                used_media = bool(media_blocks[question["source_id"]])
                accepted[question["source_id"]] = accepted_row(pack, question, item, model, used_media)
            if not failed:
                return accepted
            last_error = RuntimeError(
                f"validation failed: {[(row['source_id'], errors) for row, errors, _ in failed[:4]]}"
            )
            print(str(last_error), flush=True)
            remaining = [row for row, _, _ in failed]
            time.sleep(1.2 * attempt)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(f"openai error attempt={attempt}: {exc}"[:400], flush=True)
            time.sleep(min(30, 2**attempt) + random.random())
    if accepted:
        if remaining:
            print(
                json.dumps({"skipped": [row["source_id"] for row in remaining]}, ensure_ascii=False),
                flush=True,
            )
        return accepted
    print(
        json.dumps(
            {
                "skipped": [row["source_id"] for row in remaining],
                "error": str(last_error)[:300] if last_error else "empty",
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return {}


def state_path(pack: CountryPack) -> Path:
    return work_dir(pack.code) / "state.json"


def load_state(pack: CountryPack) -> dict:
    path = state_path(pack)
    if path.exists():
        return read_json(path)
    return {"country": pack.code, "items": {}}


def save_state(pack: CountryPack, state: dict) -> None:
    atomic_write(state_path(pack), json.dumps(state, ensure_ascii=False, indent=2) + "\n")


def should_rewrite(
    pack: CountryPack,
    question: dict,
    skip_reviewed: bool,
    force: bool = False,
) -> bool:
    expl = question.get("explanation") or {}
    version = expl.get("explanation_version") or ""
    if force:
        return True
    if version == pack.explanation_version:
        return False
    if skip_reviewed and version in pack.keep_explanation_versions:
        return False
    return True


def chunked(items: list, size: int) -> list[list]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def parse_id_list(value: str | None) -> list[str]:
    if not value:
        return []
    text = value
    if value.startswith("@"):
        text = Path(value[1:]).read_text(encoding="utf-8")
    return [part.strip() for part in re.split(r"[\s,]+", text) if part.strip()]


def is_visual_rerun_item(pack: CountryPack, question: dict, state_item: dict | None) -> bool:
    """Official-text items whose answer lives in the picture. Skip kept manuals."""
    version = (question.get("explanation") or {}).get("explanation_version") or ""
    if version in pack.keep_explanation_versions:
        return False
    prompt = prompt_locale(pack, question)
    has_media = bool(extract_media_assets(question))
    used = bool(state_item and state_item.get("usedMedia"))
    if used:
        return True
    generic = bool(re.search(pack.generic_prompt_re, prompt or ""))
    if pack.scene_prompt_re and re.search(pack.scene_prompt_re, prompt or ""):
        generic = True
    return has_media and generic


def visual_rerun_ids(pack: CountryPack, questions: list[dict], state: dict) -> list[str]:
    items = state.get("items") or {}
    return [
        row["source_id"]
        for row in questions
        if is_visual_rerun_item(pack, row, items.get(row["source_id"]))
    ]


def run_generate(
    pack: CountryPack,
    questions: list[dict],
    law_index: LawIndex,
    *,
    limit: int | None,
    source_id: str | None,
    source_ids: list[str] | None,
    skip_reviewed: bool,
    force: bool,
    dry_run: bool,
    media_mode: str,
    workers: int,
    model: str,
    rerun: str | None = None,
) -> dict:
    known = load_sign_catalog(pack)
    state = load_state(pack)
    wanted: list[str] = parse_id_list(source_id)
    if source_ids:
        wanted.extend(source_ids)
    if rerun == "visual":
        wanted.extend(visual_rerun_ids(pack, questions, state))
        force = True
        if media_mode == "auto":
            media_mode = "force"
    wanted = list(dict.fromkeys(wanted))
    selected = questions
    if wanted:
        allow = set(wanted)
        selected = [row for row in selected if row["source_id"] in allow]
        missing = allow - {row["source_id"] for row in selected}
        if missing and source_id and not rerun:
            raise SystemExit(f"source id not in dump: {source_id}")
    selected = [row for row in selected if should_rewrite(pack, row, skip_reviewed, force)]
    if limit:
        selected = selected[:limit]
    image_detail = "high" if media_mode == "force" else "low"
    state["model"] = model
    state["explanation_version"] = pack.explanation_version
    pending = [
        row
        for row in selected
        if force or row["source_id"] not in state.get("items", {})
    ]
    visual = []
    text = []
    for row in pending:
        prompt = prompt_locale(pack, row)
        if should_attach_media(media_mode, pack, row, prompt):
            visual.append(row)
        else:
            text.append(row)
    print(
        json.dumps(
            {
                "selected": len(selected),
                "pending": len(pending),
                "visual": len(visual),
                "text": len(text),
                "usefulExisting": sum(1 for row in pending if existing_is_useful(pack, row)),
                "mediaMode": media_mode,
                "imageDetail": image_detail,
                "rerun": rerun,
                "dryRun": dry_run,
                "model": model,
            },
            ensure_ascii=False,
        )
    )
    if dry_run:
        sample = (visual[:2] + text[:2]) or selected[:2]
        if sample:
            generate_batch(
                pack, sample[:1], known, law_index, "", model, True, media_mode, image_detail
            )
        return state
    key = load_openai_key()
    batches = chunked(text, BATCH_TEXT) + [[row] for row in visual]
    done = 0
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {
            pool.submit(
                generate_batch,
                pack,
                batch,
                known,
                law_index,
                key,
                model,
                False,
                media_mode,
                image_detail,
            ): batch
            for batch in batches
        }
        for future in as_completed(futures):
            batch = futures[future]
            try:
                result = future.result()
            except Exception as extra:  # noqa: BLE001
                ids = [row["source_id"] for row in batch]
                print(json.dumps({"batchFailed": ids, "error": str(extra)[:300]}), flush=True)
                continue
            state.setdefault("items", {}).update(result)
            save_state(pack, state)
            done += len(result)
            print(f"generated {done}/{len(pending)}", flush=True)
    return state

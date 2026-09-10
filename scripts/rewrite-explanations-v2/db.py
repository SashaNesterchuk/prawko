"""Dump and apply explanation rows. Never deletes. Never rewrites protected locales.

Dump/apply use the local Supabase CLI token (same helper as prawko backups).
They do not read dashboard Supabase keys.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

from packs import CountryPack
from util import work_dir, write_json


def dump_path(pack: CountryPack) -> Path:
    return work_dir(pack.code) / "questions.jsonl"


def _try_sql():
    backups = Path(__file__).resolve().parents[2] / "supabase" / "backups"
    if str(backups) not in sys.path:
        sys.path.insert(0, str(backups))
    try:
        from _dump_remote import sql  # type: ignore

        return sql
    except Exception:
        return None


def _sql_paged(sql, query: str, page: int = 400) -> list:
    rows: list = []
    offset = 0
    while True:
        chunk = sql(f"{query}\noffset {offset} limit {page}")
        if not isinstance(chunk, list) or not chunk:
            return rows
        rows.extend(chunk)
        if len(chunk) < page:
            return rows
        offset += page


def dump_questions(pack: CountryPack) -> list[dict]:
    sql = _try_sql()
    if sql is None:
        raise SystemExit(
            "Dump uses the local Supabase CLI token (same as other prawko backups). "
            "Log in with `supabase login` if macOS keyring has no access-token."
        )
    sets = sql(
        "select id, key from public.question_sets "
        f"where key = '{pack.question_set_key.replace(chr(39), chr(39)+chr(39))}'"
    )
    if not isinstance(sets, list) or not sets:
        raise SystemExit(f"Question set {pack.question_set_key} is missing.")
    set_id = sets[0]["id"]
    questions = _sql_paged(
        sql,
        """
        select id, source_id, source_row_number, answer_kind, correct_option_id,
               primary_topic_id, topic_ids, content
        from public.questions_v2
        where question_set_id = '{set_id}'::uuid and is_active
        order by source_row_number
        """.format(set_id=set_id),
    )
    explanations = _sql_paged(
        sql,
        """
        select e.question_id, e.explanations, e.available_locales, e.explanation_version,
               e.source_context_version, e.provider, e.model, e.confidence,
               e.needs_manual_review, e.reason
        from public.question_ai_explanations_v2 e
        join public.questions_v2 q on q.id = e.question_id
        where q.question_set_id = '{set_id}'::uuid
        order by e.question_id
        """.format(set_id=set_id),
    )
    contexts = _sql_paged(
        sql,
        """
        select c.question_id, c.context, c.context_version, c.needs_manual_review, c.media_fingerprint
        from public.question_ai_contexts_v2 c
        join public.questions_v2 q on q.id = c.question_id
        where q.question_set_id = '{set_id}'::uuid
        order by c.question_id
        """.format(set_id=set_id),
    )
    expl_by_id = {row["question_id"]: row for row in explanations}
    ctx_by_id = {row["question_id"]: row for row in contexts}
    payload = []
    for question in questions:
        expl = expl_by_id.get(question["id"])
        if not expl or pack.locale not in (expl.get("explanations") or {}):
            continue
        payload.append(
            {
                **question,
                "explanation": expl,
                "context": ctx_by_id.get(question["id"]),
            }
        )
    out = dump_path(pack)
    with out.open("w", encoding="utf-8") as handle:
        for row in payload:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    write_json(
        work_dir(pack.code) / "dump-meta.json",
        {
            "questionSetKey": pack.question_set_key,
            "count": len(payload),
            "setId": set_id,
        },
    )
    print(json.dumps({"dumped": len(payload), "path": str(out)}, ensure_ascii=False))
    return payload


def load_dump(pack: CountryPack) -> list[dict]:
    path = dump_path(pack)
    if not path.exists():
        raise SystemExit(f"Dump missing: {path}. Run dump first.")
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def _dollar_quote(value: str) -> str:
    while True:
        tag = "t" + str(random.randint(100000, 999999))
        token = f"${tag}$"
        if token not in value:
            return f"{token}{value}{token}"


def apply_updates(pack: CountryPack, items: list[dict], skip_reviewed: bool) -> int:
    if not items:
        return 0
    sql = _try_sql()
    if sql is None:
        raise SystemExit("Apply needs the Supabase management SQL helper (supabase/backups/_dump_remote.py).")
    keep = pack.keep_explanation_versions
    updated = 0
    for index in range(0, len(items), 40):
        chunk = items[index : index + 40]
        values = []
        for row in chunk:
            patch = {locale: row[locale] for locale in pack.write_locales if row.get(locale)}
            values.append(
                "("
                + f"'{row['question_id']}'::uuid, "
                + f"{_dollar_quote(json.dumps(patch, ensure_ascii=False))}::jsonb, "
                + f"{_dollar_quote(pack.explanation_version)}, "
                + f"{_dollar_quote(row.get('provider') or 'openai')}, "
                + f"{_dollar_quote(row.get('model') or '')}, "
                + f"{float(row.get('confidence') or 0.85)}, "
                + ("true" if row.get("needsManualReview") else "false")
                + ", "
                + f"{_dollar_quote(row.get('reason') or 'learner-explanation-rewrite')}"
                + ")"
            )
        keep_sql = ""
        if keep and skip_reviewed:
            quoted = ", ".join("'" + version.replace("'", "''") + "'" for version in keep)
            keep_sql = f"AND e.explanation_version NOT IN ({quoted})"
        locales_sql = ", ".join("'" + loc + "'" for loc in pack.write_locales)
        query = f"""
        UPDATE public.question_ai_explanations_v2 AS e
        SET
          explanations = e.explanations || v.patch,
          available_locales = (
            SELECT ARRAY(
              SELECT DISTINCT loc
              FROM unnest(e.available_locales || ARRAY[{locales_sql}]) AS loc
              ORDER BY 1
            )
          ),
          explanation_version = v.explanation_version,
          provider = v.provider,
          model = v.model,
          confidence = v.confidence,
          needs_manual_review = v.needs_manual_review,
          reason = v.reason
        FROM (VALUES {", ".join(values)}) AS v(
          question_id, patch, explanation_version, provider, model, confidence, needs_manual_review, reason
        )
        WHERE e.question_id = v.question_id
          {keep_sql}
          AND EXISTS (
            SELECT 1
            FROM public.questions_v2 q
            JOIN public.question_sets s ON s.id = q.question_set_id
            WHERE q.id = e.question_id
              AND s.key = '{pack.question_set_key}'
          )
        RETURNING e.question_id;
        """
        result = sql(query)
        count = len(result) if isinstance(result, list) else 0
        if count != len(chunk):
            raise RuntimeError(
                f"apply mismatch: expected {len(chunk)} got {count} at offset {index}"
            )
        updated += count
        print(f"updated {updated}/{len(items)}", flush=True)
    return updated

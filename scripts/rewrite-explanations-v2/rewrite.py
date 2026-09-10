#!/usr/bin/env python3
"""Rewrite v2 AI explanations into learner-useful text.

Standalone. Not imported by the app. Country packs live in packs.py (CZ ran;
SK/PL next). Front door: docs/rewrite-explanations-v2.md. Runbook:
scripts/rewrite-explanations-v2/README.md.

Law is downloaded once into data/legal/<country>/ and retrieved locally.
Default model is gpt-4.1-mini. Media is auto: a picture is attached only when the
question is a generic scene prompt and stored context/signs cannot replace the image.
Most items stay text-only (question + answers + scene/signs + local law).

  --media auto   default; cheap, picture only when needed
  --media off    never attach images
  --media on     old thin-context vision path (expensive)
  --media force  attach a picture whenever the question has media
  --with-media   alias for --media on
  --rerun visual official-text picture items already in state.json (implies --force, --media force)

CZ default is all 1,136 rows. --skip-reviewed leaves manuals alone.
Do not apply until you have previewed state.json.

  python3 scripts/rewrite-explanations-v2/rewrite.py --country cz dump
  python3 scripts/rewrite-explanations-v2/rewrite.py --country cz prepare-law
  python3 scripts/rewrite-explanations-v2/rewrite.py --country cz generate
  python3 scripts/rewrite-explanations-v2/rewrite.py --country cz generate --rerun visual --model gpt-4.1
  python3 scripts/rewrite-explanations-v2/rewrite.py --country cz preview
  python3 scripts/rewrite-explanations-v2/rewrite.py --country cz apply
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import apply_updates, dump_questions, load_dump  # noqa: E402
from generate import load_state, parse_id_list, run_generate, state_path  # noqa: E402
from law import LawIndex, load_articles, prepare_law  # noqa: E402
from media import prompt_locale  # noqa: E402
from packs import get_pack  # noqa: E402
from util import load_env  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--country", required=True, help="cz | sk | pl")
    parser.add_argument(
        "mode",
        choices=("dump", "prepare-law", "generate", "preview", "apply", "all"),
        help="all = dump + prepare-law + generate. Never applies.",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--source-id", default=None)
    parser.add_argument(
        "--source-ids",
        default=None,
        help="Comma/whitespace-separated source ids, or @path to a file.",
    )
    parser.add_argument(
        "--rerun",
        choices=("visual",),
        default=None,
        help="Regenerate a subset already in state.json. visual = official-text items that need the picture.",
    )
    parser.add_argument(
        "--skip-reviewed",
        action="store_true",
        help="Leave keep_explanation_versions untouched (CZ manuals). Default rewrites them too.",
    )
    parser.add_argument("--force", action="store_true", help="Regenerate even if state/version already exists.")
    parser.add_argument("--dry-run", action="store_true", help="Write one prompt to disk, do not call the model.")
    parser.add_argument(
        "--media",
        choices=("auto", "off", "on", "force"),
        default="auto",
        help="auto = picture only when the exam item is the scene and text cannot replace it.",
    )
    parser.add_argument(
        "--with-media",
        action="store_true",
        help="Alias for --media on (attach images whenever context is thin).",
    )
    parser.add_argument("--refresh-law", action="store_true")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--model", default=None)
    return parser.parse_args()


def preview(pack, questions: list[dict], limit: int = 8) -> None:
    state = load_state(pack)
    items = state.get("items") or {}
    shown = 0
    for question in questions:
        item = items.get(question["source_id"])
        if not item:
            continue
        old = ((question.get("explanation") or {}).get("explanations") or {}).get(pack.locale) or ""
        print("=" * 72)
        print(question["source_id"], question.get("correct_option_id"), question.get("primary_topic_id"))
        print("Q:", prompt_locale(pack, question)[:220])
        print("OLD:", old[:320])
        print("NEW:", item.get(pack.locale))
        if item.get("signCodes"):
            print("SIGNS:", item.get("signCodes"))
        if item.get("lawCitations"):
            print("LAW:", item.get("lawCitations"))
        shown += 1
        if shown >= limit:
            break
    print(json.dumps({"previewed": shown, "stateItems": len(items), "state": str(state_path(pack))}))


def apply(pack, questions: list[dict], skip_reviewed: bool, force: bool) -> None:
    state = load_state(pack)
    items = state.get("items") or {}
    if not items:
        raise SystemExit(f"Empty state: {state_path(pack)}")
    selected = []
    for question in questions:
        item = items.get(question["source_id"])
        if not item:
            continue
        version = (question.get("explanation") or {}).get("explanation_version") or ""
        if skip_reviewed and version in pack.keep_explanation_versions and not force:
            continue
        if not item.get(pack.locale):
            raise SystemExit(f"Missing {pack.locale} for {question['source_id']}")
        selected.append(item)
    print(json.dumps({"applying": len(selected), "version": pack.explanation_version}))
    updated = apply_updates(pack, selected, skip_reviewed=skip_reviewed and not force)
    print(json.dumps({"updated": updated}))


def generate(args, pack, questions: list[dict]) -> None:
    articles = load_articles(pack)
    law_index = LawIndex(articles)
    env = load_env()
    default_model = "gpt-4.1" if args.rerun == "visual" else "gpt-4.1-mini"
    model = args.model or env.get("EXPLANATION_REWRITE_MODEL") or default_model
    media_mode = "on" if args.with_media else args.media
    run_generate(
        pack,
        questions,
        law_index,
        limit=args.limit,
        source_id=args.source_id,
        source_ids=parse_id_list(args.source_ids),
        skip_reviewed=args.skip_reviewed,
        force=args.force,
        dry_run=args.dry_run,
        media_mode=media_mode,
        workers=args.workers,
        model=model,
        rerun=args.rerun,
    )


def main() -> None:
    args = parse_args()
    pack = get_pack(args.country)
    if args.mode in {"dump", "all"}:
        dump_questions(pack)
    if args.mode in {"prepare-law", "all"}:
        prepare_law(pack, refresh=args.refresh_law)
    if args.mode in {"generate", "all"}:
        generate(args, pack, load_dump(pack))
    if args.mode == "preview":
        preview(pack, load_dump(pack), args.limit or 8)
    if args.mode == "apply":
        apply(pack, load_dump(pack), args.skip_reviewed, args.force)


if __name__ == "__main__":
    main()

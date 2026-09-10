---
name: rewrite-explanations
description: Rewrites Prawko learner explanations in question_ai_explanations_v2 for CZ, SK, and PL (dump, prepare-law, generate, visual rerun, preview, UPDATE-only apply). Use when the user asks to rewrite explanations, fix tautological AI text, run the CZ/SK/PL explanation pipeline, apply explanations to Supabase, or add a country pack.
---

# Rewrite learner explanations

Read `docs/rewrite-explanations-v2.md` then `scripts/rewrite-explanations-v2/README.md` before running anything.

## Loop (every country)

1. Fill or adjust `CountryPack` in `scripts/rewrite-explanations-v2/packs.py`. Do not copy the folder.
2. `dump` → `prepare-law` → `generate --dry-run` → `generate`.
3. `preview --limit 12` and open a few media URLs. Check grammar, the exam distinction, and that wrong options are taught.
4. `generate --rerun visual --model gpt-4.1` for picture items. Hand-fix remaining traps in `state.json`.
5. `apply` only after that. Confirm row count unchanged.

```bash
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk dump
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk prepare-law
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk generate
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk preview --limit 12
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk generate --rerun visual --model gpt-4.1
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk apply
```

## Hard rules

- Never `DELETE` or `INSERT` on `question_ai_explanations_v2`. Apply is `UPDATE` merge of `write_locales`.
- `protected_locales` stay untouched (PL: ua/en/de/es).
- Dump/apply: macOS Supabase CLI token, project `ybqoporhnnbaluhaoppo`. OpenAI may come from dashboard `.env`; dashboard `SUPABASE_*` must not.
- Do not apply until sampled. Copy `state.json` before a visual rerun.
- Wrong `§` / sign code is worse than none. Cite only `retrievedLaw`; check vision items against the photo.
- SK signs are numeric (`101`, `110-10`). Do not cite Czech 361/2000 on SK.

CZ already shipped as `cz-learner-explanation-v1` (1136 rows). SK/PL next via the same pack.

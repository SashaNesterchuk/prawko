# Learner explanation rewrite (CZ / SK / PL)

This is the **repeatable system** for `question_ai_explanations_v2`. Not a one-off under `scripts/`.

When you come back in a month and forget: start here, then run the CLI.

| What | Where |
| --- | --- |
| This page | front door |
| Full runbook (flags, pack fields, apply SQL, SK checklist) | [`scripts/rewrite-explanations-v2/README.md`](../scripts/rewrite-explanations-v2/README.md) |
| Country config (the only file to fill for SK/PL) | `scripts/rewrite-explanations-v2/packs.py` |
| CLI | `scripts/rewrite-explanations-v2/rewrite.py` |
| Work dir (gitignored) | `supabase/backups/rewrite-explanations-v2/<cz\|sk\|pl>/` |
| Law cache (gitignored) | `data/legal/<country>/` |
| Cursor skill | `.cursor/skills/rewrite-explanations/SKILL.md` |

## Status

| Country | Set | Version in DB | Notes |
| --- | --- | --- | --- |
| CZ | `cz-v2-current` | `cz-learner-explanation-v1` | 1136 rows, applied 2026-09-10, UPDATE only |
| SK | `sk-v2-current` | pack stubbed, not run | fill pack → same loop |
| PL | `pl-v2-current` | pack stubbed, not run | keep `protected_locales` out of the patch |

## Loop

```bash
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk dump
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk prepare-law
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk generate --dry-run
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk generate
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk preview --limit 12
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk generate --rerun visual --model gpt-4.1
python3 scripts/rewrite-explanations-v2/rewrite.py --country sk apply
```

1. Dump and look at old `explanation_version`s. Put good manuals in `keep_explanation_versions`.
2. Cheap pass: default `gpt-4.1-mini`, `--media auto`.
3. Sample 10–15. Then visual rerun (`gpt-4.1` + picture). Hand-fix photo traps in `state.json`.
4. Apply only when the sample is ok.

## Hard rules (do not rediscover)

- Never delete or insert explanation rows. Apply is `explanations = explanations \|\| patch` for `write_locales` only.
- New country = new `CountryPack`. Do not fork the folder.
- Picture vs text: `generic_prompt_re` + `scene_prompt_re` on the pack (`--media auto` and `--rerun visual`).
- Dump/apply use the local Supabase CLI token (Prawko `ybqoporhnnbaluhaoppo`). Never dashboard `SUPABASE_*`. OpenAI key may come from the dashboard `.env`.
- Do not apply until `preview` + a media check. Copy `state.json` before `--rerun visual`.

Question imports (separate): [Czech](czech-question-import.md), [Slovak](slovak-question-import.md).

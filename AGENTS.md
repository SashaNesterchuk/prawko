# Prawko — agent notes

## Learner explanations (CZ / SK / PL)

Repeatable system for `question_ai_explanations_v2`. If the task is “rewrite explanations”, “SK/CZ texts”, or applying explanation copy to Supabase, **do not start from a blank script**.

1. Read `docs/rewrite-explanations-v2.md`
2. Follow `scripts/rewrite-explanations-v2/README.md`
3. Change countries only in `scripts/rewrite-explanations-v2/packs.py`

Never DELETE/INSERT those rows. Apply is UPDATE merge. Skill: `.cursor/skills/rewrite-explanations/SKILL.md`.

## Mobile e2e

UI/behavior fixes in `mobile/` follow `.cursor/rules/e2e-with-fixes.mdc` (Maestro is part of the fix).

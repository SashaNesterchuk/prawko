# Prawko — agent notes

## Learner explanations (CZ / SK / PL)

Repeatable system for `question_ai_explanations_v2`. If the task is “rewrite explanations”, “SK/CZ texts”, or applying explanation copy to Supabase, **do not start from a blank script**.

1. Read `docs/rewrite-explanations-v2.md`
2. Follow `scripts/rewrite-explanations-v2/README.md`
3. Change countries only in `scripts/rewrite-explanations-v2/packs.py`

Never DELETE/INSERT those rows. Apply is UPDATE merge. Skill: `.cursor/skills/rewrite-explanations/SKILL.md`.

## Mobile e2e

UI/behavior fixes in `mobile/` follow `.cursor/rules/e2e-with-fixes.mdc` (Maestro is part of the fix).

## Paywall billing flows

Billing follows `countryConfig.paywallOffer`, not UI language or loaded offerings.
- **PL**: `plans` -> `Paywall2Screen`; auto-renewing weekly, monthly and 3-month subscriptions (`P1W` / `P1M` / `P3M`). Never promise lifetime/one-time/no renewal or fall back to a lifetime/annual package when plans are unavailable.
- **Other countries (currently CZ/SK)**: `lifetime` -> unchanged `LegacyPaywallPage`; one-time lifetime Premium, not a subscription.

Keep Home/Profile copy consistent via `mobile/src/features/monetization/premium-copy.ts`. Existing lifetime entitlements still restore normally. Read `docs/paywall.md` before changing either flow; its older teaser plan is historical, not the current PL billing specification.

## Analytics (exam restart)

`exam_restart_*` is the result-screen modal only, not a Home/daily exam cap. Reading dumps: [docs/analytics/keys.md](docs/analytics/keys.md). Do not infer that the gate blocks the exam tile.

# Prawko Remaining Epics

Текущее состояние зафиксировано по фактическому коду в репозитории, а не по исходному плану.  
Статусы ниже нужны как рабочая карта для следующих автономных проходов.

## Status Map

### Epic 0 — Foundation And Environments

Status: `done`

Остаток:

1. Только операционное поддержание env и README при новых интеграциях.

### Epic 1 — Official Question Data Pipeline

Status: `done`

Остаток:

1. Только refresh official dump и повторный sync при новых выгрузках.

### Epic 1A — Media Processing, Encoding, And Delivery

Status: `mostly_done`

Остаток:

1. Прогнать production-like media rebuild на финальном storage окружении.
2. Добавить финальную verification-процедуру для полного media upload после refresh.
3. Зафиксировать runbook для повторной пересборки тяжелого media bank.

### Epic 2 — Supabase Schema, Auth, Storage, RLS

Status: `mostly_done`

Остаток:

1. Добавить magic link и/или social auth, если это остается в v1 scope.
2. Дожать admin/school role hardening и storage policy audit под production.
3. Отдельно проверить entitlement и school-access сценарии на чистой базе с реальными seed flows.

### Epic 3 — Mobile Shell

Status: `done_for_v1`

Остаток:

1. Только shell polish и UX cleanup по мере новых фич.

### Epic 4 — Onboarding And Study Plan Setup

Status: `mostly_done`

Остаток:

1. Дожать edge cases для rebuild/continue flows после частично пройденного onboarding.
2. Проверить remote/local consistency после смены exam date и повторного plan rebuild.
3. Добить QA на резюме onboarding после sign out / reinstall.

### Epic 5 — Question Engine And Learning Mode

Status: `mostly_done`

Остаток:

1. Продолжить тюнинг queue strategies на реальных пользовательских данных.
2. Уточнить free-tier restrictions и их поведение между устройствами.
3. Дожать UX saved/hard flows как отдельные полезные сценарии, а не только как кнопки действий.

### Epic 6 — AI Layer

Status: `partial`

Остаток:

1. Добавить pre-generated explanation path для graceful fallback без live AI.
2. Дожать provider-agnostic server path до production-level конфигурации.
3. Проверить server-side rate limit и AI logging на реальном edge flow.
4. Добавить review/admin queue для ручной проверки AI outputs на web.

### Epic 7 — Exam Simulator

Status: `mostly_done`

Остаток:

1. Дожать follow-up around wrong answers -> bookmarks / AI / weak spots как единый пост-экзамен path.
2. Проверить official-like behavior на тяжелом video/media наборе.
3. Добавить финальный QA лист по timer/background/resume на устройствах.

### Epic 8 — Review Loops And Adaptive Queues

Status: `mostly_done`

Остаток:

1. Подкрутить spaced repetition rules на реальных данных.
2. Развести weak spots, hard, wrong answers и seen-not-mastered так, чтобы они меньше дублировали друг друга.
3. Добить UX around saved/review queues в практике и на daily plan.

### Epic 9 — Today Plan, Home, Readiness, Plan Adjust

Status: `mostly_done`

Остаток:

1. Выделить dedicated daily task detail вместо входа только через общие question/exam routes.
2. Дожать rebuild logic после нескольких skipped days подряд.
3. Проверить, что readiness и plan adjust стабильно пересчитываются после всех ключевых сценариев.

### Epic 10 — Paywall And School Access

Status: `partial`

Что уже закрыто:

1. RevenueCat flow и paywall modal.
2. School code redeem.
3. Restore purchase.
4. Free AI cap.
5. Free preview question limit.
6. Access Center из Profile.

Остаток:

1. Перенести free-tier quotas на backend/shared source of truth, а не только local persisted state.
2. Привязать purchase visibility к admin/web слою, если нужен backoffice обзор paid users.
3. Развести реальные commercial offers:
   - sprint
   - 30-day premium
   - school access
4. Проверить весь entitlement lifecycle после reinstall и multi-device use.

### Epic 11 — Web App

Status: `mostly_done`

Что уже есть:

1. Landing.
2. Pricing.
3. FAQ.
4. How it works.
5. Schools.
6. Support.
7. Legal pages.
8. Admin foundation.

Остаток:

1. Добавить real app-store / play-store deep links.
2. Дожать protected admin auth и non-indexed admin surface.
3. Сделать question import status page.
4. Сделать manual explanation review queue.
5. Усилить school inquiry funnel.

### Epic 12 — Analytics, QA, Release

Status: `partial`

Что уже есть:

1. PostHog provider foundation.
2. Event tracking across key flows.
3. Error logging foundation.

Остаток:

1. Составить явный QA checklist документ.
2. Составить release checklist документ.
3. Описать TestFlight / internal Android rollout process.
4. Описать data refresh runbook для вопросов и media.
5. Проверить coverage ключевых KPI events end-to-end.

## Current Execution Order

Следующие срезы имеет смысл брать в таком порядке:

1. `Epic 10` — backend-backed free-tier quotas and entitlement visibility
2. `Epic 6` — pre-generated explanations and stronger AI fallback
3. `Epic 11` — web admin question import status + explanation review queue
4. `Epic 12` — QA / release / refresh runbooks

## Current Pass

В этом проходе в работу взят следующий кусок:

1. `Epic 10` — separate Access Center from `Profile` for:
   - school code redeem
   - purchase restore
   - current access inspection

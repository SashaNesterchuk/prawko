# Prawko Analytics Engine

Решение зафиксировано 5 октября 2026. Менять его только новой версией контракта (`contract_version`), не обсуждением агентов.

**Дополнение 7 октября 2026, contract_version=2:** повторный импорт теперь merge/dedupe, не замена дня; календарные даты не доказывают полноту. Rates требуют coverage manifest. Funnel joins проверяют identity, порядок, horizon и сохраняют исходный grain при retries. Добавлены отдельные meaningful-learning D7 и TTV с censored observations. Точные правила и пример manifest: [analytics-engine/README.md](../../analytics-engine/README.md). Описание замены partitions и календарной полноты ниже сохранено как историческое поведение версии 1, не текущая спецификация.

В текущем health attempts связываются по installation-scoped session ID;
временная реконструкция остаётся только помеченным legacy proxy. Exam attempt
completion использует зрелый 24-hour horizon; молодые starts censored.
`build_health` по умолчанию имеет `coverage_complete=false`: rates и ranked drops
не считаются надёжными, пока вызывающая сторона не передаст проверенную полноту.
Replay start, answer updates, conflicting outcomes и missing IDs имеют отдельную
диагностику. Поля `users`/`people` сохранены для совместимости, но
`identity_grain=app_user_id_installation`, не доказанный человек.

Отдельный [RevenueCat ledger](./revenuecat-ledger.md) принимает offline webhook
archive, не создаёт production receiver. `context.financial` и аргумент
`build_health(..., financial=report)` сохраняют gross event activity, adjustments,
валюту, as-of coverage и scoped reconciliation. Старый текст об отсутствии RC API
ниже не запрещает offline import и не является подтверждением production setup;
store proceeds и settled money этим импортом не доказываются.

`context.content_observations` / health отделяют выбранное locale-поле от
source provenance, catalogue explanation hash от rendered revision и текущий
exam config от persisted origin. `context.repeat_answers` / health используют
ordered baseline → explanation/review → следующий distinct logical answer,
контроль revision/language/selection, семь дней horizon и censoring.
Exam updates не становятся повторным обучением; без coverage/integrity
descriptive fractions запрещены. Это не causal explanation lift.
Паспорт и границы проверки: [content-observations.md](./content-observations.md).

Код: `analytics-engine/`. Продуктовый контракт: `analytics-engine/contract/analytics_contract.yaml`. Словарь ключей по-прежнему `mobile/src/analytics/catalog.ts` и [keys.md](./keys.md). Этот файл смысл ключей не копирует.

`context.data_quality` / health и команда `data-quality` используют отдельный
warehouse-backed `data-quality-v1`: cross-partition provider/client conflicts,
business-operation dedupe, pre-window replay и receipt-minus-client lag.
Сырые счётчики сохранены; activity/funnels используют canonical observations.
Business integrity ограничивает зависимые rates, не меняя event meanings,
identity или RevenueCat money. Partial-day чтение включает последний
пересекающийся день; export time не подменяет receipt. Паспорт и оставшаяся
приёмка: [data-quality.md](./data-quality.md).

Client payload QA v2 has a separate
[producer and warehouse passport](./payload-contracts.md).
`data_quality.client_payload_validation` distinguishes reported legacy/v1/v2
validation, undefined rules and unusable annotations without retroactive v2
validation. Invalid, contradictory or unsupported client annotations restrict
dependent observations, not independent learning or RevenueCat source money.
Meaningful-learning D7/TTV and generic calendar return retain different source
dependencies. This does not change product decisions or SDK delivery policy.

`context.spend` и отдельные `ingest-spend` / `spend` читают Apple Ads CSV через
явный source manifest. Campaign/keyword aggregate views, account/app namespaces,
валюты и source windows не смешиваются; overlaps/partial windows не распределяются
по дням. Сентябрьские CSV не означают текущие расходы. AdMob earnings и RevenueCat
money остаются отдельными; сам spend importer не выполняет финансовый join.
Паспорт: [acquisition-spend.md](./acquisition-spend.md).

`context.acquisition` / `acquisition_mix` и CLI `acquisition` считают отдельный
ASA installation mix и first-observed D7/D30 client/learning cohorts. Только
явный iOS terminal устанавливает атрибуцию; super properties и visit entries
не создают новых acquisitions. История позволяет связать purchase, пришедший
раньше ASA response; это клиентское наблюдение, не verified charge. Unknown,
invalid anchors, maturity и full source coverage остаются явными.
`compare.acquisition_comparison` показывает оба install-grain mix и сдвиг как
confounder, не causal channel effect. Passport:
[acquisition-cohorts.md](./acquisition-cohorts.md).

`context.financial_cohorts` и CLI `acquisition-finance` используют отдельный
reviewed native/ASA/Apple/RevenueCat mapping и наблюдавшийся original transaction
origin. D7/D30 gross activity сохраняет maturity, source coverage, валюты и
ограничения ownership/monetary horizons. Exact campaign-window expense даёт только
помеченный subset diagnostic; `proceeds` / `roas` всегда null.
Historical client delivery-as-of и production mappings этим не доказываются.
Паспорт: [acquisition-finance.md](./acquisition-finance.md).

`context.billing_learning` и CLI `billing-learning` используют отдельный
native/RevenueCat mapping без зависимости от ASA. `billing-learning-v1`
наблюдает обучение после trial/first positive charge с известным original
lineage: activation, elapsed D7/D30, bounded trial revisions, cancellation
usage и post-activation calendar return. Answer/open/start/outcome defects
ограничивают свои fractions; trial/paid memberships не аддитивны.
Rates требуют explicit client `coverage.application_ids` и production archive
coverage. Это не current entitlement, settled money или causal paid lift.
Паспорт: [billing-learning.md](./billing-learning.md).

`context.onboarding`, CLI `onboarding` и supplied `health.onboarding` используют
отдельный `onboarding-activation-v1`: durable first-observed и persistent attempt
roots не смешиваются. Declared local acceptance, foreground Home, open, entry,
usable question, accepted answer и meaningful completion имеют независимые
gates; same-session chain требует доказанного порядка. Learning после Home
остаётся temporal installation association до следующего attempt/reset,
не direct attempt или causal join. Elapsed 24h/D7/D30 и first-observed
post-activation Warsaw calendar D1/D7 сохраняют nonachievers, censoring,
app-scoped coverage и unknown roots. Без supplied history health возвращает
`history_not_supplied`. Паспорт: [onboarding-activation.md](./onboarding-activation.md).

`context.paywall_observations`, CLI `paywall-observations` и health используют
`paywall-observations-v1`: отдельные request/product outcomes eligibility и
immutable paywall/checkout input origins. Доступная pre-window история,
replay/conflicts, неизвестные terminals и detached callbacks остаются явными.
Свежий native SKU/price не перезаписывает исходный выбор; старые journals не
получают выдуманный текущий config. Eligibility callbacks не создают calendar
return или learning/TTV. Отчёт count-only, не displayed-trial rate, оплата
или native delivery. Паспорт: [paywall-observations.md](./paywall-observations.md).

## Что это

Движок продуктовой аналитики Prawko со слоем интерпретации. Ядро — детерминированный расчёт. Модель читает только уже проверенный контекст и не переопределяет ни смысл события, ни факт в данных.

```text
raw events (PostHog JSON → Parquet)
        ↓
analytics_contract.yaml
        ↓
deterministic processor
        ↓
pattern discovery          ← ассоциации и аномалии, без причинности
        ↓
validated_analysis_context.json
        ↓
LLM analyst                ← ещё не подключён: объяснение, приоритет, гипотезы
```

Четыре слоя выхода:

1. Facts — счётчики и воронки.
2. Behavioral findings — наблюдаемые сегменты, последовательности, время до следующего действия. Это не причинность.
3. Anomalies — сдвиг между версиями или позициями, который не объяснён схемой, identity или незрелой когортой.
4. Hypotheses — только непроверенные объяснения. Их пишет модель, и у них статус `unverified`. Код их не выдумывает.

Запрещена необоснованная причинность, не описание поведения. У каждой поведенческой находки есть `non_causal_clause` и список `do_not_claim`. Потолок ассоциации не бывает `high`.

## Контракт

`analytics_contract.yaml` — слой интерпретации, не второй каталог. Ключ в нём обязан существовать в `catalog.ts` либо в списке SDK-событий. События без записи считаются: Lead не имеет права назвать их смысл.

Интерпретация привязана к диапазону `analytics_schema_version` и `app_version`. У одного ключа может быть несколько смыслов. На строку события обязана находиться ровно одна: более узкие `when_properties` побеждают, при равенстве побеждает более узкий диапазон схемы. Ноль совпадений — строка `uninterpreted`. Две и больше после этих правил — `BLOCKS_METRIC` для метрик, которые от события зависят. Существующий `id` интерпретации не переписывается; новый смысл — новый id.

`app_user_id` — `primary_analysis_key`, не доказанный человек. `distinct_id` — только fallback, если primary пуст. `person_id` ключом анализа не бывает. Качество identity: `ok`, `degraded`, `unusable`. `unusable` — `FATAL`, отчёта нет. `degraded` исключает из user-level расчётов только ключи без primary id и оставляет предупреждение. Остальные ключи считаются. Два старых билда без `app_user_id` не обнуляют окно.

Ноль события значит то, что написано в контракте (`feature_not_in_current_ui` или `not_observed`). Для текущего UI это касается `first_start_shown`, шагов онбординга вне first-run и `home_contextual_shown`.

`exam_restart_gate_shown` — модалка New attempt на результате. Это не дневной лимит и не гейт плитки экзамена.

`premium_gate_viewed` с `presentation=inline_lock` — автопоказ после ответа, не тап Explain и не намерение купить. Намерение открыть paywall — `premium_gate_action` с `action=open_paywall`.

`ad_skipped` при `should_show=no` и `why=disabled` — выключенная политика, не сломанная реклама.

`Application Installed` не доказывает нового человека.

Дата выкладки продукта живёт в `changes` контракта. Модель её из скачка метрики не выводит. Пока запись не внесена человеком, реестр пуст.

`acquisition_mix` теперь считает наблюдаемые primary installation IDs, не строки
с повторяющимися ASA super properties и не physical new installs. Явный
`apple_search_ads_attribution_resolved` может дать `attributed`, `organic` или
`unavailable`; Android/старые билды без проверки не превращаются в organic.
Числовые org/campaign/ad-group/keyword/ad IDs остаются namespace dimensions,
не названиями, spend или соответствием RevenueCat app. `app_entry_resolved`
по-прежнему источник визита. Финансовая сверка и ROAS остаются unjoined, даже
если diagnostic ASA mix доступен. Полный паспорт и критерии долей:
[acquisition-cohorts.md](./acquisition-cohorts.md).

## Процессор

Сырые события лежат в Parquet, партиция — календарный день `Europe/Warsaw`:

```text
analytics-engine/warehouse/events/day=YYYY-MM-DD/events.parquet
```

Каталог `warehouse/` в git не входит. Новый день дописывается отдельной партицией; повторный ingest того же дня заменяет партицию, а не сливает два дампа. Контекст окна каждый раз считается из партиций и текущего контракта. Исправление интерпретации доезжает до прошлых дней без повторной выгрузки PostHog.

День, на который экспорт оборвался (`to` совпадает с датой `exportedAt`), помечается `complete: false`. День, выгруженный на следующие сутки целиком, — `complete: true`.

Окна одного процессора: `day`, `trailing_days`, `calendar_month`, `cohort`, `experiment`. День — ошибки, версии, инструментация. Семь дней — воронки, покупки, возвраты. 28 дней — retention и устойчивые разрезы, когда определение метрики это позволяет. Допуск метрики не слабеет от длины окна.

QA имеет уровни `FATAL`, `BLOCKS_METRIC`, `WARNING`, `INFO`.

- `FATAL` — `report_policy.status = blocked`.
- `BLOCKS_METRIC` — запрещена конкретная метрика, остальные живы.
- `WARNING` — цифру показываем, вывод ограничен. Доля топ-3 ключей в событиях ≥ 0.4 — такое предупреждение.
- `INFO` — не меняет допуск.

`prohibited_conclusions` руками не пишутся. У каждой метрики eligibility: `allowed`, `limited` или `prohibited`, с причиной (`min_denominator`, `cohort_not_mature`, `identity_degraded`, …). Порог знаменателя живёт в контракте.

Класс доказательства задаёт потолок уверенности, одна формула на все метрики не используется:

| Класс | Потолок |
|---|---|
| `deterministic_fact` | high, в том числе при n=1, если это свойство записанных строк |
| `descriptive_metric` | high только при `allowed`; `limited` опускает до medium |
| `association` | не выше medium; `limited` опускает до low |
| `causal_hypothesis` | не выше low; при `causal_hypotheses_enabled=false` класс не выпускается |

Потолок поднимать нельзя. Предупреждение о концентрации опускает descriptive/association на ступень, если метрика ещё не запрещена.

Сравнение двух окон — отдельный объект, не абзац модели. Процессор кладёт смеси `app_version`, `analytics_schema_version`, `exam_country`, `locale`, `platform`, `is_plus`, `auth_mode` по доле строк событий. Сдвиг доли любого значения на ≥ 10 п.п. запрещает атрибуцию. Запись `changes`, попавшая в интервал от начала базового окна до конца текущего, тоже запрещает атрибуцию затронутых метрик. Стабильная смесь всё равно даёт атрибуции статус `limited`: это наблюдение, не эксперимент. Статус `allowed` у атрибуции в этой версии не выдаётся.

## Поведенческие находки

Их считает `prawko_analytics/patterns.py`, не модель. Находка появляется только если в окне есть события для неё. Маленькая ячейка остаётся в сегментах, но потолок опускается до `low`. Ассоциация не получает `high`.

Сейчас ищутся такие паттерны, все на primary `app_user_id`:

- сдача первого экзамена против числа завершённых тренировок до него;
- что происходит после проваленного экза: новый старт в пределах 15 минут, позже в окне или больше никакого старта;
- доля людей, которые начинают ещё одну попытку после первого и после второго провала;
- доля ошибок в первых 70% вопросов экзамена и в последних 30%;
- сдача по `app_version`, только если у двух версий хотя бы по 20 завершений.

На неделе 12–19 сентября нет `exam_session_id`: попытки связываются человеком и временем. Это ограничение записано в `grain` находки.

## Чего в этой версии нет

LLM-аналитик не подключён. Он понадобится, когда находок станет больше, чем удобно читать в JSON: тогда он расставляет приоритет и пишет гипотезы со статусом `unverified`, не пересчитывая числа. `recommendations_enabled` и `causal_hypotheses_enabled` стоят `false`. Отдельные Behavior / Product / Monetization агенты не нужны, пока поиск паттернов делает код.

Экран, который открывают утром, — `/dashboard/prawko/insights`. Он читает снимок product health, не сырой PostHog. Порядок такой: здоровье продукта, воронки и самые большие потери, что изменилось, удержание, деньги, и только потом поведенческие находки. Качество данных свёрнуто.

`prawko_analytics/health.py` считает по каждому окну acquisition, activation, learning, exam, retention, monetization. Доля ≥ 70% при n ≥ 30 может попасть в strong paths. Если тот же переход уже есть в largest leakage (потеря ≥ 10 человек и ≥ 15% предыдущего шага, база ≥ 30), на экране остаётся только утечка. Переход «закончил тренировку → начал экзамен» утечкой не считается: экзамен в том же окне не обязателен. Доля людей, у которых есть хотя бы одно завершение, и доля попыток — разные grain. Попытки в окне без `exam_session_id` / `training_session_id` восстанавливаются человеком и временем и в интерфейсе подписаны `reconstructed attempts`. Поздний complete не стирает более ранний брошенный старт. Следующее действие после незавершённой тренировки не называется drop-off: переход в другую тренировку — переключение, а не потеря. Строки «что было дальше» у брошенного экзамена — одно разбиение: они складываются в число попыток, а не в пересекающиеся доли. Незавершённая попытка и потеря — разные вещи: потеря здесь только попытка без последующей тренировки или экзамена, и рядом с ней считается число людей. Сдача первого экзамена без прошлого окна и без порога сложности не называется хорошей или плохой. Маленькая выборка и неподключённый источник — unknown, не ноль. Выручка RevenueCat фильтруется тем же окном, что и остальной review. Пока секретный API не подключён, чужой скриншот в историческое окно не подставляется.

`miss_click_empty_exit` — выход из экзамена до первого ответа, не обрыв посередине. `user_ended_early` — выход после ответов. `training_session_abandoned` с `answered_count` 0 — пустой выход, не брошенная середина сессии.

Поведенческие находки остаются вторым слоем. Сравнение с предыдущими 7 днями появляется, когда в складе есть предыдущее окно. Половина той же недели предыдущим периодом не считается.

Дашборд `/dashboard/prawko` считает unique users в окне 7/30/90 дней. Это другой вопрос. Воронки дашборда в контракт движка не копируются: там paywall всё ещё идёт через выбор пакета, first start — через spotlight, знаки — через обязательный `sign_opened`.

## Регрессия

`context.external_entries` / `health.external_entries` используют
`external-entry-v1`: scoped source/destination observations и ordered notification
learning с новыми accepted answers, mature nonachievers и unknown-tail censoring.
`context.rewarded_ads` / `health.rewarded_ads` используют `rewarded-sdk-v1`:
SDK invocation / OPENED / PAID evidence / earned / terminal отдельно, scoped PAID
dedupe/conflicts и decimal totals по валютам. Эти client SDK значения не входят
в RevenueCat finance и не являются settled revenue. Новые QA IDs ограничивают
выводы при invalid/orphan/conflicting observations. Полный паспорт и оставшаяся
приёмка: [external-entry-rewarded-observations.md](./external-entry-rewarded-observations.md).

День 3 октября 2026 — фикстура семантики, не оценка размера продукта. Тест `analytics-engine/tests/test_oct03.py` гоняет gitignored дамп и проверяет контекст, не сходство текста с `2026-10-03.md`.

Обязательные факты этого дня: 20 analysis keys; схемы и версии разрезаны; `first_start_shown = 0` значит, что шага в текущем UI нет; restart gate не дневной лимит; inline lock не намерение купить; `ad_skipped` при выключенной политике не поломка рекламы; `learning_operation_failed` / `sync_answer` / `42501` / `user_visible=false` — детерминированный факт; конверсия paywall на срезе 1.0.29 запрещена порогом знаменателя; D7 на одном дне незрелый; acquisition mix недоступен.

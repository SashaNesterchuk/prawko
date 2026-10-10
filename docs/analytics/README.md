# Prawko analytics

Папка с контрактом аналитики и разборами. Имена событий и экранов не выдумывать: источник правды — `mobile/src/analytics/catalog.ts`. Дашборд (`mindjar-dashboard`, `/dashboard/prawko`) обязан использовать те же ключи.

| Файл | Что это |
|---|---|
| [engine.md](./engine.md) | Зафиксированное решение: движок аналитики, контракт интерпретации, окна, Parquet |
| [keys.md](./keys.md) | Словарь: события, экраны, свойства, воронки, режимы |
| [2026-10-02-instrumentation-audit.md](./2026-10-02-instrumentation-audit.md) | Полный аудит текущего кода: SDK-сессии vs активное время, частота, retention, покрытие сценариев, identity/privacy, delivery, экспорт и приоритеты |
| [2026-09-08-brief.md](./2026-09-08-brief.md) | Выжимка за 8 сентября 2026 |
| [2026-09-08.md](./2026-09-08.md) | Полный разбор того же дня |
| [2026-09-12-2026-09-20.md](./2026-09-12-2026-09-20.md) | Разбор 12–20 сентября 2026 (воронки, ошибки, отвалы) |
| [2026-09-22.md](./2026-09-22.md) | Разбор 22 сентября 2026: что закрылось после 12–20 и что ещё ломается |
| [2026-09-30-2026-10-01-deep-analysis.md](./2026-09-30-2026-10-01-deep-analysis.md) | Глубокий разбор дампа 30.09–01.10; раздел 21 — локальные экзамены PL/CZ/SK, 22–23 — purchase lifecycle и recovery, 24 — коммерческая аналитика, готовность оффера и restore. 1 октября неполное |
| [2026-09-30-2026-10-01-defects.md](./2026-09-30-2026-10-01-defects.md) | Дефекты 30 сентября и 1 октября 2026 |
| [2026-09-30-2026-10-01-funnels.md](./2026-09-30-2026-10-01-funnels.md) | Воронки того же окна: что доходит и где отвал |
| [2026-10-03.md](./2026-10-03.md) | Воронки 3 октября 2026 (украинский разбор): онбординг, тренировки, экзамен, paywall |
| [2026-10-02-maestro/analysis.md](./2026-10-02-maestro/analysis.md) | Сверка локального capture-потока с 90 запусками Maestro: реконструкция без тестовых шагов, неоднозначные события, пробелы и предлагаемый контракт |
| [prawko-posthog-dump-2026-09-08.json](./prawko-posthog-dump-2026-09-08.json) | Сырой дамп PostHog за 8 сентября (~8.5 MB, в git не коммитится) |
| [prawko-posthog-dump-2026-09-12-2026-09-20.json](./prawko-posthog-dump-2026-09-12-2026-09-20.json) | Сырой дамп PostHog за 12–20 сентября (~171 MB, в git не коммитится) |
| [prawko-posthog-dump-2026-09-22.json](./prawko-posthog-dump-2026-09-22.json) | Сырой дамп PostHog за 22 сентября (~21 MB, в git не коммитится) |
| [prawko-posthog-dump-2026-09-30-2026-10-01.json](./prawko-posthog-dump-2026-09-30-2026-10-01.json) | Сырой дамп PostHog за 30 сентября и 1 октября (~41 MB, в git не коммитится). 1 октября оборван на момент выгрузки |
| [prawko-posthog-dump-2026-10-03.json](./prawko-posthog-dump-2026-10-03.json) | Сырой дамп PostHog за 3 октября (~20 MB, в git не коммитится) |
| [prawko-posthog-dump-2026-10-07-2026-10-08.json](./prawko-posthog-dump-2026-10-07-2026-10-08.json) | Сырой дамп PostHog за 7–8 октября (~63 MB, в git не коммитится). 8 октября неполное |
| [prawko-posthog-dump-2026-10-09.json](./prawko-posthog-dump-2026-10-09.json) | Сырой дамп PostHog за 9 октября (~33 MB, в git не коммитится). День неполный |
| [apple/2026-09-12-2026-09-20.md](./apple/2026-09-12-2026-09-20.md) | Apple Search Ads за то же окно (кампании, ключи, сверка с инсталлами) |

PostHog EU, проект `249243`. JSON-дампы в этой папке в `.gitignore`.

Локальный Metro и e2e в PostHog не пишут. Пока запущен `pnpm analytics:local` из `mobile/`, те же `capture` / `screen` / `identify` дописываются в `mobile/.analytics/session.jsonl`. Это сверка известного пути Maestro с потоком событий, не продакшен-дамп. Файл в git не коммитится.

---

## Как читать

### Кого считать человеком

На каждом продуктовом событии (кроме части старых билдов) есть:

| Поле | Что это | Как пользоваться |
|---|---|---|
| `app_user_id` | Устойчивый локальный app identity, вида `usr_…` | **Основной ключ app identity.** Не доказанный уникальный человек: два устройства могут дать два ID, общее устройство — один ID для нескольких людей. |
| `distinct_id` | PostHog identity | Обычно совпадает с `app_user_id`. На старых билдах (например 1.0.19) может быть UUID без `usr_`. Тогда fallback: `distinct_id`. |
| `person_id` | PostHog person | Не использовать как user key: несколько distinct_id могут схлопнуться в одного person или наоборот. |
| `supabase_user_id` | Id после входа | Есть только при `auth_mode = supabase`. Не равен `app_user_id`. |

Основной identity sync использует `app_user_id`. Гость и залогиненный сохраняют одну app identity на этом устройстве. Реальное объединение аккаунтов/устройств через alias нужно проверять отдельно; `Application Installed` не доказывает появление нового человека.

### Что приезжает само

`useAnalytics` клеит на **каждое** продуктовое событие:

`app_user_id`, `app_version`, `auth_mode`, `category`, `exam_country`, `is_plus`, `locale`, `platform`, `supabase_user_id`.

В схеме 3 wrapper также добавляет visit/screen/state/entry, build/environment и catalog/access context из текущего store в момент capture. Безопасный срез общих properties регистрируется для SDK при identity/preferences sync, но свежий state/ordering-контекст на автоматических lifecycle-событиях не гарантирован. Резать исторические воронки по стране / Plus / локали — по свойствам самого события, не по сегодняшним свойствам профиля.

`$…` свойства (`$app_version`, `$geoip_country_code`, `$session_id`) — SDK PostHog, не каталог. GeoIP ≠ `exam_country`.

### Продуктовые события vs SDK

В дампе будут и те, и другие.

- Каталог: `screen_viewed`, `training_session_started`, `client_error_logged`, …
- SDK (не в каталоге): `Application Installed`, `Application Opened`, `Application Became Active`, `Application Backgrounded`, `$set`

SDK годится для «открыл / ушёл в фон». В продуктовые воронки их не мешать.

`screen_viewed` описывает оболочку маршрута. `screen_visit_*` измеряет её наблюдаемый foreground-показ, `screen_state_viewed` отличает loader/block/question/feedback/result/review. Имя экрана в `screen_name`, путь в `route_pattern`. Список имён: [keys.md](./keys.md#экраны-screen_viewedscreen_name).

### События vs Identity vs Сессии

| Как считать | Когда |
|---|---|
| Unique `app_user_id` с событием | Охват app identity, не доказанное число уникальных людей |
| Число событий | Нагрузка, ошибки, ответы |
| Последовательность по ID попытки / операции | Где наблюдались старт, результат, явный выход или неизвестный исход |

По документированному контракту дашборд считает unique users в окне 7/30/90 дней: «было ли событие»; актуальная реализация отдельного репозитория здесь не проверена. Это **не** то же самое, что «прошли шаги подряд сегодня».

`app_run_id` — JS runtime, `$session_id` — SDK session, `app_visit_id` — наблюдаемый foreground-визит, `training_session_id` / `exam_session_id` / `sign_test_session_id` — учебные попытки. Не подменять их друг другом. Схема 3 даёт cumulative foreground/inactive/interaction-engaged счётчики; брать последний/max, не складывать checkpoints. Kill оставляет неизвестный хвост. Engagement — proxy по явным действиям, не доказанные минуты чтения/обучения. Подробно: [keys](./keys.md), [аудит и статус реализации](./2026-10-02-instrumentation-audit.md#25-реализация-после-аудита).

### Время

Продуктовый день = календарный день `Europe/Warsaw` с учётом DST, не фиксированного UTC+2. Timestamp в дампе — UTC. Например, 2 октября 2026 года 04:15 UTC = 06:15 Warsaw. Для retention нужны полностью наблюдаемые дни и зрелые когорты; первый event в коротком дампе не равен первой установке.

### Текущий путь онбординга

Код после даты экзамена сразу финалит план и кидает на Home. Шаги `notifications` / `minutes` / `level` / `school_code` / `access` / `preview` в каталоге есть, **в первом прогоне их нет**. Если воронка онбординга ждёт `notifications`, она будет вечным нулём — это не отвал, это устаревший контракт дашборда.

Актуальный first-run:

`onboarding_category` → `onboarding_exam_schedule` → `home` → доступный учебный вход.

`app_entry` — шлюз, его screen event намеренно не пишется. Spotlight отключён; contextual-card подключён только к старому Home. `first_start_shown` / `home_contextual_shown` не обязательные шаги текущего roadmap UI. Readiness diagnostic и прямой roadmap-start — альтернативные входы.

### Чего в аналитике не будет

Product wrapper sanitize выкидывает PII/текст, raw URL, query, token и receipt по denylist, допускает primitive finite values. SDK `before_send` рекурсивно очищает properties и person updates тем же правилом, включая lifecycle initial URL. Это key-based защита, не семантическая allowlist произвольных строк.

После аудита identity sync проходит sanitized wrapper и больше не отправляет `email` / `full_name`. Ранее сохранённые event/person properties в PostHog этим не удаляются; в исторических дампах они могут оставаться. Install identity, alias-политика и бизнес-авторизация не менялись.

Captured errors нормализуются в `error_code` / `error_name` / `area`. Текущий image-preview обработчик уже нормализует код; отсутствие его в старом дампе не описывает весь новый код. Но не все видимые UI failures вызывают error logger, и нет общего media-success denominator.

### Exam restart — не лимит

`exam_restart_gate_shown` / `exam_restart_selected` — модалка **New attempt** на экране результата. Это не дневной кап и не гейт плитки Home/Learn. `exam_start_requested source=manual` после Home сам по себе не доказывает «гейт пропустили». `dismiss` только закрывает шит. В текущем V2 есть отдельная launch-проверка с `premium_gate_viewed source=exam_limit` и `freeExamUsed`; не смешивать её с restart-modal или календарным лимитом. Подробнее: [keys.md](./keys.md) (Exam).

### Воронки дашборда

Определены в `mindjar-dashboard/src/lib/prawko/catalog.ts` (`PRAWKO_PRODUCT_FUNNELS`). Шаги и смысл — в [keys.md](./keys.md#воронки).

Кратко: training = старт попытки → доступный вопрос → ответ → новый финал; exam = launch → started/resumed → completion (`passed` отдельно от завершения); activation = доступный учебный вход → первый ответ/финал; paywall = view → ready offer → CTA → native checkout → outcome; signs = тест → ответы → ended с outcome. Mode selection, spotlight, package selector и sign detail не универсальные обязательные шаги.

---

Дальше по ключам: [keys.md](./keys.md).

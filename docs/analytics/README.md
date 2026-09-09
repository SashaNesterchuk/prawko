# Prawko analytics

Папка с контрактом аналитики и разборами. Имена событий и экранов не выдумывать: источник правды — `mobile/src/analytics/catalog.ts`. Дашборд (`mindjar-dashboard`, `/dashboard/prawko`) обязан использовать те же ключи.

| Файл | Что это |
|---|---|
| [keys.md](./keys.md) | Словарь: события, экраны, свойства, воронки, режимы |
| [2026-09-08-brief.md](./2026-09-08-brief.md) | Выжимка за 8 сентября 2026 |
| [2026-09-08.md](./2026-09-08.md) | Полный разбор того же дня |
| [prawko-posthog-dump-2026-09-08.json](./prawko-posthog-dump-2026-09-08.json) | Сырой дамп PostHog за тот день (~8.5 MB, в git не коммитится) |

PostHog EU, проект `249243`. JSON-дампы в этой папке в `.gitignore`.

---

## Как читать

### Кого считать человеком

На каждом продуктовом событии (кроме части старых билдов) есть:

| Поле | Что это | Как пользоваться |
|---|---|---|
| `app_user_id` | Стабильный id установки, вида `usr_…` | **Основной ключ человека.** Считать unique users по нему. |
| `distinct_id` | PostHog identity | Обычно совпадает с `app_user_id`. На старых билдах (например 1.0.19) может быть UUID без `usr_`. Тогда fallback: `distinct_id`. |
| `person_id` | PostHog person | Не использовать как user key: несколько distinct_id могут схлопнуться в одного person или наоборот. |
| `supabase_user_id` | Id после входа | Есть только при `auth_mode = supabase`. Не равен `app_user_id`. |

`identify` в приложении всегда идёт с `app_user_id`. Гость и залогиненный — один и тот же человек, пока не сменится установка.

### Что приезжает само

`useAnalytics` клеит на **каждое** продуктовое событие:

`app_user_id`, `app_version`, `auth_mode`, `category`, `exam_country`, `is_plus`, `locale`, `platform`, `supabase_user_id`.

Это супер-свойства, не отдельные события. Резать воронки по стране / Plus / локали — по ним.

`$…` свойства (`$app_version`, `$geoip_country_code`, `$session_id`) — SDK PostHog, не каталог. GeoIP ≠ `exam_country`.

### Продуктовые события vs SDK

В дампе будут и те, и другие.

- Каталог: `screen_viewed`, `training_session_started`, `client_error_logged`, …
- SDK (не в каталоге): `Application Installed`, `Application Opened`, `Application Became Active`, `Application Backgrounded`, `$set`

SDK годится для «открыл / ушёл в фон». В продуктовые воронки их не мешать.

`screen_viewed` — единственный экранный трек. Имя экрана в `screen_name`, путь в `route_pattern`. Список имён: [keys.md](./keys.md#экраны).

### События vs люди vs сессии

| Как считать | Когда |
|---|---|
| Unique `app_user_id` с событием | Воронка дашборда, «сколько людей дошли» |
| Число событий | Нагрузка, ошибки, ответы |
| Последовательность в сессии одного id | Где отвалились (shown → started → abandoned) |

Дашборд считает unique users в окне 7/30/90 дней: «было ли событие». Это **не** то же самое, что «прошли шаги подряд сегодня». В разборе за 8 сентября — второй способ.

### Время

Продуктовый день = календарный день `Europe/Warsaw`. Timestamp в дампе — UTC. 04:15 UTC = 06:15 Warsaw.

### Текущий путь онбординга

Код после даты экзамена сразу финалит план и кидает на Home. Шаги `notifications` / `minutes` / `level` / `school_code` / `access` / `preview` в каталоге есть, **в первом прогоне их нет**. Если воронка онбординга ждёт `notifications`, она будет вечным нулём — это не отвал, это устаревший контракт дашборда.

Актуальный first-run:

`app_entry` → `onboarding_category` → `onboarding_exam_schedule` → `home` → first start.

### Чего в аналитике не будет

Sanitize выкидывает свободный текст и секреты: `email`, `full_name`, `password`, `school_code`, `message`, `prompt`, `answer_given`, `selected_answer`, `component_stack`.

Ошибки нормализуются в `error_code` / `error_name` / `area`. Картинки вопросов сегодня часто приходят без `error_code` — это дыра инструментации, не «ошибки нет».

### Воронки дашборда

Определены в `mindjar-dashboard/src/lib/prawko/catalog.ts` (`PRAWKO_PRODUCT_FUNNELS`). Шаги и смысл — в [keys.md](./keys.md#воронки).

Кратко: training = выбрал режим → стартовал → закончил; exam = открыл → стартовал → результат (`passed`); first start = spotlight → старт слота → CTA результата → reminder; paywall = увидел → пакет → checkout → купил; signs = открыл знак → тест → конец теста.

---

Дальше по ключам: [keys.md](./keys.md).

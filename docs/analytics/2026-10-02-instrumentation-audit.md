# Полный аудит аналитики Prawko: 2 октября 2026

## 1. Результат проверки

**Базовая событийная аналитика есть. Частоту использования и retention не нужно начинать с нуля. Главные пробелы: активное время, точный контекст визита/экрана, непрерывность причинных цепочек, видимые ошибки и готовность контента.**

На вопросы «как часто возвращаются», «сколько активных дней», «сколько отвечают», «какие режимы используют» можно отвечать существующими событиями, если выгрузка полная и определения согласованы. На вопрос «сколько минут действительно занимались» сейчас нельзя отвечать точно. На вопрос «почему перестали отвечать» можно назвать наблюдаемый последний шаг, но не всегда причину.

Самая опасная ошибка не в отсутствии ещё ста событий, а в смешении разных сущностей:

- Установка приложения, аккаунт и человек.
- JS runtime, PostHog-сессия, foreground-посещение и учебная попытка.
- Показ оболочки маршрута и доступность вопроса/результата внутри неё.
- Завершение попытки и повторный просмотр сохранённого результата.
- Нажатие, начало операции, подтверждённый результат и неизвестный результат.
- Длительность по часам и время активного использования.
- Отсутствие события, явный уход, авария и конец окна выгрузки.

Разделы 1–24 фиксируют состояние **до реализации этого аудита**: предложения там ещё не являются отправляемыми событиями. Последующие analytics-only изменения схемы 3 и оставшиеся ограничения перечислены в [разделе 25](#25-реализация-после-аудита).

## 2. Область и ограничения

Проверены общий wrapper аналитики, provider/identity, каталог и места его использования, роутер, основные продуктовые сценарии, локальная запись, build gate и установленный SDK.

Статический поиск нашёл **126 канонических имён событий** в `ANALYTICS_EVENTS`; проверены ссылки из `mobile/app` и `mobile/src` без тестовых файлов. Количество имён не является оценкой полноты покрытия: исторический ключ и код в неиспользуемом экране не означают живой шаг текущей воронки.

Использованы исходные JSONL от 2 октября:

| Источник | Объём | Что он доказывает |
|---|---:|---|
| `2026-10-02-maestro/session.jsonl` | 342 строки, включая заголовок; 90 `app_user_id` | Что старый локальный capture-поток записал в тестовых сценариях |
| `2026-10-02-maestro/maestro-steps.jsonl` | 834 строки | Какие действия выполнял тест |
| Текущий worktree со схемой 2 | Изменения предыдущего этапа | Как должен работать обновлённый контракт по коду; не факт production-доставки |

90 identity здесь не означают 90 настоящих учеников. Maestro очищал состояние/identity; это не когорта для частоты или retention.

В этой копии отсутствуют сырые production JSON, перечисленные в README. Отдельный репозиторий `mindjar-dashboard`, настройки проекта PostHog, фактический выпущенный bundle и серверные выгрузки RevenueCat не проверены. Исторические отчёты не использованы как новый расчёт текущих метрик.

**Тесты, Maestro, typecheck и сборка не запускались по просьбе пользователя.** Это аудит кода и контракта, не проверка работы на устройстве. Ранее внесённые изменения схемы 2 также нельзя считать подтверждёнными этим аудитом.

## 3. Что уже работает

### 3.1. Общая точка отправки

[`useAnalytics.ts`](../../mobile/src/hooks/useAnalytics.ts) добавляет к product capture контекст установки, версии, страны экзамена, категории, UI locale, платформы, фактической авторизации и Plus. Payload проходит `sanitizeAnalyticsProperties`.

Схема 2 добавляет `app_run_id`, `event_sequence`, `event_id`, `client_occurred_at`, `analytics_schema_version`. Это позволяет восстановить порядок **записи продуктовых событий внутри одного runtime**, несмотря на асинхронный приём локальным логгером. Это не общий порядок всех SDK-событий и не доказательство причинности параллельных операций.

### 3.2. Учебные попытки

Предыдущий этап добавил/распространил `training_session_id`, `exam_session_id`, `sign_test_session_id`, а также IDs setup/review/gate/block/launch. Особенно важна новая семантика training: создание, resume, завершение и сохранённый результат теперь различаются.

Для нового training-потока доступны question view, answer, feedback continue, result view/action и review open/item/close. Это существенно лучше старого «начал -> закончил». У экзамена и знаков покрытие внутренних состояний пока слабее.

### 3.3. Коммерческие операции

Checkout уже имеет `paywall_view_id`, `purchase_attempt_id`, стадии, подготовку, native start, succeeded/cancelled/failed, pending/outcome_unknown, восстановление журнала и сверку доступа. Restore различает подтверждённый доступ и пустой результат. Готовность оффера наблюдается отдельно от открытия paywall.

Это сильная часть текущего контракта. Не нужно заменять её одним `purchase_failed` или общей длительностью paywall.

### 3.4. SDK-сессии действительно есть

[`AnalyticsProvider.tsx`](../../mobile/src/providers/AnalyticsProvider.tsx) включает `captureAppLifecycleEvents` для разрешённой production-конфигурации. SDK сам добавляет `$session_id` и lifecycle-события. Отсутствие собственного `app_session_started` **не означает отсутствия сессионной аналитики вообще**.

## 4. Identity: кого именно считаем

[`app-user-id.ts`](../../mobile/src/identity/app-user-id.ts) создаёт `usr_UUID` и хранит его через [`auth-storage.ts`](../../mobile/src/lib/auth-storage.ts): SecureStore на native и AsyncStorage на web. `useAnalytics.reset()` намеренно не меняет identity при авторизации.

| Сущность | Ключ | Корректная интерпретация |
|---|---|---|
| App identity | `app_user_id` | Устойчивый локальный identity, не доказанный уникальный человек |
| Аккаунт | `supabase_user_id` | Один авторизованный аккаунт; у гостя отсутствует |
| PostHog identity | `distinct_id` | SDK identity; обычно app ID, старые версии могут отличаться |
| Объединённый профиль | `person_id` | Результат identity resolution PostHog, не независимый источник истины |

**Риски подсчёта:**

- Один человек на двух устройствах может дать два `app_user_id`.
- Несколько людей на одном устройстве могут использовать одну app identity.
- Сохранение ID после удаления/переустановки зависит от платформы и состояния хранилища; по одному `Application Installed` это не определить.
- Account ID алиасится к app ID через `posthog.alias`. Повторный alias и фактическое слияние нескольких устройств надо проверять в production; один вызов в коде не доказывает успешную дедупликацию.
- Смена аккаунтов на одной app identity требует отдельно выбранной политики. Не стоит молча менять primary identity на account ID: это затронет RevenueCat и историю гостей.
- Logout не «отменяет» ранее созданные alias-связи.

**Решение для аналитика:** базовые показатели называть «активные app identity/установки», аккаунтные считать отдельно. Для device-to-account анализа экспортировать таблицу связей с периодами наблюдения, не только последнее свойство профиля. Не склеивать весь гостевой трафик разных устройств по догадке.

При смене страны/категории/Plus использовать свойства **на событии**, а не сегодняшние person properties для всей истории. Для acquisition/cohort хранить начальный срез отдельно от текущего состояния.

## 5. Сессии и длительность

### 5.1. Четыре разных «сессии»

| Вид | Сейчас | Где границы |
|---|---|---|
| JS runtime | `app_run_id` схемы 2 | Загрузка JS runtime; фон сам по себе ID не меняет |
| PostHog SDK session | `$session_id` | Правила SDK, а не учебная попытка |
| Foreground visit | Нет собственного согласованного ID/summary | Непрерывный активный период приложения; требуется определить |
| Learning attempt | Training/exam/sign-test IDs | Создание -> результат/явный выход, иногда через несколько визитов |

Один runtime может содержать несколько SDK-сессий. Один учебный attempt может пережить перезапуск. Один SDK session может включить несколько foreground-периодов и учебных попыток.

### 5.2. Проверенное поведение установленного SDK

Локально установлен `posthog-react-native` **4.45.11**, его `@posthog/core` **1.29.6**. В `mobile/package.json` объявлено `^4.10.8`; локально установленная версия не доказывает версию всех production-билдов.

Проверены `posthog-rn.js`, `posthog-rn.d.ts`, `@posthog/core/dist/posthog-core.js`:

- Core добавляет `$session_id` через `enrichProperties`.
- Без явной настройки `sessionExpirationTimeSeconds` новый ID создаётся при паузе между обновлениями session clock более 1800 секунд; максимальная длина 86400 секунд.
- RN по умолчанию не сохраняет session ID через перезапуск SDK (`enablePersistSessionIdAcrossRestart` не задан в приложении).
- При `AppState=active` SDK обновляет session clock.
- Lifecycle пишет `Application Installed/Updated/Opened`, `Application Became Active`, `Application Backgrounded`. `inactive` не имеет такого же отдельного lifecycle-события.

Эти значения взяты из установленного SDK, а не предполагаемых настроек веб-дашборда. Правила проекта PostHog могут иметь отдельную конфигурацию для отображения/расчёта sessions; её здесь не проверяли.

### 5.3. Какие duration доступны

| Показатель | Статус | Ограничение |
|---|---|---|
| SDK event span по `$session_id` | Вычислим | `last_event - first_event`; не равно active time |
| Foreground time из lifecycle | Приближение | Можно суммировать наблюдаемые open/active -> background; отсутствующие границы оставлять censored |
| Training attempt wall span | Вычислим при наличии обеих границ | Resume/перерывы и missing terminal требуют отдельного статуса |
| Training active duration | Нет | Нельзя заменить суммой ответов |
| Exam `duration_seconds` | Есть на completion | `finishedAt - startedAt`, включая фон/перерыв |
| `answer_duration_ms` | Есть | Wall time от смены вопроса до ответа |
| Reading/feedback time | Нет точного | Интервал answer -> next можно получить как proxy, но он включает фон/модалки |
| Screen dwell/visible time | Нет общего измерения | `screen_viewed` не даёт надёжных границ |
| Paywall `time_visible_ms` | Есть, название сильнее измерения | Wall time от view до dismiss; может включать фон/checkout |
| Offer load/request duration | Есть | Разные clocks; кеш и запрос SDK разделены, но это не foreground ожидание |
| Checkout `app_active_ms/background_ms/inactive_ms/unobserved_ms` | Есть | Только checkout, не всё приложение и не доказательство отзывчивости UI |
| Sign-test active duration | Нет | Есть ответы и terminal, нет собственного агрегата времени |

[`getExamDurationSeconds`](../../mobile/src/features/exam/exam-result-stats.ts) не вычитает фон. Training и sign-test считают answer duration через `Date.now()`. Exam answer clock сбрасывается при смене вопроса и тоже использует wall time.

[`useExamQuestionTimer.ts`](../../mobile/src/features/exam/useExamQuestionTimer.ts) и [`timed-session-clock.ts`](../../mobile/src/features/questions/timed-session-clock.ts) приостанавливают игровые таймеры при фоне/рекламе. **Это не исправляет автоматически analytics `answer_duration_ms`: clocks разные.**

### 5.4. Что нужно для точного времени

Минимально нужен общий foreground clock и summary/checkpoint, а не heartbeat на каждый ответ:

| Предложенное событие | Для чего | Минимальные поля |
|---|---|---|
| `app_visit_started` | Явное foreground-посещение | `app_visit_id`, `app_run_id`, `start_reason`, нормализованный entry |
| `app_visit_checkpoint` | Не потерять всю длительность при kill | `app_visit_id`, `checkpoint_index`, **накопленные** foreground/engaged значения, последний экран/attempt |
| `app_visit_ended` | Наблюдаемая граница background | `app_visit_id`, duration counters, `end_reason=background` |
| `screen_visit_started/ended` | Видимость экрана/состояния | `screen_visit_id`, `app_visit_id`, `screen_name`, `view_state`, entity ID, foreground/engaged time |

Предложенный foreground visit: cold start в active либо переход из background в active. Короткий `inactive` системного диалога учитывать отдельно, не создавать автоматически новый визит. Это другая метрика, чем 30-минутный SDK session.

Checkpoint может быть, например, раз в 60 секунд активного состояния, при важных переходах и при фоне. Частоту выбрать по стоимости и допустимой потере хвоста, не считать 60 секунд уже существующим стандартом.

Для cumulative checkpoint аналитик берёт **последний/максимальный накопленный счётчик на visit**, не сумму всех checkpoint. Иначе длительность удвоится/утроится. На kill terminal не гарантирован: показывать observed lower bound и unknown tail, не выдумывать закрытие.

Engaged time требует явного правила, например остановки после 60 секунд без взаимодействия. Но просмотр видео и чтение объяснения могут быть активностью без тапов. Согласовать исключения, записать `engagement_policy_version`; foreground не называть «время обучения».

Для answer clock разделить `question_visible_foreground_ms`, media waiting и, при необходимости, `answer_phase_active_ms`. Текущий wall-time ключ сохранить с прежней семантикой для совместимости.

## 6. Частота использования: что можно считать уже сейчас

Нового события `user_returned_every_day` не нужно. Это производные метрики от полных событий и timestamps.

Сначала определить набор событий активности:

| Набор | Смысл | Пример |
|---|---|---|
| App active | Открыл и использовал приложение | Доступный lifecycle open/active или продуктовый view/action |
| Learning active | Реально занимался | Training/exam/sign answer; review item как отдельный класс |
| Meaningful learning day | Получил достаточную учебную ценность | Согласованный порог, например >=5 ответов или >=1 завершённая непустая попытка |
| Commercial active | Работал с доступом | Paywall/checkout/restore, отдельно от учебной активности |

Примеры порогов являются предложением, а не утверждённым KPI. `client_error_logged`, `$set`, ad policy skip, фоновые callbacks не должны сами создавать learning-active день.

| Метрика | Определение | Статус |
|---|---|---|
| DAU/WAU/MAU | Unique app identity с выбранным activity set в календарном/rolling окне | Вычислимо |
| Learning DAU | Unique с учебным действием | Вычислимо |
| Stickiness | DAU/rolling MAU с одинаковым activity set | Вычислимо; не индивидуальная частота |
| Active days / 7 / 30 | Число календарных дней активности на identity | Вычислимо при полном окне |
| Days/week distribution | Доли с 1, 2-3, 4-5, 6-7 active days | Вычислимо; границы групп согласовать |
| SDK sessions/user/day | Distinct `$session_id` / active identity | Вычислимо в production dump, не в исходном local JSONL |
| Foreground visits/day | Distinct visit ID | Точно пока нет; lifecycle proxy отдельно |
| Attempts/day и режимы | Distinct learning attempt IDs, first start отдельно от resume | Для новой схемы значительно надёжнее |
| Answers/day | Count логических answer events с дедупом | Вычислимо, учитывать повторные ответы в экзамене |
| Recency | Время от последней meaningful activity до конца окна | Вычислимо, не время от последнего `$set` |
| Inter-return gap | Разница между activity days/visits | Дни вычислимы; визиты пока proxy |
| Streak | Подряд календарные learning days | Вычислимо с lookback; начало окна обрезает streak |
| Reactivation | Meaningful activity после заранее заданного периода тишины | Вычислимо только при достаточном lookback |
| Frequency after purchase | Те же показатели до/после подтверждённого доступа | Вычислимо, но не причинный эффект покупки |

Показывать median/p25/p75/p90, а не только average. Считать user-weighted и event-weighted показатели отдельно: один очень активный покупатель может определять большую часть ответов.

Для «частоты новых пользователей» не смешивать ученика на первом дне и identity с месяцем наблюдений. Нужны одинаковые matured окна D0-6/D0-29. Для established users подходит rolling окно на дату среза.

Календарный день продукта: `Europe/Warsaw`, с реальными правилами DST, не постоянный UTC+2. Для человека в другом часовом поясе это продуктовый день, не обязательно его локальные сутки. Если нужен local-day анализ, отдельно сохранять timezone/offset в согласованном контракте и не менять определения задним числом.

## 7. Retention и когорты

### 7.1. Что считать

| Метрика | Правильный вопрос |
|---|---|
| Open retention | Вернулся ли открыть приложение |
| Learning retention | Вернулся ли учиться |
| Completion retention | Снова закончил непустую учебную попытку |
| Review retention | Вернулся ли к разбору/повторению |
| Paid retention | Использует ли продукт после получения доступа |
| Rolling retention | Вернулся ли в день N или позже в определённом горизонте |

Exact D7 и rolling D7 не взаимозаменяемы. Не вводить новый event для каждого дня retention; нужны правильные запросы и данные.

### 7.2. Главные ограничения сейчас

**Первое событие в дампе не равно первой установке.** Если выгружены только последние два дня, впервые увиденная identity может быть старой. `Application Installed` отражает SDK storage/build lifecycle, не гарантирует первое появление человека.

Нужна all-time first-seen таблица либо lookback достаточной длины с явной меткой `first_seen_proxy`. Локальный reset обучения сохраняет native app identity, поэтому повторный onboarding не следует считать acquisition нового пользователя.

`onboarding_step_completed` не содержит отдельного `onboarding_attempt_id`/причины нового onboarding. Полезно различить `first_run`, `progress_reset`, `migration`, `unknown` и версию first-run flow.

D1/D7/D30 считать только среди когорт, которым доступен **полный целевой день** плюс согласованный запас для поздних офлайн-событий. Неполный 2 октября нельзя механически сравнивать с полным 1 октября.

Формула exact retention:

```text
cohort_day = first qualifying activity day
eligible_N = identity whose cohort_day + N is fully observable
retention_N =
  identity from eligible_N with return activity on cohort_day + N
  / identity in eligible_N
```

Указать, включает ли D0 обучение, onboarding или SDK first-open. Если когорта строится по первому ответу, retention уже **условен на активацию** и не описывает всех новых установивших.

### 7.3. Какие разрезы важны для Prawko

Страна экзамена, категория, UI locale, release/build, начальный access tier, первый успешный режим, канал acquisition и путь активации. Для paywall exposure учитывать, был ли он до первого ответа/первого completion, и считать это ассоциацией, не доказанным причинным влиянием.

Учебный продукт имеет естественное окончание задачи: отсутствие возврата после реального экзамена не обязательно неудовлетворённость. Сейчас есть `days_until_exam` при onboarding, но нет наблюдаемого исхода реального экзамена или причины прекращения подготовки. Если это важно, использовать добровольный структурированный ответ, не свободный текст и не догадку по тишине.

## 8. Активация и текущий Home

### 8.1. Реальная стартовая цепочка

Текущий first-run: category -> exam schedule -> `finalizeLocalOnboarding` -> roadmap Home. `app_entry` намеренно не создаёт `screen_viewed`, потому что это шлюз/redirect.

[`ReadinessIndexBlock.tsx`](../../mobile/src/features/home/ReadinessIndexBlock.tsx) задаёт `showStartSpotlight=false`. Единственный найденный `firstStartShown` callsite находится в закомментированном коде `app/old/index.tsx`. `useHomeContextualBlock` используется только в старом Home, не в текущем `app/(tabs)/index.tsx`.

**Следствие:** ноль `first_start_shown`/`home_contextual_shown` в текущем UI не доказывает отвал. Эти шаги нельзя делать обязательными в текущей activation funnel.

`first_start_started` остаётся действующим intent на readiness-карточке Home/Learn. Это не общий first action всех новичков: многие начинают непосредственно roadmap.

### 8.2. Предлагаемые activation KPI

1. Onboarding -> доступный Home.
2. Первый learning intent -> ready question.
3. Первый ready question -> первый ответ.
4. Первый ответ -> первое непустое completion.
5. Первое completion -> второе учебное действие в этом/следующем визите.
6. Learning-active D1/D7, отдельно от простого открытия.

TTFV мерить от явно выбранной стартовой точки до первого ответа/результата. Показывать долю активированных и time distribution среди активированных вместе. Быстрые 40 секунд у успешно дошедших не объясняют остальных.

### 8.3. Пробелы

Нет явного `onboarding_started/completed` с flow version/attempt ID. Доступны step completion и study plan creation, но их нельзя считать новой активацией при каждом повторном onboarding.

Нет общего `home_ready` или snapshot видимого состояния: `readiness_empty/loading`, roadmap progress, eligible CTA. `screen_viewed=home` не доказывает готовность всех данных.

`roadmap_step_opened` хорошо описывает **tap**, но не видимость/eligibility круга. Без exposure нельзя оценить CTR каждого круга: низкое число тапов может означать, что до него не скроллили.

Вначале добавить readiness/entry state, не impression на каждый компонент. Viewability карточек нужна только если действительно сравнивается их CTR.

## 9. Training: покрытие и оставшиеся пробелы

Новая схема закрывает основную ошибку old-result completion и делает известным путь «question -> answer -> feedback -> result -> review». Основные источники: [`useQuestionTrainingSession.ts`](../../mobile/src/features/questions/training/useQuestionTrainingSession.ts), [`useTrainingResultAnalytics.ts`](../../mobile/src/features/questions/training/useTrainingResultAnalytics.ts).

| Участок | Что уже есть | Чего не хватает |
|---|---|---|
| Выбор параметров | Setup view/resolved, mode selected | `setup_id` не прокинут в будущий attempt; общий learning intent ID отсутствует |
| Прямой roadmap start | Roadmap tap и session context | Не всегда есть единый launch intent/ready/failure |
| Первый вопрос | `training_question_viewed` | Start-to-ready duration, loading/failed reason, media-ready |
| Ответ | ID/index/correctness/content metadata | First vs повторный encounter, версия контента и answer clock foreground |
| Feedback | Continue action и explanation view | Фактическое visible/engaged reading time |
| Финал | Completion, result view/action | Duration aggregate, end reason для blitz/лимита, durable delivery |
| Review | Open/item/close, review ID | Active duration; промежуточная навигация/выход в фон не создаёт точный dwell |
| Явный выход | Abandoned + reason/counts | Exit dialog view и выбор stay/leave, intent vs confirmation |
| Kill/restart | Resume | Нет гарантированного terminal; нельзя превращать тишину в явный abandon |

Не делать `training_mode_selected` обязательным перед каждым стартом: roadmap может создавать попытку напрямую. Не считать `training_question_viewed already_answered=true` новым вопросом обучения.

`training_session_completed` отражает наблюдавшийся переход finished в этом посещении, но не exactly-once durable событие. Авария между сохранением finished и отправкой может оставить только будущий `training_result_viewed result_origin=existing_result`.

Для контентного результата полезны `completion_reason` и `question_selection_policy_version`. Разные «learning», mistakes, review, diagnostic и blitz имеют разные критерии успеха. Процент правильных ответов после многократного повторения не является независимой проверкой знаний.

## 10. Exam: покрытие и неоднозначность

У launch есть request/failure и `launch_attempt_id`, а также session started/resumed. Новая схема различает offline block и category mismatch. `exam_restart_*` относится **только к модалке New attempt на результате**.

В текущем V2 существует отдельная проверка `resolveExamStart` в [`exam/index.tsx`](../../mobile/app/exam/index.tsx): `source=exam_limit` может отправить на paywall до новой попытки. Это не `exam_restart_gate_shown` и не доказательство календарного daily-cap. В [`usage.ts`](../../mobile/src/features/monetization/v2/usage.ts) используется `freeExamUsed`/credit.

| Пробел | Последствие |
|---|---|
| Нет `exam_question_viewed` | На старте без ответа нельзя доказать, какой вопрос был доступен |
| Нет общего ready/load duration | `exam_session_started` означает создание, не полный render-ready |
| Свободная навигация/flag не отслеживаются | CZ/SK unanswered question может быть пропущен или посещён несколько раз |
| Answer event не помечает create/update | Повторная запись ответа может считаться дополнительным решённым вопросом |
| Result shell есть, result state нет | Просмотр старого результата, loading и готовый результат недостаточно различаются |
| Review только open из primary CTA | Нет per-item/close/review ID; deep-link review не создаёт тот же open |
| Result CTAs не унифицированы | Close, finish, review, new attempt сложнее сравнивать с training |
| UI failures часто только `console.warn` | Отсутствие ответа можно ошибочно назвать потерей интереса |

`exam_session_ended` **не всегда abandon**. [`exam/session.tsx`](../../mobile/app/exam/session.tsx) отправляет его и с `end_reason=learner_finish,status=completed`, затем приходит completion на результате. Для dropout фильтровать status/reason и не складывать ended с completed как две попытки.

В этой же странице ошибки загрузки, сохранения/отправки ответа, навигации, flag и finish показываются через `setErrorMessage`, но не все уходят в `client_error_logged`. Нормализованное событие видимой ошибки с operation/attempt/question/visibility полезнее ещё одного события mount.

Экзаменный completion зависит от пути в result и `justFinished`; finalize после kill/expiry без такого открытия может не дать канонический completion. Durable попытки и клиентские события нужно сверять, а не считать отсутствие клиентского финала доказанным неуспехом.

Для итоговой accuracy в free-navigation брать последнее подтверждённое состояние каждого вопроса в attempt. Для поведенческого анализа сохранять ревизии ответа отдельно; запрос `count(exam_question_answered)` не всегда равен числу уникально отвеченных вопросов.

## 11. Знаки, поиск и объяснения

У sign tests есть start/answer/end, session ID, category и entry. Тест можно начать из общего каталога/категории/статистики без открытия карточки. `sign_opened -> sign_test_started` не является универсальной воронкой.

`sign_practice` и общий sign test используют один набор имён, но разные UI-финалы. Нужны question view, feedback/result view и active duration, если требуется точный разбор отвалов до ответа/после него. Явный Back и `outcome=abandoned` не покрывают все случаи kill/navigation.

[`signs/search.tsx`](../../mobile/app/signs/search.tsx) пишет `sign_search_submitted` после 400 мс debounce с длиной и количеством результатов. Это не обязательно submit кнопкой и не одна поисковая сессия. Повторные edits создают несколько событий.

**Пробелы поиска:** нет `search_id`, outcome `result_selected/cleared/left`, position, origin у перехода в sign detail. Можно оценить долю нулевых результатов, но не точную success conversion поиска. Текст запроса отправлять не нужно; hash свободного текста тоже не становится автоматически безопасной/полезной аналитикой.

`question_bookmark_changed` также используется для закладки знака: `question_id=sign.id`, `source=sign_detail`. Для content analytics нужны `entity_type`/соответствующий ID, иначе число «закладок вопросов» смешивается со знаками. До уточнения схемы обязательно учитывать source.

[`QuestionTrainingView.tsx`](../../mobile/src/features/questions/training/QuestionTrainingView.tsx) пишет `answer_explanation_viewed`, когда ответ уже дан и есть Plus. Это availability/display exposure, не подтверждение, что объяснение прочитано или текст найден. Нет общего explanation-source/version/presence/read time; exam/sign explanation покрыты несимметрично.

## 12. Контент, медиа и качество обучения

### 12.1. Что можно вывести

Accuracy и распределение answer wall time по стране/режиму/question ID/media type, баланс тем и охват уникальных вопросов. Для сравнения вопроса использовать составной контекст страны/question set и ID; не предполагать глобальную уникальность произвольного локального ID.

Нужны минимум две accuracy:

- Event-weighted: какие ответы в сумме получаются правильными.
- User/attempt-weighted: как отвечает типичный ученик/типичная попытка.

Отдельно first encounter, повторное решение, экзаменный окончательный ответ и тренировочное learning-after-feedback. Иначе рост accuracy может быть просто ростом доли знакомого контента.

### 12.2. Чего не хватает

На событиях нет единого `question_set_key`, версии банка/вопроса/объяснения, selection policy, числа previous attempts или признака first encounter. Нельзя уверенно сравнить качество до/после изменения локализованного текста или банка.

UI readiness/coverage/roadmap state вычисляется локально, но нет согласованного analytics snapshot с версией формулы. Пересчитать точную показанную готовность из неполного дампа нельзя. Для аналитики прогресса нужен state snapshot при важных изменениях/visits, а не полный state на каждом ответе.

### 12.3. Медиа

[`QuestionMediaCard.tsx`](../../mobile/src/features/questions/QuestionMediaCard.tsx) уже нормализует image preview failure через `getQuestionImagePreviewErrorCode`; утверждение старого README об отсутствии code не описывает весь текущий код.

Но image success фиксируется локальным `setIsLoaded`, video sourceLoad/progress/play/end идут в UI callbacks, а не в общий продуктовый контракт. Нет гарантированной пары media request -> ready/fail и denominator всех загрузок.

Image failure содержит media key/source/path/URL, но не обязательные `question_id`, learning attempt и screen visit. Поэтому трудно уверенно связать проблему с конкретным видимым заданием без восстановления каталога.

Минимальное дополнение: `question_media_load_resolved` с question/attempt/visit, `outcome`, media type/source, duration и low-cardinality code; start нужен лишь если анализируется зависшее ожидание. Video start/end/watched fraction можно отдавать агрегатом, **не `timeUpdate` каждые 100 мс**.

Не отправлять полный URL с query/подписанным токеном. Предпочтительны media ID и нормализованный host/source kind.

## 13. AI-чат

В [`use-question-ai-chat.ts`](../../mobile/src/features/ai/use-question-ai-chat.ts) есть sent/resolved/failed, plus-block и fallback с provider; пользовательский prompt не отправляется.

Основные product events не имеют общего `message_request_id`/conversation ID, duration, модели и результата отображения. Conversation ID существует в request/fallback metadata, но не связывает регулярно sent -> resolved.

При нескольких сообщениях одного вопроса связывание по timestamps остаётся вероятностным. Нельзя точно измерить response latency, различить «ответ получен» и «ответ увидел», оценить reuse pregenerated explanation или стоимость.

Минимум: request ID, conversation ID при необходимости, model/fallback kind, latency, response outcome; backend token/cost metrics связывать отдельно. Не писать текст сообщений, полный history или ответ ассистента в product analytics.

## 14. Уведомления и источник возврата

Permission requested/resolved и diagnostic reminder shown/resolved есть. Это описывает настройку, **не доставку уведомления и не возврат от него**.

[`notifications/runtime.ts`](../../mobile/src/features/notifications/runtime.ts) планирует локальное daily-уведомление без аналитического `content.data`. [`NotificationSetupProvider.tsx`](../../mobile/src/providers/NotificationSetupProvider.tsx) синхронизирует состояние на startup/foreground. В проверенном коде нет response/open listener, который связывал бы запуск с конкретным reminder.

Пробелы:

- Permission и schedule success/failure недостаточно разделены в analytics.
- Изменение permission в OS обнаруживается sync, но не имеет единого state-change event.
- Нет reminder ID/kind/scheduled slot, normalised notification-open и next-learning attribution.
- Нет согласованного `entry_reason=notification/deeplink/direct/unknown`.

Нельзя вычислять notification CTR как opens / scheduled: scheduling не доказывает доставку ОС. Можно считать observed notification-open -> ready question -> answer -> completion после добавления response tracking. Если delivery недоступна, denominator честно назвать eligible scheduled reminders, не delivered.

Для оценки влияния reminders сравнивать согласованные когорты/эксперимент. Пользователи, добровольно включившие напоминания, уже отличаются по мотивации; корреляция retention не доказывает эффект.

## 15. Offline и связь с качеством сервиса

Download start/completed/cancelled/failed, remove и access block есть. Схема 2 добавляет visible learning block/action.

[`offline-mode.tsx`](../../mobile/app/offline-mode.tsx) не передаёт download attempt ID, pack/catalog version, operation download/resume/update, bytes/assets и duration. Исходный state ready/missing/incomplete/downloading недостаточно виден.

`handleStopDownload` сразу пишет `offline_pack_download_cancelled source=stop_button`; catch download пишет тот же ключ при `code=cancelled`. Одна отмена может дать **intent и terminal под одним именем**. Без operation ID дедуп по времени ненадёжен.

Remove failure отправляется как `offline_pack_download_failed operation=remove`; фильтровать operation, иначе испортится download failure rate.

Старт при unavailable catalog останавливается с visible feedback до download event. Это нельзя автоматически классифицировать как отсутствие желания скачать.

Полезное дополнение: `download_attempt_id`, action intent отдельно от одного terminal, operation, начальный/конечный pack state, duration и значимые progress checkpoints. Не логировать каждый процент. После успешного retry learning block нужна явная связь `block_id -> ready` либо `resolved` с тем же ID.

Единый snapshot `is_online`, offline readiness и catalog source важен для failed learning launches. На каждом answer эти поля добавлять только если нужен соответствующий разрез; не дублировать большие manifest.

## 16. Paywall, деньги и реклама

### 16.1. Корректная коммерческая воронка

Gate/exposure -> paywall view -> usable offer -> CTA intent -> preparation -> native checkout -> outcome/access. Gate не является обязательным перед каждым прямым paywall. Offer refresh не является новым view. Restore не является новой покупкой.

Использовать собственные IDs view/offer/attempt, а не nearest timestamp. Pending и outcome_unknown оставлять отдельной незавершённой группой и проверять последующие recovery outcomes за пределами окна.

`paywall_package_selected` исторический: selector отсутствует, пакет выбирается кодом. Ноль событий не означает отсутствие коммерческого намерения.

### 16.2. Оставшиеся коммерческие пробелы

Нет общего события access-state change для всех причин Plus: purchase, restore, school code, sync, expiration. Base `is_plus` полезен, но это снимок на следующем событии, не полная история переходов.

`time_visible_ms` остаётся wall time. Offer ready уже лучше защищён от записи для скрытого/background экрана, но сам view и duration не дают общего screen-visible clock.

Client price/currency и success не являются бухгалтерской выручкой. Для gross/net/LTV нужны серверные транзакции, refund/revocation, fee/tax/currency conversion policy и transaction dedup. В проверенном мобильном контракте этих фактов нет; наличие возможной внешней RevenueCat-интеграции не проверено.

Для paid cohorts учитывать grant source и entitlement/product. Школьный доступ, restored ownership и новый native purchase не должны быть одной acquisition conversion.

### 16.3. Реклама

Есть requested/shown/dismissed/skipped/failed, reward и paid impression revenue. Но нет единого `ad_attempt_id`/impression ID для корреляции lifecycle с выручкой, конкретной учебной попыткой и последующим возвратом.

`detail` содержит диагностическую строку; parsed structured fields предпочтительнее для группировок. В error/ad семействах `should_show` может иметь отличающуюся форму; тип/enum надо валидировать на конкретном событии.

В текущем [`FEATURE_FLAGS`](../../packages/config/src/index.ts) `enableAds=false`. Это факт текущего исходника, не гарантия всех исторических/production версий. `ad_skipped reason=disabled` не должен создавать engagement/learning activity и раздувать продуктовые funnels.

Частые неизменные policy skip можно агрегировать/семплировать после проверки нужного denominator. Revenue и outcomes не семплировать. Для будущего ROI нужны acquisition attribution и фактический канал; Apple Ads CSV агрегаты не связывают автоматически конкретный `app_user_id` с кампанией.

## 17. Auth, настройки и поддержка

[`onboarding/access.tsx`](<../../mobile/app/(onboarding)/access.tsx>) валидирует форму **до** `auth_started`; validation errors не видны в этой воронке. `auth_completed confirmation_pending=true` означает отправленный sign-up с ожиданием подтверждения, не успешный вход в аккаунт.

У auth нет attempt ID и общей latency, mode-switch не виден, email confirmation completion может происходить позже/на другом устройстве. Для точного funnel нужны `auth_attempt_id`, `outcome=authenticated/confirmation_pending`, normalized validation reason без email/password.

`signed_out` есть в каталоге, но нет активного отправителя. В текущем UI отдельного logout-пути не найдено; reset может выполнять signOut как внутренний шаг. Не требовать `signed_out` от несуществующего UI и не считать его отсутствие auth bug.

Settings events частично есть, но reused onboarding routes дают screen name `onboarding_*` также при настройке категории/языка. Нужен `flow_context=first_run/settings` на view/state, иначе настройки увеличивают знаменатель onboarding.

`progress_reset_confirmed` пишется после `await resetAppToFreshStart`, а не в момент нажатия подтверждения. Это успешный возврат helper, но не гарантия полного удаления: helper проглатывает часть cleanup/storage errors. Отдельного intent/start/failure нет; если helper отверг promise раньше, событие не появится. Для наблюдения reset нужны outcome/failure и связь с следующим onboarding; новый app identity создавать не нужно.

Support email/share/review events отражают intent/API request, не отправленный email, опубликованный отзыв или привлечённую установку. Внешний результат неизвестен, если канал его не возвращает.

## 18. Ошибки, startup и delivery

### 18.1. Ошибки

[`ErrorLoggingProvider.tsx`](../../mobile/src/providers/ErrorLoggingProvider.tsx) нормализует captured errors, отслеживает JS global handler и React boundary после mount. Есть полезные area/event_name/code/severity и отдельный fallback.

Но это не универсальная запись любого `console.warn`, native crash, ANR или загрузки до mount. Для error rate нужен denominator соответствующих операций, а не все события.

Нужен единый контекст error: `operation_id`, learning attempt, question, screen visit, `user_visible`, retryability и normalized outcome. UI-only ошибки экзамена приоритетнее десятков необязательных tap events.

Связывать «ошибка -> повтор -> успех» по operation/parent attempt. Близость по времени не доказывает, что ошибка стала причиной ухода.

### 18.2. Startup blind spot

[`app/_layout.tsx`](../../mobile/app/_layout.tsx) монтирует AnalyticsProvider только после fonts и `getOrCreateAppUserId`. Ошибки/зависание до этого момента могут не попасть в PostHog. Для identity promise в layout нет собственного catch/analytics outcome.

`markInteractive` и global attributes отправляются в Expo Observe, не в product PostHog. Это полезная отдельная система, но её дамп и session linkage здесь отсутствуют.

Нужны границы startup started/ready/failed и duration в observability, а для продуктового join достаточно согласованного run/visit ID. Не пытаться гарантировать startup failure event через provider, который ещё не создался.

### 18.3. Delivery не полностью отсутствует

В установленном `@posthog/core/dist/posthog-core-stateless.js` по умолчанию:

| Механизм | Значение/поведение |
|---|---|
| Flush threshold | 20 событий |
| Flush interval | 10000 мс |
| Max batch | Не менее flush threshold, default 100 |
| Max queue | Не менее flush threshold, default 1000 |
| Fetch retries | 3, delay 3000 мс |
| Queue overflow | Удаляет самое старое событие |
| Network exception после retry | Batch остаётся для последующей отправки |
| HTTP failure после retry | Batch может быть удалён из очереди; 413 разбивается, если возможно |

RN имеет persistence и flush на AppState change. Поэтому утверждение «при офлайне всё теряется» неверно. Но сохранение в SDK queue и запись доменного результата не образуют единую атомарную транзакцию.

Приложение не наблюдает delivery health как отдельный контролируемый канал. Sequence gap помогает обнаружить подозрение на пропуск **только при полном экспорте всех wrapper events**, не его причину. Нет trailing event -> нет гарантии обнаружить потерянный хвост.

Для критических terminal/outcome нужен либо durable event outbox с логическим idempotency key, либо восстановление из доменного источника. Не создавать такой outbox для каждого UI tap без доказанной необходимости.

`event_id` схемы 2 является продуктовым property. Он не автоматически настраивает дедуп серверного PostHog по этому полю. Логический дубль, заново captured с новым sequence, получит новый ID; для terminal дедуп нужен attempt + outcome, для answer ещё revision/answer ID.

### 18.4. Build gate и локальная запись

Capture отключён при dev/e2e/определённом TestFlight. Preview/internal не является отдельным проверяемым признаком функции: защита зависит от env и native distribution detection. На iOS локальный StoreDistribution читает receipt; отсутствие модуля/error приводит к `false`. Надёжность конкретного shipped binary здесь не проверена.

Нужно экспортировать build number, release channel/update/runtime version и нормализованный analytics environment. SDK уже имеет `$app_build` и device/app properties: сначала сохранять их в экспорте, не дублировать без необходимости. Одинаковый `app_version` не доказывает одинаковый bundle/feature policy.

Локальный logger записывает wrapper capture/screen/identify через отдельный fire-and-forget HTTP, не SDK lifecycle/enrichment. Ошибки отправки проглатываются, server при старте обнуляет свой файл. Он полезен для продуктового контракта, **не доказательство production-доставки, session duration или alias-поведения**.

## 19. Privacy и качество самого контракта

### 19.1. Подтверждённое расхождение

[`AnalyticsProvider.tsx`](../../mobile/src/providers/AnalyticsProvider.tsx) напрямую вызывает `posthog.identify` с **email и full_name**, обходя общий sanitizer. Поэтому формулировка «в PostHog не будет email/full_name» неверна для всего приложения. Локальный wrapper-log не отражает этот прямой вызов.

Это не юридическое заключение о допустимости сбора. Это технический факт и расхождение с документированной политикой. Нужно явно решить: эти поля действительно нужны или должны быть удалены из identity sync. Для реконструкции учебного пути они не нужны.

### 19.2. Sanitize не является allowlist

[`catalog.ts`](../../mobile/src/analytics/catalog.ts) использует denylist девяти имён. Все прочие ключи проходят. Primitive TypeScript type не гарантирует runtime enum, finite numbers, обязательный ID, низкую cardinality или отсутствие PII под другим названием.

URL/diagnostic/error code/stack под новым ключом не защищены этим правилом. SDK `Application Opened` также может отправить initial URL мимо product sanitizer; реальные deep-link payload здесь не доказаны как содержащие секреты, но raw URL нужно проверить.

Нет app-level optIn/optOut/consent flow в проверенных analytics callsites. Build flag не равен пользовательскому выбору. Требования к такому выбору определить отдельно; не делать правовой вывод из исходника.

### 19.3. Контракт слишком свободный

`AnalyticsEventPayloads[EventName]` одинаков для всех событий: `Record<string, primitive>`. Имена защищены типами, значения и обязательные поля почти нет. Не хватает per-event required properties и enums.

Приоритет для строгих схем: lifecycle попыток, коммерческие outcomes, gates/launch errors и новые time summaries. Не нужно сразу типизировать каждую историческую декоративную property.

`source`, `mode`, `session_id`, `category_id`, `question_total`, `previous/value` имеют разные смыслы в семействах. Документация должна явно показывать scope. `question_total` банка нельзя использовать как выбранный count setup, а точку выбора нельзя автоматически считать стартом.

Не удалять legacy event names из каталога: они нужны для исторических dumps. Пометить availability `active/legacy/not_current_flow` и версию семантики, чтобы дашборд не делал их обязательными.

## 20. Как выгружать данные для точного анализа

Одного массива сокращённых product events недостаточно для всего аудита.

### 20.1. Event export

Для каждой записи сохранять event name, server/SDK timestamp, event UUID при доступности, `distinct_id`, `person_id` при доступности, **полные properties**, `$session_id`, app identity, version/build, schema/run/sequence/client time и operation IDs.

Не заменять весь payload агрегатами «количество по имени» и не отбрасывать SDK lifecycle, если спрашивается duration/frequency.

Не выгружать email/full_name/текст/секреты для этого анализа. Pseudonymous identity и IDs операций достаточны.

### 20.2. Manifest выгрузки

```text
project_id
exported_at_utc
event_time_from_inclusive / event_time_to_exclusive
product_timezone = Europe/Warsaw
query_and_filters / excluded_environments / excluded_events
pagination_finished / row_count / truncation_or_limit
latest_fully_observed_day
late_arrival_allowance / re-export_policy
lookback_from / first_seen_source
builds_and_schema_versions_present
person_join_mode / identity_key_policy
```

Если ingestion timestamp недоступен, явно отметить это. `client_occurred_at` не заменяет время приёма: клиентские часы могут быть неверны. При офлайне поздние события могут дозаполнить прошлый день.

### 20.3. Дополнительные источники

Для exact retention: first-seen/account mapping с прошлой историей. Для authoritative attempt outcomes: доменные summaries, включая гостевые/offline ограничения доступности. Для выручки: серверные транзакции/возвраты. Для startup/performance: Observe/crash данные. Для acquisition: атрибуция или агрегатный Ads отчёт с честно ограниченной связью.

Отсутствие такого источника помечать `unknown`, не реконструировать с уверенностью.

## 21. Правила воронок и реконструкции

Воронка unique users с «было событие A и B когда-нибудь в окне» не является последовательным прохождением. Статус внешнего дашборда нужно проверить отдельно.

| Семейство | Основной join key | Необязательные/альтернативные шаги |
|---|---|---|
| Onboarding | Предлагаемый onboarding attempt; пока identity + flow context/time | Settings route, legacy steps |
| Setup -> training | Предлагаемый intent ID; внутри attempt `training_session_id` | Setup/mode selected при direct roadmap |
| Exam launch | `launch_attempt_id` -> `exam_session_id` | Resume и blocked являются отдельными исходами |
| Review | `review_id` + learning attempt | Повторные views и review return |
| Gate -> paywall | `premium_gate_id`/`block_id` -> `paywall_view_id` | Direct paywall без gate |
| Offer/checkout | View -> offer cycle/native attempt | Несколько refresh, closed view и поздний outcome |
| Restore | `restore_attempt_id` | Legacy `restore_*` не дополнительная попытка |
| Ads/offline/AI | Предлагаемые operation IDs | Сейчас часть связей вероятностная |

Логика реконструкции:

1. Проверить manifest, версии, полноту и timezone.
2. Отделить SDK/diagnostic/background callbacks от пользовательских действий.
3. Нормализовать app/account identity без необоснованных merges.
4. Дедуп transport записи по доступному UUID/event ID; логические outcomes по attempt/revision.
5. Внутри runtime упорядочить wrapper events по sequence; cross-runtime clocks использовать с оговоркой.
6. Построить отдельные visits, attempts, reviews и checkout state machines.
7. Классифицировать завершённые, явно прерванные, blocked, failed, pending и censored.
8. Указывать confidence каждого вывода и неизвестный участок.

Последнее событие в дампе не означает последнее действие пользователя. `screen_viewed=question_training` без question-ready не означает «прочитал вопрос и ушёл».

## 22. Приоритеты исправлений

### P0: сначала не делать ложных выводов

| Задача | Почему | Где |
|---|---|---|
| Убрать legacy spotlight/contextual/package selection из обязательных funnels | Нули описывают несуществующий текущий UI | Keys, README, внешний dashboard |
| Разделить SDK session, app visit и learning attempt | Иначе неверны duration и completion counts | Metric definitions/export |
| Помечать partial days/first-seen proxy/censored outcomes | Иначе фиктивный retention и drop | Export/analysis |
| Явно решить email/full_name в direct identify | Документация и реальная отправка расходятся | AnalyticsProvider |

### P1: минимальная новая инструментация для точного разбора

| Задача | Аналитический результат |
|---|---|
| Foreground visit + cumulative checkpoints | Настоящее observed active time, visits/day и ограниченный хвост при kill |
| Screen/state visit context и ready duration | Отделение loader/block от рабочего задания, видимое время |
| Learning intent ID через setup/roadmap/gate/launch | Сквозная цепочка до создания attempt, включая неуспешный старт |
| Exam question view, answer revision, result/review lifecycle | Экзамен становится читаемым без Maestro, включая CZ/SK |
| User-visible normalized errors с attempt/operation | Технический blocker не выглядит как потеря интереса |
| Notification open/entry attribution | Понятен источник возврата и дальнейшая учебная ценность |
| Offline operation ID и одна terminal отмена | Корректные retry/cancel/failure rates |

### P2: продуктовая глубина и надёжность

| Задача | Что добавляет |
|---|---|
| Контент/selection/readiness versions и snapshots | Качество обучения и сравнение контентных изменений |
| Media load outcome + video aggregate | Причина ожидания/ухода и denominator media failures |
| AI/ad operation IDs | Латентность, стоимость, выручка и связь с учебным путём |
| Access change/server money join/acquisition | Paid cohorts, LTV/ROI без выдуманной бухгалтерии |
| Required payload schemas/enums/availability | Предотвращение нового дрейфа контракта |
| Delivery health/critical domain outbox | Разделение продуктового drop и потерь телеметрии |

**Порядок:** определения и export -> сессии/время -> ready/error/context -> симметричный exam/review -> возвраты -> контент/коммерческая глубина. Не добавлять все предложенные события одновременно без чёткой аналитической задачи.

## 23. Критерии приёмки следующего этапа

Это перечень будущих проверок, **не результаты выполненных тестов**.

| Сценарий | Что должно быть понятно по одному дампу |
|---|---|
| Cold start без действий -> background | Наблюдаемый visit и duration; learning time нулевое |
| Вопрос -> 10 минут фона -> ответ | Wall duration и active duration различаются |
| Kill до background callback -> новый запуск | Старый visit censored, хвост не выдуман; новый run/visit |
| Настройка count -> cancel | Setup закрыт, learning attempt не создан |
| Roadmap direct start | Нет искусственно обязательного mode-selected; есть intent -> attempt |
| Loader/network/media failure -> retry -> ready | Одна связная операция и видимый blocker |
| Finished result -> review -> restart | Result view не создаёт старый completion; новый attempt имеет новый ID |
| CZ/SK skip -> return -> edit answer -> finish | Views/revisions отделены от уникально отвеченных вопросов |
| Exam learner_finish | ended с completed не считается abandon |
| Sign test из категории | sign detail не является обязательным входом |
| Offline stop | Intent плюс один terminal с одним operation ID |
| Notification open -> learning | Источник возврата наблюдаем, delivery не выдумана |
| Paywall close -> поздний success/recovery | Outcome привязан к исходному attempt; dismiss не отмена платежа |
| Progress reset -> onboarding | Та же app identity, новая onboarding причина, не новая acquisition |
| Дамп с SDK lifecycle и product events | Time/identity/context проверяются независимо от локального wrapper-log |

## 24. Итог

**Можно считать сейчас:** app/learning DAU/WAU/MAU, active days, recency, частоту учебных попыток, answer volume/accuracy, части ordered funnels и retention при полном matured окне и корректном first-seen.

**Можно только приблизительно:** SDK session duration/event span, foreground duration из наблюдаемых lifecycle-пар, длительность попыток, reading time и причины исчезновения событий.

**Нельзя точно без дополнений:** активные минуты обучения, screen dwell, источник возврата от reminder, точный loader/media blocker, полную экзаменную навигацию/review, истинных уникальных людей среди гостей, финансовый LTV и acquisition ROI из одного client dump.

При хорошем экспорте и текущей схеме 2 реконструкция уже заметно лучше исходного Maestro capture. Но обещать «точно понял каждый шаг и причину ухода» пока нельзя. Следующий этап должен измерить время/готовность/контекст и различать неизвестный исход, а не просто увеличить число событий.

## 25. Реализация после аудита

2 октября 2026 внесена приоритетная analytics-only часть. Это описание исходников в worktree, **не подтверждение доставки из production**. Полный действующий контракт: [keys.md](./keys.md), `mobile/src/analytics/catalog.ts`.

| Пробел | Что реализовано |
|---|---|
| PII в прямом identify | Identity sync через sanitized wrapper без email/full_name; SDK before_send очищает nested properties/person updates и raw initial URL |
| Визиты и активное время | AppState observer, отдельные app/screen visit IDs, cumulative 60-second checkpoints, foreground/inactive и явно обозначенный interaction proxy |
| Route против рабочего состояния | State observers learning/exam/signs/offline; ready только для usable question UI, без обещания media readiness |
| Сквозные учебные входы | Learning intent в реальных click-handlers, setup ID для start из dialog; analytics-only route parameter без изменения session keys/access/selection |
| Несимметричный экзамен | Question views, navigation requests, flags, answer slot/revision/create/update, focused answer duration, result view/action и review IDs/items/close |
| Незаметные ошибки | Нормализованные session/result/review/answer/navigation/flag/finish failures с user_visible; background training sync отделён от blocker |
| Signs/search/AI | Question/result states и focused time; search ID/revision/result selection без query; AI request/conversation/message IDs и wall latency без текста |
| Offline cancellation | Stop intent отдельно от одного terminal на operation ID; download outcome отделён от metadata-refresh failure |
| Возвраты от reminders | Live OS response и normalized deep links; cached last response не назначается источником текущего запуска; schedule helpers наблюдаются без изменения policy |
| Onboarding/reset/access | Onboarding flow vs settings, reset intent/resolved/failed и причина следующего onboarding; access snapshots/changes без выдачи доступа |
| Свежий контекст | Build/runtime/environment/timezone, catalog state/generation, flags и access читаются при capture; schema version 3 |

Бизнес-store, quota/access решения, результаты обучения, маршруты назначения и игровые таймеры в этом этапе не изменяются. Дополнительные analytics route params не участвуют в выборе вопросов или попытки. Notification content дополнен только `analytics_reminder_kind`; часы, тексты и permission flow прежние. Observer-ошибки не должны прерывать product handlers.

**Сознательно не внедрено:** общее media-load success/failure и video-watch denominator, durable content/selection версии, серверная acquisition/financial truth, durable analytics outbox, полные per-event required schemas/enums и сквозная корреляция всех legacy/history/paywall-return входов. Неиспользуемые предложения media-событий не включены в действующий каталог.

Ограничения времени: экранные summaries относятся к маршруту/сущности, не каждому state; duration player относится к текущему mounted визиту, не всей persisted попытке; engagement без тапов недоказуем; kill и границы выгрузки оставляют censored исход. Cold-start cached notification response может быть старым, поэтому `entry_attributed=false`; это не подтверждённый reminder-return.

**Проверка этого этапа:** только статическое чтение diff, разбор синтаксиса исходников и ссылок на локальные imports/event catalog, `git diff --check`. Тесты, Maestro, typecheck и сборка не запускались по просьбе пользователя. Раздел 23 остаётся перечнем acceptance-сценариев для будущего разрешённого прогона, не результатами выполненной проверки.

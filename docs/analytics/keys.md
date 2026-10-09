# Ключи аналитики Prawko

Контракт: `mobile/src/analytics/catalog.ts`. Имена не менять между релизами. Ниже — что ключ значит при чтении PostHog / дампа / дашборда.

Как считать людей и чем дашборд отличается от разбора сессий: [README.md](./README.md).

Полная проверка покрытия, длительности, частоты, retention и качества экспорта: [аудит 2 октября 2026](./2026-10-02-instrumentation-audit.md). Предложения новых событий в нём не означают, что они уже отправляются.

Warehouse `data-quality-v1` отделяет сырые строки от canonical activity,
проверяет installation-scoped business IDs и исторический replay, не меняя
смыслы событий. Receipt lag не доказывает native delivery; business conflicts
ограничивают зависимые rates. Паспорт: [data-quality.md](./data-quality.md).

---

## Общие свойства продуктовых событий

| Ключ | Значение |
|---|---|
| `app_user_id` | Устойчивый локальный app identity (`usr_…`), не доказанный уникальный человек |
| `application_id` / `application_id_basis` | Existing native application namespace для явного финансового mapping. `native_application_id`, иначе null с `not_available` / `observation_failed`; не выводится из exam country, locale или SDK identity |
| `app_version` | Версия приложения (`1.0.21`) |
| `auth_mode` | `guest` или `supabase`; dev/mock identity может дать `mock` |
| `category` | Категория прав (`B`, `AM`, …) |
| `exam_country` | Страна экзамена (`PL`, `CZ`, …), не geo |
| `is_plus` | Есть ли Plus |
| `locale` | Язык UI (`pl`, `cs`, `en`, `uk`, `ru`) |
| `platform` | `ios` / `android` |
| `supabase_user_id` | Id аккаунта или `null` |
| `analytics_schema_version` | Версия контракта payload. Текущая схема: `3`; схема 2 добавила ordering и разделение lifecycle, схема 3 — визиты, состояния и наблюдаемое время. Отсутствие поля означает старый контракт |
| `app_run_id` | Одна жизнь JS runtime. Меняется при перезапуске runtime / перезагрузке bundle; это не человек, не визит и не PostHog `$session_id` |
| `event_sequence` | Возрастающий номер записи capture/screen внутри `app_run_id` |
| `event_id` | Уникальный ID записи: `app_run_id:event_sequence` |
| `client_occurred_at` | ISO UTC времени записи на клиенте, не времени приёма сервером |
| `app_build` / `runtime_version` | Native build и строковая runtime version, если доступны; иначе `null` |
| `analytics_environment` | `e2e`, `development`, `production_candidate`. Последнее не доказывает публикацию в магазине |
| `app_visit_id` | Наблюдаемый foreground-визит; меняется после background, не после короткого inactive |
| `screen_visit_id` | Показ маршрута/сущности внутри визита. Меняется при навигации или новом foreground-визите |
| `view_state` | Наблюдаемое состояние UI: loader, question, feedback, result, review, блокировка или ошибка; без специального observer — `route_entered` |
| `route_entity_id` | Известный параметр session/sign/category/topic маршрута, не полный URL |
| `learning_intent_id` | ID фактического запроса обучения в инструментированном click-handler. Не учебная попытка; на прямом deep-link/history может быть `null` |
| `flow_context` / `onboarding_attempt_id` | `onboarding`, `settings` или `product`; в observation v1 ID сохраняется между runtime внутри install identity. Settings не создаёт first-run попытку; не acquisition identity |
| `onboarding_completed` | Текущий persisted флаг, не доказательство первого запуска |
| `access_source` | Наблюдаемый источник Plus: `purchase`, `school`, `other`, `none`. При нескольких источниках purchase имеет приоритет; не серверное подтверждение покупки |
| `question_set_key` / `catalog_source` / `catalog_ready` | Текущий question set, статус catalog store и его resolved-флаг. Ошибка может быть resolved без годного контента |
| `catalog_generation` | Счётчик обновлений каталога внутри runtime, не неизменяемая версия контента |
| `monetization_policy` / `ads_policy_enabled` | Фактические feature flags, не бизнес-результат |
| `timezone` / `utc_offset_minutes` | Часовой пояс устройства и текущий offset; продуктовый день по-прежнему Europe/Warsaw |

Поля схемы 3 добавляются к product capture и SDK screen в общей точке отправки. `identify` является обновлением свойств человека, не продуктовым действием, и этих полей не получает. Текущие store properties читаются в момент capture, не из старого callback.

`application_id` не заполняет старые дампы задним числом и не является account ID.
Source-gated `acquisition-financial-cohorts-v1` использует отдельные reviewed
native/ASA/Apple/RevenueCat namespaces и original transaction lineage.
D7/D30 gross activity не называется выплатами магазина или ROAS.
Паспорт: [acquisition-finance.md](./acquisition-finance.md).

SDK получает безопасный срез общих properties через `register` при identity/preferences sync. Автоматические lifecycle-события всё равно не имеют гарантированно свежего view/visit/ordering-контекста и могут появиться до регистрации. `$session_id`, `app_run_id`, `app_visit_id` и учебные IDs — разные сущности. Частота и retention являются расчётами по полному окну событий, а не отдельными event names.

JSONL хранит порядок приёма асинхронных запросов. Внутри одного `app_run_id` сортировать по `event_sequence`; между runtime использовать timestamps с учётом клиентских часов. Sequence показывает порядок записи, не причинность параллельных операций. Для причинности нужны ID попыток и операций. Новые поля не восстанавливают потерянные события старых дампов.

`source` на разных событиях значит разное (spotlight vs profile vs manual). Смотреть в контексте события.

`exam_country` источники (`exam_country_resolved.source` / смена страны): `device_region`, `storefront`, `default`, `settings`, `legacy_onboarded`, `e2e`.

---

## Визиты И Время

| Событие | Значение |
|---|---|
| `app_visit_started` | Runtime в active или foreground после background. `start_reason=runtime_start/foreground_resume`, `previous_visibility` |
| `app_visit_checkpoint` | Раз в 60 секунд, только в active; **накопленные** счётчики визита, `checkpoint_index`, `checkpoint_reason` |
| `app_visit_ended` | Наблюдали background; накопленные счётчики. Не гарантирован при kill |
| `screen_visit_started` | Начался показ маршрута/сущности в foreground |
| `screen_visit_checkpoint` | Накопленные счётчики того же `screen_visit_id` |
| `screen_visit_ended` | Навигация или background. `end_reason=navigation/background` |
| `screen_state_viewed` | Изменилось focused UI-состояние или оно повторно наблюдается после foreground. Не новый маршрут и не новый learning attempt |
| `learning_screen_ready` | Первый usable вопрос focused-входа или возврата в foreground; training, exam, sign_test, sign_practice |
| `learning_operation_failed` | Ошибка операции с `operation`, безопасным `error_code`, доступными attempt/question IDs и `user_visible` |

`foreground_ms` считает только наблюдаемый active AppState, `inactive_ms` — системный inactive, `wall_duration_ms` — весь наблюдаемый span. `interaction_engaged_ms` — только proxy: active-время в течение 60 секунд после явно выбранного product interaction (`engagement_policy=interaction_idle_60s_v1`). Чтение без тапов и просмотр видео не доказываются этим счётчиком; foreground не называть минутами обучения.

Автоматический exam answer с `timed_out=true` не продлевает engagement. Component clocks дополнительно проверяют navigation focus и известные exit/finish dialogs; это не измерение взгляда или физически незакрытого native overlay. Ad/OS overlay, не меняющий AppState/focus, может оставаться в foreground-счётчике.

Для каждого visit/screen брать последние или максимальные накопленные значения, **не сумму checkpoints**. Смена question/feedback/result/review сохраняет screen ID и меняет state. Summary описывает весь маршрут/сущность, не длительность каждого state. Нет ended после kill — наблюдаемый нижний предел плюс неизвестный хвост, не «ушёл на последнем шаге».

`ready_foreground_ms` и `ready_wall_ms` измеряют время от focused-входа до usable вопроса (`ready_duration_scope=current_focus_entry`); при уже готовом foreground-return новый observation практически нулевой (`foreground_observation`). `media_readiness=not_measured`: ready не доказывает декодирование картинки/видео или отсутствие freeze.

В `learning_operation_failed` ID, переданный вызывающей операцией, имеет `operation_id_source=existing_operation`. Иначе ID создан только для наблюдения failure (`failure_observation`): нельзя выдумывать отсутствующий request. `user_visible=false` отделяет background sync и тихие ошибки от видимого blocker.

---

## Экраны (`screen_viewed.screen_name`)

| Ключ | Экран |
|---|---|
| `app_entry` | Корень-шлюз. `screen_viewed` для него не пишется: экран сразу редиректит или показывает загрузку, и в дампе это выглядело как отдельный визит |
| `onboarding_language` | Выбор языка |
| `onboarding_category` | Категория прав |
| `onboarding_exam_schedule` | Дата экзамена |
| `onboarding_notifications` | Нотификации (не в текущем first-run) |
| `onboarding_minutes` | Минуты в день (не в first-run) |
| `onboarding_level` | Уровень (не в first-run) |
| `onboarding_school_code` | Код школы (не в first-run) |
| `onboarding_access` | Вход (не в first-run) |
| `onboarding_preview` | Превью плана (не в first-run) |
| `home` | Сегодня / Home |
| `learn` | Учёба |
| `signs_home` | Знаки, корень |
| `profile` | Профиль |
| `exam_country` | Смена страны экзамена |
| `topics` | Темы |
| `topic_detail` | Одна тема |
| `trainer_modes` | Выбор режима тренировки |
| `question_training` | Слот вопросов |
| `practice` | Практика |
| `mistakes` | Ошибки |
| `exam_loading` | Загрузка экзамена |
| `exam_session` | Экзамен идёт |
| `exam_result` | Результат экзамена |
| `exam_answers` | Разбор ответов экзамена |
| `signs_catalog` | Каталог знаков |
| `sign_category` | Категория знаков |
| `sign_search` | Поиск знака |
| `sign_detail` | Карточка знака |
| `sign_practice` | Практика знаков |
| `sign_test` | Тест знаков |
| `statistics` | Статистика |
| `paywall` | Plus |
| `offline_mode` | Офлайн-пак |
| `ai_chat` | AI-чат |
| `access_center` | Доступ / аккаунт |
| `plan_adjust` | Пересборка плана |
| `not_found` | 404 |

Ещё поле: `route_pattern` — шаблон роута Expo, не имя экрана. `screen_viewed` описывает оболочку маршрута: `question_training` может содержать вопрос, результат, review, empty или блокировку. Для фактического состояния смотреть специальные события ниже.

---

## Онбординг

Событие `onboarding_step_completed`, поле `step`:

| `step` | Что сохранили |
|---|---|
| `category` | Категория прав |
| `exam_schedule` | Дата экзамена или дефолт 14 дней (`exam_date_provided`, `days_until_exam`) |
| `notifications` | Нотификации |
| `minutes` | Минуты учёбы |
| `level` | Уровень |
| `school_code` | Код школы |

Сейчас first-run шлёт только `category` и `exam_schedule`, затем Home.

`onboarding_flow_viewed` использует `onboarding_attempt_id`, `flow_version=category_schedule_v1`.
Новый observation v1 сохраняет ID между runtime внутри той же install identity.
`start_reason=incomplete_onboarding_observed` не доказывает новую установку;
подтверждённый helper reset даёт `progress_reset` с `reset_operation_id`.
Повторный incomplete без такой причины имеет
`repeat_incomplete_onboarding_observed`, не выдуманный install/reset.
Settings-маршруты имеют `flow_context=settings` и не создают first-run воронку.
Исторические события без observation v1 имели runtime-only ID.

`onboarding_flow_completed` означает, что локальные save/complete calls вернули
управление (`completion_scope=local_store_operations_returned`), не гарантированный
physical storage flush. `onboarding_completed_at` фиксирует момент принятия, даже
если аналитическая запись произошла позже. Автофинализация без наблюдавшегося входа
помечена `completion_without_entry_observed`.

`onboarding_home_arrived` отдельно связывает эту попытку с первым наблюдением Home
в foreground (`home_arrival_basis=foreground_route_observed`), не доказывает usable
content или обучение. Settings/Home без принятого локального финала не создают
его. `onboarding_storage_status=memory_only`, `onboarding_detection_method` и
`onboarding_clock_order_valid=false` раскрывают ограничения. Ранний screen может
иметь `onboarding_observation_state=pending`; null ID не склеивать по догадке.
Persisted аналитический marker и SDK delivery не образуют exactly-once транзакцию.

`context.onboarding` / CLI `onboarding` отдельно рассчитывают first-observed и
persistent-attempt когорты с `onboarding-activation-v1`. Local completion, Home,
open, entry, usable question, accepted answer, meaningful completion и ordered
same-session chain не подменяют друг друга. Learning events не несут persistent
attempt ID: `after_home_*` явно остаётся temporal installation association до
следующего наблюдавшегося attempt/reset, не прямой или causal join.
Unverified late attempt/reset и intent без confirmed boundary ограничивают
затронутую post-Home ассоциацию; они не становятся clean zero, успешным reset
или доказательством отсутствия изменений после failed helper.
Elapsed 24h/D7/D30, first-observed post-activation Warsaw calendar D1/D7 и TTV
сохраняют nonachievers/censoring; unknown roots и missing app coverage не дают
ложный чистый знаменатель. Late Home за D7 не ограничивает ранний D7 только
из-за отсутствующего explicit completion; provider/business conflicts сохраняются.
Health принимает supplied report либо `history_not_supplied`.
Паспорт и оставшаяся приёмка: [onboarding-activation.md](./onboarding-activation.md).

---

## First start

Исторический spotlight на пустой карточке готовности после онбординга. В текущем roadmap UI он отключён; `first_start_shown` / `first_start_skipped` не обязательные живые шаги. Действующий вход через readiness-карточку остаётся: слот до 10 вопросов, режим `initial_diagnostic`.

| Событие | Значение |
|---|---|
| `first_start_shown` | Показали spotlight |
| `first_start_skipped` | Закрыли / отмахнулись |
| `first_start_started` | Начали слот. `source`: `spotlight` или `card`; `source_screen` отличает Home от readiness-карточки на Learn |
| `diagnostic_result_action` | CTA на результате. `action`: обычно `continue` |
| `diagnostic_reminder_shown` | Шит «напомнить заниматься» |
| `diagnostic_reminder_resolved` | Ответ на шит. `action`: включили / `later` / dismiss |

Skip и start у одного человека в разные визиты — нормально. `source=card` сам по себе не означает Home; в старом дампе без `source_screen` точный вход не восстановить из одного события. Новое завершение диагностики — `training_session_completed mode=initial_diagnostic`. `diagnostic_result_action` описывает CTA после результата, а не завершение: можно открыть сохранённый результат без новой тренировки. CTA, reminder и permission-события диагностического результата несут `training_session_id`.

---

## Home contextual

Контракт старого Home: компактная карточка между индексом готовности и «Швидка сесія». В текущем `app/(tabs)/index.tsx` не подключена, `useHomeContextualBlock` используется в `app/old/index.tsx`. Нулевые shown/selected не означают текущий retention drop. Историческая семантика: только returning user (индекс готовности уже не пустой).

Приоритет: `completion` (один раз после возврата) → персональный next action → ничего.

| Событие | Значение |
|---|---|
| `home_contextual_shown` | Показали карточку. `kind`: `completion` / `resume` / `mistakes` / `review` / `weak_topic` |
| `home_contextual_selected` | Тап. Тот же `kind` |

`completion` — короткое пост-действие после тренировки / экзамена / повторения. `shownOnHome` ставится в момент `home_contextual_shown`, поэтому карточка остаётся на текущем визите и не повторяется после фона. На следующем открытии Home её уже нет: либо next action, либо пусто.

---

## Training

`learning_intent_requested` записывается в фактическом handler запуска, не при построении href в render. `learning_intent_id` проходит в analytics-only параметре `analyticsIntentId`; он не влияет на session key, выбор вопросов, лимиты или access policy. При count/duration dialog у intent есть `setup_id`, который связывает его с `practice_setup_resolved action=start`. Инструментированы roadmap, основные mode/count, practice, readiness, прямой Learn и restart экзамена, а также Home/category тесты знаков. Cancel setup не создаёт learning intent или attempt. Исторические/direct/history/paywall-return маршруты без ID остаются `null`, не склеивать их по догадке.

| Событие | Значение |
|---|---|
| `practice_setup_viewed` | Реально показали count/duration dialog, включая тесты знаков. `setup_id`, `screen_name`, `feature=training/sign_test`, `dialog_kind=question_count/blitz_duration`, `available_count`, `default_selection`, контекст режима/темы/входа |
| `practice_setup_resolved` | `action=start/cancel/dismiss`, тот же `setup_id`, `selected_count`, `question_limit` или `time_limit_seconds`. Cancel — кнопка Close, dismiss — native request-close. Не означает создание попытки |
| `training_mode_selected` | Подтвердили режим и лимит запуска; не первоначальный тап и не показ диалога |
| `training_session_started` | Операция со store создала новую непустую попытку; не любой mount без ответов |
| `training_session_resumed` | Открыли существующую незаконченную попытку, в том числе с нулём ответов. `answered_count`, `resumed_at_question` |
| `training_question_viewed` | Готовый вопрос показан на focused экране. `question_id`, `question_index`, `question_total`, `already_answered`. Не подтверждает загрузку/просмотр медиа |
| `training_question_answered` | Один ответ |
| `training_feedback_continued` | Нажали Next/Finish после ответа. `action=next/finish`, контекст вопроса и correctness; результат перехода смотреть по question_viewed/completed |
| `training_session_completed` | В этом посещении открытая незавершённая попытка перешла в finished. Показ сохранённого результата не создаёт completion |
| `training_result_viewed` | Реально показали обычный/диагностический результат. `result_origin=new_completion/existing_result`, `view_reason=initial/review_return`, counts |
| `training_result_action` | CTA обычного результата: `close`, `finish`, `work_on_mistakes`, `new_attempt`, `answers`, `upgrade`. У диагностики остаётся `diagnostic_result_action` |
| `training_answers_review_opened` | Открыли разбор обычной/диагностической тренировки. Новый `review_id` на каждое открытие |
| `training_answers_review_question_viewed` | Показали позицию разбора: `review_id`, ID/индекс/total, `was_answered`, `is_correct` (`null`, если ответа нет), `view_state=question/missing_question`. Последнее означает missing-state вместо доступного вопроса. Повторный приход на вопрос может создать новое view |
| `training_answers_review_closed` | Вернулись к результату: `close_reason=finished/back`, `viewed_count` уникальных доступных вопросов этого review (missing-state не считается), последний индекс |
| `training_session_abandoned` | Явно ушли из незавершённой попытки. `exit_reason=explicit_exit/zero_answer_exit/empty_pool`. Нулевые answers и пустой pool не считать учебным mid-session drop |
| `training_session_empty` | В режиме не было вопросов |

`mode`:

| Значение | Режим |
|---|---|
| `initial_diagnostic` | Первый слот с Home (first start) |
| `learning` | Обычная учёба |
| `high_points` | Вопросы с высоким баллом |
| `blitz` | На время |
| `wrong_answers` | Ошибки |
| `new_questions` | Новые |

`training_session_id` — реальный ID persisted попытки на lifecycle, вопросах, результате, review и связанных gates/paywall. Создание новой попытки меняет ID; продолжение и просмотр старого результата сохраняют. Не группировать разные попытки только по `mode`.

Полезные поля: `question_limit`, `question_total`, `question_index`, `topic_id`, `roadmap_step_id`, `is_correct`, `passed`, `score_percent`, `answered_count`, `correct_count`, `media_type` (`video` / `image` / `none`). У V2 resume без Plus исходный способ доступа не сохранён: `access_method=unknown`, не выдуманный `free_quota`.

В старых дампах, включая исходный прогон 2 октября 2026, показ finished-сессии мог создавать `resumed` и `completed`. Не сравнивать исторические completion-конверсии со схемой 2 без этого ограничения. Новый tracker не переотправляет completion при remount сохранённого результата, но не является durable outbox: авария между сохранением finished и capture может потерять событие.

`answer_duration_ms` остаётся wall time и может включать фон/загрузку. `answer_foreground_ms` — focused active-показ текущего вопроса до ответа, без feedback; `feedback_foreground_ms` — active-показ feedback до Next/Finish. `answer_id` — ID фактического training answer attempt. `first_encounter` / `previous_times_seen` — состояние до этого ответа, не количество показов экрана.

На completed/abandoned `visit_foreground_ms` и `duration_scope=current_component_visit` относятся только к этому mounted player, не ко всей persisted попытке через рестарты. `completion_reason=queue_finished/timer_elapsed` устанавливается в наблюдаемом handler; другие transitions — `unknown_transition`, не догадка по wall time. На review close есть `review_foreground_ms`. Отсутствие answered после question_viewed не доказывает уход. Отсутствие review_closed при обрыве окна/процесса не доказывает явное закрытие.

`roadmap_step_id` (`PL:0:1`) есть на старте, ответе, завершении, abandon и empty. Без круга роадмапа значение `null`.

`practice_entry` только у `mode=learning`: `random` (нет темы и нет урока), `topic` (есть `topic_id`), `roadmap` (есть `roadmap_step_id`). На тех же событиях, что и `roadmap_step_id`. Остальные `mode` поле не несут.

---

## Roadmap

| Событие | Значение |
|---|---|
| `roadmap_step_opened` | Тап по кругу на Home. `roadmap_step_id`, `section_index`, `step_index`. `premium`: платный урок. `locked`: тап открыл paywall, а не тренировку |

Бесплатный круг дальше идёт в `training_session_started`. Платный — в `premium_gate_viewed` и `paywall_viewed`. Карточка Unlock внизу роадмапа — не круг: у неё нет `roadmap_step_opened`, только гейт с `surface=home_unlock`.

`question_total` без лимита может быть сотней+ — это длина банка, не выбранный размер слота.

---

## Exam

| Событие | Значение |
|---|---|
| `exam_start_requested` | Начали грузить / создавать. `exam_entry` — откуда открыли |
| `exam_start_failed` | Запуск упал до перехода в session. `launch_attempt_id`, `mode`, `launch_step=fetch_active_session/abandon_previous_session/start_session`, нормализованный `error_code`, без текста exception |
| `exam_session_started` | Сессия есть. Тот же `exam_entry` |
| `exam_session_resumed` | Вернулись в активный экзамен. `exam_entry` — этот заход |
| `exam_question_viewed` | Показан usable вопрос: ID/order/total, `already_answered`, `is_flagged`, `navigation_mode`, тип ответа/медиа |
| `exam_question_navigation_requested` | Запрошен другой order; `target_question_index`, `navigation_direction`. Успех подтверждает следующий question_viewed, failure — learning_operation_failed |
| `exam_question_flag_changed` | Сохранён флаг вопроса; `is_flagged`, session/question/order |
| `exam_question_answered` | Ответ в экзамене. `exam_entry` сессии |
| `exam_session_completed` | Человек только что закончил экзамен в этом заходе. Открытие готового результата событие не пишет. `passed`, `exam_entry` |
| `exam_session_ended` | Явно завершили, прервали или истекло. `status=completed,end_reason=learner_finish` не abandon; смотреть status/reason |
| `exam_empty_exit` | Закрыли экзамен до первого ответа. Не брошенный экзамен. `answered_count` 0, `question_total`, `mode` |
| `exam_result_viewed` | Показан результат; `result_origin=just_finished/existing_result`, status/outcome/counts. Не completion |
| `exam_result_action` | CTA результата: `home`, `answers`, `work_on_mistakes`, `new_attempt`; не успешный запуск следующей операции |
| `exam_answers_review_opened` | Открыли разбор, `review_id`, `source=result/route` |
| `exam_answers_review_question_viewed` | Позиция review, `view_state=question/missing_question`, `was_answered`, nullable `is_correct`, review/session/question IDs |
| `exam_answers_review_closed` | `close_reason=back/finished/view_unmounted`, unique `viewed_count`, `review_foreground_ms`. Unmount не означает Finish |
| `exam_restart_gate_shown` | Модалка «ещё раз» на экране **результата**, только кнопка New attempt |
| `exam_restart_selected` | Ответ на эту модалку. `choice`: `watch_ad`, `upgrade`, `dismiss`, `plus` |

`exam_entry`: `home`, `learn`, `practice`, `roadmap_step`, `roadmap_simulator` (ещё `roadmap_step_id`), `result_restart` (новая попытка с экрана результата), `home_contextual`, `paywall`. `source` по-прежнему `manual` или `study_plan` и вход не заменяет. Нет параметра — `unspecified`.

`exam_session_id` — ID реальной попытки на started/resumed, ответах, ended/completed, empty-exit, restart gate/choices, открытии review, закладках и category mismatch. `launch_attempt_id` — отдельная операция запуска: request → started/resumed/failed. Retry получает новый launch ID. Офлайн-блокировка до запуска имеет `block_id`, но не выдуманный ID экзамена.

На `exam_start_requested` есть `is_online` и `offline_ready` от проверки доступа. Это состояние reachability/пакета, **не** доказательство источника каталога: online может использовать кеш, offline-ready не подтверждает загрузку конкретного медиа.

У exam answer `answer_id=exam_session_id:question_order` — логический slot, `answer_revision_id` — отдельная успешная отправка. `answer_action=create/update`, `answer_changed` и `previous_is_correct` отделяют редактирование CZ/SK от новых уникальных ответов. Не суммировать updates как новые отвеченные вопросы и не трактовать event_sequence как номер revision во всей persisted попытке. `question_visible_foreground_ms` считает active-показ этого вопроса в текущем player; старый `answer_duration_ms` и result `duration_seconds` сохраняют wall-time семантику.

`screen_state_viewed` отделяет loading, offline/category block, missing question, question с ошибкой, подтверждение выхода/finish и redirect. `learning_operation_failed` покрывает загрузку snapshot/result/review, submit, навигацию, flag, finish/end и тихий empty-discard. Result и review работают и in-place, и через route; при in-place `route_pattern=/exam/result`, state=review, отдельный review ID. Сохранившийся `justFinished` не превращает повторный result view в новое completion.

`exam_restart_*` — **не** лимит экзаменов и **не** гейт на плитке Home/Learn. `openExam()` → `/exam` не показывает restart-модалку, `dismiss` только закрывает её и оставляет результат. Но текущий V2 отдельно вызывает `resolveExamStart` на launch: после использованного бесплатного экзамена без credit может быть `premium_gate_viewed source=exam_limit` → paywall. Это другой gate, с `freeExamUsed`, не календарный дневной счётчик. Поэтому `exam_start_requested source=manual` после Home не доказывает ни обход, ни успешное создание новой попытки; результат смотреть по started/resumed/gate/failed.

`exam_session_ended.status`: `abandoned` — ответил и вышел; `completed` + `end_reason: learner_finish` — нормальное завершение (иногда дублирует complete). Настоящий mid-exam дроп: `end_reason: user_ended_early`. Пустой выход без ответов — отдельное событие `exam_empty_exit`, не `exam_session_ended`. В дампах до этого билда тот же выход лежит на `exam_session_ended` с `end_reason: miss_click_empty_exit`.

`passed` на complete — сдал / не сдал, не «дошёл до конца». PL обычно 32 вопроса, CZ 25.

---

## Видимые блокировки обучения

| Событие | Значение |
|---|---|
| `learning_access_blocked` | На focused training/exam экране реально показан офлайн-гейт. `block_id`, `feature=training/exam`, `screen_name`, `blocked_reason`, `requested_category`, `downloaded_category`, `is_online`, `offline_ready`, доступный контекст попытки/режима/темы |
| `learning_access_block_action` | Действие на этом гейте: `retry`, `open_offline_mode`, `close`. `destination=offline_mode/paywall/home` или `null` для retry; тот же `block_id` |
| `exam_category_mismatch_viewed` | Реально показан конфликт категории на session/result/answers. `mismatch_id`, `exam_session_id`, `screen_name`, `current_category`, `session_category` |
| `exam_category_mismatch_action` | Выбрали `switch_category` или `close`; намерение, не доказанное устранение препятствия |
| `exam_category_mismatch_resolved` | Ранее показанный конфликт больше не блокирует загруженный focused экран; `resolved_category`, те же IDs |

Офлайн-гейт — ожидаемое состояние продукта, не `client_error_logged`. `blocked_reason`: `missing_ready_pack`, `pack_for_other_category`, `download_incomplete`. Retry связывается со старым block ID; повторный показ после проверки получает новый.

При смене категории с mismatch дополнительно пишется `settings_changed setting=category`, `source=exam_category_mismatch`, `previous`, `value` и IDs конфликта/экзамена. Если после действия нет resolved, нельзя считать переключение завершённым. `screen_viewed exam_session` сам по себе не доказывает, что был доступен вопрос.

---

## Signs

| Событие | Значение |
|---|---|
| `sign_opened` | Карточка знака |
| `sign_search_submitted` | Непустой query после debounce 400ms. `search_id`, `query_revision`, длина и число результатов; не submit-button и не raw query |
| `sign_search_result_selected` | Выбран результат: тот же search/revision, `sign_id`, `category_id`, `result_position` (1-based), result count |
| `sign_test_started` | Старт теста. `sign_test_entry`, `category_id` |
| `sign_test_question_viewed` | Вопрос теста или практики знака доступен на focused экране; контекст попытки, знака, question/index/total, `already_answered` |
| `sign_test_question_answered` | Ответ в тесте. Те же поля |
| `sign_test_ended` | Конец. `outcome`: `completed` / `abandoned`. Те же поля |
| `sign_test_result_viewed` | Показан результат практики одного знака. Общий/category тест возвращается назад без result screen |

`sign_test_entry`: `signs_home` (весь каталог с вкладки), `category` (`category_id`, например `E` — направленные), `statistics`, `sign_detail` (практика одного знака, рядом `test_type=sign_practice`). У каталога без категории `category_id` = `null`. Страна знаков — супер-свойство `exam_country`. Тест можно начать, минуя `sign_opened`.

На всех `sign_test_*` есть `sign_test_session_id`: один ID на mounted попытку, новый при новом открытии. Эти попытки не persisted, поэтому перезапуск runtime создаёт новый ID. В практике одного знака явная кнопка Back незаконченной попытки пишет `outcome=abandoned`; Back после результата не дублирует ended. `correct_count` берётся из итогового счётчика без повторного прибавления последнего правильного ответа.

На answer есть логический `answer_id` и `question_visible_foreground_ms`, на ended — `visit_foreground_ms` с `duration_scope=current_component_visit`. Question/feedback/empty/result наблюдаются отдельно от маршрута. Query revision меняется при вводе/очистке; быстрый выбор до debounce может иметь selected без submitted для той же revision — это не потеря и не ошибка поиска.

---

## Paywall и покупка

Текущий PL использует подписочный paywall2: `paywall_variant=paywall2`, **`paywall_offer=plans`**, `plan` и `trial_days` выбранного тарифа; `purchase_*` получают те же поля. Неделя / месяц / 3 месяца соответствуют `P1W` / `P1M` / `P3M`. Пустой или неподдерживаемый offering не меняет модель на lifetime. В старых билдах PL мог отправлять `paywall_offer=lifetime` при fallback: не переносить эту историческую семантику на новые билды. CZ/SK сохраняют классический lifetime-paywall; у него `paywall_variant` нет. Страна, а не язык UI, определяет billing flow; актуальная карта — [../paywall.md](../paywall.md).

| Событие | Значение |
|---|---|
| `paywall_viewed` | Показали Plus. Вход — `source` и, если источник общий, `surface`. `offers_count`, `revenuecat_configured` (API key / SDK для платформы, не «последний fetch успешен»), опционально `hydration_error_code`. `moment` пишется только у старого промпта: `after_exam`, `after_ad`, `app_open`, `manual_test`. У V2 (`training_limit`, `explanation`, `roadmap`, `profile`, …) поля `moment` нет. Не подставлять `profile` вместо отсутствующего `moment`. V2 `source`: `training_limit`, `wrong_answers`, `explanation`, `exam_limit`, `weak_spots`, `smart_reviews`, `trap_questions`, `statistics`, `profile`, `roadmap`, `ai_chat`, `offline_mode`. С круга роадмапа ещё `roadmap_step_id` |
| `paywall_cta_selected` | В обработчик пришло намерение: `action=purchase/retry_purchase/restore`, `paywall_view_id`, snapshot оффера/SDK, `offer_state`, для purchase `package_available`. Не native checkout и не покупка |
| `paywall_checkout_blocked` | Обработчик остановился до checkout. `blocked_reason=checkout_busy/already_entitled/purchase_disabled/not_configured`; у paywall2 ещё `package_unavailable` (тариф не пришёл из стора), тот же view и action. Не `purchase_failed` и не отказ пользователя от оплаты |
| `paywall_offer_load_started` | Начался цикл доступности оффера на этом paywall. `paywall_view_id`, `offer_load_id`, при наличии `offer_request_id`; `load_reason=initial/refresh`, `offer_load_source`, `is_cached`. Не каждый цикл является новым запросом SDK |
| `paywall_offer_ready` | Выбранный пакет реально доступен: product/package/offering, price/currency, число предложений и duration. Есть связанный `offer_load_id`; кеш приложения отмечается `is_cached=true`, `load_duration_ms=0`. Это готовность предложения, не покупка и не утверждение о доступности CTA для уже активного Premium |
| `paywall_offer_failed` | Завершившийся запрос не дал готового оффера или SDK не настроен. `failure_reason`: `request_error`, `empty_offerings`, `not_configured`; `error_code`, структурированная диагностика. Ноль предложений **во время** загрузки не создаёт failed |
| `paywall_trial_eligibility_started` | Вызван существующий eligibility helper: `eligibility_request_id`, `paywall_view_id`, observation v1, request scope и product counts. Не доказательство native query или показа trial |
| `paywall_trial_eligibility_resolved` | Request + product outcome: `eligible/ineligible/unknown/no_intro_offer/error`, basis, native-query flag и normalized error category. Unknown/missing и Android не становятся ineligible/eligible по UI-фильтру |
| `paywall_trial_eligibility_completed` | Helper terminal `resolved/unsupported/not_configured/no_products/error`; distinct delivered-product count и wall duration. Detached response остаётся диагностикой, не текущим показом, trial start или оплатой |
| `premium_gate_viewed` | Упёрлись в лимит V2 или открыли премиум-вход, который сразу ведёт на paywall. `source` как у paywall. `surface` есть, когда `source` общий. Не путать с `exam_restart_gate_shown` |
| `premium_gate_action` | `open_paywall` / `watch_ad` / `dismiss` на этом лимите. `surface` как у `premium_gate_viewed` |
| `answer_explanation_viewed` | Полное объяснение показано. `access_method`: `premium`, либо `free_topic` (бесплатная тема PL без Premium, текст открыт и только помечен как Premium) |
| `ad_reward_earned` | SDK подтвердил награду. `placement=exam_unlock` даёт кредит экзамена, списание только на `exam_session_started` |
| `paywall_dismissed` | Закрылся экран Plus, не результат оплаты. В новой реализации `dismiss_method`: `close_button` / `navigation` / `access_unlocked`; последнее означает продолжение после активации доступа. `has_plus_access` — доступ в момент закрытия. Исторические `swipe` / `background` остаются в старых дампах; новые события не называют любой выход свайпом и не считают уход в фон закрытием |
| `premium_prompt_shown` | Исторический bottom sheet с оффером Plus. Больше не показывается: ни `app_open`, ни `after_ad` |
| `premium_prompt_clicked` | Исторический CTA того шита. Новые события не пишутся |
| `premium_prompt_dismissed` | Историческое закрытие шита. Новые события не пишутся |
| `paywall_package_selected` | Исторический ключ. Классический paywall выбирает пакет в коде; выбор тарифа на paywall2 пишется в `paywall_plan_selected` |
| `paywall_plan_selected` | На paywall2 (PL) выбрали тариф: `plan=week/month/quarter`, `previous_plan`, `placement=offer` (верхний выбор) / `final` (нижний), `trial_days`, product/price/currency. По умолчанию выбран `quarter` без события |
| `purchase_stage_changed` | Началась стадия подготовки/оплаты: `get_customer_info`, `get_offerings`, `persist_checkout`, `purchase_package`. `persist_checkout` — сохранение локального маркера **до** вызова магазина; ещё не native start. Повторная загрузка offerings может дать ещё одно событие той же стадии |
| `purchase_started` | Непосредственно перед вызовом нативного `purchasePackage`, после проверки доступа, получения пакета и успешной записи журнала. Нажатие CTA и ошибка подготовки сами по себе не являются checkout-start |
| `purchase_attempt_recovered` | Незавершённая попытка загружена из журнала после перезапуска с тем же `purchase_attempt_id`, исходными view/product/retry IDs и `previous_status`. Не новый checkout, не успешная оплата и не выдача Premium. Может повторяться при следующих перезапусках той же попытки |
| `purchase_preparation_failed` | Ошибка до вызова нативной оплаты: доступ/соединение/предложение/локальное хранилище (`error_category=local_storage`, `checkout_storage_error`). Эта попытка ещё не запускала платёж; не включать в failed native checkout |
| `purchase_succeeded` | SDK сообщил успешную покупку и подтверждён активный доступ. `transaction_id` может быть `null`, если SDK его не вернул |
| `purchase_pending` | `confirmation_reason`: `payment_pending` (код 20), `already_owned` (6) либо `entitlement_not_yet_active`. Не финальная ошибка и не отмена. Код 15 не создаёт ожидающую оплату |
| `purchase_outcome_unknown` | Код 2 / StoreProblem после вызова нативной оплаты: деньги могли быть списаны или не списаны. Сетевой/нераспознанный ответ после native-call также обрабатывается консервативно как неизвестный финансовый исход. Не считать доказанной неуспешной оплатой; сначала сверить доступ |
| `purchase_access_confirmed` | CustomerInfo подтвердил Premium именно для выбранного продукта исходной неопределённой попытки, в том числе восстановленной после перезапуска. Это подтверждение доступа, не доказательство новой транзакции; не подменять им `purchase_succeeded` при подсчёте выручки |
| `purchase_status_check_started` | Свежая проверка CustomerInfo для неопределённой покупки, без новой оплаты; `recovery_source`: `automatic`, `manual`, `before_retry`, `startup`, `foreground` |
| `purchase_status_check_completed` | Проверка завершилась, `access_active=true/false`. Отсутствие entitlement не доказывает отсутствие списания |
| `purchase_status_check_failed` | Не удалось проверить CustomerInfo. Результат исходной покупки остаётся неизвестным; `access_active=true` возможен при параллельном успешном listener-подтверждении |
| `purchase_cancelled` | Отмена стора |
| `purchase_failed` | Ошибка после вызова нативной оплаты, кроме отдельно выделенных pending/unknown. `step`, `why`, структурированная категория. Сам ключ не является финансовым доказательством отсутствия списания |
| `purchase_restore_started` | Restore; `restore_attempt_id`, `restore_outcome=started` |
| `purchase_restore_succeeded` | Restore завершился с подтверждённым доступом: `entitlement_active=true`, `restore_outcome=restored`. Каноническое событие restore conversion |
| `purchase_restore_empty` | Restore завершился без подтверждённого Plus: `entitlement_active=false`, `restore_outcome=empty`. Не конверсия |
| `purchase_restore_failed` | Запрос restore сломался: `restore_outcome=failed`, `step`, `why`. Параллельно активный доступ возможен и не делает этот запрос успешным |
| `restore_started` / `restore_succeeded` / `restore_failed` | Legacy-параллельные события того же запроса с тем же `restore_attempt_id`. `restore_succeeded` может иметь `restore_outcome=empty`: его нельзя суммировать с каноническим succeeded или считать успехом без entitlement |
| `customer_center_opened` | RevenueCat customer center |

`surface` при `source=roadmap`: `home_step` (платный круг), `home_unlock` (карточка Unlock), `learn_topic`, `topics`, `statistics_topic`, `trainer_modes`, `question_start` (урок не пустили на старте сессии). Те же `surface` и `roadmap_step_id` лежат на `paywall_dismissed` и `purchase_*`.

Profile → Offline без Plus теперь имеет `source=offline_mode`, `surface=profile_offline_row`, `source_screen=profile`, а не общий `profile`. Перед переходом есть `profile_action_selected action=offline_mode`; у Plus этот же intent ведёт прямо в Offline.

Офлайн-гейт → paywall: `source=offline_mode`, `surface=offline_gate`, `source_screen` и исходный `block_id`. `openTrackedPaywall` переносит известные `topic_id`, `question_id`, `training_session_id`, `exam_session_id` и `premium_gate_id` из гейта через route до paywall/offer/checkout/dismiss событий. В route не сериализуются произвольные properties или тексты пользователя.

`premium_gate_id` связывает конкретный gate → действие → paywall в новых tracked путях и в inline-lock объяснения тренировки. У inline-lock `premium_gate_viewed presentation=inline_lock` отправляется автоматически после ответа: это не тап Explain. Тап отдельно отражён в `premium_gate_action`, с ID вопроса и попытки. Старые/непереведённые прямые входы могут не иметь gate ID.

`paywall_cta_selected` отражает только вызванный обработчик: disabled-кнопка не создаёт intent, таймеры/фон не создают CTA. `paywall_checkout_blocked` не заменяет `purchase_preparation_failed` внутри координатора; `purchase_started` по-прежнему находится только перед native-call.

В новой реализации `paywall_view_id` связывает показ и закрытие одного paywall, `purchase_attempt_id` — одну попытку checkout/restore. На событиях покупки `paywall_view_id` всегда указывает на исходный экран; на закрытии другого открытого paywall исходный экран отдельно указан в `purchase_origin_view_id`. `purchase_status` — состояние связанной операции в момент события. `checkout_view_id` есть и у restore из `access_center` (там `paywall_view_id=null`). Закрытие во время `purchasing` с последующим `purchase_succeeded` — нормальная последовательность, не отмена продажи. Обычное открытие paywall не привязывается к давно завершённой покупке.

Статус checkout общий для всех экранов и не даёт доступ сам по себе. До нативной оплаты незавершённые попытки записываются в локальный журнал, отдельный для platform/app identity внутри sandbox приложения. Журнал не привязан к изменяемой учебной стране: отдельные PL/CZ/SK-приложения изолированы sandbox, исходный `exam_country` сохраняется в контексте попытки. Обычный сброс обучения/квоты журнал не удаляет.

При перезапуске сначала загружается журнал. Сохранённый `purchasing` становится `outcome_unknown` с `error_code=checkout_interrupted`: прежний native promise больше не существует, а наличие маркера не доказывает, что вызов магазина успел состояться. Сохранённые `awaiting_confirmation` и `outcome_unknown` сохраняют свои ограничения. Затем выполняется свежая проверка RevenueCat (`startup`), а при возврате — `foreground`. Нет автоматической оплаты или restore. До загрузки журнала обычная новая оплата заблокирована; при ошибке чтения/записи она не стартует, но явный restore остаётся допустимым.

После перезапуска подтверждение исходного продукта получает `purchase_access_confirmed` с `resumed_after_restart=true`, не повторный `purchase_succeeded`/`purchase_started`. Сохранённый native success сам по себе не выдаёт доступ. Журнал хранит все неопределённые исходные попытки и их повторы, но не callbacks/маршруты/старое post-purchase действие. Повторно открытый экран действует только в своём актуальном контексте.

Это не exactly-once доставка аналитики: процесс может завершиться между событием и доставкой либо между подтверждением/удалением маркера и записью результата. `purchase_attempt_recovered`/`purchase_access_confirmed` дедуплицировать по attempt ID; подтверждение доступа не является новой выручкой. Попытки, прерванные до появления журнала в новой версии, задним числом не восстанавливаются. Удаление данных приложения/переустановка может удалить журнал; сохранение при этом не гарантируется. Выручку сверять с транзакциями RevenueCat/магазина, не только клиентской воронкой. Нативный запрос не получает искусственный таймаут, который позволил бы начать вторую покупку, пока первая ещё идёт.

CustomerInfo-listener может подтвердить доступ раньше ответа живого native promise: доступ обновляется сразу, но окончательное purchase-событие выбирается после ответа. Native success с подтверждённым доступом сохраняет `purchase_succeeded`; native error при независимо подтверждённом исходном продукте получает `purchase_access_confirmed` и warning `purchase_native_response_failed_after_access_confirmed`, не отменяет доступ и не выдаёт фиктивный failed/cancelled. После перезапуска прежнего promise нет, поэтому остаётся только подтверждение доступа.

При явном повторе неизвестной покупки новый `purchase_attempt_id` связан с исходным через `retry_of_attempt_id`. Повтор не стирает исходную неопределённую попытку. Подтверждение доступа может закрыть несколько связанных попыток, но не доказывает несколько списаний. Отмена/ошибка повтора не разрешает автоматически забыть первую оплату: UI возвращается к её проверке. Проверка доступа перед обычной покупкой не получает фиктивный `purchase_succeeded`, если Premium уже был активен.

Restore неопределённой покупки сохраняет исходный `purchase_attempt_id`, добавляет отдельный `restore_attempt_id`, `recovery_source=restore` и, для ручного restore, `recovery_view_id` / `recovery_surface`. Empty/failed restore не превращают исходную оплату в cancelled/failed. `restore_succeeded` означает успешно завершившийся запрос SDK: проверять `entitlement_active`; конверсия восстановления доступа — только `purchase_restore_succeeded`, не `restore_succeeded` без этого признака.

Готовность предложения наблюдается отдельно от CustomerInfo hydration. SDK getOfferings публикует собственное loading → ready/empty/failed; listener/restore/access-only response не создают ложную готовность оффера и не затирают более свежие предложения старым snapshot. Одновременные запросы hydration/paywall/checkout для текущего identity объединяются в один in-flight запрос.

`offer_load_id` — цикл доступности предложения **для конкретного показа**; `offer_request_id` — общий запрос подготовки SDK/getOfferings, который могут наблюдать несколько показов. На одном показе возможны initial и несколько refresh/retry, у каждого новый `offer_load_id`. Дедуп результата — по load ID, конверсии показа — по view ID. Кнопка покупки сохраняет контекст оффера на момент нажатия; checkout затем получает собственный ID и может повторно загрузить пакет. Основная сквозная связь с оплатой — `paywall_view_id` + `purchase_attempt_id`, не временная близость событий.

`load_duration_ms` — wall time цикла на экране до наблюдаемого результата; `request_duration_ms` — время общего запроса, включая подготовку SDK; `time_since_view_ms` — время от открытия показа. Все эти интервалы могут включать фон, не являются freeze/visible-time. `is_cached=true` означает, что использован уже готовый пакет в store приложения без нового SDK-запроса для этого цикла; `false` не гарантирует отсутствие внутреннего кеша SDK. `offer_load_source`: `cache`, `awaiting_request`, `configuration`, `hydration`, `paywall_open`, `paywall_retry`, `checkout`; при объединении запросов источник — первый инициатор.

Результат доступности пишется только для активного текущего paywall. При закрытии незавершённый load остаётся цензурированным, не превращается в failed. При возврате на тот же экран результат сверяется с актуальным offer state; повторное открытие создаёт новый view/load ID. Провал обновления может сохранять ранее готовый кеш: тогда `has_cached_offer=true`, и это не «у магазина совсем нет предложений». В payload новых availability-событий фактические `auth_mode` и `supabase_user_id`; error logging теперь тоже использует реального пользователя, не выбранный backend.

`elapsed_ms` — время от начала координированной попытки, включая подготовку и последующее ожидание проверки. `app_active_ms`, `app_background_ms`, `app_inactive_ms` — наблюдавшиеся интервалы по AppState, не измерение отзывчивости интерфейса. При восстановлении `app_unobserved_ms` отдельно учитывает интервал от последней записи журнала до его загрузки: его нельзя автоматически отнести к фону, активному экрану или freeze. `resumed_after_restart` отличает восстановленный runtime от исходного. На recovery-событиях `step` — `get_customer_info` / `restore_purchases`, а `purchase_stage` сохраняет стадию исходной попытки. Старый дамп этих полей/новых исходов не содержит; сравнивать версии с учётом изменения точки `purchase_started`.

Структурированная диагностика: `rc_error_code`, `rc_readable_error_code` (в первую очередь `userInfo.readableErrorCode`), `error_category`, `retryability`, доступные `native_error_domain` / `native_error_code`, `has_underlying_error`. Домены/коды ограничены форматом; raw `userInfo`, receipt и данные аккаунта в аналитический payload не добавляются. Если SDK не передал underlying domain/code, восстановить причину Apple по ним нельзя.

Код 15 (`operation_in_progress`) — отказ новой попытке из-за занятого SDK, не `payment_pending`. Для него `retryability=after_original_operation`; у отказа purchase-request дополнительно `purchase_request_accepted=false`. Он не создаёт новый `purchase_pending`: известный in-flight остаётся у координатора, а отклонённый retry сохраняет исходную `outcome_unknown`-покупку. `purchase_failed` с этой категорией не означает отказ или отмену первоначального платежа; списание по нему не выводить. Код 20 остаётся `awaiting_confirmation`; отсутствие entitlement не снимает это ожидание.

`revenuecat_configured=false` — SDK не настроен для платформы; `offers_count=0` на `paywall_viewed` — только snapshot в момент открытия, он может означать ещё не завершённую загрузку, не доказанную пустоту магазина.

`client_error_logged` для RevenueCat: `area=revenuecat` (hydrate / offerings / subscribe / attributes) или `monetization` / `payments` (покупка). Поля `step`, `why`, `kind`, `detail`. `message` в PostHog не уходит.

Частые `event_name`: `revenuecat_hydration_failed`, `revenuecat_offerings_failed`, `revenuecat_subscribe_failed`, `revenuecat_attributes_failed`, `revenuecat_listener_failed`, `purchase_failed`, `purchase_preparation_failed`, `purchase_outcome_unknown`, `purchase_awaiting_confirmation`, `purchase_status_check_failed`, `checkout_journal_read_failed`, `checkout_journal_write_failed`. Ошибка фоновой записи/удаления маркера не превращает уже подтверждённый доступ в неудачную оплату.

---

## Ads

| Событие | Значение |
|---|---|
| `ad_requested` | Вошли в request path; для rewarded это opportunity, не доказательство вызова SDK load |
| `ad_shown` | Наблюдали SDK OPENED; не отдельный impression callback |
| `ad_dismissed` | Закрыли. `why` = native close reason |
| `ad_skipped` | Не показали. Каждый вызов, включая `trigger_not_ready` |
| `ad_failed` | Existing failed outcome; rewarded `disabled` / missing unit отдельно от SDK failure |
| `ad_impression_revenue` | Client SDK PAID value. Валюты отдельно, scoped дубли убрать, конфликты карантинировать; не settled money и не verified AdMob LTV |
| `ad_native_request_started` | Rewarded SDK load invocation, с request/instance ID; не loaded ad |
| `ad_impression_observed` | Rewarded impression evidence от валидного PAID, не от OPENED |
| `ad_observation_failed` | Optional rewarded listener/payload failure; не меняет ad result/reward |

На существующих interstitial decision-событиях кроме `ad_impression_revenue` строки:

- `after` — триггер (`after_question_answer`, `after_exam_complete`, …)
- `should_show` — `yes` / `no`
- `step` — `policy` / `wait_for_load` / `ensure_load` / `native_show` / `preload`
- `why` — причина (`cooldown`, `not_loaded:load_error:…`, `open_timeout`, …)
- `detail` — одна строка: `after=… should_show=… step=… why=… answers=3/12 elapsed=42s/160s shown=1/20 loaded=yes wait=no route=/question`

`should_show=no` + `step=policy` — не должны были показывать. `should_show=yes` и нет `ad_shown` — должны были, но не вышло.

`ad_impression_revenue` поля (плюс супер-свойство `app_user_id`):

- `revenue` — значение из SDK (валютные единицы, не micros)
- `currency` — код валюты SDK, обычно `USD`
- `ad_unit_id` — AdMob unit
- `ad_format` — `interstitial` / `rewarded`; rewarded остаётся выключен текущим config
- `ad_network` — winning source (`adSourceName`), иначе adapter class, иначе `unknown`
- `revenue_precision` — `unknown` / `estimated` / `publisher_provided` / `precise`
- `placement` — `after_training` / `training_questions` / `after_exam` / `sign_test` / `other`; rewarded — `exam_unlock`

Rewarded `ad_observation_version=1` добавляет `ad_request_id`, `ad_impression_id`,
test/configured unit basis, load-invocation/opened flags, PAID callback sequence и
normalized failure category/stage. OPENED не заменяет PAID evidence; PAID не
выдаёт exam credit. Optional PAID listener живёт ещё 2 секунды после settlement,
не задерживая существующий product promise. `enableAds=false` не меняется.
Warehouse `rewarded-sdk-v1` оставляет валюты раздельными, дубли/конфликты явными;
эти значения не входят в RevenueCat finance. Контракт и границы:
[external-entry-rewarded-observations.md](./external-entry-rewarded-observations.md).

`client_error_logged` `area=ads`: `ad_not_shown` (warning, должен был показаться), `ad_failed`, `ad_preload_failed`, `ad_impression_revenue_rejected` (`why: unparseable_revenue`).

---

## Auth, план, профиль, прочее

| Событие | Значение |
|---|---|
| `auth_started` / `auth_completed` / `auth_failed` | Вход |
| `school_code_redeem_started` / `redeemed` / `redeem_failed` | Код школы |
| `study_plan_created` / `create_failed` | Первый план |
| `study_plan_adjusted` / `adjust_failed` | Пересборка плана |
| `notification_permission_requested` / `resolved` | Системное разрешение. `enabled`, `source` |
| `question_bookmark_changed` | Закладка. `is_bookmarked` |
| `question_problem_report_requested` | Жалоба на вопрос (mailto) |
| `settings_changed` | Настройка. `setting` + `value` |
| `exam_country_resolved` | Страна проставилась сама |
| `exam_country_changed` | Сменили в профиле |
| `profile_action_selected` | Пункт профиля (support / share / …) |
| `app_review_requested` / `skipped` / `failed` | Стор-ревью. Skip: `already_prompted`, политика |
| `progress_reset_started` / `confirmed` / `failed` | Подтверждён intent, helper resolved или rejected. Один `reset_operation_id`, source=profile |
| `signed_out` | Выход |
| `offline_pack_download_*` / `removed` / `offline_access_blocked` | Офлайн-пак |
| `ai_chat_opened` / `access_blocked` / `message_sent` / `resolved` / `failed` | AI-чат |
| `client_error_logged` | Нормализованная ошибка |
| `client_fallback_used` | Сработал запасной путь продукта |

`client_error_logged`: `area`, `event_name`, `severity` (`warning` / `error`), `error_code`, `error_name`, плюс `step` / `why` / `detail` для ads и RevenueCat. Для медиа ещё `media_key`, `storage_path`, `asset_url`, `media_type`.

Raw `asset_url` теперь удаляется sanitizer, в том числе на SDK send; старые dumps могли его содержать. Значения error code/name ограничены безопасным форматом и длиной, без exception message. Это key-based защита, не доказательство отсутствия PII под любым другим именем.

`offline_pack_state_viewed` фиксирует focused pack state: loading/access_blocked/missing/incomplete/downloading/ready/other_category, downloaded category и catalog match. Start и terminal имеют один `operation_id`, elapsed duration и последний progress summary. `offline_pack_cancel_requested` — нажатие Stop, `offline_pack_download_cancelled` — подтверждённый cancelled rejection; **не складывать intent с terminal**. Completed пишется после download helper, до refresh метаданных; последующая ошибка refresh — `learning_operation_failed operation=offline_snapshot`, не второй download terminal. `operation=remove` на legacy failed ключе отделяет удаление от загрузки. ID текущего download не durable: Stop на transfer из другого mount может иметь `null`.

`ai_chat_message_sent/resolved/failed` связываются по `request_id`; рядом conversation/user-message IDs и `request_duration_ms` на outcome. Это wall duration запроса, не active-время и не токены/стоимость. Prompt, history и текст ответа не отправляются.

`progress_reset_confirmed completion_scope=helper_resolved_best_effort_cleanup` означает ровно resolve текущего helper: он может проглотить storage/filesystem/signout failures. Policy cleanup и identity не изменены; не объявлять полное удаление remote данных или новый acquisition.

`access_state_changed` — initial snapshot/change с previous/current Plus и source; не purchase/renewal/revenue.

Существующие gate/content events могут содержать `access_observation_version=1`,
`access_rule_version=plus-feature-observation-v1`, observed feature и
`access_expected`/`access_observed`/`access_comparison`. Это сравнение с актуальным
локальным store, не изменение gate и не доказанная оплата. CustomerInfo age —
возраст `requestDate`; remote verification age неизвестен. Обычный paywall,
PL free-topic Premium mark и офлайн dependency block не объявляются access defect.
Контракт, warehouse identity ledger и ограничения: [identity-access.md](./identity-access.md).

### Источник Возврата

`app_entry_resolved` содержит `entry_reason=direct/deep_link/notification/unknown`; deep link — только известный route pattern и screen, без URL/query. Resolution может прийти после started, поэтому смотреть оба события по визиту.

External signal внутри уже active приложения может обновить entry context без нового `app_visit_id`. Это не дополнительный возврат пользователя: границу визита определяют visit-события, не число entry-resolved.

`entry_observation_version=1` отдельно задаёт entry ID, signal receipt/processing
time и явно bound/awaiting/cached/queued-unattributed scope.
`external_entry_destination_observed` связывает normalized route/entity/state
с тем же foreground visit в течение 60 секунд; preexisting snapshot не означает,
что ссылка вызвала переход. `external_entry_destination_ended` /
`external_entry_ended` завершают только аналитическое наблюдение.
Association живёт не более часа и не переживает background/supersession.
`entry_attributed` по-прежнему отличает live от cached signal, но сама по себе
не разрешает новую scoped attribution при смене визита в storage queue.
Warehouse `external-entry-v1` требует start/resume после входа, новый accepted
answer и meaningful completion с теми же install/entry/visit/attempt IDs.
Старый result/replayed answer не становится новым learning; missing visit tail
остаётся censored даже после календарного горизонта. Доли требуют coverage и
чистых связей, confidence не выше low; delivery и causal lift не выводятся.
Подробности: [external-entry-rewarded-observations.md](./external-entry-rewarded-observations.md).

### Apple Search Ads

`apple_search_ads_attribution_resolved` — одна проверка установки на iOS. Пишется после ответа Apple AdServices, не в момент тапа по объявлению. Те же поля потом висят на человеке (`$set_once`) и на следующих событиях.

Warehouse `asa-installation-v1` считает только явные terminal observations по
primary `app_user_id`, а не каждое повторение super properties. `acquisition`
CLI/context/health сохраняют unknown, replay/conflicts, delayed response и
first-observed D7/D30 client/learning cohorts. Это не physical new installs,
verified revenue или ROAS; financial app-scope mapping ещё не подключён.
Паспорт и критерии maturity/coverage:
[acquisition-cohorts.md](./acquisition-cohorts.md).

| Поле | Значение |
|---|---|
| `asa_result` | `attributed` — установка с объявления. `organic` — Apple ответил, что клика не было. `unavailable` — ответа не получили; это не органика |
| `asa_campaign_id` | Числовой id кампании. Названия в событии нет |
| `asa_ad_group_id` | Id группы |
| `asa_keyword_id` | Id ключа. Пустой у Search Match и когда ключа не было |
| `asa_ad_id` / `asa_org_id` | Id объявления и кабинета Apple Ads |
| `asa_conversion_type` | `Download` или `Redownload` |
| `asa_claim_type` | `Click` или `Impression` |
| `asa_country_or_region` | Двухбуквенный код страны клика |
| `asa_click_date` / `asa_impression_date` | Время из ответа Apple, не время открытия приложения |
| `asa_unavailable_reason` | `token_error`, `invalid_token` или `unresolved`. Только при `asa_result=unavailable` |

Имя кампании и текст ключа берутся из отчёта Apple Ads по этим id. Спенд, CPA и ROAS из события не считаются. Android событие не шлёт. Ноль событий в старом окне значит, что билд ещё без этой проверки, а не что рекламы не было. Токен Apple в аналитику не пишется. Сброс прогресса в профиле проверку не стирает и второй раз её не запускает. Связь с покупкой — в воронке **Apple Search Ads → покупка** ниже: общий `app_user_id`, он же клиент RevenueCat. Смена страны подготовки и вход в аккаунт этот id не пересоздают.

После `Purchases.configure` iOS вызывает `Purchases.enableAdServicesAttributionTokenCollection()`. Токен уходит в RevenueCat, не в PostHog. Свой обмен токена для PostHog ждёт, пока RevenueCat заберёт токен первым, и всё равно выполняется, если RevenueCat не стартовал. Кампания в кабинете RevenueCat появляется у новой покупки, для которой токен успели отправить до оплаты. Старые транзакции с No campaign этим вызовом не заполняются. Статус Done в кабинете сам по себе отправку токена не доказывает.

`notification_opened` — наблюдали ответ ОС, `notification_response_id`, notification ID/action и `reminder_kind=study_daily/unknown`. `cached_response=true`, `entry_attributed=false`, `attribution_confidence=cached_os_response` означает сохранённый last response **без времени тапа**: он может относиться к старому запуску. Источник текущего визита из него не назначается. Только live OS response даёт `entry_reason=notification`, `entry_attributed=true`, `live_os_response`; повторный live ответ на уже записанный cached ID всё равно может дать entry resolution. Analytics-only local dedupe хранит последние 50 response IDs; это не durable delivery outbox.

`notification_schedule_resolved` наблюдает результаты существующих enable/disable/sync helpers: operation ID/name, enabled/disabled/permission_denied/failed, request duration, scheduled count. `confirmation_scope=helper_result_not_delivery`: это не OS delivery, не push receipt и не гарантированная отмена всех нотификаций. Часы, тексты, permission policy и routing не меняются; добавлена только reminder-kind metadata.

Частые `event_name`: `question_media_preview_failed`, `revenuecat_hydration_failed`, `ad_not_shown`, `ad_failed`.

---

## Воронки дашборда

Шаги — unique users с событием в окне, не обязательно подряд.

**Onboarding (экраны / steps).** First-run: category → exam_schedule → Home. Дашборд считает completed по `exam_schedule`, не `notifications`.

**First start.** Текущий readiness-вход: `first_start_started` → `training_session_started mode=initial_diagnostic` → новый `training_session_completed` → result/action. `first_start_shown` исторический и не обязательный в текущем UI; reminder — необязательное пост-действие. Прямой roadmap старт — отдельный activation entry. Связь после создания — `training_session_id`; до него общий intent ID пока отсутствует. Сплиты: `source`, `source_screen`, `action`.

**Roadmap.** `roadmap_step_opened` → `training_session_started` или `premium_gate_viewed` → `paywall_viewed`. Сплиты: `roadmap_step_id`, `surface`, `locked`.

**Training.** `training_session_started` → `training_question_viewed` → `training_question_answered` → `training_session_completed`. `training_mode_selected`/setup нужны только для соответствующего входа и не обязательны при прямом roadmap start. Resume может прийти без started в текущем окне. Для попыток связывать по `training_session_id`, а не временной близости. Result/review отдельно от completion, отсутствие terminal может быть censored. Сплиты: `mode`, `roadmap_step_id`, `practice_entry`, версия схемы.

**Apple Search Ads → покупка.** `apple_search_ads_attribution_resolved` с `asa_result=attributed` и `purchase_succeeded` у одного `app_user_id`. Этот id — клиент RevenueCat. Кампания — `asa_campaign_id`, ключ — `asa_keyword_id`; текст ключа только из отчёта Apple Ads. Покупка может прийти раньше ответа Apple: тогда id нет на строке `purchase_succeeded`, он есть на событии атрибуции того же человека. `purchase_access_confirmed` и restore не считать новой покупкой с этого ключа. `asa_result=organic` и `unavailable` в числитель не входят.

**Реклама → отвал.** В отчёте `acquisition` поле `product_funnel` считает одну установку по кампании и ключу, в строгом порядке времени: принятый ответ → завершённый тренировочный экзамен → `paywall_viewed` → `purchase_started` → `purchase_succeeded`. Шаг засчитывается только если он позже предыдущего. Покупка раньше экзамена видна как `purchase_outside_ordered_funnel`, а не как успех воронки. Окно — 30 суток от `first_observed_at`; неготовое окно — `censored`, не отвал. Страна подготовки и тип покупки на успехе берутся из снимка checkout (`checkout_origin_exam_country`, `checkout_origin_paywall_offer`: `plans` → subscription, `lifetime` → lifetime). Поздняя смена страны экзамена этот снимок не подменяет. Это клиентские события, не proceeds и не сверка с RevenueCat.

**Paywall.** `paywall_viewed` → `paywall_offer_ready` → `paywall_cta_selected action=purchase` → `purchase_started` → `purchase_succeeded`. Gate — отдельный предшествующий шаг для gated entry, не обязательный при прямом paywall. Связывать view/ready/CTA/start по `paywall_view_id`, outcome — по `purchase_attempt_id`. Loading/failed по `offer_load_id`; refresh не увеличивает views. Рядом: checkout_blocked, preparation_failed, pending/outcome_unknown, cancelled, failed, dismissed. Сплиты: фактический `auth_mode`, `source`, `surface`, `roadmap_step_id`; кеш и SDK-запросы раздельно. Package selector исторический. Старые версии без ready/CTA не включать в обязательную новую воронку.

**Restore.** Попытки — только `purchase_restore_started`, доступ восстановлен/подтверждён — только `purchase_restore_succeeded`; в новой версии дополнительно `entitlement_active=true`, `restore_outcome=restored`. Empty и failed отдельно. Не прибавлять legacy `restore_*`: это дубли того же запроса, а не дополнительные попытки/покупки. В attempt-метрике дедуп по `restore_attempt_id`, в user-метрике по `app_user_id ?? distinct_id`. Для старых событий без новых полей использовать канонический event name, не отбрасывать их лишь из-за отсутствия `restore_outcome`. Сам по себе restore не доказывает новую выручку или новое платёжное приобретение.

**Exam.** `exam_start_requested` → `exam_session_started` или resumed → `exam_session_completed`. Запуск связывать по `launch_attempt_id`, попытку по `exam_session_id`. Completion только для нового финала в этом заходе, не сохранённого результата. Сплиты: `exam_entry`, `roadmap_step_id`, `passed`. Рядом: launch failed/block/gate, ended (status/reason, не всегда abandon), empty-exit и restart **modal on result**. V2 launch gate `source=exam_limit` отдельно от restart.

**Ads.** `ad_requested` → `ad_shown` → `ad_dismissed`. Рядом: skipped, failed, `ad_impression_revenue`. Сплиты: `after`, `should_show`, `why`, `step`, revenue `placement` / `ad_network`. Ad LTV: `sum(revenue)` / unique `app_user_id` на `ad_impression_revenue`.

**Signs.** `sign_test_started` → `sign_test_question_answered` → `sign_test_ended outcome=completed`, связь по `sign_test_session_id`. `sign_opened` предшествует только практике из карточки, не общему/категорийному тесту. Abandoned отдельно. Сплиты: `sign_test_entry`, `category_id`, `test_type`. Поиск — отдельный entry по `search_id` + `query_revision`; debounce и selection не являются учебной попыткой.

---

## SDK, не каталог

| Событие | Значение |
|---|---|
| `Application Installed` | SDK не нашёл прежнюю запись installed build; не доказанная первая установка человека |
| `Application Updated` | SDK обнаружил смену сохранённого app build |
| `Application Opened` | Процесс открыли |
| `Application Became Active` | Вернулись из фона |
| `Application Backgrounded` | Ушли в фон / свернули |
| `$set` | Обновили person properties |

Последний `screen_viewed` до наблюдаемого `Application Backgrounded` — только последняя оболочка маршрута; фактическое состояние уточнять специальными ready/result/review/block событиями. При kill/background gap или неполном окне «последний экран перед уходом» может быть неизвестен.

---

## Аудит По Handbook: 7 Октября 2026

### Вывод

**Учебная и клиентская purchase-аналитика уже хорошо проработаны, но считать всю систему готовой нельзя.** Переписывать её с нуля или добавлять все 116 событий хендбука не нужно. Главные улучшения: устранить ложные ошибки готовности PL-оффера, сделать проверяемой финансовую связку, исправить расчёт воронок и полноты данных, определить identity/privacy policy. Следующий слой пользы — learning retention, версии контента и диагностика медиа.

Есть конкретно воспроизведённый дефект: при поздней успешной загрузке пакетов paywall2 может отправить `paywall_offer_failed failure_reason=empty_offerings`, хотя пакет доступен. Остальные находки ниже разделяют подтверждённые свойства кода, риски и непроверенные внешние настройки. Они **не доказывают**, что реальные пользователи сейчас массово теряют покупки или что конкретная цена/гейт ухудшает конверсию.

### Метод И Границы

Основа: [Mobile_App_Analytics_Handbook.html](../../Mobile_App_Analytics_Handbook.html), версия 1.0 от 7 октября 2026; рассмотрены главы 1–42 и группы каталога. Хендбук сам предупреждает, что его taxonomy и пороги — проектные рекомендации, а не обязательные vendor event names.

Проверен текущий worktree на `HEAD=f344fca`: `mobile/src/analytics`, providers/hooks, training/exam/signs, оба billing flow, checkout/journal, reminders, media/ads, `analytics-engine`, Supabase functions/migrations и локальная документация/экспорты. Версия в `mobile/app.config.ts` — `1.0.31`; установленный PostHog RN — `4.45.11`, Purchases RN — `10.7.0`. Это состояние исходников и локальных dependencies, **не подтверждение версии опубликованного бинарника**. `1.0.21` в таблице общих свойств выше — старый пример, не текущий release filter.

Проверка read-only, кроме добавления этого отчёта. Код, конфигурация, lockfile, схемы и данные не менялись; зависимости не устанавливались. Магазинные покупки, приложение на устройстве и Maestro в этом аудите не запускались. Текущие кабинеты PostHog/RevenueCat/Apple Ads, внешние webhooks/destinations, отдельный `mindjar-dashboard` и store financial reports не инспектировались. Старые октябрьские аудиты и дампы не использованы как доказательство текущего production-поведения.

Обозначения: **подтверждено** — виден конкретный механизм в коде; **воспроизведено** — проверен существующий helper в контролируемом окружении; **не проверено** — нужны внешние настройки/данные; **условно** — функция выключена или не найдена в действующем продукте. P0 ниже означает «закрыть до доверия бизнес-отчётам», не утверждение о критическом сбое каждого пользователя.

### Приоритетные Находки

#### A. P0: Ложный Failed При Успешной Загрузке PL-Оффера

**Воспроизведено.** [Paywall2Screen.tsx](/home/lastday/prawko/mobile/src/features/paywall2/Paywall2Screen.tsx:151) передаёт tracker selector, который игнорирует актуальный массив `offers` и возвращает `selectedPackage` из последнего React-render. [paywall-offer-analytics.ts](/home/lastday/prawko/mobile/src/features/entitlements/paywall-offer-analytics.ts:93) синхронно подписан на Zustand store и завершает цикл загрузки до того, как React обновит этот snapshot.

Контролируемый сценарий на фактическом helper, с установленным Zustand и mocked native/context dependencies: пустой кеш → `loading` → store получает один подходящий пакет и `status=ready` → обновляется render snapshot → повторный `observe()`. Получено: `paywall_offer_load_started`, затем `paywall_offer_failed`, `offers_count=1`, `failure_reason=empty_offerings`; ready не появляется, поскольку цикл уже terminal. Контрольный selector, читающий текущие `offers`, даёт `paywall_offer_ready`.

**Последствие:** завышенные load failures и заниженная ready-конверсия нового PL-paywall. Это ошибка измерения, не доказанная ошибка выдачи пакета в UI или оплаты. При анализе текущих данных нельзя без проверки считать такой failed реальным отсутствием продукта.

**Рекомендация:** определять пригодность пакета из актуального store state, отдельно наблюдать готовность реально отображённого предложения. Приёмка: cold/cached load, delayed hydration, refresh, смена плана и неподдерживаемый offering; при успешном пакете нет ложного failed, одна terminal-запись на `offer_load_id`. Нужен интеграционный тест связки screen + tracker, не только package-matching helper. Главы 15, 24, 32–35.

#### B. P0: Деньги И Subscription Lifecycle Не Замкнуты В Проверенном Контуре

**Подтверждено в репозитории; внешняя интеграция не проверена.** Клиент различает checkout outcomes и доступ, но [health.py](/home/lastday/prawko/analytics-engine/prawko_analytics/health.py:230) всегда возвращает `revenuecat=not_loaded`. В просмотренных Supabase functions, scripts и engine нет обработки RC subscription lifecycle/финансового ledger. Это не доказывает отсутствие RevenueCat → PostHog интеграции в кабинете.

Для PL нужны подтверждённые trial start, first paid/trial conversion, renewal, auto-renew intent, billing issue, expiry и refund. Для CZ/SK — подтверждённая non-recurring lifetime-покупка. `purchase_succeeded`, `trial_days`, `price` и `access_source=purchase` не заменяют эти факты: entitlement может быть trial/restore, цена — snapshot выбранного пакета, а продление может произойти без открытого приложения.

Связка IDs выглядит разумно: [revenuecat.ts](/home/lastday/prawko/mobile/src/features/entitlements/revenuecat.ts:172) отправляет `app_user_id`/`supabase_user_id`, SDK конфигурируется с тем же `appUserID`, что используется как PostHog distinct ID. Отсутствие `$posthogUserId` **само по себе не дефект**: хендбук S03 описывает fallback на RC App User ID. Но delivery и совпадение реального server event с учебной личностью пока не подтверждены.

**Рекомендация:** сначала проверить существующую RC integration и назначить единственный денежный источник, а не строить новый backend вслепую. Минимально достаточно канонических RC events/экспорта и небольшой сверки по transaction/store/environment; клиентские outcomes оставить диагностикой UI. Раздельно хранить refund adjustments, subscription lineage, валюту, revenue basis и `as_of`. Не считать restore/transfer новой выручкой, trial платящим, proceeds банковской выплатой.

Приёмка: одна controlled покупка, trial conversion, renewal при закрытом app, refund, duplicate delivery и restore дают ожидаемые отдельные финансовые эффекты; sandbox исключён; видно matched/unmatched transactions. Exact join к `paywall_view_id` не выдумывать, если RC его не предоставляет. Главы 2–4, 15–16, 26, 32, 34.

#### C. P0: Расчёт «Conversion» Не Всегда Является Воронкой

**Подтверждено статически.** В [context.py](/home/lastday/prawko/analytics-engine/prawko_analytics/context.py:485) `_metrics()` независимо собирает пользователей с numerator и denominator events. Для `paywall_purchase_conversion` нет требования, чтобы покупатель входил в viewer cohort, чтобы view предшествовал покупке, или чтобы сохранялся тот же view/attempt. Поле `funnel` в контракте не заставляет этот расчёт использовать результат `_funnels()`.

Поэтому покупка после старого paywall за пределами окна может попасть в numerator текущего окна; отношение теоретически может превышать 100%. Это риск из алгоритма, не установленное значение на production-данных. Отдельный `_funnels()` соединяет IDs, но не проверяет порядок timestamps и conversion window; шаг с несколькими checkout attempts также меняет фактическую единицу подсчёта с view на attempt.

[health.py](/home/lastday/prawko/analytics-engine/prawko_analytics/health.py:343) использует первые события пользователя в окне и временное соседство экзаменов. Это полезный пользовательский обзор, но не completion rate одной конкретной попытки. Слова `users`/`people` не превращают install-centric key в доказанного человека.

**Рекомендация:** дать отдельные паспорта user-, view-, checkout- и learning-attempt метрикам; numerator должен быть outcome допустимой denominator cohort. Проверять порядок, связи IDs, horizon и censoring. Для grain=view несколько retry-покупок не создают несколько converted views. Неполное окно или неизвестный исход не объявлять отказом.

Приёмка на fixture: покупка до view, покупка без view, два view одного пользователя, два retry одного view, completion другой учебной попытки и outcome после конца окна не искажают соответствующую метрику. Главы 17–20, 28, 33, 36.

#### D. P0: Импорт И Полнота Данных Слабее Клиентского Контракта

**Подтверждено.** [ingest.py](/home/lastday/prawko/analytics-engine/prawko_analytics/ingest.py:25) переносит PostHog `uuid` в верхнеуровневый `event_id`, а клиентский `properties.event_id` остаётся отдельным значением. Нет дедупликации по клиентскому ID/answer revision/attempt terminal; повторный импорт заменяет дневной partition целиком.

Замена partition допустима для **полного snapshot дня**, но перекрывающийся частичный экспорт может затереть ранее загруженные строки. `complete` определяется датой выгрузки/границей `to`, не доказательством полной pagination, отсутствия лимита или учтённого offline lag. [context.py](/home/lastday/prawko/analytics-engine/prawko_analytics/context.py:94) вычисляет completeness, однако `_metrics()` не получает её как обязательный eligibility gate.

В клиенте есть `event_sequence`, UTC occurrence и непрерывающие UI wrappers. Установленный PostHog RN по умолчанию использует file persistence; **очередь не отсутствует**. Однако запись capture не является подтверждением доставки. `useAnalytics` глотает ошибки без собственного счётчика потерь; store completion и capture не образуют durable outbox.

**Рекомендация:** разделить provider UUID, client event ID, business IDs, occurrence и received time; определить dedupe/merge policy и явный export watermark. Не объявлять полноту по одному календарю. Не требовать собственного outbox для каждого screen event, но проверять потерю critical completion/access observations и queue/reset behavior.

Приёмка: duplicate row, overlapping partial dumps, поздний offline event, kill между сохранением результата и capture; все известные записи сохраняются, missing coverage ограничивает метрики. Главы 5–6, 32–35.

#### E. P0: Privacy Policy Не Представлена Управляемым Collection State

**Подтверждено как технический пробел; это не юридическое заключение.** [AnalyticsProvider.tsx](/home/lastday/prawko/mobile/src/providers/AnalyticsProvider.tsx:23) и build gate включают PostHog по build/API key/TestFlight/e2e, не по purpose/consent state. В проверенном mobile-коде нет analytics opt-in/opt-out, consent ledger или соответствующей queue-cleanup orchestration.

Хорошо: touch autocapture выключен, wrapper и `before_send` удаляют email, текст, URL, tokens и receipts по именам ключей. Но denylist не проверяет смысл произвольной строки под разрешённым ключом. Прогресс-reset сохраняет app identity/checkout/ASA и **не является удалением аккаунта или исторической аналитики**. [Privacy page](/home/lastday/prawko/web/src/app/legal/privacy/page.tsx:15) остаётся beta foundation без конкретных сроков и процедуры удаления; внешние retention/deletion настройки не проверены.

**Рекомендация:** сначала определить основания и цели сбора с ответственным за privacy; технически реализовать требуемое управление analytics/attribution/replay/marketing независимо от billing и notification permission. Документировать recipients, retention, отзыв и удаление из vendors/exports. Если для цели нужно предварительное согласие, не накапливать запрещённую активность до него и не досылать её после позднего opt-in. Проверять безопасные bounded поля, не только denylist.

Приёмка: отказ/отзыв/поздний opt-in и deletion имеют проверенный результат во всех применимых destinations; покупки и разрешённая работа продукта не зависят от выключенной аналитики. Правовое решение не выводить из EU host, UUID или native privacy manifest. Главы 3, 25, 30–32, 39.

#### F. P0 При Account Analytics: Install Identity И Account Identity Смешиваются

**Подтверждено устройство схемы; последствие требует проверки политики продукта.** [app-user-id.ts](/home/lastday/prawko/mobile/src/identity/app-user-id.ts:7) хранит устойчивый локальный `usr_…`; PostHog и RC используют его. [useAnalytics.ts](/home/lastday/prawko/mobile/src/hooks/useAnalytics.ts:101) делает `reset` no-op. [AnalyticsProvider.tsx](/home/lastday/prawko/mobile/src/providers/AnalyticsProvider.tsx:113) alias-ит каждый наблюдаемый Supabase account к текущему install ID.

Путь A login → reset/signout → B login на том же устройстве способен отправить aliases обоих аккаунтов к одной аналитической install identity. Один аккаунт на двух устройствах, наоборот, даёт два `app_user_id`. Нет версионированного identity-link ledger в проверенном аналитическом слое. Фактическое объединение person profiles и перенос entitlement в этом аудите не проверялись.

Для guest/install-level отчётов текущая схема приемлема и помогает recovery. Но person/account retention, payer CAC и портфельные unique users нельзя считать простым unique `app_user_id` или суммой рынков. Отсутствие `signed_out` также не равно потере события: ключ есть в каталоге, но активного call site не найдено.

**Рекомендация:** явно выбрать grain и правила account switch, restore, transfer и cross-device анализа. Проверить A → B и две установки одного account, описать миграцию/link table до изменения SDK identity. Не добавлять бездумный `Purchases.logOut()`/новый distinct ID: это может разорвать уже существующую финансовую связку. Эта находка не доказывает неправомерную выдачу Premium второму аккаунту. Главы 4, 17, 20, 33–34.

### Следующий Слой Улучшений

| ID / Приоритет | Подтверждённый пробел или ограничение | Что улучшить и как проверить |
|---|---|---|
| G / P1 | Есть legacy persisted `installedAt` и `days_since_install`: [PremiumTeaserHost.tsx](/home/lastday/prawko/mobile/src/features/monetization/PremiumTeaserHost.tsx:60) пытается получить native installation time, иначе остаётся локальное время инициализации. Нет отдельного надёжного first-observed/observation-start контракта с provenance; reset меняет legacy timestamp. `Application Installed` — SDK marker; onboarding attempt живёт только в runtime. `exam_schedule` пишется до `finalizeLocalOnboarding`, отдельного whole-flow completion event нет. | Сохранить однозначный cohort anchor и detection method; отличать progress reset, дату установки, позднее наблюдение и новую установку. Завершение onboarding наблюдать после принятого финала либо явно вывести из согласованных событий/состояния. Не считать шаг даты сам по себе доказательством доставки на Home. |
| H / P1 | [checkout-journal.ts](/home/lastday/prawko/mobile/src/features/entitlements/checkout-journal.ts:10) не сохраняет `plan`, `paywall_variant`, `paywall_offer`, `trial_days`; package после восстановления также не содержит `subscriptionPeriod`. Recovery events теряют эти dimensions. | Сохранить безопасный immutable origin snapshot и реальный store period. После kill/restore сохраняются исходные attempt/view/product и исходная модель PL plans либо CZ/SK lifetime; текущие настройки не подменяют исходный checkout. |
| I / P1 | На paywall2 `trial_days=0` может означать unknown eligibility, ineligible или отсутствие trial. Нет отдельного eligibility outcome/error и immutable default field. Dismiss использует [getMonetizationOfferSnapshot()](/home/lastday/prawko/mobile/src/features/monetization/monetization-analytics.ts:6), выбирающий recommended package, не `selectedPlan`: можно получить `plan=quarter` с product/price месячного пакета. CTA не содержит полного product/price snapshot; `time_visible_ms` — wall clock до unmount. | Согласовать product/price с реально выбранным планом на view/CTA/dismiss и сохранить исходный default отдельно. Разделить eligible/ineligible/unknown/error; измерять реально показанный trial, не объявляя выбором preselection. Версионировать layout/config и добавить active visible time, не переименовывать существующее wall field. |
| J / P1 | Есть `access_state_changed`, SDK state и gates, но нет явной проверки expected feature access против observed blocker, verification age/rule version. `is_plus`/`access_source` не разделяют trial/paid/restore. | Проверяемый access mismatch на конкретной функции с источником/свежестью подтверждения. Ожидаемый premium gate не ошибка; `paywall_viewed is_plus=true` не автоматически дефект. Paid/trial history получать из B, не угадывать по bool. |
| K / P1 | `question_set_key` и `catalog_generation` есть, но generation — runtime-счётчик. На ответах нет immutable bank/question revision; фактический content language и exam rules version тоже не закреплены в analytics payload. | Сохранять revision/hash контента, explanation/media и exam config, реальный display language отдельно от UI locale. Проверка: изменение ответа/перевода не смешивается с предыдущей ревизией в accuracy/report-rate. |
| L / P1 | [QuestionMediaCard.tsx](/home/lastday/prawko/mobile/src/features/questions/QuestionMediaCard.tsx:217) логирует image preview error, но image load success только меняет UI. Video `sourceLoad`/`playToEnd` обслуживают UI/callbacks; полного ready/error denominator в analytics нет. `learning_screen_ready` явно имеет `media_readiness=not_measured`. | Под гипотезу фрикции добавить safe media-ready/failure и необходимые video outcomes, связанные с вопросом/ревизией. Проверять missing file, decode/playback failure, buffering и последующий answer; не считать usable question гарантией просмотра видео. Есть JS error boundary/global logger, но native crash/ANR coverage и доставка fatal-события не доказаны. |
| M / P1 | Engine `d7_return` использует `Application Installed` и любой product event на calendar D+7. В health active days добавляются по обработанным событиям; meaningful completion threshold не применяется. | Раздельные open, learning, post-activation и paid engagement cohorts с maturity/lag. Версия meaningful rule: например, завершённая тренировка с хотя бы 5 уникальными принятыми вопросами либо завершённый exam. Это гипотеза хендбука, а не обязательный размер тренировки. Время до пользы показывать вместе с долей ещё не достигших её; foreground не называть минутами учёбы. |
| N / P1 | ASA реализована и имеет корректные unknown/organic различия, но engine всегда объявляет acquisition mix unavailable. В repo есть исторические Apple Ads CSV за 12–20 сентября, не daily spend pipeline. Android referrer/MMP не найден. | Сначала join ASA IDs к одному свежему CSV/spend source и B; считать realised cohort proceeds D7/D30 и coverage. CSV учитывает UTC/EUR, product day — Warsaw. Не складывать campaign totals с дочерними строками и не превращать периодный spend в дневной. Android/Meta/aggregate attribution добавлять при реальном запуске соответствующего канала. |
| O / P1 | Reminder schedule/open наблюдаются, но это локальные daily reminders, не доказанная provider delivery воронка. Cached last response намеренно не задаёт источник визита. `app_entry_resolved` для deep link описывает полученный route pattern, не успешный показ destination. | Связать наблюдаемый reminder open с дальнейшим учебным outcome и раскрыть attribution confidence. Отдельно проверять ошибочный destination при наличии таких ссылок. Не создавать FCM/backend campaigns ради checklist и не выводить причинный эффект из сравнения openers с non-openers. |
| P / P1 | `AnalyticsEventPayloads` для всех событий — одинаковый `Record<string, primitive>`; обязательные domain keys/enums/grain на уровне типа не проверяются. QA содержит unit helpers и Maestro UI paths, но не полный автоматический analytics acceptance gate. | Event-specific контракт и обязательные IDs/null rules, golden traces, schema/enum/dedupe/lag quality checks. Приоритет — screen + tracker, recovery snapshot, idle/background duration, native SDK queue и финансовая сверка; отсутствие event не должно автоматически становиться abandon. Owner/runbook и rollout log важнее ещё десятка графиков. |
| Q / P2, условно | `enableAds=false`. При включении interstitial уже имеет paid callback с currency/precision, но rewarded exam path не подписан на `PAID`, не имеет общего request/impression ID и отправляет иной набор полей. | До возврата рекламы проверить revenue всех активных formats, reward integrity, no-fill/network категории и единый request/impression scope. Нулевые ad events сейчас ожидаемы; не «чинить» выключенную рекламу и не ставить эту задачу выше PL billing. |
| R / P2 | Есть explanation exposure, mistakes mode, bookmarks, report mailto, review request и support/share intents. Нет подтверждённого реального exam outcome/journey end; replay, referral rewards и experiment exposure в действующей конфигурации не найдены. | Оценивать повторную правильность после explanations/review с контролем revision и selection; добровольный bounded self-report поможет отличить достигнутую цель от dropout. Mailto/share/review request не считать отправленным ticket, referral install или опубликованным отзывом. Replay/A-B/referrals отложить до конкретной задачи и подходящего объёма. |

### Что Уже Хорошо

- Сохраняются существующие canonical names; каталог содержит 157 объявлений, но количество не принимается за coverage. Intent/setup, usable question, accepted answer, completion, saved result и review разделены; ID попыток есть. Открытие старого training result не генерирует новый completion.
- [activity.ts](/home/lastday/prawko/mobile/src/analytics/activity.ts:26) считает наблюдаемый foreground, inactive и cumulative checkpoints; у component clocks есть focus/AppState. Kill и unknown tail честно отделены от explicit exit; elapsed/engagement ограничения документированы.
- `getAnalyticsBaseProperties()` читает текущие stores в момент capture. `exam_country`, UI locale, access source и schema/build контекст отделены от GeoIP/person state. Для engine установлен календарь Warsaw с DST, не постоянный UTC offset.
- Checkout учитывает native start, preparation failure, cancellation, pending, outcome unknown, recovery и restore empty. Маркер пишется до native purchase; восстановление доступа не выдаётся за повторную успешную оплату. Доступ не зависит от PostHog delivery или запроса offerings.
- PL выбирает планы `P1W/P1M/P3M` по стране, не языку. CZ/SK остаются lifetime; пустые/annual/lifetime-only PL offerings не переключают billing model. Trial скрыт до подтверждения eligibility, default quarter не создаёт `paywall_plan_selected`. Аналитический пробел I не означает выдуманное обещание trial.
- ASA сохраняет campaign/adgroup/keyword IDs и отличает attributed, completed non-attribution и unavailable. Install attribution не перезаписывается reminder return; progress reset не запускает второй ASA check. Exact finance/RC linkage ещё требует B/N.
- Touch autocapture выключен; нет необходимости добавлять clickstream, raw question text, chat prompt, signed URL или receipt. Существующий local collector позволяет сверять известный UI-путь с событиями без загрязнения production.
- Engine имеет interpretation overlay, ограничения causal claims, minimum denominators и предупреждения концентрации. Это правильное направление, но эти guards не исправляют дефекты denominator/completeness из C/D.

### Соответствие Каталогу Хендбука

Не переименовывать живые события в имена хендбука. Его `practice_started` привязан к первому usable вопросу, а текущий `training_session_started` — к созданию попытки: эквивалентный milestone нужно выразить через started + question-viewed/ready, не менять старый trigger.

| Группа Хендбука | Что Есть Сейчас / Ограничение |
|---|---|
| launch | `app_visit_*`, SDK install/update/open; own first-observed anchor требует G |
| identity | `auth_*`, install ID и account aliases; F, active logout capture не найден |
| attribution | `apple_search_ads_attribution_resolved`; pending persist/retries, N |
| links | `app_entry_resolved`; destination success/failure не замкнуты, O |
| onboarding | flow + step + screens; runtime flow и whole-flow завершение, G |
| dashboard | `screen_viewed home`, state/roadmap entries; отдельный `dashboard_viewed` не обязателен |
| recommendations | `roadmap_step_opened`; contextual shown/selected только на legacy Home, не текущая обязательная воронка |
| practice | `learning_intent_requested`, setup, `training_*`, ready/operation failed; activation — derived задача M |
| exam | request/launch IDs, started/resumed/completed/result/review; `exam_restart_*` только result modal |
| learning | exposure объяснений, bookmarks/report intent, mistakes/review, plan/country/settings; revisions/outcome — K/R |
| media | image-error observation и UI media callbacks; full media denominator — L |
| paywall | viewed/load/ready/failed/select/dismiss/gates; A/I, terms/section micro-events необязательны |
| purchase | CTA/preparation/native/outcomes/recovery; развитый клиентский контур, деньги — B |
| access | state change, gates, restore canonical/legacy; mismatch — J; не суммировать restore aliases |
| subscription | клиент не заменяет server lifecycle; локальный pipeline не найден, external RC setup не проверен, B |
| push | permission/schedule/OS response; локальные reminders, не remote campaign delivery, O |
| ads | interstitial/reward lifecycle, interstitial paid revenue; выключено, Q |
| quality | learning operation failed, ready latency, JS error/fallback logging; P/L |
| experiment | действующий exposure/assignment не найден; условно R |
| support | profile/support/question-report intents, не ticket lifecycle; R |
| reviews | requested/skipped/failed; не доказанный системный показ или публикация, R |
| privacy | sanitizer/build filtering/reset; purpose/consent/deletion orchestration — E |
| referral | share intent; qualification/reward model не найдена, внедрять только при наличии функции |

### Проверка Всех Глав

| Глава | Оценка Текущего Состояния |
|---|---|
| 1. Система решений | Есть развитая телеметрия; центральную learning outcome metric ещё нужно закрепить, M |
| 2. Источники истины | Client/access разделены; verified money/spend контур не проверен, B/N |
| 3. Ключи и идентификаторы | В просмотренном SDK setup используются public integration keys; внешние server secrets/destinations не аудитированы |
| 4. Identity | Устойчивая install-связка есть; person/account policy требует F |
| 5. Время/установка/сессия | Хорошие clocks/ordering; first-observed и delivery coverage — D/G |
| 6. Контракт | Схема 3 и единый wrapper есть; domain validation/app/source контекст — P |
| 7. Имена/типы/properties | Стабильные имена и snapshots есть; payload typing и recovery snapshot — H/P |
| 8. Атрибуция | ASA отдельно от entry; общая acquisition dimension — N |
| 9. Apple Ads → выручка | ASA реализована; проверяемые finance/spend joins — B/N |
| 10. Meta/Android/ссылки | Referrer/Meta path не найден; deep-link receipt не outcome, N/O |
| 11. Aggregate iOS | Реализация/кабинет не подтверждены; условно при соответствующем канале |
| 12. Spend | Исторические CSV есть; ежедневная свежесть и merge/granularity не замкнуты, N |
| 13. ASO | Store console/карточка/эксперименты не проверены; SDK не покрывает pre-install воронку |
| 14. Internal events | Основной цикл хорошо покрыт; names маппировать по смыслу, не копировать |
| 15. Paywall/purchase/access | Billing модель верна; конкретный offer race, snapshot/mismatch — A/H/I/J |
| 16. Subscriptions/trials/refunds | Клиентские статусы недостаточны; B |
| 17. Воронки | IDs есть; расчёт grain/order/denominator — C |
| 18. Activation/TTV | Ready/answer/completion доступны; versioned meaningful rule и незавершившие — M |
| 19. Retention | Calendar return proxy есть; learning/paid cohorts — M, completeness — D |
| 20. Сегменты | Event-time country/locale/access есть; identity и content/version границы — F/K |
| 21. Контент/рекомендации | Answer/explanation/report/review signals есть; revisions/media/outcome — K/L/R |
| 22. Push | Локальные reminders наблюдаемы; delivery и причинный эффект не доказаны, O |
| 23. In-app ads | Текущий kill switch выключен; расширения условны, Q |
| 24. Техническое качество | Ready/errors/checkout stages есть; media/native failures и A/L |
| 25. Support/reviews/deletion | Intent events есть; ticket/outcome/deletion proof — E/R |
| 26. Денежные метрики | Verified ledger/basis/maturity не замкнуты, B/N |
| 27. Dashboard | Отдельный dashboard repo не проверен; engine ограничения — C/D/M/P |
| 28. Малые выборки | Minimum counts/concentration есть; не заменяют корректный знаменатель и intervals |
| 29. Эксперименты | Exposure/assignment не найден; не приоритет до качества данных |
| 30. Replay | В provider не включён; installed SDK default — off; это не обязательная доработка |
| 31. Privacy | Sanitization есть; управляющий collection/deletion state — E |
| 32. Delivery/dedupe | SDK persistence и checkout journal есть; critical delivery/import semantics — D/H |
| 33. Pre-release QA | Частичные unit/реальные helper проверки; полноценного end-to-end analytics gate не доказано, P |
| 34. Reconciliation | Identity prerequisites есть; реальные RC/export/spend сверки не выполнены, B/N |
| 35. Data quality | Interpretation/identity/sample guards есть; full quality monitoring/runbook не подтверждены, D/P |
| 36. Расчёты/схемы | Warehouse зачаток есть; код engine расходится с рекомендуемыми правилами, C/D/M |
| 37. План Prawko | Первый шаг — точность A–F, затем B/N/M; не массовый rollout events |
| 38. Слепые зоны | Pending/restore/foreground закрыты лучше; offer race, lifecycle/revisions остаются |
| 39. Acceptance/регулярность | Есть тесты и словарь; gate/owners/еженедельная сверка требуют P |
| 40. Benchmarks | Реальные сопоставимые proceeds/first-open cohorts не подтверждены; target из benchmark назначать нельзя |
| 41. Термины | Главное сохранить различия install/person/visit/attempt, client success/money, renewal intent/access |
| 42. Источники | Использованы предоставленный handbook и текущий код; SDK сверялся с установленными модулями, RC identity/webhook references — S03/S21 |

### Результаты Проверок

Jest запускался из `mobile/` напрямую через установленный runner, без cache/установки dependencies: аналитика, identity, entitlements, paywall plans, monetization, notifications и ad analytics/interstitial controller. `pnpm` в shell отсутствует, поэтому использован `node node_modules/jest/bin/jest.js --runInBand --no-cache` с указанными test paths.

**Результат: 26 suites; 24 прошли, 2 проблемные. Из запущенных tests: 172 passed, 1 failed, 173 total.** Один suite не смог загрузиться, поэтому его tests не входят в этот total.

- [catalog.test.ts](/home/lastday/prawko/mobile/src/analytics/__tests__/catalog.test.ts:94): устаревшее ожидание дословной фразы `Home/Learn exam tile does not check this gate`. Текущее описание верно различает result restart modal и отдельный V2 launch gate. Это failure текстового assertion, не доказательство поломки экзамена. Не «исправлять» семантику на отсутствие любого launch gate.
- [revenuecat-packages.test.ts](/home/lastday/prawko/mobile/src/features/entitlements/__tests__/revenuecat-packages.test.ts:1): suite не загрузился из-за ESM `expo-secure-store` через `auth-storage` в текущем Jest окружении. Это тестовая configuration/mocking проблема, не результат native package purchase.
- Checkout recovery/journal, PL plans и premium-copy, training lifecycle, runtime ordering, ASA parser/policy, build gates, notifications helper и interstitial paid callback tests в выбранном прогоне прошли. Они не покрывают RC кабинет, native checkout, privacy opt-out или screen/tracker race.
- A воспроизведён дополнительным in-memory запуском фактического offer tracker; никаких helper/test файлов не создавалось. Это controlled helper-level proof, не запись реального native UI-прогона.
- Python tests engine не выполнены: `python3 -m pytest -p no:cacheprovider -q` остановился на `No module named pytest`. Пакеты не устанавливались; engine находки подтверждены чтением реализации, не зелёным runtime suite.
- Maestro/native billing/SDK offline queue/Crashlytics-vitals/replay recordings не проверялись. Наличие flows и старого local dump не объявлено успешным текущим e2e.

### Практический Порядок

1. Перед использованием paywall-ready rates разобрать A и восстановить проверяемый QA; не объявлять каждый `empty_offerings` отказом магазина.
2. Проверить существующие RC destinations и финансовый источник B; параллельно согласовать identity/privacy E/F. Не менять ID или создавать конкурирующие money events без миграции.
3. Закрепить cohort/metric passports и исправить расчёт/покрытие C/D/G. Добавить безопасный persisted billing snapshot H; проверить mismatch J.
4. Соединить один свежий spend экспорт, ASA и verified transactions; начать с realised D7/D30 и actual counts/coverage, не lifetime forecasts.
5. Построить три компактных рабочих отчёта: качество/ошибки и freshness; acquisition + verified proceeds; обучение + зрелые learning cohorts. Каждый имеет grain, numerator/denominator, window, version, source, owner и дату обновления.
6. По обнаруженному провалу выбрать одно продуктовое улучшение: K/L для непонятного/неработающего контента, M/O для следующего учебного шага и возвращения, R для понимания достигнутой цели. Цена, hard gates, MMP, replay и A/B не назначаются «лечением» без данных.

**Что не менять ради хендбука:** canonical event names, PL subscriptions/CZ-SK lifetime routing, отмену/pending/restore semantics, install identity без migration, отключённые ads, рабочий onboarding только ради дополнительных шагов. `exam_restart_*` остаётся result-screen modal; отдельный `premium_gate_viewed source=exam_limit` не превращается в дневной кап или обязательный restart-step всех Home-запусков.

Итог: база не требует полной переделки. Наибольшая отдача сейчас — **точность уже собираемых данных и связка «привлечение → verified деньги → доступ → содержательное обучение»**, а не увеличение количества событий.

## Реализация Аудита: В Работе

Начата 7 октября 2026. Аудит выше описывает исходное состояние; текущая реализация и оставшиеся требования находятся в [handbook-implementation.md](./handbook-implementation.md). Полное завершение и production readiness пока не заявлены.

Добавленные canonical events:

| Event | Grain / Meaning |
| --- | --- |
| `analytics_identity_observed` | Install/account link, unlink or switch; не SDK alias, auth outcome или перенос доступа. |
| `install_observation_resolved` | Разрешён persisted first-observed anchor; событие может повторяться, не новая установка. |
| `onboarding_flow_completed` | Локальные save/complete calls вернули успех; не physical storage flush или Home arrival. |
| `onboarding_home_arrived` | Foreground Home route после принятого локального финала, тот же persistent attempt ID; не usable content или learning activation. |
| `question_media_load_started` | Запрос asset компонентом, `media_load_id`; не просмотр видео. |
| `question_media_ready` | Native callback image/video подтвердил готовность один раз на load ID. |
| `question_media_failed` | Нормализованная missing/load/playback ошибка, без URL. |
| `question_media_playback_started` | Native player сообщил actual playback, не tap intent. |
| `question_media_playback_ended` | Native playToEnd, не доказательство focused просмотра/обучения. |
| `question_media_buffering` | Наблюдаемый post-ready интервал; `buffering_completed=false` означает censored duration. |

Новые snapshots: выбранный `product_id/package_id/offering_id/subscription_period`, `default_plan`, `trial_eligibility`, `trial_shown`, `price_basis=store_display`; recovery сохраняет исходный billing-контекст. `time_visible_ms` остаётся wall time, `visible_foreground_ms` измеряется отдельно.

`trial_eligibility_observation_version=1` сохраняет raw request/product evidence
отдельно от UI-фильтра; `trial_eligibility_basis` / `trial_eligibility_request_id`
позволяют проверить snapshot. `trial_shown` следует текущим resolved plan days,
не означает SDK eligible или trial start. `paywall_origin_*` сохраняет исходный
local screen/country config, не remote revision; `checkout_origin_*` — input и
selected package отдельно от refreshed native package. Journal/recovery не
заменяют эти origins текущей страной/config и не заполняют отсутствующие поля
старых записей. `context.paywall_observations` / CLI / health дают count-only
request/product/origin диагностику; eligibility callbacks не product return.
Паспорт: [paywall-observations.md](./paywall-observations.md).

Контент: `question_revision`, `explanation_revision`, `bank_revision`, `media_revision`, `content_language`, `explanation_language`. `content_language_basis=selected_text_field` описывает выбранное поле, не языковую детекцию. `content_provenance_version=1` отдельно сохраняет mapper source language/kind и selected-field agreement; old cache, stale revision и failed observation остаются unknown. `choice_source_languages` / `choice_unknown_source_count` не подменяют prompt provenance. Fingerprint `content-v1` — версия аналитического сравнения, не криптографическое доказательство. `media_revision_basis=asset_descriptor` не подтверждает содержимое файла.

`explanation_display_observation_version=1`: `explanation_display_revision` — hash реально показанного значения, отдельно от multilingual `explanation_revision`; `full/free_topic_marked/locked` и `text/empty/locked/not_observed` сохраняются независимо. Locked/empty не являются text exposure. `exam_rules_revision_basis=current_country_config` не подменяет origin старой попытки: `exam_origin_profile_revision` и `exam_session_rules_revision` имеют отдельные persisted bases; `exam_origin_category` берётся из session, не текущей app category. Cache miss/legacy/invalid origin не backfill из текущего config.

`context.content_observations` / health показывают bounded revision/source/display groups и installation/session rule conflicts. `context.repeat_answers` / health связывают actual baseline → explanation/review → next distinct logical answer с `repeat-answer-v1`, семью днями horizon, revision/language/selection controls и censoring. Exam updates не создают новые repeated questions. Fractions разрешены только на mature comparable pairs с coverage/integrity; они не доказывают causal learning effect. Подробный паспорт: [content-observations.md](./content-observations.md).

Critical payload QA: `analytics_payload_contract_version=2`,
`analytics_payload_contract_status`, `analytics_payload_valid`,
`analytics_payload_invalid_keys`; отклонённые значения не копируются в
диагностику. Invalid payload остаётся capturable, не product guard.
`not_defined` не означает проверенный контракт; legacy/v1 rows не становятся
v2-validated. `data_quality.client_payload_validation` отдельно сохраняет
наблюдённые версии, malformed/unsupported annotations и retained-row grain.
Runtime capture counters не являются доказательством доставки SDK.
Паспорт типизации, QA и границ приёмки:
[payload-contracts.md](./payload-contracts.md).

Engine contract 2: merge/dedupe и явный coverage manifest, ordered funnel с сохранением root grain, one-hour paywall conversion и отдельный 24-hour diagnostic funnel. Незрелые views учитываются как censored, не отказ. `learning_d7_return` использует `learning-v1`, не любой product event; TTV показывает achieved и censored observations вместе.

Добавлен отдельный offline RevenueCat ledger: `ingest-revenuecat`, `finance` и
`context.financial`. Он хранит source-reported gross activity, lifecycle/lineage,
refund adjustments, sandbox exclusions и scoped reconciliation. Клиентская цена
не участвует в денежных итогах; incomplete scope не становится exact join.
Producer verification и coverage имеют явный `as_of`, не являются доказанным
production delivery или store proceeds. Формат и приёмка:
[revenuecat-ledger.md](./revenuecat-ledger.md).

`context.billing_learning` / CLI `billing-learning` отдельно связывают
наблюдённые RevenueCat trial/first-positive-charge origins с обучением.
Mapping native/RevenueCat не требует ASA IDs; Plus, price и restore не создают
paid start. `billing-learning-v1` сохраняет nonachievers, elapsed D7/D30,
verified trial-expiry revisions, pre-cancel accepted usage и post-activation
calendar return. Exam `create` добавляет accepted answer; `update` и timeout нет.
Trials, paid starts и несколько lineages могут пересекаться, не unique people.
Legacy client coverage без явного `application_ids` не доказывает нулевое
использование; malformed coverage ограничивает fractions, не падает.
Это не current paid access, revoked access, churn, proceeds или causal lift.
Паспорт и оставшаяся приёмка: [billing-learning.md](./billing-learning.md).

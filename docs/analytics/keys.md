# Ключи аналитики Prawko

Контракт: `mobile/src/analytics/catalog.ts`. Имена не менять между релизами. Ниже — что ключ значит при чтении PostHog / дампа / дашборда.

Как считать людей и чем дашборд отличается от разбора сессий: [README.md](./README.md).

Полная проверка покрытия, длительности, частоты, retention и качества экспорта: [аудит 2 октября 2026](./2026-10-02-instrumentation-audit.md). Предложения новых событий в нём не означают, что они уже отправляются.

---

## Общие свойства продуктовых событий

| Ключ | Значение |
|---|---|
| `app_user_id` | Устойчивый локальный app identity (`usr_…`), не доказанный уникальный человек |
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
| `flow_context` / `onboarding_attempt_id` | `onboarding`, `settings` или `product`; ID наблюдаемого onboarding внутри runtime, не acquisition identity |
| `onboarding_completed` | Текущий persisted флаг, не доказательство первого запуска |
| `access_source` | Наблюдаемый источник Plus: `purchase`, `school`, `other`, `none`. При нескольких источниках purchase имеет приоритет; не серверное подтверждение покупки |
| `question_set_key` / `catalog_source` / `catalog_ready` | Текущий question set, статус catalog store и его resolved-флаг. Ошибка может быть resolved без годного контента |
| `catalog_generation` | Счётчик обновлений каталога внутри runtime, не неизменяемая версия контента |
| `monetization_policy` / `ads_policy_enabled` | Фактические feature flags, не бизнес-результат |
| `timezone` / `utc_offset_minutes` | Часовой пояс устройства и текущий offset; продуктовый день по-прежнему Europe/Warsaw |

Поля схемы 3 добавляются к product capture и SDK screen в общей точке отправки. `identify` является обновлением свойств человека, не продуктовым действием, и этих полей не получает. Текущие store properties читаются в момент capture, не из старого callback.

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

`onboarding_flow_viewed` присваивает `onboarding_attempt_id`, `flow_version=category_schedule_v1`. `start_reason=incomplete_onboarding_observed` не доказывает новую установку; после успешного reset в этом runtime — `progress_reset` с `reset_operation_id`. Settings-маршруты имеют `flow_context=settings` и не создают first-run воронку. При перезапуске runtime onboarding ID новый.

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

| Событие | Значение |
|---|---|
| `paywall_viewed` | Показали Plus. Вход — `source` и, если источник общий, `surface`. `offers_count`, `revenuecat_configured` (API key / SDK для платформы, не «последний fetch успешен»), опционально `hydration_error_code`. `moment` пишется только у старого промпта: `after_exam`, `after_ad`, `app_open`, `manual_test`. У V2 (`training_limit`, `explanation`, `roadmap`, `profile`, …) поля `moment` нет. Не подставлять `profile` вместо отсутствующего `moment`. V2 `source`: `training_limit`, `wrong_answers`, `explanation`, `exam_limit`, `weak_spots`, `smart_reviews`, `trap_questions`, `statistics`, `profile`, `roadmap`, `ai_chat`, `offline_mode`. С круга роадмапа ещё `roadmap_step_id` |
| `paywall_cta_selected` | В обработчик пришло намерение: `action=purchase/retry_purchase/restore`, `paywall_view_id`, snapshot оффера/SDK, `offer_state`, для purchase `package_available`. Не native checkout и не покупка |
| `paywall_checkout_blocked` | Обработчик остановился до checkout. `blocked_reason=checkout_busy/already_entitled/purchase_disabled/not_configured`, тот же view и action. Не `purchase_failed` и не отказ пользователя от оплаты |
| `paywall_offer_load_started` | Начался цикл доступности оффера на этом paywall. `paywall_view_id`, `offer_load_id`, при наличии `offer_request_id`; `load_reason=initial/refresh`, `offer_load_source`, `is_cached`. Не каждый цикл является новым запросом SDK |
| `paywall_offer_ready` | Выбранный пакет реально доступен: product/package/offering, price/currency, число предложений и duration. Есть связанный `offer_load_id`; кеш приложения отмечается `is_cached=true`, `load_duration_ms=0`. Это готовность предложения, не покупка и не утверждение о доступности CTA для уже активного Premium |
| `paywall_offer_failed` | Завершившийся запрос не дал готового оффера или SDK не настроен. `failure_reason`: `request_error`, `empty_offerings`, `not_configured`; `error_code`, структурированная диагностика. Ноль предложений **во время** загрузки не создаёт failed |
| `premium_gate_viewed` | Упёрлись в лимит V2 или открыли премиум-вход, который сразу ведёт на paywall. `source` как у paywall. `surface` есть, когда `source` общий. Не путать с `exam_restart_gate_shown` |
| `premium_gate_action` | `open_paywall` / `watch_ad` / `dismiss` на этом лимите. `surface` как у `premium_gate_viewed` |
| `answer_explanation_viewed` | Полное объяснение у Premium. `access_method`: `premium` |
| `ad_reward_earned` | SDK подтвердил награду. `placement=exam_unlock` даёт кредит экзамена, списание только на `exam_session_started` |
| `paywall_dismissed` | Закрылся экран Plus, не результат оплаты. В новой реализации `dismiss_method`: `close_button` / `navigation` / `access_unlocked`; последнее означает продолжение после активации доступа. `has_plus_access` — доступ в момент закрытия. Исторические `swipe` / `background` остаются в старых дампах; новые события не называют любой выход свайпом и не считают уход в фон закрытием |
| `premium_prompt_shown` | Исторический bottom sheet с оффером Plus. Больше не показывается: ни `app_open`, ни `after_ad` |
| `premium_prompt_clicked` | Исторический CTA того шита. Новые события не пишутся |
| `premium_prompt_dismissed` | Историческое закрытие шита. Новые события не пишутся |
| `paywall_package_selected` | Исторический ключ. Селектора пакетов больше нет: один lifetime, сразу `purchase_started` |
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
| `ad_requested` | Политика разрешила показ |
| `ad_shown` | Показали |
| `ad_dismissed` | Закрыли. `why` = native close reason |
| `ad_skipped` | Не показали. Каждый вызов, включая `trigger_not_ready` |
| `ad_failed` | Политика разрешила, показ сломался |
| `ad_impression_revenue` | Impression-level revenue из Google Mobile Ads paid callback. Суммировать `revenue` по `app_user_id` — ad LTV / install. Не считать из eCPM |

На всех ad-событиях кроме `ad_impression_revenue` строки:

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
- `ad_format` — сейчас `interstitial`
- `ad_network` — winning source (`adSourceName`), иначе adapter class, иначе `unknown`
- `revenue_precision` — `unknown` / `estimated` / `publisher_provided` / `precise`
- `placement` — `after_training` / `training_questions` / `after_exam` / `sign_test` / `other`

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

### Источник Возврата

`app_entry_resolved` содержит `entry_reason=direct/deep_link/notification/unknown`; deep link — только известный route pattern и screen, без URL/query. Resolution может прийти после started, поэтому смотреть оба события по визиту.

External signal внутри уже active приложения может обновить entry context без нового `app_visit_id`. Это не дополнительный возврат пользователя: границу визита определяют visit-события, не число entry-resolved.

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

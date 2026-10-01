# Ключи аналитики Prawko

Контракт: `mobile/src/analytics/catalog.ts`. Имена не менять между релизами. Ниже — что ключ значит при чтении PostHog / дампа / дашборда.

Как считать людей и чем дашборд отличается от разбора сессий: [README.md](./README.md).

---

## Супер-свойства (на каждом событии)

| Ключ | Значение |
|---|---|
| `app_user_id` | Человек / установка (`usr_…`) |
| `app_version` | Версия приложения (`1.0.21`) |
| `auth_mode` | `guest` или `supabase` |
| `category` | Категория прав (`B`, `AM`, …) |
| `exam_country` | Страна экзамена (`PL`, `CZ`, …), не geo |
| `is_plus` | Есть ли Plus |
| `locale` | Язык UI (`pl`, `cs`, `en`, `uk`, `ru`) |
| `platform` | `ios` / `android` |
| `supabase_user_id` | Id аккаунта или `null` |

`source` на разных событиях значит разное (spotlight vs profile vs manual). Смотреть в контексте события.

`exam_country` источники (`exam_country_resolved.source` / смена страны): `device_region`, `storefront`, `default`, `settings`, `legacy_onboarded`, `e2e`.

---

## Экраны (`screen_viewed.screen_name`)

| Ключ | Экран |
|---|---|
| `app_entry` | Старт приложения / сплэш-роутер |
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

Ещё поле: `route_pattern` — шаблон роута Expo, не имя экрана.

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

---

## First start

Spotlight на пустой карточке готовности после онбординга. Слот — до 10 вопросов, режим `initial_diagnostic`.

| Событие | Значение |
|---|---|
| `first_start_shown` | Показали spotlight |
| `first_start_skipped` | Закрыли / отмахнулись |
| `first_start_started` | Начали слот. `source`: `spotlight` или `card` |
| `diagnostic_result_action` | CTA на результате. `action`: обычно `continue` |
| `diagnostic_reminder_shown` | Шит «напомнить заниматься» |
| `diagnostic_reminder_resolved` | Ответ на шит. `action`: включили / `later` / dismiss |

Skip и start у одного человека в разные визиты — нормально. Complete диагностик = дошли до `diagnostic_result_action`, не просто `training_session_started`.

---

## Home contextual

Компактная карточка между индексом готовности и «Швидка сесія». Не дублирует readiness и не трогает дату экзамена. Только returning user (индекс готовности уже не пустой).

Приоритет: `completion` (один раз после возврата) → персональный next action → ничего.

| Событие | Значение |
|---|---|
| `home_contextual_shown` | Показали карточку. `kind`: `completion` / `resume` / `mistakes` / `review` / `weak_topic` |
| `home_contextual_selected` | Тап. Тот же `kind` |

`completion` — короткое пост-действие после тренировки / экзамена / повторения. `shownOnHome` ставится в момент `home_contextual_shown`, поэтому карточка остаётся на текущем визите и не повторяется после фона. На следующем открытии Home её уже нет: либо next action, либо пусто.

---

## Training

| Событие | Значение |
|---|---|
| `training_mode_selected` | Выбрали режим и лимит |
| `training_session_started` | Сессия создана |
| `training_session_resumed` | Продолжили незаконченную |
| `training_question_answered` | Один ответ |
| `training_session_completed` | Дошли до экрана результата |
| `training_session_abandoned` | Ушли, не закончив |
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

Полезные поля: `question_limit`, `question_total`, `question_index`, `topic_id`, `roadmap_step_id`, `is_correct`, `passed`, `score_percent`, `answered_count`, `correct_count`, `media_type` (`video` / `image` / `none`).

`roadmap_step_id` (`PL:0:1`) есть на старте, ответе, завершении, abandon и empty. Без круга роадмапа значение `null`.

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
| `exam_start_requested` | Начали грузить / создавать |
| `exam_session_started` | Сессия есть |
| `exam_session_resumed` | Вернулись в активный экзамен |
| `exam_question_answered` | Ответ в экзамене |
| `exam_session_completed` | Есть счёт. Смотреть `passed` |
| `exam_session_ended` | Вышли после ответа или истекло. `end_reason`, `status` |
| `exam_empty_exit` | Закрыли экзамен до первого ответа. Не брошенный экзамен. `answered_count` 0, `question_total`, `mode` |
| `exam_answers_review_opened` | Открыли разбор |
| `exam_restart_gate_shown` | Модалка «ещё раз» на экране **результата**, только кнопка New attempt |
| `exam_restart_selected` | Ответ на эту модалку. `choice`: `watch_ad`, `upgrade`, `dismiss`, `plus` |

Это **не** лимит экзаменов и **не** гейт на плитке Home/Learn. `openExam()` → `/exam` не смотрит Plus и не показывает модалку. `exam_start_requested source=manual` после Home — обход, не «гейт пропустили». `dismiss` только закрывает модалку, на результате остаются; Close ведёт на Home, оттуда новый экзамен сразу. Текст paywall `1/день` — копирайт, в коде дневного капа нет. После сдачи primary CTA — Home, гейт даже не показывается.

`exam_session_ended.status`: `abandoned` — ответил и вышел; `completed` + `end_reason: learner_finish` — нормальное завершение (иногда дублирует complete). Настоящий mid-exam дроп: `end_reason: user_ended_early`. Пустой выход без ответов — отдельное событие `exam_empty_exit`, не `exam_session_ended`. В дампах до этого билда тот же выход лежит на `exam_session_ended` с `end_reason: miss_click_empty_exit`.

`passed` на complete — сдал / не сдал, не «дошёл до конца». PL обычно 32 вопроса, CZ 25.

---

## Signs

| Событие | Значение |
|---|---|
| `sign_opened` | Карточка знака |
| `sign_search_submitted` | Поиск |
| `sign_test_started` | Старт теста |
| `sign_test_question_answered` | Ответ в тесте |
| `sign_test_ended` | Конец. `outcome`: `completed` / `abandoned` |

Тест можно начать с `signs_home` / категории, минуя `sign_opened`.

---

## Paywall и покупка

| Событие | Значение |
|---|---|
| `paywall_viewed` | Показали Plus. `source`, `offers_count`, `revenuecat_configured` (API key / SDK для платформы, не «последний fetch успешен»), опционально `hydration_error_code`. `moment`: `after_exam` / `premium_prompt` / `profile` / `manual_test`. Monetization V2 добавляет `product_id`, `price`, `currency` и `source`: `training_limit`, `wrong_answers`, `explanation`, `exam_limit`, `weak_spots`, `smart_reviews`, `trap_questions`, `statistics`, `profile`, `roadmap`, `ai_chat`, `offline_mode`. Если несколько экранов делят `source`, есть `surface`. С круга роадмапа ещё `roadmap_step_id` |
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
| `progress_reset_confirmed` | Сброс прогресса |
| `signed_out` | Выход |
| `offline_pack_download_*` / `removed` / `offline_access_blocked` | Офлайн-пак |
| `ai_chat_opened` / `access_blocked` / `message_sent` / `resolved` / `failed` | AI-чат |
| `client_error_logged` | Нормализованная ошибка |
| `client_fallback_used` | Сработал запасной путь продукта |

`client_error_logged`: `area`, `event_name`, `severity` (`warning` / `error`), `error_code`, `error_name`, плюс `step` / `why` / `detail` для ads и RevenueCat. Для медиа ещё `media_key`, `storage_path`, `asset_url`, `media_type`.

Частые `event_name`: `question_media_preview_failed`, `revenuecat_hydration_failed`, `ad_not_shown`, `ad_failed`.

---

## Воронки дашборда

Шаги — unique users с событием в окне, не обязательно подряд.

**Onboarding (экраны / steps).** First-run: category → exam_schedule → Home. Дашборд считает completed по `exam_schedule`, не `notifications`.

**First start.** `first_start_shown` → `first_start_started` → `diagnostic_result_action` → `diagnostic_reminder_shown`. Рядом: skip, reminder resolved. Сплиты: `source`, `action`.

**Roadmap.** `roadmap_step_opened` → `training_session_started` или `premium_gate_viewed` → `paywall_viewed`. Сплиты: `roadmap_step_id`, `surface`, `locked`.

**Training.** `training_mode_selected` → `training_session_started` → `training_session_completed`. Рядом: abandoned, empty. Сплит: `mode`, `roadmap_step_id`.

**Paywall.** `premium_gate_viewed` → `paywall_viewed` → `paywall_offer_ready` → `purchase_started` → `purchase_succeeded`. Для сквозной цепочки связывать ready/start с одним `paywall_view_id`, результат покупки — с `purchase_attempt_id`. Loading и failed анализировать по `offer_load_id`; несколько refresh не увеличивают число показов. Рядом: preparation_failed, pending/outcome_unknown, cancelled, failed, dismissed. Сплиты: фактический `auth_mode`, `source`, `surface`, `roadmap_step_id`; кеш и SDK-запросы раздельно. `paywall_package_selected` больше не шлётся. Старые версии не пишут ready — не включать их в обязательную пятиступенчатую воронку.

**Restore.** Попытки — только `purchase_restore_started`, доступ восстановлен/подтверждён — только `purchase_restore_succeeded`; в новой версии дополнительно `entitlement_active=true`, `restore_outcome=restored`. Empty и failed отдельно. Не прибавлять legacy `restore_*`: это дубли того же запроса, а не дополнительные попытки/покупки. В attempt-метрике дедуп по `restore_attempt_id`, в user-метрике по `app_user_id ?? distinct_id`. Для старых событий без новых полей использовать канонический event name, не отбрасывать их лишь из-за отсутствия `restore_outcome`. Сам по себе restore не доказывает новую выручку или новое платёжное приобретение.

**Exam.** `exam_start_requested` → `exam_session_started` → `exam_session_completed`. Рядом: ended (ответил и вышел), `exam_empty_exit` (закрыл до ответа, не abandon), restart **modal on result** (не кап Home). Сплит: `passed`.

**Ads.** `ad_requested` → `ad_shown` → `ad_dismissed`. Рядом: skipped, failed, `ad_impression_revenue`. Сплиты: `after`, `should_show`, `why`, `step`, revenue `placement` / `ad_network`. Ad LTV: `sum(revenue)` / unique `app_user_id` на `ad_impression_revenue`.

**Signs.** `sign_opened` → `sign_test_started` → `sign_test_ended`. Рядом: search. Тест без `sign_opened` — нормально, воронка тогда занижает старт.

---

## SDK, не каталог

| Событие | Значение |
|---|---|
| `Application Installed` | Первая установка этого билда |
| `Application Opened` | Процесс открыли |
| `Application Became Active` | Вернулись из фона |
| `Application Backgrounded` | Ушли в фон / свернули |
| `$set` | Обновили person properties |

Для «последнего экрана перед уходом» брать последний `screen_viewed` до `Application Backgrounded`, не сам Backgrounded.

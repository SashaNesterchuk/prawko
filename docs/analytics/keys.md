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

Полезные поля: `question_limit`, `question_total`, `question_index`, `topic_id`, `is_correct`, `passed`, `score_percent`, `answered_count`, `correct_count`, `media_type` (`video` / `image` / `none`).

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
| `paywall_viewed` | Показали Plus. `source`, `offers_count`, `revenuecat_configured` (API key / SDK для платформы, не «последний fetch успешен»), опционально `hydration_error_code`. `moment`: `after_exam` / `premium_prompt` / `profile` / `manual_test` |
| `paywall_dismissed` | Закрыли Plus без покупки. `dismiss_method`: `close_button` / `swipe` / `background`. `background` уходит при уходе приложения в фон; если экран ещё открыт после возврата, следующий выход пишется своим методом |
| `premium_prompt_shown` | Bottom sheet с оффером Plus. `moment`: `app_open` / `after_ad` / `manual_test`. `app_open` — returning Home, считает session-limit 2/session. `after_ad` — нечётные закрытые interstitial (1, 3, 5…), cap 2 не действует, пауза 2 минуты между фактическими показами |
| `premium_prompt_clicked` | CTA тизера открыл paywall |
| `premium_prompt_dismissed` | Тизер закрыли без CTA. `dismiss_method`: `close_button` / `swipe` / `outside_tap` |
| `paywall_package_selected` | Исторический ключ. Селектора пакетов больше нет: один lifetime, сразу `purchase_started` |
| `purchase_started` | Нативный checkout |
| `purchase_succeeded` | Доступ выдан |
| `purchase_cancelled` | Отмена стора |
| `purchase_failed` | Фейл стора. `step`, `why` |
| `purchase_restore_started` | Restore |
| `purchase_restore_succeeded` | Restore дал доступ |
| `purchase_restore_empty` | Restore ничего не нашёл |
| `purchase_restore_failed` | Restore сломался. `step`, `why` |
| `customer_center_opened` | RevenueCat customer center |

Пустой paywall: `revenuecat_configured: false` или `offers_count: 0`.

`client_error_logged` для RevenueCat: `area=revenuecat` (hydrate / offerings / subscribe / attributes) или `monetization` / `payments` (покупка). Поля `step`, `why`, `kind`, `detail`. `message` в PostHog не уходит.

Частые `event_name`: `revenuecat_hydration_failed`, `revenuecat_offerings_failed`, `revenuecat_subscribe_failed`, `revenuecat_attributes_failed`, `revenuecat_listener_failed`, `purchase_failed`.

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

**Training.** `training_mode_selected` → `training_session_started` → `training_session_completed`. Рядом: abandoned, empty. Сплит: `mode`.

**Exam.** `exam_start_requested` → `exam_session_started` → `exam_session_completed`. Рядом: ended (ответил и вышел), `exam_empty_exit` (закрыл до ответа, не abandon), restart **modal on result** (не кап Home). Сплит: `passed`.

**Paywall.** `paywall_viewed` → `purchase_started` → `purchase_succeeded`. Рядом: cancelled, failed. Сплиты: `source`, `step`, `why`. `paywall_package_selected` больше не шлётся.

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

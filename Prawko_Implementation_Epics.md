# Prawko — план реализации по эпикам

Связанный анализ: [Prawko_IA_Analysis.md](/home/lastday/prawko/Prawko_IA_Analysis.md)
Media audit: [Prawko_Media_Audit.md](/home/lastday/prawko/Prawko_Media_Audit.md)

## 1. Цель первого билда

Первый билд не должен пытаться стать "полным конкурентом IMAGE".

Цель первого билда:

1. решить 4 реальные боли основателя:
   - вопросы повторяются слишком хаотично
   - сложные и ошибочные вопросы сложно перепроходить
   - нет плана подготовки по дням
   - приходится идти в ChatGPT за объяснением
2. дать понятный `Study Plan` на 7–30 дней
3. дать сильный mobile-first опыт для UA / BY / EN / PL пользователей
4. подготовить базу для B2C-продажи и для пилота с автошколами

## 2. Базовые принципы

1. Переиспользуем `библиотеки и технологические решения`, а не domain-код из других проектов.
2. `Mobile` — основное ядро продукта.
3. `Web` в v1 не должен дублировать весь mobile flow.
4. `Supabase` — source of truth для данных, прогресса, AI-логов и school access.
5. `AI` работает только через серверный слой или Supabase Edge Functions. Ключи никогда не уходят в mobile.
6. `Study Plan` в v1 должен быть `rule-based`, а не AI-native. AI нужен для объяснений и chat, не для базовой оркестрации плана.
7. Все, что не критично для first proof of demand, режется.

## 3. Что переиспользовать из существующего стека

Источники:

1. [jar/package.json](/home/lastday/projects/jar/package.json)
2. [jar-dashboard/package.json](/home/lastday/projects/jar-dashboard/package.json)
3. [jar-supabase/package.json](/home/lastday/projects/jar-supabase/package.json)

### Mobile stack из `jar`

Использовать:

1. `expo`
2. `expo-router`
3. `@supabase/supabase-js`
4. `i18next`
5. `react-i18next`
6. `expo-localization`
7. `react-native-mmkv`
8. `expo-secure-store`
9. `zustand`
10. `@gorhom/bottom-sheet`
11. `react-native-markdown-display`
12. `posthog-react-native`
13. `react-native-purchases`
14. `expo-notifications`
15. `react-native-toast-message`

Не тянуть в v1 без необходимости:

1. `WatermelonDB`
2. `Skia`
3. `Rive`
4. сложные widget-таргеты
5. audio / voice / editor-heavy dependencies

### Web stack из `jar-dashboard`

Использовать:

1. `next`
2. `@supabase/supabase-js`
3. `zod`
4. `sonner`
5. `class-variance-authority`
6. `clsx`
7. `tailwind-merge`
8. `@radix-ui/react-*`
9. `recharts`
10. `openai` только на серверной стороне, если web будет проксировать AI

### Backend / infra из `jar-supabase`

Использовать:

1. `supabase` CLI
2. migrations-first подход
3. `supabase/functions`
4. shared helper pattern для AI provider adapter
5. Supabase Storage для media

Не переиспользовать как есть:

1. старую схему БД
2. app-specific edge functions
3. old auth logic

## 4. Что входит в P0 за месяц

### Входит

1. onboarding
2. auth
3. language selection
4. category B only
5. study plan setup
6. today screen
7. learning mode
8. difficult / wrong / unseen question replay
9. AI explanation
10. AI question chat
11. exam simulator
12. saved questions
13. history
14. basic paywall
15. school code redemption
16. simple web presence
17. simple internal/admin web

### Не входит

1. category A / C / D
2. full B2B analytics dashboard
3. slot monitoring for WORD
4. advanced SEO system
5. advanced push personalization
6. full web student learning platform
7. deep gamification
8. manual content CMS
9. full offline media pack on device
10. real-time video transcoding on the server
11. PJM autoplay in the default v1 study flow

## 5. Рекомендуемая структура проекта

Если делать с нуля, лучше сразу закладывать понятное разделение:

1. `/mobile` — Expo / React Native app
2. `/web` — Next.js public site + simple admin
3. `/supabase` — migrations, seed, storage policies, functions
4. `/packages/schemas` — shared zod / ts types for contracts
5. `/packages/config` — shared env typing, constants, topic ids, locales

Если репозитории остаются раздельными, сохранить ту же логическую структуру, только физически в отдельных проектах.

## 6. Порядок реализации

1. Epic 0 — foundation and environments
2. Epic 1 — official data pipeline
3. Epic 1A — media processing, encoding, and delivery
4. Epic 2 — Supabase schema and auth
5. Epic 3 — mobile shell
6. Epic 4 — onboarding and study plan setup
7. Epic 5 — question engine and learning mode
8. Epic 6 — AI layer
9. Epic 7 — exam simulator
10. Epic 8 — review loops and adaptive queues
11. Epic 9 — today plan and readiness
12. Epic 10 — paywall and school access
13. Epic 11 — web app
14. Epic 12 — analytics, QA, release

---

## Epic 0 — Foundation And Environments

### Цель

Поднять минимальный рабочий каркас для mobile, web и supabase без доменных фич.

### Что сделать шаг за шагом

1. Создать Expo app на `expo-router`.
2. Создать Next.js app для web.
3. Инициализировать `supabase/` с CLI, migrations и functions.
4. Добавить общую стратегию env-переменных:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` или `ANTHROPIC_API_KEY`
   - `POSTHOG_KEY`
   - `REVENUECAT_*`
5. Подключить TypeScript и базовый linting.
6. Подключить shared constants:
   - locales
   - categories
   - exam rules
   - topic block ids
7. Настроить базовые команды:
   - mobile dev
   - web dev
   - supabase start / reset / migrate

### Что использовать

1. Из `jar`: `expo`, `expo-router`, `typescript`
2. Из `jar-dashboard`: `next`, `typescript`
3. Из `jar-supabase`: `supabase` CLI

### Чеклист

1. Mobile стартует локально без domain-кода.
2. Web стартует локально.
3. Все env-переменные описаны в `.env.example`.
4. Есть единый README по запуску.

---

## Epic 1 — Official Question Data Pipeline

### Цель

Подготовить надежный импорт вопросов, переводов и media так, чтобы база обновлялась скриптом, а не вручную.

### Что сделать шаг за шагом

1. Скачать и зафиксировать официальный XLSX и raw media archive в отдельную сырьевую папку.
2. Написать ingestion script:
   - parse XLSX
   - normalize rows
   - map answer type
   - map points
   - map scope: `base` / `specialist`
   - map category tags
3. Собрать topic blocks:
   - signs
   - intersections
   - overtaking
   - pedestrians
   - first_aid
   - priority
   - safety
   - technical
4. Добавить derived fields:
   - `question_source_id`
   - `topic_block`
   - `difficulty_seed`
   - `has_media`
5. Подготовить `questions` seed file.
6. Подготовить `raw media manifest`:
   - original media ref from XLSX
   - normalized file name
   - source kind: `image` / `video` / `pjm_question` / `pjm_answer`
   - unresolved ref or matched source path
7. Подготовить handoff в `Epic 1A`:
   - stable media keys
   - alias map for renamed files
   - normalized output for delivery manifest
8. Проверить связность:
   - каждый вопрос указывает на source media ref или null
   - ответы валидны
   - points валидны

### Важное продуктовое правило

Сразу добавить поля для founder pains:

1. `times_seen`
2. `times_correct`
3. `times_wrong`
4. `is_hard_for_user`
5. `last_seen_at`

Это не часть импорта, но модель должна под это готовиться уже сейчас.

### Чеклист

1. Количество импортированных вопросов совпадает с источником.
2. Все вопросы category B корректно отфильтрованы.
3. Нет битых source media refs после normalization и alias map.
4. Скрипт можно запускать повторно без ручной чистки.
5. Есть `diff-friendly` output для обновлений базы.

---

## Epic 1A — Media Processing, Encoding, And Delivery

### Цель

Преобразовать официальный raw media archive в delivery-ready assets для mobile и web, не завязывая клиент на `WMV` и не делая real-time transcoding.

### Что уже известно по source data

1. На текущей машине raw archive лежит в `/media/lastday/89f27200-2a2b-467f-977b-806a443d4726/prawko-media`.
2. Общий объем source data около `20G`.
3. В архиве есть `3083` `wmv`, `1542` `jpg`, `2` `jpeg` и `1` `xlsx`.
4. Основной media bank занимает около `9.08G`, PJM-трек около `10.67G`.
5. Отдельные raw videos доходят почти до `87 MB`, поэтому клиент не должен получать исходные файлы напрямую.
6. XLSX содержит не только primary media column `Media`, но и отдельные PJM columns для текста вопроса и вариантов ответов.

### Что сделать шаг за шагом

1. Зафиксировать source manifest:
   - original path
   - original filename
   - extension
   - file size
   - asset kind
2. Реализовать filename normalization:
   - Unicode normalization
   - case-insensitive matching
   - alias map for renamed assets
3. Разделить media manifest на 3 дорожки:
   - primary exam media
   - PJM question media
   - PJM answer media
4. Построить offline media build pipeline:
   - `wmv -> mp4`
   - poster generation for every video
   - image normalization and optional resize if originals слишком тяжелые
5. Загрузить в Supabase Storage только delivery assets:
   - `question-images`
   - `question-videos`
   - `question-posters`
   - `question-pjm` как отдельный namespace или bucket
6. Сгенерировать final delivery manifest:
   - `media_key`
   - `storage_path`
   - `poster_path`
   - `asset_type`
   - optional `pjm_track`
7. Привязать delivery manifest к импорту вопросов так, чтобы клиент получал уже готовые `storage paths`, а не сырой filename из XLSX.
8. Подготовить verification script:
   - every referenced asset exists
   - every video has poster
   - no client-facing `wmv` URLs
9. Подготовить rerunnable command для пересборки после нового official dump.

### Архитектурные решения

1. Raw folder — это только source archive для импорта и пересборки, не production hosting.
2. `WMV` нельзя отдавать клиенту как есть.
3. Transcoding нельзя делать в real time по запросу пользователя.
4. Mobile и web должны забирать готовые assets из object storage/CDN поверх Supabase Storage.
5. В v1 не нужно скачивать весь media bank на устройство.
6. Клиент загружает asset on demand:
   - current image instantly
   - current video as streaming `mp4`
   - poster immediately
   - optional preload only for the next asset
7. PJM-трек нужно хранить и манифестить отдельно от core flow:
   - не автозагружать его в обычной учебной сессии
   - подключать как accessibility layer или отдельный режим позже

### Чеклист

1. Все ссылки из XLSX резолвятся напрямую или через alias map.
2. На клиент не уходит ни один raw `wmv`.
3. У каждого delivery video есть `mp4` и poster.
4. Category B manifest собран полностью.
5. Heavy videos не блокируют question flow и стартуют через poster fallback.
6. Media build pipeline можно прогнать повторно без ручной расклейки файлов.

---

## Epic 2 — Supabase Schema, Auth, Storage, RLS

### Цель

Собрать стабильный backend-контур для user data, study plan, progress, AI и school access.

### Минимальные таблицы

1. `profiles`
2. `questions`
3. `question_attempts`
4. `question_user_state`
5. `study_plans`
6. `study_plan_days`
7. `study_plan_tasks`
8. `exam_sessions`
9. `exam_session_answers`
10. `bookmarks`
11. `ai_messages`
12. `school_codes`
13. `school_memberships`
14. `feature_entitlements`

### Что сделать шаг за шагом

1. Создать migration для `profiles`.
2. Создать migration для `questions`.
3. Создать migration для user progress tables.
4. Создать migration для exam tables.
5. Создать migration для bookmarks.
6. Создать migration для AI logs.
7. Создать migration для school codes and memberships.
8. Настроить Storage buckets:
   - `question-images`
   - `question-videos`
   - `question-posters`
   - `question-pjm` при включении отдельного accessibility track
9. Настроить Auth:
   - email magic link
   - Google sign-in
   - Apple sign-in как отдельный mobile task, если успевает
10. Написать RLS policies:
   - user видит только свои attempts, plans, bookmarks, chats
   - публично доступны только `questions`, если это нужно клиенту
   - school tables закрыты по ролям
11. Добавить SQL views или RPC для:
   - weak spots summary
   - readiness summary
   - today tasks

### Архитектурное решение

Для скорости v1 лучше использовать `denormalized question model`:

1. `question_pl`
2. `question_ua`
3. `question_en`
4. `explanation_pl`
5. `explanation_ua`
6. `explanation_en`

Это быстрее, чем сразу строить отдельную таблицу переводов.

### Чеклист

1. Пользователь не видит чужой прогресс.
2. Новый user может пройти onboarding и сохранить план.
3. School code можно применить ровно по ожидаемому правилу.
4. Все migrations поднимаются с нуля на чистой базе.
5. Storage policies не открывают приватные данные.

---

## Epic 3 — Mobile Shell

### Цель

Собрать базовую мобильную оболочку, на которую лягут все режимы.

### Что сделать шаг за шагом

1. Настроить `expo-router`.
2. Добавить providers:
   - session
   - user
   - theme
   - analytics
3. Настроить `Supabase client` в mobile.
4. Настроить secure persistence:
   - session token
   - locale
   - chosen category
   - onboarding state
5. Подключить i18n:
   - PL
   - UA
   - EN
6. Подключить MMKV или другой быстрый local state cache.
7. Поднять app navigation:
   - onboarding stack
   - main tabs
   - modal stack
8. Настроить reusable screen shell:
   - header
   - safe area
   - bottom action bar
   - empty / error / loading states
9. Подключить toast layer.

### Что использовать

1. Из `jar`: `expo-router`, `@supabase/supabase-js`, `react-native-mmkv`, `expo-secure-store`, `zustand`, `react-native-toast-message`

### Чеклист

1. Пользователь может открыть app и пройти в табы через mock session.
2. Locale сохраняется между перезапусками.
3. Navigation tree не ломается при cold start.
4. Есть единые loading / error компоненты.
5. Session persist работает на iOS и Android.

---

## Epic 4 — Onboarding And Study Plan Setup

### Цель

Сделать onboarding, который не просто знакомит, а создает первый `Study Plan`.

### Экраны

1. language
2. category
3. exam intro
4. exam date / days
5. minutes per day
6. level: first time / repeater / already studied
7. school code optional
8. auth / start
9. plan preview

### Что сделать шаг за шагом

1. Реализовать language selection.
2. Реализовать category selection, но в UI оставить Category B as default and only active.
3. Добавить step `Когда экзамен?`
4. Добавить step `Сколько минут в день готов учить?`
5. Добавить step `Какой у тебя уровень?`
6. Добавить optional `school code`.
7. После onboarding создать `study_plans` запись.
8. Сгенерировать первые `study_plan_days` и `study_plan_tasks`.
9. Показать `Plan Preview`.

### Важное продуктовое правило

Первая версия плана должна быть `детерминированной`.

Пример rules:

1. если до экзамена 7 дней, увеличиваем долю exam + weak spots
2. если 14–21 день, даем тематическое обучение + mini tests
3. если пользователь repeater, стартуем с diagnostic mini test
4. если минут мало, строим `minimum viable day`

### Чеклист

1. Onboarding можно прервать и продолжить.
2. План создается для 7, 14 и 30 дней без ошибок.
3. Optional school code не блокирует flow.
4. После первого входа пользователь видит `Plan Preview`, а не пустую главную.
5. Все onboarding ответы сохраняются в `profiles` и `study_plans`.

---

## Epic 5 — Question Engine And Learning Mode

### Цель

Построить главный контур обучения, который исправляет хаотичность текущих приложений.

### Основные экраны

1. topic blocks
2. question screen
3. answer feedback
4. end of block summary

### Что сделать шаг за шагом

1. Реализовать список topic blocks.
2. Реализовать прогресс по каждому блоку.
3. Построить shared `question screen`.
4. Поддержать answer types:
   - true / false
   - A / B / C
5. Поддержать media:
   - image
   - video
   - poster-first loading for video
   - streamed `mp4` instead of raw source files
   - preload only current and next asset, not the whole bank
6. После ответа сразу сохранять attempt.
7. Обновлять `question_user_state`.
8. Добавить language toggle на вопросе:
   - app language остается прежним
   - меняется только display question text
9. Добавить actions:
   - bookmark
   - mark as hard
   - ask AI
10. Сделать несколько режимов выдачи:
   - unseen first
   - wrong first
   - hard first
   - block ordered

### Главная логика

Нельзя строить выдачу как "просто random".

В engine должны быть отдельные query strategies:

1. `unseen_questions`
2. `wrong_questions`
3. `hard_questions`
4. `review_due_questions`
5. `topic_block_questions`

### Чеклист

1. Вопросы не повторяются бессмысленно в одной короткой сессии.
2. Пользователь может перепроходить уже отвеченные вопросы.
3. Есть явный способ дойти до сложных и ошибочных вопросов.
4. Question state обновляется корректно после каждого ответа.
5. Media работает стабильно в learning mode.
6. Heavy video не блокирует экран: есть poster fallback и ожидаемое время старта.

---

## Epic 6 — AI Layer

### Цель

Убрать сценарий `скриншот -> ChatGPT`, встроив explanation и chat прямо в продукт.

### Что должно быть в v1

1. pre-generated explanation per question
2. live AI question chat
3. provider-agnostic AI hook

### Что сделать шаг за шагом

1. Ввести `AI adapter` интерфейс:
   - `generateQuestionExplanation`
   - `chatOnQuestion`
2. Сделать первую реализацию через `OpenAI` или `Claude`.
3. Разместить provider access только в:
   - Supabase Edge Functions
   - или серверных Next.js routes
4. Сделать edge function для question chat.
5. Передавать в AI только нужный контекст:
   - question text
   - answer options
   - correct answer
   - user locale
   - optional user message
6. Сохранять AI chat messages в БД.
7. Добавить rate limit:
   - free
   - premium
   - school seat
8. Сделать graceful fallback:
   - если live AI down, показываем pre-generated explanation

### Важное архитектурное правило

`Study Plan` не должен зависеть от AI availability.

AI в v1 нужен для:

1. объяснения ответа
2. follow-up chat

AI не нужен в v1 для:

1. генерации core plan
2. выбора каждого следующего вопроса
3. readiness score

### Что использовать

1. Из `jar-supabase`: паттерн `supabase/functions` и shared helper for provider logic
2. Из `jar-dashboard`: `openai` package only server-side
3. Из `jar`: bottom sheet UI for chat entry point

### Чеклист

1. API keys не видны на клиенте.
2. Один и тот же mobile hook может работать с OpenAI или Claude adapter.
3. AI chat корректно логируется.
4. При ошибке AI user не теряет question flow.
5. Ограничения по бесплатному тарифу реально enforced.

---

## Epic 7 — Exam Simulator

### Цель

Сделать режим, максимально близкий к реальному WORD exam.

### Экраны

1. exam intro
2. exam question flow
3. exam result
4. review wrong answers

### Что сделать шаг за шагом

1. Собрать exam generator:
   - 20 base
   - 12 specialist
2. Добавить timer на 25 минут.
3. Заблокировать возврат к предыдущим вопросам.
4. Ограничить поведение видео под официальный сценарий.
   - использовать delivery `mp4`, а не source `wmv`
   - не давать back navigation
   - не пытаться скачать весь exam media bank заранее
5. Сохранять `exam_session`.
6. Сохранять `exam_session_answers`.
7. Считать score.
8. Показывать pass / fail.
9. Давать review wrong answers после завершения.

### Важное продуктовое правило

Exam simulator должен использоваться не только как тест, но и как вход в follow-up:

1. wrong answers -> weak spots
2. wrong answers -> bookmarks
3. wrong answers -> Ask AI

### Чеклист

1. Распределение вопросов соответствует правилам экзамена.
2. Таймер работает стабильно даже после background / resume.
3. Нельзя вернуться к предыдущему вопросу.
4. Результат и score совпадают с ответами.
5. Сессия сохраняется в history.
6. Видео в simulator стартует через delivery pipeline и не ломает exam flow на тяжелых файлах.

---

## Epic 8 — Review Loops And Adaptive Queues

### Цель

Сделать сильную post-answer механику, чтобы продукт не превращался в тупой список тестов.

### Режимы

1. weak spots
2. hard questions
3. saved questions
4. wrong answer review
5. seen-but-not-mastered

### Что сделать шаг за шагом

1. Ввести user state machine для вопроса:
   - unseen
   - seen
   - correct_once
   - wrong_recently
   - hard
   - mastered
2. Ввести `review_due_at`.
3. Построить очередь `weak spots`.
4. Сделать экран saved questions.
5. Сделать mini exam on saved questions.
6. Сделать wrong answers review after exam.
7. Добавить простую spaced repetition logic.

### Базовые правила очереди

1. wrong_recently идет выше correct_once
2. hard идет выше random unseen when user explicitly opens hard mode
3. mastered не должен лезть в каждую короткую сессию
4. review_due вопросы должны попадать в day plan

### Чеклист

1. Пользователь всегда может найти свои ошибки.
2. Saved mode работает как отдельная useful queue.
3. Hard mode не дублирует weak spots один в один.
4. Review_due действительно влияет на очередность.
5. После нескольких верных ответов вопрос уходит из навязчивого повтора.

---

## Epic 9 — Today Plan, Home, Readiness, Plan Adjust

### Цель

Сделать `Главную` экраном ежедневного пути, а не просто сводкой статистики.

### Экраны

1. today screen
2. daily task detail
3. readiness summary
4. plan adjust

### Что сделать шаг за шагом

1. Показать на главной:
   - days until exam
   - today goal
   - progress of the day
   - minimum 10-minute mode
2. Подтянуть `today tasks` из `study_plan_tasks`.
3. Реализовать task types:
   - learn topic block
   - review weak spots
   - mini test
   - full exam
4. После завершения task обновлять daily progress.
5. Добавить `Readiness score`.
6. Добавить `Plan Adjust` при:
   - skipped day
   - changed exam date
   - user wants faster pace

### Важное решение

`Readiness score` в v1 должен быть простым и объяснимым.

Например:

1. accuracy weight
2. weak spots unresolved count
3. recent exam simulator score
4. completed planned days ratio

Не делать black-box AI score в первой версии.

### Чеклист

1. Главная всегда показывает конкретное действие на сегодня.
2. Если пользователь пропустил день, план не ломается.
3. Minimum 10-minute mode реально запускается быстро.
4. Readiness score пересчитывается после ключевых событий.
5. Plan adjust меняет будущие задачи, а не только UI copy.

---

## Epic 10 — Paywall And School Access

### Цель

Поддержать оба канала монетизации:

1. direct user purchase
2. school-provided access code

### Что сделать шаг за шагом

1. Подключить RevenueCat в mobile.
2. Настроить free tier.
3. Настроить premium offering:
   - monthly
   - sprint package
4. Определить ограничения free tier:
   - N questions/day
   - AI limits
   - no unlimited simulator
5. Реализовать school code activation.
6. При успешном коде выдавать entitlement.
7. Развести paywall logic и school entitlement logic.
8. Добавить purchase and entitlement analytics.

### Важное продуктовое решение

Для этой категории лучше сразу проверить не только подписку, но и `exam sprint offer`.

Например:

1. `14-day sprint`
2. `30-day premium`
3. school access

### Чеклист

1. Free user упирается в понятные ограничения.
2. Premium entitlement открывает нужные функции.
3. School code entitlement обходит paywall корректно.
4. Purchase restore работает.
5. Аналитика фиксирует просмотр paywall и purchase outcome.

---

## Epic 11 — Web App

### Цель

Не строить второй полноценный продукт, а сделать web-слой, который помогает продажам, support и простому admin workflow.

### Что должно быть в v1

1. public landing
2. pricing
3. faq
4. how it works
5. school page
6. support / contact
7. legal pages
8. simple admin area

### Public web — что сделать шаг за шагом

1. Собрать landing с value proposition around `Study Plan`.
2. Добавить pricing page.
3. Добавить page for schools.
4. Добавить FAQ:
   - language support
   - how exam works
   - what is included
   - how school access works
5. Добавить deep links:
   - app store
   - google play
   - school inquiry

### Admin web — что сделать шаг за шагом

1. Добавить простой auth for admin.
2. Сделать страницу users summary.
3. Сделать страницу school codes.
4. Сделать страницу question import status.
5. Сделать страницу AI errors / AI logs.
6. Сделать страницу manual explanation review queue.

### Что использовать

1. Из `jar-dashboard`: `next`, `@radix-ui/react-*`, `zod`, `sonner`, `recharts`, `class-variance-authority`, `tailwind-merge`

### Важное ограничение

Не делать в v1 полный learning flow на web, если он забирает фокус у mobile.

### Чеклист

1. Landing нормально выглядит на mobile и desktop.
2. Есть четкий CTA в app.
3. Admin защищен и не индексируется.
4. School code management работает из web.
5. Support и legal pages опубликованы.

---

## Epic 12 — Analytics, QA, Release

### Цель

Подготовить продукт к реальному использованию и к первым школам, а не просто к локальному demo.

### Что сделать шаг за шагом

1. Подключить PostHog.
2. Описать ключевые event names:
   - onboarding_started
   - onboarding_completed
   - plan_created
   - today_task_started
   - today_task_completed
   - question_answered
   - ai_chat_opened
   - ai_chat_message_sent
   - exam_started
   - exam_completed
   - paywall_viewed
   - purchase_completed
   - school_code_redeemed
3. Сделать crash/error logging.
4. Собрать basic QA checklist:
   - onboarding
   - auth
   - question flow
   - exam flow
   - paywall
   - AI fallback
5. Прогнать ручное тестирование на:
   - iOS
   - Android
   - web
6. Подготовить TestFlight / internal testing.
7. Подготовить data refresh process.

### Важные KPI для первой версии

1. onboarding completion
2. plan creation rate
3. day-1 task completion
4. first exam simulator completion
5. AI usage rate
6. paywall conversion
7. school code redemption rate

### Чеклист

1. Все ключевые user flows трекаются.
2. Ошибки логируются и видны команде.
3. Есть release checklist перед beta.
4. Есть сценарий refresh базы вопросов.
5. Есть fallback, если AI или payments временно недоступны.

---

## 7. Рекомендованный месячный план

### Week 1

1. Epic 0
2. Epic 1
3. Epic 1A
4. Epic 2
5. часть Epic 3

### Week 2

1. закончить Epic 3
2. Epic 4
3. Epic 5

### Week 3

1. Epic 6
2. Epic 7
3. часть Epic 8

### Week 4

1. закончить Epic 8
2. Epic 9
3. Epic 10
4. минимальный Epic 11
5. Epic 12

## 8. Что можно урезать, если срок жмет

Резать в таком порядке:

1. advanced admin web
2. Apple sign-in
3. detailed readiness analytics
4. saved mini exam
5. complex school management
6. push notifications

Не резать:

1. question engine
2. wrong/hard replay
3. study plan setup
4. AI explanation
5. exam simulator
6. school code entry

## 9. Итог

Если делать этот проект прагматично, то first winning wedge выглядит так:

1. mobile app на Expo
2. backend на Supabase
3. AI как отдельный provider layer
4. public/admin web на Next.js
5. главный promise: `скажи, когда экзамен, и получи понятный план + объяснения сложных вопросов`

Это уже достаточно сильный продукт для первого месяца, если не расползаться в side-features и не пытаться построить второй IMAGE целиком.

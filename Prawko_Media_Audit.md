# Prawko — Media Audit

## 1. Source structure

Текущий source archive лежит в `/media/lastday/89f27200-2a2b-467f-977b-806a443d4726/prawko-media`.

Что внутри:

1. `katalog_dla_kandydatów_na_kierowców_2026.xlsx`
2. `multimedia_do_pytan/multimedia do pytań` — основной media bank
3. `Multimedia_do_pytań_-_cz_2_02042026/cz. 2` — дополнительный media pack
4. `pytania_egzaminacyjne_na_prawo_jazdy_tlumaczenia_migowe_12_2025/...` — PJM media bank

Текущий объем:

1. весь archive: около `20G`
2. основной media bank: около `9.08G`
3. дополнительная часть: около `0.03G`
4. PJM bank: около `10.67G`

По типам файлов:

1. `3083` `wmv`
2. `1542` `jpg`
3. `2` `jpeg`
4. `1` `xlsx`

Важно:

1. отдельные raw videos доходят почти до `87 MB`
2. наверху лежат отдельные `PJ1.jpg` и `PJ2.jpg`, кроме основных подпапок
3. по именам файлов уже видны Unicode-символы, пробелы и разный регистр, значит matching нельзя делать наивно

## 2. Как media связано с вопросами

В `xlsx` есть минимум три вида ссылок:

1. `Media` — основной media asset вопроса
2. `Nazwa media tłumaczenie migowe (PJM) treść pyt` — PJM video для текста вопроса
3. `Nazwa media tłumaczenie migowe (PJM) treść odp A/B/C` — PJM video для вариантов ответа

Практический вывод:

1. это не один media stream, а минимум `primary` и `pjm`
2. `PJM` нужно вести как отдельную дорожку в manifest и delivery
3. вопрос должен ссылаться не на "файл как в XLSX", а на нормализованный `media_key`

## 3. Что видно по ссылочной целостности

По локальной проверке:

1. primary refs: `2986 total`, `2638 unique`
2. PJM question refs: `1120 total`, `1120 unique`
3. PJM answer refs: `819 total`, `819 unique`
4. у primary refs было `4` missing до normalization/alias resolution

Что это значит:

1. matching должен поддерживать Unicode normalization
2. matching должен быть case-insensitive
3. нужен `alias map` для renamed или superseded assets
4. unresolved refs должны попадать в явный diagnostic report, а не теряться

## 4. Что делать с тяжелой media

Правильный подход для v1:

1. raw archive оставить как source-only слой
2. `wmv` offline перекодировать в delivery `mp4`
3. для каждого video генерировать poster
4. images нормализовать по именам и при необходимости ресайзить для mobile
5. в клиент отдавать только готовые delivery assets

Неправильный подход:

1. отдавать raw `wmv` напрямую в mobile
2. делать transcoding по запросу пользователя
3. пытаться скачать весь банк media в приложение заранее

## 5. Откуда клиент должен скачивать media

Не из raw-папки и не из локального диска разработчика.

Production delivery должен быть таким:

1. raw archive -> local/offline import pipeline
2. build pipeline -> normalized manifest + encoded assets
3. encoded assets -> Supabase Storage
4. mobile/web -> object storage/CDN URLs из delivery manifest

Итог:

1. source media живет отдельно
2. клиент качает только delivery assets
3. storage path должен храниться в вопросе или в media manifest, а не вычисляться на клиенте

## 6. Нужно ли показывать video в real time

Нужно разделять две вещи:

1. `real-time playback`
2. `real-time transcoding`

Что делать:

1. playback в real time нужен: пользователь открывает вопрос и сразу начинает получать video как потоковый `mp4`
2. transcoding в real time не нужен: это дорого, медленно и рискованно для exam flow

Практическое правило:

1. question opens
2. poster показывается сразу
3. готовый `mp4` подгружается on demand
4. при необходимости прелоадится только следующий asset

## 7. Как это встраивается в roadmap

1. `Epic 1` — разобрать XLSX и собрать raw media manifest
2. `Epic 1A` — media processing, encoding, poster generation, delivery manifest
3. `Epic 2` — storage buckets и policies
4. `Epic 5` — question player с poster-first и streamed video
5. `Epic 7` — exam simulator с official-like ограничениями для video

## 8. Решение для v1

Если прагматично:

1. основной exam media track обязателен в v1
2. PJM track нужно импортировать и хранить, но UI можно держать отдельно или под feature flag
3. клиенту не нужен full offline pack
4. нужно lazy loading + poster fallback + next-asset preload
5. если после перекодирования часть роликов все еще слишком тяжелая, только тогда имеет смысл добавлять adaptive streaming как отдельный этап, не в первой версии

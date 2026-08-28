# Playbook: Expo SDK 54 → 57 (`@prawko/mobile`)

Документ для исполнения апгрейда, не обзор. Делаю один прыжок **54 → 57.0.9+**. Промежуточные SDK 55/56 отдельно не собираю: JS-миграции 55+56 применяю до/сразу после `--fix`, native пересобираю один раз.

Не смешиваю этот апгрейд с текущим WIP (trainer feedback, Maestro). Сначала либо коммит/stash текущих правок, либо отдельная ветка от чистого `main`.

---

## Официальные команды Expo

Полной команды «мигрируй проект» (`expo upgrade` / `expo migrate`) **нет** — её давно убрали. Expo сам делает только версии пакетов, один codemod навигации и проверку doctor. Код, `app.config`, babel и native — руками по фазам ниже.

Из `mobile/`:

```bash
# 1. Поставить SDK 57 и выровнять react / RN / expo-* под него.
#    Код не трогает. Pin не ниже 57.0.9 (фикс Hermes+worklets).
pnpm exec expo install expo@^57.0.9 --fix

# 2. Найти рассинхрон native-модулей, дубли, leftover react-navigation.
pnpm exec expo-doctor@latest

# 3. Единственный официальный codemod для этого прыжка (SDK 56):
#    @react-navigation/* → expo-router/react-navigation
#    Меняет только import specifier, не beforeRemove и не tab bar.
pnpm dlx expo-codemod sdk-56-expo-router-react-navigation-replace app src

# 4. Native. На 57 prebuild по умолчанию чистит ios/ и android/.
APP_VARIANT=prawko pnpm exec expo prebuild
```

Эквивалент из [официального walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/): `expo install expo@^57.0.0` затем `expo install --fix` + `expo-doctor`. Мы схлопываем в один `install expo@^57.0.9 --fix`.

Не использую:

- `expo upgrade` — удалена
- `EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1` как способ «не мигрировать»
- промежуточный `expo install expo@^55` / `@^56`, если цель сразу 57

---

## 0. Зачем 57, а не 55

| SDK | RN | React | Зачем / почему не цель |
| --- | --- | --- | --- |
| Сейчас 54.0.11 | 0.81.5 | 19.1.0 | New Arch уже включена, Reanimated 4 уже стоит |
| 55 | 0.83 | 19.2 | Первый breaking hop. Сам по себе ок, но в августе 2026 уже не latest |
| 56 | 0.85 | 19.2 | **Не останавливаюсь.** Hermes v1 memory regression при импорте `reanimated`/`worklets` — оба пакета у нас в корне `_layout.tsx` |
| **57.0.9+** | **0.86.2** | **19.2** | Цель. `expo@57.0.9` чинит ту регрессию. 56→57 задуман как «minor». Min iOS **16.4**. Xcode **26.4** |

SDK 54 получает критические фиксы примерно до сентября/октября 2026. Окно короткое.

Pin строго `expo@^57.0.9` (не `57.0.0`). Если `--fix` поставит младше — добить вручную.

---

## 1. Baseline (не угадывать заново)

`mobile/package.json` на старте:

- `expo@^54.0.11`, `react@19.1.0`, `react-native@0.81.5`
- `expo-router@~6.0.9`
- `react-native-reanimated@~4.1.1`, `react-native-worklets@0.5.1`
- `react-native-google-mobile-ads@16.3.4` (уже версия с фиксом native ads 55/56)
- `react-native-purchases` / `-ui` `^10.7`
- `@react-navigation/native@^7.0.14` — **сломается на 56**, надо переписать импорты
- New Arch: `app.config.ts` `newArchEnabled: true`, `ios/Podfile.properties.json`, `android/gradle.properties`
- Entry: `index.js` → `expo-router/entry`
- Монорепо pnpm, `nodeLinker: hoisted`, пакет `@prawko/mobile`
- Native деревья **закоммичены** (`mobile/ios`, `mobile/android`) — hybrid CNG
- Вариант по умолчанию: `prawko` (`com.mindjar.prawko`)
- E2E: Maestro `.maestro/`, bootstrap `EXPO_PUBLIC_E2E_TEST_MODE=1`
- MCP: `EXPO_UNSTABLE_MCP_SERVER=1` в `ios` / `ios:e2e` скриптах, `expo-mcp@~0.2.1`

Уже **не надо** мигрировать в этом апгрейде:

- `expo-av` → `expo-video` (уже `expo-video`)
- FileSystem legacy → `File`/`Directory`/`Paths` (уже новый API)
- Native Tabs API 55 (используем JS `Tabs` + `FloatingTabBar`)
- Notifications `shouldShowAlert` (уже `shouldShowBanner`/`shouldShowList`)
- app.json поле `notification` (его нет; плагин `expo-notifications` уже стоит)
- Reanimated 3 → 4 (уже 4 + worklets)
- Old Architecture (уже New Arch)

---

## 2. Сознательно не делаю в этом апгрейде

Если потянет — отдельный PR после зелёного 57.

- Hermes v1 (`useHermesV1` / `buildReactNativeFromSource`) — на 55/56 жрёт память с worklets, плюс сборка RN из исходников.
- React Compiler (`experiments.reactCompiler`).
- Миграция `@expo/vector-icons` → `@react-native-vector-icons/*` (dep уже явный, иконки работают).
- Drop-in `@expo/ui` вместо `@gorhom/bottom-sheet` (у нас провайдер пустой, шиты свои).
- Переезд на Native Tabs / `FloatingTabBar` → системный tab bar.
- MMKV v4 + nitro (пакет мёртвый, просто выкидываю).
- Смену политики «коммитить ios/android» на чистый CNG.
- Рефактор React 19 (`use` вместо `useContext`, `ref` prop вместо `forwardRef`) — `forwardRef` нет, провайдеры оставляю как есть.

---

## 3. Preconditions (остановить апгрейд, если нет)

Проверяю до любой правки зависимостей:

```bash
node -v          # нужно ^20.19.4 || ^22.13 || ^24.3 || ^25
xcodebuild -version   # Xcode ≥ 26.4 для локального iOS
corepack pnpm -v      # репо на pnpm@9.15.9
```

- Нет Xcode 26.4 → iOS собираю только через EAS (профиль без кастомного `image`, SDK 56+ дефолтит 26.4). Локальный `pnpm ios` не гоняю.
- Нет симулятора/e2e-билда → в конце явно пишу блокер, не объявляю апгрейд сделанным (правило Maestro).

Ветка: `chore/mobile-expo-57` от чистого состояния, не от грязного trainer-диффа.

---

## 4. Карта того, что может упасть

Каждый пункт — конкретный файл, симптом, что я делаю.

### 4.1 Критично (сломает сборку, навигацию или деньги)

**A. `@react-navigation/native` в app-коде (SDK 56)**

Expo Router больше не сидит поверх React Navigation. Прямой импорт из `@react-navigation/*` в нашем коде → ошибка бандлера. Shim в `node_modules` чужих либ нас не спасает.

Файлы (все `from "@react-navigation/native"`):

| Файл | Символ | Зачем |
| --- | --- | --- |
| `app/question.tsx` | `useNavigation` + `beforeRemove` | Гарет выхода из тренажёра. Без него либо стек замерзает на спиннере, либо сессия убивается без диалога |
| `app/exam/session.tsx` | то же | То же для экзамена |
| `app/(tabs)/index.tsx` | `useIsFocused` | Home не должна пересчитывать readiness в фоне |
| `app/(tabs)/learn.tsx` | `useIsFocused` | |
| `app/(tabs)/profile.tsx` | `useIsFocused` | |
| `app/practice/index.tsx` | `useIsFocused` | |
| `app/statistics/index.tsx` | `useIsFocused` | |
| `app/offline-mode.tsx` | `useIsFocused` | |
| `src/providers/ThemeProvider.tsx` | `DefaultTheme`, `ThemeProvider as NavigationThemeProvider` | Оборачивает дерево навигационным темой |
| `src/theme/index.ts` | `DefaultTheme` | `createNavigationTheme` |
| `src/portable-ui/theme/navigationPalettes.ts` | `DefaultTheme` | |
| `src/portable-ui/components/CText.tsx` | `useTheme` | Это **навигационная** тема (`colors.text`), не `src/providers/ThemeProvider`. Не переключать на наш `useTheme` |

Делаю:

```bash
cd mobile
pnpm dlx expo-codemod sdk-56-expo-router-react-navigation-replace app src
```

Ожидаемый импорт: `from "expo-router/react-navigation"`.

Потом:

```bash
rg "@react-navigation/" app src --glob '!**/node_modules/**'
```

Должно быть пусто. Выкидываю `"@react-navigation/native"` из `package.json`, `pnpm install`.

`EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1` **не ставлю**, кроме одноразовой диагностики.

`beforeRemove` API не меняется (только specifier). После миграции руками прогоняю:

- тренажёр: ответить → системный back → диалог, не выход
- тренажёр: Finish / Work on mistakes → `allowNavigationRef` пускает `replace`, **не** зависает на спиннере (`trainer_result_work_on_mistakes`)
- экзамен: back на Q1 без ответа → empty close; после ответа → диалог Continue
- Maestro: `trainer_exit_then_start_is_fresh`, `exam_exit_continue_keeps_question`, `trainer_result_work_on_mistakes`

**B. Кастомный tab bar**

`app/(tabs)/_layout.tsx` + `src/components/shell/FloatingTabBar.tsx`.

`tabBar={(props) => <FloatingTabBar {...props} />}` использует `navigation.emit({ type: "tabPress" })` и `navigation.navigate(route.name)`, `href: null` прячет Signs для greece.

На 56 router форкнул JS tabs. Если `tabBar` props разъедутся — табы не жмутся / Signs не прячется / freeze не работает.

Проверка: `tabs_are_navigable`, greece `features.roadSigns: false` → таб Signs отсутствует, `freezeOnBlur: true` на `(tabs)` в `app/_layout.tsx` — после ухода в exam Home не должна молотить topic math (если молотит — tab bar лагает, это и есть регресс).

**C. `expo-video` `allowsFullscreen` (SDK 55)**

`src/features/questions/QuestionMediaCard.tsx` — проп удалён. Уже есть `fullscreenOptions={{ enable: false }}`. Просто удаляю `allowsFullscreen={false}`.

Рядом не трогаю: `useVideoPlayer`, `useEvent`/`useEventListener` из `expo`, prefetch `createVideoPlayer` + `release()` в `usePrefetchQuestionMedia.ts`. После native-сборки смотрю: постер → play, loop/ended, prefetch следующей, Android не чёрный экран.

**D. RevenueCat + RN 0.83/0.86 TurboModule**

`src/features/entitlements/revenuecat.ts`: `Purchases.configure`, `logIn`, `purchasePackage`, `restorePurchases`, `RevenueCatUI.presentPaywallIfNeeded`.

Известный краш: NSException в void TurboModule → порча Hermes. На 55 фиксили RN ≥ 0.83.5; на 57 должен быть 0.86.2 из `expo@57.0.9`.

Проверка на **device**, не только симулятор: cold start, paywall, restore, login/logout (`Purchases.logIn`/`logOut`). Если падает на старте — не откатываю New Arch (на 57 её нет), а смотрю версию RN в `node_modules/react-native/package.json` и changelog purchases.

**E. AdMob interstitial**

Только interstitial (`interstitial-controller.ts`, `AdProvider`, `AppResumeAdListener`). Баннеров/native/UMP нет. `16.3.4` оставляю минимум; `--fix` может поднять — ок, ниже не опускаю.

Проверка: free-user, закрыть тренажёр/экзамен → interstitial; resume из фона; e2e с ads выключенными не должен ждать креатив.

Config: плагин в `app.config.ts` + дубль `"react-native-google-mobile-ads"` на корне конфига. Оба оставляю — Invertase historically читает оба. После prebuild сверяю `GADApplicationIdentifier` в новом `Info.plist` и Android app id.

### 4.2 Высокий риск (данные / вёрстка / сеть)

**F. `expo-file-system` copy/move стали async (SDK 56)**

`File.write` в SDK 57 **синхронный** (`Returns: void`) — в `question-catalog-cache.ts` и `offline-pack.ts` `writeJsonFile` можно не трогать, если типы после `--fix` всё ещё `void`.

`copy()`/`move()` у нас **нет**. Если после bump типы `write` вдруг `Promise` — сразу `await file.write(...)`.

`File.downloadFileAsync(url, file, { idempotent: true })` в `offline-pack.ts` оставляю. Новый `createDownloadTask` не внедряю в этом PR.

Проверка: скачать pack, resume incomplete, stop, remove, trainer/exam offline gate. Maestro offline-* flows.

**G. `globalThis.fetch` = `expo/fetch` (SDK 56)**

`src/lib/supabase.ts` — supabase-js на глобальном fetch. `src/features/offline/reachability.ts` — `fetch` + `AbortController` 1200ms.

Если логин/каталог/health-пинг ломаются: сначала воспроизвести. Escape hatch только если подтверждено:

```
EXPO_PUBLIC_USE_RN_FETCH=1
```

Не ставлю заранее.

**H. Edge-to-edge обязателен (SDK 55)**

`android/gradle.properties` уже `edgeToEdgeEnabled=true`. После prebuild 57 ключ `expo.edgeToEdgeEnabled` исчезнет — так и надо.

`FloatingTabBar` считает `useSafeAreaInsets().bottom`. `AppScreen` / `StatusBar` не ставят deprecated `backgroundColor`/`translucent` — ок.

Проверка: Home/Learn/Profile/exam/feedback — контент не под навигейшен, таббар не перекрывает CTA, жест back на Android 15/16.

**I. iOS 16.4 + Xcode 26.4 (SDK 56)**

`Podfile` сейчас `platform :ios, '15.1'`. После prebuild должно стать 16.4. Для Prawko аудитории ок (отваливаются iPhone 7 / SE1). Симулятор не ниже 16.4.

**J. `freezeOnBlur`**

`app/_layout.tsx`: `(tabs)` freeze; exam/question `gestureEnabled: false`. Коммент про topic math — это продуктовый инвариант. Если после 57 экраны не фризятся — Home/Learn начнут считать readiness во время экзамена. Чувствуется лагом таббара. Чиню, не выключаю freeze «чтобы завелось».

**K. Apple zoom transition (SDK 55, default on iOS)**

У `question` стоит `animation: "slide_from_right"`. Если на iOS 26 стек внезапно зумится — явно фиксирую animation, не полагаюсь на дефолт.

### 4.3 Средний риск

**L. Babel**

`mobile/babel.config.js`:

```js
presets: ["babel-preset-expo"],
plugins: ["expo-router/babel", "react-native-reanimated/plugin"],
```

`expo-router/babel` мёртв с SDK 50, на новом SDK может ругаться. `babel-preset-expo` сам вешает worklets/reanimated. Делаю:

```js
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
```

Кастомных babel-плагинов больше нет — файл можно оставить минимальным (metro/svg живут в `metro.config.js`).

**M. Metro / монорепо**

`metro.config.js`: svg-transformer, aliases `@app-variant` / road-signs, `watchFolders` на `data/…`, `useWatchman: false`, `nodeModulesPaths` mobile+root.

SDK 55 включает `experiments.autolinkingModuleResolution` в монорепо по умолчанию. Если doctor орёт про duplicate native modules — не отключаю, чиню hoisting. `pnpm-workspace.yaml` уже `nodeLinker: hoisted`.

Jest aliases в `jest.config.js` не трогаю, пока тесты зелёные. Jest **не** использует `babel-preset-expo` (свой preset-env/typescript) — апгрейд Expo его не ломает сам по себе.

**N. TypeScript 6**

SDK 56 `--fix` тянет `typescript@6.0.3`. У нас `^5.9.3`, `skipLibCheck: true`. Сначала пускаю bump. Если `pnpm typecheck` разъезжается не из-за нашего кода — exclude:

```json
"expo": { "install": { "exclude": ["typescript"] } }
```

в `mobile/package.json` и оставляю 5.9.3. Не чиню полрепы под TS 6 в том же PR.

**O. Мёртвые native deps**

Выкидываю до prebuild, чтобы не линковать:

- `react-native-mmkv` — ни одного JS-импорта
- `react-native-is-edge-to-edge` — ни одного импорта (если `--fix` не вернёт как peer)

Не выкидываю без проверки peer:

- `expo-linking` — нужен expo-router, даже если app-код берёт RN `Linking`
- `expo-application` — может использоваться notifications/store-review internally; пусть `--fix`/doctor решит
- `react-freeze` — связан с `freezeOnBlur`; не трогаю, пока freeze жив
- `@gorhom/bottom-sheet` — провайдер в `AppProviders.tsx`; оставляю
- `@expo/vector-icons` — явные импорты Ionicons/MaterialCommunityIcons

**P. `newArchEnabled` в app config**

На 55 поле выпилено (New Arch only). После bump убираю `newArchEnabled: true` из `app.config.ts`. В сгенерированных gradle/Podfile пусть prebuild поставит что надо.

**Q. expo-mcp**

Скрипты `ios`/`ios:e2e` с `EXPO_UNSTABLE_MCP_SERVER=1`. `expo-mcp@~0.2.1` обновляю, если doctor/peer после 57 скажет. Не блокер стора.

**R. `eas update`**

OTA нет. Флаг `--environment` нас не касается.

**S. PostHog**

`AnalyticsProvider.tsx` — `PostHogProvider`. После native rebuild: одно событие с device, identify после логина. Если peer на RN 0.86 — поднимаю `posthog-react-native` тем же `--fix` или последним 4.x.

**T. i18n**

`compatibilityJSON: "v4"` не связан с SDK. Не трогаю.

---

## 5. Порядок работ

Команды — из корня репо, если не сказано иначе. Mobile filter: `@prawko/mobile`.

### Фаза 0 — изоляция

1. `git status` чистый относительно апгрейда (WIP убран).
2. Ветка `chore/mobile-expo-57`.
3. Зафиксировать текущие версии: `mobile/package.json`, `pnpm-lock.yaml`.

### Фаза 1 — JS, который можно сделать на 54 (меньший дифф, зелёный typecheck до bump)

Пока ещё на 54, чтобы отделить «наш рефактор» от «сломанный SDK»:

1. `QuestionMediaCard.tsx`: удалить `allowsFullscreen={false}`.
2. `babel.config.js`: оставить только `babel-preset-expo`.
3. Удалить `react-native-mmkv` из `mobile/package.json`.
4. Не гонять codemod навигации на 54 — `expo-router/react-navigation` появится с 56/57. Codemod — **фаза 3, после `--fix`**.

`pnpm --filter @prawko/mobile typecheck` и `test` должны быть зелёные.

### Фаза 2 — bump зависимостей

Из `mobile/`:

```bash
pnpm exec expo install expo@^57.0.9 --fix
pnpm exec expo-doctor@latest
```

Сверяю после `--fix` (записать фактические номера в конец этого файла, секция «Фактические версии»):

- `expo` ≥ 57.0.9
- `react` 19.2.x
- `react-native` 0.86.2 (или то, что 57.0.9 пинит)
- `expo-router` major = 57 (новая схема версий с 55)
- `react-native-reanimated` ~4.5, `react-native-worklets` ~0.10, `gesture-handler` ~2.32
- `react-native-google-mobile-ads` ≥ 16.3.4
- `react-native-purchases` не уехал вниз

Если doctor орёт про `@react-navigation/native` + `expo-router` вместе — это ожидаемо до фазы 3.

pnpm: если peer/hoist война, `rm -rf node_modules mobile/node_modules && pnpm install` в корне. Не кручу `shamefully-hoist` вслепую.

### Фаза 3 — навигация

1. Codemod на `app` и `src` (команда в 4.1).
2. Ручная проверка `ThemeProvider.tsx`: `NavigationThemeProvider` должен импортироваться из `expo-router/react-navigation`, наш `ThemeProvider`/`useTheme` — свои.
3. `CText` остаётся на навигационном `useTheme`.
4. Удалить `@react-navigation/native` из deps.
5. `rg "@react-navigation/"` по `mobile/` исключая lock/Pods — пусто в TS/TSX.
6. `pnpm --filter @prawko/mobile typecheck`.

Если codemod не взял файл в `app/` (он не под `src`) — дописываю импорты руками. Список файлов в 4.1 полный.

### Фаза 4 — конфиг

`app.config.ts`:

- Удалить `newArchEnabled: true`.
- Плагины не трогать: router, font, localization, secure-store, notifications, video, AdMob.
- `experiments.typedRoutes: true` оставить. React Compiler не включать.

`eas.json` не трогать, кроме случая, когда EAS без Xcode 26.4 (тогда явный `image` с 26.4).

### Фаза 5 — native regen

SDK 57: `expo prebuild` **чистит ios/android по умолчанию**. Это то, что нужно.

Не удаляю `mobile/credentials/`. Не коммичу `credentials.json`.

```bash
cd mobile
# сохранить копию Info.plist / AndroidManifest только как diff-reference, не как source of truth
APP_VARIANT=prawko pnpm exec expo prebuild
```

После генерации сверить, что поднялось из `app.config.ts`:

- bundle id / applicationId `com.mindjar.prawko`
- `GADApplicationIdentifier` / Android AdMob app id
- splash / icon из `variants/prawko` assets
- `NSUserNotificationUsageDescription`
- `usesNonExemptEncryption: false`
- scheme `prawko`

Если prebuild потерял AdMob — чиню **плагин в app.config.ts**, не ручной pbxproj.

Локально:

```bash
APP_VARIANT=prawko pnpm ios      # если есть Xcode 26.4
# иначе EAS development build
```

Новый dev client обязателен. Старый SDK 54 client с 57 JS не смешиваю.

### Фаза 6 — автоматические проверки

```bash
cd mobile
pnpm typecheck
pnpm test
pnpm exec expo-doctor@latest
```

Doctor: duplicate native modules, mismatched SDK packages, `@react-navigation` leftover, mmkv gone.

### Фаза 7 — ручной прогон на устройстве (не скриншот)

Prawko, Plus и free, online:

1. Cold start, splash → onboarding или Home.
2. Табы Home / Learn / Signs / Profile, кастомный бар, safe area.
3. Тренажёр: вопрос с видео, play/poster, ответ, feedback sheet, next.
4. Back во время сессии → диалог, не выход; Finish → результат; Work on mistakes → не спиннер.
5. Экзамен 32q: back empty vs answered; Continue держит вопрос.
6. Free: interstitial после сессии и на resume. Не кликается «сквозь» креатив (таймер экзамена не тикает под объявой).
7. Paywall / restore / Plus gate offline.
8. Логин Supabase (fetch).
9. Offline pack: download, stop, resume, remove; trainer/exam gates.
10. Notifications toggle (не пуш в Expo Go — нас и так нет Go).
11. Язык / категория.

Czech/greece: только если трогали variant Metro. Минимум `APP_VARIANT=czech` start, таб Signs на месте; greece — Signs скрыт.

### Фаза 8 — Maestro

Нужен **новый** e2e build:

```bash
cd mobile
EXPO_PUBLIC_E2E_TEST_MODE=1 pnpm ios:e2e
# или EAS profile e2e-test
pnpm test:e2e:smoke
```

Если smoke зелёный — целевые флоу, которые бьют в миграцию:

- `tabs_are_navigable.yaml`
- `trainer_exit_then_start_is_fresh.yaml`
- `trainer_empty_close_then_start_is_fresh.yaml`
- `trainer_result_work_on_mistakes.yaml`
- `trainer_first_answer_shows_feedback.yaml`
- `exam_empty_close_then_start_is_fresh.yaml`
- `exam_exit_continue_keeps_question.yaml`
- `profile_offline_missing_pack_can_download.yaml`
- `trainer_offline_missing_pack_is_blocked.yaml`
- `trainer_offline_ready_pack_starts_questions.yaml`

Селекторы `testID` в этом апгрейде не меняю. Если упал flow — сначала смотрю, не съехал ли экран/модалка из-за router, не выдумываю новые testID.

Нет симулятора → в итоге апгрейда пишу явный блокер, не «e2e потом».

### Фаза 9 — уборка

- `newArchEnabled` нет в app config.
- Нет `@react-navigation/` в app TS.
- Нет `allowsFullscreen`.
- Нет mmkv.
- `pnpm-lock.yaml` обновлён.
- В этот файл дописать блок «Фактические версии».
- Не коммитить `ios/Pods`, credentials, `.expo`.

---

## 6. Если конкретная вещь упала

| Симптом | Куда смотреть | Что не делать |
| --- | --- | --- |
| Bundler: cannot import `@react-navigation/native` | Недопрогнанный файл, `CText`/`ThemeProvider` | Не ставить `EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK` в scripts |
| Табы мёртвые / Signs не прячется | `FloatingTabBar` props vs expo-router JS tabs | Не переписывать на NativeTabs в этом PR |
| `/question` зависает на loading | `allowNavigationRef` + `beforeRemove` vs `router.replace` | Не убирать listener |
| Home лагает во время экзамена | `freezeOnBlur` на `(tabs)` | Не «оптимизировать» topic math вместо freeze |
| Чёрное видео Android | два плеера на одном `VideoView`, prefetch | Не возвращать `expo-av` |
| Краш на старте iOS в Purchases | RN version, `logIn` на configure | Не выключать New Arch |
| Interstitial не show / CTA не кликается | GMA ≥ 16.3.4, prebuild plugin ids | Не патчить pbxproj руками |
| Offline pack «скачался», файлов нет | `downloadFileAsync` / `file.write` типы | Не переезжать на DownloadTask в этом PR |
| Логин/каталог сеть | `expo/fetch` vs supabase | Ставить `EXPO_PUBLIC_USE_RN_FETCH=1` только после подтверждения |
| Duplicate native module doctor | pnpm hoist, `nodeModulesPaths` | Не копировать пакеты в mobile/node_modules вручную |
| Pods / Gradle ад | prebuild заново, не чинить generated 54 файлы | Не мержить старый `project.pbxproj` |
| TS 6 море ошибок в `.d.ts` | exclude typescript, остаться на 5.9 | Не рефакторить полрепы |

---

## 7. Rollback

- Ветка не в main, пока фазы 6–8 не зелёные.
- Откат = `git checkout` ветки, не `expo install expo@54` поверх полумигрированного JS.
- Dev client 57 с JS 54 (и наоборот) не запускаю.
- Store/TestFlight: не сабмитить, пока нет зелёного smoke + ручной paywall/ads.

---

## 8. Definition of done

Апгрейд сделан, когда:

1. `mobile/package.json`: `expo@^57.0.9` (или новее 57.x), RN/React совпадают с bunded 57.
2. Нет `@react-navigation/*` в нашем TS, нет `@react-navigation/native` в deps.
3. `pnpm typecheck` и `pnpm test` в mobile зелёные.
4. `expo-doctor` без duplicate native / mismatched SDK (warnings по Go/dev-client — ок).
5. Новый native build prawko установлен.
6. Ручной чеклист фазы 7 пройден (навигация, видео, ads, IAP, offline, fetch).
7. Maestro smoke (+ целевые флоу из фазы 8) зелёный **или** явный блокер «нет симулятора/e2e build».
8. Этот документ дополнен фактическими версиями.

---

## 9. Фактические версии (после фазы 2–5, 2026-08-26)

```
expo: ^57.0.16
react: 19.2.3
react-native: 0.86.2
expo-router: ~57.0.16
reanimated ~4.5.1 / worklets 0.10.1 / gesture-handler ~2.32.0 / screens ~4.26.2 / safe-area ~5.7.0
google-mobile-ads: 16.3.4
purchases / purchases-ui: ^10.7.0
typescript: ^6.0.3
@types/react: ^19.2.15
@expo/metro-runtime: ~57.0.13
react-dom: 19.2.3
@react-native/metro-config: ^0.86.2
```

Doctor: 20/21. Единственный fail — hybrid CNG (`ios/`+`android/` закоммичены, EAS не синкает plugins из app.config). Это было и на 54; prebuild 57 перегенерировал native.

Typecheck: зелёный после
- `tsconfig`: убран `types: ["expo-router/types"]` (нет в SDK 57), `ignoreDeprecations: "6.0"`, `exclude: **/__tests__/**`
- `StyleSheet.absoluteFillObject` → `absoluteFill` (RN 0.86)
- fallback copy для `cs`/`el` в study-plan и weekday labels

Jest: 41 suites / 243 tests pass.

Prebuild: `APP_VARIANT=prawko expo prebuild` — iOS 16.4, CocoaPods ок, mmkv нет.
AdMob: пустой `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` записался как `android:value=""`; `envOr()` + fallback test id.

Xcode локально 26.0.1, SDK 56+ хочет 26.4 — локальный `run:ios` падает в `expo-modules-jsi` (`weak let` = Swift 6.3). Не патчить JSI. Сборка iOS: обновить Xcode до 26.4 или EAS (image с 26.4).

Maestro: нужен новый e2e-билд, не гонялся.

---

## 10. Команды одной пачкой (когда фазы 0–1 закрыты)

```bash
cd /Users/sashanesterchuk/prawko/mobile

pnpm exec expo install expo@^57.0.9 --fix
pnpm dlx expo-codemod sdk-56-expo-router-react-navigation-replace app src
# руками: вычистить leftover @react-navigation, выкинуть пакет, allowsFullscreen, babel, mmkv, newArchEnabled

pnpm install
pnpm exec expo-doctor@latest
pnpm typecheck
pnpm test

APP_VARIANT=prawko pnpm exec expo prebuild
# затем ios/android run или EAS development + e2e-test
```

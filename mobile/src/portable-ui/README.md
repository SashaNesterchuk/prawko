# portable-ui

Переносимый responsive typography kit для React Native / Expo. Скопируйте папку `portable-ui` целиком в другой проект — внутри только относительные импорты, без `@/` alias.

## Назначение

- Масштабирование `fontSize`, `lineHeight` и отступов от baseline **440×956** (clamp 0.8–1.3).
- Компонент `CText` с пропами `s16`, `bold`, `center` и inline-тегами `<bold>`, `<style s14 moss>`.
- Реестр шрифтов вместо захардкоженных `Roboto-*` — по умолчанию системный шрифт, кастомные подключаются через `configureFonts`.

Не заменяет shell-тему Prawko (`src/theme`) — это отдельный слой для типографики и responsive layout.

## Структура

```
portable-ui/
  README.md
  COMPONENTS.md
  index.ts
  typography/
    fontRegistry.ts
    styles.ts
  theme/
    navigationPalettes.ts
  hooks/
    useResponsiveFonts.ts
    useResponsiveSpacing.ts
    useResponsiveStyles.ts
  components/
    CText.tsx
```

## Быстрый старт

### 1. Navigation theme

`CText` и `useResponsiveStyles` читают `colors.text` из `@react-navigation/native` (`useTheme`). Оберните приложение в `NavigationContainer` / `ThemeProvider` с темой, где есть `colors.text`.

Опционально для color-тегов в `CText` (`<style s14 moss>`) используйте палитры из `theme/navigationPalettes.ts` или расширьте свою тему теми же ключами (`moss`, `dynamic`, …).

### 2. Шрифты (опционально)

По умолчанию `fontFamily` не задаётся — RN использует системный шрифт.

```ts
import { useFonts } from "expo-font";
import { configureFonts } from "./src/portable-ui";

// Вызовите configureFonts до первого рендера CText (например в AppProviders)
configureFonts({
  regular: "Roboto-Regular",
  medium: "Roboto-Medium",
  semiBold: "Roboto-SemiBold",
  bold: "Roboto-Bold",
  mono: "RobotoMono-Regular",
});
```

Загрузка через `expo-font` в том же провайдере:

```ts
const [loaded] = useFonts({
  "Roboto-Regular": require("../assets/fonts/Roboto/Roboto-Regular.ttf"),
  "Roboto-Medium": require("../assets/fonts/Roboto/Roboto-Medium.ttf"),
  "Roboto-SemiBold": require("../assets/fonts/Roboto/Roboto-SemiBold.ttf"),
  "Roboto-Bold": require("../assets/fonts/Roboto/Roboto-Bold.ttf"),
  "RobotoMono-Regular": require(
    "../assets/fonts/Roboto_Mono/RobotoMono-Regular.ttf"
  ),
});
```

### 3. Использование

```tsx
import { CText, useResponsiveStyles } from "../portable-ui";

<CText s16 bold center>
  Заголовок
</CText>

<CText s14 ignoreStyles={false}>
  Текст с <bold>жирным</bold> и <style s12 moss>цветом</style>
</CText>
```

```ts
const styles = useResponsiveStyles(({ spacing, responsiveFont, colors }) => ({
  box: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: responsiveFont(20),
    color: colors.text,
  },
}));
```

## Зависимости

Уже нужны в host-проекте:

- `react-native`
- `@react-navigation/native` (для `useTheme`)
- `expo-font` (только если грузите кастомные шрифты)

Новых npm-пакетов kit не добавляет.

## Checklist: перенос в другой проект

1. Скопировать папку `portable-ui` в `src/` (или рядом).
2. Убедиться, что есть `ThemeProvider` / `NavigationContainer` с `colors.text`.
3. При необходимости — `configureFonts` + `expo-font` в корневом провайдере **до** импорта экранов с `CText`.
4. Для inline color-тегов — расширить navigation theme или подставить `lightNavigationPalette` / `darkNavigationPalette`.
5. Импортировать из `./portable-ui` или `./portable-ui/index.ts`.
6. Прогнать `tsc --noEmit` в host-проекте.

## Связь с Prawko

- Shell-компоненты (`AppButton`, `AppScreen`) и `src/theme` на первом этапе **не** мигрируются на `CText`.
- Kit лежит рядом и готов к постепенному внедрению.

Подробное описание модулей — в [COMPONENTS.md](./COMPONENTS.md).

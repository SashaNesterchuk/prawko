# Expo: запуск вариантов приложения

Все команды выполняются из папки `prawko/mobile`.

## Prawko

```bash
pnpm start:prawko
```

Это запускает Expo с `APP_VARIANT=prawko`. Обычный `pnpm start` тоже запускает Prawko по умолчанию.

Нативный запуск:

```bash
APP_VARIANT=prawko npx expo run:android
APP_VARIANT=prawko npx expo run:ios
```

## Будущие приложения

```bash
pnpm start:czech
pnpm start:greece
```

При смене variant всегда перезапускай Expo/Metro: variant выбирается при старте bundler-а.

## Проверка Expo-конфига

```bash
pnpm config:prawko
pnpm config:czech
pnpm config:greece
```

Prawko готов к EAS build. Czech и Greece пока являются development-шаблонами: EAS build заблокирован, пока для каждого не будут добавлены собственные icon/splash, EAS project ID, Store IDs и credentials.

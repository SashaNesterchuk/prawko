# Expo

Commands run from `prawko/mobile`.

```bash
pnpm start
pnpm ios
pnpm android
```

Native identity is always Prawko (`com.mindjar.prawko`). Exam country (Poland / Czechia) is chosen at runtime from the storefront or device region, then from Profile. Do not prebuild a second bundle id.

```bash
npx expo prebuild
npx expo run:ios
```

Public Expo config:

```bash
npx expo config --type public --json
```

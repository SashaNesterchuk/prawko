EXPO_UNSTABLE_MCP_SERVER=1 pnpm expo start
npx eas-cli build --platform ios --profile production --auto-submit
npx eas-cli build --platform android --profile production --auto-submit

## Premium teaser

Всплывающий шит с оффером Plus выключен: ни на старте (`app_open`), ни после рекламы (`after_ad`). Оффер на Home — карточка внизу роадмапа. У Plus вместо неё карточка оценки. Paywall после экзамена (`after_exam`) по-прежнему открывается отдельно.

Код: `src/features/monetization/monetization-store.ts`, `PremiumTeaserHost.tsx`.

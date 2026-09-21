EXPO_UNSTABLE_MCP_SERVER=1 pnpm expo start
npx eas-cli build --platform ios --profile production --auto-submit
npx eas-cli build --platform android --profile production --auto-submit

## Premium teaser

### app_open

- только returning user
- не first launch (`launchCount >= 2`)
- уже есть хотя бы одна завершённая training или exam
- Home реально отображён (`(tabs)` / `(tabs)/index`, не root gate `/`)
- не Plus
- показать teaser
- этот показ учитывается в обычном session-limit (макс. 2 teaser/session + 2 минуты между показами)

### after_ad

- считать только реально показанный и закрытый interstitial (`presentInterstitial` → `recordAdDismissed`)
- `ad_failed`, `ad_skipped`, ad request без показа — счётчик не увеличивают
- `adsShown` = 1, 3, 5, 7… → запрашиваем teaser
- 2, 4, 6… → ничего
- placement не важен (training / exam / questions / resume)
- `after_ad` не ограничивать лимитом 2 teaser/session
- но соблюдать 2 минуты между фактическими показами teaser

После тренировки teaser/paywall не запрашиваем. Paywall после экзамена (`after_exam`) отдельный.

Код: `src/features/monetization/monetization-store.ts`, `PremiumTeaserHost.tsx`, `src/features/ads/show-interstitial.ts`. Analytics `moment`: `app_open` | `after_ad` | `manual_test`.

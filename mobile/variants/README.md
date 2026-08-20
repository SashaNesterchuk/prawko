# App variants

`APP_VARIANT` selects one application at Expo config and Metro resolution time.

- `prawko` is the current production app.
- `czech` and `greece` are development templates. They intentionally cannot run on EAS until each has its own icon/splash, EAS project ID, Store IDs and production credentials.

Run locally with `pnpm start:prawko`, `pnpm start:czech`, or `pnpm start:greece`. Restart Metro when switching variants.

To add a production country, update `manifest.cjs`, add its country assets, add a `runtime.ts` override, create a dedicated EAS project/channel, then add its EAS build and submit profiles. Keep national content in Supabase `question_sets`; use the runtime module only for app shell theme, copy, assets and enabled features.

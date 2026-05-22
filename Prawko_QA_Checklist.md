# Prawko — QA Checklist

## 1. Core setup

- [ ] `pnpm install` completed without missing workspace packages.
- [ ] `.env` values are filled for `mobile`, `web`, and `supabase`.
- [ ] Latest migrations are applied to the target Supabase project.
- [ ] `profiles`, `questions`, `question_attempts`, `study_plans`, and `app_error_logs` tables exist.

## 2. Data pipeline

- [ ] `pnpm data:questions:inspect` completes on the current source files.
- [ ] `pnpm data:questions:validate` reports only known warnings.
- [ ] `pnpm data:media:audit` sees the expected media archive.
- [ ] `pnpm data:media:build` generates delivery assets and posters.
- [ ] `pnpm data:questions:sync` writes active question rows into Supabase.

## 3. Mobile flows

- [ ] App boots in mock mode when Supabase env is missing.
- [ ] Sign up works for a fresh email.
- [ ] Sign in works for an existing account.
- [ ] Onboarding creates a study plan and lands on the main app shell.
- [ ] Question catalog loads from Supabase for authenticated users.
- [ ] Free preview question cap blocks after `20` answers and keeps the correct remaining count for signed-in users.
- [ ] Daily free preview usage stays consistent after reinstall and on a second signed-in device.
- [ ] Wrong-answer replay and weak-spot flows show actual remote progress.
- [ ] AI question chat answers and shows fallback content if the edge path is unavailable.
- [ ] Access Center shows current access, can redeem a school code, and can run purchase restore.
- [ ] Paywall can redeem a school code for an authenticated user.
- [ ] RevenueCat purchase flow is verified on a real device build if purchase env is enabled.

## 4. Web and admin

- [ ] Marketing web builds successfully.
- [ ] Admin login works with configured admin credentials.
- [ ] `/admin` shows live metrics, recent profiles, AI messages, and recent app error logs.
- [ ] `/admin/school-codes` can create a school and a school code.
- [ ] Admin actions write operational failures to `app_error_logs` when DB writes fail.

## 5. Error visibility

- [ ] Mobile auth failures create `app_error_logs` rows after login-capable sessions.
- [ ] Question catalog fallback is visible in PostHog and in `app_error_logs`.
- [ ] Edge-function question-chat fallback writes a warning row.
- [ ] Unhandled mobile render/runtime failures hit the root error boundary.

## 6. Final verification

- [ ] `pnpm --filter @prawko/mobile typecheck`
- [ ] `pnpm --filter @prawko/web typecheck`
- [ ] `pnpm --filter @prawko/web build`
- [ ] At least one authenticated smoke test confirms shared free-tier quota against Supabase, not only local storage.
- [ ] Smoke test on at least one Android device and one iPhone build if both platforms are in scope.

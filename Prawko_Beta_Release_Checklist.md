# Prawko — Beta Release Checklist

## 1. Product readiness

- [ ] Category `B` question set is synced from the latest official source.
- [ ] Study-plan generation is stable for the supported `7-30 day` exam windows.
- [ ] AI question chat has a configured primary provider or the team explicitly accepts mock fallback for beta.
- [ ] Pricing, school-code logic, and entitlement windows match the intended beta offer.

## 2. Infra readiness

- [ ] Supabase project is the intended beta environment, not local dev.
- [ ] Storage buckets contain the delivery media build for the synced questions.
- [ ] `app_error_logs` migration is applied in beta.
- [ ] Admin auth env is configured for the beta web deployment.
- [ ] RevenueCat public keys and product identifiers match the beta stores.
- [ ] PostHog key is pointed at the beta workspace.

## 3. Release candidate checks

- [ ] `pnpm --filter @prawko/mobile typecheck`
- [ ] `pnpm --filter @prawko/web typecheck`
- [ ] `pnpm --filter @prawko/web build`
- [ ] Fresh user can complete: install -> auth -> onboarding -> study plan -> learning -> paywall.
- [ ] School-code user can complete: auth -> redeem code -> premium access confirmed.
- [ ] Access Center confirms current access state, school-code redemption, and purchase restore on a signed-in build.
- [ ] Free preview question cap is verified on a signed-in user across at least two sessions/devices.
- [ ] AI fallback path is tested once by temporarily breaking the provider env in a staging environment.

## 4. Launch operations

- [ ] Support contact and feedback channel are visible in app/web.
- [ ] At least one admin checks `/admin` daily during beta week one.
- [ ] `app_error_logs` is reviewed at least twice per day during the first 72 hours.
- [ ] Known beta limitations are written down for testers.

## 5. Exit criteria for beta week one

- [ ] No blocker in auth, onboarding, or question loading.
- [ ] No critical crash loop reproduced by multiple testers.
- [ ] School-code redemption works for pilot schools.
- [ ] The team has a decision on whether to keep the current paywall and access offer for public launch.

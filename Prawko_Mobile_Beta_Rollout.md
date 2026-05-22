# Prawko — Mobile Beta Rollout

## 1. Release candidate freeze

1. Pick the exact commit that will become the beta candidate.
2. Confirm `Prawko_QA_Checklist.md` and `Prawko_Beta_Release_Checklist.md` are checked through for that commit.
3. Apply the latest Supabase migrations to the beta environment.
4. Sync the latest question set and upload the matching delivery media build.
5. Verify beta env values for:
   - mobile Supabase
   - web admin
   - RevenueCat
   - PostHog
   - AI provider

## 2. Versioning

1. Bump the human version in [mobile/app.json](/home/lastday/prawko/mobile/app.json).
2. Bump the platform-specific build numbers in the actual signing/build pipeline before uploading.
3. Record the release candidate commit SHA, app version, and build numbers in the release notes.

## 3. iOS TestFlight rollout

1. Confirm the App Store Connect app exists for the intended bundle identifier.
2. Create a signed iOS archive using the chosen Expo/EAS or native iOS pipeline.
3. Upload the build to App Store Connect.
4. Wait for processing to finish and add the internal tester group first.
5. Verify on TestFlight:
   - install and launch
   - sign in
   - onboarding and study-plan creation
   - question practice with media
   - AI chat
   - paywall and Access Center
   - school-code redeem

## 4. Android Internal Testing rollout

1. Confirm the Google Play app exists for the intended package name.
2. Create a signed Android App Bundle with the chosen Expo/EAS or native Android pipeline.
3. Upload the bundle to Google Play Internal Testing.
4. Add the internal tester list and publish the internal release.
5. Verify on the installed internal build:
   - install and launch
   - sign in
   - onboarding and study-plan creation
   - question practice with media
   - AI chat
   - paywall and Access Center
   - school-code redeem

## 5. Shared smoke checks after both uploads

1. Answer enough questions to confirm the free preview cap blocks correctly.
2. Re-open the app or use a second signed-in device to confirm the remaining free quota stays in sync.
3. Confirm school access bypasses the free practice cap.
4. Confirm purchase restore does not remove an active school entitlement.
5. Review `/admin`, `/admin/import-health`, and `/admin/ai-review` after the first tester activity.
6. Review `app_error_logs` for auth, question, AI, and paywall failures.

## 6. Stop-ship criteria

- Do not widen beta if auth is unstable.
- Do not widen beta if the synced question set or media build is mismatched.
- Do not widen beta if the free preview cap can be bypassed for signed-in users.
- Do not widen beta if school-code redemption fails for the pilot schools.
- Do not widen beta if purchase restore removes valid paid or school access.

## 7. Repo note

- This repo does not currently ship a committed `eas.json`.
- If the rollout uses EAS or another signing system, keep the build profile, signing owner, and upload owner written down outside chat before beta day.

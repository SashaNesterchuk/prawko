# Prawko Supabase Schema Notes

## Current foundation

The current migration set covers the v1 backend backbone:

1. `profiles`
2. `questions`
3. `question_attempts`
4. `question_user_state`
5. `study_plans`
6. `study_plan_days`
7. `study_plan_tasks`
8. `exam_sessions`
9. `exam_session_answers`
10. `bookmarks`
11. `ai_messages`
12. `schools`
13. `school_codes`
14. `school_memberships`
15. `feature_entitlements`

## Design choices

### `profiles`

1. One row per `auth.users` record.
2. Created automatically from an auth trigger.
3. Stores stable account preferences and onboarding state.

### `questions`

1. Denormalized on purpose for v1.
2. Question and explanation fields live on the row in `pl`, `ua`, and `en`.
3. Delivery media metadata also lives on the row through `media_asset` and optional `pjm_*_asset` JSON columns.
4. Authenticated clients can read active questions only.
5. Imports stay service-role only.

### `question_attempts` and `question_user_state`

1. `question_attempts` is append-only and remains the event source of truth.
2. `question_user_state` is a derived cache for weak spots, spaced repetition, and mastery.
3. `is_hard` stays as a manual user signal and is preserved during recomputes.

### `study_plans`, `study_plan_days`, `study_plan_tasks`

1. `study_plans` keeps the header plus a temporary `plan_snapshot` for fast v1 iteration.
2. `study_plan_days` and `study_plan_tasks` are the normalized execution layer.
3. Day progress is recomputed from task changes through SQL triggers.
4. `metadata.counts_for_minimum` is parsed defensively to avoid bad boolean casts.

### `exam_sessions` and `exam_session_answers`

1. `exam_sessions` stores the whole question queue for resumable exams and mini tests.
2. `exam_session_answers` stores ordered per-question results inside a session.
3. Session score, counts, pass/fail, and current index are recomputed automatically.
4. `question_attempt_id` stays optional so exam answers can still map back to the generic progress log.

### `bookmarks`

1. One row per user-question pair.
2. This is intentionally simple for v1: saved questions are a personal replay list, not a full notes system yet.

### `ai_messages`

1. Conversation grouping is done with `conversation_id` plus `message_order`.
2. User messages can be inserted by the client.
3. Assistant and system rows are expected to be written by backend functions or server routes.
4. `is_visible_to_user` allows keeping internal prompts out of the client history.

### `schools`, `school_codes`, `school_memberships`, `feature_entitlements`

1. `schools` is the anchor entity for the B2B layer.
2. `school_codes` defines redeemable access codes with seat limits and feature grants.
3. `school_memberships` stores the student's current relationship with a school.
4. `feature_entitlements` is the source of truth for paid or sponsored access.
5. `redeem_school_code(text)` handles secure code redemption without exposing raw code rows to the client.

## Storage posture

1. `question-images`
2. `question-videos`
3. `question-posters`
4. `question-pjm`

All four buckets are intentionally public because they contain official non-user media only. User-generated or private data should not go into these buckets.

## RLS posture

1. Users can read and update only their own `profiles`.
2. Users can read only active `questions`.
3. Users can read and insert only their own `question_attempts`.
4. Users can read, insert, and update only their own `study_plans`, `study_plan_days`, and `study_plan_tasks`.
5. Users can read, insert, and update only their own `exam_sessions` and `exam_session_answers`.
6. Users can manage only their own `bookmarks`.
7. Users can read only their own visible `ai_messages`, and can insert only `user` role messages.
8. Users can read only their own `school_memberships` and `feature_entitlements`.
9. Raw `school_codes` remain closed to direct client reads.
10. `service_role` keeps full access for imports, admin flows, edge functions, and backoffice automation.

## Remaining follow-up

1. Run the migrations on a clean local Supabase instance once creds and local infra are allowed.
2. Validate `storage.buckets` and RLS behavior against the installed Supabase version.
3. Validate the new `questions:sync` pipeline against a real Supabase project and confirm batch sizes.
4. Add payment-provider specific entitlements once RevenueCat or another billing source is chosen.

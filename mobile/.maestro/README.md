# Maestro E2E (BDD-style UI flows)

Clickable end-to-end flows for Prawko mobile. Selectors use `testID` so tests stay stable across `pl` / `ua` / `en`.

## Prerequisites

1. App installed on a simulator/emulator (or device) with E2E bootstrap enabled:
   - `pnpm ios:e2e` / `pnpm android:e2e` from `mobile/`, or an EAS `e2e-test` build
2. [Maestro CLI](https://docs.maestro.dev/getting-started/installing-maestro)

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Run locally

From `mobile/`:

```bash
pnpm test:e2e
# or one flow:
pnpm test:e2e -- .maestro/onboarding_completes_and_lands_on_home.yaml
# interactive recorder / inspector:
pnpm test:e2e:studio
```

## Flows

| Flow | What it covers |
| --- | --- |
| `onboarding_completes_and_lands_on_home.yaml` | Category → exam date → skip notifications → Home |
| `onboarding_skip_exam_date_leaves_date_unset.yaml` | Skip exam date on onboarding → Profile shows unset date |
| `home_opens_trainer_modes.yaml` | Home → Trainer tile |
| `home_blitz_opens_duration_dialog.yaml` | Home → Quick session → duration picker → timed blitz training |
| `home_readiness_assessment_starts_training.yaml` | Empty readiness CTA (no period-change badge, never stuck on the loading skeleton) → untimed mini_test training (not exam) |
| `home_traps_opens_count_dialog.yaml` | Home → Traps tile → count picker → training |
| `home_exam_starts_session.yaml` | Home → Exam tile → official 32-question simulator (no count picker) |
| `profile_exam_country_screen_opens.yaml` | Profile → Exam country screen with PL and CZ tiles |
| `profile_exam_country_switch_cz_exam.yaml` | Profile → CZ → language tiles only cs/en → official 25-question eTesty exam |
| `profile_exam_country_switch_back_keeps_pl.yaml` | PL exam progress stays namespaced: CZ exam starts at 25 questions, switching back restores the 32-question WORD exam |
| `exam_empty_close_then_start_is_fresh.yaml` | Unanswered exam close (miss-click) → start again at question 1 |
| `exam_answer_exit_then_new_attempt_is_fresh.yaml` | Answer Q1 → Finish → new attempt starts at question 1 |
| `exam_exit_continue_keeps_question.yaml` | Answer Q1 → Close → Continue stays on question 2 |
| `exam_result_new_attempt_is_fresh.yaml` | Finished exam result → new attempt at question 1 (Plus) |
| `tabs_are_navigable.yaml` | Tab bar: Home / Learn / Signs / Profile |
| `learn_first_topic_opens_trainer_modes.yaml` | Learn tab → first topic card → trainer modes |
| `learn_blitz_opens_duration_dialog.yaml` | Learn → Quick session → duration picker → timed blitz training |
| `statistics_topics_list_visible.yaml` | Statistics → readiness-by-topic card with topic rows |
| `learn_mistakes_opens_session.yaml` | Learn → Fix mistakes → mistakes monitor empty state (hero + traps/SRS tiles) |
| `learn_srs_opens_session.yaml` | Learn → Smart reviews → empty state (hero + traps/mistakes tiles) |
| `learn_traps_opens_count_dialog.yaml` | Learn → Trap questions → count picker → training |
| `learn_topic_mistakes_mode_available.yaml` | Learn → topic → category-scoped Fix mistakes mode tile |
| `practice_exam_starts_session.yaml` | Practice screen → exam card → exam session |
| `profile_offline_mode_screen_opens.yaml` | Profile → Offline mode screen (Plus) |
| `profile_notifications_switch_visible.yaml` | Profile → notifications switch is visible |
| `profile_support_row_visible.yaml` | Profile → Support (mailto) and Leave a review (Apple / store review) rows are visible |
| `profile_language_screen_opens.yaml` | Profile → Language screen with locale tiles |
| `profile_category_can_switch.yaml` | Profile → Category screen → select A (not only B) |
| `profile_offline_without_plus_opens_paywall.yaml` | Profile → Offline mode row → paywall (free) |
| `paywall_activate_stays_on_paywall.yaml` | Guest Activate on paywall stays on paywall (never App access) |
| `profile_offline_missing_pack_can_download.yaml` | Offline mode → download missing pack (e2e) |
| `profile_offline_incomplete_pack_shows_resume.yaml` | Incomplete pack shows resume + remove |
| `profile_offline_downloading_can_be_stopped.yaml` | Downloading pack can be stopped → incomplete |
| `profile_offline_ready_pack_can_be_removed.yaml` | Ready pack can be removed from device |
| `trainer_offline_missing_pack_is_blocked.yaml` | Trainer → offline gate when no ready pack |
| `trainer_offline_ready_pack_starts_questions.yaml` | Trainer → offline start with ready pack |
| `exam_offline_missing_pack_is_blocked.yaml` | Practice exam → offline gate when no ready pack |
| `exam_offline_ready_pack_starts_session.yaml` | Practice exam → offline start with ready pack |
| `exam_session_category_mismatch_switches_category.yaml` | Direct active exam session → category mismatch → switch and continue |
| `exam_result_category_mismatch_switches_category.yaml` | Direct exam result → category mismatch → switch and load result |
| `trainer_result_screen_opens.yaml` | Direct finished training → result screen → answers review → last question Finish returns to result |
| `trainer_result_work_on_mistakes.yaml` | Failed training result → Work on mistakes opens the mistakes monitor (does not freeze on the question spinner) |
| `exam_answers_category_mismatch_switches_category.yaml` | Direct exam answer review → category mismatch → switch and load review |
| `trainer_random_mode_starts_questions.yaml` | Trainer modes → count picker → first question |
| `trainer_first_answer_shows_feedback.yaml` | Trainer question → first answer → feedback sheet (wrong → Зрозуміло / correct → Наступне питання); question, options and explanation scroll as one block while the CTA stays pinned; sign codes in the explanation open the sign plate popup |
| `trainer_exit_then_start_is_fresh.yaml` | Answer → finish training → start again → first unanswered question (not resumed) |
| `trainer_empty_close_then_start_is_fresh.yaml` | Close unanswered trainer → start again at question 1 |
| `blitz_exit_then_start_is_fresh.yaml` | Answer blitz → Finish → start again at question 1 |
| `traps_exit_then_start_is_fresh.yaml` | Answer traps → Finish → start again at question 1 |
| `trainer_random_answer_covers_all_question_topics.yaml` | Random training answer closes every assigned topic card |
| `topic_training_answer_covers_all_question_topics.yaml` | Topic training closes every assigned card while the question remains new in another topic queue |
| `signs_training_starts_from_tab.yaml` | Signs tab → train all → sign test session |
| `signs_category_training_starts.yaml` | Direct sign category bootstrap → category training |
| `signs_directional_category_opens.yaml` | Direct bootstrap into directional signs (E) |
| `signs_first_answer_shows_feedback.yaml` | Sign test → first answer → feedback sheet (wrong → Зрозуміло / correct → Наступне питання) |
| `signs_exit_then_start_is_fresh.yaml` | Answer sign test → close → start again at question 1 |
| `signs_detail_forward_keeps_chrome.yaml` | Sign detail → Forward pages content only; header and bottom nav stay |

Shared steps live in:

- `subflows/complete_onboarding.yaml` for the real first-run onboarding smoke
- `subflows/launch_onboarded_destination.yaml` for fast bootstrap into an onboarded state
- `subflows/start_default_question_count.yaml` for accepting the default count picker
- `subflows/start_exam_from_home.yaml` for Home → Exam tile → official simulator session
- `subflows/confirm_training_exit_to_home.yaml` for Finish on the training/exam exit dialog
- `subflows/answer_first_available_option.yaml` for generic “answer first option” steps

Supported bootstrap destinations: `home`, `learn`, `practice`, `profile`, `statistics`, `signs`, `signs-category`, `topic`, `topics`, `trainer-modes`, `exam-session`, `exam-result`, `exam-answers`, `question-result`, `question-result-failed`.

## Writing new flows

1. Add a stable `testID` on the interactive element (prefer `id:` selectors).
2. Describe the scenario in a short comment (`Feature` / `Scenario`).
3. Use `subflows/launch_onboarded_destination.yaml` for any scenario that does not need to re-test onboarding itself.
4. Pass `DESTINATION` / `TARGET_ID` through `runFlow.env` so each new flow lands on the screen it cares about.
5. Override `LOCALE`, `CATEGORY`, `DAYS_UNTIL_EXAM`, `EXAM_COUNTRY` (`PL` / `CZ`), `SIGN_CATEGORY_ID`, and `TOPIC_ID` only when the scenario needs them.
6. Use `PLUS_ACCESS`, `QUESTION_SCENARIO` (`topic-progress`), `REACHABILITY`, `OFFLINE_PACK_STATUS` (`missing` / `ready` / `incomplete` / `downloading`), `OFFLINE_PACK_CATEGORY`, `EXAM_SESSION_STATUS`, `EXAM_SESSION_CATEGORY`, and `EXAM_START_ORDER` for deterministic E2E-only state overrides.
7. Reuse `subflows/start_default_question_count.yaml` anywhere a trainer or signs picker opens before practice starts.
8. Practice answers can use generic selectors like `question-choice-index-0` and `sign-test-option-index-0`, so flows do not depend on catalog data.
9. Keep `subflows/complete_onboarding.yaml` only for fresh-install onboarding coverage.
10. The native App Store / Play review sheet is skipped in e2e builds (`EXPO_PUBLIC_E2E_TEST_MODE`). Do not assert that system dialog. Result flows (`trainer_result_screen_opens`, `exam_result_*`) are the regression that a prompt cannot cover the result UI.

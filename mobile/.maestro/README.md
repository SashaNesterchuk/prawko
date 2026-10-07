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
# 30-minute free-user wander (excluded from the default suite):
pnpm test:e2e:explore
# interactive recorder / inspector:
pnpm test:e2e:studio
```

## Flows

| Flow | What it covers |
| --- | --- |
| `onboarding_completes_and_lands_on_home.yaml` | Category → exam date continue without a date → Today roadmap and readiness card (no first-start spotlight, no old tiles) |
| `onboarding_skip_exam_date_leaves_date_unset.yaml` | Skip exam date → Home exam-date card → Profile shows unset date |
| `home_first_start_spotlight_starts_training.yaml` | First-start Home (`FIRST_START`) does not show the spotlight; empty readiness card starts 10-question untimed Quick check (`initial_diagnostic`) |
| `home_first_start_skip_shows_home_tiles.yaml` | First-start Today without spotlight → readiness card starts the assessment |
| `home_today_done_hides_card.yaml` | Finished daily 10 → Home has no today-start card; result hides New attempt |
| `home_first_start_dim_dismisses_spotlight.yaml` | First-start Today has no dimmed spotlight overlay; readiness card is visible, old tiles are not |
| `diagnostic_result_continue_shows_reminder.yaml` | Finished first diagnostic → Continue → reminder prompt → Not now → Home |
| `diagnostic_result_work_on_mistakes.yaml` | Finished first diagnostic → Work on mistakes opens the mistakes monitor |
| `home_opens_trainer_modes.yaml` | Learn → Trainer tile, unique learned coverage card |
| `home_blitz_opens_duration_dialog.yaml` | Learn → Quick session → duration picker → timed blitz training |
| `home_readiness_assessment_starts_training.yaml` | Learn empty readiness CTA (not on Today; no period-change badge, never stuck on the loading skeleton) → untimed Quick check (not exam / Training) |
| `home_traps_opens_count_dialog.yaml` | Learn → Traps tile → count picker → training |
| `home_exam_starts_session.yaml` | Learn → Exam tile → official 32-question simulator (no count picker) |
| `home_exam_date_unset_opens_calendar.yaml` | Skip exam date → Profile missing row → calendar today → confirm shows the set row |
| `home_exam_date_set_stays_visible.yaml` | Onboarded Profile shows the set exam date and reopens the calendar |
| `home_contextual_hidden_for_new_user.yaml` | First-start Home does not show the retention/completion card |
| `home_contextual_mistakes_opens_session.yaml` | Today is the roadmap; the old next-action card is not shown |
| `home_contextual_completion_shows_once.yaml` | The old completion card is not on the Today roadmap |
| `home_contextual_resume_opens_session.yaml` | An in-progress daily session does not put the old resume card on Today |
| `profile_exam_country_screen_opens.yaml` | Profile → Exam country screen with PL and CZ tiles |
| `profile_exam_country_switch_cz_exam.yaml` | Profile → CZ → language tiles only cs/en → official 25-question eTesty exam |
| `profile_exam_country_switch_back_keeps_pl.yaml` | PL exam progress stays namespaced: CZ exam starts at 25 questions, switching back restores the 32-question WORD exam |
| `exam_empty_close_then_start_is_fresh.yaml` | Unanswered exam close (miss-click) → start again at question 1 |
| `exam_answer_exit_then_new_attempt_is_fresh.yaml` | Answer Q1 → Finish → new attempt starts at question 1 |
| `exam_exit_result_stays_tappable.yaml` | Answer Q1 → Finish (free) → result close stays tappable and returns Home |
| `exam_exit_continue_keeps_question.yaml` | Answer Q1 → Close → Continue stays on question 2 |
| `exam_result_new_attempt_is_fresh.yaml` | Finished exam result → new attempt at question 1 (Plus) |
| `tabs_are_navigable.yaml` | Tab bar: Home / Learn / Signs / Profile |
| `learn_first_topic_opens_trainer_modes.yaml` | Learn tab → unique coverage card → first topic card → trainer modes |
| `learn_blitz_opens_duration_dialog.yaml` | Learn → Quick session → duration picker → timed blitz training |
| `statistics_topics_list_visible.yaml` | Statistics → readiness-by-topic card with topic rows |
| `learn_mistakes_opens_session.yaml` | Learn → Fix mistakes → mistakes monitor empty state (hero + traps/SRS tiles) |
| `learn_srs_opens_session.yaml` | Learn → Smart reviews → empty state (hero + traps/mistakes tiles) |
| `learn_traps_opens_count_dialog.yaml` | Learn → Trap questions → count picker → training |
| `monetization_v2_learn_premium_gates.yaml` | V2 free Learn: Smart reviews, Trap questions, and topics after the free slice open the paywall; the first topic still opens trainer modes |
| `roadmap_later_step_opens_without_previous.yaml` | Home: the next free roadmap lesson opens without finishing the previous one |
| `roadmap_exam_simulator_starts_session.yaml` | Plus Home: the final Exam simulator step starts the official 32-question exam |
| `roadmap_plus_shows_rating.yaml` | Plus Home: bottom card asks for a rating instead of the unlock offer |
| `monetization_v2_roadmap_premium_step.yaml` | V2 free Home: a premium roadmap lesson opens the paywall |
| `monetization_v2_roadmap_plus_opens_lesson.yaml` | V2 Premium: the same roadmap lesson opens training |
| `monetization_v2_statistics_topic_opens_paywall.yaml` | V2 free Statistics: a topic outside the free slice opens the paywall |
| `learn_topic_mistakes_mode_available.yaml` | Learn → topic → category-scoped Fix mistakes mode tile |
| `practice_exam_starts_session.yaml` | Practice screen → exam card → exam session |
| `profile_offline_mode_screen_opens.yaml` | Profile → Offline mode screen (Plus) |
| `profile_notifications_switch_visible.yaml` | Profile → notifications switch is visible |
| `profile_support_row_visible.yaml` | Profile → Support (mailto) and Leave a review (Apple / store review) rows are visible |
| `profile_language_screen_opens.yaml` | Profile → Language screen with locale tiles |
| `profile_category_can_switch.yaml` | Profile → Category screen → select A (not only B) |
| `profile_offline_without_plus_opens_paywall.yaml` | Profile → Offline mode row → paywall (free) |
| `paywall_activate_stays_on_paywall.yaml` | Guest Activate on paywall stays on paywall (never App access) |
| `paywall2_renders_and_closes.yaml` | PL subscription layout (`/paywall2`): weekly/monthly/3-month plans without lifetime claims, subscription FAQ, unavailable checkout stays on screen, sticky bar, comparison, final CTA + restore, Close → Home |
| `paywall_country_billing_flows.yaml` | English Home/Profile copy and `/paywall` routing: PL subscriptions, unchanged CZ/SK lifetime; billing follows country, not UI language |
| `premium_after_ad_shows_teaser.yaml` | A dismissed ad does not open the premium bottom sheet or paywall |
| `premium_training_result_hides_teaser.yaml` | Finished training result does not show the Premium teaser or paywall |
| `premium_exam_result_opens_paywall.yaml` | Completed exam renders the result and then opens paywall directly |
| `monetization_v2_profile_opens_paywall.yaml` | V2 free profile banner opens the existing paywall |
| `monetization_v2_second_exam_opens_unlock_sheet.yaml` | V2 second exam opens the paywall directly, not the rewarded unlock sheet |
| `monetization_v2_plus_exam_starts.yaml` | V2 Premium starts an exam with no unlock sheet |
| `monetization_v2_training_limit_opens_paywall.yaml` | V2 training with the free question quota used opens the paywall |
| `monetization_v2_explanation_locks.yaml` | CZ free topic: first answer hides the explanation and opens the paywall |
| `monetization_v2_pl_free_topic_explanation.yaml` | PL free topic: first answer shows the explanation, marks it Premium, and that mark opens the paywall |
| `explore/blogger_session.yaml` | V2 free user wanders Home, training, a short exam, signs, profile and paywall for 30 minutes. Tag `explore`, excluded from `pnpm test:e2e`. Run `pnpm test:e2e:explore` |
| `profile_offline_missing_pack_can_download.yaml` | Offline mode → download missing pack (e2e) |
| `profile_offline_incomplete_pack_shows_resume.yaml` | Incomplete pack shows resume + remove |
| `profile_offline_downloading_can_be_stopped.yaml` | Downloading pack can be stopped → incomplete |
| `profile_offline_ready_pack_can_be_removed.yaml` | Ready pack can be removed from device |
| `offline_sk_pack_download_opens_signs.yaml` | SK Plus downloads the offline pack, then the Signs tab still opens |
| `trainer_offline_missing_pack_is_blocked.yaml` | Trainer → offline gate when no ready pack |
| `trainer_offline_ready_pack_starts_questions.yaml` | Trainer → offline start with ready pack |
| `exam_offline_missing_pack_is_blocked.yaml` | Practice exam → offline gate when no ready pack |
| `exam_offline_ready_pack_starts_session.yaml` | Practice exam → offline start with ready pack |
| `exam_session_category_mismatch_switches_category.yaml` | Direct active exam session → category mismatch → switch and continue |
| `exam_result_category_mismatch_switches_category.yaml` | Direct exam result → category mismatch → switch and load result |
| `trainer_result_screen_opens.yaml` | Stored training result → full review → Finish → reopen review → Back → new attempt starts fresh |
| `trainer_result_work_on_mistakes.yaml` | Failed training result → Work on mistakes opens the mistakes monitor (does not freeze on the question spinner) |
| `exam_answers_category_mismatch_switches_category.yaml` | Direct exam answer review → category mismatch → switch and load review |
| `trainer_random_mode_starts_questions.yaml` | Trainer modes → count picker → first question |
| `trainer_first_answer_shows_feedback.yaml` | Trainer question → first answer → feedback sheet (wrong → Зрозуміло / correct → Наступне питання); question, options and explanation scroll as one block while the CTA stays pinned; sign codes in the explanation open the sign plate popup |
| `trainer_exit_then_start_is_fresh.yaml` | Answer → finish training → start again → first unanswered question (not resumed) |
| `trainer_exit_stays_tappable.yaml` | Answer → Finish (free) → Home stays tappable |
| `trainer_empty_close_then_start_is_fresh.yaml` | Close unanswered trainer → start again at question 1 |
| `blitz_exit_then_start_is_fresh.yaml` | Answer blitz → Finish → start again at question 1 |
| `traps_exit_then_start_is_fresh.yaml` | Answer traps → Finish → start again at question 1 |
| `trainer_random_answer_covers_all_question_topics.yaml` | Random training answer closes every assigned topic card |
| `topic_training_answer_covers_all_question_topics.yaml` | Topic training closes every assigned card while the question remains new in another topic queue |
| `signs_slovak_tab_opens.yaml` | SK exam country bootstrap → Signs tab and hub are visible |
| `signs_training_starts_from_tab.yaml` | Signs tab → train all → sign test session |
| `signs_category_training_starts.yaml` | Direct sign category bootstrap → category training |
| `signs_directional_category_opens.yaml` | Direct bootstrap into directional signs (E) |
| `signs_first_answer_shows_feedback.yaml` | Sign test → first answer → feedback sheet (wrong → Зрозуміло / correct → Наступне питання) |
| `signs_exit_then_start_is_fresh.yaml` | Answer sign test → close → start again at question 1 |
| `signs_exit_stays_tappable.yaml` | Answer sign test → close (free) → Signs hub stays tappable |
| `signs_detail_forward_keeps_chrome.yaml` | Sign detail → Forward pages content only; header and bottom nav stay |

Shared steps live in:

- `subflows/complete_onboarding.yaml` for the real first-run onboarding smoke
- `subflows/launch_onboarded_destination.yaml` for fast bootstrap into an onboarded state
- `subflows/start_default_question_count.yaml` for accepting the default count picker
- `subflows/start_exam_from_home.yaml` for Home → Exam tile → official simulator session
- `subflows/confirm_training_exit_to_home.yaml` for Finish on the training/exam exit dialog
- `subflows/dismiss_interstitial_if_present.yaml` after a free-user session end that may show a test interstitial
- `subflows/answer_first_available_option.yaml` for generic “answer first option” steps

Supported bootstrap destinations: `home`, `learn`, `practice`, `profile`, `statistics`, `signs`, `signs-category`, `topic`, `topics`, `trainer-modes`, `exam-session`, `exam-result`, `exam-answers`, `question-result`, `question-result-failed`, `diagnostic-result`.

## Writing new flows

1. Add a stable `testID` on the interactive element (prefer `id:` selectors).
2. Describe the scenario in a short comment (`Feature` / `Scenario`).
3. Use `subflows/launch_onboarded_destination.yaml` for any scenario that does not need to re-test onboarding itself.
4. Pass `DESTINATION` / `TARGET_ID` through `runFlow.env` so each new flow lands on the screen it cares about.
5. Override `LOCALE`, `CATEGORY`, `DAYS_UNTIL_EXAM`, `EXAM_COUNTRY` (`PL` / `CZ`), `SIGN_CATEGORY_ID`, and `TOPIC_ID` only when the scenario needs them.
6. Use `PLUS_ACCESS`, `ENABLE_ADS` (`true` only on freeze-regression flows), `FIRST_START` (`true` for an empty first-start Home; the Home spotlight call site is currently commented out), `HOME_DAILY` (`done` / `in_progress` to seed today’s 10-question set), `HOME_CONTEXTUAL` (`mistakes` / `completion` for the Home retention card), `QUESTION_SCENARIO` (`topic-progress`), `REACHABILITY`, `OFFLINE_PACK_STATUS` (`missing` / `ready` / `incomplete` / `downloading`), `OFFLINE_PACK_CATEGORY`, `EXAM_SESSION_STATUS`, `EXAM_SESSION_CATEGORY`, `EXAM_START_ORDER`, `TRAINING_COMPLETED_LIFETIME`, `PREMIUM_TEASER_MOMENT` (`after_ad` / `app_open` to seed the Premium teaser without waiting for a native interstitial), and `MONETIZATION_V2` (`true` opts into free limits; default `false` keeps the current ads/paywall model). With V2: `FREE_EXAM_USED`, `FREE_QUESTIONS_EXHAUSTED`, `EXPLANATIONS_EXHAUSTED`. Default onboarded bootstrap skips the first-start spotlight.
7. Reuse `subflows/start_default_question_count.yaml` anywhere a trainer or signs picker opens before practice starts.
8. Practice answers can use generic selectors like `question-choice-index-0` and `sign-test-option-index-0`, so flows do not depend on catalog data.
9. Keep `subflows/complete_onboarding.yaml` only for fresh-install onboarding coverage.
10. The native App Store / Play review sheet is skipped in e2e builds (`EXPO_PUBLIC_E2E_TEST_MODE`). Do not assert that system dialog. Result flows (`trainer_result_screen_opens`, `exam_result_*`) are the regression that a prompt cannot cover the result UI.
11. AdMob is off in e2e unless the flow sets `ENABLE_ADS: "true"`. Those flows (`exam_exit_result_stays_tappable`, `trainer_exit_stays_tappable`, `signs_exit_stays_tappable`) then run `subflows/dismiss_interstitial_if_present.yaml` and assert the destination stays tappable. Google test ads may no-fill; the freeze still fails the following tap.

## Analytics Regression Expectations (Schema 2)

UI assertions alone do not validate analytics. When a local collector is enabled,
compare the same run's capture dump against these expectations, sorting within
`app_run_id` by `event_sequence`, not JSONL arrival order:

| Flow | Expected telemetry |
|---|---|
| `trainer_result_screen_opens.yaml` | Stored attempt: no started/resumed/completed; result_viewed has existing_result. Two review IDs, five then one question views; closes finished then back. New attempt has a different training_session_id and one started |
| `trainer_random_answer_covers_all_question_topics.yaml` | One started → question_viewed → answered → feedback_continued → completed; one training_session_id throughout; result_origin=new_completion |
| `trainer_offline_missing_pack_is_blocked.yaml`, `exam_offline_missing_pack_is_blocked.yaml` | learning_access_blocked(missing_ready_pack) → block_action(open_offline_mode); same block_id; no session start before access is allowed |
| `exam_*_category_mismatch_switches_category.yaml` | mismatch_viewed → action(switch_category) → settings_changed(category) → mismatch_resolved; same mismatch_id and exam_session_id |
| `profile_offline_without_plus_opens_paywall.yaml` | profile_action_selected(offline_mode) → paywall_viewed(source=offline_mode, surface=profile_offline_row) |
| `paywall_activate_stays_on_paywall.yaml` | With an unconfigured SDK: paywall_cta_selected(purchase) → paywall_checkout_blocked(not_configured); no purchase_started |
| `learn_blitz_opens_duration_dialog.yaml`, `signs_training_starts_from_tab.yaml` | setup_viewed → setup_resolved(start); same setup_id and correct feature/dialog_kind |

Training lifecycle and gate-to-paywall context also have Jest regression fixtures.
The 2026-10-02 analytics changes were not executed in Jest, Maestro or a build, at
the user's request. These are expected contracts, not recorded passing results.

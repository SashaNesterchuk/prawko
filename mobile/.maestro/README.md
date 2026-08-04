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
| `home_opens_trainer_modes.yaml` | Home → Trainer tile |
| `tabs_are_navigable.yaml` | Tab bar: Home / Learn / Signs / Profile |
| `learn_first_topic_opens_trainer_modes.yaml` | Learn tab → first topic card → trainer modes |
| `practice_exam_starts_session.yaml` | Practice screen → exam card → exam session |
| `trainer_random_mode_starts_questions.yaml` | Trainer modes → count picker → first question |
| `trainer_first_answer_shows_feedback.yaml` | Trainer question → first answer → feedback sheet |
| `signs_training_starts_from_tab.yaml` | Signs tab → train all → sign test session |
| `signs_category_training_starts.yaml` | Direct sign category bootstrap → category training |
| `signs_first_answer_shows_feedback.yaml` | Sign test → first answer → feedback sheet |

Shared steps live in:

- `subflows/complete_onboarding.yaml` for the real first-run onboarding smoke
- `subflows/launch_onboarded_destination.yaml` for fast bootstrap into an onboarded state
- `subflows/start_default_question_count.yaml` for accepting the default count picker
- `subflows/answer_first_available_option.yaml` for generic “answer first option” steps

Supported bootstrap destinations: `home`, `learn`, `practice`, `profile`, `statistics`, `signs`, `signs-category`, `topic`, `topics`, `trainer-modes`.

## Writing new flows

1. Add a stable `testID` on the interactive element (prefer `id:` selectors).
2. Describe the scenario in a short comment (`Feature` / `Scenario`).
3. Use `subflows/launch_onboarded_destination.yaml` for any scenario that does not need to re-test onboarding itself.
4. Pass `DESTINATION` / `TARGET_ID` through `runFlow.env` so each new flow lands on the screen it cares about.
5. Override `LOCALE`, `CATEGORY`, `DAYS_UNTIL_EXAM`, `SIGN_CATEGORY_ID`, and `TOPIC_ID` only when the scenario needs them.
6. Reuse `subflows/start_default_question_count.yaml` anywhere a trainer or signs picker opens before practice starts.
7. Practice answers can use generic selectors like `question-choice-index-0` and `sign-test-option-index-0`, so flows do not depend on catalog data.
8. Keep `subflows/complete_onboarding.yaml` only for fresh-install onboarding coverage.

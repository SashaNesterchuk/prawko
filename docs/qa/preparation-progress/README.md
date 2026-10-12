# Roadmap preparation card — 11 October 2026

Only the roadmap's top card now shows global unique-question coverage. Lesson pools, section percentages, rings, and readiness scores on other screens are unchanged by this change.

The active bank is the existing country/category catalog. Each ID is counted once from `questionUserState`, which is shared by accepted training and local exam answers. Latest unresolved wrong uses the existing `isQuestionUnresolvedWrong` predicate used by the mistakes overview and `wrong_answers` pool. No discrepancy was found in that criterion or the actual selected pool; a repeated wrong remains one question and a correction removes it.

Coverage is `(correct + wrong) / total`. Segment widths use unrounded fractions. The displayed percent is rounded, except positive values below 1% show `<1%`. Zero mistakes has no arrow or practice action. Nonzero mistakes uses the same Premium entry gate as Learn, then the existing mistakes screen. Hydration/catalog loading uses the existing skeleton; a country/category change waits for a new catalog version before presenting numbers.

## Evidence

Screenshots use an E2E bank of three questions on iPhone SE (3rd generation), iOS 26.0, 375 × 667 points:

- `card-iphone-se.png`: one correct, one wrong, one unanswered → 67%, three equal segments.
- `card-corrected-iphone-se.png`: correction → two correct, zero wrong, one unanswered → still 67%.
- `card-german-iphone-se.png`: longest localized title, all three questions wrong → 100% red.

Automated checks:

- Preparation calculation: unique answers, repeated wrong, correction, active-bank replacement, retired questions ignored, duplicate IDs, empty bank, exact 0.4% width and `<1%` presentation.
- Preparation, existing local exam-progress, readiness-score and roadmap-lesson checks passed (37 tests across the four suites, including the additional exact-fraction test).
- Five Maestro flows passed together: preparation progress; category/country/Premium; first-start zero card (two entry fixtures); daily-session coverage without a resume label.
- Final native rerun after constraining long-title width: all three flows passed (`home_preparation_context_and_gate`, `home_preparation_progress`, `roadmap_correct_answer_progress`), including lesson correction and restart persistence. Six distinct Maestro flows passed across both runs. Final run artifacts: `/private/tmp/preparation-verified-se/2026-10-11_002448`.

## Limits

Full TypeScript checking is blocked by six unrelated existing errors: missing `categoryId` in signs navigation, nullable exam snapshot, `titleEn` narrowed to `never`, two nullable trainer counts, and duplicate sign-test JSX attributes. No error points to this card or its new calculation/localization.

Native verification uses an iOS E2E build with a deterministic fixture bank, not a production bank or a real purchase. Android and large accessibility text sizes were not run. Initial runs on the shared iPhone 17 Pro were invalidated by another concurrent test reinstalling/restarting the app; final runs use a separate SE simulator.

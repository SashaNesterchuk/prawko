# CZ: progress rings and first-step animation

Verified on 10 October 2026, iPhone 17 Pro simulator, iOS 26.0.

## Behavior

- CZ now uses the same roadmap lesson coverage as PL/SK: each question correctly answered at least once fills its part of the ring; mistakes do not. A check appears only at 100%.
- Reopening an incomplete lesson offers its remaining questions. Progress belongs to that specific country, category and step; completing step 3 does not fill step 1.
- A fresh learner sees the existing double bounce on the first step. Opening and closing a lesson without answering keeps it; the first accepted answer, even a wrong one, permanently stops it. Historical learners do not receive the hint. The existing Reduce Motion behavior is preserved.
- Old CZ session-completion flags alone no longer produce lesson checks. They cannot establish correct-answer coverage. Overall answer statistics remain intact.
- CZ result-screen mistake navigation remains unchanged. PL/SK focused mistakes and diagnostic-resume behavior have not been expanded to CZ.

## Verification

- 55 Jest tests passed across 8 suites: Home/roadmap logic and onboarding routing, including CZ coverage and isolation regressions.
- All 4 native Maestro flows passed with `EXAM_COUNTRY=CZ` in 2m 6s: correct-answer progress, step isolation and hint lifecycle, CZ mistake-screen navigation, fresh first-step animation preview.
- Native screenshots inspected: partial ring after mistakes; check after correcting the remaining question; step 3 checked while step 1 stays empty.
- TypeScript still reports the same six existing errors in signs/category routing, local-exam, question-topics/catalog, TrainerModesView and SignTestSessionScreen. No new errors observed.

## Evidence

- [Partial coverage](cz-partial-progress.png)
- [100% coverage](cz-completed-progress.png)
- [Step isolation](cz-third-only-completed.png)
- Raw Maestro command reports and logs: `2026-10-10_215025/`.
- Animation uses the same previously inspected double-bounce component; motion evidence is in `../qa-first-step-nudge-2026-10-10/first-step-double-bounce.mp4`.

# Home/roadmap analytics QA — 11 October 2026

Added three canonical events: Home preparation action selection, actual first-step double-bounce exposure, committed lesson progress changes with completion/reopening transitions. Existing answers, sessions, onboarding and resets retain their analytics.

Verified native iPhone 17 Pro / iOS 26.0 using the existing Metro/E2E build and local collector. `home_preparation_progress.yaml` passed; `roadmap_correct_answer_progress.yaml` passed after replacing one obsolete textual-arrow selector with the current chevron selector.

The curated capture contains 19 valid events: 4 preparation actions (statistics/mistakes), 3 nudge exposures across fresh mounted hints/runtimes and 12 lesson coverage changes, including completion, new-error reopening, restart persistence and correction back to completion. The stream includes the aborted selector run's valid partial observations. No fake completion is emitted on hydration/reset; unchanged answers are silent. All answer-driven progress changes join their source question and training session.

67 tests passed across 9 suites. TypeScript retains the same six pre-existing errors elsewhere. The content-invalidation regression also confirms that catalog changes do not attach an unrelated training session.

Recheck the capture with `node mobile/scripts/check-home-roadmap-analytics.mjs docs/analytics/qa-home-roadmap-analytics-2026-10-11/captured-events.jsonl`. Product contracts are documented in `docs/analytics/keys.md` and `payload-contracts.md`.

This verifies actual client emission, enriched payloads, validation and local receipt. Metro/E2E intentionally does not send events to production PostHog; production receipt requires shipping the updated app.

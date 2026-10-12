# Roadmap: latest-answer green/red ring

10 October 2026. Applies to PL, CZ and SK.

Each question in a fixed country/category/step lesson pool uses its latest accepted answer: correct is green, incorrect is red, unanswered is gray. Segment lengths use unique question counts divided by the full lesson pool, including when an access quota shortens a session. No percentage text is shown inside the circle.

A check requires every question to be correct and no unresolved mistakes. A later wrong answer removes previous correct coverage and the check. Correcting that question replaces red with green. Reopening an incomplete lesson offers only remaining incorrect/unanswered questions. Step attribution, the first-step double bounce and official exam behavior remain unchanged.

Persisted roadmap state is version 2. Existing version-1 correct coverage is retained; the old store did not retain wrong-answer coverage, so historical red portions cannot be reconstructed from it. New accepted wrong answers are persisted. The version-0 ambiguous overlapping-coverage migration still runs only for version-0 data.

Verification:

- 54 Jest tests passed in 7 Home/roadmap suites, including completion → mistake → correction for PL/CZ/SK and explicit green/red/gray counts.
- Native iPhone 17 Pro / iOS 26.0: both Maestro flows passed with CZ in 1m 57s. Assertions covered green 67% / red 33%, correction to check, losing the check after a new error, error persistence after restart, restoring the check, step isolation and animation lifecycle.
- Native partial-ring screenshot inspected: adjacent red and green arcs, no check or percentage inside. [Screenshot](two-color-ring.png).
- TypeScript: the same six existing errors remain (sign-category routing, local-exam nullability, topic catalog, two TrainerModesView errors, duplicate SignTestSessionScreen attribute); no additional errors observed.
- Raw native reports: `CZ/2026-10-10_220112/`.

# Prawko mobile — agent guide

These instructions apply to all work under `mobile/`. Read the repository root
`AGENTS.md` too. This guide records product invariants, code ownership and how
to measure improvements; it is not a replacement for the implementation.
When behavior changes intentionally, update the relevant contracts and this
guide in the same change. Historical plans and test filenames may describe
obsolete behavior: inspect the current code and assertions before using them.

## Product purpose and improvement goals

Prawko helps learners prepare for the driving theory exam in Poland, Czechia
and Slovakia. The core loop is: choose exam country/category and a learning
plan → practice → understand mistakes → review → simulate the official exam.
Premium, school access, advertisements and offline packs support that loop.

Evaluate improvements through learner outcomes as well as revenue:

- Activation: accepted onboarding, arrival on Home, first usable question,
  first answer and a meaningful completed learning attempt.
- Learning: unique question coverage, mistakes reviewed, repeated mistakes,
  review use, exam outcomes and return to meaningful learning.
- Reliability: successful starts, readiness latency, media failures, interrupted
  sessions, offline recovery and usable feedback after an operation fails.
- Monetization: eligible gate exposure, usable offers, checkout outcomes,
  confirmed access, restoration and return to the intended learning action.
- Retention: learning return by cohort, rather than only SDK app opens.

Readiness is a product estimate, not a guarantee of passing the official exam.
More events, more screen views or more paywall impressions alone are not proof
of a better product. State the measurable hypothesis before changing a flow.

## Start here

| Work area | Read first |
| --- | --- |
| Navigation and providers | `app/_layout.tsx`, `src/providers/AppProviders.tsx`, `app/(tabs)/_layout.tsx` |
| Country/category/language | `src/state/app-shell.ts`, `src/countries/`, `../packages/config/src/countries/` |
| Home and learning entry | `app/(tabs)/index.tsx`, `app/(tabs)/learn.tsx`, `src/features/home/`, `../docs/today-screen-product-direction.md` |
| Question practice | `app/question.tsx`, `app/trainer-modes.tsx`, `src/features/questions/`, `src/state/question-progress.ts` |
| Official simulator | `app/exam/`, `src/features/exam/`, country exam configuration |
| Access and payments | `src/state/entitlements.ts`, `src/providers/RevenueCatProvider.tsx`, `src/features/entitlements/`, `../docs/paywall.md` |
| Free gates | `src/features/monetization/v2/`, shared `MONETIZATION_V2` configuration, callers of access decisions |
| Paywall and premium copy | `app/paywall.tsx`, `src/features/paywall2/`, `src/features/monetization/premium-copy.ts` |
| Ads | `src/features/ads/`, `src/features/monetization/monetization-store.ts` |
| Offline | `src/features/offline/`, `app/offline-mode.tsx`, `src/state/question-catalog.ts` |
| Road signs | `src/features/road-signs/README.md`, `app/signs/`, `src/state/sign-practice-progress.ts` |
| Analytics | `src/analytics/catalog.ts`, `src/hooks/useAnalytics.ts`, `../docs/analytics/keys.md` |
| UI acceptance | `.maestro/README.md`, `../.cursor/rules/e2e-with-fixes.mdc` |

## Architecture and implementation conventions

- This is the `@prawko/mobile` pnpm workspace package: Expo, React Native,
  TypeScript, Expo Router, Zustand, i18next, PostHog and RevenueCat.
  Check `package.json` for actual versions and scripts; do not guess them.
- Routes live in `app/`; feature logic lives in `src/features/`; shared state
  lives in `src/state/`; provider wiring lives in `src/providers/`.
- Prefer existing feature helpers and route builders to duplicating policy
  inside a screen. Inspect all callers before changing a shared decision.
- Use `@prawko/config` and `@prawko/schemas` for shared country rules and types.
  Do not hardcode Polish assumptions into shared mobile behavior.
- Reuse `src/portable-ui/` components and their documented conventions.
  Keep learner-facing text in the existing localization system.
- Preserve stable `testID`s. Navigation, disabled states, dismiss actions,
  empty/error/loading states and return paths are part of a feature's behavior.
- Handle asynchronous re-entry, repeated taps, stale responses, unmount and
  app backgrounding explicitly. Reuse operation guards where appropriate.
- Do not let optional analytics failures change access, consume credits,
  suppress rewards, block navigation or turn successful operations into errors.
- Do not put secrets into public Expo environment variables, logs or docs.

## Country, identity and persistence

- Exam country, license category and UI language are distinct dimensions.
  Country determines the question bank, official exam profile and billing
  offer; language determines the available translated presentation.
- Respect supported locales for the chosen country. Review runtime country
  selection, bootstrap, `CountryScopedStores.tsx` and persistence helpers when
  adding a market or changing selection behavior.
- Progress and sessions must retain their country/category/question-set
  context. Switching country must not reinterpret another bank's answers or
  erase the progress restored when switching back.
- The current shipped app has no account creation/login UI. `auth_mode=guest`
  means the normal accountless user, including Premium buyers. Training answers,
  progress and bookmarks are local; do not reintroduce answer uploads or require
  login. Retained auth/cloud code is not an active account product flow.
- `AppShellState.authMode === "supabase"` selects the backend even when signed
  out. It must never be treated as proof of login. Supabase content fetching,
  RevenueCat purchases/restores and product analytics remain active.
- App identity, Supabase account identity, school access and purchase access
  have different lifecycles. Do not assume login grants Premium or logout
  invalidates a store purchase.
- Treat persisted store changes as migrations: inspect hydration, defaults,
  old values, reset behavior and remote synchronization before editing keys.
  Avoid resetting progress as a workaround for a state bug.

## Onboarding, Home and practice

- Settings visits to onboarding routes are not necessarily a new first-run
  onboarding attempt. Preserve flow context and attempt identifiers.
- Saving the local plan, completing onboarding, reaching Home and obtaining
  usable learning content are separate outcomes.
- An unset exam date is valid. Skipping the date must not silently invent one.
- Home/Today is the current roadmap surface. Older spotlight, daily-card and
  contextual-card implementations or filenames do not establish current UI.
- Distinguish `initial_diagnostic`, training modes, timed practice, mistakes,
  saved questions, reviews, trap questions and the official simulator. Use
  configured mode names and existing selection/access helpers.
- Track unique coverage separately from answer counts. Repeated answers to
  the same question must not manufacture new learned coverage.
- Keep result display, session completion, review exposure and starting a new
  attempt separate. Reopening a stored result is not a new completion.
- A fresh attempt must use fresh session state and identifiers. Continuing an
  in-progress attempt must retain its answer position and relevant context.
- Empty pools, country/category mismatch, unavailable catalog and offline
  missing content need explicit outcomes, not an endless loading skeleton.

## Official exams

- Use `src/features/exam/exam-profile.ts` and country configuration for
  question composition, scoring, passing rules, time and navigation.
  Do not reuse a Polish WORD profile for CZ/SK.
- Inspect `exam-launch.ts`, `exam-entry.ts`, local session lifecycle, snapshot
  cache and cloud sync before changing exam start/resume/finish behavior.
- Preserve consistent attempt IDs from start through answers and completion.
  Local completion and later cloud synchronization are separate operations.
- `exam_restart_gate_shown` and `exam_restart_selected` describe the result
  screen's New attempt modal. They do not prove a Home/daily exam cap.
  A modal dismissal alone does not establish that another exam is blocked.
- This distinction does not imply that all current entry paths are ungated:
  inspect V2 access decisions and their actual `/exam` callers separately.
  Never infer enforcement from paywall copy, an old analysis or an event name.
- Preserve country-specific answer navigation, flags, timer behavior, early
  exit and result/review actions when changing shared exam components.

## Premium, free access and payments

Read the current section of `../docs/paywall.md` before changing billing.

| Exam market | `countryConfig.paywallOffer` | `/paywall` behavior |
| --- | --- | --- |
| PL | `plans` | `Paywall2Screen`; auto-renewing weekly, monthly and three-month subscriptions (`P1W`, `P1M`, `P3M`) |
| CZ/SK and other current lifetime markets | `lifetime` | Existing `LegacyPaywallPage`; one-time lifetime Premium |

- Select billing by exam country, never by UI locale or whichever RevenueCat
  package happens to load first. PL in English still uses subscriptions.
- PL must not fall back to lifetime or annual packages if supported plans are
  missing. Keep supported placeholders and disable unavailable checkout.
  A nonempty cache without a supported PL plan is unavailable: refresh on
  paywall focus and app foreground. When the SDK cache has no supported PL plan,
  recover once per load via syncAttributesAndOfferingsIfNeeded, within the
  existing timeout; never poll or add timers for a successful unsupported response.
  Preserve CZ/SK lifetime readiness and never add subscriptions to those flows.
- PL Home/Profile/paywall copy must not promise lifetime, one payment or no
  renewal. Use `premium-copy.ts` for shared subscription/lifetime copy.
- Prices, periods and trial eligibility come from the store. A monthly plan
  is `P1M`, not a contractual fixed 30-day period; three months is not 90 days.
- Preserve existing lifetime entitlement restoration, including in PL.
- Billing offer choice and the `monetizationV2` free-gate flag are separate.
  Do not change one to implement the other.
- Read `usage.ts`, `store.ts`, shared limits and actual callers for quotas,
  free topic slices, explanation access, mistakes/reviews and exam access.
  Do not duplicate quota numbers in screens or infer active gates from dormant
  rewarded-credit fields. Current cohort stamping upgrades installs to V2;
  the retained `legacy` type is not evidence of an active split experiment.
- Keep gate source, surface, blocked operation IDs and post-purchase action
  through `v2/paywall.ts`. Successful access should return to the intended
  action without creating duplicate sessions or answer submissions.
- Checkout belongs to the existing coordinator/journal/recovery logic in
  `src/features/entitlements/`. Preserve attempt IDs, offer snapshots and
  original country/product context across retries, restarts and country changes.
- Purchase cancellation is not a purchase error. A successful SDK call alone
  is not proof that the required entitlement is active.
- Restore with no active entitlement is an empty outcome, not restored access.
  Restoring an existing purchase is not new revenue.
- School access and store purchase access can coexist. Read the entitlement
  store's access helpers instead of implementing a second `isPlus` definition.

## Advertisements and monetization surfaces

- Use the current ad policy and entitlement helpers; eligibility, request,
  loaded, opened, closed, earned reward and paid impression are distinct facts.
- Grant rewarded credit only from the earned-reward outcome, using the
  existing controller. Ad opening or closing is not proof of an earned reward.
- Emit ad revenue from the SDK paid-impression callback; do not estimate it
  from eCPM or count an opened ad as a paid impression.
- Keep placement and scope identifiers consistent across the ad lifecycle.
- Automatic Premium teaser sheets for `app_open` and `after_ad` are currently
  disabled; Home carries the roadmap offer, or rating card for Plus.
  Do not re-enable old teaser sequences based on the historical paywall plan.
- The post-exam automatic paywall is separate: show the result first and
  preserve the current eligibility/cooldown behavior in the monetization store.

## Offline, content and explanations

- Distinguish network reachability, loaded catalog, pack completeness and
  entitlement. An offline-content block is not an entitlement rejection.
- Missing, incomplete, downloading and ready packs need appropriate actions.
  Preserve cancel/resume/remove outcomes and country-specific assets.
- Content readiness does not imply native media readiness. Image/video load,
  playback and buffering have separate observations.
- Keep question-set and content revisions available for diagnosing bank or
  translation changes. Do not log full question text or asset URLs for this.
- For CZ/SK/PL explanation rewrites, follow root `AGENTS.md`,
  `../docs/rewrite-explanations-v2.md` and
  `../scripts/rewrite-explanations-v2/README.md`. Do not create a new pipeline.
  Country packs belong in `packs.py`; applying rows is UPDATE merge, never
  DELETE/INSERT into `question_ai_explanations_v2`.

## Analytics implementation contract

Analytics is a product contract, not scattered debug logging.

1. Use `src/analytics/catalog.ts` for canonical event, screen and property
   names. Reuse `useAnalytics` from `src/hooks/useAnalytics.ts`; do not bypass
   enrichment, sanitization, local logging or build gates with raw SDK capture.
2. Read `../docs/analytics/keys.md` and `payload-contracts.md` before changing
   semantics. Inspect the matching typed payload, validator and capture helper.
3. Add events only for a concrete unanswered product question. Define the
   trigger, grain, required context, correlation ID and outcome interpretation.
4. Emit intent when requested, visibility when actually visible, readiness
   when usable and success when the operation's success condition is confirmed.
   Navigation calls, render passes and policy eligibility are not exposures.
5. Join an operation using its existing IDs: learning intent, session/attempt,
   paywall view, offer load, purchase attempt, restore attempt, media load or
   gate. Do not regenerate an ID at each event or join solely by nearest time.
6. Preserve original operation context across asynchronous completion. Current
   store country/access may differ from the country/access at operation start.
7. Follow existing deduplication and focus/AppState rules. Renders, focus
   returns, retries and stored results must not create false completions.
8. Validation describes observation quality. Invalid/missing analytics
   context must not become a new product guard or suppress an earned reward.
9. Update catalog/contracts/docs and focused tests together. Keep historical
   event meanings intact; version a materially different contract.
10. Expected disabled ad skips and already-prompted review skips are silent.
    Notification sync of an already-disabled empty schedule is silent too;
    retain explicit enable/disable actions, failures, stale schedule IDs and
    enabled-to-disabled transitions. Historical events still describe old builds.

### Identity, context and privacy

- `app_user_id` is the stable local app identity, not a proven unique person.
  Cross-device use can create multiple identities; shared-device use can join
  multiple people. Historic fallback is `distinct_id`, not PostHog `person_id`.
- `supabase_user_id` is an account link. Preserve app identity through guest
  and authenticated use. Do not introduce irreversible aliases for account
  switches without reviewing the identity contract.
- Segment by event-time `exam_country`, category, locale, access and build.
  Today's profile properties cannot reconstruct historical event context.
- Inspect `base-properties.ts` and `runtime-context.ts` for enriched install,
  application/visit/screen, content, policy and access context. SDK lifecycle
  events do not guarantee the same fresh state as product capture.
- GeoIP country is not exam country. Install observation is not necessarily
  a new person, and an identity/access observation is not a purchase.
- Preserve privacy sanitization and bounded diagnostics. Do not send emails,
  credentials, tokens, free-form chat/search text, raw URLs or native exception
  dumps as convenient event properties. Use approved normalized fields.

### Delivery, active time and environment

- `posthog-build-gate.ts` controls production collection. Development, E2E and
  TestFlight are excluded by the existing gate. Do not enable production
  capture to make a local test observable.
- From `mobile/`, `pnpm analytics:local` records the normal capture path to
  `.analytics/session.jsonl` for controlled local verification. Do not commit
  these logs or production JSON dumps.
- SDK sessions/app lifecycle, application visits, screen exposure and active
  learning time are different measurements. Use activity contract checkpoints,
  idle/inactive rules and censored tails; do not sum cumulative checkpoints.
- Backgrounding, crashes or process kill can leave missing outcomes. Missing
  end events are not automatically user abandonment or completed duration.
- Client capture does not prove vendor delivery. Receipt lag, duplicate events,
  incomplete export windows and schema coverage affect analytical confidence.

## Reading analytics and deciding what to improve

Use `../docs/analytics/README.md` as the documentation index. Read the relevant
contract before querying; historical audit findings are hypotheses to recheck.

| Question | Evidence and interpretation |
| --- | --- |
| Where does onboarding fail? | Separate flow view, accepted completion, Home arrival, learning intent and first ready question; retain attempt and settings/first-run context. |
| Why does learning not start? | Join intent, setup, gates, catalog/offline state, launch, readiness and normalized failure; request counts alone are insufficient. |
| Are learners improving? | Compare meaningful attempts, unique coverage, mistake/review behavior and country-specific exam outcomes with equivalent content/cohorts. |
| Is retention improving? | Define cohort anchor, return window and meaningful-learning outcome; generic calendar return/app open is a different metric. |
| Why is paywall conversion low? | Separate visibility, supported offer readiness, CTA, native checkout, confirmed access and resumed learning. Empty offers at first render may still be loading. |
| Did a restore work? | Use canonical `purchase_restore_*` outcomes and attempt IDs; do not sum legacy `restore_*` copies of the same operation. |
| Did revenue increase? | Use RevenueCat ledger/server financial evidence and SDK paid ad impressions; client purchase/access events alone are not net revenue. |
| Did reminders or acquisition work? | OS response/schedule resolution, ASA attribution, install observation and spend are separate facts; schedule success is not delivery. |

For every analytical recommendation:

- Define the unit (identity, visit, attempt, question, offer view or transaction),
  denominator, ordered funnel, deduplication and observation window.
- State timezone, complete days, build/schema mix, market/category/access
  segments and exclusions for test/internal traffic.
- Apply `data-quality.md` and `payload-contracts.md` eligibility rules. Do not
  invalidate unrelated clean learning evidence because checkout evidence is
  malformed, or reinterpret old events using today's payload contract.
- Distinguish observed facts, interpretation and proposed experiment. Small
  samples, missing events and incomplete days do not establish causality.
- Read `engine.md`, `identity-access.md`, `billing-learning.md`,
  `revenuecat-ledger.md` and acquisition documents when their metric is involved.
- Check `handbook-implementation.md` for remaining coverage and acceptance
  limitations. Controlled helper/hook tests do not prove native rendering,
  OS delivery, real checkout or production dashboard correctness.
- Propose a concrete behavior change, expected learner benefit, primary metric,
  reliability/monetization guardrails and a way to evaluate the result.

## Verification and definition of done

Run commands from `mobile/` unless using an explicit workspace filter:

```bash
pnpm typecheck
pnpm test -- --runInBand <relevant-test-path-or-pattern>
pnpm test:e2e -- .maestro/<relevant-flow>.yaml
pnpm test:e2e:smoke
```

- Read `package.json`, Jest configuration and `.maestro/README.md` for the
  current tooling. Type fixtures belong in included `src/analytics/type-tests/`;
  fixtures in excluded `__tests__` are not evidence of TypeScript acceptance.
- UI/behavior fixes, routes, gates and selector changes require matching
  Maestro coverage in the same change per the root E2E rule. Reuse bootstrap,
  stable `id:` selectors, country/access fixtures and shared subflows.
- Use an E2E-enabled app (`pnpm ios:e2e`, `pnpm android:e2e` or the documented
  EAS profile). Run targeted flows first; broaden for shared behavior changes.
- Update the Maestro flow table when adding, renaming or removing a flow.
  A legacy filename is not a reason to retain an obsolete assertion.
- For instrumentation, verify actual captured sequence and payload context
  with focused tests and local capture where relevant, including retry,
  duplicate/focus return, failure and background cases.
- Billing changes need coverage for PL/CZ/SK, UI-language independence,
  unsupported/missing offers, cancellation, restore and existing entitlements.
- Report native/E2E blockers explicitly. Never present unit adapter tests as
  real purchase, device, notification-delivery or production acceptance.
- Documentation-only changes do not require native builds or Maestro runs.
  Check referenced paths and consistency with the current implementation.
- Finish with what changed, why, what was verified and any remaining limitation.
  Do not claim a product improvement before its outcome has been measured.

# Content And Repeat-Answer Observations

Implemented locally October 7, 2026. This extends analytics and deterministic
reports only. Content, mapper fallbacks, access, exam selection/navigation/scoring
and checkout behavior are unchanged. Native rendering and production delivery
are not verified by the local fixtures.

## Source And Display Contracts

`content_provenance_version=1` distinguishes the selected locale field from the
mapper's declared input locale. A Czech source copied into `ua` remains a Czech
source, not a Ukrainian translation. Equal strings do not establish language
detection. Prompt, choices and explanation are observed independently.

- `content_language` and `explanation_language` retain `selected_text_field`
  semantics. `content_requested_locale` is the actual display request, including
  Spanish requests that select an English field.
- `content_source_language` / `explanation_source_language`, their source kinds
  and bases describe preserved mapper provenance only when its text fingerprint
  still matches. Unknown, stale, failed and old-cache metadata are explicit.
- `choice_source_languages` is a sorted declared source mix;
  `choice_unknown_source_count` retains incomplete choice provenance.
- `question_revision` hashes the existing multilingual question, choices,
  correct answer and scoring/topic descriptors. Provenance metadata itself does
  not change it. `explanation_revision` hashes the multilingual catalogue value.

`explanation_display_observation_version=1` separately observes the actual
rendered value. `explanation_display_revision` hashes that value, not the
multilingual object. `full` and `free_topic_marked` can share text but stay
different variants; the latter is not assumed to be shortened text.
`locked`, `empty` and `not_observed` are never treated as text exposure.
`explanation_display_matches_selected_field=false` prevents borrowing source
language from a different selected catalogue value.

Existing training feedback, training/diagnostic review and exam review events
carry these properties. Analytics dedupe tokens include display locale,
question revision, rendered revision and access variant. This does not change
product review state, access resolution or navigation.

No prompt, choice or explanation text is exported. `content-v1` fingerprints
are stable non-security comparisons, not cryptographic truth, linguistic
detection, server provenance or verification of media bytes.

## Exam Origin

New local exam snapshots retain a protected analytics-only creation marker.
`exam_origin_profile_revision` hashes the selected creation profile;
`exam_session_rules_revision` hashes persisted country/category/mode, question
and point targets, pass threshold, start/expiry-derived duration and navigation.
Scoring/results do not enter this fingerprint.

Capture reads only an existing matching memory snapshot, with no fetch or
storage wait. Missing caches, failed observations, invalid parameters and legacy
origins stay explicit. In particular, current `exam_rules_revision`,
`exam_country` and app `category` are not evidence for an old attempt.
`exam_origin_category` records the persisted attempt's category.

The engine checks declaration consistency by `(app_user_id, exam_session_id)`.
Conflicting parameter signatures/profile revisions, or invalid observations for
that scope, quarantine its observed parameter rows. Another installation with
the same session ID remains separate. Unknown origins are never backfilled from
a known event in the same session. These are consistency checks of client
declarations, not warehouse verification of the original server config or an
installation's entire history.

## Warehouse Diagnostics

`context.content_observations` and `build_health(...).content_observations`
expose the same versioned report for the supplied window:

- Provenance groups retain question/explanation revisions, selected/source
  language, choices and unknown/conflict counters.
- Display groups retain rendered revision, variant, state and selected-value
  agreement independently of the catalogue hash.
- Exam groups retain historical parameter/profile declarations, scoped
  conflicts and cache/legacy unknowns, not today's country config.

Invalid primitive shapes, unsupported versions, malformed fingerprints,
disagreeing nullable states, rejected identifiers and import/client-contract
failures cannot enter clean groups. Only bounded whitelisted metadata is
exported. Diagnostic observation counts are not complete accuracy/report rates.
`content_observations_limited` QA restricts revision-specific conclusions.

## Repeat-Answer Passport

`context.repeat_answers` and health reports use `repeat-answer-v1`.

- Root grain: one installation-scoped accepted baseline logical answer with
  subsequent qualifying explanation/review observations. Repeated views do
  not create more units; additional observations remain counted.
- Join: the latest accepted answer before exposure must match its real session
  and question. Account IDs, person IDs and time proximity never substitute for
  that link. Missing pre-window baselines remain unavailable.
- Exposure: explanation text requires a validated actual text observation.
  Answer review requires a usable answered question and review ID. A locked
  review is question-review exposure, not explanation reading.
- Order: exported event time; equal timestamps require the same `app_run_id`
  and ordered `event_sequence`. Input/export order is not proof.
- Follow-up: the first next distinct logical answer to the same question within
  the half-open seven-day horizon `[exposure, exposure + 7 days)`.
  Business duplicates add no answers. Exam edits of an already
  observed slot are not new repeated questions; update-only histories remain
  `repeat_creation_unobserved`.
- Controls: question revision, requested/selected/source language and choice
  provenance must agree. Changed revisions, language/choices and unknown
  metadata remain separate outcomes instead of skipping to a later clean
  answer. Two exams additionally require matching known historical rules.
- Selection: baseline/repeat mode, first encounter, previous-times-seen and
  Plus context remain explicit, including unknown values. Rendered explanation
  revision/variant and exposure source are retained in each group.
- Horizon: exposure plus seven days must fit inside the supplied window before
  a unit is mature. Nonreturners remain observed units; immature units are
  censored even if an early pair has already been seen.
- Fraction: `mature_repeat_correct_fraction` is correct repeated answers divided
  by mature comparable pairs, not by all learners/exposures. It requires verified
  source coverage and clean join/answer/provenance integrity. Missing baselines,
  conflicts, invalid payloads or uncertain order prohibit it. Observed transition
  counts still remain diagnostic. Contradictory selection primitives/history
  prohibit fractions as well. Samples below 30 mature comparable pairs have a
  low confidence ceiling; even larger samples have at most a medium ceiling.

Wrong/correct transitions describe selected observed pairs. There is no inferred
untreated control cohort, causal explanation/review lift, reading completion,
real-exam outcome or study-duration claim. Baseline/exposure/repeat intervals are
event-time delays only. This is window-scoped analysis, not a complete historical
learner journey.

## Verification And Remaining Acceptance

Python tests cover import/context/health/CLI diagnostics, nullable/version/PII
rejection, source/copy/translation boundaries, display variants, scoped exam
conflicts, repeat order/duplicates/edits, horizon censoring and coverage gates.
Mobile tests cover all 128 mapper locale-presence combinations, old cache JSON
roundtrip, optional failure containment, creation metadata, capture enrichment
and controlled training-review hook wiring.

Controlled hooks are not native rendering/navigation acceptance or proof of SDK
queue delivery. Actual production exports, suitable historical windows, media
bytes/server revision evidence and dashboard consumption still need acceptance.
The rest of audit A-R remains tracked in [handbook-implementation.md](./handbook-implementation.md).

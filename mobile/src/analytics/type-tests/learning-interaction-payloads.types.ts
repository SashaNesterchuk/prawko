import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import type { AnalyticsEventName, AnalyticsExamRestartChoice } from "../catalog";
import type { QuestionSessionEmptyReason } from "../../features/questions/types";
import type { OfflinePackBlockedReason } from "../../features/offline/offline-pack";
import {
  TRAINING_EMPTY_REASONS, OFFLINE_BLOCK_REASONS, type ExamRestartSelectionPayload, type LearningInteractionPayloads,
} from "../learning-interaction-payloads";
import { ANALYTICS_PAYLOAD_CONTRACTS } from "../payload-contract";
import { LEARNING_INTERACTION_FIXTURES as fixtures } from "./learning-interaction-fixtures";

type AssertNever<T extends never> = T;
type RequiredKeys<T> = { [Key in keyof T]-?: {} extends Pick<T, Key> ? never : Key }[keyof T];
type KnownNames = AssertNever<Exclude<keyof LearningInteractionPayloads, AnalyticsEventName>>;
type CoveredKeys = AssertNever<{
  [Event in keyof LearningInteractionPayloads]:
    Exclude<RequiredKeys<LearningInteractionPayloads[Event]>, keyof (typeof ANALYTICS_PAYLOAD_CONTRACTS)[Event]>;
}[keyof LearningInteractionPayloads]>;
type EmptyReasons = AssertNever<Exclude<QuestionSessionEmptyReason, typeof TRAINING_EMPTY_REASONS[number]>>;
type OfflineReasons = AssertNever<Exclude<OfflinePackBlockedReason, typeof OFFLINE_BLOCK_REASONS[number]>>;
type RestartChoices = AssertNever<Exclude<AnalyticsExamRestartChoice, ExamRestartSelectionPayload["choice"]>>;
type RestartAdKeys = AssertNever<Exclude<RequiredKeys<Extract<ExamRestartSelectionPayload, { choice: "watch_ad" }>>,
  keyof typeof ANALYTICS_PAYLOAD_CONTRACTS.exam_restart_selected>>;
export type LearningInteractionCoverage = [KnownNames, CoveredKeys, EmptyReasons, OfflineReasons, RestartChoices, RestartAdKeys];

void function learningInteractionSignatures(track: AnalyticsTrack) {
  track("training_result_viewed", fixtures.training_result_viewed);
  track("exam_answers_review_closed", fixtures.exam_answers_review_closed);
  track("exam_restart_selected", fixtures.exam_restart_selected);
  track("exam_restart_selected", { exam_session_id: "e", source: "exam_result", choice: "plus" });
  track("diagnostic_reminder_shown", { training_session_id: null, has_exam_date: false });
  track("exam_result_action", { exam_session_id: null, mode: null, action: "home" });
  track("exam_question_flag_changed", { exam_session_id: null, question_id: null, question_index: null, question_total: null, is_flagged: true });
  // @ts-expect-error Nullable observation inputs still require an explicit session scope.
  track("exam_result_action", { mode: null, action: "home" });
  // @ts-expect-error Result exposure requires counts and origin, not just a session.
  track("training_result_viewed", { training_session_id: "t", mode: "learning" });
  // @ts-expect-error A stored result exposure is not a third completion origin.
  track("training_result_viewed", { ...fixtures.training_result_viewed, result_origin: "replayed_completion" });
  // @ts-expect-error Result review closes cannot imply learner completion on unmount.
  track("training_answers_review_closed", { ...fixtures.training_answers_review_closed, close_reason: "view_unmounted" });
  // @ts-expect-error Reminder resolution is an intent, not OS permission or delivery.
  track("diagnostic_reminder_resolved", { training_session_id: "t", action: "permission_granted" });
  // @ts-expect-error A zero-answer exit cannot contain accepted answers.
  track("exam_empty_exit", { exam_session_id: "e", mode: "exam", question_total: 5, answered_count: 1 });
  // @ts-expect-error Exam end events are terminal observations.
  track("exam_session_ended", { ...fixtures.exam_session_ended, status: "active" });
  // @ts-expect-error Launch failure stages are actual producer operations.
  track("exam_start_failed", { ...fixtures.exam_start_failed, launch_step: "purchase" });
  // @ts-expect-error Watch-ad selection needs the observed show result, not a guessed reward.
  track("exam_restart_selected", { exam_session_id: "e", source: "exam_result", choice: "watch_ad" });
  // @ts-expect-error The restart event describes result-screen actions, not a Home daily cap.
  track("exam_restart_gate_shown", { exam_session_id: "e", source: "home_daily_cap" });
  // @ts-expect-error Offline blocking is not an entitlement/paywall outcome.
  track("learning_access_blocked", { ...fixtures.learning_access_blocked, blocked_reason: "premium_required" });
  // @ts-expect-error Category mismatch action is not proof that the category was switched.
  track("exam_category_mismatch_action", { ...fixtures.exam_category_mismatch_action, action: "switch_succeeded" });
  // @ts-expect-error Review payload cannot broaden the literal result event.
  track("exam_result_viewed", fixtures.exam_answers_review_question_viewed);
};

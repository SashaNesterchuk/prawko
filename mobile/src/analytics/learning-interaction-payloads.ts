import type { DrivingCategory, QuestionSessionMode } from "@prawko/config";
import type { ExamSimulatorMode, RemoteExamSessionStatus } from "../features/exam/types";
import type { ExamResultOutcome } from "../features/exam/exam-result-stats";
import type { QuestionSessionEmptyReason } from "../features/questions/types";
import type { OfflinePackBlockedReason } from "../features/offline/offline-pack";
import type { TrainingResultOrigin } from "./training-lifecycle";

export const TRAINING_EMPTY_REASONS = [
  "saved_empty", "new_questions_empty", "weak_spots_empty", "hard_questions_empty", "high_points_empty",
  "review_due_empty", "seen_not_mastered_empty", "wrong_answers_empty", "topic_empty", "general_empty",
] as const satisfies readonly QuestionSessionEmptyReason[];
export const EXAM_END_REASONS = ["learner_finish", "timer_elapsed", "user_ended_early", "dev_skip", "unknown"] as const;
export const EXAM_LAUNCH_STEPS = ["fetch_active_session", "abandon_previous_session", "start_session"] as const;
export const OFFLINE_BLOCK_REASONS = [
  "download_incomplete", "missing_ready_pack", "pack_for_other_category",
] as const satisfies readonly OfflinePackBlockedReason[];
type TrainingScope = { training_session_id: string | null; mode: QuestionSessionMode | null };
type ExamScope = { exam_session_id: string | null; mode: ExamSimulatorMode | null };
type TrainingCounts = { answered_count: number; correct_count: number; incorrect_count: number; question_total: number };
type ExamCounts = { answered_count: number; correct_count: number; wrong_count: number; question_total: number };
type Position = { question_index: number; question_total: number };
type ReviewItem = Position & {
  question_id: string;
  view_state: "question" | "missing_question";
  was_answered: boolean;
  is_correct: boolean | null;
};
type ReviewClose = Position & { viewed_count: number; review_foreground_ms: number };
type TrainingReview = TrainingScope & { review_id: string };
type ExamReview = { exam_session_id: string | null; review_id: string | null };
type VisitDuration = { visit_foreground_ms: number; duration_scope: "current_component_visit" };
export type OfflineBlockContext = {
  feature: "training" | "exam";
  screen_name: "question_training" | "exam_loading" | "exam_session";
  requested_category: DrivingCategory;
  mode: QuestionSessionMode | null;
};
export type OfflineBlockScope = OfflineBlockContext & {
  block_id: string;
  blocked_reason: OfflinePackBlockedReason;
  is_online: boolean;
  offline_ready: boolean;
  downloaded_category: DrivingCategory | null;
};
export type CategoryMismatchScope = {
  mismatch_id: string;
  exam_session_id: string;
  screen_name: "exam_loading" | "exam_session" | "exam_result" | "exam_answers";
  current_category: DrivingCategory;
  session_category: DrivingCategory;
};
export type ExamRestartSelectionPayload = {
  exam_session_id: string;
  source: "exam_result";
} & (
  | { choice: "watch_ad"; ad_shown: boolean }
  | { choice: "upgrade" | "dismiss" | "plus" }
);
export type LearningInteractionPayloads = {
  training_feedback_continued: TrainingScope & Position & {
    question_id: string; feedback_foreground_ms: number; is_correct: boolean; action: "next" | "finish";
  };
  training_result_viewed: TrainingScope & TrainingCounts & {
    result_origin: TrainingResultOrigin; view_reason: "initial" | "review_return";
  };
  training_result_action: TrainingScope & {
    action: "close" | "finish" | "work_on_mistakes" | "new_attempt" | "answers" | "upgrade";
  };
  training_answers_review_opened: TrainingReview & { question_total: number };
  training_answers_review_question_viewed: TrainingReview & ReviewItem;
  training_answers_review_closed: TrainingReview & ReviewClose & { close_reason: "finished" | "back" };
  training_session_abandoned: TrainingScope & TrainingCounts & VisitDuration & {
    exit_reason: "empty_pool" | "zero_answer_exit" | "explicit_exit";
  };
  training_session_empty: TrainingScope & { empty_reason: QuestionSessionEmptyReason };
  exam_session_resumed: ExamScope & { launch_attempt_id: string; question_total: number; resumed_at_question: number };
  exam_session_ended: ExamScope & ExamCounts & VisitDuration & {
    status: Exclude<RemoteExamSessionStatus, "active">; end_reason: typeof EXAM_END_REASONS[number];
  };
  exam_empty_exit: ExamScope & { answered_count: 0; question_total: number };
  exam_result_viewed: ExamScope & ExamCounts & {
    result_origin: "just_finished" | "existing_result"; status: RemoteExamSessionStatus; outcome: ExamResultOutcome;
  };
  exam_result_action: ExamScope & { action: "home" | "answers" | "work_on_mistakes" | "new_attempt" };
  exam_answers_review_opened: ExamScope & ExamReview & { question_total: number; source: "result" | "route" };
  exam_answers_review_question_viewed: ExamReview & ReviewItem;
  exam_answers_review_closed: ExamReview & ReviewClose & { close_reason: "finished" | "back" | "view_unmounted" };
  exam_question_navigation_requested: {
    exam_session_id: string | null; question_id: string | null; question_index: number | null;
    question_total: number | null; target_question_index: number; navigation_direction: "forward" | "backward";
  };
  exam_question_flag_changed: {
    exam_session_id: string | null; question_id: string | null; question_index: number | null;
    question_total: number | null; is_flagged: boolean;
  };
  exam_restart_gate_shown: { exam_session_id: string; source: "exam_result" };
  exam_restart_selected: ExamRestartSelectionPayload;
  answer_explanation_viewed: TrainingScope & {
    question_id: string; is_correct: boolean; access_method: "premium" | "free_topic"; free_explanations_remaining: number;
  };
  diagnostic_result_action: TrainingScope & { action: "continue" | "close" | "answers" | "mistakes" };
  diagnostic_reminder_shown: { training_session_id: string | null; has_exam_date: boolean };
  diagnostic_reminder_resolved: { training_session_id: string | null; action: "enable" | "later" | "dismiss" };
  exam_start_requested: {
    launch_attempt_id: string; mode: ExamSimulatorMode; question_total: number;
    source: "study_plan" | "manual"; is_online: boolean | null; offline_ready: boolean;
  };
  exam_start_failed: {
    launch_attempt_id: string; mode: ExamSimulatorMode; launch_step: typeof EXAM_LAUNCH_STEPS[number]; error_code: string;
  };
  learning_access_blocked: OfflineBlockScope;
  learning_access_block_action: OfflineBlockScope & { action: "retry" | "open_offline_mode" | "close"; destination: string | null };
  exam_category_mismatch_viewed: CategoryMismatchScope;
  exam_category_mismatch_resolved: CategoryMismatchScope & { resolved_category: DrivingCategory };
  exam_category_mismatch_action: CategoryMismatchScope & { action: "switch_category" | "close" };
};

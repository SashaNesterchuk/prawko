import type { LearningInteractionPayloads } from "../learning-interaction-payloads";

const training = { training_session_id: "training-1", mode: "learning" } as const;
const exam = { exam_session_id: "exam-1", mode: "exam" } as const;
const trainingCounts = { answered_count: 5, correct_count: 4, incorrect_count: 1, question_total: 5 };
const examCounts = { answered_count: 5, correct_count: 4, wrong_count: 1, question_total: 5 };
const position = { question_index: 2, question_total: 5 };
const item = { ...position, question_id: "q-2", view_state: "question", was_answered: true, is_correct: false } as const;
const close = { ...position, viewed_count: 2, review_foreground_ms: 123 };
const visit = { visit_foreground_ms: 123, duration_scope: "current_component_visit" } as const;
const offline = {
  block_id: "block-1", feature: "training", screen_name: "question_training", requested_category: "B",
  mode: "learning", blocked_reason: "pack_for_other_category", is_online: false, offline_ready: false,
  downloaded_category: "A1",
} as const;
const mismatch = {
  mismatch_id: "mismatch-1", exam_session_id: "exam-1", screen_name: "exam_result",
  current_category: "B", session_category: "A1",
} as const;

// This file is included by tsc; the runtime matrix consumes the same exhaustive fixtures.
export const LEARNING_INTERACTION_FIXTURES = {
  training_feedback_continued: { ...training, ...position, question_id: "q-2", feedback_foreground_ms: 123, is_correct: false, action: "next" },
  training_result_viewed: { ...training, ...trainingCounts, result_origin: "new_completion", view_reason: "initial" },
  training_result_action: { ...training, action: "answers" },
  training_answers_review_opened: { ...training, review_id: "review-1", question_total: 5 },
  training_answers_review_question_viewed: { ...training, review_id: "review-1", ...item },
  training_answers_review_closed: { ...training, review_id: "review-1", ...close, close_reason: "back" },
  training_session_abandoned: { ...training, ...trainingCounts, ...visit, exit_reason: "explicit_exit" },
  training_session_empty: { ...training, empty_reason: "general_empty" },
  exam_session_resumed: { ...exam, launch_attempt_id: "launch-1", question_total: 5, resumed_at_question: 0 },
  exam_session_ended: { ...exam, ...examCounts, ...visit, status: "completed", end_reason: "learner_finish" },
  exam_empty_exit: { ...exam, answered_count: 0, question_total: 5 },
  exam_result_viewed: { ...exam, ...examCounts, result_origin: "existing_result", status: "completed", outcome: "passed" },
  exam_result_action: { ...exam, action: "answers" },
  exam_answers_review_opened: { ...exam, review_id: "review-1", question_total: 5, source: "result" },
  exam_answers_review_question_viewed: { exam_session_id: "exam-1", review_id: "review-1", ...item },
  exam_answers_review_closed: { exam_session_id: "exam-1", review_id: "review-1", ...close, close_reason: "view_unmounted" },
  exam_question_navigation_requested: { exam_session_id: "exam-1", question_id: "q-2", ...position, target_question_index: 3, navigation_direction: "forward" },
  exam_question_flag_changed: { exam_session_id: "exam-1", question_id: "q-2", ...position, is_flagged: true },
  exam_restart_gate_shown: { exam_session_id: "exam-1", source: "exam_result" },
  exam_restart_selected: { exam_session_id: "exam-1", source: "exam_result", choice: "watch_ad", ad_shown: false },
  answer_explanation_viewed: { ...training, question_id: "q-2", is_correct: false, access_method: "free_topic", free_explanations_remaining: 0 },
  diagnostic_result_action: { ...training, action: "continue" },
  diagnostic_reminder_shown: { training_session_id: "training-1", has_exam_date: true },
  diagnostic_reminder_resolved: { training_session_id: "training-1", action: "later" },
  exam_start_requested: { launch_attempt_id: "launch-1", mode: "exam", question_total: 5, source: "manual", is_online: null, offline_ready: false },
  exam_start_failed: { launch_attempt_id: "launch-1", mode: "exam", launch_step: "start_session", error_code: "network" },
  learning_access_blocked: offline,
  learning_access_block_action: { ...offline, action: "retry", destination: null },
  exam_category_mismatch_viewed: mismatch,
  exam_category_mismatch_resolved: { ...mismatch, resolved_category: "A1" },
  exam_category_mismatch_action: { ...mismatch, action: "switch_category" },
} as const satisfies LearningInteractionPayloads;

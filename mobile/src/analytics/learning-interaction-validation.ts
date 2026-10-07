import type { AnalyticsEventName, AnalyticsProperties } from "./catalog";

/** Interaction QA does not establish completion, paid access or successful navigation. */
export function learningInteractionIssues(event: AnalyticsEventName, p: AnalyticsProperties) {
  const issues = new Set<string>();
  const reject = (key: string) => { issues.add(key); };
  const maxCount = (key: string, ceiling: string) => {
    if (typeof p[key] === "number" && typeof p[ceiling] === "number" && p[key] > p[ceiling]) reject(key);
  };
  if (["training_result_viewed", "training_session_abandoned", "exam_result_viewed", "exam_session_ended"].includes(event)) {
    maxCount("answered_count", "question_total");
    maxCount("correct_count", "answered_count");
    const wrong = event.startsWith("training_") ? "incorrect_count" : "wrong_count";
    maxCount(wrong, "answered_count");
    if (typeof p.correct_count === "number" && typeof p[wrong] === "number" && typeof p.answered_count === "number"
      && p.correct_count + p[wrong] > p.answered_count) reject("answered_count");
  }
  if (event.includes("_answers_review_") || ["training_feedback_continued", "exam_question_flag_changed", "exam_question_navigation_requested"].includes(event)) {
    maxCount("question_index", "question_total");
    maxCount("viewed_count", "question_total");
    if (typeof p.question_index === "number" && p.question_index < 1) reject("question_index");
    if (event.endsWith("_question_viewed") && p.was_answered === false && p.is_correct !== null) reject("is_correct");
    if (event.endsWith("_question_viewed") && p.was_answered === true && typeof p.is_correct !== "boolean") reject("is_correct");
  }
  if (event === "exam_question_navigation_requested") {
    maxCount("target_question_index", "question_total");
    if (typeof p.target_question_index === "number" && p.target_question_index < 1) reject("target_question_index");
    if (typeof p.target_question_index === "number" && typeof p.question_index === "number") {
      if (p.target_question_index === p.question_index) reject("target_question_index");
      const expected = p.target_question_index > p.question_index ? "forward" : "backward";
      if (p.navigation_direction !== expected) reject("navigation_direction");
    }
  }
  if (event === "exam_session_resumed") maxCount("resumed_at_question", "question_total");
  if (event === "training_session_abandoned" && p.exit_reason === "zero_answer_exit" && p.answered_count !== 0) reject("answered_count");
  if (event === "exam_session_ended") {
    const expected = p.end_reason === "learner_finish" ? "completed" : p.end_reason === "timer_elapsed" ? "expired"
      : ["user_ended_early", "dev_skip"].includes(String(p.end_reason)) ? "abandoned" : null;
    if (expected && p.status !== expected) reject("status");
  }
  if (event === "exam_result_viewed") {
    if (p.status === "active") reject("status");
    if (["abandoned", "expired"].includes(String(p.status)) && p.outcome !== p.status) reject("outcome");
    if (p.status === "completed" && !["passed", "failed"].includes(String(p.outcome))) reject("outcome");
  }
  if (event === "exam_restart_selected") {
    if (p.choice === "watch_ad" && typeof p.ad_shown !== "boolean") reject("ad_shown");
    if (p.choice !== "watch_ad" && p.ad_shown !== undefined) reject("ad_shown");
  }
  if (event === "learning_access_blocked" || event === "learning_access_block_action") {
    if (p.is_online !== false) reject("is_online");
    if (p.offline_ready !== false) reject("offline_ready");
    if (p.blocked_reason === "pack_for_other_category"
      && (p.downloaded_category === null || p.downloaded_category === p.requested_category)) reject("downloaded_category");
    if (p.feature === "training" && p.screen_name !== "question_training") reject("screen_name");
    if (p.feature === "exam" && p.screen_name === "question_training") reject("screen_name");
  }
  if (event.startsWith("exam_category_mismatch_")) {
    if (p.current_category === p.session_category) reject("session_category");
    if (event === "exam_category_mismatch_resolved" && p.resolved_category !== p.session_category) reject("resolved_category");
  }
  return [...issues];
}

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "./catalog";
import { roadmapLessonCoverage, type RoadmapLesson } from "../features/home/roadmap-progress";

type Snapshot = { hasHydrated: boolean; lessons: Record<string, RoadmapLesson> };
function counts(lesson: RoadmapLesson) {
  const wrong = new Set(lesson.wrongIds ?? []);
  const correct = new Set(lesson.correctIds);
  const ids = [...new Set(lesson.questionIds)];
  return { correct: ids.filter((id) => correct.has(id) && !wrong.has(id)).length, wrong: ids.filter((id) => wrong.has(id)).length, total: ids.length };
}

/** Observe committed state; restoration/reset are not new learner outcomes. */
export function observeRoadmapProgress(previous: Snapshot, next: Snapshot,
  capture: (event: "roadmap_lesson_progress_changed", payload: AnalyticsProperties) => void,
  session: { id: string; request: { roadmapStepId?: string | null; currentCategory: string }; questionIds: string[] } | null) {
  if (!previous.hasHydrated || !next.hasHydrated) return;
  for (const [key, lesson] of Object.entries(next.lessons)) {
    const before = previous.lessons[key];
    if (!before || before === lesson) continue;
    const a = counts(before), b = counts(lesson);
    if (a.correct === b.correct && a.wrong === b.wrong && before.revision === lesson.revision) continue;
    const [country, category, ...parts] = key.split(":");
    const step = parts.join(":");
    const completed = b.total > 0 && b.correct === b.total && b.wrong === 0;
    const wasCompleted = a.total > 0 && a.correct === a.total && a.wrong === 0;
    const previousCorrect = new Set(before.correctIds), previousWrong = new Set(before.wrongIds ?? []);
    const currentCorrect = new Set(lesson.correctIds), currentWrong = new Set(lesson.wrongIds ?? []);
    const changedId = lesson.questionIds.find((id) => previousCorrect.has(id) !== currentCorrect.has(id) || previousWrong.has(id) !== currentWrong.has(id));
    const sameSession = before.revision === lesson.revision && session && session.request.currentCategory === category && (session.request.roadmapStepId === step || (changedId && session.questionIds.includes(changedId)));
    const coverage = roadmapLessonCoverage(lesson);
    capture(ANALYTICS_EVENTS.roadmapLessonProgressChanged.key, {
      exam_country: country, category, roadmap_step_id: step, pool_revision: lesson.revision,
      question_total: b.total, previous_correct_count: a.correct, previous_wrong_count: a.wrong,
      correct_count: b.correct, wrong_count: b.wrong,
      correct_percent: coverage.correctPercent, wrong_percent: coverage.wrongPercent, completed,
      completion_transition: completed && !wasCompleted ? "completed" : wasCompleted && !completed ? "reopened" : "none",
      change_reason: before.revision === lesson.revision ? "answer" : "content_changed",
      training_session_id: sameSession ? session.id : null,
      question_id: before.revision === lesson.revision ? changedId ?? null : null,
    });
  }
}

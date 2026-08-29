export const EXAM_RULES = {
  totalQuestions: 32,
  baseQuestions: 20,
  specialistQuestions: 12,
  durationMinutes: 25,
  maxPoints: 74,
  passingPoints: 68,
  /** WORD: time to read a base (TAK/NIE) question before media/answer. */
  baseReadSeconds: 20,
  /** WORD: time to answer a base (TAK/NIE) question after media. */
  baseAnswerSeconds: 15,
  /**
   * After the learner finishes a manually started exam video, add this many
   * seconds back onto whatever remained on the question timer.
   */
  baseVideoResumeBonusSeconds: 5,
  /** WORD: combined read + answer window for specialist (A/B/C) questions. */
  specialistSeconds: 50,
  /**
   * Soft floor for video share among base-scope exam questions (~50–60%).
   * Official rules do not fix film/photo quotas; WORD base mixes both.
   * Soft: take what's available. Do not force specialist videos.
   */
  baseVideoMinRatio: 0.55,
} as const;

/** Soft min video count for a given base-scope slot count (catalog soft quota). */
export function getExamBaseVideoMinTarget(baseQuestionTarget: number) {
  const normalized = Math.max(0, Math.floor(baseQuestionTarget));
  return Math.min(
    normalized,
    Math.round(normalized * EXAM_RULES.baseVideoMinRatio)
  );
}

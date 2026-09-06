import {
  getQuestionTopicIdsForCountry,
  type QuestionTopicId,
} from "@prawko/config";

export const INITIAL_DIAGNOSTIC_QUESTION_COUNT = 10;

/**
 * BRD first-session mix mapped onto the real catalog. Document names are not
 * source of truth: missing country topics fall back in `preferred` order.
 * Nine topic slots + one visual/media question = 10.
 */
export const INITIAL_DIAGNOSTIC_TOPIC_SLOTS = [
  { count: 2, preferred: ["signs_signals"] },
  { count: 2, preferred: ["intersections_priority"] },
  { count: 1, preferred: ["driving_maneuvers", "speed_distance"] },
  { count: 1, preferred: ["other_road_users"] },
  { count: 1, preferred: ["accidents_first_aid", "attention_risks"] },
  { count: 1, preferred: ["vehicle_equipment"] },
  { count: 1, preferred: ["transport", "documents_responsibility"] },
] as const satisfies ReadonlyArray<{
  count: number;
  preferred: readonly QuestionTopicId[];
}>;

const TOPIC_SLOT_TOTAL = INITIAL_DIAGNOSTIC_TOPIC_SLOTS.reduce(
  (sum, slot) => sum + slot.count,
  0
);

export function resolveInitialDiagnosticTopicQuota(
  countryCode: string | null | undefined
): QuestionTopicId[] {
  const allowed = getQuestionTopicIdsForCountry(countryCode);
  const allowedSet = new Set(allowed);
  const quota: QuestionTopicId[] = [];

  for (const slot of INITIAL_DIAGNOSTIC_TOPIC_SLOTS) {
    const topicId = slot.preferred.find((id) => allowedSet.has(id));

    if (!topicId) {
      continue;
    }

    for (let index = 0; index < slot.count; index += 1) {
      quota.push(topicId);
    }
  }

  if (quota.length >= TOPIC_SLOT_TOTAL || allowed.length === 0) {
    return quota.slice(0, TOPIC_SLOT_TOTAL);
  }

  let fillIndex = 0;

  while (quota.length < TOPIC_SLOT_TOTAL) {
    quota.push(allowed[fillIndex % allowed.length]!);
    fillIndex += 1;
  }

  return quota;
}

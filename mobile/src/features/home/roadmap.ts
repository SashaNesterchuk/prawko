import type { CountryCode, QuestionTopicId } from "@prawko/config";

import type { IconName } from "../../components/icons";

/** Each paid circle is one lesson. Free circles keep their own smaller limit. */
const PREMIUM_LESSON_QUESTION_LIMIT = 20;

export type RoadmapStep = {
  labelKey: string;
  premium: boolean;
  questionLimit?: number;
  startsExam?: boolean;
};

export type RoadmapSection = {
  id: string;
  titleKey: string;
  icon: IconName;
  /** Learn categories practiced by this card. Empty for exam preparation. */
  topics: QuestionTopicId[];
  examPrep: boolean;
  steps: RoadmapStep[];
};

type RoadmapDraft = {
  icon: IconName;
  topics: QuestionTopicId[];
  stepCount: number;
  freeStepCount?: number;
  freeQuestionLimit?: number;
  examPrep?: boolean;
};

function section(draft: RoadmapDraft) {
  const freeStepCount = draft.freeStepCount ?? 0;
  const examPrep = draft.examPrep ?? false;

  return {
    icon: draft.icon,
    topics: draft.topics,
    examPrep,
    steps: Array.from({ length: draft.stepCount }, (_, index) => {
      const isFree = index < freeStepCount;
      const isLast = index === draft.stepCount - 1;

      return {
        premium: !isFree,
        questionLimit: isFree
          ? draft.freeQuestionLimit
          : examPrep && isLast
            ? undefined
            : PREMIUM_LESSON_QUESTION_LIMIT,
        startsExam: examPrep && isLast,
      };
    }),
  };
}

const ROADMAPS: Record<CountryCode, RoadmapDraft[]> = {
  PL: [
    {
      icon: "book",
      topics: ["signs_signals"],
      freeStepCount: 3,
      freeQuestionLimit: 15,
      stepCount: 9,
    },
    {
      icon: "flag",
      topics: ["intersections_priority"],
      stepCount: 6,
    },
    {
      icon: "sedan",
      topics: ["driving_maneuvers"],
      stepCount: 8,
    },
    {
      icon: "profile",
      topics: ["speed_distance", "other_road_users"],
      stepCount: 7,
    },
    {
      icon: "warning",
      topics: ["roads_zones_crossings", "accidents_first_aid"],
      stepCount: 4,
    },
    {
      icon: "checkbox",
      topics: ["vehicle_equipment", "transport", "documents_responsibility"],
      stepCount: 10,
    },
    {
      icon: "alert",
      topics: ["attention_risks"],
      stepCount: 4,
    },
    {
      icon: "exam",
      topics: [],
      examPrep: true,
      stepCount: 3,
    },
  ],
  CZ: [
    {
      icon: "book",
      topics: ["signs_signals"],
      freeStepCount: 3,
      freeQuestionLimit: 12,
      stepCount: 6,
    },
    {
      icon: "flag",
      topics: ["intersections_priority"],
      stepCount: 4,
    },
    {
      icon: "sedan",
      topics: ["driving_maneuvers"],
      stepCount: 3,
    },
    {
      icon: "profile",
      topics: ["other_road_users", "attention_risks"],
      stepCount: 5,
    },
    {
      icon: "checkbox",
      topics: [
        "vehicle_equipment",
        "documents_responsibility",
        "accidents_first_aid",
      ],
      stepCount: 8,
    },
    {
      icon: "exam",
      topics: [],
      examPrep: true,
      stepCount: 3,
    },
  ],
  SK: [
    {
      icon: "book",
      topics: ["road_traffic_rules"],
      freeStepCount: 3,
      freeQuestionLimit: 12,
      stepCount: 10,
    },
    {
      icon: "roadSign",
      topics: ["road_signs_and_traffic_devices"],
      stepCount: 4,
    },
    {
      icon: "flag",
      topics: ["priority_and_speed_limits", "intersection_traffic_situations"],
      stepCount: 4,
    },
    {
      icon: "alert",
      topics: ["safe_driving_principles"],
      stepCount: 3,
    },
    {
      icon: "sedan",
      topics: [
        "vehicle_driving_theory",
        "vehicle_operation_requirements",
        "vehicle_construction_and_maintenance",
      ],
      stepCount: 4,
    },
    {
      icon: "document",
      topics: ["documents_and_transport_time", "road_accident_duties"],
      stepCount: 2,
    },
    {
      icon: "exam",
      topics: [],
      examPrep: true,
      stepCount: 3,
    },
  ],
};

export function getRoadmap(country: CountryCode | null): RoadmapSection[] {
  const code = country === "CZ" || country === "SK" ? country : "PL";

  const localeKey = code.toLowerCase();

  return ROADMAPS[code].map((draft, index) => {
    const built = section(draft);

    return {
      ...built,
      id: `${code}-${index}`,
      titleKey: `roadmap.${localeKey}.${index}.title`,
      steps: built.steps.map((step, stepIndex) => ({
        ...step,
        labelKey: `roadmap.${localeKey}.${index}.steps.${stepIndex}`,
      })),
    };
  });
}

export type TopicLearnAccess =
  | { kind: "partial"; freeQuestionLimit: number }
  | { kind: "premium" };

function roadmapCode(country: CountryCode | null): CountryCode {
  return country === "CZ" || country === "SK" ? country : "PL";
}

/** Every Learn category the roadmap practices, in section order. */
export function getRoadmapTopicIds(country: CountryCode | null): QuestionTopicId[] {
  return ROADMAPS[roadmapCode(country)].flatMap((draft) => draft.topics);
}

/** Topics a free learner can still open. Later Learn categories stay Premium. */
export function getFreeRoadmapTopicIds(
  country: CountryCode | null
): QuestionTopicId[] {
  return ROADMAPS[roadmapCode(country)].flatMap((draft) =>
    (draft.freeStepCount ?? 0) > 0 && (draft.freeQuestionLimit ?? 0) > 0
      ? draft.topics
      : []
  );
}

/**
 * Learn-by-topic access for a free user.
 * The opening slice of the first section stays open (PL: 3 steps × 15 = 45).
 * Every later step in that section, and every other Learn category, is Premium.
 */
export function getTopicLearnAccess(
  country: CountryCode | null,
  topicId: string
): TopicLearnAccess {
  const draft = ROADMAPS[roadmapCode(country)].find((item) =>
    item.topics.some((topic) => topic === topicId)
  );
  const freeSteps = draft?.freeStepCount ?? 0;
  const perStep = draft?.freeQuestionLimit ?? 0;

  if (freeSteps > 0 && perStep > 0) {
    return { kind: "partial", freeQuestionLimit: freeSteps * perStep };
  }

  return { kind: "premium" };
}

/**
 * A session that names Learn categories. Premium wins if any category is locked.
 * No categories means the caller is unscoped (random / blitz).
 */
export function resolveTopicSessionAccess(
  country: CountryCode | null,
  topicIds: readonly string[]
) {
  let freeQuestionLimit: number | null = null;

  for (const topicId of topicIds) {
    const access = getTopicLearnAccess(country, topicId);

    if (access.kind === "premium") {
      return { locked: true, freeQuestionLimit: null };
    }

    freeQuestionLimit =
      freeQuestionLimit == null
        ? access.freeQuestionLimit
        : Math.min(freeQuestionLimit, access.freeQuestionLimit);
  }

  return { locked: false, freeQuestionLimit };
}

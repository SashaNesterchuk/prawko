import {
  STUDY_PLAN_LIMITS,
  getContentLocale,
  type ContentLocale,
  type DrivingCategory,
  type QuestionTopicId,
  type StudyPlanTaskType,
  type SupportedLocale,
} from "@prawko/config";
import type {
  GeneratedStudyPlan,
  GeneratedStudyPlanDay,
  GeneratedStudyPlanTask,
  StudyPlanSetupInput,
} from "@prawko/schemas";
import { getExamProfile } from "../exam/exam-profile";
import {
  getQuestionTopicIds,
  getQuestionTopicTitle,
} from "../question-topics/catalog";

const MINIMUM_MODE_THRESHOLD = 20;

function copyFor(
  locale: ContentLocale,
  copy: Record<"pl" | "ua" | "en" | "de", string> & { cs?: string }
): string {
  if (locale === "cs") {
    return copy.cs ?? copy.en;
  }

  if (locale === "el") {
    return copy.en;
  }

  return copy[locale];
}

const FULL_EXAM_THRESHOLD = 25;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type StudyPlanBlueprint = {
  countsForMinimum: boolean;
  estimatedMinutes: number;
  questionCountTarget?: number;
  taskType: StudyPlanTaskType;
  topicBlock?: QuestionTopicId;
};

type LocalPlanInput = StudyPlanSetupInput & {
  category: DrivingCategory;
  locale: SupportedLocale;
};

type GenerateLocalStudyPlanOptions = {
  allowCompressedWindow?: boolean;
  generatorVersion?: string;
  preserveExamDate?: string;
};

export function generateLocalStudyPlan(
  input: LocalPlanInput,
  fromDate: Date = new Date(),
  options: GenerateLocalStudyPlanOptions = {}
): GeneratedStudyPlan {
  const minimumDays = options.allowCompressedWindow ? 1 : STUDY_PLAN_LIMITS.minDays;
  const daysPlanned = clamp(
    input.daysUntilExam,
    minimumDays,
    STUDY_PLAN_LIMITS.maxDays
  );
  const minutesPerDay = clamp(
    input.minutesPerDay,
    STUDY_PLAN_LIMITS.minMinutesPerDay,
    STUDY_PLAN_LIMITS.maxMinutesPerDay
  );
  const examDate = options.preserveExamDate ?? getExamDateFromDays(daysPlanned, fromDate);
  const normalizedSchoolCode = input.schoolCode?.trim() || undefined;
  const days = Array.from({ length: daysPlanned }, (_, index) =>
    buildPlanDay({
      dayNumber: index + 1,
      daysPlanned,
      fromDate,
      input: {
        ...input,
        daysUntilExam: daysPlanned,
        minutesPerDay,
        schoolCode: normalizedSchoolCode,
      },
    })
  );

  return {
    id: `plan-${examDate}-${input.level}-${daysPlanned}-${minutesPerDay}`,
    title: getPlanTitle(input.locale, daysPlanned),
    locale: input.locale,
    category: input.category,
    level: input.level,
    examDate,
    daysPlanned,
    minutesPerDay,
    schoolCode: normalizedSchoolCode,
    generatorVersion: options.generatorVersion ?? "local-v1",
    summary: {
      minimumModeDays: days.filter((day) => day.minimumMode).length,
      fullExamDays: countTasks(days, "full_exam"),
      miniTestDays: countTasks(days, "mini_test"),
      weakSpotDays: countTasks(days, "review_weak_spots"),
    },
    days,
  };
}

export function getExamDateFromDays(
  daysUntilExam: number,
  fromDate: Date = new Date()
) {
  return toIsoDate(addDays(startOfDay(fromDate), daysUntilExam));
}

export function getDaysUntilExamFromDate(
  examDate: string,
  fromDate: Date = new Date()
) {
  const targetDate = parseIsoDate(examDate);
  const today = startOfDay(fromDate);

  return Math.round((targetDate.getTime() - today.getTime()) / DAY_IN_MS);
}

export function generateAdjustedStudyPlan(
  input: Omit<LocalPlanInput, "daysUntilExam"> & {
    examDate: string;
  },
  fromDate: Date = new Date()
) {
  return generateLocalStudyPlan(
    {
      ...input,
      daysUntilExam: Math.max(1, getDaysUntilExamFromDate(input.examDate, fromDate)),
    },
    fromDate,
    {
      allowCompressedWindow: true,
      generatorVersion: "local-v1-adjusted",
      preserveExamDate: input.examDate,
    }
  );
}

export function formatPlanDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function buildPlanDay({
  dayNumber,
  daysPlanned,
  fromDate,
  input,
}: {
  dayNumber: number;
  daysPlanned: number;
  fromDate: Date;
  input: LocalPlanInput;
}): GeneratedStudyPlanDay {
  const planDate = toIsoDate(addDays(startOfDay(fromDate), dayNumber - 1));
  const topicIds = getQuestionTopicIds();
  const focusTopic = topicIds[(dayNumber - 1) % topicIds.length];
  const minimumMode = input.minutesPerDay <= MINIMUM_MODE_THRESHOLD;
  const remainingDays = daysPlanned - dayNumber + 1;
  const blueprints = buildDayBlueprints({
    dayNumber,
    daysPlanned,
    focusTopic,
    input,
    minimumMode,
    remainingDays,
  });

  const tasks = blueprints.map((blueprint, index) =>
    createTask({
      dayNumber,
      index,
      locale: input.locale,
      blueprint,
    })
  );

  return {
    id: `day-${dayNumber}`,
    dayNumber,
    planDate,
    focusTopic:
      tasks.some((task) => task.taskType === "learn_topic") ? focusTopic : undefined,
    estimatedMinutes: tasks.reduce(
      (total, task) => total + task.estimatedMinutes,
      0
    ),
    minimumMode,
    tasks,
  };
}

function buildDayBlueprints({
  dayNumber,
  daysPlanned,
  focusTopic,
  input,
  minimumMode,
  remainingDays,
}: {
  dayNumber: number;
  daysPlanned: number;
  focusTopic: QuestionTopicId;
  input: LocalPlanInput;
  minimumMode: boolean;
  remainingDays: number;
}) {
  const primaryMinutes = minimumMode
    ? input.minutesPerDay
    : Math.max(12, Math.round(input.minutesPerDay * 0.62));
  const secondaryMinutes = minimumMode
    ? 0
    : Math.max(8, input.minutesPerDay - primaryMinutes);
  const learningQuestions = clamp(Math.round(primaryMinutes * 0.9), 10, 28);
  const reviewQuestions = clamp(Math.round(secondaryMinutes * 0.9), 8, 20);
  const examQuestions = clamp(Math.round(primaryMinutes * 0.85), 12, 22);
  const canRunFullExam = input.minutesPerDay >= FULL_EXAM_THRESHOLD;
  const lastMileWindow =
    daysPlanned <= 7 ? 2 : daysPlanned <= 21 ? 3 : 5;

  let tasks: StudyPlanBlueprint[] = [];

  if (dayNumber === 1 && input.level === "repeater") {
    tasks = [
      {
        countsForMinimum: true,
        estimatedMinutes: primaryMinutes,
        questionCountTarget: examQuestions,
        taskType: "mini_test",
      },
      {
        countsForMinimum: false,
        estimatedMinutes: secondaryMinutes,
        questionCountTarget: reviewQuestions,
        taskType: "review_wrong_answers",
      },
    ];
  } else if (dayNumber === 1 && input.level === "already_studied") {
    tasks = [
      {
        countsForMinimum: true,
        estimatedMinutes: primaryMinutes,
        questionCountTarget: examQuestions,
        taskType: "mini_test",
      },
      {
        countsForMinimum: false,
        estimatedMinutes: secondaryMinutes,
        questionCountTarget: reviewQuestions,
        taskType: "review_weak_spots",
      },
    ];
  } else if (remainingDays <= lastMileWindow) {
    tasks = [
      canRunFullExam
        ? {
            countsForMinimum: true,
            estimatedMinutes: primaryMinutes,
            questionCountTarget: getExamProfile().totalQuestions,
            taskType: "full_exam",
          }
        : {
            countsForMinimum: true,
            estimatedMinutes: primaryMinutes,
            questionCountTarget: examQuestions,
            taskType: "mini_test",
          },
      {
        countsForMinimum: false,
        estimatedMinutes: secondaryMinutes,
        questionCountTarget: reviewQuestions,
        taskType: "review_weak_spots",
      },
    ];
  } else if (daysPlanned <= 7) {
    tasks =
      dayNumber % 2 === 0
        ? [
            {
              countsForMinimum: true,
              estimatedMinutes: primaryMinutes,
              questionCountTarget: examQuestions,
              taskType: "mini_test",
            },
            {
              countsForMinimum: false,
              estimatedMinutes: secondaryMinutes,
              questionCountTarget: reviewQuestions,
              taskType: "review_wrong_answers",
            },
          ]
        : [
            {
              countsForMinimum: true,
              estimatedMinutes: primaryMinutes,
              questionCountTarget: learningQuestions,
              taskType: "learn_topic",
              topicBlock: focusTopic,
            },
            {
              countsForMinimum: false,
              estimatedMinutes: secondaryMinutes,
              questionCountTarget: reviewQuestions,
              taskType: "review_weak_spots",
            },
          ];
  } else if (daysPlanned <= 21) {
    tasks =
      dayNumber % 4 === 0
        ? [
            {
              countsForMinimum: true,
              estimatedMinutes: primaryMinutes,
              questionCountTarget: examQuestions,
              taskType: "mini_test",
            },
            {
              countsForMinimum: false,
              estimatedMinutes: secondaryMinutes,
              questionCountTarget: reviewQuestions,
              taskType: "review_wrong_answers",
            },
          ]
        : [
            {
              countsForMinimum: true,
              estimatedMinutes: primaryMinutes,
              questionCountTarget: learningQuestions,
              taskType: "learn_topic",
              topicBlock: focusTopic,
            },
            {
              countsForMinimum: false,
              estimatedMinutes: secondaryMinutes,
              questionCountTarget: reviewQuestions,
              taskType:
                dayNumber % 3 === 0
                  ? "review_weak_spots"
                  : "review_wrong_answers",
            },
          ];
  } else {
    const foundationPhase = Math.ceil(daysPlanned * 0.55);
    const consolidationPhase = Math.ceil(daysPlanned * 0.8);

    if (dayNumber <= foundationPhase) {
      tasks = [
        {
          countsForMinimum: true,
          estimatedMinutes: primaryMinutes,
          questionCountTarget: learningQuestions,
          taskType: "learn_topic",
          topicBlock: focusTopic,
        },
        {
          countsForMinimum: false,
          estimatedMinutes: secondaryMinutes,
          questionCountTarget: reviewQuestions,
          taskType:
            dayNumber % 5 === 0 ? "mini_test" : "review_wrong_answers",
        },
      ];
    } else if (dayNumber <= consolidationPhase) {
      tasks = [
        {
          countsForMinimum: true,
          estimatedMinutes: primaryMinutes,
          questionCountTarget:
            dayNumber % 2 === 0 ? reviewQuestions : learningQuestions,
          taskType: dayNumber % 2 === 0 ? "review_wrong_answers" : "learn_topic",
          topicBlock: dayNumber % 2 === 0 ? undefined : focusTopic,
        },
        {
          countsForMinimum: false,
          estimatedMinutes: secondaryMinutes,
          questionCountTarget: examQuestions,
          taskType:
            dayNumber % 3 === 0 ? "mini_test" : "review_weak_spots",
        },
      ];
    } else {
      tasks = [
        canRunFullExam
          ? {
              countsForMinimum: true,
              estimatedMinutes: primaryMinutes,
              questionCountTarget: getExamProfile().totalQuestions,
              taskType: "full_exam",
            }
          : {
              countsForMinimum: true,
              estimatedMinutes: primaryMinutes,
              questionCountTarget: examQuestions,
              taskType: "mini_test",
            },
        {
          countsForMinimum: false,
          estimatedMinutes: secondaryMinutes,
          questionCountTarget: reviewQuestions,
          taskType: "review_weak_spots",
        },
      ];
    }
  }

  if (minimumMode) {
    const primaryTask = tasks[0];

    return [
      {
        ...primaryTask,
        countsForMinimum: true,
        estimatedMinutes: input.minutesPerDay,
        questionCountTarget: clamp(
          Math.round((primaryTask.questionCountTarget ?? 12) * 0.75),
          8,
          getExamProfile().totalQuestions
        ),
      },
    ];
  }

  return tasks.filter((task) => task.estimatedMinutes > 0);
}

function createTask({
  dayNumber,
  index,
  locale,
  blueprint,
}: {
  dayNumber: number;
  index: number;
  locale: SupportedLocale;
  blueprint: StudyPlanBlueprint;
}): GeneratedStudyPlanTask {
  const copy = getTaskCopy(locale, blueprint.taskType, blueprint.topicBlock);

  return {
    id: `day-${dayNumber}-task-${index + 1}`,
    taskType: blueprint.taskType,
    title: copy.title,
    description: copy.description,
    estimatedMinutes: blueprint.estimatedMinutes,
    questionCountTarget: blueprint.questionCountTarget,
    topicBlock: blueprint.topicBlock,
    countsForMinimum: blueprint.countsForMinimum,
  };
}

function getTaskCopy(
  locale: SupportedLocale,
  taskType: StudyPlanTaskType,
  topicId?: QuestionTopicId
) {
  const contentLocale = getContentLocale(locale);
  const topic = topicId ? getQuestionTopicTitle(topicId, locale) : null;

  switch (taskType) {
    case "learn_topic":
      return {
        title: copyFor(contentLocale, {
          pl: `Nauka: ${topic ?? ""}`,
          ua: `Вчити: ${topic ?? ""}`,
          en: `Learn: ${topic ?? ""}`,
          de: `Lernen: ${topic ?? ""}`,
          cs: `Učit: ${topic ?? ""}`,
        }),
        description: copyFor(contentLocale, {
          pl: "Przejdz nowy blok pytan i utrwal zasady.",
          ua: "Пройди новий тематичний блок і закріпи правила.",
          en: "Work through a new topic block and lock in the rules.",
          de: "Arbeite einen neuen Themenblock durch und festige die Regeln.",
        }),
      };
    case "review_weak_spots":
      return {
        title: copyFor(contentLocale, {
          pl: "Slabe miejsca",
          ua: "Слабкі місця",
          en: "Weak spots",
          de: "Schwachstellen",
        }),
        description: copyFor(contentLocale, {
          pl: "Powtorz pytania, na ktorych najlatwiej tracisz punkty.",
          ua: "Повтори питання, на яких ти найчастіше втрачаєш бали.",
          en: "Replay the questions most likely to cost you points.",
          de: "Wiederhole die Fragen, bei denen du am leichtesten Punkte verlierst.",
        }),
      };
    case "mini_test":
      return {
        title: copyFor(contentLocale, {
          pl: "Mini test",
          ua: "Міні тест",
          en: "Mini test",
          de: "Minittest",
        }),
        description: copyFor(contentLocale, {
          pl: "Krotki egzamin kontrolny, zeby sprawdzic tempo i uwage.",
          ua: "Короткий контрольний тест, щоб перевірити темп і уважність.",
          en: "A short controlled exam block to test pace and focus.",
          de: "Ein kurzer Kontrolltest fuer Tempo und Konzentration.",
        }),
      };
    case "full_exam":
      return {
        title: copyFor(contentLocale, {
          pl: "Pelny egzamin",
          ua: "Повний іспит",
          en: "Full exam",
          de: "Volle Pruefung",
        }),
        description: copyFor(contentLocale, {
          pl: "Symulacja calego egzaminu przed finalnym sprintem.",
          ua: "Симуляція повного іспиту перед фінальним спринтом.",
          en: "A full exam simulation before the final sprint.",
          de: "Eine volle Pruefungssimulation vor dem finalen Sprint.",
        }),
      };
    case "review_wrong_answers":
      return {
        title: copyFor(contentLocale, {
          pl: "Powtorka bledow",
          ua: "Повтор помилок",
          en: "Wrong answer review",
          de: "Fehlerwiederholung",
        }),
        description: copyFor(contentLocale, {
          pl: "Wroc do pytan, ktore juz raz zabraly Ci punkty.",
          ua: "Повернись до питань, які вже забрали в тебе бали.",
          en: "Return to the questions that already cost you points.",
          de: "Kehre zu Fragen zurueck, die dir schon Punkte gekostet haben.",
        }),
      };
    case "review_saved":
      return {
        title: copyFor(contentLocale, {
          pl: "Saved questions",
          ua: "Збережені питання",
          en: "Saved questions",
          de: "Gespeicherte Fragen",
        }),
        description: copyFor(contentLocale, {
          pl: "Osobista kolejka pytan zapisanych na pozniej.",
          ua: "Персональна черга питань, які ти відклав на потім.",
          en: "A personal queue of questions you saved for later.",
          de: "Eine persoenliche Warteschlange gespeicherter Fragen.",
        }),
      };
  }

  return {
    title: "Study task",
    description: "Study task",
  };
}

function getPlanTitle(locale: SupportedLocale, daysPlanned: number) {
  return copyFor(getContentLocale(locale), {
    pl: `Plan nauki na ${daysPlanned} dni`,
    ua: `План підготовки на ${daysPlanned} днів`,
    en: `${daysPlanned}-day exam plan`,
    de: `${daysPlanned}-Tage-Pruefungsplan`,
  });
}

function countTasks(
  days: GeneratedStudyPlanDay[],
  taskType: StudyPlanTaskType
) {
  return days.reduce(
    (total, day) =>
      total + day.tasks.filter((task) => task.taskType === taskType).length,
    0
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return new Date(year, month - 1, day);
}

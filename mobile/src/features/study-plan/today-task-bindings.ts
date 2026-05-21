import type {
  QuestionSessionMode,
  TopicBlockId,
} from "@prawko/config";

import type {
  RemoteTodayPlan,
  RemoteTodayPlanTask,
} from "./supabase-study-plan-progress";

export type QuestionSessionBinding = {
  mode: QuestionSessionMode;
  questionLimit?: number;
  studyPlanTaskId?: string;
  topic?: TopicBlockId;
};

type CreateTaskSessionBindingOptions = {
  includeStudyPlanTaskId?: boolean;
};

type PracticeBindingIntent =
  | "exam"
  | "hard_questions"
  | "saved"
  | "saved_sprint"
  | "seen_not_mastered"
  | "weak_spots"
  | "wrong_answers";

export function createTaskSessionBinding(
  task: RemoteTodayPlanTask,
  options: CreateTaskSessionBindingOptions = {}
): QuestionSessionBinding | null {
  const bindingBase = {
    questionLimit: getQuestionLimit(task),
    studyPlanTaskId:
      options.includeStudyPlanTaskId === false ? undefined : task.id,
  };

  switch (task.taskType) {
    case "learn_topic":
      return task.topicBlock
        ? {
            ...bindingBase,
            mode: "learning",
            topic: task.topicBlock,
          }
        : null;
    case "review_weak_spots":
      return {
        ...bindingBase,
        mode: "weak_spots",
      };
    case "review_wrong_answers":
      return {
        ...bindingBase,
        mode: "wrong_answers",
      };
    case "review_saved":
      return {
        ...bindingBase,
        mode: "saved",
      };
    case "mini_test":
      return {
        ...bindingBase,
        mode: "mini_test",
      };
    case "full_exam":
      return {
        ...bindingBase,
        mode: "exam",
      };
  }
}

export function createLearningSessionBinding(
  topic: TopicBlockId,
  todayPlan: RemoteTodayPlan | null
): QuestionSessionBinding {
  const task = findTodayTask(todayPlan, ["learn_topic"], topic);

  if (task) {
    const binding = createTaskSessionBinding(task);

    if (binding?.mode === "learning") {
      return binding;
    }
  }

  return {
    mode: "learning",
    questionLimit: getQuestionLimit(task),
    studyPlanTaskId: task?.id,
    topic,
  };
}

export function createPracticeSessionBinding(
  intent: PracticeBindingIntent,
  todayPlan: RemoteTodayPlan | null
): QuestionSessionBinding {
  switch (intent) {
    case "exam": {
      const task = findTodayTask(todayPlan, ["full_exam", "mini_test"]);
      const binding = task ? createTaskSessionBinding(task) : null;

      if (binding) {
        return binding;
      }

      return {
        mode: "exam",
      };
    }
    case "saved": {
      const task = findTodayTask(todayPlan, ["review_saved"]);
      const binding = task ? createTaskSessionBinding(task) : null;

      if (binding) {
        return binding;
      }

      return {
        mode: "saved",
      };
    }
    case "saved_sprint":
      return {
        mode: "saved_sprint",
      };
    case "hard_questions":
      return {
        mode: "hard_questions",
      };
    case "seen_not_mastered":
      return {
        mode: "seen_not_mastered",
      };
    case "weak_spots": {
      const task = findTodayTask(todayPlan, ["review_weak_spots"]);
      const binding = task ? createTaskSessionBinding(task) : null;

      if (binding) {
        return binding;
      }

      return {
        mode: "weak_spots",
      };
    }
    case "wrong_answers": {
      const task = findTodayTask(todayPlan, ["review_wrong_answers"]);
      const binding = task ? createTaskSessionBinding(task) : null;

      if (binding) {
        return binding;
      }

      return {
        mode: "wrong_answers",
      };
    }
  }
}

function findTodayTask(
  todayPlan: RemoteTodayPlan | null,
  acceptedTaskTypes: RemoteTodayPlanTask["taskType"][],
  topic?: TopicBlockId
) {
  if (!todayPlan) {
    return null;
  }

  return (
    [...todayPlan.tasks]
      .filter((task) => {
        if (
          task.status !== "in_progress" &&
          task.status !== "pending"
        ) {
          return false;
        }

        if (!acceptedTaskTypes.includes(task.taskType)) {
          return false;
        }

        if (topic && task.topicBlock !== topic) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftPriority = left.status === "in_progress" ? 0 : 1;
        const rightPriority = right.status === "in_progress" ? 0 : 1;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.sortOrder - right.sortOrder;
      })[0] ?? null
  );
}

function getQuestionLimit(task: RemoteTodayPlanTask | null) {
  return typeof task?.questionCountTarget === "number" && task.questionCountTarget > 0
    ? task.questionCountTarget
    : undefined;
}

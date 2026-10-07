import { router } from "expo-router";

import { isExamSimulatorMode } from "../exam/exam-config";
import { isExamEntry } from "../exam/exam-entry";
import { buildExamRouteParams } from "../exam/exam-routes";
import { decodePostPurchaseAction, runPostPurchaseAction } from "./v2/paywall";

export type PaywallRouteParams = Record<string, string | string[] | undefined>;

export function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

/** Entry split shared by every paywall event: where the user came from and why. */
export function getPaywallEntryProperties(params: PaywallRouteParams) {
  const returnTo = getSingleParam(params.returnTo);
  const feature = getSingleParam(params.feature);
  const optional = {
    question_id: getSingleParam(params.questionId),
    topic_id: getSingleParam(params.topicId),
    training_session_id: getSingleParam(params.trainingSessionId),
    exam_session_id: getSingleParam(params.examSessionId),
    premium_gate_id: getSingleParam(params.premiumGateId),
    block_id: getSingleParam(params.accessBlockId),
    source_screen: getSingleParam(params.sourceScreen),
    surface: getSingleParam(params.surface),
    roadmap_step_id: getSingleParam(params.roadmapStepId),
  };
  return {
    source:
      getSingleParam(params.source) ??
      (returnTo === "exam"
        ? "exam_restart"
        : feature === "ai_question_chat" || returnTo === "ai-chat"
          ? "ai_chat"
          : "profile"),
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value)),
  } as { source: string } & Partial<Record<keyof typeof optional, string>>;
}

/** Sends the user back to what the paywall interrupted; returns false when nothing applies. */
export function returnAfterPaywallUnlock(params: PaywallRouteParams) {
  if (runPostPurchaseAction(decodePostPurchaseAction(getSingleParam(params.postPurchase)))) {
    return true;
  }

  const returnTo = getSingleParam(params.returnTo);
  const questionId = getSingleParam(params.questionId);
  if (returnTo === "ai-chat" && questionId) {
    const locale = getSingleParam(params.locale);
    const selectedAnswer = getSingleParam(params.selectedAnswer);
    router.replace({
      pathname: "/modals/ai-chat",
      params: {
        questionId,
        ...(locale ? { locale } : {}),
        ...(selectedAnswer ? { selectedAnswer } : {}),
      },
    });
    return true;
  }

  if (returnTo === "exam") {
    const entry = getSingleParam(params.entry);
    const mode = getSingleParam(params.mode);
    router.replace({
      pathname: "/exam",
      params: buildExamRouteParams({
        entry: isExamEntry(entry) ? entry : "result_restart",
        mode: isExamSimulatorMode(mode) ? mode : "exam",
        questionLimit: parsePositiveInteger(getSingleParam(params.questionLimit)),
        roadmapStepId: getSingleParam(params.roadmapStepId),
        studyPlanTaskId: getSingleParam(params.studyPlanTaskId),
      }),
    });
    return true;
  }

  return false;
}

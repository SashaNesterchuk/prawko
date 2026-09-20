import { buildDiagnosticDetail } from "../../analytics/diagnostic-detail";
import {
  ANALYTICS_PROPERTIES,
  type AnalyticsProperties,
} from "../../analytics/catalog";
import {
  getAdSessionSnapshot,
  type AdInterstitialTrigger,
} from "./ad-session-policy";

export type AdDecisionStep =
  | "policy"
  | "wait_for_load"
  | "ensure_load"
  | "native_show"
  | "preload";

export const AD_PLACEMENTS = {
  afterExam: "after_exam",
  afterTraining: "after_training",
  other: "other",
  signTest: "sign_test",
  trainingQuestions: "training_questions",
} as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[keyof typeof AD_PLACEMENTS];

export type AdRevenueEvent = {
  adFormat: "interstitial";
  adNetwork: string;
  adUnitId: string;
  currency: string;
  placement: string;
  precision: string;
  revenue: number;
};

type PaidAdapterResponse = {
  adapterClassName?: string | null;
  adSourceName?: string | null;
};

type NativePaidEvent = {
  adNetwork?: string | null;
  currency?: unknown;
  precision?: unknown;
  responseInfo?: {
    adapterClassName?: string | null;
    loadedAdapterResponse?: PaidAdapterResponse | null;
  };
  value?: unknown;
};

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

const REVENUE_PRECISION_LABELS: Record<number, string> = {
  0: "unknown",
  1: "estimated",
  2: "publisher_provided",
  3: "precise",
};

export function getRevenuePrecisionLabel(precision: unknown): string {
  if (typeof precision === "string" && precision.trim()) {
    return precision.trim().toLowerCase();
  }

  if (typeof precision === "number" && Number.isInteger(precision)) {
    return REVENUE_PRECISION_LABELS[precision] ?? "unknown";
  }

  return "unknown";
}

export function resolveAdNetwork(paid: NativePaidEvent): string {
  return (
    readNonEmptyString(paid.adNetwork) ??
    readNonEmptyString(paid.responseInfo?.loadedAdapterResponse?.adSourceName) ??
    readNonEmptyString(
      paid.responseInfo?.loadedAdapterResponse?.adapterClassName
    ) ??
    readNonEmptyString(paid.responseInfo?.adapterClassName) ??
    "unknown"
  );
}

export function getAdPlacement(input: {
  pathname?: string | null;
  trigger: AdInterstitialTrigger;
}): AdPlacement {
  if (input.pathname?.includes("/signs/")) {
    return AD_PLACEMENTS.signTest;
  }

  if (
    input.trigger === "after_exam_complete" ||
    input.trigger === "exam_restart"
  ) {
    return AD_PLACEMENTS.afterExam;
  }

  if (input.trigger === "after_practice_session_complete") {
    return AD_PLACEMENTS.afterTraining;
  }

  if (input.trigger === "after_question_answer") {
    return AD_PLACEMENTS.trainingQuestions;
  }

  return AD_PLACEMENTS.other;
}

export function buildAdRevenueEvent(input: {
  adFormat?: "interstitial";
  adUnitId: string;
  paid: NativePaidEvent;
  placement: string;
}): AdRevenueEvent | null {
  const revenue = toFiniteNumber(input.paid.value);
  if (revenue == null || revenue < 0) {
    return null;
  }

  return {
    adFormat: input.adFormat ?? "interstitial",
    adNetwork: resolveAdNetwork(input.paid),
    adUnitId: input.adUnitId,
    currency: readNonEmptyString(input.paid.currency) ?? "unknown",
    placement: readNonEmptyString(input.placement) ?? AD_PLACEMENTS.other,
    precision: getRevenuePrecisionLabel(input.paid.precision),
    revenue,
  };
}

export function buildAdImpressionRevenueProperties(
  event: AdRevenueEvent
): AnalyticsProperties {
  return {
    [ANALYTICS_PROPERTIES.adFormat]: event.adFormat,
    [ANALYTICS_PROPERTIES.adNetwork]: event.adNetwork,
    [ANALYTICS_PROPERTIES.adUnitId]: event.adUnitId,
    [ANALYTICS_PROPERTIES.currency]: event.currency,
    [ANALYTICS_PROPERTIES.placement]: event.placement,
    [ANALYTICS_PROPERTIES.revenue]: event.revenue,
    [ANALYTICS_PROPERTIES.revenuePrecision]: event.precision,
  };
}

export function buildAdDecisionProperties(input: {
  after: AdInterstitialTrigger | "preload";
  loaded: boolean;
  pathname?: string | null;
  shouldShow: boolean;
  step: AdDecisionStep;
  waitForLoad: boolean;
  why: string;
}): AnalyticsProperties {
  const snapshot = getAdSessionSnapshot();
  const shouldShow = input.shouldShow ? "yes" : "no";
  const detail = buildDiagnosticDetail({
    [ANALYTICS_PROPERTIES.after]: input.after,
    [ANALYTICS_PROPERTIES.shouldShow]: shouldShow,
    [ANALYTICS_PROPERTIES.step]: input.step,
    [ANALYTICS_PROPERTIES.why]: input.why,
    answers: `${snapshot.answersSinceLastAd}/${snapshot.answersNeeded}`,
    elapsed:
      snapshot.elapsedSeconds == null
        ? "none"
        : `${snapshot.elapsedSeconds}s/${snapshot.cooldownSeconds}s`,
    shown: `${snapshot.shownThisSession}/${snapshot.maxAds}`,
    loaded: input.loaded ? "yes" : "no",
    wait: input.waitForLoad ? "yes" : "no",
    route: input.pathname ?? "none",
  });

  return {
    [ANALYTICS_PROPERTIES.after]: input.after,
    [ANALYTICS_PROPERTIES.shouldShow]: shouldShow,
    [ANALYTICS_PROPERTIES.step]: input.step,
    [ANALYTICS_PROPERTIES.why]: input.why,
    [ANALYTICS_PROPERTIES.detail]: detail,
  };
}

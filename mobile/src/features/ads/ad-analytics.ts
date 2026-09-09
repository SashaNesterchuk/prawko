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

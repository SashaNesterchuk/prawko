import { AD_POLICY } from "@prawko/config";

export type AdInterstitialTrigger =
  | "after_question_answer"
  | "after_practice_session_complete"
  | "after_exam_complete"
  | "exam_restart"
  | "app_resume";

export type AdSkipReason =
  | "plus_user"
  | "cooldown"
  | "cap"
  | "exam_active"
  | "not_loaded"
  | "disabled"
  | "trigger_not_ready"
  | "blocked_route";

type AdSessionState = {
  adsShownThisSession: number;
  lastAdShownAt: number | null;
  lastActivityAt: number;
  questionsAnsweredSinceLastAd: number;
  sessionStartedAt: number;
};

let sessionState: AdSessionState = createFreshSessionState();
let examSessionActive = false;
let lastBackgroundAt: number | null = null;

export function createFreshSessionState(): AdSessionState {
  const now = Date.now();

  return {
    adsShownThisSession: 0,
    lastAdShownAt: null,
    lastActivityAt: now,
    questionsAnsweredSinceLastAd: 0,
    sessionStartedAt: now,
  };
}

export function touchAdSessionActivity() {
  const now = Date.now();
  const inactivityMs = AD_POLICY.sessionInactivityResetMinutes * 60 * 1000;

  if (now - sessionState.lastActivityAt >= inactivityMs) {
    sessionState = createFreshSessionState();
    return;
  }

  sessionState = {
    ...sessionState,
    lastActivityAt: now,
  };
}

export function recordQuestionAnsweredForAds() {
  touchAdSessionActivity();
  sessionState = {
    ...sessionState,
    questionsAnsweredSinceLastAd: sessionState.questionsAnsweredSinceLastAd + 1,
  };
}

export function recordAdShown() {
  const now = Date.now();

  sessionState = {
    ...sessionState,
    adsShownThisSession: sessionState.adsShownThisSession + 1,
    lastAdShownAt: now,
    lastActivityAt: now,
    questionsAnsweredSinceLastAd: 0,
  };
}

export function setExamSessionActive(active: boolean) {
  examSessionActive = active;
}

export function isExamSessionActive() {
  return examSessionActive;
}

export function markAppBackgrounded() {
  lastBackgroundAt = Date.now();
}

/** Clear resume-ad tracking (e.g. after an interstitial briefly backgrounds the app). */
export function clearAppBackgroundMark() {
  lastBackgroundAt = null;
}

let suppressAppResumeAdsUntil = 0;

export function suppressAppResumeAds(durationMs = 8_000) {
  suppressAppResumeAdsUntil = Date.now() + durationMs;
}

export function isAppResumeAdsSuppressed() {
  return Date.now() < suppressAppResumeAdsUntil;
}

export function getLastAdShownAt() {
  return sessionState.lastAdShownAt;
}

/** Test-only: wipe module session so suites stay isolated. */
export function resetAdSessionStateForTests() {
  sessionState = createFreshSessionState();
  examSessionActive = false;
  lastBackgroundAt = null;
  suppressAppResumeAdsUntil = 0;
}

export function shouldShowInterstitialForTrigger(
  trigger: AdInterstitialTrigger,
  input: {
    hasPlusAccess: boolean;
    adsEnabled: boolean;
    practiceAnsweredCount?: number | null;
    routeBlocked?: boolean;
  }
): { allowed: boolean; reason: AdSkipReason | null } {
  if (!input.adsEnabled) {
    return { allowed: false, reason: "disabled" };
  }

  if (input.hasPlusAccess) {
    return { allowed: false, reason: "plus_user" };
  }

  if (input.routeBlocked) {
    return { allowed: false, reason: "blocked_route" };
  }

  touchAdSessionActivity();

  if (examSessionActive) {
    return { allowed: false, reason: "exam_active" };
  }

  if (sessionState.adsShownThisSession >= AD_POLICY.maxAdsPerSession) {
    return { allowed: false, reason: "cap" };
  }

  if (trigger !== "after_exam_complete" && sessionState.lastAdShownAt) {
    const elapsedSeconds = (Date.now() - sessionState.lastAdShownAt) / 1000;

    if (elapsedSeconds < AD_POLICY.minSecondsBetweenAds) {
      return { allowed: false, reason: "cooldown" };
    }
  }

  if (trigger === "after_question_answer") {
    if (
      sessionState.questionsAnsweredSinceLastAd <
      AD_POLICY.questionsBetweenInterstitials
    ) {
      return { allowed: false, reason: "trigger_not_ready" };
    }
  }

  if (trigger === "after_practice_session_complete") {
    const answeredCount = input.practiceAnsweredCount ?? 0;

    if (
      answeredCount < 1 ||
      answeredCount >= AD_POLICY.questionsBetweenInterstitials
    ) {
      return { allowed: false, reason: "trigger_not_ready" };
    }
  }

  if (trigger === "app_resume") {
    if (!lastBackgroundAt) {
      return { allowed: false, reason: "trigger_not_ready" };
    }

    const backgroundMinutes = (Date.now() - lastBackgroundAt) / (60 * 1000);

    if (backgroundMinutes < AD_POLICY.appResumeBackgroundMinutes) {
      return { allowed: false, reason: "trigger_not_ready" };
    }
  }

  return { allowed: true, reason: null };
}

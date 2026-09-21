import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type MonetizationMoment =
  | "after_exam"
  | "after_ad"
  | "app_open"
  | "manual_test";

export type MonetizationSurface = "teaser" | "paywall";

export type MonetizationRequest = {
  id: string;
  moment: MonetizationMoment;
  requestedAt: number;
  surface: MonetizationSurface;
};

type MonetizationState = {
  activeDates: string[];
  adsShownLifetime: number;
  countedExamSessionIds: string[];
  countedTrainingSessionIds: string[];
  closeSurface: () => void;
  examCompletedLifetime: number;
  examQuestionsAnsweredLifetime: number;
  hasHydrated: boolean;
  installedAt: string;
  launchCount: number;
  pendingRequest: MonetizationRequest | null;
  recordAdDismissed: () => number;
  recordExamCompleted: (
    sessionId: string,
    answeredCount: number
  ) => CompletionRecord;
  recordLaunch: () => { isFirstEverLaunch: boolean };
  recordTrainingCompleted: (sessionId: string) => CompletionRecord;
  requestSurface: (
    surface: MonetizationSurface,
    moment: MonetizationMoment
  ) => boolean;
  resetMonetization: () => void;
  resolveRequest: (id: string) => void;
  setHasHydrated: (value: boolean) => void;
  setInstalledAt: (value: Date) => void;
  trainingCompletedLifetime: number;
};

type CompletionRecord = {
  count: number;
  isNew: boolean;
};

type SessionState = {
  adsShown: number;
  lastPaywallShownAt: number | null;
  lastTeaserShownAt: number | null;
  paywallsShown: number;
  sessionId: string;
  teasersShown: number;
  trainingCompleted: number;
};

const MAX_COUNTED_SESSION_IDS = 100;
const PAYWALL_LIMIT = 2;
const PAYWALL_MIN_INTERVAL_MS = 5 * 60 * 1000;
const TEASER_LIMIT = 2;
const TEASER_MIN_INTERVAL_MS = 2 * 60 * 1000;

let sessionState = createSessionState();

function createSessionState(): SessionState {
  return {
    adsShown: 0,
    lastPaywallShownAt: null,
    lastTeaserShownAt: null,
    paywallsShown: 0,
    sessionId: `monetization-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`,
    teasersShown: 0,
    trainingCompleted: 0,
  };
}

function getLocalDateKey(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function getPriority(moment: MonetizationMoment) {
  if (moment === "after_exam") return 4;
  if (moment === "after_ad") return 2;
  return 1;
}

export function shouldShowTeaserAfterAd(adsShown: number) {
  return adsShown > 0 && adsShown % 2 === 1;
}

export function canShowMonetizationSurface(
  surface: MonetizationSurface,
  now = Date.now(),
  moment?: MonetizationMoment
) {
  const ignoreSessionCap =
    moment === "after_ad" || moment === "manual_test";

  if (surface === "teaser") {
    return (
      (ignoreSessionCap || sessionState.teasersShown < TEASER_LIMIT) &&
      (sessionState.lastTeaserShownAt == null ||
        now - sessionState.lastTeaserShownAt >= TEASER_MIN_INTERVAL_MS)
    );
  }

  return (
    sessionState.paywallsShown < PAYWALL_LIMIT &&
    (sessionState.lastPaywallShownAt == null ||
      now - sessionState.lastPaywallShownAt >= PAYWALL_MIN_INTERVAL_MS)
  );
}

export function markMonetizationSurfaceShown(
  surface: MonetizationSurface,
  now = Date.now()
) {
  if (surface === "teaser") {
    sessionState = {
      ...sessionState,
      lastTeaserShownAt: now,
      teasersShown: sessionState.teasersShown + 1,
    };
    return;
  }

  sessionState = {
    ...sessionState,
    lastPaywallShownAt: now,
    paywallsShown: sessionState.paywallsShown + 1,
  };
}

export function getMonetizationSessionSnapshot() {
  return { ...sessionState };
}

export function resetMonetizationSessionForTests() {
  sessionState = createSessionState();
}

function rememberSessionId(ids: string[], sessionId: string) {
  return [...ids.filter((id) => id !== sessionId), sessionId].slice(
    -MAX_COUNTED_SESSION_IDS
  );
}

const initialPersistentState = {
  activeDates: [] as string[],
  adsShownLifetime: 0,
  countedExamSessionIds: [] as string[],
  countedTrainingSessionIds: [] as string[],
  examCompletedLifetime: 0,
  examQuestionsAnsweredLifetime: 0,
  installedAt: new Date().toISOString(),
  launchCount: 0,
  trainingCompletedLifetime: 0,
};

export const useMonetizationStore = create<MonetizationState>()(
  persist(
    (set, get) => ({
      ...initialPersistentState,
      hasHydrated: false,
      pendingRequest: null,
      closeSurface: () => set({ pendingRequest: null }),
      recordAdDismissed: () => {
        sessionState = {
          ...sessionState,
          adsShown: sessionState.adsShown + 1,
        };
        set((state) => ({
          adsShownLifetime: state.adsShownLifetime + 1,
        }));
        if (shouldShowTeaserAfterAd(sessionState.adsShown)) {
          // Any interstitial placement: training, exam, questions, resume.
          get().requestSurface("teaser", "after_ad");
        }
        return sessionState.adsShown;
      },
      recordExamCompleted: (sessionId, answeredCount) => {
        const state = get();
        if (state.countedExamSessionIds.includes(sessionId)) {
          return { count: state.examCompletedLifetime, isNew: false };
        }

        const nextCount = state.examCompletedLifetime + 1;
        set({
          countedExamSessionIds: rememberSessionId(
            state.countedExamSessionIds,
            sessionId
          ),
          examCompletedLifetime: nextCount,
          examQuestionsAnsweredLifetime:
            state.examQuestionsAnsweredLifetime + Math.max(0, answeredCount),
        });
        return { count: nextCount, isNew: true };
      },
      recordLaunch: () => {
        const state = get();
        const isFirstEverLaunch = state.launchCount === 0;
        const today = getLocalDateKey();
        set({
          activeDates: state.activeDates.includes(today)
            ? state.activeDates
            : [...state.activeDates, today],
          launchCount: state.launchCount + 1,
        });
        return { isFirstEverLaunch };
      },
      recordTrainingCompleted: (sessionId) => {
        const state = get();
        if (state.countedTrainingSessionIds.includes(sessionId)) {
          return { count: state.trainingCompletedLifetime, isNew: false };
        }

        sessionState = {
          ...sessionState,
          trainingCompleted: sessionState.trainingCompleted + 1,
        };
        const nextCount = state.trainingCompletedLifetime + 1;
        set({
          countedTrainingSessionIds: rememberSessionId(
            state.countedTrainingSessionIds,
            sessionId
          ),
          trainingCompletedLifetime: nextCount,
        });
        return { count: nextCount, isNew: true };
      },
      requestSurface: (surface, moment) => {
        const isManualTest = moment === "manual_test";

        if (!isManualTest && !canShowMonetizationSurface(surface, Date.now(), moment)) {
          return false;
        }

        const pending = get().pendingRequest;
        if (
          !isManualTest &&
          pending &&
          getPriority(pending.moment) >= getPriority(moment)
        ) {
          return false;
        }

        set({
          pendingRequest: {
            id: `${moment}-${Date.now().toString(36)}`,
            moment,
            requestedAt: Date.now(),
            surface,
          },
        });
        return true;
      },
      resetMonetization: () => {
        sessionState = createSessionState();
        set({
          ...initialPersistentState,
          installedAt: new Date().toISOString(),
          hasHydrated: true,
          pendingRequest: null,
        });
      },
      resolveRequest: (id) =>
        set((state) =>
          state.pendingRequest?.id === id
            ? { pendingRequest: null }
            : state
        ),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setInstalledAt: (value) => {
        if (!Number.isFinite(value.getTime())) return;

        set((state) => ({
          installedAt:
            value.getTime() < Date.parse(state.installedAt)
              ? value.toISOString()
              : state.installedAt,
        }));
      },
    }),
    {
      name: "prawko-monetization-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeDates: state.activeDates,
        adsShownLifetime: state.adsShownLifetime,
        countedExamSessionIds: state.countedExamSessionIds,
        countedTrainingSessionIds: state.countedTrainingSessionIds,
        examCompletedLifetime: state.examCompletedLifetime,
        examQuestionsAnsweredLifetime: state.examQuestionsAnsweredLifetime,
        installedAt: state.installedAt,
        launchCount: state.launchCount,
        trainingCompletedLifetime: state.trainingCompletedLifetime,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export function getMonetizationAnalyticsSnapshot(questionsAnswered: number) {
  const state = useMonetizationStore.getState();
  const installedAtMs = Date.parse(state.installedAt);

  return {
    active_days: state.activeDates.length,
    ads_shown_lifetime: state.adsShownLifetime,
    ads_shown_session: sessionState.adsShown,
    days_since_install: Number.isFinite(installedAtMs)
      ? Math.max(0, Math.floor((Date.now() - installedAtMs) / 86_400_000))
      : 0,
    exam_completed_lifetime: state.examCompletedLifetime,
    questions_answered_lifetime:
      Math.max(0, questionsAnswered) + state.examQuestionsAnsweredLifetime,
    session_id: sessionState.sessionId,
    training_completed_lifetime: state.trainingCompletedLifetime,
    training_completed_session: sessionState.trainingCompleted,
  };
}

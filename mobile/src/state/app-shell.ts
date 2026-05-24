import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_CATEGORY,
  DEFAULT_LOCALE,
  type DrivingCategory,
  type PlanLevel,
  type SupportedLocale,
} from "@prawko/config";
import type { GeneratedStudyPlan } from "@prawko/schemas";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { isMockAuthEnabled } from "../config/env";

type AuthMode = "mock" | "supabase";

type AppUser = {
  id: string;
  email: string;
  fullName: string;
  provider: AuthMode;
};

type OnboardingProgress = {
  categoryDone: boolean;
  examIntroSeen: boolean;
  languageDone: boolean;
  levelDone: boolean;
  minutesDone: boolean;
  scheduleDone: boolean;
  schoolCodeDone: boolean;
};

type StudyPlanSetupDraft = {
  daysUntilExam: number | null;
  examDate: string | null;
  level: PlanLevel | null;
  minutesPerDay: number | null;
  schoolCode: string;
};

export type OnboardingRoute =
  | "/(onboarding)/language"
  | "/(onboarding)/category"
  | "/(onboarding)/exam-intro"
  | "/(onboarding)/exam-schedule"
  | "/(onboarding)/minutes"
  | "/(onboarding)/level"
  | "/(onboarding)/school-code"
  | "/(onboarding)/access"
  | "/(onboarding)/preview";

type AppShellState = {
  authMode: AuthMode;
  currentStudyPlan: GeneratedStudyPlan | null;
  currentStudyPlanRemoteId: string | null;
  hasHydrated: boolean;
  mockUser: AppUser | null;
  onboardingCompleted: boolean;
  onboardingProgress: OnboardingProgress;
  preferredCategory: DrivingCategory;
  preferredLocale: SupportedLocale;
  enablePjmTracks: boolean;
  sessionResolved: boolean;
  studyPlanSetup: StudyPlanSetupDraft;
  supabaseUser: AppUser | null;
  clearCurrentStudyPlan: () => void;
  completeCategoryStep: () => void;
  completeLanguageStep: () => void;
  completeOnboarding: () => void;
  hydrateRemoteProfile: (payload: {
    onboardingCompleted: boolean;
    preferredCategory: DrivingCategory;
    preferredLocale: SupportedLocale;
  }) => void;
  hydrateRemoteStudyPlan: (payload: {
    plan: GeneratedStudyPlan | null;
    remoteId: string | null;
  }) => void;
  markExamIntroSeen: () => void;
  resetShell: () => void;
  saveCurrentStudyPlan: (plan: GeneratedStudyPlan) => void;
  setExamSchedule: (payload: {
    daysUntilExam: number;
    examDate: string;
  }) => void;
  setCurrentStudyPlanRemoteId: (remoteId: string | null) => void;
  setHasHydrated: (value: boolean) => void;
  setLevel: (level: PlanLevel) => void;
  setMinutesPerDay: (minutesPerDay: number) => void;
  setPreferredCategory: (category: DrivingCategory) => void;
  setPreferredLocale: (locale: SupportedLocale) => void;
  setEnablePjmTracks: (enabled: boolean) => void;
  setSchoolCode: (schoolCode: string) => void;
  setSessionResolved: (value: boolean) => void;
  setSupabaseUser: (user: AppUser | null) => void;
  signInMock: () => void;
  signOutLocal: () => void;
};

type PersistedAppShellState = Pick<
  AppShellState,
  | "authMode"
  | "currentStudyPlan"
  | "currentStudyPlanRemoteId"
  | "mockUser"
  | "onboardingCompleted"
  | "onboardingProgress"
  | "preferredCategory"
  | "preferredLocale"
  | "enablePjmTracks"
  | "studyPlanSetup"
>;

const defaultOnboardingProgress: OnboardingProgress = {
  categoryDone: false,
  examIntroSeen: false,
  languageDone: false,
  levelDone: false,
  minutesDone: false,
  scheduleDone: false,
  schoolCodeDone: false,
};

const defaultStudyPlanSetup: StudyPlanSetupDraft = {
  daysUntilExam: null,
  examDate: null,
  level: null,
  minutesPerDay: null,
  schoolCode: "",
};

function createCompletedOnboardingProgress(): OnboardingProgress {
  return {
    categoryDone: true,
    examIntroSeen: true,
    languageDone: true,
    levelDone: true,
    minutesDone: true,
    scheduleDone: true,
    schoolCodeDone: true,
  };
}

function createMockUser(): AppUser {
  return {
    id: "mock-user",
    email: "demo@prawko.app",
    fullName: "Demo Student",
    provider: "mock",
  };
}

function getSignedOutAuthMode(): AuthMode {
  return isMockAuthEnabled ? "mock" : "supabase";
}

function getNextMockUser(mockUser: AppUser | null) {
  return isMockAuthEnabled && mockUser?.provider === "mock" ? mockUser : null;
}

function normalizePersistedShellState(
  persistedState: Partial<PersistedAppShellState> | undefined,
): PersistedAppShellState {
  const nextMockUser = getNextMockUser(persistedState?.mockUser ?? null);
  const authMode =
    persistedState?.authMode === "mock" && nextMockUser ? "mock" : "supabase";

  return {
    authMode,
    currentStudyPlan: persistedState?.currentStudyPlan ?? null,
    currentStudyPlanRemoteId: persistedState?.currentStudyPlanRemoteId ?? null,
    mockUser: authMode === "mock" ? nextMockUser : null,
    onboardingCompleted: persistedState?.onboardingCompleted ?? false,
    onboardingProgress:
      persistedState?.onboardingProgress ?? defaultOnboardingProgress,
    preferredCategory: persistedState?.preferredCategory ?? DEFAULT_CATEGORY,
    preferredLocale: persistedState?.preferredLocale ?? DEFAULT_LOCALE,
    enablePjmTracks: persistedState?.enablePjmTracks ?? false,
    studyPlanSetup: persistedState?.studyPlanSetup ?? defaultStudyPlanSetup,
  };
}

export const useAppShellStore = create<AppShellState>()(
  persist(
    (set) => ({
      authMode: getSignedOutAuthMode(),
      currentStudyPlan: null,
      currentStudyPlanRemoteId: null,
      hasHydrated: false,
      mockUser: null,
      onboardingCompleted: false,
      onboardingProgress: defaultOnboardingProgress,
      preferredCategory: DEFAULT_CATEGORY,
      preferredLocale: DEFAULT_LOCALE,
      enablePjmTracks: false,
      sessionResolved: false,
      studyPlanSetup: defaultStudyPlanSetup,
      supabaseUser: null,
      clearCurrentStudyPlan: () =>
        set({ currentStudyPlan: null, currentStudyPlanRemoteId: null }),
      completeCategoryStep: () =>
        set((state) => ({
          onboardingProgress: {
            ...state.onboardingProgress,
            categoryDone: true,
          },
        })),
      completeLanguageStep: () =>
        set((state) => ({
          onboardingProgress: {
            ...state.onboardingProgress,
            languageDone: true,
          },
        })),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      hydrateRemoteProfile: ({
        onboardingCompleted,
        preferredCategory,
        preferredLocale,
      }) =>
        set((state) => ({
          onboardingCompleted,
          onboardingProgress: onboardingCompleted
            ? createCompletedOnboardingProgress()
            : state.onboardingProgress,
          preferredCategory,
          preferredLocale,
        })),
      hydrateRemoteStudyPlan: ({ plan, remoteId }) =>
        set((state) => ({
          currentStudyPlan: plan,
          currentStudyPlanRemoteId: remoteId,
          onboardingCompleted: plan ? true : state.onboardingCompleted,
          onboardingProgress: plan
            ? createCompletedOnboardingProgress()
            : state.onboardingProgress,
          studyPlanSetup: plan
            ? {
                daysUntilExam: plan.daysPlanned,
                examDate: plan.examDate,
                level: plan.level,
                minutesPerDay: plan.minutesPerDay,
                schoolCode: plan.schoolCode ?? "",
              }
            : state.studyPlanSetup,
        })),
      markExamIntroSeen: () =>
        set((state) => ({
          onboardingProgress: {
            ...state.onboardingProgress,
            examIntroSeen: true,
          },
        })),
      resetShell: () =>
        set({
          authMode: getSignedOutAuthMode(),
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          hasHydrated: true,
          mockUser: null,
          onboardingCompleted: false,
          onboardingProgress: defaultOnboardingProgress,
          preferredCategory: DEFAULT_CATEGORY,
          preferredLocale: DEFAULT_LOCALE,
          enablePjmTracks: false,
          sessionResolved: true,
          studyPlanSetup: defaultStudyPlanSetup,
          supabaseUser: null,
        }),
      saveCurrentStudyPlan: (currentStudyPlan) => set({ currentStudyPlan }),
      setExamSchedule: ({ daysUntilExam, examDate }) =>
        set((state) => ({
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          onboardingProgress: {
            ...state.onboardingProgress,
            scheduleDone: true,
          },
          studyPlanSetup: {
            ...state.studyPlanSetup,
            daysUntilExam,
            examDate,
          },
        })),
      setCurrentStudyPlanRemoteId: (currentStudyPlanRemoteId) =>
        set({ currentStudyPlanRemoteId }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setLevel: (level) =>
        set((state) => ({
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          onboardingProgress: {
            ...state.onboardingProgress,
            levelDone: true,
          },
          studyPlanSetup: {
            ...state.studyPlanSetup,
            level,
          },
        })),
      setMinutesPerDay: (minutesPerDay) =>
        set((state) => ({
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          onboardingProgress: {
            ...state.onboardingProgress,
            minutesDone: true,
          },
          studyPlanSetup: {
            ...state.studyPlanSetup,
            minutesPerDay,
          },
        })),
      setPreferredCategory: (preferredCategory) => set({ preferredCategory }),
      setPreferredLocale: (preferredLocale) => set({ preferredLocale }),
      setEnablePjmTracks: (enablePjmTracks) => set({ enablePjmTracks }),
      setSchoolCode: (schoolCode) =>
        set((state) => ({
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          onboardingProgress: {
            ...state.onboardingProgress,
            schoolCodeDone: true,
          },
          studyPlanSetup: {
            ...state.studyPlanSetup,
            schoolCode,
          },
        })),
      setSessionResolved: (value) => set({ sessionResolved: value }),
      setSupabaseUser: (supabaseUser) =>
        set((state) => {
          const nextMockUser = supabaseUser
            ? null
            : getNextMockUser(state.mockUser);

          return {
            supabaseUser,
            mockUser: nextMockUser,
            authMode: supabaseUser
              ? "supabase"
              : nextMockUser
                ? "mock"
                : getSignedOutAuthMode(),
          };
        }),
      signInMock: () =>
        set((state) => {
          if (!isMockAuthEnabled) {
            return state;
          }

          return {
            authMode: "mock",
            mockUser: createMockUser(),
            supabaseUser: null,
          };
        }),
      signOutLocal: () =>
        set({
          authMode: getSignedOutAuthMode(),
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          mockUser: null,
          onboardingCompleted: false,
          onboardingProgress: defaultOnboardingProgress,
          studyPlanSetup: defaultStudyPlanSetup,
          supabaseUser: null,
        }),
    }),
    {
      name: "prawko-mobile-shell",
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persistedState) =>
        normalizePersistedShellState(
          (persistedState as Partial<PersistedAppShellState> | undefined) ??
            undefined,
        ),
      partialize: (state) => ({
        authMode: state.authMode,
        currentStudyPlan: state.currentStudyPlan,
        currentStudyPlanRemoteId: state.currentStudyPlanRemoteId,
        mockUser: state.mockUser,
        onboardingCompleted: state.onboardingCompleted,
        onboardingProgress: state.onboardingProgress,
        preferredCategory: state.preferredCategory,
        preferredLocale: state.preferredLocale,
        enablePjmTracks: state.enablePjmTracks,
        studyPlanSetup: state.studyPlanSetup,
      }),
      onRehydrateStorage: () => (state) => {
        if (!isMockAuthEnabled && state?.authMode === "mock") {
          state.setSupabaseUser(null);
        }

        state?.setHasHydrated(true);
      },
    },
  ),
);

export function getCurrentUserFromState(state: AppShellState) {
  return state.authMode === "supabase" ? state.supabaseUser : state.mockUser;
}

export function getNextOnboardingRoute(state: AppShellState): OnboardingRoute {
  if (!state.onboardingProgress.languageDone) {
    return "/(onboarding)/language";
  }

  if (!state.onboardingProgress.categoryDone) {
    return "/(onboarding)/category";
  }

  if (!state.onboardingProgress.examIntroSeen) {
    return "/(onboarding)/exam-intro";
  }

  if (
    !state.onboardingProgress.scheduleDone ||
    state.studyPlanSetup.daysUntilExam === null ||
    state.studyPlanSetup.examDate === null
  ) {
    return "/(onboarding)/exam-schedule";
  }

  if (
    !state.onboardingProgress.minutesDone ||
    state.studyPlanSetup.minutesPerDay === null
  ) {
    return "/(onboarding)/minutes";
  }

  if (
    !state.onboardingProgress.levelDone ||
    state.studyPlanSetup.level === null
  ) {
    return "/(onboarding)/level";
  }

  if (!state.onboardingProgress.schoolCodeDone) {
    return "/(onboarding)/school-code";
  }

  if (!getCurrentUserFromState(state)) {
    return "/(onboarding)/access";
  }

  return "/(onboarding)/preview";
}

export function useCurrentUser() {
  return useAppShellStore((state) => getCurrentUserFromState(state));
}

export function useCurrentStudyPlan() {
  return useAppShellStore((state) => state.currentStudyPlan);
}

export function useCurrentStudyPlanRemoteId() {
  return useAppShellStore((state) => state.currentStudyPlanRemoteId);
}

export function useHasHydrated() {
  return useAppShellStore((state) => state.hasHydrated);
}

export function useNextOnboardingRoute() {
  return useAppShellStore((state) => getNextOnboardingRoute(state));
}

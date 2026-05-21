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
  setSchoolCode: (schoolCode: string) => void;
  setSessionResolved: (value: boolean) => void;
  setSupabaseUser: (user: AppUser | null) => void;
  signInMock: () => void;
  signOutLocal: () => void;
};

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

export const useAppShellStore = create<AppShellState>()(
  persist(
    (set) => ({
      authMode: "mock",
      currentStudyPlan: null,
      currentStudyPlanRemoteId: null,
      hasHydrated: false,
      mockUser: null,
      onboardingCompleted: false,
      onboardingProgress: defaultOnboardingProgress,
      preferredCategory: DEFAULT_CATEGORY,
      preferredLocale: DEFAULT_LOCALE,
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
          authMode: "mock",
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          hasHydrated: true,
          mockUser: null,
          onboardingCompleted: false,
          onboardingProgress: defaultOnboardingProgress,
          preferredCategory: DEFAULT_CATEGORY,
          preferredLocale: DEFAULT_LOCALE,
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
        set((state) => ({
          supabaseUser,
          mockUser: supabaseUser ? null : state.mockUser,
          authMode: supabaseUser
            ? "supabase"
            : state.authMode === "supabase"
              ? "mock"
              : state.authMode,
        })),
      signInMock: () =>
        set({
          authMode: "mock",
          mockUser: {
            id: "mock-user",
            email: "demo@prawko.app",
            fullName: "Demo Student",
            provider: "mock",
          },
        }),
      signOutLocal: () =>
        set({
          authMode: "mock",
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
      partialize: (state) => ({
        authMode: state.authMode,
        currentStudyPlan: state.currentStudyPlan,
        currentStudyPlanRemoteId: state.currentStudyPlanRemoteId,
        mockUser: state.mockUser,
        onboardingCompleted: state.onboardingCompleted,
        onboardingProgress: state.onboardingProgress,
        preferredCategory: state.preferredCategory,
        preferredLocale: state.preferredLocale,
        studyPlanSetup: state.studyPlanSetup,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
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

  if (!state.onboardingProgress.levelDone || state.studyPlanSetup.level === null) {
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

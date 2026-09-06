import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_CATEGORY,
  DEFAULT_COUNTRY_CODE,
  getCountryConfig,
  isCountryCode,
  isDrivingCategory,
  resolveLocaleForCountry,
  type CountryCode,
  type DrivingCategory,
  type PlanLevel,
  type SupportedLocale,
} from "@prawko/config";
import type { GeneratedStudyPlan } from "@prawko/schemas";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { isMockAuthEnabled } from "../config/env";
import {
  getSupportedDeviceLocale,
  normalizeSupportedLocale,
} from "../i18n/locale";

type AuthMode = "mock" | "supabase";

type AppUser = {
  id: string;
  email: string;
  fullName: string;
  provider: AuthMode;
};

type OnboardingProgress = {
  categoryDone: boolean;
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

export type NotificationHour = {
  hour: number;
  minute: number;
};

export type OnboardingRoute =
  | "/(onboarding)/language"
  | "/(onboarding)/category"
  | "/(onboarding)/exam-schedule"
  | "/(onboarding)/notifications"
  | "/(onboarding)/minutes"
  | "/(onboarding)/level"
  | "/(onboarding)/school-code"
  | "/(onboarding)/access"
  | "/(onboarding)/preview";

type CountrySessionSnapshot = {
  currentStudyPlan: GeneratedStudyPlan | null;
  currentStudyPlanRemoteId: string | null;
  preferredCategory: DrivingCategory;
  studyPlanSetup: StudyPlanSetupDraft;
};

type AppShellState = {
  authMode: AuthMode;
  countrySessions: Partial<Record<CountryCode, CountrySessionSnapshot>>;
  currentStudyPlan: GeneratedStudyPlan | null;
  currentStudyPlanRemoteId: string | null;
  examCountry: CountryCode | null;
  homeStartSpotlightDismissed: boolean;
  hasHydrated: boolean;
  mockUser: AppUser | null;
  onboardingCompleted: boolean;
  onboardingProgress: OnboardingProgress;
  preferredCategory: DrivingCategory;
  preferredLocale: SupportedLocale;
  hasChosenPreferredLocale: boolean;
  enablePjmTracks: boolean;
  isScheduleNotificationEnabled: boolean;
  notificationHours: NotificationHour[];
  pushNotificationToken: string | null;
  scheduledNotificationIds: string[];
  sessionResolved: boolean;
  studyPlanSetup: StudyPlanSetupDraft;
  supabaseUser: AppUser | null;
  clearCurrentStudyPlan: () => void;
  dismissHomeStartSpotlight: () => void;
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
  resetShell: () => void;
  resolveExamCountry: (country: CountryCode) => void;
  saveCurrentStudyPlan: (plan: GeneratedStudyPlan) => void;
  setExamSchedule: (payload: {
    daysUntilExam: number;
    examDate: string | null;
  }) => void;
  /** Updates exam date in setup without clearing an active study plan. */
  patchExamDate: (payload: {
    daysUntilExam: number;
    examDate: string | null;
  }) => void;
  setCurrentStudyPlanRemoteId: (remoteId: string | null) => void;
  setHasHydrated: (value: boolean) => void;
  setLevel: (level: PlanLevel) => void;
  setMinutesPerDay: (minutesPerDay: number) => void;
  setPreferredCategory: (category: DrivingCategory) => void;
  setPreferredLocale: (locale: SupportedLocale) => void;
  setPushNotificationToken: (token: string | null) => void;
  setScheduleNotificationEnabled: (enabled: boolean) => void;
  setScheduledNotificationIds: (ids: string[]) => void;
  setEnablePjmTracks: (enabled: boolean) => void;
  setExamCountry: (country: CountryCode) => void;
  setSchoolCode: (schoolCode: string) => void;
  setSessionResolved: (value: boolean) => void;
  setSupabaseUser: (user: AppUser | null) => void;
  signInMock: () => void;
  signOutLocal: () => void;
};

type PersistedAppShellState = Pick<
  AppShellState,
  | "authMode"
  | "countrySessions"
  | "currentStudyPlan"
  | "currentStudyPlanRemoteId"
  | "examCountry"
  | "mockUser"
  | "onboardingCompleted"
  | "onboardingProgress"
  | "preferredCategory"
  | "preferredLocale"
  | "hasChosenPreferredLocale"
  | "homeStartSpotlightDismissed"
  | "enablePjmTracks"
  | "isScheduleNotificationEnabled"
  | "notificationHours"
  | "pushNotificationToken"
  | "scheduledNotificationIds"
  | "studyPlanSetup"
>;

const defaultOnboardingProgress: OnboardingProgress = {
  categoryDone: false,
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

export const DEFAULT_NOTIFICATION_HOURS: NotificationHour[] = [
  { hour: 19, minute: 0 },
];

function createCompletedOnboardingProgress(): OnboardingProgress {
  return {
    categoryDone: true,
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

function getDefaultPreferredLocale(
  country: CountryCode | null | undefined,
): SupportedLocale {
  return resolveLocaleForCountry(country, getSupportedDeviceLocale());
}

function getSignedOutAuthMode(): AuthMode {
  return isMockAuthEnabled ? "mock" : "supabase";
}

function getNextMockUser(mockUser: AppUser | null) {
  return isMockAuthEnabled && mockUser?.provider === "mock" ? mockUser : null;
}

function normalizePersistedLocale(
  country: CountryCode | null | undefined,
  locale: SupportedLocale | null | undefined,
): SupportedLocale {
  return resolveLocaleForCountry(
    country,
    normalizeSupportedLocale(locale ?? null),
  );
}

function normalizePersistedCategory(
  country: CountryCode | null | undefined,
  category: string | null | undefined,
): DrivingCategory {
  const config = getCountryConfig(country);
  const resolved = isDrivingCategory(category) ? category : DEFAULT_CATEGORY;
  return config.categories.includes(resolved) ? resolved : DEFAULT_CATEGORY;
}

function captureCountrySession(state: {
  currentStudyPlan: GeneratedStudyPlan | null;
  currentStudyPlanRemoteId: string | null;
  preferredCategory: DrivingCategory;
  studyPlanSetup: StudyPlanSetupDraft;
}): CountrySessionSnapshot {
  return {
    currentStudyPlan: state.currentStudyPlan,
    currentStudyPlanRemoteId: state.currentStudyPlanRemoteId,
    preferredCategory: state.preferredCategory,
    studyPlanSetup: state.studyPlanSetup,
  };
}

function emptyCountrySession(): CountrySessionSnapshot {
  return {
    currentStudyPlan: null,
    currentStudyPlanRemoteId: null,
    preferredCategory: DEFAULT_CATEGORY,
    studyPlanSetup: defaultStudyPlanSetup,
  };
}

function applyExamCountryChange(
  state: PersistedAppShellState,
  country: CountryCode,
): Pick<
  PersistedAppShellState,
  | "countrySessions"
  | "currentStudyPlan"
  | "currentStudyPlanRemoteId"
  | "examCountry"
  | "preferredCategory"
  | "preferredLocale"
  | "studyPlanSetup"
> {
  const countrySessions = { ...state.countrySessions };

  if (state.examCountry && state.examCountry !== country) {
    countrySessions[state.examCountry] = captureCountrySession(state);
  }

  const restored =
    countrySessions[country] ??
    (state.examCountry ? emptyCountrySession() : captureCountrySession(state));

  return {
    countrySessions,
    currentStudyPlan: restored.currentStudyPlan,
    currentStudyPlanRemoteId: restored.currentStudyPlanRemoteId,
    examCountry: country,
    preferredCategory: normalizePersistedCategory(
      country,
      restored.preferredCategory,
    ),
    preferredLocale: normalizePersistedLocale(country, state.preferredLocale),
    studyPlanSetup: restored.studyPlanSetup,
  };
}

function normalizePersistedExamCountry(
  persistedState: Partial<PersistedAppShellState> | undefined,
): CountryCode | null {
  if (isCountryCode(persistedState?.examCountry)) {
    return persistedState.examCountry;
  }

  if (persistedState?.onboardingCompleted) {
    return DEFAULT_COUNTRY_CODE;
  }

  return null;
}

function normalizePersistedShellState(
  persistedState: Partial<PersistedAppShellState> | undefined,
): PersistedAppShellState {
  const nextMockUser = getNextMockUser(persistedState?.mockUser ?? null);
  const authMode =
    persistedState?.authMode === "mock" && nextMockUser ? "mock" : "supabase";
  const hasChosenPreferredLocale =
    persistedState?.hasChosenPreferredLocale ??
    persistedState?.onboardingProgress?.languageDone ??
    false;
  const examCountry = normalizePersistedExamCountry(persistedState);
  const resolvedPreferredLocale = hasChosenPreferredLocale
    ? normalizePersistedLocale(examCountry, persistedState?.preferredLocale)
    : getDefaultPreferredLocale(examCountry);

  return {
    authMode,
    countrySessions: persistedState?.countrySessions ?? {},
    currentStudyPlan: persistedState?.currentStudyPlan ?? null,
    currentStudyPlanRemoteId: persistedState?.currentStudyPlanRemoteId ?? null,
    examCountry,
    mockUser: authMode === "mock" ? nextMockUser : null,
    onboardingCompleted: persistedState?.onboardingCompleted ?? false,
    onboardingProgress:
      persistedState?.onboardingProgress ?? defaultOnboardingProgress,
    preferredCategory: normalizePersistedCategory(
      examCountry,
      persistedState?.preferredCategory,
    ),
    preferredLocale: resolvedPreferredLocale,
    hasChosenPreferredLocale: false,
    homeStartSpotlightDismissed:
      persistedState?.homeStartSpotlightDismissed ?? false,
    enablePjmTracks: persistedState?.enablePjmTracks ?? false,
    isScheduleNotificationEnabled:
      persistedState?.isScheduleNotificationEnabled ?? false,
    notificationHours:
      persistedState?.notificationHours ?? DEFAULT_NOTIFICATION_HOURS,
    pushNotificationToken: persistedState?.pushNotificationToken ?? null,
    scheduledNotificationIds:
      persistedState?.scheduledNotificationIds ?? [],
    studyPlanSetup: persistedState?.studyPlanSetup ?? defaultStudyPlanSetup,
  };
}

export const useAppShellStore = create<AppShellState>()(
  persist(
    (set) => ({
      authMode: getSignedOutAuthMode(),
      countrySessions: {},
      currentStudyPlan: null,
      currentStudyPlanRemoteId: null,
      examCountry: null,
      hasHydrated: false,
      mockUser: null,
      onboardingCompleted: false,
      onboardingProgress: defaultOnboardingProgress,
      preferredCategory: DEFAULT_CATEGORY,
      preferredLocale: getDefaultPreferredLocale(null),
      hasChosenPreferredLocale: false,
      homeStartSpotlightDismissed: false,
      enablePjmTracks: false,
      isScheduleNotificationEnabled: false,
      notificationHours: DEFAULT_NOTIFICATION_HOURS,
      pushNotificationToken: null,
      scheduledNotificationIds: [],
      sessionResolved: false,
      studyPlanSetup: defaultStudyPlanSetup,
      supabaseUser: null,
      clearCurrentStudyPlan: () =>
        set({ currentStudyPlan: null, currentStudyPlanRemoteId: null }),
      dismissHomeStartSpotlight: () =>
        set({ homeStartSpotlightDismissed: true }),
      completeCategoryStep: () =>
        set((state) => ({
          onboardingProgress: {
            ...state.onboardingProgress,
            categoryDone: true,
          },
        })),
      completeLanguageStep: () =>
        set((state) => ({
          hasChosenPreferredLocale: true,
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
          preferredCategory: normalizePersistedCategory(
            state.examCountry,
            preferredCategory,
          ),
          preferredLocale: normalizePersistedLocale(
            state.examCountry,
            preferredLocale,
          ),
          hasChosenPreferredLocale: true,
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
      resetShell: () =>
        set({
          authMode: getSignedOutAuthMode(),
          countrySessions: {},
          currentStudyPlan: null,
          currentStudyPlanRemoteId: null,
          examCountry: null,
          hasHydrated: true,
          mockUser: null,
          onboardingCompleted: false,
          onboardingProgress: defaultOnboardingProgress,
          preferredCategory: DEFAULT_CATEGORY,
          preferredLocale: getDefaultPreferredLocale(null),
          hasChosenPreferredLocale: false,
          homeStartSpotlightDismissed: false,
          enablePjmTracks: false,
          isScheduleNotificationEnabled: false,
          notificationHours: DEFAULT_NOTIFICATION_HOURS,
          pushNotificationToken: null,
          scheduledNotificationIds: [],
          sessionResolved: true,
          studyPlanSetup: defaultStudyPlanSetup,
          supabaseUser: null,
        }),
      resolveExamCountry: (country) =>
        set((state) =>
          state.examCountry ? state : applyExamCountryChange(state, country),
        ),
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
      patchExamDate: ({ daysUntilExam, examDate }) =>
        set((state) => ({
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
      setPreferredCategory: (preferredCategory) =>
        set((state) => {
          const nextCategory = normalizePersistedCategory(
            state.examCountry,
            preferredCategory,
          );

          return {
            preferredCategory: nextCategory,
            currentStudyPlan: state.currentStudyPlan
              ? { ...state.currentStudyPlan, category: nextCategory }
              : null,
          };
        }),
      setPreferredLocale: (preferredLocale) =>
        set((state) => ({
          preferredLocale: normalizePersistedLocale(
            state.examCountry,
            preferredLocale,
          ),
          hasChosenPreferredLocale: true,
        })),
      setPushNotificationToken: (pushNotificationToken) =>
        set({ pushNotificationToken }),
      setScheduleNotificationEnabled: (isScheduleNotificationEnabled) =>
        set({ isScheduleNotificationEnabled }),
      setScheduledNotificationIds: (scheduledNotificationIds) =>
        set({ scheduledNotificationIds }),
      setEnablePjmTracks: (enablePjmTracks) => set({ enablePjmTracks }),
      setExamCountry: (country) =>
        set((state) => applyExamCountryChange(state, country)),
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
          preferredLocale: getDefaultPreferredLocale(null),
          hasChosenPreferredLocale: false,
          isScheduleNotificationEnabled: false,
          notificationHours: DEFAULT_NOTIFICATION_HOURS,
          pushNotificationToken: null,
          scheduledNotificationIds: [],
          supabaseUser: null,
        }),
    }),
    {
      name: "prawko-mobile-shell",
      storage: createJSONStorage(() => AsyncStorage),
      version: 5,
      migrate: (persistedState) =>
        normalizePersistedShellState(
          (persistedState as Partial<PersistedAppShellState> | undefined) ??
            undefined,
        ),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePersistedShellState(
          persistedState as Partial<PersistedAppShellState> | undefined,
        ),
      }),
      partialize: (state) => ({
        authMode: state.authMode,
        countrySessions: state.countrySessions,
        currentStudyPlan: state.currentStudyPlan,
        currentStudyPlanRemoteId: state.currentStudyPlanRemoteId,
        examCountry: state.examCountry,
        mockUser: state.mockUser,
        onboardingCompleted: state.onboardingCompleted,
        onboardingProgress: state.onboardingProgress,
        preferredCategory: state.preferredCategory,
        preferredLocale: state.preferredLocale,
        hasChosenPreferredLocale: state.hasChosenPreferredLocale,
        homeStartSpotlightDismissed: state.homeStartSpotlightDismissed,
        enablePjmTracks: state.enablePjmTracks,
        isScheduleNotificationEnabled: state.isScheduleNotificationEnabled,
        notificationHours: state.notificationHours,
        pushNotificationToken: state.pushNotificationToken,
        scheduledNotificationIds: state.scheduledNotificationIds,
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

export function getExamCountry(): CountryCode {
  return useAppShellStore.getState().examCountry ?? DEFAULT_COUNTRY_CODE;
}

export function getCurrentUserFromState(state: AppShellState) {
  return state.authMode === "supabase" ? state.supabaseUser : state.mockUser;
}

export function canFinalizeOnboarding(state: {
  onboardingProgress: Pick<OnboardingProgress, "categoryDone" | "scheduleDone">;
  studyPlanSetup: Pick<StudyPlanSetupDraft, "daysUntilExam">;
}) {
  return (
    state.onboardingProgress.categoryDone &&
    state.onboardingProgress.scheduleDone &&
    state.studyPlanSetup.daysUntilExam !== null
  );
}

export function getNextOnboardingRoute(state: {
  onboardingProgress: Pick<OnboardingProgress, "categoryDone">;
}): OnboardingRoute {
  if (!state.onboardingProgress.categoryDone) {
    return "/(onboarding)/category";
  }

  return "/(onboarding)/exam-schedule";
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

import { ANALYTICS_SCREENS, type AnalyticsScreenName } from "./catalog";

export type AnalyticsScreenRoute = {
  routePattern: string;
  screenName: AnalyticsScreenName;
};

const SCREEN_ROUTES: Array<
  AnalyticsScreenRoute & { matches: (pathname: string) => boolean }
> = [
  exact("/", ANALYTICS_SCREENS.appEntry),
  exact("/(onboarding)/language", ANALYTICS_SCREENS.onboardingLanguage),
  exact("/language", ANALYTICS_SCREENS.onboardingLanguage),
  exact("/(onboarding)/exam-country", ANALYTICS_SCREENS.examCountry),
  exact("/exam-country", ANALYTICS_SCREENS.examCountry),
  exact("/(onboarding)/category", ANALYTICS_SCREENS.onboardingCategory),
  exact("/category", ANALYTICS_SCREENS.onboardingCategory),
  exact("/(onboarding)/exam-schedule", ANALYTICS_SCREENS.onboardingExamSchedule),
  exact("/exam-schedule", ANALYTICS_SCREENS.onboardingExamSchedule),
  exact("/(onboarding)/notifications", ANALYTICS_SCREENS.onboardingNotifications),
  exact("/notifications", ANALYTICS_SCREENS.onboardingNotifications),
  exact("/(onboarding)/minutes", ANALYTICS_SCREENS.onboardingMinutes),
  exact("/minutes", ANALYTICS_SCREENS.onboardingMinutes),
  exact("/(onboarding)/level", ANALYTICS_SCREENS.onboardingLevel),
  exact("/level", ANALYTICS_SCREENS.onboardingLevel),
  exact("/(onboarding)/school-code", ANALYTICS_SCREENS.onboardingSchoolCode),
  exact("/school-code", ANALYTICS_SCREENS.onboardingSchoolCode),
  exact("/(onboarding)/access", ANALYTICS_SCREENS.onboardingAccess),
  exact("/access", ANALYTICS_SCREENS.onboardingAccess),
  exact("/(onboarding)/preview", ANALYTICS_SCREENS.onboardingPreview),
  exact("/preview", ANALYTICS_SCREENS.onboardingPreview),
  exact("/(tabs)", ANALYTICS_SCREENS.home),
  exact("/(tabs)/index", ANALYTICS_SCREENS.home),
  exact("/(tabs)/learn", ANALYTICS_SCREENS.learn),
  exact("/learn", ANALYTICS_SCREENS.learn),
  exact("/(tabs)/signs", ANALYTICS_SCREENS.signsHome),
  exact("/signs", ANALYTICS_SCREENS.signsHome),
  exact("/(tabs)/profile", ANALYTICS_SCREENS.profile),
  exact("/profile", ANALYTICS_SCREENS.profile),
  exact("/topics", ANALYTICS_SCREENS.topics),
  exact("/trainer-modes", ANALYTICS_SCREENS.trainerModes),
  exact("/question", ANALYTICS_SCREENS.questionTraining),
  exact("/practice", ANALYTICS_SCREENS.practice),
  exact("/mistakes", ANALYTICS_SCREENS.mistakes),
  exact("/exam", ANALYTICS_SCREENS.examLoading),
  exact("/exam/session", ANALYTICS_SCREENS.examSession),
  exact("/exam/result", ANALYTICS_SCREENS.examResult),
  exact("/exam/answers", ANALYTICS_SCREENS.examAnswers),
  exact("/signs/search", ANALYTICS_SCREENS.signSearch),
  exact("/signs/test", ANALYTICS_SCREENS.signTest),
  exact("/statistics", ANALYTICS_SCREENS.statistics),
  exact("/paywall", ANALYTICS_SCREENS.paywall),
  exact("/offline-mode", ANALYTICS_SCREENS.offlineMode),
  exact("/modals/ai-chat", ANALYTICS_SCREENS.aiChat),
  exact("/modals/access-center", ANALYTICS_SCREENS.accessCenter),
  exact("/modals/plan-adjust", ANALYTICS_SCREENS.planAdjust),
  exact("/+not-found", ANALYTICS_SCREENS.notFound),
  prefix("/topic/", "/topic/[topicId]", ANALYTICS_SCREENS.topicDetail),
  prefix(
    "/signs/category/",
    "/signs/category/[categoryId]/test",
    ANALYTICS_SCREENS.signTest,
    (pathname) => pathname.endsWith("/test")
  ),
  prefix(
    "/signs/category/",
    "/signs/category/[categoryId]",
    ANALYTICS_SCREENS.signCategory
  ),
  prefix(
    "/signs/",
    "/signs/[signId]/practice",
    ANALYTICS_SCREENS.signPractice,
    (pathname) => pathname.endsWith("/practice")
  ),
  prefix("/signs/", "/signs/[signId]", ANALYTICS_SCREENS.signDetail),
];

export function resolveScreenRoute(pathname: string): AnalyticsScreenRoute {
  return (
    SCREEN_ROUTES.find((route) => route.matches(pathname)) ?? {
      routePattern: "/unknown",
      screenName: ANALYTICS_SCREENS.notFound,
    }
  );
}

function exact(
  expectedPathname: string,
  screenName: AnalyticsScreenRoute["screenName"]
): AnalyticsScreenRoute & { matches: (pathname: string) => boolean } {
  return {
    routePattern: expectedPathname,
    screenName,
    matches: (pathname) => pathname === expectedPathname,
  };
}

function prefix(
  pathPrefix: string,
  routePattern: string,
  screenName: AnalyticsScreenRoute["screenName"],
  condition?: (pathname: string) => boolean
): AnalyticsScreenRoute & { matches: (pathname: string) => boolean } {
  return {
    routePattern,
    screenName,
    matches: (pathname) =>
      pathname.startsWith(pathPrefix) && (condition ? condition(pathname) : true),
  };
}

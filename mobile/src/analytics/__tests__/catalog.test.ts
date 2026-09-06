import {
  ANALYTICS_EVENTS,
  ANALYTICS_EXAM_COUNTRY_SOURCES,
  ANALYTICS_PROPERTIES,
  ANALYTICS_SCREENS,
  getAnalyticsErrorCode,
  sanitizeAnalyticsProperties,
} from "../catalog";
import { resolveScreenRoute } from "../screenRoutes";

describe("analytics catalog", () => {
  it("keeps production event keys unique", () => {
    const keys = Object.values(ANALYTICS_EVENTS).map((event) => event.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("documents every production event", () => {
    for (const event of Object.values(ANALYTICS_EVENTS)) {
      expect(event.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("contains stable names for the primary app surfaces", () => {
    expect(ANALYTICS_SCREENS.home).toBe("home");
    expect(ANALYTICS_SCREENS.questionTraining).toBe("question_training");
    expect(ANALYTICS_SCREENS.examSession).toBe("exam_session");
    expect(ANALYTICS_SCREENS.paywall).toBe("paywall");
    expect(ANALYTICS_SCREENS.examCountry).toBe("exam_country");
    expect(ANALYTICS_EVENTS.examCountryResolved.key).toBe(
      "exam_country_resolved"
    );
    expect(ANALYTICS_EVENTS.examCountryChanged.key).toBe(
      "exam_country_changed"
    );
    expect(ANALYTICS_EVENTS.firstStartShown.key).toBe("first_start_shown");
    expect(ANALYTICS_EVENTS.firstStartSkipped.key).toBe("first_start_skipped");
    expect(ANALYTICS_EVENTS.firstStartStarted.key).toBe("first_start_started");
    expect(ANALYTICS_PROPERTIES.appUserId).toBe("app_user_id");
    expect(ANALYTICS_PROPERTIES.supabaseUserId).toBe("supabase_user_id");
    expect(ANALYTICS_PROPERTIES.examCountry).toBe("exam_country");
    expect(ANALYTICS_PROPERTIES.previous).toBe("previous");
    expect(ANALYTICS_PROPERTIES.source).toBe("source");
    expect(ANALYTICS_EXAM_COUNTRY_SOURCES.storefront).toBe("storefront");
    expect(ANALYTICS_EXAM_COUNTRY_SOURCES.deviceRegion).toBe("device_region");
    expect(ANALYTICS_EXAM_COUNTRY_SOURCES.legacyOnboarded).toBe(
      "legacy_onboarded"
    );
  });

  it("normalizes unknown errors without sending their message", () => {
    expect(getAnalyticsErrorCode({ code: "network_failed" })).toBe(
      "network_failed"
    );
    expect(getAnalyticsErrorCode({ status: 503 })).toBe("503");
    expect(getAnalyticsErrorCode(new Error("sensitive details"))).toBe("Error");
    expect(getAnalyticsErrorCode("sensitive details")).toBe("unknown_error");
  });

  it("drops sensitive or free-form analytics properties", () => {
    expect(
      sanitizeAnalyticsProperties({
        email: "student@example.com",
        message: "sensitive details",
        question_id: "question-42",
        selected_answer: "A",
      })
    ).toEqual({
      question_id: "question-42",
    });
  });

  it("normalizes Expo Router paths to stable screen names", () => {
    expect(resolveScreenRoute("/learn")).toMatchObject({
      routePattern: "/learn",
      screenName: "learn",
    });
    expect(resolveScreenRoute("/topic/road_signs")).toMatchObject({
      routePattern: "/topic/[topicId]",
      screenName: "topic_detail",
    });
    expect(resolveScreenRoute("/signs/category/A/test")).toMatchObject({
      routePattern: "/signs/category/[categoryId]/test",
      screenName: "sign_test",
    });
    expect(resolveScreenRoute("/exam-country")).toMatchObject({
      routePattern: "/exam-country",
      screenName: "exam_country",
    });
    expect(resolveScreenRoute("/(onboarding)/exam-country")).toMatchObject({
      routePattern: "/(onboarding)/exam-country",
      screenName: "exam_country",
    });
    expect(resolveScreenRoute("/(tabs)/index")).toMatchObject({
      routePattern: "/(tabs)/index",
      screenName: "home",
    });
  });
});

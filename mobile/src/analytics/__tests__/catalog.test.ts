import {
  ANALYTICS_EVENTS,
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
  });
});

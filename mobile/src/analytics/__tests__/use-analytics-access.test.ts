import { useAnalytics } from "../../hooks/useAnalytics";
import type { RemoteExamSnapshot } from "../../features/exam/types";
import type { CountryExamConfig } from "@prawko/config";
import { createExamOriginRuleMetadata } from "../exam-rules-observation";
import { LEARNING_INTERACTION_FIXTURES as learning } from "../type-tests/learning-interaction-fixtures";

const mockCapture = jest.fn();
const mockLocalLog = jest.fn();
const mockFailure = jest.fn();
let mockLivePlus = true;
let mockStoreThrows = false;
let mockSequence = 0;
let mockCachedExam: RemoteExamSnapshot | null = null;
let mockCacheThrows = false;
const mockAccessState = {
  revenueCatFeatureEntitlements: { premium_access: true, ai_question_chat: false },
  featureEntitlements: { premium_access: false, ai_question_chat: false },
  schoolAccess: null, debugPlusOverride: null,
  revenueCatStatus: "ready", entitlementStatus: "ready", revenueCatCustomerInfoDate: null,
};
const mockShell = { preferredLocale: "pl" };

jest.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
}));
jest.mock("posthog-react-native", () => ({
  usePostHog: () => ({ capture: (...args: unknown[]) => mockCapture(...args) }),
}));
jest.mock("@prawko/config", () => ({
  ...jest.requireActual("@prawko/config"), FEATURE_FLAGS: { devPlusAccess: false },
}));
jest.mock("../../config/env", () => ({ mobileEnv: { enableE2ETestMode: false } }));
jest.mock("../../identity/AppIdentityProvider", () => ({ useAppUserId: () => "usr_i" }));
jest.mock("../../state/app-shell", () => ({
  useCurrentUser: () => null, getCurrentUserFromState: () => null,
  useAppShellStore: Object.assign(
    (selector: (state: typeof mockShell) => unknown) => selector(mockShell),
    { getState: () => mockShell },
  ),
}));
jest.mock("../../state/entitlements", () => ({
  useHasPlusAccess: () => false,
  readHasPlusAccess: () => mockLivePlus,
  useEntitlementStore: {
    getState: () => {
      if (mockStoreThrows) throw new Error("diagnostic store unavailable");
      return mockAccessState;
    },
  },
}));
jest.mock("../base-properties", () => ({
  getAnalyticsBaseProperties: () => ({
    app_user_id: "usr_i", is_plus: mockLivePlus, exam_rules_revision: "content-v1:ffffffffffffffff",
  }),
}));
jest.mock("../posthog-build-gate", () => ({ isPostHogCaptureEnabled: () => true }));
jest.mock("../local-analytics-log", () => ({
  recordLocalAnalytics: (...args: unknown[]) => mockLocalLog(...args),
}));
jest.mock("../runtime-context", () => ({
  nextAnalyticsEventContext: () => ({ event_id: `run:${++mockSequence}`, event_sequence: mockSequence }),
}));
jest.mock("../activity", () => ({
  analyticsActivity: { recordInteraction: () => undefined, getContext: () => ({ screen_name: "offline_mode" }) },
}));
jest.mock("../content-revisions", () => ({
  ...jest.requireActual("../content-revisions"), getQuestionContentProperties: () => ({}),
}));
jest.mock("../../features/exam/exam-snapshot-cache", () => ({
  getCachedExamSnapshot: (id: string) => {
    if (mockCacheThrows) throw new Error("optional cache observation");
    return mockCachedExam?.session.id === id ? mockCachedExam : null;
  },
}));
jest.mock("../../features/questions/question-bank", () => ({ getQuestionBankById: () => ({}) }));
jest.mock("../onboarding-observation", () => ({ onboardingObservation: { peek: () => null } }));
jest.mock("../capture-diagnostics", () => ({
  recordAnalyticsFailure: (...args: unknown[]) => mockFailure(...args),
  getAnalyticsDiagnosticsProperties: () => ({ analytics_delivery_status: "not_verified" }),
}));

describe("feature diagnostics capture wiring", () => {
  beforeEach(() => {
    mockLivePlus = true;
    mockStoreThrows = false;
    mockSequence = 0;
    mockCachedExam = null;
    mockCacheThrows = false;
    mockCapture.mockReset();
  });

  it("keeps the original canonical event and validates its fresh diagnostic snapshot", () => {
    useAnalytics().track("offline_access_blocked", { source: "offline_mode", is_plus: false });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("offline_access_blocked", expect.objectContaining({
      source: "offline_mode", event_id: "run:1",
      access_expected_is_plus: true, access_comparison: "blocked_despite_plus",
      analytics_payload_contract_status: "valid", analytics_payload_valid: true,
    }));
    expect(mockLocalLog).toHaveBeenCalledWith(expect.objectContaining({
      event: "offline_access_blocked", properties: expect.objectContaining({ access_observation_version: 1 }),
    }));
  });

  it("does not suppress the gate event when only the diagnostic store fails", () => {
    mockStoreThrows = true;
    expect(() => useAnalytics().track("offline_access_blocked", { source: "offline_mode" })).not.toThrow();
    const properties = mockCapture.mock.calls[0][1];
    expect(properties.source).toBe("offline_mode");
    expect(properties.access_observation_version).toBeUndefined();
  });

  it("preserves the caller's offline feature context and never labels the block an entitlement defect", () => {
    useAnalytics().track("learning_access_blocked", learning.learning_access_blocked);
    expect(mockCapture).toHaveBeenCalledWith("learning_access_blocked", expect.objectContaining({
      feature: "training", screen_name: "question_training", requested_category: "B", downloaded_category: "A1",
      access_expected_is_plus: true, access_observed: "non_entitlement_block", access_comparison: "not_comparable",
      analytics_payload_contract_status: "valid", analytics_payload_valid: true,
    }));
  });

  it("captures inconsistent interactions and null operational IDs without guarding product handlers", () => {
    const analytics = useAnalytics();
    expect(() => {
      analytics.track("learning_access_blocked", { ...learning.learning_access_blocked, is_online: true });
      analytics.track("exam_result_action", { exam_session_id: null, mode: null, action: "home" });
    }).not.toThrow();
    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(mockCapture.mock.calls[0][1]).toMatchObject({ is_online: true, analytics_payload_valid: false });
    expect(mockCapture.mock.calls[1][1]).toMatchObject({ exam_session_id: null, action: "home", analytics_payload_valid: false });
    expect(mockFailure).toHaveBeenCalledWith("payload");
  });

  it("does not synthesize a feature failure from a regular paywall view", () => {
    useAnalytics().track("paywall_viewed", { paywall_view_id: "v", is_plus: true });
    expect(mockCapture.mock.calls[0][1].access_comparison).toBeUndefined();
    expect(mockCapture.mock.calls[0][1].analytics_payload_valid).toBe(true);
  });

  it("captures readiness with nullable operation metadata without turning QA into a product guard", () => {
    expect(() => useAnalytics().track("learning_screen_ready", {
      feature: "training", training_session_id: null, question_id: null,
      ready_foreground_ms: 10, ready_wall_ms: 20, ready_reason: "focused_ready",
      ready_duration_scope: "current_focus_entry", media_readiness: "not_measured",
    })).not.toThrow();
    expect(mockCapture).toHaveBeenCalledWith("learning_screen_ready", expect.objectContaining({
      training_session_id: null, question_id: null, analytics_payload_valid: false,
      analytics_payload_contract_status: "invalid",
    }));
    expect(mockFailure).toHaveBeenCalledWith("payload");
  });

  it("does not throw into a product handler when SDK capture fails", () => {
    mockCapture.mockImplementation(() => { throw new Error("SDK unavailable"); });
    expect(() => useAnalytics().track("ai_chat_access_blocked", { source: "message_send" })).not.toThrow();
    expect(mockFailure).toHaveBeenCalledWith("capture");
  });

  it("captures the stored exam rule origin separately from current config, without changing canonical events", () => {
    mockCachedExam = {
      answers: [], questions: [], wrongQuestionSourceIds: [],
      session: {
        id: "lexam-1", metadata: { exam_country: "PL", navigation: "forward_only" },
        startedAt: "2026-10-07T10:00:00Z", expiresAt: "2026-10-07T10:25:00Z",
        currentCategory: "B", mode: "exam", totalQuestionsTarget: 32, totalPointsTarget: 74, passPoints: 68,
      },
    } as RemoteExamSnapshot;
    mockCachedExam.session.metadata.analytics_exam_origin_rules = createExamOriginRuleMetadata(
      { navigation: "forward_only" } as CountryExamConfig, mockCachedExam.session,
    );
    useAnalytics().track("exam_session_started", { exam_session_id: "lexam-1", mode: "exam", question_total: 32 });
    const properties = mockCapture.mock.calls[0][1];
    expect(properties.exam_rules_revision).toBe("content-v1:ffffffffffffffff");
    expect(properties.exam_origin_profile_revision).not.toBe(properties.exam_rules_revision);
    expect(properties.exam_origin_profile_basis).toBe("persisted_creation_profile");
    expect(properties.exam_origin_pass_points).toBe(68);
    expect(properties.analytics_payload_valid).toBe(true);
    expect(mockCapture.mock.calls[0][0]).toBe("exam_session_started");
  });

  it("keeps an exam event capturable when only optional snapshot enrichment fails", () => {
    mockCacheThrows = true;
    useAnalytics().track("exam_session_completed", {
      exam_session_id: "lexam-1", mode: "exam", learning_outcome_rule_version: "learning-v1",
      completion_status: "completed", answered_count: 32, correct_count: 30, wrong_count: 2,
      passed: true, question_total: 32, score_points: 70, total_points_target: 74,
    });
    expect(mockCapture).toHaveBeenCalledWith("exam_session_completed", expect.objectContaining({
      exam_session_id: "lexam-1", analytics_payload_valid: true,
    }));
  });

  it("still captures invalid diagnostics and reports payload failure without a product guard", () => {
    useAnalytics().track("purchase_started", {
      purchase_attempt_id: "attempt-one", checkout_view_id: "view-one", product_id: null, ui: "package",
    });
    expect(mockCapture).toHaveBeenCalledWith("purchase_started", expect.objectContaining({
      analytics_payload_contract_version: 2, analytics_payload_valid: false,
    }));
    expect(mockFailure).toHaveBeenCalledWith("payload");
  });
});

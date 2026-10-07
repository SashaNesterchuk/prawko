import { getCountryConfig } from "@prawko/config";

import type { RemoteExamSnapshot } from "../../features/exam/types";
import { createExamOriginRuleMetadata, getExamSessionRulesProperties, observeCachedExamRules } from "../exam-rules-observation";
import { contentFingerprint } from "../content-revisions";
import { validateAnalyticsPayload } from "../payload-contract";

const mockCachedSnapshot = jest.fn();
jest.mock("../../features/exam/exam-snapshot-cache", () => ({
  getCachedExamSnapshot: (...args: unknown[]) => mockCachedSnapshot(...args),
}));

function snapshot(): RemoteExamSnapshot {
  return {
    answers: [], questions: [], wrongQuestionSourceIds: [],
    session: {
      id: "lexam-test", currentCategory: "B", sessionLocale: "pl", mode: "exam", status: "active",
      startedAt: "2026-10-07T10:00:00Z", expiresAt: "2026-10-07T10:25:00Z", finishedAt: null,
      totalQuestionsTarget: 32, totalQuestionsAnswered: 0, totalPointsTarget: 74,
      passPoints: 68, passed: null, correctAnswersCount: 0, wrongAnswersCount: 0,
      scorePoints: 0, remainingSeconds: 1500, currentQuestionIndex: 1, studyPlanId: null,
      metadata: { exam_country: "PL", navigation: "forward_only" },
    },
  };
}

describe("origin exam rules observations", () => {
  it("binds the selected creation profile and persisted parameters, not today's config", () => {
    const value = snapshot();
    const profile = { ...getCountryConfig("PL").exam, baseAnswerSeconds: 999 };
    value.session.metadata.analytics_exam_origin_rules = createExamOriginRuleMetadata(profile, value.session);
    const properties = getExamSessionRulesProperties(value);
    expect(properties).toMatchObject({
      exam_origin_profile_revision: contentFingerprint(profile), exam_origin_profile_basis: "persisted_creation_profile",
      exam_origin_country: "PL", exam_origin_category: "B", exam_origin_question_total: 32, exam_origin_total_points: 74,
      exam_origin_pass_points: 68, exam_origin_duration_seconds: 1500, exam_origin_navigation: "forward_only",
    });
    expect(properties.exam_origin_profile_revision).not.toBe(contentFingerprint(getCountryConfig("PL").exam));
    expect(properties.exam_session_rules_revision_basis).toBe("persisted_session_parameters");
  });

  it("keeps rules stable through answers, result status, restart and JSON persistence", () => {
    const value = snapshot();
    value.session.metadata.analytics_exam_origin_rules = createExamOriginRuleMetadata(getCountryConfig("PL").exam, value.session);
    const before = getExamSessionRulesProperties(value);
    const restored = JSON.parse(JSON.stringify(value)) as RemoteExamSnapshot;
    Object.assign(restored.session, {
      scorePoints: 71, status: "completed", totalQuestionsAnswered: 32, remainingSeconds: 0, currentQuestionIndex: 32,
    });
    expect(getExamSessionRulesProperties(restored)).toEqual(before);
  });

  it("does not backfill a legacy session's origin profile from current country rules", () => {
    expect(getExamSessionRulesProperties(snapshot())).toMatchObject({
      exam_origin_profile_revision: null, exam_origin_profile_basis: "not_recorded", exam_session_rules_status: "observed",
    });
  });

  it("validates observed parameters and explicit cache misses without requiring guessed origin", () => {
    const properties = {
      exam_session_id: "lexam-test", mode: "exam", question_total: 32,
      ...getExamSessionRulesProperties(snapshot()),
    };
    expect(validateAnalyticsPayload("exam_session_started", properties).analytics_payload_valid).toBe(true);
    expect(validateAnalyticsPayload("exam_session_started", {
      ...properties, exam_origin_navigation: "linear",
    }).analytics_payload_valid).toBe(false);
    expect(validateAnalyticsPayload("exam_session_started", {
      ...properties, exam_origin_category: null,
    }).analytics_payload_valid).toBe(false);
    mockCachedSnapshot.mockReturnValue(null);
    const missed = {
      exam_session_id: "other", mode: "exam", question_total: 32,
      ...observeCachedExamRules({ exam_session_id: "other" }),
    };
    expect(validateAnalyticsPayload("exam_session_started", missed).analytics_payload_valid).toBe(true);
  });

  it("rejects mismatched parameters, unknown marker versions and invalid numeric values", () => {
    const value = snapshot();
    value.session.metadata.analytics_exam_origin_rules = createExamOriginRuleMetadata(getCountryConfig("PL").exam, value.session);
    value.session.passPoints = 70;
    expect(getExamSessionRulesProperties(value)).toMatchObject({
      exam_origin_profile_revision: null, exam_origin_profile_basis: "origin_parameters_unverified",
    });
    value.session.metadata.analytics_exam_origin_rules = { version: 2 };
    expect(getExamSessionRulesProperties(value).exam_origin_profile_revision).toBeNull();
    value.session.totalQuestionsTarget = NaN;
    expect(getExamSessionRulesProperties(value).exam_session_rules_status).toBe("invalid_parameters");
  });

  it("contains optional hashing and cache failures without changing an exam", () => {
    const value = snapshot();
    const profile = { ...getCountryConfig("PL").exam };
    Object.defineProperty(profile, "unreadable_metadata", { enumerable: true, get: () => { throw new Error("observation"); } });
    expect(createExamOriginRuleMetadata(profile, value.session)).toBeNull();
    expect(value.session.status).toBe("active");
    mockCachedSnapshot.mockImplementation(() => { throw new Error("cache observation"); });
    expect(observeCachedExamRules({ exam_session_id: "lexam-test" })).toEqual({});
    expect(observeCachedExamRules({})).toEqual({});
  });

  it("reads only the matching existing memory snapshot and leaves misses unknown", () => {
    const value = snapshot();
    mockCachedSnapshot.mockReturnValue(value);
    expect(observeCachedExamRules({ exam_session_id: value.session.id }).exam_origin_pass_points).toBe(68);
    expect(mockCachedSnapshot).toHaveBeenCalledWith(value.session.id);
    mockCachedSnapshot.mockReturnValue(null);
    expect(observeCachedExamRules({ exam_session_id: "other" })).toMatchObject({
      exam_session_rules_status: "snapshot_not_cached", exam_origin_profile_revision: null,
    });
  });
});

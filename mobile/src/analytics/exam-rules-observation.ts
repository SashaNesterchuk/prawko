import type { CountryExamConfig } from "@prawko/config";

import { getCachedExamSnapshot } from "../features/exam/exam-snapshot-cache";
import type { RemoteExamSession, RemoteExamSnapshot } from "../features/exam/types";
import type { AnalyticsProperties } from "./catalog";
import { contentFingerprint } from "./content-revisions";

type OriginRules = {
  version: 1;
  basis: "selected_profile_at_creation";
  profileRevision: string;
  parametersRevision: string;
};

function ruleParameters(session: RemoteExamSession) {
  const started = Date.parse(session.startedAt);
  const expires = session.expiresAt ? Date.parse(session.expiresAt) : NaN;
  const duration = Number.isFinite(started) && Number.isFinite(expires) && expires >= started
    ? (expires - started) / 1000 : null;
  const country = session.metadata.exam_country;
  const navigation = session.metadata.navigation;
  return {
    country: country === "PL" || country === "CZ" || country === "SK" ? country : null,
    category: session.currentCategory,
    mode: session.mode,
    totalQuestions: session.totalQuestionsTarget,
    totalPoints: session.totalPointsTarget,
    passPoints: session.passPoints,
    durationSeconds: duration,
    navigation: navigation === "forward_only" || navigation === "free" ? navigation : null,
  };
}

function parametersValid(parameters: ReturnType<typeof ruleParameters>) {
  return [parameters.totalQuestions, parameters.totalPoints, parameters.passPoints].every(
    (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
  ) && parameters.totalQuestions > 0 && parameters.totalPoints > 0
    && parameters.passPoints <= parameters.totalPoints;
}

export function createExamOriginRuleMetadata(profile: CountryExamConfig, session: RemoteExamSession): OriginRules | null {
  try {
    const parameters = ruleParameters(session);
    if (!parametersValid(parameters)) return null;
    return {
      version: 1, basis: "selected_profile_at_creation",
      profileRevision: contentFingerprint(profile), parametersRevision: contentFingerprint(parameters),
    };
  } catch {
    return null;
  }
}

/** Reads persisted parameters, never substitutes today's country profile for origin. */
export function getExamSessionRulesProperties(snapshot: RemoteExamSnapshot): AnalyticsProperties {
  try {
    const parameters = ruleParameters(snapshot.session);
    const validParameters = parametersValid(parameters);
    const parametersRevision = validParameters ? contentFingerprint(parameters) : null;
    const value = snapshot.session.metadata.analytics_exam_origin_rules;
    const origin = value && typeof value === "object" ? value as Partial<OriginRules> : null;
    const knownOrigin = validParameters && origin?.version === 1 && origin.basis === "selected_profile_at_creation"
      && typeof origin.profileRevision === "string" && /^content-v1:[a-f0-9]{16}$/.test(origin.profileRevision)
      && origin.parametersRevision === parametersRevision;
    return {
      exam_rules_observation_version: 1,
      exam_session_rules_revision: parametersRevision,
      exam_session_rules_revision_basis: "persisted_session_parameters",
      exam_session_rules_status: validParameters ? "observed" : "invalid_parameters",
      exam_origin_profile_revision: knownOrigin ? origin.profileRevision ?? null : null,
      exam_origin_profile_basis: knownOrigin ? "persisted_creation_profile"
        : value === undefined || value === null ? "not_recorded" : "origin_parameters_unverified",
      exam_origin_country: parameters.country,
      exam_origin_category: parameters.category,
      exam_origin_mode: parameters.mode,
      exam_origin_question_total: validParameters ? parameters.totalQuestions : null,
      exam_origin_total_points: validParameters ? parameters.totalPoints : null,
      exam_origin_pass_points: validParameters ? parameters.passPoints : null,
      exam_origin_duration_seconds: parameters.durationSeconds,
      exam_origin_navigation: parameters.navigation,
    };
  } catch {
    return {
      exam_rules_observation_version: 1,
      exam_session_rules_revision: null,
      exam_session_rules_revision_basis: "unavailable",
      exam_session_rules_status: "observation_failed",
      exam_origin_profile_revision: null,
      exam_origin_profile_basis: "not_recorded",
    };
  }
}

export function observeCachedExamRules(properties: AnalyticsProperties): AnalyticsProperties {
  if (typeof properties.exam_session_id !== "string") return {};
  try {
    const snapshot = getCachedExamSnapshot(properties.exam_session_id);
    return snapshot ? getExamSessionRulesProperties(snapshot) : {
      exam_rules_observation_version: 1, exam_session_rules_status: "snapshot_not_cached",
      exam_session_rules_revision: null, exam_session_rules_revision_basis: "unavailable",
      exam_origin_profile_revision: null, exam_origin_profile_basis: "not_recorded",
    };
  } catch {
    return {};
  }
}

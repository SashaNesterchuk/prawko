import { FEATURE_FLAGS } from "@prawko/config";

import { mobileEnv } from "../config/env";
import { getCurrentUserFromState, useAppShellStore } from "../state/app-shell";
import { readHasPlusAccess, useEntitlementStore } from "../state/entitlements";
import type { AnalyticsEventName, AnalyticsProperties } from "./catalog";

export type AccessObservationSnapshot = {
  plus: boolean;
  purchaseGranted: boolean;
  remoteGranted: boolean;
  schoolPresent: boolean;
  override: boolean;
  revenueCatStatus: string;
  remoteStatus: string;
  customerInfoDate: number | null;
};

type AccessSurface = {
  feature: string;
  observed: "blocked" | "available" | "premium_mark" | "upsell" | "non_entitlement_block" | "ambiguous_gate";
  premiumOnly: boolean;
};

const PREMIUM_GATE_FEATURES: Record<string, string> = {
  training_limit: "training",
  wrong_answers: "wrong_answers",
  smart_reviews: "smart_reviews",
  trap_questions: "trap_questions",
  weak_spots: "weak_spots",
  statistics: "statistics",
  exam_limit: "exam",
  ai_chat: "ai_chat",
  offline_mode: "offline_mode",
};

function accessSurface(event: AnalyticsEventName, properties: AnalyticsProperties): AccessSurface | null {
  if (event === "ai_chat_access_blocked") return { feature: "ai_chat", observed: "blocked", premiumOnly: true };
  if (event === "offline_access_blocked") return { feature: "offline_mode", observed: "blocked", premiumOnly: true };
  if (event === "learning_access_blocked") {
    return {
      feature: properties.feature === "exam" ? "exam" : properties.feature === "training" ? "training" : "learning",
      observed: "non_entitlement_block", premiumOnly: false,
    };
  }
  if (event === "answer_explanation_viewed") {
    if (properties.access_method !== "premium" && properties.access_method !== "free_topic") return null;
    return { feature: "explanation", observed: "available", premiumOnly: properties.access_method === "premium" };
  }
  if (event !== "premium_gate_viewed") return null;
  if (properties.source === "explanation") {
    return {
      feature: "explanation",
      observed: properties.presentation === "inline_mark" ? "premium_mark"
        : properties.presentation === "inline_lock" ? "blocked" : "ambiguous_gate",
      premiumOnly: false,
    };
  }
  if (properties.source === "profile" || properties.surface === "home_unlock") {
    return { feature: "premium_offer", observed: "upsell", premiumOnly: false };
  }
  if (properties.source === "roadmap") {
    // Home steps can be locked by prerequisites independently of Premium.
    const entitledSurface = ["learn_topic", "topics", "statistics_topic", "trainer_modes", "question_start"]
      .includes(String(properties.surface));
    return { feature: "roadmap", observed: entitledSurface ? "blocked" : "ambiguous_gate", premiumOnly: false };
  }
  const feature = PREMIUM_GATE_FEATURES[String(properties.source)];
  return feature ? { feature, observed: "blocked", premiumOnly: false } : null;
}

/** Compares observed UI with local access; neither side is verified paid status. */
export function featureAccessProperties(
  event: AnalyticsEventName,
  properties: AnalyticsProperties,
  snapshot: AccessObservationSnapshot,
  now: number,
): AnalyticsProperties {
  const surface = accessSurface(event, properties);
  if (!surface) return {};
  const comparable = surface.observed === "blocked" || (surface.observed === "available" && surface.premiumOnly);
  const hydrated = snapshot.revenueCatStatus === "ready" && snapshot.remoteStatus === "ready";
  const expected = !comparable ? "not_evaluated" : snapshot.plus ? "allowed"
    : surface.premiumOnly && (hydrated || snapshot.override) ? "blocked" : "not_evaluated";
  const comparison = expected === "allowed" && surface.observed === "blocked" ? "blocked_despite_plus"
    : expected === "blocked" && surface.observed === "available" ? "premium_content_without_plus"
      : expected === "not_evaluated" ? "not_comparable" : "consistent";
  const date = snapshot.customerInfoDate;
  const hasDate = date !== null && Number.isFinite(date);
  const source = snapshot.override ? "runtime_override" : !snapshot.plus ? "none"
    : snapshot.purchaseGranted ? "purchase" : snapshot.schoolPresent && snapshot.remoteGranted ? "school" : "other";
  return {
    access_observation_version: 1,
    access_rule_version: "plus-feature-observation-v1",
    access_observed_feature: surface.feature,
    access_expected: expected,
    access_observed: surface.observed,
    access_comparison: comparison,
    access_expected_is_plus: snapshot.plus,
    access_expected_source: source,
    access_snapshot_basis: "current_local_entitlement_store",
    access_customer_info_at: hasDate ? new Date(date).toISOString() : null,
    access_customer_info_age_ms: hasDate && date <= now ? Math.round(now - date) : null,
    access_customer_info_clock_order: !hasDate ? "not_recorded" : date > now ? "future" : "ordered",
    access_customer_info_time_basis: "revenuecat_request_date",
    access_remote_verification_age_ms: null,
    access_remote_verification_basis: "not_recorded",
    access_revenuecat_status: snapshot.revenueCatStatus,
    access_remote_status: snapshot.remoteStatus,
    access_observation_basis: "existing_event_observation",
  };
}

export function observeFeatureAccess(event: AnalyticsEventName, properties: AnalyticsProperties): AnalyticsProperties {
  if (!accessSurface(event, properties)) return {};
  try {
    const state = useEntitlementStore.getState();
    const user = getCurrentUserFromState(useAppShellStore.getState());
    return featureAccessProperties(event, properties, {
      plus: readHasPlusAccess(),
      purchaseGranted: state.revenueCatFeatureEntitlements.premium_access || state.revenueCatFeatureEntitlements.ai_question_chat,
      remoteGranted: state.featureEntitlements.premium_access || state.featureEntitlements.ai_question_chat,
      schoolPresent: Boolean(state.schoolAccess),
      override: ((__DEV__ || mobileEnv.enableE2ETestMode) && state.debugPlusOverride !== null)
        || FEATURE_FLAGS.devPlusAccess || user?.provider === "mock",
      revenueCatStatus: state.revenueCatStatus,
      remoteStatus: state.entitlementStatus,
      customerInfoDate: state.revenueCatCustomerInfoDate,
    }, Date.now());
  } catch {
    // Optional diagnostics cannot suppress the original gate/content event.
    return {};
  }
}

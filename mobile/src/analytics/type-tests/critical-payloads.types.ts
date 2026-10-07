import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import type { AnalyticsEventName, AnalyticsProperties, TypedAnalyticsEventName } from "../catalog";
import {
  CHECKOUT_ERROR_CATEGORIES, CHECKOUT_STATUSES, CHECKOUT_STEPS, type CriticalAnalyticsPayloads,
} from "../critical-payloads";
import type { PaywallEligibilityPayloads } from "../paywall-payloads";
import { ANALYTICS_PAYLOAD_CONTRACTS } from "../payload-contract";
import type { CheckoutStage, CheckoutStatus } from "../../features/entitlements/checkout";
import type { RevenueCatCheckoutErrorKind } from "../../features/entitlements/revenuecat-errors";

type AssertNever<T extends never> = T;
type KnownNames = AssertNever<Exclude<TypedAnalyticsEventName, AnalyticsEventName>>;
type CoveredContracts = AssertNever<Exclude<TypedAnalyticsEventName, keyof typeof ANALYTICS_PAYLOAD_CONTRACTS>>;
type TypedPayloads = CriticalAnalyticsPayloads & PaywallEligibilityPayloads;
type RequiredKeys<T> = { [Key in keyof T]-?: {} extends Pick<T, Key> ? never : Key }[keyof T];
type MissingKeys<Event extends keyof TypedPayloads> =
  Exclude<RequiredKeys<TypedPayloads[Event]>, keyof (typeof ANALYTICS_PAYLOAD_CONTRACTS)[Event]>;
type CoveredKeys = AssertNever<{
  [Event in keyof TypedPayloads]: MissingKeys<Event>;
}[keyof TypedPayloads]>;
type CoveredErrorCategories = AssertNever<Exclude<RevenueCatCheckoutErrorKind, typeof CHECKOUT_ERROR_CATEGORIES[number]>>;
type CoveredCheckoutStages = AssertNever<Exclude<CheckoutStage, typeof CHECKOUT_STEPS[number]>>;
type CoveredCheckoutStatuses = AssertNever<Exclude<CheckoutStatus, typeof CHECKOUT_STATUSES[number]>>;
export type CriticalContractCoverage = [
  KnownNames, CoveredContracts, CoveredKeys, CoveredErrorCategories, CoveredCheckoutStages, CoveredCheckoutStatuses,
];

void function criticalCaptureSignatures(track: AnalyticsTrack) {
  track("profile_action_selected", {});
  track("paywall_viewed", { paywall_view_id: "view-one" });
  track("purchase_started", {
    purchase_attempt_id: "attempt-one", checkout_view_id: "view-one", product_id: "sku", ui: "package",
  });
  // Incomplete operational metadata is allowed as a diagnostic input, not a clean native event.
  track("purchase_started", {
    purchase_attempt_id: "attempt-one", checkout_view_id: "view-one", product_id: null, ui: "package",
  });
  track("purchase_restore_empty", { restore_attempt_id: "restore-one", checkout_view_id: "view-one",
    entitlement_active: false, restore_outcome: "empty" });
  track("question_media_buffering", { media_load_id: "media-one", buffering_completed: false, buffering_duration_ms: 1 });
  track("exam_question_answered", { exam_session_id: "exam-one", question_id: "question-one", answer_id: "slot-one",
    answer_revision_id: "revision-one", answer_action: "update", is_correct: false });

  // @ts-expect-error A typed event cannot be called without payload.
  track("purchase_started");
  // @ts-expect-error Undefined does not satisfy a typed payload.
  track("purchase_started", undefined);
  // @ts-expect-error Missing attempt/view is not a checkout scope.
  track("purchase_started", { product_id: "sku", ui: "package" });
  // @ts-expect-error Scalar product metadata cannot be a boolean.
  track("purchase_started", { purchase_attempt_id: "a", checkout_view_id: "v", product_id: true, ui: "package" });
  // @ts-expect-error NoInference prevents a wrong payload from widening the event to another key.
  track("paywall_viewed", { media_load_id: "m" });
  // @ts-expect-error A generic scalar record does not prove any required IDs.
  track("paywall_viewed", {} as AnalyticsProperties);
  // @ts-expect-error Selection is an explicit supported plan.
  track("paywall_plan_selected", { paywall_view_id: "v", plan: "lifetime" });
  // @ts-expect-error CTA action is not arbitrary text.
  track("paywall_cta_selected", { paywall_view_id: "v", action: "raw-intent" });
  // @ts-expect-error Restore success cannot declare empty/no entitlement.
  track("purchase_restore_succeeded", { restore_attempt_id: "r", checkout_view_id: "v", entitlement_active: false, restore_outcome: "empty" });
  // @ts-expect-error A failed restore still has an explicit normalized outcome and error category.
  track("purchase_restore_failed", { restore_attempt_id: "r", checkout_view_id: "v", entitlement_active: false, restore_outcome: "restored" });
  // @ts-expect-error Missing revision/action cannot manufacture an exam submission.
  track("exam_question_answered", { exam_session_id: "e", question_id: "q", is_correct: true });
  track("exam_question_answered", { exam_session_id: "e", question_id: "q", answer_id: "a",
    // @ts-expect-error Unsupported action cannot be a logical answer create/update.
    answer_revision_id: "r", answer_action: "replay", is_correct: true });
  // @ts-expect-error Missing learning outcome/counts cannot be a typed completion.
  track("training_session_completed", { training_session_id: "s" });
  // @ts-expect-error Mode enum is independent of billing plans.
  track("training_session_started", { training_session_id: "s", mode: "quarter", question_total: 5 });
  // @ts-expect-error Playback failure has a bounded stage.
  track("question_media_failed", { media_load_id: "m", error_code: "load_error", media_failure_stage: "private-message" });
  // @ts-expect-error Buffering needs an explicit completed/censored boolean.
  track("question_media_buffering", { media_load_id: "m", buffering_duration_ms: 1 });
  // @ts-expect-error Whole-flow completion is local acceptance, not Home.
  track("onboarding_flow_completed", { onboarding_attempt_id: "o", flow_context: "onboarding" });
  track("analytics_identity_observed", { app_user_id: "i", supabase_user_id: null, previous_supabase_user_id: null,
    // @ts-expect-error Identity observations cannot masquerade as an account/person merge.
    identity_scope: "account", identity_link_version: 1, identity_observation_reason: "initial" });
};

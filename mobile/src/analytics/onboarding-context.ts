import { markOnboardingObservationReset } from "./onboarding-observation";

let pendingResetId: string | null = null;

export function markAnalyticsProgressReset(resetId: string) {
  pendingResetId = resetId;
  markOnboardingObservationReset(resetId);
}

export function consumeOnboardingEntryContext() {
  const resetId = pendingResetId;
  pendingResetId = null;
  return {
    start_reason: resetId ? "progress_reset" : "incomplete_onboarding_observed",
    reset_operation_id: resetId,
  };
}

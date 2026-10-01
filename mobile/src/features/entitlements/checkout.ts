import { AppState, type AppStateStatus } from "react-native";
import { create } from "zustand";

import { ANALYTICS_EVENTS, type AnalyticsProperties } from "../../analytics/catalog";
import type { AnalyticsTrack } from "../../hooks/useAnalytics";
import { createAppUserId } from "../../identity/app-user-id";
import { getExamCountry, useAppShellStore } from "../../state/app-shell";
import { useEntitlementStore, type RevenueCatPackageSummary } from "../../state/entitlements";
import type { CaptureErrorInput } from "../errors/error-logging";
import {
  fetchRevenueCatAccessSnapshot,
  fetchRevenueCatSnapshot,
  getRevenueCatDiagnostic,
  getRevenueCatErrorCode,
  getRevenueCatErrorMessage,
  getRevenueCatWhy,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  type RevenueCatSnapshot,
} from "./revenuecat";
import {
  getRevenueCatCheckoutErrorKind,
  getRevenueCatStructuredErrorProperties,
  type RevenueCatCheckoutErrorKind,
} from "./revenuecat-errors";
import {
  checkoutStorageError,
  journalContext,
  readCheckoutJournal,
  writeCheckoutJournal,
  type CheckoutJournalRecord,
} from "./checkout-journal";

export type CheckoutStatus =
  | "purchasing" | "restoring" | "awaiting_confirmation" | "outcome_unknown"
  | "succeeded" | "cancelled" | "failed" | "empty";
export type CheckoutStage =
  | "get_customer_info" | "get_offerings" | "persist_checkout"
  | "purchase_package" | "restore_purchases";
export type CheckoutAttempt = {
  id: string;
  appUserId: string;
  kind: "purchase" | "restore";
  originViewId: string;
  status: CheckoutStatus;
  stage: CheckoutStage;
  package: RevenueCatPackageSummary | null;
  errorKind: RevenueCatCheckoutErrorKind | null;
  errorCode: string | null;
  errorMessage: string | null;
  transactionId: string | null;
  retryOfAttemptId: string | null;
};
type CheckoutInput = {
  appUserId: string;
  originViewId: string;
  properties: AnalyticsProperties;
  track: AnalyticsTrack;
  captureError: (input: CaptureErrorInput) => void;
};
type CheckoutRuntime = {
  attempt: CheckoutAttempt;
  input: CheckoutInput;
  nativePurchaseCompleted: boolean;
  nativePurchaseStarted: boolean;
  nativePurchaseSettled: boolean;
  journaled: boolean;
  resumedAfterRestart: boolean;
  unobservedMs: number;
  startedAt: number;
  appState: AppStateStatus;
  appStateChangedAt: number;
  activeMs: number;
  backgroundMs: number;
  inactiveMs: number;
};
type RecoveryStatus = "idle" | "checking" | "restoring" | "active" | "not_found" | "failed";
type PurchaseConfirmationSource = "purchase_result" | "customer_info";
export const useCheckoutStore = create<{
  attempt: CheckoutAttempt | null;
  nativeRequestInFlight: boolean;
  recoveryInFlight: boolean;
  recoveryStatus: RecoveryStatus;
  recoveryAttemptId: string | null;
  recoveryErrorKind: RevenueCatCheckoutErrorKind | null;
  journalAppUserId: string | null;
  journalStatus: "idle" | "loading" | "ready" | "failed";
}>(() => ({
  attempt: null, nativeRequestInFlight: false, recoveryInFlight: false,
  recoveryStatus: "idle", recoveryAttemptId: null, recoveryErrorKind: null,
  journalAppUserId: null, journalStatus: "idle",
}));

// UI lifetime does not own requests or telemetry. This is not a Premium flag.
// The journal restores uncertainty, never entitlement or old UI/navigation.
let runtime: CheckoutRuntime | null = null;
const unresolvedPurchases = new Map<string, CheckoutRuntime>();
let lastObservedSnapshot: { appUserId: string; snapshot: RevenueCatSnapshot } | null = null;
let journalHydration: { appUserId: string; promise: Promise<void> } | null = null;

export function createCheckoutId() {
  return createAppUserId().replace(/^usr_/, "");
}
export function needsCheckoutRecovery(attempt: CheckoutAttempt | null) {
  return attempt?.status === "awaiting_confirmation" || attempt?.status === "outcome_unknown";
}
export function isCheckoutPending(attempt: CheckoutAttempt | null) {
  return Boolean(attempt && (
    attempt.status === "purchasing" || attempt.status === "restoring" || needsCheckoutRecovery(attempt)
  ));
}
export function canRetryUnknownCheckout(attempt: CheckoutAttempt | null) {
  const state = useCheckoutStore.getState();
  return Boolean(attempt?.status === "outcome_unknown" && state.attempt?.id === attempt.id &&
    state.journalStatus === "ready" && state.journalAppUserId === attempt.appUserId &&
    state.recoveryAttemptId === attempt.id && state.recoveryStatus === "not_found" &&
    !state.nativeRequestInFlight && !state.recoveryInFlight);
}

/** Load before any new purchase can acquire the coordinator. No store call. */
export async function hydrateCheckoutJournal(
  input: Pick<CheckoutInput, "appUserId" | "track" | "captureError">
) {
  const state = useCheckoutStore.getState();
  if (state.journalAppUserId === input.appUserId && state.journalStatus === "ready") return;
  if (journalHydration?.appUserId === input.appUserId) return journalHydration.promise;
  if (state.nativeRequestInFlight || state.recoveryInFlight || journalHydration) {
    throw checkoutStorageError(new Error("Checkout identity is busy."));
  }
  useCheckoutStore.setState({ journalAppUserId: input.appUserId, journalStatus: "loading" });
  const promise = (async () => {
    try {
      const records = await readCheckoutJournal(input.appUserId);
      const now = Date.now();
      const recovered: CheckoutRuntime[] = [];
      for (const saved of records.sort((left, right) => left.startedAt - right.startedAt)) {
        if (unresolvedPurchases.has(saved.attempt.id)) continue;
        const interrupted = saved.attempt.status === "purchasing";
        const current: CheckoutRuntime = {
          attempt: {
            ...saved.attempt,
            status: interrupted ? "outcome_unknown" : saved.attempt.status,
            errorKind: interrupted ? "unknown" : saved.attempt.errorKind,
            errorCode: interrupted ? "checkout_interrupted" : saved.attempt.errorCode,
          },
          input: safeTelemetry({
            ...input, originViewId: saved.attempt.originViewId, properties: saved.properties,
          }),
          nativePurchaseCompleted: saved.nativePurchaseCompleted,
          nativePurchaseStarted: true, nativePurchaseSettled: true,
          journaled: true, resumedAfterRestart: true,
          startedAt: saved.startedAt, appState: AppState.currentState, appStateChangedAt: now,
          activeMs: saved.activeMs, backgroundMs: saved.backgroundMs, inactiveMs: saved.inactiveMs,
          unobservedMs: saved.unobservedMs + Math.max(0, now - saved.savedAt),
        };
        unresolvedPurchases.set(current.attempt.id, current);
        recovered.push(current);
      }
      const latest = [...unresolvedPurchases.values()]
        .filter((current) => current.attempt.appUserId === input.appUserId)
        .sort((left, right) => right.startedAt - left.startedAt)[0];
      if (latest && !isCheckoutPending(runtime?.attempt ?? null)) runtime = latest;
      useCheckoutStore.setState({
        journalStatus: "ready",
        ...(runtime?.attempt.appUserId === input.appUserId ? { attempt: runtime.attempt } : {}),
      });
      for (const current of recovered) {
        current.input.track(ANALYTICS_EVENTS.purchaseAttemptRecovered.key, {
          ...properties(current), previous_status: records.find(
            (saved) => saved.attempt.id === current.attempt.id
          )?.attempt.status ?? null,
        });
      }
      if (lastObservedSnapshot?.appUserId === input.appUserId) {
        reconcileCheckoutAccess(input.appUserId, lastObservedSnapshot.snapshot);
      }
    } catch (cause) {
      useCheckoutStore.setState({ journalStatus: "failed" });
      throw checkoutStorageError(cause);
    }
  })();
  journalHydration = { appUserId: input.appUserId, promise };
  try {
    await promise;
  } finally {
    if (journalHydration?.promise === promise) journalHydration = null;
  }
}

function persistUnresolvedPurchases(appUserId: string) {
  const entries = new Map(unresolvedPurchases);
  if (runtime?.journaled) entries.set(runtime.attempt.id, runtime);
  const now = Date.now();
  const records: CheckoutJournalRecord[] = [];
  for (const current of entries.values()) {
    const attempt = current.attempt;
    if (
      attempt.appUserId !== appUserId || !current.journaled || !attempt.package ||
      !(attempt.status === "purchasing" || needsCheckoutRecovery(attempt))
    ) continue;
    accumulateAppState(current, now);
    records.push({
      attempt: {
        ...attempt, kind: "purchase", stage: "purchase_package",
        package: attempt.package, errorMessage: null,
      },
      properties: journalContext(current.input.properties),
      startedAt: current.startedAt, savedAt: now,
      nativePurchaseCompleted: current.nativePurchaseCompleted,
      activeMs: current.activeMs, backgroundMs: current.backgroundMs, inactiveMs: current.inactiveMs,
      unobservedMs: current.unobservedMs,
    });
  }
  return writeCheckoutJournal(appUserId, records);
}

function persistInBackground(current: CheckoutRuntime) {
  const reportFailure = (error: unknown) => {
    current.input.captureError({
      area: "monetization", error, eventName: "checkout_journal_write_failed",
      severity: "warning", metadata: { purchase_attempt_id: current.attempt.id },
    });
  };
  try {
    // Snapshot synchronously so queued removals cannot be overwritten by an
    // older state. Both snapshot errors and asynchronous writes are best effort.
    void persistUnresolvedPurchases(current.attempt.appUserId).catch(reportFailure);
  } catch (error) {
    reportFailure(error);
  }
}

function forgetJournaledAttempt(current: CheckoutRuntime) {
  if (!current.journaled) return;
  current.journaled = false;
  unresolvedPurchases.delete(current.attempt.id);
  // Failure to remove a marker cannot turn a confirmed purchase into failure.
  persistInBackground(current);
}

function safeTelemetry(input: CheckoutInput): CheckoutInput {
  return {
    ...input, properties: { ...input.properties },
    track: (event, payload) => {
      try { input.track(event, payload); }
      catch (error) { console.warn("Failed to track checkout event.", error); }
    },
    captureError: (error) => {
      try { input.captureError(error); }
      catch (loggingError) { console.warn("Failed to log checkout error.", loggingError); }
    },
  };
}
function acquire(input: CheckoutInput, kind: CheckoutAttempt["kind"], retryOf?: CheckoutRuntime) {
  const state = useCheckoutStore.getState();
  if ((kind === "purchase" &&
      (state.journalStatus !== "ready" || state.journalAppUserId !== input.appUserId)) ||
    state.nativeRequestInFlight || state.recoveryInFlight ||
    (isCheckoutPending(state.attempt) && !(retryOf === runtime && canRetryUnknownCheckout(state.attempt)))) {
    return null;
  }
  const now = Date.now();
  const next: CheckoutRuntime = {
    attempt: {
      id: createCheckoutId(), appUserId: input.appUserId, kind, originViewId: input.originViewId,
      status: kind === "purchase" ? "purchasing" : "restoring",
      stage: kind === "purchase" ? "get_customer_info" : "restore_purchases",
      package: null, errorKind: null, errorCode: null, errorMessage: null, transactionId: null,
      retryOfAttemptId: retryOf?.attempt.id ?? null,
    },
    input: safeTelemetry({
      ...input,
      properties: {
        category: useAppShellStore.getState().preferredCategory,
        locale: useAppShellStore.getState().preferredLocale,
        ...input.properties, exam_country: getExamCountry(),
      },
    }),
    nativePurchaseCompleted: false, nativePurchaseStarted: false, journaled: false,
    nativePurchaseSettled: false, resumedAfterRestart: false, unobservedMs: 0, startedAt: now,
    appState: AppState.currentState, appStateChangedAt: now, activeMs: 0, backgroundMs: 0, inactiveMs: 0,
  };
  runtime = next;
  useCheckoutStore.setState({
    attempt: next.attempt, nativeRequestInFlight: true,
    recoveryStatus: "idle", recoveryAttemptId: null, recoveryErrorKind: null,
  });
  return next;
}
function update(current: CheckoutRuntime, changes: Partial<CheckoutAttempt>) {
  current.attempt = { ...current.attempt, ...changes };
  if (runtime === current) useCheckoutStore.setState({ attempt: current.attempt });
  return current.attempt;
}
function accumulateAppState(current: CheckoutRuntime, now: number) {
  const elapsed = Math.max(0, now - current.appStateChangedAt);
  if (current.appState === "active") current.activeMs += elapsed;
  else if (current.appState === "background") current.backgroundMs += elapsed;
  else current.inactiveMs += elapsed;
  current.appStateChangedAt = now;
}
export function observeCheckoutAppState(nextState: AppStateStatus) {
  const active = new Set(unresolvedPurchases.values());
  if (runtime && isCheckoutPending(runtime.attempt)) active.add(runtime);
  for (const current of active) {
    accumulateAppState(current, Date.now());
    current.appState = nextState;
  }
  const identities = new Set([...active].filter((current) => current.journaled)
    .map((current) => current.attempt.appUserId));
  for (const appUserId of identities) {
    const current = [...active].find((entry) => entry.attempt.appUserId === appUserId);
    if (current) persistInBackground(current);
  }
}
function properties(current: CheckoutRuntime): AnalyticsProperties {
  accumulateAppState(current, Date.now());
  const offer = current.attempt.package;
  return {
    ...current.input.properties,
    purchase_attempt_id: current.attempt.id,
    paywall_view_id: current.input.properties.source === "access_center" ? null : current.attempt.originViewId,
    checkout_view_id: current.attempt.originViewId,
    retry_of_attempt_id: current.attempt.retryOfAttemptId,
    currency: offer?.currencyCode ?? null,
    offering_id: offer?.offeringIdentifier ?? null, offering_identifier: offer?.offeringIdentifier ?? null,
    package_id: offer?.identifier ?? null, package_identifier: offer?.identifier ?? null,
    package_type: offer?.packageType ?? null, price: offer?.price ?? null,
    product_id: offer?.productIdentifier ?? null, product_identifier: offer?.productIdentifier ?? null,
    step: current.attempt.stage, elapsed_ms: Math.max(0, Date.now() - current.startedAt),
    app_active_ms: current.activeMs, app_background_ms: current.backgroundMs, app_inactive_ms: current.inactiveMs,
    app_unobserved_ms: current.unobservedMs, resumed_after_restart: current.resumedAfterRestart,
  };
}
function stage(current: CheckoutRuntime, next: CheckoutStage) {
  update(current, { stage: next });
  current.input.track(ANALYTICS_EVENTS.purchaseStageChanged.key, properties(current));
}
function hasAccess(snapshot: RevenueCatSnapshot) {
  return snapshot.featureEntitlements.premium_access || snapshot.featureEntitlements.ai_question_chat;
}
function hasCurrentPurchaseAccess() {
  const features = useEntitlementStore.getState().revenueCatFeatureEntitlements;
  return features.premium_access || features.ai_question_chat;
}
function finishPurchase(
  current: CheckoutRuntime,
  snapshot: RevenueCatSnapshot,
  confirmationSource: PurchaseConfirmationSource
) {
  if (current.attempt.status === "succeeded") return current.attempt;
  const nativeCompleted = current.nativePurchaseCompleted;
  const previousStatus = current.attempt.status;
  const attempt = update(current, { status: "succeeded", errorKind: null, errorMessage: null });
  unresolvedPurchases.delete(attempt.id);
  forgetJournaledAttempt(current);
  current.input.track(
    nativeCompleted && !current.resumedAfterRestart
      ? ANALYTICS_EVENTS.purchaseSucceeded.key
      : ANALYTICS_EVENTS.purchaseAccessConfirmed.key,
    {
      ...properties(current),
      active_entitlements_count: snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0,
      transaction_id: attempt.transactionId, confirmation_source: confirmationSource,
      previous_status: previousStatus, native_purchase_completed: nativeCompleted, is_plus: true, ui: "package",
    }
  );
  return attempt;
}
export function reconcileCheckoutAccess(
  appUserId: string,
  snapshot: RevenueCatSnapshot,
  confirmationSource: PurchaseConfirmationSource = "customer_info"
) {
  const incomingDate = Date.parse(snapshot.customerInfoRequestDate ?? "");
  const acceptedDate = useEntitlementStore.getState().revenueCatCustomerInfoDate;
  if (acceptedDate !== null && incomingDate < acceptedDate) return;
  const previous = lastObservedSnapshot;
  if (previous?.appUserId === appUserId &&
    incomingDate < Date.parse(previous.snapshot.customerInfoRequestDate ?? "")) return;
  lastObservedSnapshot = { appUserId, snapshot };
  if (!hasAccess(snapshot)) return;
  // A retry never erases the original uncertain attempt. These events confirm
  // access, not multiple store charges or new revenue.
  for (const current of [...unresolvedPurchases.values()]) {
    // The listener often precedes a successful native result. Hydrate access
    // immediately, but wait for that live promise before selecting its event.
    if (current.attempt.appUserId === appUserId && current.nativePurchaseStarted &&
      current.nativePurchaseSettled && current.attempt.package &&
      snapshot.activeProductIdentifiers?.includes(current.attempt.package.productIdentifier)) {
      finishPurchase(current, snapshot, confirmationSource);
    }
  }
}
function acceptSnapshot(
  appUserId: string,
  snapshot: RevenueCatSnapshot,
  confirmationSource: PurchaseConfirmationSource = "customer_info"
) {
  useEntitlementStore.getState().hydrateRevenueCatSnapshot(snapshot);
  reconcileCheckoutAccess(appUserId, snapshot, confirmationSource);
}
function pending(current: CheckoutRuntime, error?: unknown) {
  const kind = error ? getRevenueCatCheckoutErrorKind(error) : null;
  const outcomeUnknown = kind === "store_problem" || kind === "network" || kind === "unknown";
  update(current, {
    status: outcomeUnknown ? "outcome_unknown" : "awaiting_confirmation",
    errorKind: kind, errorCode: error ? getRevenueCatErrorCode(error) : null,
    errorMessage: error ? getRevenueCatErrorMessage(error) : null,
  });
  unresolvedPurchases.set(current.attempt.id, current);
  persistInBackground(current);
  const diagnostic = error ? getRevenueCatStructuredErrorProperties(error) : {};
  current.input.track(
    outcomeUnknown ? ANALYTICS_EVENTS.purchaseOutcomeUnknown.key : ANALYTICS_EVENTS.purchasePending.key,
    {
      ...properties(current), ...diagnostic,
      confirmation_reason: kind ?? "entitlement_not_yet_active",
      transaction_id: current.attempt.transactionId,
    }
  );
  if (error) current.input.captureError({
    area: "monetization", error, eventName: "purchase_" + current.attempt.status,
    severity: "warning", message: "Purchase outcome requires access reconciliation.",
    metadata: getRevenueCatDiagnostic({
      extra: { ...properties(current), ...diagnostic }, kind: "purchase",
      step: current.attempt.stage, why: getRevenueCatWhy(error),
    }),
  });
  if (lastObservedSnapshot?.appUserId === current.attempt.appUserId) {
    reconcileCheckoutAccess(current.attempt.appUserId, lastObservedSnapshot.snapshot);
  }
}

type RecoveryResult = {
  outcome: "active" | "not_found" | "failed";
  errorKind: RevenueCatCheckoutErrorKind | null;
};
async function recover(
  current: CheckoutRuntime,
  source: "automatic" | "manual" | "before_retry" | "restore" | "startup" | "foreground",
  requester?: CheckoutInput
): Promise<RecoveryResult> {
  useCheckoutStore.setState({
    recoveryInFlight: true, recoveryStatus: source === "restore" ? "restoring" : "checking",
    recoveryAttemptId: current.attempt.id, recoveryErrorKind: null,
  });
  const restoreId = source === "restore" ? createCheckoutId() : null;
  const entry = () => ({
    ...properties(current), recovery_source: source, restore_attempt_id: restoreId,
    purchase_stage: current.attempt.stage,
    step: source === "restore" ? "restore_purchases" : "get_customer_info",
    recovery_view_id: requester?.originViewId ?? null, recovery_surface: requester?.properties.source ?? null,
  });
  if (source === "restore") {
    const started = { ...entry(), restore_outcome: "started" };
    current.input.track(ANALYTICS_EVENTS.purchaseRestoreStarted.key, started);
    current.input.track(ANALYTICS_EVENTS.restoreStarted.key, started);
  } else current.input.track(ANALYTICS_EVENTS.purchaseStatusCheckStarted.key, entry());
  try {
    const snapshot = source === "restore"
      ? await restoreRevenueCatPurchases(current.attempt.appUserId)
      : await fetchRevenueCatAccessSnapshot(current.attempt.appUserId, { forceRefresh: true });
    acceptSnapshot(current.attempt.appUserId, snapshot);
    const active = hasCurrentPurchaseAccess();
    // Do not interpret missing access as a cancelled payment or no charge.
    useCheckoutStore.setState({ recoveryStatus: active ? "active" : "not_found", recoveryErrorKind: null });
    if (source === "restore") {
      const completed = { ...entry(), entitlement_active: active,
        restore_outcome: active ? "restored" : "empty" };
      current.input.track(ANALYTICS_EVENTS.restoreSucceeded.key, completed);
      current.input.track(active ? ANALYTICS_EVENTS.purchaseRestoreSucceeded.key : ANALYTICS_EVENTS.purchaseRestoreEmpty.key,
        { ...completed, active_entitlements_count: snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0, is_plus: active });
    } else current.input.track(ANALYTICS_EVENTS.purchaseStatusCheckCompleted.key, { ...entry(), access_active: active });
    return { outcome: active ? "active" : "not_found", errorKind: null };
  } catch (error) {
    const kind = getRevenueCatCheckoutErrorKind(error);
    // A listener can confirm access while this request is failing. A failed
    // request must not replace confirmed access with an error on the screen.
    const active = hasCurrentPurchaseAccess();
    const diagnostic = { ...entry(), ...getRevenueCatStructuredErrorProperties(error),
      access_active: active, step: source === "restore" ? "restore_purchases" : "get_customer_info" };
    useCheckoutStore.setState({ recoveryStatus: active ? "active" : "failed", recoveryErrorKind: active ? null : kind });
    current.input.captureError({
      area: "revenuecat", error, eventName: "purchase_status_check_failed", severity: "warning",
      metadata: getRevenueCatDiagnostic({ extra: diagnostic, kind: source, step: diagnostic.step, why: getRevenueCatWhy(error) }),
    });
    if (source === "restore") {
      const failed = { ...diagnostic, entitlement_active: active, restore_outcome: "failed" };
      current.input.track(ANALYTICS_EVENTS.purchaseRestoreFailed.key, failed);
      current.input.track(ANALYTICS_EVENTS.restoreFailed.key, failed);
    } else current.input.track(ANALYTICS_EVENTS.purchaseStatusCheckFailed.key, diagnostic);
    return { outcome: active ? "active" : "failed", errorKind: active ? null : kind };
  } finally {
    useCheckoutStore.setState({ recoveryInFlight: false });
  }
}
export async function refreshCheckoutAccess(
  appUserId: string, source: "manual" | "before_retry" | "startup" | "foreground" = "manual"
): Promise<RecoveryResult | null> {
  const current = runtime;
  const state = useCheckoutStore.getState();
  if (!current || current.attempt.appUserId !== appUserId ||
    state.nativeRequestInFlight || state.recoveryInFlight || !needsCheckoutRecovery(current.attempt)) return null;
  return recover(current, source);
}

export async function startCheckoutPurchase(
  input: CheckoutInput & {
    selectedPackage: RevenueCatPackageSummary | null;
    selectPackage: (offers: RevenueCatPackageSummary[]) => RevenueCatPackageSummary | null;
    confirmedRetryAttemptId?: string;
  }
): Promise<CheckoutAttempt | null> {
  try {
    await hydrateCheckoutJournal(input);
  } catch (error) {
    const failed: CheckoutAttempt = {
      id: createCheckoutId(), appUserId: input.appUserId, kind: "purchase",
      originViewId: input.originViewId, status: "failed", stage: "persist_checkout",
      package: input.selectedPackage, errorKind: "local_storage",
      errorCode: "checkout_storage_error", errorMessage: getRevenueCatErrorMessage(error),
      transactionId: null, retryOfAttemptId: null,
    };
    const telemetry = safeTelemetry(input);
    const diagnostic = { ...input.properties, purchase_attempt_id: failed.id,
      checkout_view_id: input.originViewId, step: "persist_checkout", error_category: "local_storage" };
    telemetry.captureError({ area: "monetization", error, severity: "warning",
      eventName: "checkout_journal_read_failed", metadata: diagnostic });
    telemetry.track(ANALYTICS_EVENTS.purchasePreparationFailed.key, diagnostic);
    if (!runtime || runtime.attempt.appUserId !== input.appUserId) {
      useCheckoutStore.setState({ attempt: failed });
    }
    return failed;
  }
  const previous = runtime;
  let retryOf: CheckoutRuntime | undefined;
  if (previous?.attempt.status === "outcome_unknown") {
    if (previous.attempt.appUserId !== input.appUserId ||
      input.confirmedRetryAttemptId !== previous.attempt.id || !canRetryUnknownCheckout(previous.attempt)) return null;
    const checked = await refreshCheckoutAccess(input.appUserId, "before_retry");
    if (!checked || checked.outcome !== "not_found" || runtime !== previous ||
      previous.attempt.status !== "outcome_unknown") return previous.attempt;
    retryOf = previous;
  }
  const current = acquire(input, "purchase", retryOf);
  if (!current) return null;
  try {
    // Also check before an ordinary purchase, including after a process restart.
    stage(current, "get_customer_info");
    const accessSnapshot = await fetchRevenueCatAccessSnapshot(input.appUserId, { forceRefresh: true });
    acceptSnapshot(input.appUserId, accessSnapshot);
    if (hasCurrentPurchaseAccess()) return update(current, { status: "succeeded" });
    let offer = input.selectedPackage;
    if (!offer) {
      stage(current, "get_offerings");
      const snapshot = await fetchRevenueCatSnapshot(input.appUserId);
      acceptSnapshot(input.appUserId, snapshot);
      offer = input.selectPackage(snapshot.offerings);
      if (hasCurrentPurchaseAccess()) return update(current, { status: "succeeded" });
    }
    if (!offer) throw Object.assign(new Error("No purchase offer available."), { code: "offer_unavailable" });
    if (hasCurrentPurchaseAccess()) return update(current, { status: "succeeded" });
    update(current, { package: offer });
    const result = await purchaseRevenueCatPackage({
      appUserId: input.appUserId, identifier: offer.identifier, offeringIdentifier: offer.offeringIdentifier,
      onStage: async (next, nativeOffer) => {
        // getOfferings is asynchronous. Access may have been confirmed since
        // preflight; stop immediately before the native payment, without
        // emitting a purchase start/success that never happened.
        if (next === "purchase_package" && hasCurrentPurchaseAccess()) {
          throw Object.assign(new Error("Purchase access is already active."), { code: "access_already_active" });
        }
        if (nativeOffer) update(current, { package: nativeOffer });
        if (next === "purchase_package") {
          stage(current, "persist_checkout");
          current.journaled = true;
          unresolvedPurchases.set(current.attempt.id, current);
          try {
            // A process killed from this point leaves an uncertain marker.
            // No native payment is invoked unless the durable write succeeds.
            await persistUnresolvedPurchases(input.appUserId);
          } catch (error) {
            throw checkoutStorageError(error);
          }
        } else {
          stage(current, next);
        }
      },
      onNativePurchaseStart: () => {
        // No await between this final guard and purchasePackage. A listener may
        // have confirmed access while durable preparation was still running.
        if (hasCurrentPurchaseAccess()) {
          throw Object.assign(new Error("Purchase access is already active."), { code: "access_already_active" });
        }
        current.nativePurchaseStarted = true;
        stage(current, "purchase_package");
        current.input.track(ANALYTICS_EVENTS.purchaseStarted.key, { ...properties(current), ui: "package" });
      },
    });
    current.nativePurchaseSettled = true;
    current.nativePurchaseCompleted = true;
    update(current, { transactionId: result.transactionId });
    acceptSnapshot(input.appUserId, result.snapshot, "purchase_result");
    if (lastObservedSnapshot?.appUserId === input.appUserId) {
      reconcileCheckoutAccess(input.appUserId, lastObservedSnapshot.snapshot);
    }
    // A listener may have already resolved and removed this marker. An older
    // native snapshot must not reopen that terminal attempt as pending.
    if (current.attempt.status === "succeeded") return current.attempt;
    pending(current);
    useCheckoutStore.setState({ nativeRequestInFlight: false });
    if (needsCheckoutRecovery(current.attempt)) await recover(current, "automatic");
    return current.attempt;
  } catch (error) {
    current.nativePurchaseSettled = true;
    if (current.nativePurchaseStarted && lastObservedSnapshot?.appUserId === input.appUserId) {
      reconcileCheckoutAccess(input.appUserId, lastObservedSnapshot.snapshot);
    }
    // Late native errors cannot regress an attempt whose product access has
    // already been confirmed independently.
    if (current.attempt.status === "succeeded") {
      current.input.captureError({
        area: "monetization", error, severity: "warning",
        eventName: "purchase_native_response_failed_after_access_confirmed",
        metadata: { ...properties(current), ...getRevenueCatStructuredErrorProperties(error) },
      });
      return current.attempt;
    }
    if (getRevenueCatErrorCode(error) === "access_already_active" && hasCurrentPurchaseAccess()) {
      forgetJournaledAttempt(current);
      return update(current, { status: "succeeded" });
    }
    const kind = getRevenueCatCheckoutErrorKind(error);
    const nativeStage = current.nativePurchaseStarted;
    if (nativeStage && ["payment_pending", "store_problem", "network", "unknown", "already_owned"].includes(kind)) {
      pending(current, error);
      // Native promise has settled, but payment outcome may remain unknown.
      useCheckoutStore.setState({ nativeRequestInFlight: false });
      if (needsCheckoutRecovery(current.attempt)) await recover(current, "automatic");
      return current.attempt;
    }
    // Code 15 rejects this request because the SDK is already busy; it is not
    // PAYMENT_PENDING. Known in-flight calls are already owned/blocked by the
    // coordinator. For a rejected retry, finally restores the original
    // uncertain attempt instead of replacing it with a new permanent pending.
    update(current, { status: kind === "cancelled" ? "cancelled" : "failed", errorKind: kind,
      errorCode: getRevenueCatErrorCode(error), errorMessage: getRevenueCatErrorMessage(error) });
    forgetJournaledAttempt(current);
    const diagnostic = {
      ...properties(current),
      ...getRevenueCatStructuredErrorProperties(error),
      ...(kind === "operation_in_progress" ? { purchase_request_accepted: false } : {}),
    };
    if (kind === "cancelled") {
      current.input.track(ANALYTICS_EVENTS.purchaseCancelled.key, diagnostic);
      return current.attempt;
    }
    current.input.captureError({
      area: "monetization", error,
      eventName: nativeStage ? "purchase_failed" : "purchase_preparation_failed",
      severity: kind === "operation_in_progress" || kind === "local_storage" ? "warning" : "error",
      metadata: getRevenueCatDiagnostic({ extra: diagnostic, kind: "purchase", step: current.attempt.stage, why: getRevenueCatWhy(error) }),
    });
    current.input.track(nativeStage ? ANALYTICS_EVENTS.purchaseFailed.key : ANALYTICS_EVENTS.purchasePreparationFailed.key,
      { ...diagnostic, error_code: current.attempt.errorCode });
    return current.attempt;
  } finally {
    if (runtime === current) {
      if (retryOf && needsCheckoutRecovery(retryOf.attempt) &&
        (current.attempt.status === "cancelled" || current.attempt.status === "failed")) {
        // A cancelled/failed retry says nothing about the original payment.
        // Keep its recovery UI and require a new check before another retry.
        runtime = retryOf;
        useCheckoutStore.setState({ attempt: retryOf.attempt, nativeRequestInFlight: false,
          recoveryStatus: "idle", recoveryAttemptId: null, recoveryErrorKind: null });
      } else useCheckoutStore.setState({ nativeRequestInFlight: false });
    }
  }
}

export async function startCheckoutRestore(input: CheckoutInput): Promise<CheckoutAttempt | null> {
  try {
    await hydrateCheckoutJournal(input);
  } catch (error) {
    // Restore is an explicit access-recovery action, not a new payment. Let
    // it run even if local storage is unavailable; leave the journal intact.
    safeTelemetry(input).captureError({
      area: "monetization", error, eventName: "checkout_journal_read_failed",
      severity: "warning", metadata: { source: "restore" },
    });
  }
  const state = useCheckoutStore.getState();
  if (state.nativeRequestInFlight || state.recoveryInFlight) return null;
  const original = runtime;
  if (original?.attempt.appUserId === input.appUserId && needsCheckoutRecovery(original.attempt)) {
    const result = await recover(original, "restore", input);
    // Empty/error restore does not overwrite the unresolved purchase.
    return { ...original.attempt, status: result.outcome === "active" ? "succeeded" : result.outcome === "not_found" ? "empty" : "failed",
      errorKind: result.errorKind };
  }
  const current = acquire(input, "restore");
  if (!current) return null;
  const entry = () => ({ ...properties(current), restore_attempt_id: current.attempt.id });
  try {
    const started = { ...entry(), restore_outcome: "started" };
    current.input.track(ANALYTICS_EVENTS.purchaseRestoreStarted.key, started);
    current.input.track(ANALYTICS_EVENTS.restoreStarted.key, started);
    const snapshot = await restoreRevenueCatPurchases(input.appUserId);
    acceptSnapshot(input.appUserId, snapshot);
    const active = hasCurrentPurchaseAccess();
    update(current, { status: active ? "succeeded" : "empty" });
    const completed = { ...entry(), entitlement_active: active, is_plus: active,
      restore_outcome: active ? "restored" : "empty" };
    current.input.track(ANALYTICS_EVENTS.restoreSucceeded.key, completed);
    current.input.track(active ? ANALYTICS_EVENTS.purchaseRestoreSucceeded.key : ANALYTICS_EVENTS.purchaseRestoreEmpty.key,
      { ...completed, active_entitlements_count: snapshot.purchaseAccess?.activeEntitlementIds.length ?? 0 });
  } catch (error) {
    update(current, { status: "failed", errorKind: getRevenueCatCheckoutErrorKind(error),
      errorCode: getRevenueCatErrorCode(error), errorMessage: getRevenueCatErrorMessage(error) });
    const diagnostic = { ...entry(), ...getRevenueCatStructuredErrorProperties(error),
      entitlement_active: hasCurrentPurchaseAccess(), restore_outcome: "failed" };
    current.input.captureError({ area: "monetization", error, eventName: "purchase_restore_failed",
      metadata: getRevenueCatDiagnostic({ extra: diagnostic, kind: "restore", step: "restore_purchases", why: getRevenueCatWhy(error) }) });
    current.input.track(ANALYTICS_EVENTS.purchaseRestoreFailed.key, diagnostic);
    current.input.track(ANALYTICS_EVENTS.restoreFailed.key, diagnostic);
  } finally {
    if (runtime === current) useCheckoutStore.setState({ nativeRequestInFlight: false });
  }
  return current.attempt;
}

import AsyncStorage from "@react-native-async-storage/async-storage";

import { isMobileSupabaseConfigured } from "../config/env";
import { disableStudyNotificationsAsync } from "../features/notifications/runtime";
import { getMobileSupabaseClient } from "../lib/supabase";
import { clearOfflinePack } from "../features/offline/offline-pack";
import { clearQuestionCatalogCache } from "../features/questions/question-catalog-cache";
import { isAppleSearchAdsStorageKey } from "../analytics/apple-search-ads";
import { isDurableAnalyticsStorageKey } from "../analytics/install-observation";
import { isCheckoutJournalStorageKey } from "../features/entitlements/checkout-journal";
import { clearLocalExamSessions } from "../features/exam/local-exam";
import { clearExamSnapshotMemory, flushExamSnapshotPersistence } from "../features/exam/exam-snapshot-cache";
import { useAiChatStore } from "./ai-chat";
import { useAppShellStore } from "./app-shell";
import { useEntitlementStore } from "./entitlements";
import { useFreeTierQuestionUsageStore } from "./free-tier-usage";
import { flushQuestionProgressPersist, useQuestionProgressStore } from "./question-progress";
import { useReadinessSnapshotStore } from "./readiness-snapshot";
import { useReviewPromptStore } from "./review-prompt";
import { useSignBookmarksStore } from "./sign-bookmarks";
import { useSignPracticeProgressStore } from "./sign-practice-progress";
import { useMonetizationStore } from "../features/monetization/monetization-store";
import { useHomeContextualStore } from "../features/home/home-contextual-store";

/**
 * Resets learning/onboarding and free quota. Financial recovery markers and
 * the Apple Search Ads install check stay: resetting progress must not forget
 * a possibly charged checkout or request a second attribution token.
 */
export async function resetAppToFreshStart() {
  const { authMode } = useAppShellStore.getState();

  if (authMode === "supabase" && isMobileSupabaseConfigured) {
    try {
      await getMobileSupabaseClient().auth.signOut();
    } catch {
      // Best effort — the local learning reset below still proceeds.
    }
  }

  await disableStudyNotificationsAsync();

  // Reset in-memory state immediately so the UI reflects the wipe without a reload.
  useEntitlementStore.getState().clearEntitlements();
  useEntitlementStore.getState().clearRevenueCatState();
  useQuestionProgressStore.getState().resetProgress();
  useReadinessSnapshotStore.getState().clearSnapshot();
  useSignBookmarksStore.getState().resetSaved();
  useSignPracticeProgressStore.getState().resetProgress();
  useFreeTierQuestionUsageStore.setState({ answeredQuestionsByDate: {} });
  useReviewPromptStore.getState().resetPrompt();
  useMonetizationStore.getState().resetMonetization();
  useHomeContextualStore.getState().resetHomeContextual();
  useAiChatStore.setState({
    conversations: {},
    latestConversationByQuestionId: {},
  });
  useAppShellStore.getState().resetShell();

  // Reset learning, not an unresolved payment. Native install identity lives
  // separately in secure storage; checkout markers retain that same identity.
  await Promise.all([
    flushExamSnapshotPersistence(),
    flushQuestionProgressPersist(),
  ]);
  clearLocalExamSessions();
  clearExamSnapshotMemory();
  try {
    const learningKeys = (await AsyncStorage.getAllKeys())
      .filter((key) => !isCheckoutJournalStorageKey(key) && !isAppleSearchAdsStorageKey(key) &&
        !isDurableAnalyticsStorageKey(key));
    if (learningKeys.length > 0) {
      await AsyncStorage.multiRemove(learningKeys);
    }
  } catch {
    // Ignore storage errors — in-memory state is already reset.
  }

  try {
    await clearOfflinePack();
  } catch {
    // Ignore file-system cleanup errors during a hard reset.
  }

  clearQuestionCatalogCache();
}

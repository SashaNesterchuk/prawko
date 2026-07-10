import AsyncStorage from "@react-native-async-storage/async-storage";

import { isMobileSupabaseConfigured } from "../config/env";
import { disableStudyNotificationsAsync } from "../features/notifications/runtime";
import { getMobileSupabaseClient } from "../lib/supabase";
import { useAiChatStore } from "./ai-chat";
import { useAppShellStore } from "./app-shell";
import { useEntitlementStore } from "./entitlements";
import { useFreeTierQuestionUsageStore } from "./free-tier-usage";
import { useQuestionProgressStore } from "./question-progress";

/**
 * Wipes every persisted store and resets in-memory state so the app behaves like
 * a fresh install: the user is sent back through onboarding from scratch.
 */
export async function resetAppToFreshStart() {
  const { authMode } = useAppShellStore.getState();

  if (authMode === "supabase" && isMobileSupabaseConfigured) {
    try {
      await getMobileSupabaseClient().auth.signOut();
    } catch {
      // Best effort — local reset below still clears everything.
    }
  }

  await disableStudyNotificationsAsync();

  // Reset in-memory state immediately so the UI reflects the wipe without a reload.
  useEntitlementStore.getState().clearEntitlements();
  useEntitlementStore.getState().clearRevenueCatState();
  useQuestionProgressStore.getState().resetProgress();
  useFreeTierQuestionUsageStore.setState({ answeredQuestionsByDate: {} });
  useAiChatStore.setState({
    conversations: {},
    latestConversationByQuestionId: {},
  });
  useAppShellStore.getState().resetShell();

  // Wipe persisted storage so the next launch is also fully fresh.
  try {
    await AsyncStorage.clear();
  } catch {
    // Ignore storage errors — in-memory state is already reset.
  }
}

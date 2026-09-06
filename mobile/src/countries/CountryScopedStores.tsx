import { PropsWithChildren, useEffect } from "react";
import type { CountryCode } from "@prawko/config";

import { clearExamSnapshotMemory } from "../features/exam/exam-snapshot-cache";
import { useAiChatStore } from "../state/ai-chat";
import { useAppShellStore } from "../state/app-shell";
import { useFreeTierQuestionUsageStore } from "../state/free-tier-usage";
import {
  discardPendingQuestionProgressPersist,
  flushQuestionProgressPersist,
  useQuestionProgressStore,
} from "../state/question-progress";
import { useReadinessSnapshotStore } from "../state/readiness-snapshot";
import { useSignBookmarksStore } from "../state/sign-bookmarks";
import { useSignPracticeProgressStore } from "../state/sign-practice-progress";
import {
  migrateUnscopedPersistKey,
  scopedPersistName,
  shouldResetCountryScopedStores,
} from "./persist";

const QUESTION_PROGRESS_PERSIST_BASE = "prawko-question-progress";
const AI_CHAT_PERSIST_BASE = "prawko-ai-chat";
const READINESS_PERSIST_BASE = "prawko-readiness-snapshot";
const SIGN_BOOKMARKS_PERSIST_BASE = "road-sign-bookmarks-v1";
const SIGN_PRACTICE_PERSIST_BASE = "road-sign-practice-progress-v1";
const FREE_TIER_PERSIST_BASE = "prawko-free-tier-usage";

let lastHydratedCountry: CountryCode | null = null;
let rehydrateChain: Promise<void> = Promise.resolve();

export async function rehydrateCountryScopedStores(country: CountryCode) {
  rehydrateChain = rehydrateChain.then(() =>
    rehydrateCountryScopedStoresNow(country),
  );
  await rehydrateChain;
}

async function rehydrateCountryScopedStoresNow(country: CountryCode) {
  if (
    lastHydratedCountry === country &&
    useQuestionProgressStore.getState().hasHydrated
  ) {
    return;
  }

  const isCountrySwitch = shouldResetCountryScopedStores(
    lastHydratedCountry,
    country
  );

  if (isCountrySwitch) {
    await flushQuestionProgressPersist();
  }

  await Promise.all([
    migrateUnscopedPersistKey(QUESTION_PROGRESS_PERSIST_BASE),
    migrateUnscopedPersistKey(AI_CHAT_PERSIST_BASE),
    migrateUnscopedPersistKey(READINESS_PERSIST_BASE),
    migrateUnscopedPersistKey(SIGN_BOOKMARKS_PERSIST_BASE),
    migrateUnscopedPersistKey(SIGN_PRACTICE_PERSIST_BASE),
    migrateUnscopedPersistKey(FREE_TIER_PERSIST_BASE),
  ]);

  if (isCountrySwitch) {
    useQuestionProgressStore.getState().resetProgress();
    useQuestionProgressStore.getState().setHasHydrated(false);
    useAiChatStore.setState({
      conversations: {},
      hasHydrated: false,
      latestConversationByQuestionId: {},
    });
    useReadinessSnapshotStore.getState().clearSnapshot();
    useReadinessSnapshotStore.getState().setHasHydrated(false);
    useSignBookmarksStore.getState().resetSaved();
    useSignPracticeProgressStore.getState().resetProgress();
    useFreeTierQuestionUsageStore.setState({
      answeredQuestionsByDate: {},
      hasHydrated: false,
    });
    clearExamSnapshotMemory();
    discardPendingQuestionProgressPersist();
  }

  useQuestionProgressStore.persist.setOptions({
    name: scopedPersistName(QUESTION_PROGRESS_PERSIST_BASE, country),
  });
  useAiChatStore.persist.setOptions({
    name: scopedPersistName(AI_CHAT_PERSIST_BASE, country),
  });
  useReadinessSnapshotStore.persist.setOptions({
    name: scopedPersistName(READINESS_PERSIST_BASE, country),
  });
  useSignBookmarksStore.persist.setOptions({
    name: scopedPersistName(SIGN_BOOKMARKS_PERSIST_BASE, country),
  });
  useSignPracticeProgressStore.persist.setOptions({
    name: scopedPersistName(SIGN_PRACTICE_PERSIST_BASE, country),
  });
  useFreeTierQuestionUsageStore.persist.setOptions({
    name: scopedPersistName(FREE_TIER_PERSIST_BASE, country),
  });

  await Promise.all([
    useQuestionProgressStore.persist.rehydrate(),
    useAiChatStore.persist.rehydrate(),
    useReadinessSnapshotStore.persist.rehydrate(),
    useSignBookmarksStore.persist.rehydrate(),
    useSignPracticeProgressStore.persist.rehydrate(),
    useFreeTierQuestionUsageStore.persist.rehydrate(),
  ]);

  useQuestionProgressStore.getState().setHasHydrated(true);
  useAiChatStore.getState().setHasHydrated(true);
  useReadinessSnapshotStore.getState().setHasHydrated(true);
  useFreeTierQuestionUsageStore.getState().setHasHydrated(true);
  lastHydratedCountry = country;
}

export function CountryScopedStores({ children }: PropsWithChildren) {
  const examCountry = useAppShellStore((state) => state.examCountry);

  useEffect(() => {
    if (!examCountry) {
      return;
    }

    void rehydrateCountryScopedStores(examCountry);
  }, [examCountry]);

  return children;
}

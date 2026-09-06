import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { mobileEnv } from "../../src/config/env";
import { normalizeSupportedLocale } from "../../src/i18n/locale";
import { useHasHydrated } from "../../src/state/app-shell";
import {
  prepareE2EAppState,
  resolveE2EDestination,
  type E2EHomeDailyStatus,
} from "../../src/testing/e2e/bootstrap";
import type {
  E2EOfflinePackStatus,
  E2EQuestionScenario,
} from "../../src/testing/e2e/state";
import type { RemoteExamSessionStatus } from "../../src/features/exam/types";

import { CText, getFontFamily } from "../../src/portable-ui";
type BootstrapParams = {
  category?: string | string[];
  daysUntilExam?: string | string[];
  destination?: string | string[];
  enableAds?: string | string[];
  examSessionCategory?: string | string[];
  examSessionStatus?: string | string[];
  examStartOrder?: string | string[];
  examCountry?: string | string[];
  homeDaily?: string | string[];
  locale?: string | string[];
  offlinePackCategory?: string | string[];
  offlinePackStatus?: string | string[];
  plusAccess?: string | string[];
  questionScenario?: string | string[];
  reachability?: string | string[];
  signCategoryId?: string | string[];
  topicId?: string | string[];
  firstStart?: string | string[];
};

export default function E2EBootstrapScreen() {
  const hasHydrated = useHasHydrated();
  const hasBootstrappedRef = useRef(false);
  const params = useLocalSearchParams<BootstrapParams>();
  const destination = getSingleParam(params.destination);
  const category = getSingleParam(params.category);
  const plusAccess = parseOptionalBoolean(getSingleParam(params.plusAccess));
  const enableAds = parseOptionalBoolean(getSingleParam(params.enableAds));
  const reachability = parseOptionalBoolean(getSingleParam(params.reachability));
  const locale = normalizeSupportedLocale(getSingleParam(params.locale));
  const offlinePackCategory = getSingleParam(params.offlinePackCategory);
  const offlinePackStatus = parseOfflinePackStatus(
    getSingleParam(params.offlinePackStatus)
  );
  const questionScenario = parseQuestionScenario(
    getSingleParam(params.questionScenario)
  );
  const examSessionCategory = getSingleParam(params.examSessionCategory);
  const examSessionStatus = parseExamSessionStatus(
    getSingleParam(params.examSessionStatus)
  );
  const examCountry = getSingleParam(params.examCountry);
  const homeDaily = parseHomeDailyStatus(getSingleParam(params.homeDaily));
  const reviewStartOrder = parsePositiveInteger(
    getSingleParam(params.examStartOrder)
  );
  const signCategoryId = getSingleParam(params.signCategoryId);
  const topicId = getSingleParam(params.topicId);
  const daysUntilExam = parsePositiveInteger(getSingleParam(params.daysUntilExam));
  const firstStart = parseOptionalBoolean(getSingleParam(params.firstStart));

  useEffect(() => {
    if (
      !mobileEnv.enableE2ETestMode ||
      !hasHydrated ||
      hasBootstrappedRef.current
    ) {
      return;
    }

    hasBootstrappedRef.current = true;
    void (async () => {
      const prepared = await prepareE2EAppState({
        category,
        daysUntilExam,
        enableAds,
        examSessionCategory,
        examSessionStatus,
        examCountry,
        homeDaily,
        locale,
        offlinePackCategory,
        offlinePackStatus,
        plusAccess,
        questionScenario,
        reachability,
        seedQuestionResult:
          destination === "question-result" ||
          destination === "question-result-failed",
        seedQuestionResultOutcome:
          destination === "question-result-failed" ? "poor" : "good",
        seedDiagnosticResult: destination === "diagnostic-result",
        unlockHomeChrome: firstStart === true ? false : true,
      });

      router.replace(
        resolveE2EDestination({
          destination,
          reviewStartOrder,
          seededExamSessionId: prepared.seededExamSessionId,
          seededQuestionLimit: prepared.seededQuestionLimit,
          seededQuestionMode: prepared.seededQuestionMode,
          seededQuestionSessionKey: prepared.seededQuestionSessionKey,
          signCategoryId,
          topicId,
        }),
      );
    })();
  }, [
    category,
    daysUntilExam,
    destination,
    enableAds,
    examSessionCategory,
    examSessionStatus,
    examCountry,
    firstStart,
    hasHydrated,
    homeDaily,
    locale,
    offlinePackCategory,
    offlinePackStatus,
    plusAccess,
    questionScenario,
    reachability,
    reviewStartOrder,
    signCategoryId,
    topicId,
  ]);

  const isEnabled = mobileEnv.enableE2ETestMode;
  const status = !isEnabled
    ? "E2E bootstrap disabled"
    : hasHydrated
      ? "Preparing app state"
      : "Waiting for persisted state";
  const detail = !isEnabled
    ? "Set EXPO_PUBLIC_E2E_TEST_MODE=1 in the app build used by Maestro."
    : "Seeding completed onboarding and redirecting to the requested screen.";

  return (
    <View
      style={styles.container}
      testID={isEnabled ? "screen-e2e-bootstrap" : "screen-e2e-bootstrap-disabled"}
    >
      <CText style={styles.title}>{status}</CText>
      <CText style={styles.detail}>{detail}</CText>
    </View>
  );
}

function getSingleParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalBoolean(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function parseHomeDailyStatus(
  value: string | undefined
): E2EHomeDailyStatus | null {
  switch (value?.trim().toLowerCase()) {
    case "done":
      return "done";
    case "in_progress":
      return "in_progress";
    default:
      return null;
  }
}

function parseOfflinePackStatus(
  value: string | undefined
): E2EOfflinePackStatus | null {
  switch (value?.trim().toLowerCase()) {
    case "missing":
      return "missing";
    case "ready":
      return "ready";
    case "incomplete":
      return "incomplete";
    case "downloading":
      return "downloading";
    default:
      return null;
  }
}

function parseExamSessionStatus(
  value: string | undefined
): RemoteExamSessionStatus | null {
  switch (value?.trim().toLowerCase()) {
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "abandoned":
      return "abandoned";
    case "expired":
      return "expired";
    default:
      return null;
  }
}

function parseQuestionScenario(
  value: string | undefined
): E2EQuestionScenario | null {
  return value?.trim().toLowerCase() === "topic-progress"
    ? "topic-progress"
    : null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#EEF4F2",
  },
  title: {
    fontSize: 20,
    fontFamily: getFontFamily("semiBold"),
    color: "#102A26",
    textAlign: "center",
  },
  detail: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#40615A",
    textAlign: "center",
  },
});

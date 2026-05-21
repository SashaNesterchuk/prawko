import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import { formatPlanDate } from "../../src/features/study-plan/generate-local-study-plan";
import { getMobileSupabaseClient } from "../../src/lib/supabase";
import {
  useHasFeatureAccess,
  usePurchaseAccess,
  useRevenueCatConfigured,
  useSchoolAccess,
} from "../../src/state/entitlements";
import {
  useCurrentStudyPlan,
  useCurrentUser,
  useAppShellStore,
} from "../../src/state/app-shell";
import {
  useQuestionCatalogCount,
  useQuestionCatalogLastError,
  useQuestionCatalogStatus,
} from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function ProfileTabScreen() {
  const { t } = useTranslation();
  const currentUser = useCurrentUser();
  const currentStudyPlan = useCurrentStudyPlan();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const preferredCategory = useAppShellStore(
    (state) => state.preferredCategory
  );
  const authMode = useAppShellStore((state) => state.authMode);
  const signOutLocal = useAppShellStore((state) => state.signOutLocal);
  const resetShell = useAppShellStore((state) => state.resetShell);
  const schoolAccess = useSchoolAccess();
  const purchaseAccess = usePurchaseAccess();
  const revenueCatConfigured = useRevenueCatConfigured();
  const hasAiQuestionChatAccess = useHasFeatureAccess("ai_question_chat");
  const hasExamAccess = useHasFeatureAccess("exam_simulator");
  const resetProgress = useQuestionProgressStore((state) => state.resetProgress);
  const questionCatalogCount = useQuestionCatalogCount();
  const questionCatalogError = useQuestionCatalogLastError();
  const questionCatalogStatus = useQuestionCatalogStatus();

  const handleSignOut = async () => {
    if (authMode === "supabase" && isMobileSupabaseConfigured) {
      try {
        await getMobileSupabaseClient().auth.signOut();
      } catch {
        // ignore here; the shell still needs a local fallback reset
      }
    }

    signOutLocal();
    resetProgress();
    Toast.show({
      type: "success",
      text1: t("toasts.signedOutTitle"),
      text2: t("toasts.signedOutSubtitle"),
    });
    router.replace("/(onboarding)/access");
  };

  return (
    <AppScreen
      title={t("tabs.profileTitle")}
      subtitle={t("tabs.profileSubtitle")}
    >
      <View style={{ gap: 12 }}>
        <AppCard accent>
          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            {t("profile.currentUser")}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
            {currentUser?.fullName ?? t("common.student")}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 22 }}>
            {currentUser?.email ?? "demo@prawko.app"}
          </Text>
        </AppCard>

        <AppCard>
          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            {t("profile.preferences")}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.localeValue", { locale: preferredLocale.toUpperCase() })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.categoryValue", { category: preferredCategory })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.authValue", { authMode })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.supabaseValue", {
              status: isMobileSupabaseConfigured
                ? t("common.configured")
                : t("common.missing"),
            })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.revenueCatValue", {
              status: revenueCatConfigured
                ? t("common.configured")
                : t("common.missing"),
            })}
          </Text>
        </AppCard>

        <AppCard>
          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            {t("profile.access")}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.aiAccessValue", {
              status: t(
                hasAiQuestionChatAccess
                  ? "profile.accessStatuses.enabled"
                  : "profile.accessStatuses.locked"
              ),
            })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.examAccessValue", {
              status: t(
                hasExamAccess
                  ? "profile.accessStatuses.enabled"
                  : "profile.accessStatuses.locked"
              ),
            })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {schoolAccess
              ? t("profile.schoolAccessValue", {
                  school:
                    schoolAccess.schoolName ?? t("profile.schoolPartnerFallback"),
                  date: schoolAccess.accessEndsAt
                    ? formatPlanDate(schoolAccess.accessEndsAt.slice(0, 10))
                    : t("profile.accessNoExpiry"),
                })
              : t("profile.schoolAccessMissing")}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {purchaseAccess
              ? t("profile.purchaseAccessValue", {
                  date: purchaseAccess.latestExpirationDate
                    ? formatPlanDate(
                        purchaseAccess.latestExpirationDate.slice(0, 10)
                      )
                    : t("profile.accessNoExpiry"),
                })
              : t("profile.purchaseAccessMissing")}
          </Text>
        </AppCard>

        <AppCard>
          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            {t("profile.catalog")}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.catalogStatusValue", {
              status: t(`profile.catalogStatuses.${questionCatalogStatus}`),
            })}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24 }}>
            {t("profile.catalogCountValue", {
              count: questionCatalogCount,
            })}
          </Text>
          {questionCatalogError ? (
            <Text style={{ fontSize: 15, lineHeight: 24 }}>
              {t("profile.catalogErrorValue", {
                error: questionCatalogError,
              })}
            </Text>
          ) : null}
        </AppCard>

        {currentStudyPlan ? (
          <AppCard accent>
            <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
              {t("profile.currentPlan")}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
              {currentStudyPlan.title}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 22 }}>
              {t("profile.planDateValue", {
                date: formatPlanDate(currentStudyPlan.examDate),
              })}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 22 }}>
              {t("profile.planDaysValue", {
                days: currentStudyPlan.daysPlanned,
              })}
            </Text>
          </AppCard>
        ) : null}

        <View style={{ gap: 10 }}>
          {currentStudyPlan ? (
            <AppButton
              variant="secondary"
              label={t("profile.viewPlan")}
              onPress={() => router.push("/(onboarding)/preview")}
            />
          ) : null}
          {currentStudyPlan ? (
            <AppButton
              variant="secondary"
              label={t("home.adjustPlan")}
              onPress={() => router.push("/modals/plan-adjust")}
            />
          ) : null}
          <AppButton
            variant="secondary"
            label={t("profile.openAi")}
            onPress={() => router.push("/modals/ai-chat")}
          />
          <AppButton
            variant="secondary"
            label={t("profile.openPaywall")}
            onPress={() => router.push("/modals/paywall")}
          />
          <AppButton
            variant="ghost"
            label={t("profile.signOut")}
            onPress={() => void handleSignOut()}
          />
          <AppButton
            variant="ghost"
            label={t("profile.resetShell")}
            onPress={() => {
              resetShell();
              resetProgress();
              Toast.show({
                type: "success",
                text1: t("toasts.shellResetTitle"),
                text2: t("toasts.shellResetSubtitle"),
              });
              router.replace("/");
            }}
          />
        </View>
      </View>
    </AppScreen>
  );
}

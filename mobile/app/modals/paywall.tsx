import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { APP_FEATURES, type AppFeature } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { AppTextInput } from "../../src/components/shell/AppTextInput";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  fetchRemoteEntitlementSnapshot,
  getSchoolCodeRedeemErrorMessage,
  normalizeSchoolCode,
  redeemSchoolCode,
} from "../../src/features/entitlements/supabase-entitlements";
import {
  getRevenueCatErrorMessage,
  isRevenueCatPurchaseCancelled,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../../src/features/entitlements/revenuecat";
import { formatPlanDate } from "../../src/features/study-plan/generate-local-study-plan";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  useEntitlementStatus,
  useEntitlementStore,
  useHasFeatureAccess,
  usePurchaseAccess,
  useRevenueCatConfigured,
  useRevenueCatOfferings,
  useRevenueCatStatus,
  useSchoolAccess,
} from "../../src/state/entitlements";
import { useCurrentUser, useAppShellStore } from "../../src/state/app-shell";

const FEATURES = [
  {
    key: "paywall.featurePlan",
    feature: "premium_access",
  },
  {
    key: "paywall.featureAi",
    feature: "ai_question_chat",
  },
  {
    key: "paywall.featureExam",
    feature: "exam_simulator",
  },
  {
    key: "paywall.featureSchool",
    feature: "premium_access",
  },
] as const;

export default function PaywallModalScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);
  const params = useLocalSearchParams<{
    feature?: string | string[];
  }>();
  const currentUser = useCurrentUser();
  const authMode = useAppShellStore((state) => state.authMode);
  const storedSchoolCode = useAppShellStore((state) => state.studyPlanSetup.schoolCode);
  const setSchoolCode = useAppShellStore((state) => state.setSchoolCode);
  const entitlementStatus = useEntitlementStatus();
  const schoolAccess = useSchoolAccess();
  const purchaseAccess = usePurchaseAccess();
  const revenueCatConfigured = useRevenueCatConfigured();
  const revenueCatOfferings = useRevenueCatOfferings();
  const revenueCatStatus = useRevenueCatStatus();
  const hasPremiumAccess = useHasFeatureAccess("premium_access");
  const hasAiQuestionChatAccess = useHasFeatureAccess("ai_question_chat");
  const hasExamAccess = useHasFeatureAccess("exam_simulator");
  const hydrateRemoteEntitlements = useEntitlementStore(
    (state) => state.hydrateRemoteEntitlements
  );
  const hydrateRevenueCatSnapshot = useEntitlementStore(
    (state) => state.hydrateRevenueCatSnapshot
  );
  const setEntitlementStatus = useEntitlementStore(
    (state) => state.setEntitlementStatus
  );
  const setRevenueCatStatus = useEntitlementStore(
    (state) => state.setRevenueCatStatus
  );
  const [schoolCode, setSchoolCodeValue] = useState(storedSchoolCode);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purchaseFeedback, setPurchaseFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [redeemFeedback, setRedeemFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const targetFeature = getSingleParam(params.feature);
  const highlightedFeature = isAppFeature(targetFeature) ? targetFeature : null;

  const canRedeemSchoolCode =
    authMode === "supabase" && Boolean(currentUser) && isMobileSupabaseConfigured;
  const canUseDirectPurchase = authMode === "supabase" && Boolean(currentUser);
  const accessEndsAt = schoolAccess?.accessEndsAt
    ? formatPlanDate(schoolAccess.accessEndsAt.slice(0, 10))
    : null;
  const purchaseEndsAt = purchaseAccess?.latestExpirationDate
    ? formatPlanDate(purchaseAccess.latestExpirationDate.slice(0, 10))
    : null;
  const featureStatuses = {
    ai_question_chat: hasAiQuestionChatAccess,
    exam_simulator: hasExamAccess,
    premium_access: hasPremiumAccess,
  } as const;
  const recommendedPackage = useMemo(
    () => pickRecommendedPackage(revenueCatOfferings),
    [revenueCatOfferings]
  );
  const [selectedPackageKey, setSelectedPackageKey] = useState<string | null>(null);
  const selectedPackage =
    revenueCatOfferings.find((item) => getPackageKey(item) === selectedPackageKey) ??
    recommendedPackage;

  useEffect(() => {
    if (!selectedPackageKey && recommendedPackage) {
      setSelectedPackageKey(getPackageKey(recommendedPackage));
    }
  }, [recommendedPackage, selectedPackageKey]);

  const handleRedeemSchoolCode = async () => {
    const normalizedCode = normalizeSchoolCode(schoolCode);

    if (!normalizedCode) {
      setRedeemFeedback({
        kind: "error",
        message: t("paywall.redeemMissingCode"),
      });
      return;
    }

    if (!canRedeemSchoolCode) {
      setRedeemFeedback({
        kind: "error",
        message: t("paywall.redeemRequiresAuth"),
      });
      return;
    }

    setIsRedeeming(true);
    setRedeemFeedback(null);
    setPurchaseFeedback(null);
    setEntitlementStatus("loading");

    try {
      const redemption = await redeemSchoolCode(normalizedCode);
      const snapshot = await fetchRemoteEntitlementSnapshot();

      hydrateRemoteEntitlements(snapshot);
      setSchoolCode(normalizedCode);
      setRedeemFeedback({
        kind: "success",
        message: t(
          redemption.wasAlreadyMember
            ? "paywall.redeemAlreadyActive"
            : "paywall.redeemSuccess",
          {
            school: redemption.schoolName,
          }
        ),
      });
      Toast.show({
        type: "success",
        text1: t("toasts.schoolCodeRedeemedTitle"),
        text2: t(
          redemption.wasAlreadyMember
            ? "toasts.schoolCodeAlreadyActiveSubtitle"
            : "toasts.schoolCodeRedeemedSubtitle",
          {
            school: redemption.schoolName,
          }
        ),
      });
    } catch (error) {
      const message = getSchoolCodeRedeemErrorMessage(error);

      setEntitlementStatus("ready");
      setRedeemFeedback({
        kind: "error",
        message,
      });
      Toast.show({
        type: "error",
        text1: t("toasts.schoolCodeRedeemFailedTitle"),
        text2: message,
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handlePurchase = async () => {
    if (!currentUser || authMode !== "supabase") {
      router.replace("/(onboarding)/access");
      return;
    }

    if (!revenueCatConfigured) {
      setPurchaseFeedback({
        kind: "error",
        message: t("paywall.directMissingConfig"),
      });
      return;
    }

    if (!selectedPackage) {
      setPurchaseFeedback({
        kind: "error",
        message: t("paywall.directNoOfferSelected"),
      });
      return;
    }

    setIsPurchasing(true);
    setPurchaseFeedback(null);
    setRedeemFeedback(null);
    setRevenueCatStatus("loading");

    try {
      const snapshot = await purchaseRevenueCatPackage({
        appUserId: currentUser.id,
        identifier: selectedPackage.identifier,
        offeringIdentifier: selectedPackage.offeringIdentifier,
      });

      hydrateRevenueCatSnapshot(snapshot);
      setPurchaseFeedback({
        kind: "success",
        message: t("paywall.purchaseSuccess", {
          title: selectedPackage.title,
        }),
      });
      Toast.show({
        type: "success",
        text1: t("toasts.purchaseSuccessTitle"),
        text2: t("toasts.purchaseSuccessSubtitle", {
          title: selectedPackage.title,
        }),
      });
    } catch (error) {
      if (isRevenueCatPurchaseCancelled(error)) {
        setRevenueCatStatus("ready");
        setPurchaseFeedback({
          kind: "error",
          message: t("paywall.purchaseCancelled"),
        });
        return;
      }

      const message = getRevenueCatErrorMessage(error);

      setRevenueCatStatus("ready");
      setPurchaseFeedback({
        kind: "error",
        message,
      });
      Toast.show({
        type: "error",
        text1: t("toasts.purchaseFailedTitle"),
        text2: message,
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!currentUser || authMode !== "supabase") {
      router.replace("/(onboarding)/access");
      return;
    }

    if (!revenueCatConfigured) {
      setPurchaseFeedback({
        kind: "error",
        message: t("paywall.directMissingConfig"),
      });
      return;
    }

    setIsRestoring(true);
    setPurchaseFeedback(null);
    setRedeemFeedback(null);
    setRevenueCatStatus("loading");

    try {
      const snapshot = await restoreRevenueCatPurchases(currentUser.id);

      hydrateRevenueCatSnapshot(snapshot);

      if (!snapshot.featureEntitlements.premium_access) {
        setPurchaseFeedback({
          kind: "error",
          message: t("paywall.restoreEmpty"),
        });
        return;
      }

      setPurchaseFeedback({
        kind: "success",
        message: t("paywall.restoreSuccess"),
      });
      Toast.show({
        type: "success",
        text1: t("toasts.restoreSuccessTitle"),
        text2: t("toasts.restoreSuccessSubtitle"),
      });
    } catch (error) {
      const message = getRevenueCatErrorMessage(error);

      setRevenueCatStatus("ready");
      setPurchaseFeedback({
        kind: "error",
        message,
      });
      Toast.show({
        type: "error",
        text1: t("toasts.restoreFailedTitle"),
        text2: message,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <AppScreen
      title={t(hasPremiumAccess ? "paywall.activeTitle" : "paywall.title")}
      subtitle={getPaywallSubtitle({
        hasPremiumAccess,
        purchaseAccess,
        schoolAccess,
        t,
      })}
      footer={
        <View style={{ gap: 10 }}>
          {!currentUser || authMode !== "supabase" ? (
            <AppButton
              label={t("paywall.openSignIn")}
              onPress={() => router.replace("/(onboarding)/access")}
            />
          ) : null}
          <AppButton label={t("paywall.primaryCta")} onPress={() => router.back()} />
          <AppButton
            variant="ghost"
            label={t("common.close")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        {purchaseAccess ? (
          <AppCard accent>
            <Text style={styles.sectionLabel}>{t("paywall.purchaseAccessTitle")}</Text>
            <Text style={styles.cardTitle}>{t("paywall.purchaseAccessActive")}</Text>
            <Text style={styles.cardBody}>
              {purchaseEndsAt
                ? t("paywall.purchaseEndsAt", {
                    date: purchaseEndsAt,
                  })
                : t("paywall.purchaseNoExpiry")}
            </Text>
          </AppCard>
        ) : null}

        {schoolAccess ? (
          <AppCard accent>
            <Text style={styles.sectionLabel}>
              {t("paywall.accessCardTitle")}
            </Text>
            <Text style={styles.cardTitle}>
              {schoolAccess.schoolName ?? t("paywall.schoolPartnerFallback")}
            </Text>
            <Text style={styles.cardBody}>
              {accessEndsAt
                ? t("paywall.accessEndsAt", {
                    date: accessEndsAt,
                  })
                : t("paywall.accessNoExpiry")}
            </Text>
          </AppCard>
        ) : null}

        <AppCard accent={highlightedFeature === "premium_access"}>
          <Text style={styles.sectionLabel}>{t("paywall.directTitle")}</Text>
          <Text style={styles.cardTitle}>{t("paywall.directHeadline")}</Text>
          <Text style={styles.cardBody}>{t("paywall.directSubtitle")}</Text>

          {!canUseDirectPurchase ? (
            <Text style={styles.helperText}>{t("paywall.directRequiresAuth")}</Text>
          ) : !revenueCatConfigured ? (
            <Text style={styles.helperText}>{t("paywall.directMissingConfig")}</Text>
          ) : revenueCatStatus === "loading" && revenueCatOfferings.length === 0 ? (
            <Text style={styles.helperText}>{t("paywall.directLoading")}</Text>
          ) : revenueCatOfferings.length === 0 ? (
            <Text style={styles.helperText}>{t("paywall.directNoOffers")}</Text>
          ) : (
            <>
              <View style={styles.offerGrid}>
                {revenueCatOfferings.map((item) => {
                  const isSelected =
                    getPackageKey(item) === getPackageKey(selectedPackage ?? item);
                  const isRecommended =
                    recommendedPackage &&
                    getPackageKey(recommendedPackage) === getPackageKey(item);

                  return (
                    <Pressable
                      key={getPackageKey(item)}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedPackageKey(getPackageKey(item));
                        setPurchaseFeedback(null);
                      }}
                      style={({ pressed }) => [
                        styles.offerCard,
                        isSelected ? styles.offerCardSelected : null,
                        pressed ? styles.offerCardPressed : null,
                      ]}
                    >
                      <Text style={styles.offerTitle}>{item.title}</Text>
                      <Text style={styles.offerPrice}>{item.priceString}</Text>
                      <Text style={styles.offerMeta}>
                        {item.pricePerMonthString
                          ? t("paywall.offerPerMonth", {
                              price: item.pricePerMonthString,
                            })
                          : item.subscriptionPeriod
                            ? t("paywall.offerPeriod", {
                                period: item.subscriptionPeriod,
                              })
                            : item.description || t("paywall.offerOneTime")}
                      </Text>
                      {isRecommended ? (
                        <Text style={styles.offerBadge}>
                          {t("paywall.offerRecommended")}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {purchaseFeedback ? (
                <Text
                  style={[
                    styles.feedbackText,
                    purchaseFeedback.kind === "error"
                      ? styles.feedbackError
                      : styles.feedbackSuccess,
                  ]}
                >
                  {purchaseFeedback.message}
                </Text>
              ) : null}
              <View style={{ gap: 10, marginTop: 12 }}>
                <AppButton
                  label={t(
                    isPurchasing
                      ? "paywall.purchaseCtaLoading"
                      : "paywall.purchaseCta"
                  )}
                  onPress={() => void handlePurchase()}
                  disabled={
                    isPurchasing ||
                    isRestoring ||
                    revenueCatStatus === "loading" ||
                    !selectedPackage
                  }
                />
                <AppButton
                  variant="ghost"
                  label={t(
                    isRestoring
                      ? "paywall.restoreCtaLoading"
                      : "paywall.restoreCta"
                  )}
                  onPress={() => void handleRestore()}
                  disabled={isPurchasing || isRestoring}
                />
              </View>
            </>
          )}
        </AppCard>

        {FEATURES.map((feature) => (
          <AppCard
            key={feature.key}
            accent={feature.feature === highlightedFeature}
          >
            <Text style={styles.featureTitle}>
              {t(feature.key)}
            </Text>
            <Text style={styles.featureBody}>
              {t(
                featureStatuses[feature.feature]
                  ? "paywall.featureEnabled"
                  : "paywall.featureLocked"
              )}
            </Text>
          </AppCard>
        ))}

        <AppCard>
          <Text style={styles.sectionLabel}>
            {t("paywall.redeemTitle")}
          </Text>
          <Text style={[styles.cardBody, { marginBottom: 12 }]}>
            {canRedeemSchoolCode
              ? t("paywall.redeemSubtitle")
              : t("paywall.redeemRequiresAuth")}
          </Text>
          <AppTextInput
            autoCapitalize="characters"
            editable={!isRedeeming}
            label={t("paywall.redeemInputLabel")}
            onChangeText={setSchoolCodeValue}
            placeholder={t("paywall.redeemInputPlaceholder")}
            value={schoolCode}
          />
          {redeemFeedback ? (
            <Text
              style={[
                styles.feedbackText,
                redeemFeedback.kind === "error"
                  ? styles.feedbackError
                  : styles.feedbackSuccess,
              ]}
            >
              {redeemFeedback.message}
            </Text>
          ) : entitlementStatus === "loading" ? (
            <Text style={styles.helperText}>
              {t("paywall.redeemLoading")}
            </Text>
          ) : null}
          <View style={{ gap: 10, marginTop: 12 }}>
            <AppButton
              variant="secondary"
              label={t(
                isRedeeming ? "paywall.redeemCtaLoading" : "paywall.redeemCta"
              )}
              onPress={() => void handleRedeemSchoolCode()}
              disabled={isRedeeming}
            />
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isAppFeature(value: string | undefined): value is AppFeature {
  return APP_FEATURES.includes(value as AppFeature);
}

function pickRecommendedPackage(
  packages: ReturnType<typeof useRevenueCatOfferings>
) {
  return (
    packages.find((item) => item.packageType === "MONTHLY") ??
    packages.find((item) => item.packageType === "THREE_MONTH") ??
    packages[0] ??
    null
  );
}

function getPackageKey(item: {
  identifier: string;
  offeringIdentifier: string;
}) {
  return `${item.offeringIdentifier}:${item.identifier}`;
}

function getPaywallSubtitle({
  hasPremiumAccess,
  purchaseAccess,
  schoolAccess,
  t,
}: {
  hasPremiumAccess: boolean;
  purchaseAccess: ReturnType<typeof usePurchaseAccess>;
  schoolAccess: ReturnType<typeof useSchoolAccess>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (schoolAccess) {
    return t("paywall.activeSubtitleSchool", {
      school: schoolAccess.schoolName ?? t("paywall.schoolPartnerFallback"),
    });
  }

  if (purchaseAccess) {
    return t("paywall.activeSubtitlePurchase");
  }

  if (hasPremiumAccess) {
    return t("paywall.activeSubtitleGeneric");
  }

  return t("paywall.subtitle");
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    cardBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    featureBody: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    featureTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 6,
    },
    feedbackError: {
      color: "#A44E37",
    },
    feedbackSuccess: {
      color: "#2F6B5F",
    },
    feedbackText: {
      fontSize: 13,
      lineHeight: 20,
      marginTop: 10,
    },
    helperText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 10,
    },
    offerBadge: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 18,
      marginTop: 8,
      textTransform: "uppercase",
    },
    offerCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderSoft,
      borderRadius: theme.radius.large,
      borderWidth: 1,
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    offerCardPressed: {
      opacity: 0.86,
    },
    offerCardSelected: {
      backgroundColor: theme.colors.cardAccent,
      borderColor: theme.colors.accentMuted,
    },
    offerGrid: {
      gap: 10,
      marginTop: 14,
    },
    offerMeta: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    offerPrice: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
      lineHeight: 24,
    },
    offerTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 22,
    },
    sectionLabel: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 8,
      textTransform: "uppercase",
    },
  });

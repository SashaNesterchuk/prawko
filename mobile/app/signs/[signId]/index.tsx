import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { SignDetailNav } from "../../../src/components/shell/SignDetailNav";
import { SignDetailToolbar } from "../../../src/components/shell/SignDetailToolbar";
import { SignStatusBadge } from "../../../src/components/shell/SignStatusBadge";
import {
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../../src/portable-ui";
import {
  getRoadSignById,
  getRoadSignCategory,
  getRoadSignsByCategory,
} from "../../../src/features/road-signs/catalog";
import {
  getSignDescription,
  getSignDisplayName,
  hasSignPracticeContent,
} from "../../../src/features/road-signs/content/registry";
import { SignImage } from "../../../src/features/road-signs/SignImage";
import { getSignLearningStatus } from "../../../src/features/road-signs/sign-progress";

export default function SignDetailScreen() {
  const { t, i18n } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const spacing = useResponsiveSpacing();
  const styles = useStyles({ safeBottom });
  const { signId } = useLocalSearchParams<{ signId: string }>();
  const sign = useMemo(
    () => (signId ? getRoadSignById(signId) : undefined),
    [signId]
  );
  const category = useMemo(
    () => (sign ? getRoadSignCategory(sign.categoryId) : undefined),
    [sign]
  );

  const categorySigns = useMemo(
    () => (sign ? getRoadSignsByCategory(sign.categoryId) : []),
    [sign]
  );

  const currentIndex = useMemo(
    () => categorySigns.findIndex((item) => item.id === sign?.id),
    [categorySigns, sign]
  );

  const displayName = sign
    ? getSignDisplayName(sign.id, i18n.language, sign.code)
    : "";
  const description = sign
    ? getSignDescription(sign.id, i18n.language) ??
      t("signs.descriptionBody", {
        category: category
          ? t(`signs.categories.${category.id}.title`)
          : "",
        code: sign.code,
      })
    : "";

  const learningStatus = sign ? getSignLearningStatus(sign.id) : "new";
  const statusLabel =
    learningStatus === "mastered"
      ? t("signs.statusMastered")
      : learningStatus === "wrong"
        ? t("signs.statusWrong")
        : t("signs.statusNew");

  const goToSignAt = (index: number) => {
    const target = categorySigns[index];

    if (!target) {
      return;
    }

    router.replace({
      pathname: "/signs/[signId]",
      params: { signId: target.id },
    });
  };

  if (!sign) {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar style="dark" />
          <View style={styles.missingState}>
            <Text style={styles.missingTitle}>
              {t("signs.notFoundTitle")}
            </Text>
          </View>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex >= 0 && currentIndex < categorySigns.length - 1;

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <SignDetailToolbar
          code={sign.code}
          categoryLabel={
            category ? t(`signs.categories.${category.id}.title`) : ""
          }
          currentIndex={Math.max(currentIndex, 0)}
          totalCount={categorySigns.length}
          closeLabel={t("common.close", { defaultValue: "Close" })}
          onClose={() => router.back()}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.imageWrap}>
            <SignImage sign={sign} size={spacing.exact(220)} />
          </View>

          {hasSignPracticeContent(sign.id) ? (
            <SignStatusBadge status={learningStatus} label={statusLabel} />
          ) : null}

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.description}>{description}</Text>
        </ScrollView>

        <View style={styles.footer}>
          <SignDetailNav
            backLabel={t("signs.back")}
            forwardLabel={t("signs.forward")}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={() => goToSignAt(currentIndex - 1)}
            onForward={() => goToSignAt(currentIndex + 1)}
          />
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.exact(24) + safeBottom,
      gap: spacing.lg,
    },
    imageWrap: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: spacing.exact(240),
    },
    name: {
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontWeight: "700",
      letterSpacing: -0.48,
      color: colors.ink,
    },
    description: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      color: colors.inkSecondary,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg + safeBottom,
    },
    missingState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    missingTitle: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      color: colors.ink,
      textAlign: "center",
    },
  }));
}

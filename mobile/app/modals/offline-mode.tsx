import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { ProgressBar } from "../../src/components/shell/ProgressBar";
import { LoadingStateView } from "../../src/components/shell/StateViews";
import {
  clearOfflinePack,
  downloadOfflinePack,
  estimateOfflinePackDownloadBytes,
  formatOfflineBytes,
  getOfflinePackErrorMessage,
  isOfflinePackStorageLow,
  type OfflinePackSnapshot,
  type OfflinePackTransfer,
  readOfflinePackSnapshot,
  type OfflinePackError,
} from "../../src/features/offline/offline-pack";
import { getQuestionBank } from "../../src/features/questions/question-bank";
import {
  getFontFamily,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useHasPlusAccess } from "../../src/state/entitlements";
import { useAppShellStore } from "../../src/state/app-shell";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogStatus,
  useQuestionCatalogVersion,
} from "../../src/state/question-catalog";

type FeedbackState =
  | {
      kind: "error" | "info";
      message: string;
    }
  | null;

export default function OfflineModeModalScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { accents } = useTheme();
  const isFocused = useIsFocused();
  const hasPlusAccess = useHasPlusAccess();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const questionCatalogResolved = useQuestionCatalogResolved();
  const questionCatalogStatus = useQuestionCatalogStatus();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const [snapshot, setSnapshot] = useState<OfflinePackSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const canUseCurrentCatalog =
    questionCatalogResolved &&
    (questionCatalogStatus === "remote" || questionCatalogStatus === "offline");

  const refreshSnapshot = useCallback(async () => {
    const questionBank = canUseCurrentCatalog ? getQuestionBank() : null;
    const nextSnapshot = await readOfflinePackSnapshot({
      currentCategory: preferredCategory,
      questionBank,
    });

    setSnapshot(nextSnapshot);
  }, [canUseCurrentCatalog, preferredCategory]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void refreshSnapshot()
      .catch((error) => {
        if (!cancelled) {
          setFeedback({
            kind: "error",
            message: getOfflinePackErrorMessage(error),
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isFocused,
    preferredCategory,
    questionCatalogResolved,
    questionCatalogStatus,
    questionCatalogVersion,
    refreshSnapshot,
  ]);

  const handlePrimaryAction = async () => {
    if (!hasPlusAccess) {
      router.navigate("/paywall");
      return;
    }

    if (!canUseCurrentCatalog) {
      setFeedback({
        kind: "info",
        message: t("offlineMode.catalogUnavailableBody"),
      });
      return;
    }

    setIsWorking(true);
    setFeedback(null);

    try {
      const questionBank = getQuestionBank();
      await downloadOfflinePack({
        category: preferredCategory,
        questionBank,
        onProgress: (transfer) => {
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  transfer,
                }
              : current
          );
        },
      });
      await refreshSnapshot();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: mapOfflineActionError(error, t),
      });
      await refreshSnapshot();
    } finally {
      setIsWorking(false);
    }
  };

  const handleClearPack = async () => {
    setIsWorking(true);
    setFeedback(null);

    try {
      await clearOfflinePack();
      await refreshSnapshot();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getOfflinePackErrorMessage(error),
      });
    } finally {
      setIsWorking(false);
    }
  };

  if (isLoading && !snapshot) {
    return (
      <AppScreen scroll={false}>
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("offlineMode.subtitle", {
            category: preferredCategory,
          })}
        />
      </AppScreen>
    );
  }

  const plan = snapshot?.plan ?? null;
  const readyPack = snapshot?.readyPack ?? null;
  const transfer = snapshot?.transfer ?? null;
  const progressPercent = getTransferPercent(transfer);
  const primaryLabel = getPrimaryActionLabel({
    hasStoredData: snapshot?.hasStoredData ?? false,
    hasPlusAccess,
    isWorking,
    readyPackMatchesCurrentCatalog:
      snapshot?.readyPackMatchesCurrentCatalog ?? null,
    readyPackMatchesCurrentCategory:
      snapshot?.readyPackMatchesCurrentCategory ?? false,
    t,
    transfer,
  });
  const showRemoveAction =
    snapshot?.hasStoredData ?? Boolean(readyPack || transfer);
  const packQuestionCount = plan?.questionCount ?? readyPack?.questionCount ?? 0;
  const packAssetCount = plan?.assetCount ?? readyPack?.assetCount ?? 0;
  const packBytes =
    plan ? estimateOfflinePackDownloadBytes(plan) : readyPack?.totalBytes ?? 0;
  const freeSpace = snapshot?.availableDiskSpace ?? null;
  const storageLooksLow = isOfflinePackStorageLow(freeSpace, plan);
  const freeSpaceLabel =
    freeSpace === null
      ? t("offlineMode.storageUnknown")
      : formatOfflineBytes(freeSpace);

  return (
    <AppScreen
      testID="screen-offline-mode"
      title={t("offlineMode.title")}
      subtitle={t("offlineMode.subtitle", {
        category: preferredCategory,
      })}
      footer={
        <View style={styles.footerStack}>
          <AppButton
            disabled={isWorking}
            label={primaryLabel}
            testID="offline-mode-primary-action"
            onPress={() => void handlePrimaryAction()}
          />
          {showRemoveAction ? (
            <AppButton
              disabled={isWorking}
              testID="offline-mode-remove-action"
              variant="secondary"
              label={t("offlineMode.removeCta")}
              onPress={() => void handleClearPack()}
            />
          ) : null}
          <AppButton
            variant="ghost"
            label={t("common.close")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      {!hasPlusAccess ? (
        <AppCard accent>
          <Text style={styles.sectionLabel}>
            {t("offlineMode.plusRequiredTitle")}
          </Text>
          <Text style={styles.bodyText}>{t("offlineMode.plusRequiredBody")}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionLabel}>{t("offlineMode.statusTitle")}</Text>
        <Text style={styles.bodyText}>
          {getOfflineStatusBody({
            hasStoredData: snapshot?.hasStoredData ?? false,
            preferredCategory,
            readyPackCategory: readyPack?.category ?? null,
            readyPackMatchesCurrentCatalog:
              snapshot?.readyPackMatchesCurrentCatalog ?? null,
            readyPackMatchesCurrentCategory:
              snapshot?.readyPackMatchesCurrentCategory ?? false,
            t,
            transfer,
          })}
        </Text>

        <View style={styles.statsStack}>
          <Text style={styles.statLine}>
            {t("offlineMode.questionsLabel")}: {packQuestionCount}
          </Text>
          <Text style={styles.statLine}>
            {t("offlineMode.assetsLabel")}: {packAssetCount}
          </Text>
          <Text style={styles.statLine}>
            {t("offlineMode.requiredSpaceLabel")}: {formatOfflineBytes(packBytes)}
          </Text>
          <Text style={styles.statLine}>
            {t("offlineMode.freeSpaceLabel")}: {freeSpaceLabel}
          </Text>
          {readyPack?.completedAt ? (
            <Text style={styles.statLine}>
              {t("offlineMode.lastUpdated", {
                date: readyPack.completedAt.slice(0, 10),
              })}
            </Text>
          ) : null}
        </View>

        {transfer ? (
          <View style={styles.progressBlock}>
            <ProgressBar progress={progressPercent} />
            <Text style={styles.progressText}>
              {t("offlineMode.downloadedProgress", {
                done: transfer.downloadedAssetCount,
                total: transfer.targetAssetCount,
              })}
            </Text>
            <Text style={styles.progressText}>
              {formatOfflineBytes(transfer.downloadedBytes)} /{" "}
              {formatOfflineBytes(transfer.targetTotalBytes)}
            </Text>
            {transfer.status === "error" && transfer.lastError ? (
              <Text style={[styles.progressText, styles.errorText]}>
                {t("offlineMode.transferError", {
                  message: transfer.lastError,
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </AppCard>

      {storageLooksLow ? (
        <AppCard accent>
          <Text style={[styles.sectionLabel, { color: accents.red.ink }]}>
            {t("offlineMode.storageLowWarning")}
          </Text>
        </AppCard>
      ) : null}

      {!canUseCurrentCatalog && !readyPack ? (
        <AppCard accent>
          <Text style={styles.sectionLabel}>
            {t("offlineMode.catalogUnavailableTitle")}
          </Text>
          <Text style={styles.bodyText}>{t("offlineMode.catalogUnavailableBody")}</Text>
        </AppCard>
      ) : null}

      {readyPack &&
      readyPack.category !== preferredCategory &&
      hasPlusAccess &&
      canUseCurrentCatalog ? (
        <AppCard accent>
          <Text style={styles.sectionLabel}>
            {t("offlineMode.replaceCategoryNote")}
          </Text>
        </AppCard>
      ) : null}

      {feedback ? (
        <AppCard accent={feedback.kind === "info"}>
          <Text
            style={[
              styles.bodyText,
              feedback.kind === "error" ? styles.errorText : null,
            ]}
          >
            {feedback.message}
          </Text>
        </AppCard>
      ) : null}
    </AppScreen>
  );
}

function getTransferPercent(transfer: OfflinePackTransfer | null) {
  if (!transfer) {
    return 0;
  }

  if (transfer.unknownSizeAssetCount > 0 && transfer.targetAssetCount > 0) {
    return Math.round(
      (transfer.downloadedAssetCount / Math.max(transfer.targetAssetCount, 1)) *
        100
    );
  }

  if (transfer.targetTotalBytes <= 0) {
    if (transfer.targetAssetCount <= 0) {
      return 0;
    }

    return Math.round(
      (transfer.downloadedAssetCount / Math.max(transfer.targetAssetCount, 1)) *
        100
    );
  }

  return Math.round(
    (transfer.downloadedBytes / Math.max(transfer.targetTotalBytes, 1)) * 100
  );
}

function getPrimaryActionLabel({
  hasStoredData,
  hasPlusAccess,
  isWorking,
  readyPackMatchesCurrentCatalog,
  readyPackMatchesCurrentCategory,
  t,
  transfer,
}: {
  hasStoredData: boolean;
  hasPlusAccess: boolean;
  isWorking: boolean;
  readyPackMatchesCurrentCatalog: boolean | null;
  readyPackMatchesCurrentCategory: boolean;
  t: ReturnType<typeof useTranslation>["t"];
  transfer: OfflinePackTransfer | null;
}) {
  if (!hasPlusAccess) {
    return t("offlineMode.openPaywall");
  }

  if (isWorking || transfer?.status === "downloading") {
    return t("offlineMode.downloadingBadge");
  }

  if (transfer?.status === "error") {
    return t("offlineMode.resumeCta");
  }

  if (hasStoredData && !readyPackMatchesCurrentCategory) {
    return t("offlineMode.repairCta");
  }

  if (readyPackMatchesCurrentCategory && readyPackMatchesCurrentCatalog !== false) {
    return t("offlineMode.updateCta");
  }

  if (readyPackMatchesCurrentCategory && readyPackMatchesCurrentCatalog === false) {
    return t("offlineMode.updateCta");
  }

  return t("offlineMode.downloadCta");
}

function getOfflineStatusBody({
  hasStoredData,
  preferredCategory,
  readyPackCategory,
  readyPackMatchesCurrentCatalog,
  readyPackMatchesCurrentCategory,
  t,
  transfer,
}: {
  hasStoredData: boolean;
  preferredCategory: string;
  readyPackCategory: string | null;
  readyPackMatchesCurrentCatalog: boolean | null;
  readyPackMatchesCurrentCategory: boolean;
  t: ReturnType<typeof useTranslation>["t"];
  transfer: OfflinePackTransfer | null;
}) {
  if (transfer?.status === "downloading") {
    return t("offlineMode.statusDownloading");
  }

  if (transfer?.status === "error") {
    return t("offlineMode.statusInterrupted");
  }

  if (readyPackMatchesCurrentCategory && readyPackMatchesCurrentCatalog === false) {
    return t("offlineMode.statusUpdateAvailable");
  }

  if (readyPackMatchesCurrentCategory) {
    return t("offlineMode.statusReady");
  }

  if (readyPackCategory) {
    return t("offlineMode.statusOtherCategory", {
      category: readyPackCategory,
    });
  }

  if (hasStoredData) {
    return t("offlineMode.statusNeedsRepair");
  }

  return t("offlineMode.statusNotDownloaded", {
    category: preferredCategory,
  });
}

function mapOfflineActionError(
  error: unknown,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const offlineError = error as OfflinePackError;

  if (offlineError?.code === "storage_low") {
    return t("offlineMode.storageLowWarning");
  }

  if (offlineError?.code === "connectivity_required") {
    return t("offlineMode.internetRequiredBody");
  }

  if (offlineError?.code === "catalog_unavailable") {
    return t("offlineMode.catalogUnavailableBody");
  }

  return getOfflinePackErrorMessage(error);
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    sectionLabel: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("bold"),
      color: colors.textPrimary,
      marginBottom: spacing.exact(8),
    },
    bodyText: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
      color: colors.textSecondary,
    },
    statsStack: {
      gap: spacing.exact(6),
      marginTop: spacing.exact(14),
    },
    statLine: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.textPrimary,
    },
    progressBlock: {
      gap: spacing.exact(8),
      marginTop: spacing.exact(14),
    },
    progressText: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: colors.textSecondary,
    },
    errorText: {
      color: colors.warningInk,
    },
  }));
}

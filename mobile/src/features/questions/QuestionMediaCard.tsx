import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

import { AppButton } from "../../components/shell/AppButton";
import { AppCard } from "../../components/shell/AppCard";
import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { useTheme } from "../../providers/ThemeProvider";
import {
  buildQuestionMediaViewerParams,
  getQuestionDeliveryAssetUrl,
  getQuestionMediaPjmSummary,
  getQuestionMediaPreviewUrl,
} from "./question-media";
import type { QuestionMedia } from "./types";

export function QuestionMediaCard({
  locale,
  media,
}: {
  locale: SupportedLocale;
  media: QuestionMedia;
}) {
  const { t } = useTranslation();
  const { captureError } = useErrorLogger();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [previewFailed, setPreviewFailed] = useState(false);
  const didLogPreviewFailureRef = useRef(false);

  const previewUrl = getQuestionMediaPreviewUrl(media);
  const assetUrl = getQuestionDeliveryAssetUrl(media.asset);
  const pjmSummary = getQuestionMediaPjmSummary(media);
  const primaryLabel =
    media.type === "image"
      ? t("question.media.primaryImageLabel")
      : t("question.media.primaryVideoLabel");
  const primaryViewerParams = buildQuestionMediaViewerParams({
    asset: media.asset,
    label: primaryLabel,
  });
  const pjmActions = useMemo(() => buildPjmActions(media, t), [media, t]);
  const hasPreview = Boolean(previewUrl) && !previewFailed;

  const openViewer = (asset: QuestionDeliveryAsset, label: string) => {
    router.push({
      pathname: "/modals/media-viewer",
      params: buildQuestionMediaViewerParams({
        asset,
        label,
      }),
    });
  };

  return (
    <AppCard>
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <Text style={styles.mediaTitle}>{primaryLabel}</Text>
          <Text style={styles.mediaSubtitle}>
            {media.type === "video"
              ? t("question.media.videoHint")
              : t("question.media.tapToOpen")}
          </Text>
        </View>
        <View style={styles.pills}>
          <MediaPill label={t(`question.mediaTypes.${media.type}`)} />
          {pjmSummary.hasQuestionTrack || pjmSummary.answerTrackCount > 0 ? (
            <MediaPill label={t("question.media.pjmLabel")} accent />
          ) : null}
        </View>
      </View>

      {hasPreview ? (
        <Pressable
          accessibilityRole="button"
          disabled={!assetUrl}
          onPress={() => openViewer(media.asset, primaryLabel)}
          style={({ pressed }) => [
            styles.previewPressable,
            pressed ? styles.previewPressed : null,
          ]}
        >
          <Image
            source={{ uri: previewUrl ?? undefined }}
            resizeMode="cover"
            style={styles.preview}
            onError={() => {
              setPreviewFailed(true);

              if (didLogPreviewFailureRef.current) {
                return;
              }

              didLogPreviewFailureRef.current = true;
              captureError({
                area: "question_media",
                eventName: "question_media_preview_failed",
                message: "Question media preview failed to load.",
                metadata: {
                  locale,
                  media_key: media.asset.mediaKey,
                  media_type: media.type,
                  source_kind: media.asset.sourceKind,
                  storage_bucket: media.asset.storageBucket,
                  storage_path: media.asset.storagePath,
                },
                severity: "warning",
              });
            }}
            accessibilityLabel={t("question.media.previewAccessibility", {
              type: t(`question.mediaTypes.${media.type}`),
              locale: locale.toUpperCase(),
            })}
          />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewOverlayLabel}>
              {t("question.media.openLabel", {
                label: primaryLabel,
              })}
            </Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.previewFallback}>
          <Text style={styles.previewFallbackTitle}>
            {t("question.media.previewUnavailable")}
          </Text>
          <Text style={styles.previewFallbackBody}>
            {previewUrl
              ? t("question.media.previewLoadFailed")
              : t("question.media.previewNotConfigured")}
          </Text>
        </View>
      )}

      <View style={styles.actionStack}>
        <AppButton
          label={t("question.media.openLabel", {
            label: primaryLabel,
          })}
          onPress={() => openViewer(media.asset, primaryLabel)}
          disabled={!assetUrl}
        />
      </View>

      {pjmActions.length ? (
        <View style={styles.pjmSection}>
          <Text style={styles.pjmTitle}>{t("question.media.pjmTracksTitle")}</Text>
          <Text style={styles.pjmBody}>{t("question.media.pjmTracksBody")}</Text>
          <View style={styles.pjmActionStack}>
            {pjmActions.map((action) => (
              <AppButton
                key={`${action.label}:${action.asset.mediaKey}`}
                label={t("question.media.openLabel", {
                  label: action.label,
                })}
                onPress={() => openViewer(action.asset, action.label)}
                variant="secondary"
                disabled={!getQuestionDeliveryAssetUrl(action.asset)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </AppCard>
  );
}

function buildPjmActions(
  media: QuestionMedia,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const actions: Array<{
    asset: QuestionDeliveryAsset;
    label: string;
  }> = [];

  if (media.pjm?.questionAsset) {
    actions.push({
      asset: media.pjm.questionAsset,
      label: t("question.media.pjmQuestionLabel"),
    });
  }

  const answerAssets = media.pjm?.answerAssets ?? {};

  for (const answerSlot of ["A", "B", "C"] as const) {
    const asset = answerAssets[answerSlot];

    if (!asset) {
      continue;
    }

    actions.push({
      asset,
      label: t("question.media.pjmAnswerLabel", {
        answer: answerSlot,
      }),
    });
  }

  return actions;
}

function MediaPill({
  accent = false,
  label,
}: {
  accent?: boolean;
  label: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={[styles.pill, accent ? styles.pillAccent : null]}>
      <Text style={[styles.pillText, accent ? styles.pillTextAccent : null]}>
        {label}
      </Text>
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    actionStack: {
      gap: 10,
    },
    headerMeta: {
      flex: 1,
      gap: 4,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    mediaSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    mediaTitle: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800",
      color: theme.colors.accent,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.cardMuted,
    },
    pillAccent: {
      backgroundColor: "#DCEBE5",
    },
    pillText: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "800",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    pillTextAccent: {
      color: theme.colors.accent,
    },
    pills: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    pjmActionStack: {
      gap: 10,
      marginTop: 12,
    },
    pjmBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    pjmSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSoft,
    },
    pjmTitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "800",
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    preview: {
      width: "100%",
      height: 220,
      borderRadius: theme.radius.large,
      backgroundColor: theme.colors.cardMuted,
    },
    previewFallback: {
      borderRadius: theme.radius.large,
      backgroundColor: theme.colors.cardMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      minHeight: 140,
      justifyContent: "center",
      padding: 18,
      marginBottom: 14,
      gap: 6,
    },
    previewFallbackBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    previewFallbackTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    previewOverlay: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: "rgba(24, 32, 24, 0.72)",
    },
    previewOverlayLabel: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      color: "#F8F6F0",
      textAlign: "center",
    },
    previewPressed: {
      opacity: 0.92,
    },
    previewPressable: {
      marginBottom: 14,
      borderRadius: theme.radius.large,
      overflow: "hidden",
    },
  });

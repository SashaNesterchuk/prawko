import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { useAppShellStore } from "../../state/app-shell";
import { useTheme } from "../../providers/ThemeProvider";
import {
  buildQuestionMediaViewerParams,
  getQuestionDeliveryAssetUrl,
  getQuestionMediaPreviewUrl,
} from "./question-media";
import type { QuestionMedia } from "./types";

const MEDIA_ASPECT_RATIO = 4 / 3;

export function QuestionMediaCard({
  locale,
  media,
}: {
  locale: SupportedLocale;
  media: QuestionMedia;
}) {
  const { t } = useTranslation();
  const { captureError } = useErrorLogger();
  const enablePjmTracks = useAppShellStore((state) => state.enablePjmTracks);
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(
    () => getStyles(theme, windowWidth),
    [theme, windowWidth]
  );
  const [previewFailed, setPreviewFailed] = useState(false);
  const didLogPreviewFailureRef = useRef(false);

  const previewUrl = getQuestionMediaPreviewUrl(media);
  const assetUrl = getQuestionDeliveryAssetUrl(media.asset);
  const primaryLabel =
    media.type === "image"
      ? t("question.media.primaryImageLabel")
      : t("question.media.primaryVideoLabel");
  const pjmActions = useMemo(
    () => (enablePjmTracks ? buildPjmActions(media, t) : []),
    [enablePjmTracks, media, t]
  );
  const hasPreview = Boolean(previewUrl) && !previewFailed;
  const isVideo = media.type === "video";

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
    <View style={styles.root}>
      {hasPreview ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("question.media.openPreviewAccessibility", {
            type: t(`question.mediaTypes.${media.type}`),
          })}
          disabled={!assetUrl}
          onPress={() => openViewer(media.asset, primaryLabel)}
          style={({ pressed }) => [
            styles.mediaFrame,
            pressed ? styles.mediaPressed : null,
          ]}
        >
          <Image
            source={{ uri: previewUrl ?? undefined }}
            resizeMode="contain"
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
          />

          {isVideo ? (
            <View pointerEvents="none" style={styles.playBadge}>
              <View style={styles.playTriangle} />
            </View>
          ) : null}

          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.openHintBadge}
          >
            <ExpandMediaIcon />
          </View>

          {enablePjmTracks && pjmActions.length > 0 ? (
            <View style={styles.pjmOverlay}>
              {pjmActions.map((action) => {
                const isEnabled = Boolean(getQuestionDeliveryAssetUrl(action.asset));

                return (
                  <Pressable
                    key={`${action.shortLabel}:${action.asset.mediaKey}`}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    disabled={!isEnabled}
                    onPress={(event) => {
                      event.stopPropagation();
                      openViewer(action.asset, action.label);
                    }}
                    style={({ pressed }) => [
                      styles.pjmIconButton,
                      !isEnabled ? styles.pjmIconButtonDisabled : null,
                      pressed && isEnabled ? styles.pjmIconButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.pjmIconGlyph}>{action.shortLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      ) : (
        <View style={[styles.mediaFrame, styles.previewFallback]}>
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
    </View>
  );
}

function ExpandMediaIcon() {
  const cornerStyle = {
    position: "absolute" as const,
    width: 7,
    height: 7,
    borderColor: "#F8F6F0",
  };

  return (
    <View style={{ width: 18, height: 18 }}>
      <View
        style={{
          ...cornerStyle,
          top: 0,
          left: 0,
          borderTopWidth: 2,
          borderLeftWidth: 2,
        }}
      />
      <View
        style={{
          ...cornerStyle,
          top: 0,
          right: 0,
          borderTopWidth: 2,
          borderRightWidth: 2,
        }}
      />
      <View
        style={{
          ...cornerStyle,
          bottom: 0,
          left: 0,
          borderBottomWidth: 2,
          borderLeftWidth: 2,
        }}
      />
      <View
        style={{
          ...cornerStyle,
          bottom: 0,
          right: 0,
          borderBottomWidth: 2,
          borderRightWidth: 2,
        }}
      />
    </View>
  );
}

function buildPjmActions(
  media: QuestionMedia,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const actions: Array<{
    asset: QuestionDeliveryAsset;
    label: string;
    shortLabel: string;
  }> = [];

  if (media.pjm?.questionAsset) {
    actions.push({
      asset: media.pjm.questionAsset,
      label: t("question.media.pjmQuestionLabel"),
      shortLabel: "PJM",
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
      shortLabel: answerSlot,
    });
  }

  return actions;
}

const getStyles = (
  theme: ReturnType<typeof useTheme>,
  windowWidth: number
) => {
  const mediaHeight = Math.round(windowWidth / MEDIA_ASPECT_RATIO);

  return StyleSheet.create({
    mediaFrame: {
      width: windowWidth,
      alignSelf: "center",
      height: mediaHeight,
      borderRadius: 0,
      overflow: "hidden",
      backgroundColor: theme.colors.cardMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    mediaPressed: {
      opacity: 0.96,
    },
    openHintBadge: {
      position: "absolute",
      top: 10,
      left: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(24, 32, 24, 0.78)",
      borderWidth: 1,
      borderColor: "rgba(248, 246, 240, 0.35)",
    },
    playBadge: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 56,
      height: 56,
      marginTop: -28,
      marginLeft: -28,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(24, 32, 24, 0.55)",
    },
    playTriangle: {
      width: 0,
      height: 0,
      marginLeft: 4,
      borderTopWidth: 11,
      borderBottomWidth: 11,
      borderLeftWidth: 18,
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
      borderLeftColor: "#F8F6F0",
    },
    pjmIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(24, 32, 24, 0.78)",
      borderWidth: 1,
      borderColor: "rgba(248, 246, 240, 0.35)",
    },
    pjmIconButtonDisabled: {
      opacity: 0.35,
    },
    pjmIconButtonPressed: {
      opacity: 0.88,
    },
    pjmIconGlyph: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      color: "#F8F6F0",
      letterSpacing: 0.4,
    },
    pjmOverlay: {
      position: "absolute",
      right: 10,
      bottom: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 8,
      maxWidth: "70%",
    },
    preview: {
      width: "100%",
      height: "100%",
    },
    previewFallback: {
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      gap: 6,
    },
    previewFallbackBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    previewFallbackTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      textAlign: "center",
    },
    root: {
      width: windowWidth,
      alignSelf: "center",
    },
  });
};

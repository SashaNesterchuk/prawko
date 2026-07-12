import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import {
  getQuestionMediaViewerAssetUrl,
  getQuestionMediaViewerPreviewUrl,
  type QuestionMediaViewerParams,
} from "../../src/features/questions/question-media";
import { useErrorLogger } from "../../src/providers/ErrorLoggingProvider";
import { useTheme } from "../../src/providers/ThemeProvider";

export default function MediaViewerModalScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const { captureError } = useErrorLogger();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const styles = useStyles({ windowHeight, windowWidth });
  const params = useLocalSearchParams<{
    label?: string | string[];
    mediaType?: string | string[];
    posterStorageBucket?: string | string[];
    posterStoragePath?: string | string[];
    storageBucket?: string | string[];
    storagePath?: string | string[];
  }>();
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const viewer = useMemo(() => parseViewerParams(params), [params]);
  const previewUrl = getQuestionMediaViewerPreviewUrl(viewer);
  const assetUrl = getQuestionMediaViewerAssetUrl(viewer);
  const hasPreview = Boolean(previewUrl) && !previewFailed;
  const isVideo = viewer?.mediaType === "video";
  const showVideoPlaceholder = Boolean(viewer) && isVideo && (!previewUrl || previewFailed);
  const title = viewer?.label ?? t("question.media.viewerTitle");
  const subtitle =
    viewer?.mediaType === "video"
      ? t("question.media.viewerVideoBody")
      : t("question.media.viewerImageBody");
  const closeIconSize = responsiveFont(22);
  const refreshIconSize = responsiveFont(18);
  const playIconSize = responsiveFont(32);

  const handleOpenExternally = async () => {
    if (!viewer || !assetUrl) {
      return;
    }

    try {
      await Linking.openURL(assetUrl);
    } catch (error) {
      captureError({
        area: "question_media",
        error,
        eventName: "question_media_external_open_failed",
        message: "Failed to open question media in the system player.",
        metadata: {
          label: viewer.label,
          media_type: viewer.mediaType,
          storage_bucket: viewer.storageBucket,
          storage_path: viewer.storagePath,
        },
      });
    }
  };

  const retry = () => {
    setPreviewFailed(false);
    setIsLoaded(false);
    setReloadKey((value) => value + 1);
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="close" size={closeIconSize} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.stage}>
          {!viewer ? (
            <View style={[styles.frame, styles.errorFrame]}>
              <Text style={styles.errorTitle}>
                {t("question.media.previewUnavailable")}
              </Text>
              <Text style={styles.errorBody}>
                {t("question.media.viewerMissingAsset")}
              </Text>
            </View>
          ) : showVideoPlaceholder ? (
            <View style={[styles.frame, styles.videoPlaceholderFrame]}>
              <Text style={styles.videoPlaceholderTitle}>{title}</Text>
              <Text style={styles.videoPlaceholderBody}>
                {t("question.media.tapToOpen")}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("question.media.viewerOpenExternal")}
                disabled={!assetUrl}
                onPress={() => void handleOpenExternally()}
                style={({ pressed }) => [
                  styles.playBadge,
                  pressed ? styles.pressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={colors.textPrimary}
                  name="play"
                  size={playIconSize}
                />
              </Pressable>
            </View>
          ) : !hasPreview ? (
            <View style={[styles.frame, styles.errorFrame]}>
              <Text style={styles.errorTitle}>
                {t("question.media.mediaUnavailableTitle")}
              </Text>
              <Text style={styles.errorBody}>
                {previewUrl
                  ? t("question.media.viewerLoadFailed")
                  : t("question.media.viewerMissingAsset")}
              </Text>
              {previewUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={retry}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <MaterialCommunityIcons
                    color={colors.textSecondary}
                    name="refresh"
                    size={refreshIconSize}
                  />
                  <Text style={styles.retryLabel}>
                    {t("question.media.retry")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.frame}>
              {!isLoaded ? (
                <View pointerEvents="none" style={styles.skeleton} />
              ) : null}

              <Image
                key={reloadKey}
                resizeMode={isVideo ? "cover" : "contain"}
                source={{ uri: previewUrl ?? undefined }}
                style={styles.preview}
                onError={() => setPreviewFailed(true)}
                onLoad={() => setIsLoaded(true)}
              />

              {isVideo ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("question.media.viewerOpenExternal")}
                  disabled={!assetUrl}
                  onPress={() => void handleOpenExternally()}
                  style={({ pressed }) => [
                    styles.playBadge,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <MaterialCommunityIcons
                    color={colors.textPrimary}
                    name="play"
                    size={playIconSize}
                  />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {viewer && isVideo ? (
            <Pressable
              accessibilityRole="button"
              disabled={!assetUrl}
              onPress={() => void handleOpenExternally()}
              style={({ pressed }) => [
                styles.primaryButton,
                !assetUrl ? styles.primaryButtonDisabled : null,
                pressed && assetUrl ? styles.pressed : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {t("question.media.viewerOpenExternal")}
              </Text>
            </Pressable>
          ) : null}

          {isVideo ? (
            <Text style={styles.videoHint}>{t("question.media.videoHint")}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function parseViewerParams(input: {
  label?: string | string[];
  mediaType?: string | string[];
  posterStorageBucket?: string | string[];
  posterStoragePath?: string | string[];
  storageBucket?: string | string[];
  storagePath?: string | string[];
}): QuestionMediaViewerParams | null {
  const label = getSingleParam(input.label)?.trim();
  const mediaType = getSingleParam(input.mediaType);
  const storageBucket = getSingleParam(input.storageBucket)?.trim();
  const storagePath = getSingleParam(input.storagePath)?.trim();
  const posterStorageBucket = getSingleParam(input.posterStorageBucket)?.trim();
  const posterStoragePath = getSingleParam(input.posterStoragePath)?.trim();

  if (
    !label ||
    (mediaType !== "image" && mediaType !== "video") ||
    !storageBucket ||
    !storagePath
  ) {
    return null;
  }

  return {
    label,
    mediaType,
    posterStorageBucket: posterStorageBucket || undefined,
    posterStoragePath: posterStoragePath || undefined,
    storageBucket,
    storagePath,
  };
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function useStyles({
  windowHeight,
  windowWidth,
}: {
  windowHeight: number;
  windowWidth: number;
}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => {
    const horizontalPadding = spacing.exact(24);
    const frameHeight = Math.min(
      Math.max(windowHeight * 0.56, spacing.exact(280)),
      spacing.exact(520)
    );

    return {
      safeArea: {
        flex: 1,
      },
      header: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.exact(8),
        paddingHorizontal: horizontalPadding,
        paddingTop: spacing.exact(8),
        paddingBottom: spacing.exact(16),
      },
      headerButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
        backgroundColor: colors.surface,
      },
      headerCopy: {
        flex: 1,
        gap: spacing.exact(4),
        paddingTop: spacing.exact(4),
      },
      headerTitle: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "700",
        letterSpacing: -0.4,
        color: colors.textPrimary,
      },
      headerSubtitle: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      stage: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: horizontalPadding,
      },
      frame: {
        width: windowWidth - horizontalPadding * 2,
        height: frameHeight,
        alignSelf: "center",
        borderRadius: radius.xl,
        overflow: "hidden",
        backgroundColor: colors.paper,
        shadowColor: colors.shadow,
        shadowOpacity: 0.08,
        shadowRadius: spacing.exact(12),
        shadowOffset: { width: 0, height: spacing.exact(8) },
        elevation: 4,
      },
      preview: {
        width: "100%",
        height: "100%",
        backgroundColor: colors.track,
      },
      skeleton: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: colors.track,
      },
      playBadge: {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: spacing.exact(72),
        height: spacing.exact(72),
        marginTop: -spacing.exact(36),
        marginLeft: -spacing.exact(36),
        borderRadius: spacing.exact(36),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.glassHeavy,
      },
      videoPlaceholderFrame: {
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(10),
        paddingHorizontal: horizontalPadding,
        backgroundColor: colors.track,
      },
      videoPlaceholderTitle: {
        maxWidth: "72%",
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(26),
        fontWeight: "700",
        textAlign: "center",
        color: colors.textPrimary,
      },
      videoPlaceholderBody: {
        maxWidth: "72%",
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        textAlign: "center",
        color: colors.textMuted,
      },
      errorFrame: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: horizontalPadding,
        gap: spacing.exact(8),
        backgroundColor: colors.track,
      },
      errorTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        color: colors.textPrimary,
        textAlign: "center",
      },
      errorBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textMuted,
        textAlign: "center",
      },
      retryButton: {
        marginTop: spacing.exact(8),
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
      },
      retryLabel: {
        fontSize: responsiveFont(14),
        fontWeight: "600",
        color: colors.textSecondary,
      },
      footer: {
        gap: spacing.exact(8),
        paddingHorizontal: horizontalPadding,
        paddingTop: spacing.exact(16),
        paddingBottom: spacing.exact(12),
      },
      primaryButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(24),
        paddingVertical: spacing.exact(12),
        borderRadius: radius.pill,
        backgroundColor: colors.textPrimary,
      },
      primaryButtonDisabled: {
        opacity: 0.45,
      },
      primaryButtonText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        color: colors.onAccent,
      },
      videoHint: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        textAlign: "center",
        color: colors.textMuted,
      },
      pressed: {
        opacity: 0.88,
      },
    };
  });
}

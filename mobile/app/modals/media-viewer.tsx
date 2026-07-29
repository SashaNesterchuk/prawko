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
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const styles = useStyles();
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
  const showVideoPlaceholder =
    Boolean(viewer) && isVideo && (!previewUrl || previewFailed);
  const closeIconSize = responsiveFont(22);
  const refreshIconSize = responsiveFont(18);
  const playIconSize = responsiveFont(32);

  const handleClose = () => {
    router.back();
  };

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
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.stage}>
          {!viewer ? (
            <View style={styles.messageFrame}>
              <Text style={styles.messageTitle}>
                {t("question.media.previewUnavailable")}
              </Text>
              <Text style={styles.messageBody}>
                {t("question.media.viewerMissingAsset")}
              </Text>
            </View>
          ) : showVideoPlaceholder ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("question.media.viewerOpenExternal")}
              disabled={!assetUrl}
              onPress={() => void handleOpenExternally()}
              style={styles.messageFrame}
            >
              <Text style={styles.messageTitle}>
                {viewer.label ?? t("question.media.viewerTitle")}
              </Text>
              <Text style={styles.messageBody}>
                {t("question.media.tapToOpen")}
              </Text>
              <View style={styles.playBadge}>
                <MaterialCommunityIcons
                  color={colors.onAccent}
                  name="play"
                  size={playIconSize}
                />
              </View>
            </Pressable>
          ) : !hasPreview ? (
            <View style={styles.messageFrame}>
              <Text style={styles.messageTitle}>
                {t("question.media.mediaUnavailableTitle")}
              </Text>
              <Text style={styles.messageBody}>
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
                    color={colors.onAccent}
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
            <View style={styles.imageStage}>
              {!isLoaded ? (
                <View pointerEvents="none" style={styles.skeleton} />
              ) : null}

              <Image
                key={reloadKey}
                resizeMode="contain"
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
                    color={colors.onAccent}
                    name="play"
                    size={playIconSize}
                  />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          hitSlop={8}
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons color={colors.onAccent} name="close" size={closeIconSize} />
        </Pressable>
      </SafeAreaView>
    </View>
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

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    root: {
      flex: 1,
      backgroundColor: colors.black,
    },
    safeArea: {
      flex: 1,
    },
    stage: {
      flex: 1,
    },
    imageStage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    preview: {
      width: "100%",
      height: "100%",
    },
    skeleton: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "#1A1A1A",
    },
    messageFrame: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(10),
      paddingHorizontal: spacing.exact(32),
    },
    messageTitle: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(26),
      fontWeight: "700",
      textAlign: "center",
      color: colors.onAccent,
    },
    messageBody: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      textAlign: "center",
      color: "rgba(255,255,255,0.62)",
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
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    retryButton: {
      marginTop: spacing.exact(8),
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(8),
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(12),
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    retryLabel: {
      fontSize: responsiveFont(14),
      fontWeight: "600",
      color: colors.onAccent,
    },
    closeButton: {
      position: "absolute",
      right: spacing.exact(20),
      bottom: spacing.exact(28),
      width: spacing.exact(44),
      height: spacing.exact(44),
      borderRadius: spacing.exact(22),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    pressed: {
      opacity: 0.88,
    },
  }));
}

import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { EmptyStateView } from "../../src/components/shell/StateViews";
import {
  getQuestionMediaViewerAssetUrl,
  getQuestionMediaViewerPreviewUrl,
  type QuestionMediaViewerParams,
} from "../../src/features/questions/question-media";
import { useErrorLogger } from "../../src/providers/ErrorLoggingProvider";
import { useTheme } from "../../src/providers/ThemeProvider";

export default function MediaViewerModalScreen() {
  const { t } = useTranslation();
  const { captureError } = useErrorLogger();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const params = useLocalSearchParams<{
    label?: string | string[];
    mediaType?: string | string[];
    posterStorageBucket?: string | string[];
    posterStoragePath?: string | string[];
    storageBucket?: string | string[];
    storagePath?: string | string[];
  }>();
  const [previewFailed, setPreviewFailed] = useState(false);

  const viewer = useMemo(() => parseViewerParams(params), [params]);
  const previewUrl = getQuestionMediaViewerPreviewUrl(viewer);
  const assetUrl = getQuestionMediaViewerAssetUrl(viewer);
  const hasPreview = Boolean(previewUrl) && !previewFailed;
  const title = viewer?.label ?? t("question.media.viewerTitle");
  const subtitle =
    viewer?.mediaType === "video"
      ? t("question.media.viewerVideoBody")
      : t("question.media.viewerImageBody");

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

  return (
    <AppScreen
      title={title}
      subtitle={subtitle}
      scroll={false}
      footer={
        <View style={{ gap: 10 }}>
          {viewer?.mediaType === "video" ? (
            <AppButton
              label={t("question.media.viewerOpenExternal")}
              onPress={() => void handleOpenExternally()}
              disabled={!assetUrl}
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
      {!viewer ? (
        <EmptyStateView
          title={t("question.media.previewUnavailable")}
          description={t("question.media.viewerMissingAsset")}
        />
      ) : (
        <View style={styles.content}>
          {hasPreview ? (
            <AppCard>
              <Image
                source={{ uri: previewUrl ?? undefined }}
                resizeMode={viewer.mediaType === "image" ? "contain" : "cover"}
                style={styles.preview}
                onError={() => setPreviewFailed(true)}
              />
            </AppCard>
          ) : (
            <AppCard>
              <View style={styles.previewFallback}>
                <Text style={styles.previewFallbackTitle}>
                  {t("question.media.previewUnavailable")}
                </Text>
                <Text style={styles.previewFallbackBody}>
                  {previewUrl
                    ? t("question.media.viewerLoadFailed")
                    : t("question.media.viewerMissingAsset")}
                </Text>
              </View>
            </AppCard>
          )}

          {viewer.mediaType === "video" ? (
            <AppCard>
              <Text style={styles.helperBody}>
                {t("question.media.videoHint")}
              </Text>
            </AppCard>
          ) : null}
        </View>
      )}
    </AppScreen>
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

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: 12,
    },
    helperBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    preview: {
      width: "100%",
      height: 360,
      borderRadius: theme.radius.large,
      backgroundColor: theme.colors.cardMuted,
    },
    previewFallback: {
      minHeight: 220,
      borderRadius: theme.radius.large,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.cardMuted,
      justifyContent: "center",
      gap: 8,
      padding: 20,
    },
    previewFallbackBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    previewFallbackTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
  });

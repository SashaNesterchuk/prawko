import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { AppTextInput } from "../../src/components/shell/AppTextInput";
import {
  EmptyStateView,
  LoadingStateView,
} from "../../src/components/shell/StateViews";
import { useResponsiveStyles } from "../../src/portable-ui";
import {
  getAnswerTextFromContext,
} from "../../src/features/ai/question-chat-context";
import { useQuestionAiChat } from "../../src/features/ai/use-question-ai-chat";
import { useHasAiChatAccess } from "../../src/state/entitlements";
import { useAppShellStore } from "../../src/state/app-shell";

export default function AiChatModalScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const params = useLocalSearchParams<{
    locale?: string | string[];
    questionId?: string | string[];
    selectedAnswer?: string | string[];
  }>();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionId = getSingleParam(params.questionId) ?? null;
  const routeLocale = getSingleParam(params.locale);
  const selectedAnswer = getSingleParam(params.selectedAnswer);
  const hasAiChatAccess = useHasAiChatAccess();
  const locale: SupportedLocale =
    routeLocale && SUPPORTED_LOCALES.includes(routeLocale as SupportedLocale)
      ? (routeLocale as SupportedLocale)
      : preferredLocale;
  const {
    aiChatHydrated,
    conversation,
    draft,
    errorCode,
    isSending,
    questionContext,
    sendMessage,
    setDraft,
  } = useQuestionAiChat({
    locale,
    questionId,
    selectedAnswer: selectedAnswer as
      | "A"
      | "B"
      | "C"
      | "true"
      | "false"
      | undefined,
    hasAiChatAccess,
  });

  if (!aiChatHydrated) {
    return (
      <AppScreen
        title={t("modals.aiTitle")}
        subtitle={t("modals.aiSubtitle")}
        scroll={false}
      >
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("modals.aiLoading")}
        />
      </AppScreen>
    );
  }

  if (!questionContext) {
    return (
      <AppScreen
        title={t("modals.aiTitle")}
        subtitle={t("modals.aiSubtitle")}
        scroll={false}
        footer={
          <View style={styles.footerStack}>
            <AppButton
              label={t("modals.openLearn")}
              onPress={() => router.replace("/(tabs)/learn")}
            />
            <AppButton
              variant="ghost"
              label={t("common.close")}
              onPress={() => router.back()}
            />
          </View>
        }
      >
        <EmptyStateView
          title={t("modals.aiQuestionMissingTitle")}
          description={t("modals.aiQuestionMissingSubtitle")}
        />
      </AppScreen>
    );
  }

  if (!hasAiChatAccess) {
    return (
      <AppScreen
        title={t("modals.aiTitle")}
        subtitle={t("modals.aiPlusGateSubtitle")}
        footer={
          <View style={styles.footerStack}>
            <AppButton
              label={t("modals.aiOpenPaywall")}
              onPress={() =>
                router.push({
                  pathname: "/paywall",
                  params: { feature: "ai_question_chat" },
                })
              }
            />
            <AppButton
              variant="ghost"
              label={t("common.close")}
              onPress={() => router.back()}
            />
          </View>
        }
      >
        <AppCard accent>
          <Text style={styles.sectionTitle}>{t("modals.aiPlusGateTitle")}</Text>
          <Text style={styles.messageBody}>{t("modals.aiPlusGateBody")}</Text>
        </AppCard>
      </AppScreen>
    );
  }

  const correctAnswerText = getAnswerTextFromContext(
    questionContext,
    questionContext.correctAnswer
  );
  const selectedAnswerText = getAnswerTextFromContext(
    questionContext,
    questionContext.selectedAnswer
  );
  const suggestionPrompts = [
    t("modals.aiSuggestionWhy"),
    t("modals.aiSuggestionMistake"),
    t("modals.aiSuggestionMemory"),
  ];
  const messages = conversation?.messages ?? [];

  return (
    <AppScreen
      title={t("modals.aiTitle")}
      subtitle={t("modals.aiSubtitle")}
      footer={
        <View style={styles.footerStack}>
          <AppTextInput
            label={t("modals.aiInputLabel")}
            placeholder={t("modals.aiInputPlaceholder")}
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="sentences"
            multiline
            numberOfLines={4}
            editable={!isSending}
          />
          <AppButton
            label={
              isSending ? t("modals.aiSending") : t("modals.aiSend")
            }
            onPress={() => sendMessage()}
            disabled={!draft.trim() || isSending}
          />
          <AppButton
            variant="ghost"
            label={t("common.close")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={styles.contentStack}>
        <AppCard accent>
          <Text style={styles.eyebrow}>{t(`topics.${questionContext.topicBlock}`)}</Text>
          <Text style={styles.prompt}>{questionContext.prompt}</Text>
          <View style={styles.metaRow}>
            <MetaPill
              label={t("modals.aiCorrectAnswer", {
                answer: correctAnswerText ?? questionContext.correctAnswer,
              })}
            />
            {selectedAnswerText ? (
              <MetaPill
                label={t("modals.aiSelectedAnswer", {
                  answer: selectedAnswerText,
                })}
              />
            ) : null}
            <MetaPill label={t("modals.aiUnlimited")} accent />
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>{t("modals.aiSuggestionsTitle")}</Text>
          <View style={styles.suggestionWrap}>
            {suggestionPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                accessibilityRole="button"
                onPress={() => sendMessage(prompt)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  pressed ? styles.suggestionChipPressed : null,
                ]}
              >
                <Text style={styles.suggestionLabel}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </AppCard>

        {messages.map((message) => (
          <AppCard key={message.id} accent={message.role === "assistant"}>
            <Text style={styles.messageRole}>
              {message.role === "assistant"
                ? t("modals.aiAssistantRole")
                : t("modals.aiUserRole")}
            </Text>
            <Text style={styles.messageBody}>{message.content}</Text>
          </AppCard>
        ))}

        {errorCode ? (
          <AppCard>
            <Text style={styles.sectionTitle}>{t("modals.aiErrorTitle")}</Text>
            <Text style={styles.messageBody}>
              {t(`modals.aiErrors.${errorCode}`)}
            </Text>
          </AppCard>
        ) : null}
      </View>
    </AppScreen>
  );
}

function MetaPill({
  accent = false,
  label,
}: {
  accent?: boolean;
  label: string;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.metaPill, accent ? styles.metaPillAccent : null]}>
      <Text style={[styles.metaPillLabel, accent ? styles.metaPillLabelAccent : null]}>
        {label}
      </Text>
    </View>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    contentStack: {
      gap: spacing.exact(12),
    },
    eyebrow: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(18),
      fontWeight: "800",
      marginBottom: spacing.exact(8),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    messageBody: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(24),
      color: colors.textPrimary,
    },
    messageRole: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(18),
      fontWeight: "800",
      marginBottom: spacing.exact(8),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    metaPill: {
      paddingHorizontal: spacing.exact(10),
      paddingVertical: spacing.exact(8),
      borderRadius: radius.pill,
      backgroundColor: colors.cardMuted,
    },
    metaPillAccent: {
      backgroundColor: colors.cardAccent,
      borderWidth: 1,
      borderColor: colors.accentMuted,
    },
    metaPillLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(18),
      fontWeight: "600",
      color: colors.textSecondary,
    },
    metaPillLabelAccent: {
      color: colors.textPrimary,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.exact(8),
      marginTop: spacing.exact(12),
    },
    prompt: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      color: colors.textPrimary,
    },
    sectionTitle: {
      fontSize: responsiveFont(16),
      fontWeight: "700",
      marginBottom: spacing.exact(8),
      color: colors.textPrimary,
    },
    suggestionChip: {
      backgroundColor: colors.cardMuted,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.exact(14),
      paddingVertical: spacing.exact(10),
    },
    suggestionChipPressed: {
      opacity: 0.86,
    },
    suggestionLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.textPrimary,
    },
    suggestionWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.exact(8),
    },
  }));
}

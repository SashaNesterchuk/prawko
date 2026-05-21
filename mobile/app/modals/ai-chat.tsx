import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import {
  getAnswerTextFromContext,
} from "../../src/features/ai/question-chat-context";
import { useQuestionAiChat } from "../../src/features/ai/use-question-ai-chat";
import { useHasFeatureAccess } from "../../src/state/entitlements";
import { useAppShellStore } from "../../src/state/app-shell";
import { useTheme } from "../../src/providers/ThemeProvider";

export default function AiChatModalScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);
  const params = useLocalSearchParams<{
    locale?: string | string[];
    questionId?: string | string[];
    selectedAnswer?: string | string[];
  }>();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionId = getSingleParam(params.questionId) ?? null;
  const routeLocale = getSingleParam(params.locale);
  const selectedAnswer = getSingleParam(params.selectedAnswer);
  const hasAiQuestionChatAccess = useHasFeatureAccess("ai_question_chat");
  const locale: SupportedLocale =
    routeLocale && SUPPORTED_LOCALES.includes(routeLocale as SupportedLocale)
      ? (routeLocale as SupportedLocale)
      : preferredLocale;
  const {
    aiChatHydrated,
    conversation,
    draft,
    errorCode,
    hasUnlimitedAssistantResponses,
    isSending,
    limitReached,
    questionContext,
    remainingAssistantResponses,
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
      unlimitedAssistantResponses: hasAiQuestionChatAccess,
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
          <View style={{ gap: 10 }}>
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
        <View style={{ gap: 10 }}>
          <AppTextInput
            label={t("modals.aiInputLabel")}
            placeholder={t("modals.aiInputPlaceholder")}
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="sentences"
            multiline
            numberOfLines={4}
            editable={!isSending && !limitReached}
          />
          <AppButton
            label={
              isSending ? t("modals.aiSending") : t("modals.aiSend")
            }
            onPress={() => sendMessage()}
            disabled={!draft.trim() || isSending || limitReached}
          />
          {limitReached ? (
            <AppButton
              variant="secondary"
              label={t("modals.aiOpenPaywall")}
              onPress={() => router.push("/modals/paywall")}
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
      <View style={{ gap: 12 }}>
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
            <MetaPill
              label={
                hasUnlimitedAssistantResponses
                  ? t("modals.aiUnlimited")
                  : t("modals.aiFreeLeft", {
                      count: remainingAssistantResponses ?? 0,
                    })
              }
              accent
            />
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
  const theme = useTheme();
  const styles = getStyles(theme);

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

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    eyebrow: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800",
      marginBottom: 8,
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    messageBody: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.colors.textPrimary,
    },
    messageRole: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800",
      marginBottom: 8,
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    metaPill: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.cardMuted,
    },
    metaPillAccent: {
      backgroundColor: theme.colors.cardAccent,
      borderWidth: 1,
      borderColor: theme.colors.accentMuted,
    },
    metaPillLabel: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      color: theme.colors.textSecondary,
    },
    metaPillLabelAccent: {
      color: theme.colors.accent,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    prompt: {
      fontSize: 18,
      lineHeight: 28,
      fontWeight: "800",
      color: theme.colors.textPrimary,
    },
    sectionTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "800",
      marginBottom: 10,
      color: theme.colors.textPrimary,
    },
    suggestionChip: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
    },
    suggestionChipPressed: {
      opacity: 0.8,
    },
    suggestionLabel: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textPrimary,
      fontWeight: "600",
    },
    suggestionWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
  });

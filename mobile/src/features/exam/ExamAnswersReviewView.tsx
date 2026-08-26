import type { SupportedLocale } from "@prawko/config";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { GreenWaveScreen } from "../../components/shell/GreenWaveScreen";
import { NavigationButton } from "../../components/shell/NavigationButton";
import { CText, getFontFamily, useResponsiveFonts, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import {
  getLocalizedText,
  getQuestionById,
  getQuestionChoices,
} from "../questions/question-engine";
import { QuestionMediaCard } from "../questions/QuestionMediaCard";
import { QuestionMediaEmptyPlaceholder } from "../questions/QuestionMediaEmptyPlaceholder";
import { QuestionChoiceOption } from "../questions/training/QuestionChoiceOption";
import { QuestionFeedbackActions } from "../questions/training/QuestionFeedbackActions";
import { QuestionFeedbackBottomSheet } from "../questions/training/QuestionFeedbackBottomSheet";
import { QuestionFeedbackPushStage } from "../questions/training/QuestionFeedbackPushStage";

import { openSupportEmail } from "../support/support-email";
import type { RemoteExamAnswer, RemoteExamQuestionRef } from "./types";

type ExamAnswersReviewViewProps = {
  answer: RemoteExamAnswer | null;
  canGoNext: boolean;
  canGoPrevious: boolean;
  currentIndex: number;
  displayLocale: SupportedLocale;
  isBookmarked: boolean;
  onBack: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleBookmark: () => void;
  questionRef: RemoteExamQuestionRef;
  /** Defaults to exam answers review title. */
  title?: string;
  testID?: string;
  totalQuestions: number;
};

export function ExamAnswersReviewView({
  answer,
  canGoNext,
  canGoPrevious,
  currentIndex,
  displayLocale,
  isBookmarked,
  onBack,
  onNext,
  onPrevious,
  onToggleBookmark,
  questionRef,
  title,
  testID,
  totalQuestions,
}: ExamAnswersReviewViewProps) {
  const { t } = useTranslation();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const reviewTitle = title ?? t("exam.answersReviewTitle");
  const isLastQuestion = currentIndex >= totalQuestions - 1;

  const question = getQuestionById(questionRef.questionSourceId);
  const questionChoices = question
    ? getQuestionChoices(question, displayLocale)
    : [];
  const isCorrectAnswer = Boolean(answer?.isCorrect);
  const hasAnswered = true;
  const selectedAnswer = answer?.answerGiven ?? null;
  const isBooleanQuestion = question?.answerType === "boolean";
  const feedbackAccent = isCorrectAnswer ? accents.green : accents.red;
  const feedbackGradientColors = [feedbackAccent.wash, colors.white] as const;
  const premiumIconSize = responsiveFont(12);
  const explanationText = question
    ? getLocalizedText(question.explanation, displayLocale)
    : "";
  const scopeLabel = question
    ? t(`question.scopes.${question.scope}`)
    : t(`question.scopes.${questionRef.scope}`);
  const points = question?.points ?? questionRef.points;
  function handleReportProblem() {
    void openSupportEmail({
      subject: t("question.reportProblemSubject", {
        questionId: questionRef.questionSourceId,
      }),
    });
  }

  if (!question) {
    return (
      <GreenWaveScreen>
        <SafeAreaView
          style={styles.safeArea}
          edges={["top", "bottom"]}
          testID={testID}
        >
          <StatusBar style="dark" />
          <View style={styles.contentPad}>
            <View style={styles.header}>
              <NavigationButton
                inset
                type="back"
                accessibilityLabel={t("common.back")}
                onPress={onBack}
              />
              <View style={styles.headerCenter}>
                <CText style={styles.headerTitle}>
                  {reviewTitle}
                </CText>
              </View>
            </View>
          </View>
          <View style={styles.missingState}>
            <CText style={styles.missingTitle}>
              {t("exam.questionUnavailable")}
            </CText>
            <CText style={styles.missingBody}>
              {t("exam.sessionSubtitle", {
                current: currentIndex + 1,
                total: totalQuestions,
              })}
            </CText>
          </View>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  const questionBlock = (
    <>
      <View style={styles.mediaBleed}>
        {question.media ? (
          <QuestionMediaCard
            key={question.id}
            locale={displayLocale}
            media={question.media}
          />
        ) : (
          <QuestionMediaEmptyPlaceholder />
        )}
      </View>

      <CText style={styles.prompt}>
        {getLocalizedText(question.prompt, displayLocale)}
      </CText>

      <View style={isBooleanQuestion ? styles.booleanOptions : styles.options}>
        {questionChoices.map((choice, index) => (
          <QuestionChoiceOption
            key={choice.id}
            choice={choice}
            choiceIndex={index}
            hasAnswered={hasAnswered}
            isBooleanQuestion={isBooleanQuestion}
            isCorrectChoice={question.correctAnswer === choice.id}
            isSelected={selectedAnswer === choice.id}
            onPress={() => undefined}
          />
        ))}
      </View>
    </>
  );

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID={testID}
      >
        <StatusBar style="dark" />
        <View style={styles.container}>
          <View style={styles.contentPad}>
            <View style={styles.header}>
              <NavigationButton
                inset
                type="back"
                accessibilityLabel={t("common.back")}
                onPress={onBack}
              />
              <View style={styles.headerCenter}>
                <View style={styles.headerTitles}>
                  <CText style={styles.headerTitle} numberOfLines={1}>
                    {reviewTitle}
                  </CText>
                  <CText style={styles.headerCounter}>
                    {t("exam.sessionSubtitle", {
                      current: currentIndex + 1,
                      total: totalQuestions,
                    })}
                  </CText>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.metaRow}>
            <CText style={styles.metaText}>{scopeLabel}</CText>
            <CText style={styles.metaText}>
              {t("question.pointsLabel", { points })}
            </CText>
          </View>

          <QuestionFeedbackPushStage
            visible
            contentBottomInset={insets.bottom + 24}
            resetKey={questionRef.questionSourceId}
            feedback={
              <QuestionFeedbackBottomSheet
                visible
                isCorrectAnswer={isCorrectAnswer}
                explanationText={explanationText || null}
                isBookmarked={isBookmarked}
                feedbackAccentFill={feedbackAccent.fill}
                feedbackAccentInk={feedbackAccent.ink}
                feedbackGradientColors={feedbackGradientColors}
                premiumIconSize={premiumIconSize}
                onReportProblem={handleReportProblem}
                onToggleBookmark={onToggleBookmark}
              />
            }
            feedbackActions={
              <QuestionFeedbackActions
                canGoNext={canGoNext || isLastQuestion}
                canGoPrevious={canGoPrevious}
                isCorrectAnswer={isCorrectAnswer}
                navigationMode="previousNext"
                nextLabel={
                  isLastQuestion
                    ? t("question.finish")
                    : t("question.nextShort")
                }
                nextTestID={
                  isLastQuestion
                    ? "question-answers-review-finish"
                    : "question-answers-review-next"
                }
                previousLabel={t("question.previousShort")}
                previousTestID="question-answers-review-previous"
                showNextIcon={!isLastQuestion}
                onNext={onNext}
                onPrevious={onPrevious}
              />
            }
          >
            {questionBlock}
          </QuestionFeedbackPushStage>
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ colors, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      container: {
        flex: 1,
      },
      contentPad: {
        paddingHorizontal: spacing.exact(24),
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      headerCenter: {
        flex: 1,
      },
      headerTitles: {
        gap: spacing.exact(0),
      },
      headerTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(20),
        color: colors.textPrimary,
      },
      headerCounter: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(12),
        paddingBottom: spacing.exact(8),
      },
      metaText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      mediaBleed: {
        width: "100%",
        marginBottom: spacing.exact(12),
      },
      prompt: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        color: colors.textPrimary,
        marginBottom: spacing.exact(12),
        paddingHorizontal: spacing.exact(24),
      },
      options: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      booleanOptions: {
        flexDirection: "row",
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      missingState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(24),
        gap: spacing.exact(8),
      },
      missingTitle: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        textAlign: "center",
        color: colors.textPrimary,
      },
      missingBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        textAlign: "center",
        color: colors.textSecondary,
      },
    })
  );
}

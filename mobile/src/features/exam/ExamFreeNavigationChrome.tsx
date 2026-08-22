import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { QuestionFeedbackActions } from "../questions/training/QuestionFeedbackActions";
import { QuestionStepPill } from "../questions/training/QuestionStepPill";
import type { QuestionStepState } from "../questions/training/visible-steps";
import { useResponsiveStyles } from "../../portable-ui";

type ExamFreeNavigationChromeProps = {
  answeredOrders: Set<number>;
  canGoBack: boolean;
  canGoForward: boolean;
  currentOrder: number;
  flaggedOrders: Set<number>;
  isBusy: boolean;
  isLastQuestion: boolean;
  onBack: () => void;
  onFinish: () => void;
  onNext: () => void;
  onSelectOrder: (order: number) => void;
  total: number;
};

export function ExamQuestionIndexStrip({
  answeredOrders,
  currentOrder,
  flaggedOrders,
  isBusy,
  onSelectOrder,
  total,
}: Pick<
  ExamFreeNavigationChromeProps,
  | "answeredOrders"
  | "currentOrder"
  | "flaggedOrders"
  | "isBusy"
  | "onSelectOrder"
  | "total"
>) {
  const styles = useStripStyles();
  const orders = Array.from({ length: total }, (_, index) => index + 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.stepper}
    >
      {orders.map((order) => {
        const stepState = getExamStepState({
          answered: answeredOrders.has(order),
          current: order === currentOrder,
        });

        return (
          <View key={order} style={styles.pillWrap}>
            <QuestionStepPill
              index={order - 1}
              onPress={isBusy ? undefined : () => onSelectOrder(order)}
              stepState={stepState}
              testID={`exam-nav-index-${order}`}
            />
            {flaggedOrders.has(order) ? <View style={styles.flagDot} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

export function ExamFreeNavigationChrome({
  canGoBack,
  canGoForward,
  isBusy,
  isLastQuestion,
  onBack,
  onFinish,
  onNext,
}: Pick<
  ExamFreeNavigationChromeProps,
  | "canGoBack"
  | "canGoForward"
  | "isBusy"
  | "isLastQuestion"
  | "onBack"
  | "onFinish"
  | "onNext"
>) {
  const { t } = useTranslation();

  return (
    <QuestionFeedbackActions
      canGoNext={!isBusy && (canGoForward || isLastQuestion)}
      canGoPrevious={!isBusy && canGoBack}
      isCorrectAnswer
      navigationMode="previousNext"
      nextLabel={t("question.nextShort")}
      nextTestID="exam-next-question"
      previousLabel={t("question.previousShort")}
      previousTestID="exam-prev-question"
      onNext={isLastQuestion ? onFinish : onNext}
      onPrevious={onBack}
    />
  );
}

function getExamStepState({
  answered,
  current,
}: {
  answered: boolean;
  current: boolean;
}): QuestionStepState {
  if (current) {
    return "current";
  }

  return answered ? "answered" : "upcoming";
}

function useStripStyles() {
  return useResponsiveStyles(({ accents, spacing }) => ({
    scroll: {
      flexGrow: 0,
    },
    stepper: {
      gap: spacing.exact(4),
      alignItems: "center",
    },
    pillWrap: {
      position: "relative",
    },
    flagDot: {
      position: "absolute",
      top: spacing.exact(2),
      right: spacing.exact(2),
      width: spacing.exact(6),
      height: spacing.exact(6),
      borderRadius: spacing.exact(3),
      backgroundColor: accents.amber.fill,
    },
  }));
}

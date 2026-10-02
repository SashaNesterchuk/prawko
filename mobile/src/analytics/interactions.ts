import { ANALYTICS_EVENTS, type AnalyticsEventName, type AnalyticsProperties } from "./catalog";

const interactions = new Set<AnalyticsEventName>([
  ANALYTICS_EVENTS.onboardingStepCompleted.key,
  ANALYTICS_EVENTS.authStarted.key,
  ANALYTICS_EVENTS.firstStartStarted.key,
  ANALYTICS_EVENTS.roadmapStepOpened.key,
  ANALYTICS_EVENTS.practiceSetupResolved.key,
  ANALYTICS_EVENTS.trainingModeSelected.key,
  ANALYTICS_EVENTS.trainingQuestionAnswered.key,
  ANALYTICS_EVENTS.trainingFeedbackContinued.key,
  ANALYTICS_EVENTS.trainingResultAction.key,
  ANALYTICS_EVENTS.diagnosticResultAction.key,
  ANALYTICS_EVENTS.diagnosticReminderResolved.key,
  ANALYTICS_EVENTS.trainingAnswersReviewOpened.key,
  ANALYTICS_EVENTS.trainingAnswersReviewClosed.key,
  ANALYTICS_EVENTS.trainingSessionAbandoned.key,
  ANALYTICS_EVENTS.examQuestionAnswered.key,
  ANALYTICS_EVENTS.examQuestionNavigationRequested.key,
  ANALYTICS_EVENTS.examQuestionFlagChanged.key,
  ANALYTICS_EVENTS.examResultAction.key,
  ANALYTICS_EVENTS.examRestartSelected.key,
  ANALYTICS_EVENTS.examAnswersReviewOpened.key,
  ANALYTICS_EVENTS.signSearchSubmitted.key,
  ANALYTICS_EVENTS.signSearchResultSelected.key,
  ANALYTICS_EVENTS.signTestQuestionAnswered.key,
  ANALYTICS_EVENTS.questionBookmarkChanged.key,
  ANALYTICS_EVENTS.questionProblemReportRequested.key,
  ANALYTICS_EVENTS.aiChatMessageSent.key,
  ANALYTICS_EVENTS.paywallCtaSelected.key,
  ANALYTICS_EVENTS.premiumGateAction.key,
  ANALYTICS_EVENTS.learningAccessBlockAction.key,
  ANALYTICS_EVENTS.examCategoryMismatchAction.key,
  ANALYTICS_EVENTS.offlinePackCancelRequested.key,
  ANALYTICS_EVENTS.offlinePackDownloadStarted.key,
  ANALYTICS_EVENTS.settingsChanged.key,
  ANALYTICS_EVENTS.profileActionSelected.key,
]);

export function isAnalyticsInteraction(event: AnalyticsEventName, payload?: AnalyticsProperties) {
  if (event === ANALYTICS_EVENTS.examQuestionAnswered.key && payload?.timed_out === true) return false;
  return interactions.has(event);
}

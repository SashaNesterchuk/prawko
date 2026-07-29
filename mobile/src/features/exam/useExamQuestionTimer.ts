import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EXAM_RULES, type QuestionScope } from "@prawko/config";

import {
  getExamQuestionPhaseDuration,
  getExamQuestionTiming,
  type ExamQuestionTimerPhase,
} from "./exam-config";

type UseExamQuestionTimerInput = {
  enabled: boolean;
  hasVideo: boolean;
  questionId: string | null;
  scope: QuestionScope | null;
};

const DISPLAY_TICK_MS = 100;

/**
 * Exam question timing:
 *
 * Base without video: 20s read → 15s answer.
 * Base with video:
 *   - One countdown (20s) runs while the learner can tap play.
 *   - Starting the video pauses the countdown.
 *   - When the video ends, countdown resumes with remaining + bonus (+5s).
 *   - If the countdown hits 0 without watching, the question times out.
 * Specialist: single 50s window (unchanged).
 */
export function useExamQuestionTimer({
  enabled,
  hasVideo,
  questionId,
  scope,
}: UseExamQuestionTimerInput) {
  const timing = useMemo(
    () => (scope ? getExamQuestionTiming(scope) : null),
    [scope]
  );
  const [phase, setPhase] = useState<ExamQuestionTimerPhase>("answer");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [phaseTotalSeconds, setPhaseTotalSeconds] = useState(0);
  const [progressFraction, setProgressFraction] = useState(1);
  const [phaseEpoch, setPhaseEpoch] = useState(0);
  const [hasPlayedVideo, setHasPlayedVideo] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  const phaseRef = useRef<ExamQuestionTimerPhase>("answer");
  const phaseStartedAtRef = useRef(0);
  const phaseDurationMsRef = useRef(0);
  const remainingMsWhenPausedRef = useRef(0);
  const phaseEndedRef = useRef(false);
  const hasVideoRef = useRef(hasVideo);
  const hasPlayedVideoRef = useRef(false);
  const isTimerPausedRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    hasVideoRef.current = hasVideo;
  }, [hasVideo]);

  useEffect(() => {
    hasPlayedVideoRef.current = hasPlayedVideo;
  }, [hasPlayedVideo]);

  useEffect(() => {
    isTimerPausedRef.current = isTimerPaused;
  }, [isTimerPaused]);

  const beginPhase = useCallback(
    (nextPhase: ExamQuestionTimerPhase, durationSeconds: number) => {
      const durationMs = Math.max(0, durationSeconds) * 1000;
      phaseEndedRef.current = false;
      phaseStartedAtRef.current = Date.now();
      phaseDurationMsRef.current = durationMs;
      isTimerPausedRef.current = false;
      setIsTimerPaused(false);
      setPhase(nextPhase);
      setPhaseTotalSeconds(durationSeconds);
      setRemainingSeconds(durationSeconds);
      setProgressFraction(durationSeconds > 0 ? 1 : 0);
      setPhaseEpoch((value) => value + 1);
    },
    []
  );

  const enterAnswerPhase = useCallback(
    (durationSeconds: number) => {
      beginPhase("answer", Math.max(0, durationSeconds));
    },
    [beginPhase]
  );

  useEffect(() => {
    if (!questionId || !timing) {
      return;
    }

    setHasPlayedVideo(false);
    hasPlayedVideoRef.current = false;
    remainingMsWhenPausedRef.current = 0;

    const nextPhase = getInitialPhase(timing);
    beginPhase(nextPhase, getExamQuestionPhaseDuration(nextPhase, timing));
  }, [beginPhase, questionId, timing]);

  const handleVideoStarted = useCallback(() => {
    if (!hasVideoRef.current || hasPlayedVideoRef.current) {
      return;
    }

    if (phaseRef.current === "media" || isTimerPausedRef.current) {
      return;
    }

    const durationMs = phaseDurationMsRef.current;
    const elapsedMs = Date.now() - phaseStartedAtRef.current;
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    if (remainingMs <= 0) {
      return;
    }

    remainingMsWhenPausedRef.current = remainingMs;
    hasPlayedVideoRef.current = true;
    setHasPlayedVideo(true);
    isTimerPausedRef.current = true;
    setIsTimerPaused(true);
    setPhase("media");
    phaseRef.current = "media";
    setRemainingSeconds(Math.ceil(remainingMs / 1000));
    setProgressFraction(
      durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0
    );
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (phaseRef.current !== "media") {
      return;
    }

    const bonusMs = EXAM_RULES.baseVideoResumeBonusSeconds * 1000;
    const resumedMs = remainingMsWhenPausedRef.current + bonusMs;
    const resumedSeconds = Math.max(0, Math.ceil(resumedMs / 1000));
    // Soft cap: never more than the original read window + bonus.
    const maxSeconds =
      (timing?.readSeconds || EXAM_RULES.baseReadSeconds) +
      EXAM_RULES.baseVideoResumeBonusSeconds;
    enterAnswerPhase(Math.min(resumedSeconds, maxSeconds));
  }, [enterAnswerPhase, timing?.readSeconds]);

  // Tick while the countdown is running (not during paused video).
  useEffect(() => {
    if (!enabled || !timing || phase === "media" || isTimerPaused) {
      return;
    }

    const tick = () => {
      const durationMs = phaseDurationMsRef.current;
      if (durationMs <= 0) {
        setRemainingSeconds(0);
        setProgressFraction(0);
        return;
      }

      const elapsedMs = Date.now() - phaseStartedAtRef.current;
      const remainingMs = Math.max(0, durationMs - elapsedMs);
      setRemainingSeconds(Math.ceil(remainingMs / 1000));
      setProgressFraction(Math.max(0, Math.min(1, remainingMs / durationMs)));

      if (remainingMs > 0 || phaseEndedRef.current) {
        return;
      }

      phaseEndedRef.current = true;

      // Base without video: read → answer window.
      if (
        phaseRef.current === "read" &&
        !hasVideoRef.current &&
        timing.answerSeconds > 0
      ) {
        enterAnswerPhase(timing.answerSeconds);
      }
    };

    tick();
    const intervalId = setInterval(tick, DISPLAY_TICK_MS);
    return () => clearInterval(intervalId);
  }, [
    enabled,
    enterAnswerPhase,
    isTimerPaused,
    phase,
    phaseEpoch,
    questionId,
    timing,
  ]);

  const isTimedOut =
    enabled &&
    !isTimerPaused &&
    phase !== "media" &&
    remainingSeconds <= 0 &&
    phaseTotalSeconds > 0 &&
    // After read→answer transition for no-video, answer phase has its own clock.
    (phase === "answer" || (phase === "read" && hasVideo));

  return {
    canAnswer: enabled,
    handleVideoEnded,
    handleVideoStarted,
    hasPlayedVideo,
    isAnswerTimedOut: isTimedOut,
    isTimerPaused,
    phase,
    phaseEpoch,
    phaseTotalSeconds,
    progressFraction,
    remainingSeconds,
    /** Exam videos are always started by the learner. */
    shouldAutoPlayVideo: false,
  };
}

function getInitialPhase(
  timing: ReturnType<typeof getExamQuestionTiming>
): ExamQuestionTimerPhase {
  return timing.readSeconds > 0 ? "read" : "answer";
}

import { useEffect } from "react";
import { Image } from "react-native";

import { getQuestionById } from "./question-engine";
import { collectQuestionMediaPrefetchUrls } from "./question-media";

/** How many upcoming questions (including current) to warm. */
export const QUESTION_MEDIA_PREFETCH_LOOK_AHEAD = 3;

const prefetchedImageUrls = new Set<string>();

type UsePrefetchQuestionMediaOptions = {
  /**
   * Ordered question ids for the active session (training, exam, review).
   * Pass null/undefined while the session is not ready.
   */
  questionIds: readonly string[] | null | undefined;
  /** Index into `questionIds` for the question currently on screen. */
  currentIndex: number;
  /**
   * Include the current question plus this many following ones.
   * @default QUESTION_MEDIA_PREFETCH_LOOK_AHEAD
   */
  lookAhead?: number;
  /**
   * Bump when the in-memory catalog reloads so URLs are re-resolved.
   */
  catalogVersion?: number;
};

/**
 * Prefetch still images and video posters for the current question and the next
 * few in the session queue so QuestionMediaCard does not cold-load on advance.
 *
 * Do not warm upcoming videos with `createVideoPlayer({ useCaching: true })`.
 * expo-video's VideoCacheManager is not safe under concurrent NSURLSession
 * callbacks (SIGSEGV in `registerOpenFile`) — hard/high-points sessions start
 * several video questions at once and trip it immediately.
 */
export function usePrefetchQuestionMedia({
  questionIds,
  currentIndex,
  lookAhead = QUESTION_MEDIA_PREFETCH_LOOK_AHEAD,
  catalogVersion = 0,
}: UsePrefetchQuestionMediaOptions) {
  const questionIdsKey = questionIds?.join("\0") ?? "";

  useEffect(() => {
    if (!questionIds?.length || currentIndex < 0) {
      return;
    }

    const windowEnd = Math.min(questionIds.length, currentIndex + lookAhead + 1);
    const windowIds = questionIds.slice(currentIndex, windowEnd);
    const imageUrls: string[] = [];

    for (const questionId of windowIds) {
      const question = getQuestionById(questionId);
      if (!question?.media) {
        continue;
      }

      const { imageUrls: nextImages } = collectQuestionMediaPrefetchUrls(
        question.media
      );

      for (const url of nextImages) {
        if (!imageUrls.includes(url)) {
          imageUrls.push(url);
        }
      }
    }

    for (const url of imageUrls) {
      if (prefetchedImageUrls.has(url)) {
        continue;
      }

      prefetchedImageUrls.add(url);
      void Image.prefetch(url).catch(() => {
        prefetchedImageUrls.delete(url);
      });
    }
  }, [catalogVersion, currentIndex, lookAhead, questionIds, questionIdsKey]);
}

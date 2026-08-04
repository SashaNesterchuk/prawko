import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { useEffect, useRef } from "react";
import { Image, Platform } from "react-native";

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
 * Prefetch image/poster + video media for the current question and the next
 * few in the session queue so QuestionMediaCard does not cold-load on advance.
 *
 * - Images/posters: `Image.prefetch` (shared in-memory dedupe).
 * - Videos: off-screen `createVideoPlayer({ useCaching: true })` for upcoming
 *   items only (current video is owned by QuestionMediaCard).
 */
export function usePrefetchQuestionMedia({
  questionIds,
  currentIndex,
  lookAhead = QUESTION_MEDIA_PREFETCH_LOOK_AHEAD,
  catalogVersion = 0,
}: UsePrefetchQuestionMediaOptions) {
  const videoPlayersRef = useRef<Map<string, VideoPlayer>>(new Map());
  const questionIdsKey = questionIds?.join("\0") ?? "";

  useEffect(() => {
    if (!questionIds?.length || currentIndex < 0) {
      return;
    }

    const windowEnd = Math.min(questionIds.length, currentIndex + lookAhead + 1);
    const windowIds = questionIds.slice(currentIndex, windowEnd);

    const imageUrls: string[] = [];
    const upcomingVideoUrls: string[] = [];

    for (const [offset, questionId] of windowIds.entries()) {
      const question = getQuestionById(questionId);
      if (!question?.media) {
        continue;
      }

      const { imageUrls: nextImages, videoUrls: nextVideos } =
        collectQuestionMediaPrefetchUrls(question.media);

      for (const url of nextImages) {
        if (!imageUrls.includes(url)) {
          imageUrls.push(url);
        }
      }

      // Current question video is mounted in QuestionMediaCard; only warm ahead.
      if (offset === 0) {
        continue;
      }

      for (const url of nextVideos) {
        if (!upcomingVideoUrls.includes(url)) {
          upcomingVideoUrls.push(url);
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

    const keepVideoUrls = new Set(upcomingVideoUrls);
    for (const [url, player] of videoPlayersRef.current) {
      if (keepVideoUrls.has(url)) {
        continue;
      }

      releaseVideoPlayer(player);
      videoPlayersRef.current.delete(url);
    }

    if (Platform.OS === "web") {
      return;
    }

    for (const url of upcomingVideoUrls) {
      if (videoPlayersRef.current.has(url)) {
        continue;
      }

      try {
        const player = createVideoPlayer({
          uri: url,
          useCaching: true,
        });
        player.muted = true;
        videoPlayersRef.current.set(url, player);
      } catch {
        // Prefetch is best-effort; playback still works via the card.
      }
    }
  }, [catalogVersion, currentIndex, lookAhead, questionIds, questionIdsKey]);

  useEffect(() => {
    const players = videoPlayersRef.current;

    return () => {
      for (const player of players.values()) {
        releaseVideoPlayer(player);
      }
      players.clear();
    };
  }, []);
}

function releaseVideoPlayer(player: VideoPlayer) {
  try {
    player.pause();
  } catch {
    // Player may already be released or not ready.
  }

  try {
    player.release();
  } catch {
    // Ignore double-release.
  }
}

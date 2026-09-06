import {
  getQuestionTopicFallbackFromTopicBlock,
  normalizeQuestionTopicIds,
  type QuestionTopicId,
} from "@prawko/config";

import { getQuestionBank } from "../question-bank";
import type { LocalQuestion, QuestionUserStateMap } from "../types";

import {
  INITIAL_DIAGNOSTIC_QUESTION_COUNT,
  resolveInitialDiagnosticTopicQuota,
} from "./mix";

type PickInitialDiagnosticIdsInput = {
  countryCode: string | null | undefined;
  questionLimit?: number | null;
  userStates: QuestionUserStateMap;
};

export function getInitialDiagnosticQuestionIds(
  input: PickInitialDiagnosticIdsInput
): string[] {
  const desiredTotal = normalizeLimit(input.questionLimit);
  const bank = getQuestionBank();

  if (bank.length === 0 || desiredTotal <= 0) {
    return [];
  }

  const selectedIds = new Set<string>();
  const selectedMediaKeys = new Set<string>();
  const selected: LocalQuestion[] = [];

  function take(question: LocalQuestion | null) {
    if (!question || selectedIds.has(question.id)) {
      return;
    }

    selectedIds.add(question.id);
    selected.push(question);
    const mediaKey = getMediaKey(question);

    if (mediaKey) {
      selectedMediaKeys.add(mediaKey);
    }
  }

  const quota = resolveInitialDiagnosticTopicQuota(input.countryCode);

  for (const topicId of quota) {
    if (selected.length >= desiredTotal) {
      break;
    }

    take(
      pickCandidate(
        bank.filter((question) => questionHasTopic(question, topicId)),
        selectedIds,
        selectedMediaKeys,
        input.userStates
      )
    );
  }

  if (!selected.some(isSituationQuestion)) {
    take(
      pickCandidate(
        bank.filter(isVideoQuestion),
        selectedIds,
        selectedMediaKeys,
        input.userStates
      )
    );
  }

  if (!selected.some(isSituationQuestion)) {
    take(
      pickCandidate(
        bank.filter(isSituationQuestion),
        selectedIds,
        selectedMediaKeys,
        input.userStates
      )
    );
  }

  while (selected.length < desiredTotal) {
    const next = pickCandidate(
      bank,
      selectedIds,
      selectedMediaKeys,
      input.userStates
    );

    if (!next) {
      break;
    }

    take(next);
  }

  return shuffleItems(selected)
    .map((question) => question.id)
    .slice(0, desiredTotal);
}

function normalizeLimit(questionLimit: number | null | undefined) {
  if (
    typeof questionLimit === "number" &&
    Number.isFinite(questionLimit) &&
    questionLimit > 0
  ) {
    return Math.min(Math.floor(questionLimit), INITIAL_DIAGNOSTIC_QUESTION_COUNT);
  }

  return INITIAL_DIAGNOSTIC_QUESTION_COUNT;
}

function questionHasTopic(question: LocalQuestion, topicId: QuestionTopicId) {
  const topicIds = normalizeQuestionTopicIds([
    question.primaryTopicId,
    ...(question.topicIds ?? []),
  ]);

  if (topicIds.includes(topicId)) {
    return true;
  }

  return getQuestionTopicFallbackFromTopicBlock(
    question.topicBlock
  ).topicIds.includes(topicId);
}

function getMediaKey(question: LocalQuestion) {
  return question.media?.asset.mediaKey ?? null;
}

function isVideoQuestion(question: LocalQuestion) {
  return question.media?.type === "video";
}

function isSituationQuestion(question: LocalQuestion) {
  return question.media?.type === "video" || question.media?.type === "image";
}

function pickCandidate(
  pool: LocalQuestion[],
  selectedIds: Set<string>,
  selectedMediaKeys: Set<string>,
  userStates: QuestionUserStateMap
) {
  const available = pool.filter((question) => !selectedIds.has(question.id));

  if (available.length === 0) {
    return null;
  }

  const uniqueMedia = available.filter((question) => {
    const mediaKey = getMediaKey(question);
    return !mediaKey || !selectedMediaKeys.has(mediaKey);
  });
  const ranked = (uniqueMedia.length > 0 ? uniqueMedia : available)
    .slice()
    .sort(
      (left, right) =>
        candidateScore(right, userStates) - candidateScore(left, userStates)
    );
  const topScore = candidateScore(ranked[0]!, userStates);
  const top = ranked.filter(
    (question) => candidateScore(question, userStates) === topScore
  );

  return top[Math.floor(Math.random() * top.length)] ?? null;
}

function candidateScore(
  question: LocalQuestion,
  userStates: QuestionUserStateMap
) {
  let score = 0;

  if ((userStates[question.id]?.timesSeen ?? 0) === 0) {
    score += 100;
  }

  if (question.scope === "base") {
    score += 20;
  }

  return score;
}

function shuffleItems<T>(items: T[]) {
  const pool = [...items];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = pool[index];
    pool[index] = pool[swapIndex]!;
    pool[swapIndex] = current!;
  }

  return pool;
}

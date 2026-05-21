import { MOCK_QUESTION_BANK } from "./mock-question-bank";
import {
  mapSupabaseQuestionRecordToLocalQuestion,
  type SupabaseQuestionRecord,
} from "./supabase-question-record";
import type { LocalQuestion } from "./types";

let activeQuestionBank: LocalQuestion[] = [...MOCK_QUESTION_BANK];

function buildQuestionBankById(questionBank: LocalQuestion[]) {
  return Object.fromEntries(
    questionBank.map((question) => [question.id, question])
  ) as Record<string, LocalQuestion>;
}

let activeQuestionBankById = buildQuestionBankById(activeQuestionBank);

export function getQuestionBank() {
  return activeQuestionBank;
}

export function getQuestionBankById() {
  return activeQuestionBankById;
}

export function hydrateQuestionBankFromSupabaseRecords(
  records: SupabaseQuestionRecord[]
) {
  activeQuestionBank = records.map(mapSupabaseQuestionRecordToLocalQuestion);
  activeQuestionBankById = buildQuestionBankById(activeQuestionBank);
}

export function resetQuestionBankToMock() {
  activeQuestionBank = [...MOCK_QUESTION_BANK];
  activeQuestionBankById = buildQuestionBankById(activeQuestionBank);
}

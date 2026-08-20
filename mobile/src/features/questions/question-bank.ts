import { MOCK_QUESTION_BANK } from "./mock-question-bank";
import {
  mapSupabaseQuestionRecordToLocalQuestion,
  mapSupabaseQuestionV2RecordToLocalQuestion,
  type SupabaseQuestionRecord,
  type SupabaseQuestionV2Record,
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

/**
 * Same as hydrateQuestionBankFromSupabaseRecords, but yields between chunks so
 * the JS thread can keep handling touches / tab presses during boot hydrate.
 */
export async function hydrateQuestionBankFromSupabaseRecordsAsync(
  records: SupabaseQuestionRecord[],
  options: { chunkSize?: number } = {}
) {
  const chunkSize = Math.max(50, options.chunkSize ?? 250);
  const nextBank: LocalQuestion[] = new Array(records.length);

  for (let index = 0; index < records.length; index += 1) {
    nextBank[index] = mapSupabaseQuestionRecordToLocalQuestion(records[index]!);

    if (index > 0 && index % chunkSize === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  activeQuestionBank = nextBank;
  activeQuestionBankById = buildQuestionBankById(activeQuestionBank);
}

/** Hydrates the country-neutral v2 catalogue without touching the v1 mapper. */
export async function hydrateQuestionBankFromSupabaseV2RecordsAsync(
  records: SupabaseQuestionV2Record[],
  options: { chunkSize?: number } = {}
) {
  const chunkSize = Math.max(50, options.chunkSize ?? 250);
  const nextBank: LocalQuestion[] = new Array(records.length);

  for (let index = 0; index < records.length; index += 1) {
    nextBank[index] = mapSupabaseQuestionV2RecordToLocalQuestion(records[index]!);

    if (index > 0 && index % chunkSize === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  activeQuestionBank = nextBank;
  activeQuestionBankById = buildQuestionBankById(activeQuestionBank);
}

export function hydrateQuestionBankFromLocalQuestions(
  questions: LocalQuestion[]
) {
  activeQuestionBank = [...questions];
  activeQuestionBankById = buildQuestionBankById(activeQuestionBank);
}

export function resetQuestionBankToMock() {
  activeQuestionBank = [...MOCK_QUESTION_BANK];
  activeQuestionBankById = buildQuestionBankById(activeQuestionBank);
}

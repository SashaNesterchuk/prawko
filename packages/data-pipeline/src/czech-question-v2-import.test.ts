import assert from "node:assert/strict";
import test from "node:test";

import { toCzechV2Question } from "./czech-question-v2-import";

test("maps Czech text-only questions without creating media references", () => {
  const row = toCzechV2Question({
    question_source_id: "cz:TEST-1",
    source_row_number: 1,
    question_cs: "Je to správně?",
    answer_type: "choice",
    correct_option_key: "B",
    option_count: 2,
    points: 3,
    official_basket_scope_id: 9,
    official_basket_scope_order: 0,
    has_media: true,
    is_active: true,
    official_metadata: { etesty_question_id: 1 },
  }, [
    { question_source_id: "cz:TEST-1", option_key: "B", sort_order: 2, text_cs: "Ano", is_correct: true, official_answer_id: 12 },
    { question_source_id: "cz:TEST-1", option_key: "A", sort_order: 1, text_cs: "Ne", is_correct: false, official_answer_id: 11 },
  ], "set-id");

  assert.deepEqual(row.content, {
    prompt: { cs: "Je to správně?" },
    options: [
      { id: "A", text: { cs: "Ne" }, media: [] },
      { id: "B", text: { cs: "Ano" }, media: [] },
    ],
    question_media: [],
  });
  assert.equal(row.correct_option_id, "B");
  assert.equal(row.official_metadata.official_media_available, true);
  assert.equal(row.category_codes[0], "B");
});

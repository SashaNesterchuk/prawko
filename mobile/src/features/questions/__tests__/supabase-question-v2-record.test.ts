import { mapSupabaseQuestionV2RecordToLocalQuestion } from "../supabase-question-record";

const asset = {
  mediaKey: "q-1-image",
  sourceKind: "official",
  mediaType: "image",
  originalFilename: "q-1.jpg",
  resolvedFilename: "q-1.jpg",
  matchStrategy: "exact",
  storageBucket: "questions",
  storagePath: "pl/q-1.jpg",
  posterStorageBucket: null,
  posterStoragePath: null,
} as const;

describe("mapSupabaseQuestionV2RecordToLocalQuestion", () => {
  it("preserves Polish localized content, option ids, topics and R2 asset references", () => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion({
      id: "v2-id",
      source_id: "PL-001",
      source_row_number: 1,
      points: 3,
      answer_kind: "choice",
      correct_option_id: "B",
      scope: "base",
      primary_topic_id: "signs_signals",
      topic_ids: ["signs_signals"],
      difficulty_seed: 42,
      official_metadata: { legacy_topic_block: "signs" },
      ai_explanations: { pl: "Wyjaśnienie" },
      content: {
        prompt: { pl: "Pytanie", ua: "Питання" },
        question_media: [{ role: "primary", asset }],
        options: [
          { id: "A", text: { pl: "Nie" } },
          { id: "B", text: { pl: "Tak" }, media: [{ role: "pjm-answer", asset }] },
        ],
      },
    });

    expect(question.id).toBe("PL-001");
    expect(question.answerType).toBe("abc");
    expect(question.correctAnswer).toBe("B");
    expect(question.prompt.ua).toBe("Питання");
    expect(question.explanation.pl).toBe("Wyjaśnienie");
    expect(question.choices?.map((option) => option.id)).toEqual(["A", "B"]);
    expect(question.media?.asset.storagePath).toBe("pl/q-1.jpg");
    expect(question.primaryTopicId).toBe("signs_signals");
  });

  it("keeps a two-option choice payload valid for future Czech sets", () => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion({
      id: "cz-id", source_id: "CZ-001", source_row_number: 1, points: 1,
      answer_kind: "choice", correct_option_id: "A", scope: null,
      primary_topic_id: null, topic_ids: [], difficulty_seed: null,
      content: { prompt: { cs: "Dotaz" }, options: [{ id: "A", text: { cs: "Ano" } }, { id: "B", text: { cs: "Ne" } }] },
    });

    expect(question.choices).toHaveLength(2);
    expect(question.prompt.cs).toBe("Dotaz");
    expect(question.choices?.[0]?.text.cs).toBe("Ano");
    expect(question.correctAnswer).toBe("A");
  });
});

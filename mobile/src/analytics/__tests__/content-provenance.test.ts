import type { ContentLocale, SupportedLocale } from "@prawko/config";

import {
  mapSupabaseQuestionRecordToLocalQuestion, mapSupabaseQuestionV2RecordToLocalQuestion,
  type SupabaseQuestionRecord, type SupabaseQuestionV2Record,
} from "../../features/questions/supabase-question-record";
import { getLocalizedText, getQuestionChoices } from "../../features/questions/question-engine";
import {
  contentFingerprint, getExplanationDisplayProperties, getQuestionContentProperties, getQuestionRevision,
} from "../content-revisions";
import { withQuestionContentProvenance } from "../content-provenance";

const locales = ["pl", "ua", "en", "de", "cs", "el", "sk"] as const;

function v2(prompt: Record<string, string>, explanation: Record<string, string> = {}): SupabaseQuestionV2Record {
  return {
    id: "record-id", source_id: "q-1", source_row_number: 1, points: 1,
    answer_kind: "choice", correct_option_id: "A", scope: "base",
    primary_topic_id: null, topic_ids: [], difficulty_seed: 1,
    ai_explanations: explanation,
    content: { prompt, options: [{ id: "A", text: prompt }, { id: "B", text: { en: "Other choice" } }] },
  };
}

function v1(overrides: Partial<SupabaseQuestionRecord> = {}): SupabaseQuestionRecord {
  return {
    question_source_id: "v1-q", source_row_number: 1, question_pl: "Polish prompt",
    question_ua: null, question_en: null, question_de: null,
    explanation_pl: "Legacy Polish explanation", explanation_ua: null, explanation_en: null,
    answer_type: "abc", correct_answer: "A", points: 1, scope: "base", topic_block: "safety",
    primary_topic_id: null, topic_ids: [], difficulty_seed: 1,
    option_a: "A", option_b: "B", option_c: "C",
    option_a_ua: null, option_b_ua: null, option_c_ua: null,
    option_a_en: null, option_b_en: null, option_c_en: null,
    option_a_de: null, option_b_de: null, option_c_de: null,
    media_asset: null, pjm_question_asset: null,
    pjm_answer_a_asset: null, pjm_answer_b_asset: null, pjm_answer_c_asset: null,
    ...overrides,
  };
}

// The pre-provenance mapper fallback is an independent product regression oracle.
function originalFallback(values: Partial<Record<ContentLocale, string>>) {
  const nonEmpty = (value: string | undefined) => typeof value === "string" && value.trim() ? value : undefined;
  const last = nonEmpty(values.cs) ?? nonEmpty(values.el) ?? nonEmpty(values.sk) ?? "";
  const pl = nonEmpty(values.pl) ?? last;
  const en = nonEmpty(values.en) ?? pl;
  return {
    pl, ua: nonEmpty(values.ua) ?? pl, en, de: nonEmpty(values.de) ?? en,
    cs: nonEmpty(values.cs) ?? en, el: nonEmpty(values.el) ?? en, sk: nonEmpty(values.sk) ?? en,
  };
}

describe("mapped source-language provenance", () => {
  it("does not change any v2 locale fallback for all 128 presence combinations", () => {
    for (let mask = 0; mask < 128; mask += 1) {
      const input = Object.fromEntries(locales.flatMap((locale, index) =>
        mask & (1 << index) ? [[locale, `source-${locale}`]] : []));
      const question = mapSupabaseQuestionV2RecordToLocalQuestion(v2(input, input));
      expect(question.prompt).toEqual(originalFallback(input));
      expect(question.explanation).toEqual(originalFallback(input));
      expect(question.choices?.[0]?.text).toEqual(originalFallback(input));
      expect(question.correctAnswer).toBe("A");
      expect(question.points).toBe(1);
    }
  });

  it.each(["cs", "sk"] as const)("observes %s source copied into ua/en instead of calling it a translation", (source) => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion(v2({ [source]: "Source prompt" }, { [source]: "Source explanation" }));
    for (const locale of ["ua", "en"] as SupportedLocale[]) {
      expect(getLocalizedText(question.prompt, locale)).toBe("Source prompt");
      const properties = getQuestionContentProperties(question, locale);
      expect(properties.content_language).toBe(locale);
      expect(properties.content_source_language).toBe(source);
      expect(properties.explanation_source_language).toBe(source);
      expect(properties.content_source_language_basis).toBe("mapper_fallback_provenance");
      expect(properties.choice_source_languages).toBe(["en", source].sort().join(","));
      expect(properties.choice_unknown_source_count).toBe(0);
      expect(JSON.stringify(properties)).not.toContain("Source prompt");
      expect(getQuestionChoices(question, locale)[0]?.label).toBe("Source prompt");
    }
  });

  it("reports declared locale provenance, not guessed language from equal strings", () => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion(v2({ pl: "Same", en: "Same", cs: "Same" }));
    expect(getQuestionContentProperties(question, "en").content_source_language).toBe("en");
    expect(getQuestionContentProperties(question, "cs").content_source_language).toBe("cs");
    expect(getQuestionContentProperties(question, "ua").content_source_language).toBe("pl");
  });

  it("keeps v1 AI priority, trimmed AI text and inherited legacy English provenance", () => {
    const question = mapSupabaseQuestionRecordToLocalQuestion(v1({
      ai_explanations: { pl: "  AI Polish  ", cs: " AI Czech ", sk: "Unused v1 Slovak" },
      explanation_en: "Legacy English",
    }));
    expect(question.explanation.pl).toBe("AI Polish");
    expect(question.explanation.cs).toBe("AI Czech");
    expect(question.explanation.de).toBe("Legacy English");
    expect(question.explanation.sk).toBe("Legacy English");
    expect(getQuestionContentProperties(question, "ua")).toMatchObject({
      explanation_source_language: "pl", explanation_source_kind: "ai_explanation",
    });
    expect(getQuestionContentProperties(question, "de")).toMatchObject({
      explanation_source_language: "en", explanation_source_kind: "legacy_explanation",
    });
    expect(getQuestionContentProperties(question, "cs").explanation_source_language).toBe("cs");
    expect(getQuestionContentProperties(question, "sk").explanation_source_language).toBe("en");
  });

  it("preserves blank legacy coalescing before the final non-empty fallback", () => {
    const question = mapSupabaseQuestionRecordToLocalQuestion(v1({
      explanation_ua: "", explanation_en: "  ", ai_explanations: { pl: "AI PL", ua: " " },
    }));
    expect(question.explanation.ua).toBe("AI PL");
    expect(question.explanation.en).toBe("AI PL");
    expect(getQuestionContentProperties(question, "ua").explanation_source_language).toBe("pl");
    expect(getQuestionContentProperties(question, "en").explanation_source_language).toBe("pl");
  });

  it("survives JSON cache roundtrip, without backfilling old caches or changing question revision", () => {
    const mapped = mapSupabaseQuestionV2RecordToLocalQuestion(v2({ cs: "Source" }));
    const restored = JSON.parse(JSON.stringify(mapped));
    expect(getQuestionContentProperties(restored, "ua").content_source_language).toBe("cs");
    const { contentProvenance: _provenance, ...oldCache } = restored;
    expect(getQuestionContentProperties(oldCache, "ua")).toMatchObject({
      content_source_language: null, content_source_language_basis: "not_recorded", content_language: "ua",
    });
    expect(getQuestionRevision(mapped)).toBe(getQuestionRevision(oldCache));
  });

  it("does not reuse provenance after a field's text changes, or accept array-shaped source IDs", () => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion(v2({ cs: "Source" }));
    const changed = { ...question, prompt: { ...question.prompt, ua: "New text" } };
    expect(getQuestionContentProperties(changed, "ua")).toMatchObject({
      content_source_language: null, content_source_language_basis: "provenance_revision_mismatch",
    });
    const corrupt = JSON.parse(JSON.stringify(question));
    corrupt.contentProvenance.prompt.ua.sourceLocale = ["cs"];
    expect(getQuestionContentProperties(corrupt, "ua").content_source_language).toBeNull();
  });

  it("keeps product content when optional source reading fails after mapping", () => {
    let reads = 0;
    const prompt = Object.defineProperty({}, "pl", {
      enumerable: true,
      get: () => {
        reads += 1;
        if (reads > 1) throw new Error("provenance-only failure");
        return "Original";
      },
    });
    const record = v2(prompt);
    record.content.options![0]!.text = { pl: "Plain option" };
    const question = mapSupabaseQuestionV2RecordToLocalQuestion(record);
    expect(question.prompt.pl).toBe("Original");
    expect(question.correctAnswer).toBe("A");
    expect(question.contentProvenance).toBeUndefined();
    expect(withQuestionContentProvenance(question, () => { throw new Error("observation"); })).toBe(question);
  });

  it("contains optional observation failures instead of throwing into a render effect", () => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion(v2({ pl: "Original" }));
    Object.defineProperty(question, "contentProvenance", { get: () => { throw new Error("bad metadata"); } });
    expect(getQuestionContentProperties(question, "pl").content_observation_status).toBe("failed");
    Object.defineProperty(question, "explanation", { get: () => { throw new Error("bad display data"); } });
    expect(getExplanationDisplayProperties(question, "pl", "full").explanation_rendered_state).toBe("not_observed");
  });
});

describe("rendered explanation revisions", () => {
  it("separates the displayed value and variant from the multilingual catalogue hash", () => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion(v2({ pl: "Prompt" }, { pl: "PL text", en: "EN text" }));
    const full = getExplanationDisplayProperties(question, "pl", "full", "PL text");
    const preview = getExplanationDisplayProperties(question, "pl", "free_topic_marked", "PL text");
    expect(full.explanation_display_revision).toBe(contentFingerprint("PL text"));
    expect(preview.explanation_display_revision).toBe(full.explanation_display_revision);
    expect(preview.explanation_display_variant).toBe("free_topic_marked");
    expect(getExplanationDisplayProperties(question, "en", "full").explanation_display_revision)
      .not.toBe(full.explanation_display_revision);
    expect(getExplanationDisplayProperties(question, "pl", "locked", "PL text")).toMatchObject({
      explanation_rendered_state: "locked", explanation_display_revision: null,
    });
    expect(JSON.stringify(full)).not.toContain("PL text");
  });

  it("records empty or differently rendered values without altering the UI text", () => {
    const question = mapSupabaseQuestionV2RecordToLocalQuestion(v2({ pl: "Prompt" }, { pl: "Original" }));
    expect(getExplanationDisplayProperties(question, "pl", "full", "")).toMatchObject({
      explanation_rendered_state: "empty", explanation_display_revision: null,
      explanation_display_matches_selected_field: false,
    });
    expect(getExplanationDisplayProperties(question, "pl", "full", "Rendered variant")).toMatchObject({
      explanation_display_revision: contentFingerprint("Rendered variant"),
      explanation_display_matches_selected_field: false,
    });
    expect(question.explanation.pl).toBe("Original");
  });
});

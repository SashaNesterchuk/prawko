import type { LocalQuestion, LocalizedQuestionText } from "../../features/questions/types";
import { contentFingerprint, getDisplayedContentLocale, getMediaRevision, getQuestionContentProperties } from "../content-revisions";

function text(value: string): LocalizedQuestionText {
  return { pl: value, en: "", ua: "", de: "" };
}
function question(): LocalQuestion {
  return {
    id: "q-1", sourceRowNumber: 1, prompt: text("Prompt"), explanation: text("Explanation"),
    answerType: "boolean", correctAnswer: "true", points: 3,
    scope: "base", topicBlock: "A", difficultySeed: 1,
  } as LocalQuestion;
}

describe("analytics content fingerprints", () => {
  it("does not depend on object key order, but does depend on content", () => {
    expect(contentFingerprint({ a: 1, b: "text" })).toBe(contentFingerprint({ b: "text", a: 1 }));
    expect(contentFingerprint({ a: 1 })).not.toBe(contentFingerprint({ a: 2 }));
  });

  it("reports the actual fallback language, not just the UI language", () => {
    const content = { ...text("Polish"), cs: "Czech" };
    expect(getDisplayedContentLocale(content, "ua")).toBe("pl");
    expect(getDisplayedContentLocale({ ...text(""), cs: "Czech" }, "en")).toBe("cs");
    expect(getDisplayedContentLocale(content, "cs")).toBe("cs");
    expect(getDisplayedContentLocale(text(""), "en")).toBeNull();
  });

  it("separates question and explanation revisions without exporting either text or answer", () => {
    const original = question();
    const before = getQuestionContentProperties(original, "en");
    const explanationChanged = getQuestionContentProperties({ ...original, explanation: text("New explanation") }, "en");
    const answerChanged = getQuestionContentProperties({ ...original, correctAnswer: "false" }, "en");
    expect(explanationChanged.question_revision).toBe(before.question_revision);
    expect(explanationChanged.explanation_revision).not.toBe(before.explanation_revision);
    expect(answerChanged.question_revision).not.toBe(before.question_revision);
    expect(JSON.stringify(before)).not.toMatch(/Prompt|Explanation|correctAnswer/);
    expect(before.content_language).toBe("pl");
    expect(before.content_requested_locale).toBe("en");
    expect(getMediaRevision(null)).toBeNull();
  });
});

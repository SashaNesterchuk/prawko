import type { ContentLocale } from "@prawko/config";

import type { LocalQuestion, LocalizedQuestionText } from "../features/questions/types";
import { contentFingerprint } from "./content-revisions";

export type ContentSourceKind = "question_content" | "ai_explanation" | "legacy_explanation";
export type SourceText = {
  text: string | null | undefined;
  locale: ContentLocale;
  kind: ContentSourceKind;
};
export type SourceTextMap = Partial<Record<ContentLocale, SourceText | null>>;
export type TextProvenanceMap = Partial<Record<ContentLocale, {
  sourceLocale: ContentLocale | null;
  sourceKind: ContentSourceKind | null;
  textRevision: string;
  basis: "mapper_fallback" | "no_text" | "mapper_output_mismatch";
}>>;
export type QuestionContentProvenance = {
  version: 1;
  prompt: TextProvenanceMap;
  explanation: TextProvenanceMap;
  choices: Partial<Record<string, TextProvenanceMap>>;
};

export function sourceText(
  text: string | null | undefined, locale: ContentLocale, kind: ContentSourceKind,
): SourceText {
  return { text, locale, kind };
}

export function firstDefinedSource(...sources: (SourceText | null | undefined)[]) {
  // Preserve nullish coalescing: a present blank legacy value stops this chain.
  return sources.find((source) => source?.text !== null && source?.text !== undefined) ?? null;
}

function nonEmpty(source: SourceText | null | undefined) {
  return typeof source?.text === "string" && source.text.trim() ? source : null;
}

function fallbackSources(sources: SourceTextMap): SourceTextMap {
  const last = nonEmpty(sources.cs) ?? nonEmpty(sources.el) ?? nonEmpty(sources.sk);
  const pl = nonEmpty(sources.pl) ?? last;
  const en = nonEmpty(sources.en) ?? pl;
  return {
    pl, ua: nonEmpty(sources.ua) ?? pl, en, de: nonEmpty(sources.de) ?? en,
    cs: nonEmpty(sources.cs) ?? en, el: nonEmpty(sources.el) ?? en, sk: nonEmpty(sources.sk) ?? en,
  };
}

/** Adds only provenance. The mapper's rendered text and fallback remain authoritative. */
export function withQuestionContentProvenance(
  question: LocalQuestion,
  input: { prompt: SourceTextMap; explanation: SourceTextMap; choices?: Partial<Record<string, SourceTextMap>> }
    | (() => { prompt: SourceTextMap; explanation: SourceTextMap; choices?: Partial<Record<string, SourceTextMap>> }),
): LocalQuestion {
  try {
    const sources = typeof input === "function" ? input() : input;
    const revisions = new Map<string, string>();
    function describe(text: LocalizedQuestionText, input: SourceTextMap): TextProvenanceMap {
      const fallback = fallbackSources(input);
      return Object.fromEntries(Object.entries(text).map(([field, actual]) => {
        const source = fallback[field as ContentLocale];
        const agrees = actual === (source?.text ?? "");
        const hasText = Boolean(actual);
        let revision = revisions.get(actual);
        if (!revision) {
          revision = contentFingerprint(actual);
          revisions.set(actual, revision);
        }
        return [field, {
          sourceLocale: agrees && hasText ? source?.locale ?? null : null,
          sourceKind: agrees && hasText ? source?.kind ?? null : null,
          textRevision: revision,
          basis: !agrees ? "mapper_output_mismatch" : hasText ? "mapper_fallback" : "no_text",
        }];
      }));
    }
    return {
      ...question,
      contentProvenance: {
        version: 1,
        prompt: describe(question.prompt, sources.prompt),
        explanation: describe(question.explanation, sources.explanation),
        choices: Object.fromEntries((question.choices ?? []).map((choice) => [
          choice.id, describe(choice.text, sources.choices?.[choice.id] ?? {}),
        ])),
      },
    };
  } catch {
    return question;
  }
}

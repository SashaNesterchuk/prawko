import { getContentLocale, type ContentLocale, type SupportedLocale } from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

import type { AnalyticsProperties } from "./catalog";
import type { LocalQuestion, LocalizedQuestionText } from "../features/questions/types";
import type { TextProvenanceMap } from "./content-provenance";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Stable, non-security content fingerprint. Never exports the source text. */
export function contentFingerprint(value: unknown): string {
  const text = canonical(value);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `content-v1:${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

export function getDisplayedContentLocale(text: LocalizedQuestionText, locale: SupportedLocale) {
  // Same ordered fallback as getLocalizedText; UI selection is unchanged.
  const requested = getContentLocale(locale);
  return [requested, "en", "ua", "pl", "de", "cs", "el", "sk"]
    .find((key) => Boolean(text[key as keyof LocalizedQuestionText])) ?? null;
}

export function getMediaRevision(asset: QuestionDeliveryAsset | null | undefined) {
  return asset ? contentFingerprint({
    mediaKey: asset.mediaKey, mediaType: asset.mediaType, sourceKind: asset.sourceKind,
    storageBucket: asset.storageBucket, storagePath: asset.storagePath,
    posterStorageBucket: asset.posterStorageBucket, posterStoragePath: asset.posterStoragePath,
  }) : null;
}

export function getQuestionRevision(question: LocalQuestion) {
  return contentFingerprint({
    id: question.id, prompt: question.prompt, answerType: question.answerType,
    choices: question.choices, correctAnswer: question.correctAnswer,
    points: question.points, scope: question.scope, topicBlock: question.topicBlock,
    primaryTopicId: question.primaryTopicId, topicIds: question.topicIds,
    examBasketId: question.examBasketId,
  });
}

export function getQuestionContentProperties(question: LocalQuestion, locale: SupportedLocale): AnalyticsProperties {
  try {
    return questionContentProperties(question, locale);
  } catch {
    return {
      content_provenance_version: 1, content_observation_status: "failed",
      content_source_language: null, explanation_source_language: null,
      content_source_language_basis: "observation_failed", explanation_source_language_basis: "observation_failed",
      content_text_field: null, explanation_text_field: null,
      content_source_kind: null, explanation_source_kind: null,
      choice_source_languages: null, choice_unknown_source_count: null,
      content_source_language_verification: "declared_input_locale_not_language_detection",
    };
  }
}

function questionContentProperties(question: LocalQuestion, locale: SupportedLocale): AnalyticsProperties {
  const prompt = getTextSourceProperties(question.prompt, locale, question.contentProvenance?.version === 1
    ? question.contentProvenance.prompt : undefined);
  const explanation = getTextSourceProperties(question.explanation, locale, question.contentProvenance?.version === 1
    ? question.contentProvenance.explanation : undefined);
  const choices = (question.choices ?? []).map((choice) => getTextSourceProperties(
    choice.text, locale, question.contentProvenance?.version === 1 ? question.contentProvenance.choices?.[choice.id] : undefined,
  ));
  return {
    question_revision: getQuestionRevision(question),
    explanation_revision: contentFingerprint(question.explanation),
    media_revision: getMediaRevision(question.media?.asset),
    media_revision_basis: question.media ? "asset_descriptor" : "no_media",
    content_requested_locale: locale,
    content_language: getDisplayedContentLocale(question.prompt, locale),
    explanation_language: getDisplayedContentLocale(question.explanation, locale),
    content_language_basis: "selected_text_field",
    content_revision_algorithm: "content-v1",
    content_provenance_version: 1,
    content_observation_status: "observed",
    content_text_field: prompt.field,
    content_source_language: prompt.language,
    content_source_kind: prompt.kind,
    content_source_language_basis: prompt.basis,
    explanation_text_field: explanation.field,
    explanation_source_language: explanation.language,
    explanation_source_kind: explanation.kind,
    explanation_source_language_basis: explanation.basis,
    choice_source_languages: [...new Set(choices.map((choice) => choice.language).filter(Boolean))].sort().join(",") || null,
    choice_unknown_source_count: choices.filter((choice) => choice.language === null).length,
    content_source_language_verification: "declared_input_locale_not_language_detection",
  };
}

function getTextSourceProperties(text: LocalizedQuestionText, locale: SupportedLocale, provenance: TextProvenanceMap | undefined) {
  const field = getDisplayedContentLocale(text, locale) as ContentLocale | null;
  const source = field ? provenance?.[field] : undefined;
  const revision = field ? contentFingerprint(text[field]) : null;
  const languages = ["pl", "ua", "en", "de", "cs", "el", "sk"];
  const kinds = ["question_content", "ai_explanation", "legacy_explanation"];
  const trusted = source?.basis === "mapper_fallback" && source.textRevision === revision
    && typeof source.sourceLocale === "string" && languages.includes(source.sourceLocale)
    && typeof source.sourceKind === "string" && kinds.includes(source.sourceKind);
  return {
    field, language: trusted ? source.sourceLocale : null, kind: trusted ? source.sourceKind : null,
    basis: field === null ? "no_text" : !source ? "not_recorded" : trusted ? "mapper_fallback_provenance"
      : source.textRevision !== revision ? "provenance_revision_mismatch" : "unverified_mapper_output",
  };
}

export function getExplanationDisplayProperties(
  question: LocalQuestion,
  locale: SupportedLocale,
  variant: "full" | "free_topic_marked" | "locked",
  visibleText?: string | null,
): AnalyticsProperties {
  try {
    const field = getDisplayedContentLocale(question.explanation, locale) as ContentLocale | null;
    const selected = field ? question.explanation[field] ?? "" : "";
    const displayed = variant === "locked" ? null : visibleText === undefined ? selected : visibleText;
    return {
      explanation_display_observation_version: 1,
      explanation_display_variant: variant,
      explanation_rendered_state: variant === "locked" ? "locked" : displayed ? "text" : "empty",
      explanation_display_revision: displayed ? contentFingerprint(displayed) : null,
      explanation_display_revision_basis: "rendered_text_value",
      explanation_display_matches_selected_field: displayed === null ? null : displayed === selected,
    };
  } catch {
    return {
      explanation_display_observation_version: 1,
      explanation_display_variant: variant, explanation_rendered_state: "not_observed",
      explanation_display_revision: null, explanation_display_revision_basis: "observation_failed",
      explanation_display_matches_selected_field: null,
    };
  }
}

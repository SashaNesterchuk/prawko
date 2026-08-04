import path from "node:path";

import type { SupportedLocale } from "@prawko/config";
import type { TranslationOverlayEntry } from "@prawko/schemas";
import { translationOverlayEntrySchema } from "@prawko/schemas";

import { RAW_TRANSLATIONS_DIR } from "./constants";
import type { OverlayCollection, ValidationIssue } from "./types";
import { pathExists, readJsonFile } from "./utils";

const overlayLocales: SupportedLocale[] = ["pl", "ua", "en", "de"];

async function loadOverlayFile(
  filePath: string
): Promise<{ entries: Map<string, TranslationOverlayEntry>; issues: ValidationIssue[] }> {
  if (!(await pathExists(filePath))) {
    return {
      entries: new Map(),
      issues: [],
    };
  }

  let payload: unknown;
  try {
    payload = await readJsonFile<unknown>(filePath);
  } catch {
    return {
      entries: new Map(),
      issues: [
        {
          severity: "warning",
          code: "invalid_overlay_json",
          message: `Overlay file is not valid JSON: ${filePath}`,
        },
      ],
    };
  }

  const parsed = translationOverlayEntrySchema.array().safeParse(payload);

  if (!parsed.success) {
    return {
      entries: new Map(),
      issues: [
        {
          severity: "warning",
          code: "invalid_overlay_format",
          message: `Overlay file has invalid format: ${filePath}`,
        },
      ],
    };
  }

  return {
    entries: new Map(
      parsed.data.map((entry) => [entry.questionSourceId, entry] as const)
    ),
    issues: [],
  };
}

export async function loadTranslationOverlays(): Promise<OverlayCollection> {
  const questions: OverlayCollection["questions"] = {};
  const explanations: OverlayCollection["explanations"] = {};
  const issues: ValidationIssue[] = [];

  for (const locale of overlayLocales) {
    const questionFile = path.join(
      RAW_TRANSLATIONS_DIR,
      `questions.${locale}.json`
    );
    const explanationFile = path.join(
      RAW_TRANSLATIONS_DIR,
      `explanations.${locale}.json`
    );

    const [questionOverlay, explanationOverlay] = await Promise.all([
      loadOverlayFile(questionFile),
      loadOverlayFile(explanationFile),
    ]);

    questions[locale] = questionOverlay.entries;
    explanations[locale] = explanationOverlay.entries;
    issues.push(...questionOverlay.issues, ...explanationOverlay.issues);
  }

  return {
    questions,
    explanations,
    issues,
  };
}

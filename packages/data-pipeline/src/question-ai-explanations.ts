import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { EXPORTS_GENERATED_DIR } from "./constants";
import { loadLocalEnvFiles } from "./env";
import type { PipelineOptions } from "./types";
import { relativeToRepo, writeJsonFile } from "./utils";

const EXPLANATION_VERSION = "2026-08-17-ua-decision-reasoning-v3";
const DEFAULT_GENERATION_BATCH_SIZE = 12;
const DEFAULT_WRITE_BATCH_SIZE = 200;
const DEFAULT_CONCURRENCY = 3;
const PAGE_SIZE = 1_000;
const MAX_GENERATION_ATTEMPTS = 3;

type ExistingExplanationRow = {
  available_locales: string[];
  explanation_version: string;
  explanations: Record<string, unknown>;
  has_media: boolean;
  media_type: "image" | "video" | null;
  question_source_id: string;
  source_context_updated_at: string | null;
  source_context_version: string | null;
  source_row_number: number;
};

type QuestionRow = {
  answer_type: "abc" | "boolean";
  correct_answer: string;
  media_type: "image" | "video" | null;
  option_a: string | null;
  option_a_ua: string | null;
  option_b: string | null;
  option_b_ua: string | null;
  option_c: string | null;
  option_c_ua: string | null;
  primary_topic_id: string | null;
  question_pl: string;
  question_source_id: string;
  question_ua: string | null;
  source_row_number: number;
  topic_block: string;
};

type ContextRow = {
  ai_context: string;
  context_version: string;
  question_source_id: string;
  source_updated_at: string | null;
};

type ExplanationSource = {
  context: ContextRow | null;
  existing: ExistingExplanationRow;
  question: QuestionRow;
};

type GeneratedExplanation = {
  explanation: string;
  questionSourceId: string;
  signCodes: string[];
};

type GenerationFailure = {
  error: string;
  questionSourceIds: string[];
};

type RewriteReport = {
  completedAt: string;
  dryRun: boolean;
  explanationVersion: string;
  failedQuestionSourceIds: string[];
  generatedRows: number;
  inputRows: number;
  model: string;
  provider: "anthropic" | "openai";
  skippedCurrentVersionRows: number;
  syncedRows: number;
  validation: VerificationResult;
};

export type LocaleCleanupResult = {
  cleanedRows: number;
  rowCount: number;
  validation: VerificationResult;
};

export type VerificationResult = {
  invalidLocaleRows: string[];
  invalidSignReferences: string[];
  invalidTextRows: string[];
  missingUkrainianRows: string[];
  rowCount: number;
  valid: boolean;
};

type ApiProvider = {
  model: string;
  provider: "anthropic" | "openai";
};

export async function rewriteQuestionAiExplanations(
  options: PipelineOptions = {}
): Promise<RewriteReport> {
  await loadLocalEnvFiles();

  const supabase = createSupabaseClient();
  const provider = resolveApiProvider();
  const [existingRows, questionRows, contextRows] = await Promise.all([
    fetchAllExistingExplanationRows(supabase),
    fetchAllQuestionRows(supabase),
    fetchAllContextRows(supabase),
  ]);
  const questionsById = new Map(
    questionRows.map((question) => [question.question_source_id, question])
  );
  const contextsById = new Map(
    contextRows.map((context) => [context.question_source_id, context])
  );
  const sourceRows = existingRows
    .sort((left, right) => left.source_row_number - right.source_row_number)
    .flatMap((existing) => {
      const question = questionsById.get(existing.question_source_id);

      if (!question) {
        throw new Error(
          `Question ${existing.question_source_id} has an AI explanation but no source question.`
        );
      }

      return [
        {
          existing,
          question,
          context: contextsById.get(existing.question_source_id) ?? null,
        } satisfies ExplanationSource,
      ];
    });
  const skippedCurrentVersionRows = sourceRows.filter(
    (source) => source.existing.explanation_version === EXPLANATION_VERSION
  ).length;
  const pendingRows = sourceRows.filter(
    (source) => source.existing.explanation_version !== EXPLANATION_VERSION
  );
  const limitedRows =
    typeof options.limit === "number" && options.limit > 0
      ? pendingRows.slice(0, options.limit)
      : pendingRows;
  const generatedOutputPath = path.join(
    EXPORTS_GENERATED_DIR,
    "question-ai-explanations.ua.generated.json"
  );
  const reportPath = path.join(
    EXPORTS_GENERATED_DIR,
    "question-ai-explanations.ua-rewrite-report.json"
  );

  const { generated, failures } = await generateExplanations(
    provider,
    limitedRows,
    options.batchSize ?? DEFAULT_GENERATION_BATCH_SIZE
  );

  await writeJsonFile(generatedOutputPath, {
    explanationVersion: EXPLANATION_VERSION,
    generatedAt: new Date().toISOString(),
    model: provider.model,
    provider: provider.provider,
    rows: generated,
  });

  if (failures.length > 0) {
    const report: RewriteReport = {
      completedAt: new Date().toISOString(),
      dryRun: Boolean(options.dryRun),
      explanationVersion: EXPLANATION_VERSION,
      failedQuestionSourceIds: failures.flatMap(
        (failure) => failure.questionSourceIds
      ),
      generatedRows: generated.length,
      inputRows: limitedRows.length,
      model: provider.model,
      provider: provider.provider,
      skippedCurrentVersionRows,
      syncedRows: 0,
      validation: emptyVerificationResult(),
    };
    await writeJsonFile(reportPath, {
      ...report,
      failures,
      generatedOutputPath: relativeToRepo(generatedOutputPath),
    });
    throw new Error(
      `Generation failed for ${report.failedQuestionSourceIds.length} questions. No database rows were changed. See ${relativeToRepo(reportPath)}.`
    );
  }

  let syncedRows = 0;
  if (!options.dryRun && generated.length > 0) {
    const generatedById = new Map(
      generated.map((item) => [item.questionSourceId, item])
    );
    const rowsToUpsert = limitedRows.map((source) =>
      buildUpdatedExplanationRow(source, generatedById.get(source.question.question_source_id)!, provider)
    );

    for (const batch of chunkRows(rowsToUpsert, DEFAULT_WRITE_BATCH_SIZE)) {
      const { error } = await supabase
        .from("question_ai_explanations")
        .upsert(batch, {
          ignoreDuplicates: false,
          onConflict: "question_source_id",
        });

      if (error) {
        throw new Error(
          `Unable to save Ukrainian AI explanations: ${error.message}`
        );
      }

      syncedRows += batch.length;
    }
  }

  const validation = options.dryRun
    ? verifyRows(
        sourceRows.map((source) => {
          const generatedExplanation = generated.find(
            (item) => item.questionSourceId === source.question.question_source_id
          );

          return generatedExplanation
            ? {
                ...source.existing,
                available_locales: ["ua"],
                explanation_version: EXPLANATION_VERSION,
                explanations: {
                  ua: generatedExplanation.explanation,
                },
              }
            : source.existing;
        })
      )
    : await verifyQuestionAiExplanations();
  const report: RewriteReport = {
    completedAt: new Date().toISOString(),
    dryRun: Boolean(options.dryRun),
    explanationVersion: EXPLANATION_VERSION,
    failedQuestionSourceIds: [],
    generatedRows: generated.length,
    inputRows: limitedRows.length,
    model: provider.model,
    provider: provider.provider,
    skippedCurrentVersionRows,
    syncedRows,
    validation,
  };
  await writeJsonFile(reportPath, {
    ...report,
    generatedOutputPath: relativeToRepo(generatedOutputPath),
  });

  if (!validation.valid) {
    throw new Error(
      `The explanation rewrite completed but validation failed. See ${relativeToRepo(reportPath)}.`
    );
  }

  return report;
}

export async function verifyQuestionAiExplanations(): Promise<VerificationResult> {
  await loadLocalEnvFiles();

  const supabase = createSupabaseClient();
  const rows = await fetchAllExistingExplanationRows(supabase);

  return verifyRows(rows);
}

export async function keepOnlyUkrainianQuestionAiExplanations(): Promise<LocaleCleanupResult> {
  await loadLocalEnvFiles();

  const supabase = createSupabaseClient();
  const rows = await fetchAllExistingExplanationRows(supabase);
  const updates = rows.map((row) => {
    const ukrainianExplanation =
      typeof row.explanations.ua === "string"
        ? row.explanations.ua.replace(/\s+/g, " ").trim()
        : "";

    if (!ukrainianExplanation) {
      throw new Error(
        `Question ${row.question_source_id} cannot be cleaned because it has no Ukrainian explanation.`
      );
    }

    return {
      available_locales: ["ua"],
      explanation_version: row.explanation_version,
      explanations: {
        ua: ukrainianExplanation,
      },
      has_media: row.has_media,
      media_type: row.media_type,
      question_source_id: row.question_source_id,
      source_row_number: row.source_row_number,
    };
  });

  for (const batch of chunkRows(updates, DEFAULT_WRITE_BATCH_SIZE)) {
    const { error } = await supabase
      .from("question_ai_explanations")
      .upsert(batch, {
        ignoreDuplicates: false,
        onConflict: "question_source_id",
      });

    if (error) {
      throw new Error(`Unable to keep Ukrainian explanations: ${error.message}`);
    }
  }

  const validation = await verifyQuestionAiExplanations();
  const result: LocaleCleanupResult = {
    cleanedRows: updates.length,
    rowCount: rows.length,
    validation,
  };
  const reportPath = path.join(
    EXPORTS_GENERATED_DIR,
    "question-ai-explanations.ua-locale-cleanup-report.json"
  );
  await writeJsonFile(reportPath, result);

  return result;
}

function createSupabaseClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Expected SUPABASE_SERVICE_ROLE_KEY and a Supabase URL."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function resolveApiProvider(): ApiProvider {
  const requestedProvider = process.env.QUESTION_AI_EXPLANATION_PROVIDER;
  const openAiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (
    (requestedProvider === "openai" || !requestedProvider) &&
    typeof openAiKey === "string" &&
    openAiKey.trim()
  ) {
    return {
      provider: "openai",
      model: firstConfiguredValue(
        process.env.QUESTION_AI_EXPLANATION_MODEL,
        process.env.OPENAI_MODEL,
        "gpt-4.1-mini"
      ),
    };
  }

  if (
    (requestedProvider === "anthropic" || !requestedProvider) &&
    typeof anthropicKey === "string" &&
    anthropicKey.trim()
  ) {
    return {
      provider: "anthropic",
      model: firstConfiguredValue(
        process.env.QUESTION_AI_EXPLANATION_MODEL,
        process.env.ANTHROPIC_MODEL,
        "claude-sonnet-4-20250514"
      ),
    };
  }

  throw new Error(
    "Missing AI credentials. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local before rewriting explanations."
  );
}

function firstConfiguredValue(...values: Array<string | undefined>) {
  return (
    values.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    ) ?? ""
  );
}

async function fetchAllExistingExplanationRows(
  supabase: ReturnType<typeof createSupabaseClient>
) {
  const rows: ExistingExplanationRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("question_ai_explanations")
      .select(
        [
          "available_locales",
          "explanation_version",
          "explanations",
          "has_media",
          "media_type",
          "question_source_id",
          "source_context_updated_at",
          "source_context_version",
          "source_row_number",
        ].join(", ")
      )
      .order("source_row_number", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to read AI explanations: ${error.message}`);
    }

    const page = (data ?? []) as unknown as ExistingExplanationRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchAllQuestionRows(
  supabase: ReturnType<typeof createSupabaseClient>
) {
  const rows: QuestionRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("questions")
      .select(
        [
          "answer_type",
          "correct_answer",
          "media_type",
          "option_a",
          "option_a_ua",
          "option_b",
          "option_b_ua",
          "option_c",
          "option_c_ua",
          "primary_topic_id",
          "question_pl",
          "question_source_id",
          "question_ua",
          "source_row_number",
          "topic_block",
        ].join(", ")
      )
      .order("source_row_number", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to read source questions: ${error.message}`);
    }

    const page = (data ?? []) as unknown as QuestionRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchAllContextRows(
  supabase: ReturnType<typeof createSupabaseClient>
) {
  const rows: ContextRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("question_ai_contexts")
      .select(
        [
          "ai_context",
          "context_version",
          "question_source_id",
          "source_updated_at",
        ].join(", ")
      )
      .order("source_row_number", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to read AI contexts: ${error.message}`);
    }

    const page = (data ?? []) as unknown as ContextRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function generateExplanations(
  provider: ApiProvider,
  sources: ExplanationSource[],
  batchSize: number
) {
  const batches = chunkRows(
    sources,
    Math.max(1, Math.min(batchSize, DEFAULT_GENERATION_BATCH_SIZE))
  );
  const results: Array<
    | {
        generated: GeneratedExplanation[];
        failures: GenerationFailure[];
      }
    | undefined
  > = new Array(batches.length);
  let nextBatchIndex = 0;

  const workers = Array.from(
    {
      length: Math.min(DEFAULT_CONCURRENCY, batches.length),
    },
    async () => {
      for (;;) {
        const batchIndex = nextBatchIndex;
        nextBatchIndex += 1;

        if (batchIndex >= batches.length) {
          return;
        }

        const batch = batches[batchIndex];
        try {
          results[batchIndex] = {
            generated: await generateBatchWithRetries(provider, batch),
            failures: [],
          };
        } catch (error) {
          results[batchIndex] = {
            generated: [],
            failures: [
              {
                error: error instanceof Error ? error.message : String(error),
                questionSourceIds: batch.map(
                  (source) => source.question.question_source_id
                ),
              },
            ],
          };
        }
      }
    }
  );

  await Promise.all(workers);

  return {
    generated: results.flatMap((result) => result?.generated ?? []),
    failures: results.flatMap((result) => result?.failures ?? []),
  };
}

async function generateBatchWithRetries(
  provider: ApiProvider,
  sources: ExplanationSource[]
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const content = await requestGeneratedText(provider, sources, attempt);
      const generated = parseGeneratedExplanations(content, sources);

      return generated;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}

async function requestGeneratedText(
  provider: ApiProvider,
  sources: ExplanationSource[],
  attempt: number
) {
  if (provider.provider === "openai") {
    return requestOpenAiText(provider.model, buildGenerationPrompt(sources, attempt));
  }

  return requestAnthropicText(provider.model, buildGenerationPrompt(sources, attempt));
}

async function requestOpenAiText(model: string, prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: OPENAI_SYSTEM_PROMPT,
              type: "input_text",
            },
          ],
          role: "system",
        },
        {
          content: [
            {
              text: prompt,
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      max_output_tokens: 3_000,
      model,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}.`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const content = extractOpenAiText(data);

  if (!content) {
    throw new Error("OpenAI returned no text.");
  }

  return content;
}

async function requestAnthropicText(model: string, prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      "x-api-key": apiKey ?? "",
    },
    body: JSON.stringify({
      max_tokens: 3_000,
      messages: [
        {
          content: prompt,
          role: "user",
        },
      ],
      model,
      system: ANTHROPIC_SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed with ${response.status}.`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const content = extractAnthropicText(data);

  if (!content) {
    throw new Error("Anthropic returned no text.");
  }

  return content;
}

function parseGeneratedExplanations(
  content: string,
  sources: ExplanationSource[]
) {
  const parsed = JSON.parse(stripJsonFence(content)) as {
    items?: unknown;
  };

  if (!Array.isArray(parsed.items)) {
    throw new Error('Expected a JSON object with an "items" array.');
  }

  const expectedIds = new Set(
    sources.map((source) => source.question.question_source_id)
  );
  const generatedById = new Map<string, GeneratedExplanation>();

  for (const item of parsed.items) {
    if (!item || typeof item !== "object") {
      throw new Error("Generated output contains an invalid item.");
    }

    const candidate = item as Record<string, unknown>;
    const questionSourceId =
      typeof candidate.questionSourceId === "string"
        ? candidate.questionSourceId.trim()
        : "";
    const explanation =
      typeof candidate.explanation === "string"
        ? candidate.explanation.replace(/\s+/g, " ").trim()
        : "";
    const signCodes = Array.isArray(candidate.signCodes)
      ? candidate.signCodes
          .filter((code): code is string => typeof code === "string")
          .map(normalizeSignCode)
          .filter(Boolean)
      : [];

    if (!expectedIds.has(questionSourceId)) {
      throw new Error(
        `Generated output includes an unexpected question ${questionSourceId}.`
      );
    }

    if (generatedById.has(questionSourceId)) {
      throw new Error(
        `Generated output includes question ${questionSourceId} more than once.`
      );
    }

    const generated = {
      explanation,
      questionSourceId,
      signCodes: [...new Set(signCodes)],
    };
    const source = sources.find(
      (candidate) =>
        candidate.question.question_source_id === generated.questionSourceId
    );

    validateGeneratedExplanation(generated, source!.question);
    generatedById.set(questionSourceId, generated);
  }

  if (generatedById.size !== expectedIds.size) {
    const missing = [...expectedIds].filter((id) => !generatedById.has(id));
    throw new Error(`Generated output is missing questions: ${missing.join(", ")}.`);
  }

  return sources.map(
    (source) => generatedById.get(source.question.question_source_id)!
  );
}

function validateGeneratedExplanation(
  generated: GeneratedExplanation,
  question: QuestionRow
) {
  const text = generated.explanation;

  if (text.length < 100 || text.length > 700) {
    throw new Error(
      `Question ${generated.questionSourceId} has an explanation outside the 60-700 character range.`
    );
  }

  if (!/[іїєґІЇЄҐ]/u.test(text)) {
    throw new Error(
      `Question ${generated.questionSourceId} is not recognizably Ukrainian.`
    );
  }

  if (
    /потрібно оцінити|правильним є варіант|відповідь випливає/u.test(text)
  ) {
    throw new Error(
      `Question ${generated.questionSourceId} uses a banned generic explanation phrase.`
    );
  }

  if (!/\b(?:бо|оскільки|тому що|адже|через|відтак)\b/iu.test(text)) {
    throw new Error(
      `Question ${generated.questionSourceId} does not explain a cause or restriction.`
    );
  }

  if (question.answer_type === "abc") {
    const incorrectChoices = (["A", "B", "C"] as const).filter(
      (choice) => choice !== question.correct_answer
    );

    for (const choice of incorrectChoices) {
      if (!new RegExp(`\\b${choice}\\b`, "u").test(text)) {
        throw new Error(
          `Question ${generated.questionSourceId} does not explain why option ${choice} is wrong.`
        );
      }
    }
  } else {
    const incorrectAnswer = question.correct_answer === "true" ? "ні" : "так";

    if (!new RegExp(`\\b${incorrectAnswer}\\b`, "iu").test(text)) {
      throw new Error(
        `Question ${generated.questionSourceId} does not explain why the opposite answer is wrong.`
      );
    }
  }

  const mentionsSign = /\bзнак(?:а|и|ів|ом|ові|у)?\b/iu.test(text);
  const mentionsMarking = /\bрозмітк/iu.test(text);

  if ((mentionsSign || mentionsMarking) && generated.signCodes.length === 0) {
    throw new Error(
      `Question ${generated.questionSourceId} mentions a sign or marking without a code.`
    );
  }

  for (const signCode of generated.signCodes) {
    if (!signCode || !text.includes(signCode)) {
      throw new Error(
        `Question ${generated.questionSourceId} does not include the listed code ${signCode} in its explanation.`
      );
    }
  }
}

function buildUpdatedExplanationRow(
  source: ExplanationSource,
  generated: GeneratedExplanation,
  provider: ApiProvider
) {
  return {
    available_locales: ["ua"],
    confidence: 0.9,
    explanation_version: EXPLANATION_VERSION,
    explanations: {
      ua: generated.explanation,
    },
    has_media: source.existing.has_media,
    media_type: source.existing.media_type,
    model: provider.model,
    needs_manual_review: false,
    provider: provider.provider,
    question_source_id: source.existing.question_source_id,
    reason: "contextual-ua-rewrite",
    source_context_updated_at:
      source.context?.source_updated_at ??
      source.existing.source_context_updated_at,
    source_context_version:
      source.context?.context_version ?? source.existing.source_context_version,
    source_row_number: source.existing.source_row_number,
  };
}

function buildGenerationPrompt(sources: ExplanationSource[], attempt: number) {
  return [
    "Return exactly one JSON object. Do not use Markdown or code fences.",
    "Schema:",
    '{"items":[{"questionSourceId":"string","explanation":"string","signCodes":["B-20"]}]}',
    "Write one item for every input question and preserve questionSourceId exactly.",
    "Rules for each explanation:",
    "- Use Ukrainian only. Write 2-4 concrete sentences (100-700 characters).",
    "- The reader has just selected a wrong answer. Make the decision understandable without seeing a legal textbook: describe the relevant situation, state the rule or restriction, and state its practical consequence.",
    "- Name the applicable Polish traffic rule in every explanation, not just the safe outcome. If the exact legal reference is certain, cite it in its Polish form (for example, «art. 18 ust. 2 Prawa o ruchu drogowym»). Never guess or invent an article number; when it is not certain, state the rule plainly without a citation.",
    "- Explain why the supplied correct answer is correct using the actual scenario, rule, vehicle, road user, condition, distance, or number from the source.",
    "- For an A/B/C question, explicitly mention every incorrect letter and explain why that option does not fit the situation. Use the format «Варіант B ...», not only a bare list of letters.",
    "- For a так/ні question, explicitly explain why the opposite answer is false or would lead to an impermissible action.",
    "- Use a clear causal construction such as «бо», «оскільки», «тому що», «адже» or «через». Do not merely announce the correct answer.",
    '- Never use generic filler such as "Потрібно оцінити...", "правильним є варіант..." or "відповідь випливає...".',
    '- If a road sign or road marking is visible, named, or decisive, write its exact code directly in the explanation: "знак B-20" or "розмітка P-12".',
    "- Never write a form of the word \"знак\" or \"розмітка\" without at least one exact code in signCodes and in the explanation itself.",
    "- Do not invent a sign code. If the provided source does not identify a sign or marking precisely enough, explain the situation without using those words.",
    "- signCodes must contain every code that appears in the explanation, with an uppercase category and lowercase optional letter suffix (for example A-11a), without duplicates.",
    "- Do not mention the source, AI, prompts, uncertainty, or missing context.",
    attempt > 1
      ? "- The previous response did not satisfy the output contract. Check every item carefully before returning it."
      : null,
    "Input questions:",
    JSON.stringify(
      sources.map((source) => ({
        answers: formatQuestionAnswers(source.question),
        aiContext: source.context?.ai_context ?? null,
        answerType: source.question.answer_type,
        correctAnswer: source.question.correct_answer,
        mediaType: source.question.media_type,
        primaryTopicId: source.question.primary_topic_id,
        questionPl: source.question.question_pl,
        questionSourceId: source.question.question_source_id,
        questionUa: source.question.question_ua,
        topicBlock: source.question.topic_block,
      }))
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatQuestionAnswers(question: QuestionRow) {
  if (question.answer_type === "boolean") {
    return {
      correct: question.correct_answer === "true" ? "так" : "ні",
      opposite: question.correct_answer === "true" ? "ні" : "так",
    };
  }

  const options = {
    A: question.option_a_ua ?? question.option_a,
    B: question.option_b_ua ?? question.option_b,
    C: question.option_c_ua ?? question.option_c,
  };

  return {
    correct: question.correct_answer,
    options,
  };
}

function verifyRows(rows: ExistingExplanationRow[]): VerificationResult {
  const missingUkrainianRows: string[] = [];
  const invalidLocaleRows: string[] = [];
  const invalidTextRows: string[] = [];
  const invalidSignReferences: string[] = [];

  for (const row of rows) {
    const explanation =
      typeof row.explanations?.ua === "string"
        ? row.explanations.ua.replace(/\s+/g, " ").trim()
        : "";
    const locales = [...new Set(row.available_locales ?? [])].sort();

    if (!explanation) {
      missingUkrainianRows.push(row.question_source_id);
      continue;
    }

    if (
      locales.length !== 1 ||
      locales[0] !== "ua" ||
      Object.keys(row.explanations ?? {}).length !== 1 ||
      typeof row.explanations?.ua !== "string"
    ) {
      invalidLocaleRows.push(row.question_source_id);
    }

    if (
      explanation.length < 100 ||
      explanation.length > 700 ||
      !/[іїєґІЇЄҐ]/u.test(explanation) ||
      /потрібно оцінити|правильним є варіант|відповідь випливає/u.test(
        explanation
      ) ||
      !/\b(?:бо|оскільки|тому що|адже|через|відтак)\b/iu.test(explanation)
    ) {
      invalidTextRows.push(row.question_source_id);
    }

    const mentionsSign = /\bзнак(?:а|и|ів|ом|ові|у)?\b/iu.test(explanation);
    const mentionsMarking = /\bрозмітк/iu.test(explanation);
    const hasCode = /[A-Z]{1,3}-\d+(?:[a-z])?(?:-\d+(?:\.\d+)?[a-z]?)?/u.test(
      explanation
    );

    if ((mentionsSign || mentionsMarking) && !hasCode) {
      invalidSignReferences.push(row.question_source_id);
    }
  }

  return {
    invalidLocaleRows,
    invalidSignReferences,
    invalidTextRows,
    missingUkrainianRows,
    rowCount: rows.length,
    valid:
      missingUkrainianRows.length === 0 &&
      invalidLocaleRows.length === 0 &&
      invalidTextRows.length === 0 &&
      invalidSignReferences.length === 0,
  };
}

function emptyVerificationResult(): VerificationResult {
  return {
    invalidLocaleRows: [],
    invalidSignReferences: [],
    invalidTextRows: [],
    missingUkrainianRows: [],
    rowCount: 0,
    valid: false,
  };
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function normalizeSignCode(value: string) {
  const matched = value.trim().match(
    /^([A-Z]{1,3})-(\d+)([a-z]?)(?:-(\d+(?:\.\d+)?)([a-z]?))?$/i
  );

  if (!matched) {
    return "";
  }

  const [, category, number, suffix = "", variant, variantSuffix = ""] =
    matched;

  return [
    `${category.toUpperCase()}-${number}${suffix.toLowerCase()}`,
    variant ? `${variant}${variantSuffix.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join("-");
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function extractOpenAiText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as Record<string, unknown>).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }

      const text = (block as Record<string, unknown>).text;

      if (typeof text === "string" && text.trim()) {
        return text;
      }
    }
  }

  return "";
}

function extractAnthropicText(data: Record<string, unknown>) {
  const content = Array.isArray(data.content) ? data.content : [];

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const text = (block as Record<string, unknown>).text;

    if (typeof text === "string" && text.trim()) {
      return text;
    }
  }

  return "";
}

const OPENAI_SYSTEM_PROMPT =
  "You are a meticulous Ukrainian-language driving-theory editor for the Polish driving exam. Follow the requested JSON contract exactly. Do not invent legal facts or traffic sign codes.";

const ANTHROPIC_SYSTEM_PROMPT =
  "You are a meticulous Ukrainian-language driving-theory editor for the Polish driving exam. Follow the requested JSON contract exactly. Do not invent legal facts or traffic sign codes.";

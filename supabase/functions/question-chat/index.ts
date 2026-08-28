import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
} as const;

const PREGENERATED_EXPLANATION_MODEL = "pre-generated-explanation-v1";

type SupportedLocale = "pl" | "ua" | "en" | "de" | "es" | "cs" | "el";
type ContentLocale = "pl" | "ua" | "en" | "de" | "cs" | "el";
type AiProviderId = "mock" | "openai" | "anthropic";
type AppLogSeverity = "info" | "warning" | "error" | "critical";
type QuestionChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  provider?: AiProviderId;
  model?: string;
};

type QuestionChatRequest = {
  conversationId: string;
  locale: SupportedLocale;
  prompt: string;
  history: QuestionChatMessage[];
  questionSetKey?: string;
  studyContext?: string;
  question: {
    questionId: string;
    locale: SupportedLocale;
    prompt: string;
    explanation: string;
    correctAnswer: string;
    selectedAnswer?: string;
    answerType: "boolean" | "abc";
    topicId: string;
    topicBlock?: string;
    scope: "base" | "specialist";
    points: number;
    options: Array<{
      id: string;
      text: string;
    }>;
    mediaType: "image" | "video" | "none";
  };
};

type QuestionV2Resources = {
  contextSummary: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  mediaType: "image" | "video" | "none" | null;
  options: Array<{ id: string; text: string }> | null;
  prompt: string | null;
  questionId: string;
  questionSetKey: string;
  sourceId: string;
};

type ProviderResponse = {
  content: string;
  fallbackUsed: boolean;
  inputTokens?: number | null;
  latencyMs: number;
  model: string;
  outputTokens?: number | null;
  provider: AiProviderId;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: "method_not_allowed",
      },
      405
    );
  }

  let adminClient: ReturnType<typeof createClient> | null = maybeCreateAdminClient();
  let conversationId: string | null = null;
  let locale: SupportedLocale | null = null;
  let questionId: string | null = null;
  let userId: string | null = null;

  try {
    const payload = validateRequest(await request.json());
    const normalizedConversationId =
      normalizeUuid(payload.conversationId) ?? crypto.randomUUID();

    conversationId = normalizedConversationId;
    locale = payload.locale;
    questionId = payload.question.questionId;
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: request.headers.get("Authorization") ?? "",
        },
      },
    });
    const serviceClient =
      adminClient ??
      createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
        },
      });
    adminClient = serviceClient;
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return jsonResponse(
        {
          error: "not_authenticated",
        },
        401
      );
    }
    userId = user.id;

    const hasEntitlement = await checkPlusAiEntitlement(userClient);

    if (!hasEntitlement) {
      return jsonResponse(
        {
          error: "plus_required",
        },
        403
      );
    }

    const v2Resources = await loadQuestionV2Resources(serviceClient, {
      locale: payload.locale,
      questionSetKey: payload.questionSetKey ?? null,
      sourceId: payload.question.questionId,
    });
    const resolvedPayload = applyQuestionV2Resources(payload, v2Resources);
    const resolvedQuestionId = v2Resources?.questionId ?? null;
    questionId = resolvedQuestionId ?? payload.question.questionId;

    const nextMessageOrder = await getNextMessageOrder(
      serviceClient,
      user.id,
      normalizedConversationId
    );

    await insertAiMessage(serviceClient, {
      content: resolvedPayload.prompt,
      conversationId: normalizedConversationId,
      messageKind: "question_chat",
      messageOrder: nextMessageOrder,
      messageRole: "user",
      metadata: {
        locale: resolvedPayload.locale,
        questionSetKey: resolvedPayload.questionSetKey ?? null,
        rawQuestionId: payload.question.questionId,
        selectedAnswer: resolvedPayload.question.selectedAnswer ?? null,
        topicId: resolvedPayload.question.topicId,
        topicBlock: resolvedPayload.question.topicBlock ?? null,
        v2QuestionId: resolvedQuestionId,
      },
      questionId: resolvedQuestionId,
      userId: user.id,
    });

    const provider = createProvider();
    let providerResponse: ProviderResponse;

    try {
      providerResponse = await provider(resolvedPayload);
    } catch (providerError) {
      console.error("question-chat provider fallback", providerError);
      await logAppError(serviceClient, {
        area: "question_chat",
        error: providerError,
        eventName: "question_chat_provider_fallback",
        message:
          "Primary AI provider failed, so question chat fell back to the pre-generated explanation adapter.",
        metadata: {
          conversation_id: normalizedConversationId,
          fallback_kind: "pre_generated_explanation",
          locale: resolvedPayload.locale,
          preferred_provider: Deno.env.get("AI_PROVIDER") ?? null,
          question_id: resolvedQuestionId,
          question_set_key: resolvedPayload.questionSetKey ?? null,
          question_source_id: payload.question.questionId,
        },
        severity: "warning",
        source: "supabase_edge",
        userId: user.id,
      });
      providerResponse = createMockProviderResponse(resolvedPayload);
    }
    const assistantMessage: QuestionChatMessage = {
      id: `assistant-${Date.now().toString(36)}`,
      role: "assistant",
      content: providerResponse.content,
      createdAt: new Date().toISOString(),
      provider: providerResponse.provider,
      model: providerResponse.model,
    };

    await insertAiMessage(serviceClient, {
      content: assistantMessage.content,
      conversationId: normalizedConversationId,
      inputTokens: providerResponse.inputTokens ?? null,
      latencyMs: providerResponse.latencyMs,
      messageKind: "question_chat",
      messageOrder: nextMessageOrder + 1,
      messageRole: "assistant",
      metadata: {
        fallbackKind:
          providerResponse.fallbackUsed &&
          providerResponse.model === PREGENERATED_EXPLANATION_MODEL
            ? "pre_generated_explanation"
            : null,
        fallbackUsed: providerResponse.fallbackUsed,
        locale: resolvedPayload.locale,
        preGeneratedExplanation:
          providerResponse.model === PREGENERATED_EXPLANATION_MODEL,
        questionSetKey: resolvedPayload.questionSetKey ?? null,
        rawQuestionId: payload.question.questionId,
        selectedAnswer: resolvedPayload.question.selectedAnswer ?? null,
        topicId: resolvedPayload.question.topicId,
        topicBlock: resolvedPayload.question.topicBlock ?? null,
        v2QuestionId: resolvedQuestionId,
      },
      model: providerResponse.model,
      outputTokens: providerResponse.outputTokens ?? null,
      provider: providerResponse.provider,
      questionId: resolvedQuestionId,
      userId: user.id,
    });

    const remainingFreeMessages = null;

    return jsonResponse({
      conversationId: normalizedConversationId,
      provider: providerResponse.provider,
      model: providerResponse.model,
      message: assistantMessage,
      fallbackUsed: providerResponse.fallbackUsed,
      remainingFreeMessages,
    });
  } catch (error) {
    console.error("question-chat error", error);
    await logAppError(adminClient, {
      area: "question_chat",
      error,
      eventName: "question_chat_request_failed",
      message: "Question chat failed before a response could be completed.",
      metadata: {
        conversation_id: conversationId,
        locale,
        question_id: questionId,
      },
      severity: "error",
      source: "supabase_edge",
      userId,
    });

    return jsonResponse(
      {
        error: "question_chat_failed",
      },
      500
    );
  }
});

function validateRequest(value: unknown): QuestionChatRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid request body.");
  }

  const request = value as Record<string, unknown>;

  if (typeof request.conversationId !== "string" || !request.conversationId.trim()) {
    throw new Error("conversationId is required.");
  }

  if (!isSupportedLocale(request.locale)) {
    throw new Error("locale is invalid.");
  }

  if (typeof request.prompt !== "string" || !request.prompt.trim()) {
    throw new Error("prompt is required.");
  }

  if (!Array.isArray(request.history)) {
    throw new Error("history must be an array.");
  }

  const question = request.question as Record<string, unknown> | undefined;

  if (!question || typeof question !== "object") {
    throw new Error("question payload is required.");
  }

  if (typeof question.questionId !== "string" || !question.questionId.trim()) {
    throw new Error("questionId is required.");
  }

  if (typeof question.prompt !== "string" || !question.prompt.trim()) {
    throw new Error("question.prompt is required.");
  }

  if (typeof question.explanation !== "string") {
    throw new Error("question.explanation must be a string.");
  }

  if (!Array.isArray(question.options)) {
    throw new Error("question.options must be an array.");
  }

  if (
    request.questionSetKey !== undefined &&
    (typeof request.questionSetKey !== "string" || !request.questionSetKey.trim())
  ) {
    throw new Error("questionSetKey is invalid.");
  }

  return {
    ...(request as QuestionChatRequest),
    questionSetKey:
      typeof request.questionSetKey === "string"
        ? request.questionSetKey.trim()
        : undefined,
  };
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    value === "pl" ||
    value === "ua" ||
    value === "en" ||
    value === "de" ||
    value === "es" ||
    value === "cs" ||
    value === "el"
  );
}

function getContentLocale(locale: SupportedLocale): ContentLocale {
  if (locale === "es") {
    return "en";
  }

  return locale;
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
}

function maybeCreateAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

async function loadQuestionV2Resources(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    locale: SupportedLocale;
    questionSetKey: string | null;
    sourceId: string;
  }
): Promise<QuestionV2Resources | null> {
  if (!input.questionSetKey) {
    return null;
  }

  try {
    const { data: questionSet, error: questionSetError } = await serviceClient
      .from("question_sets")
      .select("id, key")
      .eq("key", input.questionSetKey)
      .eq("is_active", true)
      .maybeSingle();

    if (questionSetError || !questionSet?.id) {
      return null;
    }

    const { data: question, error: questionError } = await serviceClient
      .from("questions_v2")
      .select("id, source_id, correct_option_id, content")
      .eq("question_set_id", questionSet.id)
      .eq("source_id", input.sourceId)
      .eq("is_active", true)
      .maybeSingle();

    if (questionError || !question?.id) {
      return null;
    }

    const [explanationResult, contextResult] = await Promise.all([
      serviceClient
        .from("question_ai_explanations_v2")
        .select("explanations")
        .eq("question_id", question.id)
        .maybeSingle(),
      serviceClient
        .from("question_ai_contexts_v2")
        .select("context")
        .eq("question_id", question.id)
        .maybeSingle(),
    ]);

    const content =
      question.content &&
      typeof question.content === "object" &&
      !Array.isArray(question.content)
        ? (question.content as {
            prompt?: Record<string, string>;
            options?: Array<{
              id: string;
              text?: Record<string, string>;
            }>;
            question_media?: Array<{
              role?: string;
              asset?: { mediaType?: string };
            }>;
          })
        : {};
    const options = (content.options ?? [])
      .map((option) => {
        const text = pickLocalizedText(option.text, input.locale);

        if (!option.id || !text) {
          return null;
        }

        return {
          id: option.id,
          text,
        };
      })
      .filter((option): option is { id: string; text: string } => option !== null);

    return {
      contextSummary: formatStudyContext(contextResult.data?.context, input.locale),
      correctAnswer:
        typeof question.correct_option_id === "string" &&
        question.correct_option_id.trim()
          ? question.correct_option_id.trim()
          : null,
      explanation: pickLocalizedText(
        explanationResult.data?.explanations as Record<string, string> | undefined,
        input.locale
      ),
      mediaType: inferMediaType(content.question_media),
      options: options.length > 0 ? options : null,
      prompt: pickLocalizedText(content.prompt, input.locale),
      questionId: question.id,
      questionSetKey: questionSet.key,
      sourceId: question.source_id,
    };
  } catch (error) {
    console.error("question-chat questions_v2 lookup failed", error);
    return null;
  }
}

function applyQuestionV2Resources(
  request: QuestionChatRequest,
  resources: QuestionV2Resources | null
): QuestionChatRequest {
  if (!resources) {
    return request;
  }

  return {
    ...request,
    questionSetKey: resources.questionSetKey,
    studyContext: resources.contextSummary ?? undefined,
    question: {
      ...request.question,
      prompt: resources.prompt ?? request.question.prompt,
      explanation: resources.explanation ?? request.question.explanation,
      correctAnswer: resources.correctAnswer ?? request.question.correctAnswer,
      options: resources.options ?? request.question.options,
      mediaType: resources.mediaType ?? request.question.mediaType,
    },
  };
}

function pickLocalizedText(
  value: Record<string, string> | null | undefined,
  locale: SupportedLocale
) {
  if (!value) {
    return null;
  }

  const contentLocale = getContentLocale(locale);
  const candidates = [contentLocale, locale, "en", "pl", "cs", "ua", "de", "el"];

  for (const key of candidates) {
    const text = value[key];

    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  return null;
}

function inferMediaType(
  media: Array<{ role?: string; asset?: { mediaType?: string } }> | undefined
): "image" | "video" | "none" | null {
  if (!media || media.length === 0) {
    return "none";
  }

  const primary =
    media.find((item) => item.role === "primary") ?? media[0];
  const mediaType = primary?.asset?.mediaType;

  if (mediaType === "image" || mediaType === "video") {
    return mediaType;
  }

  return "image";
}

function formatStudyContext(context: unknown, locale: SupportedLocale) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return null;
  }

  const record = context as Record<string, unknown>;
  const lines: string[] = [];
  const aiContext = asNonEmptyString(record.ai_context);

  if (aiContext) {
    lines.push(aiContext);
  }

  const decisiveFacts = pickLocalizedStringList(record, "decisive_facts", locale);

  if (decisiveFacts.length > 0) {
    lines.push(
      `Decisive facts:\n${decisiveFacts.map((fact) => `- ${fact}`).join("\n")}`
    );
  }

  const signs = formatVerifiedSigns(record.verified_signs);

  if (signs) {
    lines.push(`Verified signs: ${signs}`);
  }

  const visual = formatVisualAnalysis(record.visual_analysis);

  if (visual) {
    lines.push(`Visual analysis: ${visual}`);
  }

  if (lines.length === 0) {
    return null;
  }

  return truncateText(lines.join("\n\n"), 1500);
}

function pickLocalizedStringList(
  record: Record<string, unknown>,
  prefix: string,
  locale: SupportedLocale
) {
  const contentLocale = getContentLocale(locale);
  const keys = [
    `${prefix}_${contentLocale}`,
    `${prefix}_${locale}`,
    `${prefix}_en`,
    `${prefix}_pl`,
    `${prefix}_cs`,
    prefix,
  ];

  for (const key of keys) {
    const values = asStringList(record[key]);

    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function formatVerifiedSigns(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const labels = value.flatMap((item) => {
    if (typeof item === "string") {
      return item.trim() ? [item.trim()] : [];
    }

    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const label =
      asNonEmptyString(record.code) ??
      asNonEmptyString(record.id) ??
      asNonEmptyString(record.name);

    return label ? [label] : [];
  });

  return labels.length > 0 ? labels.join(", ") : null;
}

function formatVisualAnalysis(value: unknown) {
  if (typeof value === "string") {
    return asNonEmptyString(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary =
    asNonEmptyString(record.summary) ??
    asNonEmptyString(record.description) ??
    asNonEmptyString(record.status);

  return summary && summary !== "not_applicable" && summary !== "pending_vision"
    ? summary
    : null;
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const text = asNonEmptyString(item);
    return text ? [text] : [];
  });
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

async function checkPlusAiEntitlement(userClient: ReturnType<typeof createClient>) {
  try {
    const { data, error } = await userClient
      .from("feature_entitlements")
      .select("feature_key")
      .eq("status", "active")
      .eq("source_type", "purchase")
      .in("feature_key", ["ai_question_chat", "premium_access"])
      .limit(1);

    if (error) {
      return false;
    }

    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}

async function getNextMessageOrder(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  conversationId: string
) {
  const { data } = await adminClient
    .from("ai_messages")
    .select("message_order")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("message_order", {
      ascending: false,
    })
    .limit(1);

  return (data?.[0]?.message_order ?? 0) + 1;
}

async function logAppError(
  adminClient: ReturnType<typeof createClient> | null,
  input: {
    area: string;
    error?: unknown;
    eventName: string;
    message?: string;
    metadata?: Record<string, unknown>;
    severity?: AppLogSeverity;
    source?: string;
    userId?: string | null;
  }
) {
  if (!adminClient) {
    return;
  }

  const normalizedError = normalizeLoggedError(input.error);
  const errorMetadata =
    normalizedError.code || normalizedError.message || normalizedError.name
      ? {
          error_code: normalizedError.code,
          error_message: normalizedError.message,
          error_name: normalizedError.name,
        }
      : {};

  try {
    const { error } = await adminClient.from("app_error_logs").insert({
      user_id: input.userId ?? null,
      source: sanitizeLogString(input.source) ?? "supabase_edge",
      area: sanitizeLogString(input.area) ?? "edge_unknown",
      event_name:
        sanitizeLogString(input.eventName) ?? "edge_unknown_error",
      severity: input.severity ?? "error",
      message:
        sanitizeLogString(input.message) ??
        normalizedError.message ??
        `${input.area}:${input.eventName}`,
      error_name: normalizedError.name,
      error_code: normalizedError.code,
      auth_mode: input.userId ? "supabase" : null,
      platform: "edge",
      metadata: sanitizeLogMetadata({
        ...input.metadata,
        ...errorMetadata,
      }),
    });

    if (error) {
      console.error("question-chat app_error_logs insert failed", error);
    }
  } catch (error) {
    console.error("question-chat app_error_logs insert failed", error);
  }
}

async function insertAiMessage(
  adminClient: ReturnType<typeof createClient>,
  input: {
    content: string;
    conversationId: string;
    inputTokens?: number | null;
    latencyMs?: number | null;
    messageKind: "question_chat";
    messageOrder: number;
    messageRole: "user" | "assistant";
    metadata: Record<string, unknown>;
    model?: string;
    outputTokens?: number | null;
    provider?: AiProviderId;
    questionId: string | null;
    userId: string;
  }
) {
  const { error } = await adminClient.from("ai_messages").insert({
    user_id: input.userId,
    question_id: input.questionId,
    conversation_id: input.conversationId,
    message_order: input.messageOrder,
    message_role: input.messageRole,
    message_kind: input.messageKind,
    provider: input.provider ?? null,
    model: input.model ?? null,
    content: input.content,
    is_visible_to_user: true,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    latency_ms: input.latencyMs ?? null,
    metadata: input.metadata,
  });

  if (error) {
    throw error;
  }
}

function normalizeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}

function createProvider() {
  const preferredProvider = Deno.env.get("AI_PROVIDER");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (preferredProvider === "mock") {
    return async (request: QuestionChatRequest) =>
      Promise.resolve(createMockProviderResponse(request));
  }

  if (preferredProvider === "anthropic" && anthropicKey) {
    return invokeAnthropic;
  }

  if (preferredProvider === "openai" && openAiKey) {
    return invokeOpenAi;
  }

  if (openAiKey) {
    return invokeOpenAi;
  }

  if (anthropicKey) {
    return invokeAnthropic;
  }

  return async (request: QuestionChatRequest) =>
    Promise.resolve(createMockProviderResponse(request));
}

async function invokeOpenAi(
  request: QuestionChatRequest
): Promise<ProviderResponse> {
  const startedAt = Date.now();
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 350,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: buildSystemPrompt(request),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildUserPrompt(request),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}.`);
  }

  const data = await response.json();
  const messageContent = extractOpenAiText(data);

  return {
    provider: "openai",
    model,
    content: messageContent,
    fallbackUsed: false,
    inputTokens: data?.usage?.input_tokens ?? null,
    outputTokens: data?.usage?.output_tokens ?? null,
    latencyMs: Date.now() - startedAt,
  };
}

async function invokeAnthropic(
  request: QuestionChatRequest
): Promise<ProviderResponse> {
  const startedAt = Date.now();
  const apiKey = getRequiredEnv("ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 350,
      system: buildSystemPrompt(request),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(request),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed with ${response.status}.`);
  }

  const data = await response.json();
  const messageContent = extractAnthropicText(data);

  return {
    provider: "anthropic",
    model,
    content: messageContent,
    fallbackUsed: false,
    inputTokens: data?.usage?.input_tokens ?? null,
    outputTokens: data?.usage?.output_tokens ?? null,
    latencyMs: Date.now() - startedAt,
  };
}

function extractOpenAiText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];

  for (const item of output) {
    const content = (item as Record<string, unknown>).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      const text = (block as Record<string, unknown>).text;

      if (typeof text === "string" && text.trim()) {
        return text;
      }
    }
  }

  throw new Error("OpenAI response did not include text output.");
}

function extractAnthropicText(data: Record<string, unknown>) {
  const content = Array.isArray(data.content) ? data.content : [];

  for (const block of content) {
    const text = (block as Record<string, unknown>).text;

    if (typeof text === "string" && text.trim()) {
      return text;
    }
  }

  throw new Error("Anthropic response did not include text output.");
}

function buildSystemPrompt(request: QuestionChatRequest) {
  const contentLocale = getContentLocale(request.locale);

  if (contentLocale === "pl") {
    return "Jestes nauczycielem do egzaminu na prawo jazdy w Polsce. Odpowiadasz jasno, krotko i praktycznie. Wyjasniasz, dlaczego poprawna odpowiedz jest poprawna, bez wymyslania nowych przepisow. Jesli student wybral zla odpowiedz, spokojnie wskazujesz blad i dajesz jedna regule do zapamietania.";
  }

  if (contentLocale === "en") {
    return "You are a driving-exam study coach. Be concise, practical, and calm. Explain why the correct answer is right, avoid inventing rules, and give one short memory rule when helpful.";
  }

  if (contentLocale === "de") {
    return "Du bist ein Lerncoach fuer die Theoriepruefung. Antworte knapp, praxisnah und ruhig. Erklaere, warum die richtige Antwort richtig ist, erfinde keine Regeln und gib bei Bedarf eine kurze Merkregel.";
  }

  if (contentLocale === "cs") {
    return "Jsi učitel k teoretické zkoušce z řízení. Odpovídej jasně, stručně a prakticky. Vysvětli, proč je správná odpověď správná, nevymýšlej předpisy. Pokud student zvolil špatně, klidně ukaž chybu a dej jedno pravidlo k zapamatování.";
  }

  if (contentLocale === "el") {
    return "Είσαι δάσκαλος για τις θεωρητικές εξετάσεις οδήγησης. Απάντα σύντομα, πρακτικά και ήρεμα. Εξήγησε γιατί η σωστή απάντηση είναι σωστή, μην επινοείς κανόνες και δώσε έναν σύντομο κανόνα απομνημόνευσης όταν βοηθά.";
  }

  return "Ти помічник для підготовки до теоретичного іспиту на права. Відповідай коротко, чітко і практично. Пояснюй, чому правильна відповідь правильна, не вигадуй нових правил, і якщо студент помилився, спокійно покажи логіку та дай одну коротку підказку для запам'ятовування.";
}

function buildUserPrompt(request: QuestionChatRequest) {
  const optionLines = request.question.options
    .map((option) => `- ${option.id}: ${option.text}`)
    .join("\n");
  const officialExplanation = request.question.explanation.trim();

  return [
    `Question locale: ${request.locale}`,
    `Topic: ${request.question.topicId}`,
    `Question: ${request.question.prompt}`,
    optionLines ? `Options:\n${optionLines}` : null,
    `Correct answer: ${request.question.correctAnswer}`,
    request.question.selectedAnswer
      ? `Student selected: ${request.question.selectedAnswer}`
      : null,
    officialExplanation
      ? `Official explanation: ${officialExplanation}`
      : null,
    request.studyContext
      ? `Authoritative study context:\n${request.studyContext}`
      : null,
    `Student prompt: ${request.prompt}`,
    "Keep the response focused on this question only.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function createMockProviderResponse(
  request: QuestionChatRequest
): ProviderResponse {
  const startedAt = Date.now();
  return {
    provider: "mock",
    model: PREGENERATED_EXPLANATION_MODEL,
    content: buildPreGeneratedExplanationContent(
      request.question,
      request.prompt
    ),
    fallbackUsed: true,
    latencyMs: Date.now() - startedAt,
    inputTokens: null,
    outputTokens: null,
  };
}

function getOptionText(
  question: QuestionChatRequest["question"],
  optionId: string
) {
  const matched = question.options.find((option) => option.id === optionId);

  return matched?.text ?? optionId.toUpperCase();
}

function buildPreGeneratedExplanationContent(
  context: QuestionChatRequest["question"],
  prompt?: string
) {
  const intent = getPromptIntent(prompt, context.locale);
  const statusLine = buildStatusLine(context);
  const explanation =
    context.explanation.trim() || getMissingExplanationFallback(context.locale);
  const memoryRule = getMemoryRule(context.locale);
  const mistakeLine = getMistakeLine(context.locale);
  const contentLocale = getContentLocale(context.locale);

  if (contentLocale === "pl") {
    if (intent === "memory") {
      return `${statusLine} Regula do zapamietania: ${memoryRule} Dlaczego tak: ${explanation}`;
    }

    if (intent === "mistake") {
      return `${statusLine} Najczestsza pomylka: ${mistakeLine} Dlaczego tak: ${explanation} Regula do zapamietania: ${memoryRule}`;
    }

    return `${statusLine} Dlaczego tak: ${explanation} Regula do zapamietania: ${memoryRule}`;
  }

  if (contentLocale !== "ua") {
    if (intent === "memory") {
      return `${statusLine} Memory rule: ${memoryRule} Why this is correct: ${explanation}`;
    }

    if (intent === "mistake") {
      return `${statusLine} Common mistake: ${mistakeLine} Why this is correct: ${explanation} Memory rule: ${memoryRule}`;
    }

    return `${statusLine} Why this is correct: ${explanation} Memory rule: ${memoryRule}`;
  }

  if (intent === "memory") {
    return `${statusLine} Правило для запам'ятовування: ${memoryRule} Чому так: ${explanation}`;
  }

  if (intent === "mistake") {
    return `${statusLine} Типова помилка: ${mistakeLine} Чому так: ${explanation} Правило для запам'ятовування: ${memoryRule}`;
  }

  return `${statusLine} Чому так: ${explanation} Правило для запам'ятовування: ${memoryRule}`;
}

function buildStatusLine(context: QuestionChatRequest["question"]) {
  const correctAnswerText = getOptionText(context, context.correctAnswer);
  const selectedAnswerText = context.selectedAnswer
    ? getOptionText(context, context.selectedAnswer)
    : null;
  const selectedIsCorrect = context.selectedAnswer === context.correctAnswer;
  const contentLocale = getContentLocale(context.locale);

  if (contentLocale === "pl") {
    if (context.selectedAnswer) {
      return selectedIsCorrect
        ? `Wybrales poprawna odpowiedz: ${selectedAnswerText}.`
        : `Wybrales ${selectedAnswerText}, ale poprawna odpowiedz to ${correctAnswerText}.`;
    }

    return `Poprawna odpowiedz to ${correctAnswerText}.`;
  }

  if (contentLocale !== "ua") {
    if (context.selectedAnswer) {
      return selectedIsCorrect
        ? `You chose the correct answer: ${selectedAnswerText}.`
        : `You chose ${selectedAnswerText}, but the correct answer is ${correctAnswerText}.`;
    }

    return `The correct answer is ${correctAnswerText}.`;
  }

  if (context.selectedAnswer) {
    return selectedIsCorrect
      ? `Ти вибрав правильну відповідь: ${selectedAnswerText}.`
      : `Ти вибрав ${selectedAnswerText}, але правильна відповідь: ${correctAnswerText}.`;
  }

  return `Правильна відповідь: ${correctAnswerText}.`;
}

function getPromptIntent(
  prompt: string | undefined,
  locale: SupportedLocale
) {
  const normalizedPrompt = prompt?.trim().toLowerCase() ?? "";

  if (!normalizedPrompt) {
    return "why";
  }

  if (locale === "pl") {
    if (
      normalizedPrompt.includes("zapam") ||
      normalizedPrompt.includes("regul") ||
      normalizedPrompt.includes("egz")
    ) {
      return "memory";
    }

    if (
      normalizedPrompt.includes("blad") ||
      normalizedPrompt.includes("pomyl") ||
      normalizedPrompt.includes("wrong")
    ) {
      return "mistake";
    }
  }

  if (locale === "en") {
    if (
      normalizedPrompt.includes("remember") ||
      normalizedPrompt.includes("rule") ||
      normalizedPrompt.includes("exam")
    ) {
      return "memory";
    }

    if (
      normalizedPrompt.includes("mistake") ||
      normalizedPrompt.includes("wrong")
    ) {
      return "mistake";
    }
  }

  if (
    normalizedPrompt.includes("запам") ||
    normalizedPrompt.includes("правил") ||
    normalizedPrompt.includes("іспит") ||
    normalizedPrompt.includes("exam")
  ) {
    return "memory";
  }

  if (
    normalizedPrompt.includes("помил") ||
    normalizedPrompt.includes("не так") ||
    normalizedPrompt.includes("wrong")
  ) {
    return "mistake";
  }

  return "why";
}

function getMemoryRule(locale: SupportedLocale) {
  const contentLocale = getContentLocale(locale);

  if (contentLocale === "pl") {
    return "Patrz na dokladna zasade z pytania i wybieraj odpowiedz, ktora pasuje do niej 1:1, a nie tylko brzmi bezpiecznie.";
  }

  if (contentLocale === "en" || contentLocale === "cs" || contentLocale === "el") {
    return "Look for the exact rule being tested and choose the option that matches it 1:1, not the one that merely sounds safe.";
  }

  if (contentLocale === "de") {
    return "Achte auf die genaue Regel in der Frage und waehle die Option, die 1:1 dazu passt, nicht nur die, die sicher klingt.";
  }

  return "Шукай точне правило з питання і обирай варіант, що збігається з ним 1:1, а не просто звучить безпечніше.";
}

function getMistakeLine(locale: SupportedLocale) {
  const contentLocale = getContentLocale(locale);

  if (contentLocale === "pl") {
    return "Zgadywanie po intuicji albo wybieranie odpowiedzi, ktora brzmi ogolnie najbezpieczniej.";
  }

  if (contentLocale === "en" || contentLocale === "cs" || contentLocale === "el") {
    return "Guessing from intuition or choosing the option that sounds generally safest.";
  }

  if (contentLocale === "de") {
    return "Raten nach Intuition oder die Option waehlen, die allgemein am sichersten klingt.";
  }

  return "Вгадування по інтуїції або вибір варіанта, який просто звучить найбезпечніше.";
}

function getMissingExplanationFallback(locale: SupportedLocale) {
  const contentLocale = getContentLocale(locale);

  if (contentLocale === "pl") {
    return "Brak oficjalnego wyjasnienia w bazie. Odpowiedz opiera sie na poprawnej odpowiedzi i logice pytania.";
  }

  if (contentLocale === "en" || contentLocale === "cs" || contentLocale === "el") {
    return "The official explanation is missing in the dataset, so this answer is based on the correct option and the question logic.";
  }

  if (contentLocale === "de") {
    return "In der Datenbank fehlt die offizielle Erklaerung, daher basiert die Antwort auf der richtigen Option und der Logik der Frage.";
  }

  return "У базі немає офіційного пояснення, тому відповідь побудована на правильному варіанті та логіці самого питання.";
}

function normalizeLoggedError(error: unknown) {
  if (error instanceof Error) {
    const record = error as Error & {
      code?: unknown;
      status?: unknown;
    };

    return {
      code: normalizeLogCode(record.code ?? record.status),
      message: sanitizeLogString(error.message),
      name: sanitizeLogString(error.name),
    };
  }

  const record =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : null;

  return {
    code: normalizeLogCode(record?.code ?? record?.status),
    message:
      sanitizeLogString(record?.message) ??
      sanitizeLogString(record?.details) ??
      sanitizeLogString(record?.error_description),
    name: sanitizeLogString(record?.name),
  };
}

function normalizeLogCode(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return sanitizeLogString(value);
}

function sanitizeLogMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter((entry) => entry[1] !== undefined)
  );
}

function sanitizeLogString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

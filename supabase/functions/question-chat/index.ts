import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
} as const;

const PREGENERATED_EXPLANATION_MODEL = "pre-generated-explanation-v1";

type SupportedLocale = "pl" | "ua" | "en" | "de" | "es";
type ContentLocale = "pl" | "ua" | "en" | "de";
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
  question: {
    questionId: string;
    locale: SupportedLocale;
    prompt: string;
    explanation: string;
    correctAnswer: string;
    selectedAnswer?: string;
    answerType: "boolean" | "abc";
    topicBlock: string;
    scope: "base" | "specialist";
    points: number;
    options: Array<{
      id: string;
      text: string;
    }>;
    mediaType: "image" | "video" | "none";
  };
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
    const normalizedQuestionId = normalizeUuid(payload.question.questionId);

    conversationId = normalizedConversationId;
    locale = payload.locale;
    questionId = normalizedQuestionId;
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

    const nextMessageOrder = await getNextMessageOrder(
      serviceClient,
      user.id,
      normalizedConversationId
    );

    await insertAiMessage(serviceClient, {
      content: payload.prompt,
      conversationId: normalizedConversationId,
      messageKind: "question_chat",
      messageOrder: nextMessageOrder,
      messageRole: "user",
      metadata: {
        locale: payload.locale,
        rawQuestionId: payload.question.questionId,
        selectedAnswer: payload.question.selectedAnswer ?? null,
        topicBlock: payload.question.topicBlock,
      },
      questionId: normalizedQuestionId,
      userId: user.id,
    });

    const provider = createProvider();
    let providerResponse: ProviderResponse;

    try {
      providerResponse = await provider(payload);
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
          locale: payload.locale,
          preferred_provider: Deno.env.get("AI_PROVIDER") ?? null,
          question_id: normalizedQuestionId,
        },
        severity: "warning",
        source: "supabase_edge",
        userId: user.id,
      });
      providerResponse = createMockProviderResponse(payload);
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
        locale: payload.locale,
        preGeneratedExplanation:
          providerResponse.model === PREGENERATED_EXPLANATION_MODEL,
        rawQuestionId: payload.question.questionId,
        selectedAnswer: payload.question.selectedAnswer ?? null,
        topicBlock: payload.question.topicBlock,
      },
      model: providerResponse.model,
      outputTokens: providerResponse.outputTokens ?? null,
      provider: providerResponse.provider,
      questionId: normalizedQuestionId,
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

  return request as QuestionChatRequest;
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    value === "pl" ||
    value === "ua" ||
    value === "en" ||
    value === "de" ||
    value === "es"
  );
}

function getContentLocale(locale: SupportedLocale): ContentLocale {
  if (locale === "pl" || locale === "ua" || locale === "en" || locale === "de") {
    return locale;
  }

  return "en";
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
    return "You are a driving-exam study coach for the Polish theory exam. Be concise, practical, and calm. Explain why the correct answer is right, avoid inventing rules, and give one short memory rule when helpful.";
  }

  if (contentLocale === "de") {
    return "Du bist ein Lerncoach fuer die polnische Theoriepruefung. Antworte knapp, praxisnah und ruhig. Erklaere, warum die richtige Antwort richtig ist, erfinde keine Regeln und gib bei Bedarf eine kurze Merkregel.";
  }

  return "Ти помічник для підготовки до теоретичного іспиту на права в Польщі. Відповідай коротко, чітко і практично. Пояснюй, чому правильна відповідь правильна, не вигадуй нових правил, і якщо студент помилився, спокійно покажи логіку та дай одну коротку підказку для запам'ятовування.";
}

function buildUserPrompt(request: QuestionChatRequest) {
  const optionLines = request.question.options
    .map((option) => `- ${option.id}: ${option.text}`)
    .join("\n");
  const officialExplanation = request.question.explanation.trim();

  return [
    `Question locale: ${request.locale}`,
    `Topic block: ${request.question.topicBlock}`,
    `Question: ${request.question.prompt}`,
    optionLines ? `Options:\n${optionLines}` : null,
    `Correct answer: ${request.question.correctAnswer}`,
    request.question.selectedAnswer
      ? `Student selected: ${request.question.selectedAnswer}`
      : null,
    officialExplanation
      ? `Official explanation: ${officialExplanation}`
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

  if (context.locale === "pl") {
    if (intent === "memory") {
      return `${statusLine} Regula do zapamietania: ${memoryRule} Dlaczego tak: ${explanation}`;
    }

    if (intent === "mistake") {
      return `${statusLine} Najczestsza pomylka: ${mistakeLine} Dlaczego tak: ${explanation} Regula do zapamietania: ${memoryRule}`;
    }

    return `${statusLine} Dlaczego tak: ${explanation} Regula do zapamietania: ${memoryRule}`;
  }

  if (context.locale === "en") {
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

  if (context.locale === "pl") {
    if (context.selectedAnswer) {
      return selectedIsCorrect
        ? `Wybrales poprawna odpowiedz: ${selectedAnswerText}.`
        : `Wybrales ${selectedAnswerText}, ale poprawna odpowiedz to ${correctAnswerText}.`;
    }

    return `Poprawna odpowiedz to ${correctAnswerText}.`;
  }

  if (context.locale === "en") {
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

  if (contentLocale === "en") {
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

  if (contentLocale === "en") {
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

  if (contentLocale === "en") {
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

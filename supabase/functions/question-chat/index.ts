import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
} as const;

const FREE_DAILY_LIMIT = 8;

type SupportedLocale = "pl" | "ua" | "en";
type AiProviderId = "mock" | "openai" | "anthropic";
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

  try {
    const payload = validateRequest(await request.json());
    const conversationId =
      normalizeUuid(payload.conversationId) ?? crypto.randomUUID();
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
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
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

    const hasEntitlement = await checkAiEntitlement(userClient);

    if (!hasEntitlement) {
      const usedToday = await getDailyQuestionChatCount(adminClient, user.id);

      if (usedToday >= FREE_DAILY_LIMIT) {
        return jsonResponse(
          {
            error: "free_limit_reached",
            remainingFreeMessages: 0,
          },
          429
        );
      }
    }

    const nextMessageOrder = await getNextMessageOrder(
      adminClient,
      user.id,
      conversationId
    );

    await insertAiMessage(adminClient, {
      content: payload.prompt,
      conversationId,
      messageKind: "question_chat",
      messageOrder: nextMessageOrder,
      messageRole: "user",
      metadata: {
        locale: payload.locale,
        rawQuestionId: payload.question.questionId,
        selectedAnswer: payload.question.selectedAnswer ?? null,
        topicBlock: payload.question.topicBlock,
      },
      questionId: normalizeUuid(payload.question.questionId),
      userId: user.id,
    });

    const provider = createProvider();
    let providerResponse: ProviderResponse;

    try {
      providerResponse = await provider(payload);
    } catch (providerError) {
      console.error("question-chat provider fallback", providerError);
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

    await insertAiMessage(adminClient, {
      content: assistantMessage.content,
      conversationId,
      inputTokens: providerResponse.inputTokens ?? null,
      latencyMs: providerResponse.latencyMs,
      messageKind: "question_chat",
      messageOrder: nextMessageOrder + 1,
      messageRole: "assistant",
      metadata: {
        fallbackUsed: providerResponse.fallbackUsed,
        locale: payload.locale,
        rawQuestionId: payload.question.questionId,
        selectedAnswer: payload.question.selectedAnswer ?? null,
        topicBlock: payload.question.topicBlock,
      },
      model: providerResponse.model,
      outputTokens: providerResponse.outputTokens ?? null,
      provider: providerResponse.provider,
      questionId: normalizeUuid(payload.question.questionId),
      userId: user.id,
    });

    const remainingFreeMessages = hasEntitlement
      ? null
      : Math.max(
          0,
          FREE_DAILY_LIMIT - (await getDailyQuestionChatCount(adminClient, user.id))
        );

    return jsonResponse({
      conversationId,
      provider: providerResponse.provider,
      model: providerResponse.model,
      message: assistantMessage,
      fallbackUsed: providerResponse.fallbackUsed,
      remainingFreeMessages,
    });
  } catch (error) {
    console.error("question-chat error", error);

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

  if (typeof question.explanation !== "string" || !question.explanation.trim()) {
    throw new Error("question.explanation is required.");
  }

  if (!Array.isArray(question.options)) {
    throw new Error("question.options must be an array.");
  }

  return request as QuestionChatRequest;
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === "pl" || value === "ua" || value === "en";
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

async function checkAiEntitlement(userClient: ReturnType<typeof createClient>) {
  try {
    const { data, error } = await userClient.rpc("has_active_entitlement", {
      p_feature: "ai_question_chat",
    });

    if (error) {
      return false;
    }

    return Boolean(data);
  } catch {
    return false;
  }
}

async function getDailyQuestionChatCount(
  adminClient: ReturnType<typeof createClient>,
  userId: string
) {
  const startOfDayIso = new Date().toISOString().slice(0, 10);
  const { count } = await adminClient
    .from("ai_messages")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("message_kind", "question_chat")
    .eq("message_role", "assistant")
    .gte("created_at", `${startOfDayIso}T00:00:00.000Z`);

  return count ?? 0;
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
  if (request.locale === "pl") {
    return "Jestes nauczycielem do egzaminu na prawo jazdy w Polsce. Odpowiadasz jasno, krotko i praktycznie. Wyjasniasz, dlaczego poprawna odpowiedz jest poprawna, bez wymyslania nowych przepisow. Jesli student wybral zla odpowiedz, spokojnie wskazujesz blad i dajesz jedna regule do zapamietania.";
  }

  if (request.locale === "en") {
    return "You are a driving-exam study coach for the Polish theory exam. Be concise, practical, and calm. Explain why the correct answer is right, avoid inventing rules, and give one short memory rule when helpful.";
  }

  return "Ти помічник для підготовки до теоретичного іспиту на права в Польщі. Відповідай коротко, чітко і практично. Пояснюй, чому правильна відповідь правильна, не вигадуй нових правил, і якщо студент помилився, спокійно покажи логіку та дай одну коротку підказку для запам'ятовування.";
}

function buildUserPrompt(request: QuestionChatRequest) {
  const optionLines = request.question.options
    .map((option) => `- ${option.id}: ${option.text}`)
    .join("\n");

  return [
    `Question locale: ${request.locale}`,
    `Topic block: ${request.question.topicBlock}`,
    `Question: ${request.question.prompt}`,
    optionLines ? `Options:\n${optionLines}` : null,
    `Correct answer: ${request.question.correctAnswer}`,
    request.question.selectedAnswer
      ? `Student selected: ${request.question.selectedAnswer}`
      : null,
    `Official explanation: ${request.question.explanation}`,
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
  const correctAnswerText = getOptionText(
    request,
    request.question.correctAnswer
  );
  const selectedAnswerText = request.question.selectedAnswer
    ? getOptionText(request, request.question.selectedAnswer)
    : null;
  const selectedIsCorrect =
    request.question.selectedAnswer === request.question.correctAnswer;
  const normalizedPrompt = request.prompt.toLowerCase();

  if (request.locale === "pl") {
    const summary = request.question.selectedAnswer
      ? selectedIsCorrect
        ? `Wybrales poprawna odpowiedz: ${selectedAnswerText}.`
        : `Wybrales ${selectedAnswerText}, ale poprawna odpowiedz to ${correctAnswerText}.`
      : `Poprawna odpowiedz to ${correctAnswerText}.`;

    return {
      provider: "mock",
      model: "mock-question-chat-v1",
      content:
        normalizedPrompt.includes("zapam") || normalizedPrompt.includes("egz")
          ? `${summary} Zapamietaj ten motyw jako konkretna zasade egzaminacyjna. ${request.question.explanation}`
          : `${summary} Logika pytania jest taka: ${request.question.explanation}`,
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
      inputTokens: null,
      outputTokens: null,
    };
  }

  if (request.locale === "en") {
    const summary = request.question.selectedAnswer
      ? selectedIsCorrect
        ? `You chose the correct answer: ${selectedAnswerText}.`
        : `You chose ${selectedAnswerText}, but the correct answer is ${correctAnswerText}.`
      : `The correct answer is ${correctAnswerText}.`;

    return {
      provider: "mock",
      model: "mock-question-chat-v1",
      content:
        normalizedPrompt.includes("remember") || normalizedPrompt.includes("exam")
          ? `${summary} Treat this as a specific exam rule to remember. ${request.question.explanation}`
          : `${summary} The question works like this: ${request.question.explanation}`,
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
      inputTokens: null,
      outputTokens: null,
    };
  }

  const summary = request.question.selectedAnswer
    ? selectedIsCorrect
      ? `Ти вибрав правильну відповідь: ${selectedAnswerText}.`
      : `Ти вибрав ${selectedAnswerText}, але правильна відповідь: ${correctAnswerText}.`
    : `Правильна відповідь: ${correctAnswerText}.`;

  return {
    provider: "mock",
    model: "mock-question-chat-v1",
    content:
      normalizedPrompt.includes("запам") || normalizedPrompt.includes("іспит")
        ? `${summary} Сприймай це як конкретне правило для іспиту. ${request.question.explanation}`
        : `${summary} Логіка питання така: ${request.question.explanation}`,
    fallbackUsed: true,
    latencyMs: Date.now() - startedAt,
    inputTokens: null,
    outputTokens: null,
  };
}

function getOptionText(request: QuestionChatRequest, optionId: string) {
  const matched = request.question.options.find((option) => option.id === optionId);

  return matched?.text ?? optionId.toUpperCase();
}

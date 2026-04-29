import { GoogleGenAI } from "@google/genai";
import { prompts } from "../prompts";
import { ChatMessage, Persona } from "../types";
import { Response } from "express";

let ai: GoogleGenAI | null = null;

function getAiClient() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

// Cache available models so we don't hit the API every time
type ModelProvider = "gemini" | "groq";
type AvailableModel = {
  id: string;
  name: string;
  provider: ModelProvider;
  apiModel: string;
};
type GroqMessage = { role: "system" | "user" | "assistant"; content: string };

let cachedModels: AvailableModel[] | null = null;
let cacheTimestamp = 0;
let refreshPromise: Promise<AvailableModel[]> | null = null;
const unavailableModelUntil = new Map<string, number>();
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CHAT_FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
const MODEL_PING_TIMEOUT_MS = 5_000;
const MODEL_PING_CONCURRENCY = 4;
const CHAT_MAX_COMPLETION_TOKENS = 4096;
const CHAT_CONTINUATION_TOKENS = 1024;
const MODEL_FAILURE_MESSAGE =
  "That model is currently unavailable or rate limited. Please try a different model while I refresh the available model list.";
const RESPONSE_INCOMPLETE_MESSAGE =
  "The model stopped before finishing the response. Please retry or choose a model with a larger output limit.";
const BLOCKED_MODEL_PATTERNS = [
  "gemma-3-1b-it",
  "gemma-3-12b-it",
  "gemma-3-27b-it",
  "gemma-3-4b-it",
  "gemma-3n-e2b-it",
  "gemma-3n-e4b-it",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
  "gemini-robotics-er-1.5-preview",
  "gemini-robotics-er-1.6-preview",
  "prompt-guard",
  "safeguard",
];
const NO_REASONING_OUTPUT_INSTRUCTION =
  "Do not reveal hidden reasoning, analysis, chain-of-thought, scratchpad text, or <think> blocks. Provide only the final answer in the requested persona style.";

function supportsGenerateContent(actions: string[] = []) {
  return (
    actions.length === 0 ||
    actions.some((action) => action.toLowerCase() === "generatecontent")
  );
}

function toGeminiModelId(apiModel: string) {
  return apiModel.startsWith("models/") ? apiModel : `models/${apiModel}`;
}

function toGroqModelId(apiModel: string) {
  return `groq:${apiModel}`;
}

function parseSelectedModel(modelId: string): {
  provider: ModelProvider;
  apiModel: string;
} {
  if (modelId.startsWith("groq:")) {
    return { provider: "groq", apiModel: modelId.slice("groq:".length) };
  }

  return { provider: "gemini", apiModel: modelId };
}

export function isBlockedModel(modelIdOrName: string) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalized = normalize(modelIdOrName);
  return BLOCKED_MODEL_PATTERNS.some((pattern) =>
    normalized.includes(normalize(pattern)),
  );
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY || "";
}

function isModelQuarantined(modelId: string) {
  const unavailableUntil = unavailableModelUntil.get(modelId);
  if (!unavailableUntil) return false;

  if (Date.now() >= unavailableUntil) {
    unavailableModelUntil.delete(modelId);
    return false;
  }

  return true;
}

function quarantineModel(modelId: string, durationMs: number) {
  const currentUntil = unavailableModelUntil.get(modelId) || 0;
  unavailableModelUntil.set(
    modelId,
    Math.max(currentUntil, Date.now() + durationMs),
  );
}

async function canGenerateWithGeminiModel(
  client: GoogleGenAI,
  modelId: string,
) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("MODEL_PING_TIMEOUT")),
      MODEL_PING_TIMEOUT_MS,
    ),
  );

  try {
    await Promise.race([
      client.models.generateContent({
        model: modelId,
        contents: "Reply with OK.",
        config: {
          maxOutputTokens: 2,
          temperature: 0,
        },
      }),
      timeoutPromise,
    ]);
    if (!isModelQuarantined(modelId)) {
      unavailableModelUntil.delete(modelId);
    }
    return true;
  } catch (error: any) {
    console.warn(
      `Model unavailable for this API key: ${modelId}`,
      error?.message || error,
    );
    return false;
  }
}

async function groqFetch(path: string, init?: RequestInit) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is missing.");
  }

  return fetch(`${GROQ_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function canGenerateWithGroqModel(modelId: string) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("MODEL_PING_TIMEOUT")),
      MODEL_PING_TIMEOUT_MS,
    ),
  );

  try {
    const response = await Promise.race([
      groqFetch("/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: "Reply with OK." }],
          max_completion_tokens: 2,
          temperature: 0.1,
        }),
      }),
      timeoutPromise,
    ]);

    if (!response.ok) {
      throw new Error(`Groq ping failed with ${response.status}`);
    }

    return true;
  } catch (error: any) {
    console.warn(
      `Groq model unavailable for this API key: ${modelId}`,
      error?.message || error,
    );
    return false;
  }
}

async function canGenerateWithModel(
  client: GoogleGenAI | null,
  model: AvailableModel,
) {
  if (model.provider === "groq") {
    return canGenerateWithGroqModel(model.apiModel);
  }

  if (!client) {
    return false;
  }

  return canGenerateWithGeminiModel(client, model.apiModel);
}

function markModelUnavailable(modelId: string) {
  if (!modelId) return;

  quarantineModel(modelId, CHAT_FAILURE_COOLDOWN_MS);
  if (cachedModels) {
    cachedModels = cachedModels.filter((model) => model.id !== modelId);
    cacheTimestamp = Date.now();
  }
}

async function filterReachableModels(
  client: GoogleGenAI | null,
  models: AvailableModel[],
) {
  const reachableModels: AvailableModel[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < models.length) {
      const model = models[nextIndex++];
      if (
        (await canGenerateWithModel(client, model)) &&
        !isModelQuarantined(model.id)
      ) {
        reachableModels.push(model);
      }
    }
  }

  const workerCount = Math.min(MODEL_PING_CONCURRENCY, models.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return reachableModels;
}

async function listGroqCandidateModels() {
  if (!getGroqApiKey()) {
    return [];
  }

  try {
    const response = await groqFetch("/models", { method: "GET" });
    if (!response.ok) {
      throw new Error(`Groq models failed with ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ id?: string; active?: boolean }>;
    };
    return (data.data || [])
      .filter((model) => model.id && model.active !== false)
      .map((model) => ({
        id: toGroqModelId(model.id || ""),
        name: `Groq · ${model.id}`,
        provider: "groq" as const,
        apiModel: model.id || "",
      }));
  } catch (error) {
    console.error("Failed to list Groq models:", error);
    return [];
  }
}

async function discoverReachableModels(client: GoogleGenAI | null) {
  const previousModels =
    cachedModels?.filter((model) => !isModelQuarantined(model.id)) || [];
  const candidateModels: AvailableModel[] = [];

  if (client) {
    const response = await client.models.list();

    for await (const model of response) {
      // Only include models that support content generation
      if (supportsGenerateContent(model.supportedActions)) {
        const apiModel = toGeminiModelId(model.name || "");
        candidateModels.push({
          id: apiModel,
          name: model.displayName || model.name || "",
          provider: "gemini",
          apiModel,
        });
      }
    }
  }

  candidateModels.push(...(await listGroqCandidateModels()));

  const models = await filterReachableModels(
    client,
    candidateModels.filter(
      (model) =>
        model.id && !isBlockedModel(model.id) && !isBlockedModel(model.name),
    ),
  );

  // Sort to put flash/pro models at the top
  models.sort((a, b) => {
    const priority = (id: string) => {
      if (id.includes("flash")) return 0;
      if (id.includes("pro")) return 1;
      return 2;
    };
    return priority(a.id) - priority(b.id);
  });

  if (models.length > 0) {
    cachedModels = models;
    cacheTimestamp = Date.now();
    return models;
  }

  if (previousModels.length > 0) {
    console.warn(
      "Model refresh returned no reachable models; keeping previous available list.",
    );
    cachedModels = previousModels;
    cacheTimestamp = Date.now();
    return previousModels;
  }

  cachedModels = [];
  cacheTimestamp = Date.now();
  return [];
}

function refreshModels(reason: string) {
  if (refreshPromise) {
    return refreshPromise;
  }

  try {
    const client = process.env.GEMINI_API_KEY ? getAiClient() : null;
    console.log(`Refreshing available Gemini models: ${reason}`);
    refreshPromise = discoverReachableModels(client)
      .catch((error) => {
        console.error("Failed to refresh available Gemini models:", error);
        return cachedModels || [];
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  } catch (error) {
    console.error("Failed to start Gemini model refresh:", error);
    return Promise.resolve(cachedModels || []);
  }
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
  const now = Date.now();
  if (cachedModels && now - cacheTimestamp < CACHE_TTL) {
    return cachedModels.filter((model) => !isModelQuarantined(model.id));
  }

  if (cachedModels) {
    return cachedModels.filter((model) => !isModelQuarantined(model.id));
  }

  return refreshModels("initial load");
}

export async function refreshAvailableModels(): Promise<AvailableModel[]> {
  const models = await refreshModels("requested refresh");
  return models.filter((model) => !isModelQuarantined(model.id));
}

function buildContents(messageHistory: ChatMessage[], userMessage: string) {
  const contents = messageHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

function buildGroqMessages(
  systemPrompt: string,
  messageHistory: ChatMessage[],
  userMessage: string,
): GroqMessage[] {
  return [
    {
      role: "system",
      content: `${systemPrompt}\n\n${NO_REASONING_OUTPUT_INSTRUCTION}`,
    },
    ...messageHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];
}

function createThinkTagFilter() {
  let buffer = "";
  let isInsideThinkBlock = false;
  const maxTagLength = "</think>".length;

  return {
    push(chunk: string) {
      buffer += chunk;
      let output = "";

      while (buffer.length > 0) {
        const lowerBuffer = buffer.toLowerCase();

        if (isInsideThinkBlock) {
          const closeIndex = lowerBuffer.indexOf("</think>");
          if (closeIndex === -1) {
            buffer = buffer.slice(
              Math.max(0, buffer.length - maxTagLength + 1),
            );
            break;
          }

          buffer = buffer.slice(closeIndex + "</think>".length);
          isInsideThinkBlock = false;
          continue;
        }

        const openIndex = lowerBuffer.indexOf("<think>");
        if (openIndex === -1) {
          const emitLength = Math.max(0, buffer.length - maxTagLength + 1);
          output += buffer.slice(0, emitLength);
          buffer = buffer.slice(emitLength);
          break;
        }

        output += buffer.slice(0, openIndex);
        buffer = buffer.slice(openIndex + "<think>".length);
        isInsideThinkBlock = true;
      }

      return output;
    },
    flush() {
      if (isInsideThinkBlock) {
        buffer = "";
        return "";
      }

      const output = buffer;
      buffer = "";
      return output;
    },
  };
}

function isLikelyIncompleteResponse(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const lastChar = trimmed.at(-1) || "";
  if (/[.!?。؟।…)"'\]]/.test(lastChar)) return false;

  const lastLine = trimmed.split(/\r?\n/).at(-1)?.trim() || "";
  if (/^[-*]\s+\S+/.test(lastLine)) return true;

  const words = trimmed.split(/\s+/);
  const lastWord = words.at(-1) || "";
  if (lastWord.length <= 4 && /^[A-Za-z]+$/.test(lastWord)) return true;

  return trimmed.length > 80;
}

async function streamGroqCompletion(
  apiModel: string,
  messages: GroqMessage[],
  res: Response,
  maxCompletionTokens: number,
) {
  const TIMEOUT_MS = 10_000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS),
  );

  let response: globalThis.Response;
  try {
    response = await Promise.race([
      groqFetch("/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model: apiModel,
          messages,
          stream: true,
          temperature: 0.7,
          max_completion_tokens: maxCompletionTokens,
        }),
      }),
      timeoutPromise,
    ]);

    if (!response.ok || !response.body) {
      throw new Error(`Groq chat failed with ${response.status}`);
    }
  } catch {
    throw new Error("GROQ_CHAT_INIT_FAILED");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const thinkTagFilter = createThinkTagFilter();
  let buffer = "";
  let fullText = "";
  let endedByProvider = false;
  let finishReason = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          endedByProvider = true;
          const trailingText = thinkTagFilter.flush();
          if (trailingText) {
            fullText += trailingText;
            res.write(`data: ${JSON.stringify({ text: trailingText })}\n\n`);
          }
          return {
            text: fullText,
            endedByProvider,
            finishReason,
            interrupted: false,
          };
        }

        const parsed = JSON.parse(data);
        const rawText = parsed.choices?.[0]?.delta?.content || "";
        finishReason = parsed.choices?.[0]?.finish_reason || finishReason;
        const text = thinkTagFilter.push(rawText);
        if (text) {
          fullText += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    }

    const trailingText = thinkTagFilter.flush();
    if (trailingText) {
      fullText += trailingText;
      res.write(`data: ${JSON.stringify({ text: trailingText })}\n\n`);
    }
  } catch {
    return {
      text: fullText,
      endedByProvider,
      finishReason,
      interrupted: true,
    };
  }

  return {
    text: fullText,
    endedByProvider,
    finishReason,
    interrupted: false,
  };
}

async function streamGroqChatResponse(
  apiModel: string,
  systemPrompt: string,
  messageHistory: ChatMessage[],
  userMessage: string,
  res: Response,
) {
  const messages = buildGroqMessages(systemPrompt, messageHistory, userMessage);
  let fullText = "";

  try {
    const firstResult = await streamGroqCompletion(
      apiModel,
      messages,
      res,
      CHAT_MAX_COMPLETION_TOKENS,
    );
    fullText += firstResult.text;

    const shouldContinue =
      firstResult.finishReason === "length" ||
      !firstResult.endedByProvider ||
      firstResult.interrupted ||
      isLikelyIncompleteResponse(fullText);

    if (shouldContinue && fullText.trim()) {
      const continuationResult = await streamGroqCompletion(
        apiModel,
        [
          ...messages,
          { role: "assistant", content: fullText },
          {
            role: "user",
            content:
              "Continue exactly from where the previous response stopped. Do not repeat earlier text. Finish the answer naturally in the same persona.",
          },
        ],
        res,
        CHAT_CONTINUATION_TOKENS,
      );
      fullText += continuationResult.text;
    }

    if (isLikelyIncompleteResponse(fullText)) {
      const warning = `\n\n${RESPONSE_INCOMPLETE_MESSAGE}`;
      fullText += warning;
      res.write(`data: ${JSON.stringify({ text: warning })}\n\n`);
    }
  } catch {
    markModelUnavailable(toGroqModelId(apiModel));
    const errorMessage = fullText
      ? `\n\n${RESPONSE_INCOMPLETE_MESSAGE}`
      : MODEL_FAILURE_MESSAGE;
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
  }

  res.write(`data: [DONE]\n\n`);
  res.end();
  return fullText.trim();
}

export async function streamChatResponse(
  persona: Persona,
  messageHistory: ChatMessage[],
  userMessage: string,
  res: Response,
  modelId: string = "gemini-2.5-flash",
): Promise<string> {
  const selectedModel = parseSelectedModel(modelId);
  const systemPrompt = prompts[persona];
  if (isBlockedModel(modelId)) {
    throw new Error("This model is not available in this app.");
  }

  if (!systemPrompt) {
    throw new Error(`Persona '${persona}' not found.`);
  }

  if (selectedModel.provider === "groq") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    return streamGroqChatResponse(
      selectedModel.apiModel,
      systemPrompt,
      messageHistory,
      userMessage,
      res,
    );
  }

  const client = getAiClient();
  const contents = buildContents(messageHistory, userMessage);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const TIMEOUT_MS = 10_000;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS),
  );

  // Check if model supports thinking (only 2.5 models do)
  const supportsThinking = modelId.includes("2.5");

  let response;
  try {
    response = await Promise.race([
      client.models.generateContentStream({
        model: modelId,
        contents,
        config: {
          systemInstruction: `${systemPrompt}\n\n${NO_REASONING_OUTPUT_INSTRUCTION}`,
          temperature: 0.7,
          ...(supportsThinking && {
            thinkingConfig: { thinkingBudget: 2048 },
          }),
        },
      }),
      timeoutPromise,
    ]);
  } catch (err: any) {
    markModelUnavailable(modelId);
    res.write(`data: ${JSON.stringify({ error: MODEL_FAILURE_MESSAGE })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
    return "";
  }

  let fullText = "";

  try {
    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      for (const part of parts) {
        if (part.thought) continue;

        const text = part.text || "";
        if (text) {
          fullText += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    }
  } catch {
    markModelUnavailable(modelId);
    if (!fullText) {
      res.write(
        `data: ${JSON.stringify({ error: MODEL_FAILURE_MESSAGE })}\n\n`,
      );
    }
  }

  res.write(`data: [DONE]\n\n`);
  res.end();

  return fullText.trim();
}

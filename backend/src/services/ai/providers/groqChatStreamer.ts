import { Response } from "express";
import { ChatMessage } from "../../../types";
import {
  CHAT_CONTINUATION_TOKENS,
  CHAT_INIT_TIMEOUT_MS,
  CHAT_MAX_COMPLETION_TOKENS,
  MODEL_FAILURE_MESSAGE,
  NO_REASONING_OUTPUT_INSTRUCTION,
  RESPONSE_INCOMPLETE_MESSAGE,
} from "../../../constants";
import { toGroqModelId } from "../modelIdentifier";
import { isLikelyIncompleteResponse } from "../streaming/responseCompletionDetector";
import {
  writeSseError,
  writeSseText,
} from "../streaming/serverSentEvents";
import { createThinkTagFilter } from "../streaming/reasoningTagFilter";
import { GroqMessage, StreamResult } from "../aiTypes";
import { groqFetch } from "./groqModelProvider";

export async function streamGroqChatResponse(
  apiModel: string,
  systemPrompt: string,
  messageHistory: ChatMessage[],
  userMessage: string,
  res: Response,
  markModelUnavailable: (modelId: string) => void,
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
      writeSseText(res, warning);
    }
  } catch {
    markModelUnavailable(toGroqModelId(apiModel));
    const errorMessage = fullText
      ? `\n\n${RESPONSE_INCOMPLETE_MESSAGE}`
      : MODEL_FAILURE_MESSAGE;
    writeSseError(res, errorMessage);
  }

  return fullText.trim();
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

async function streamGroqCompletion(
  apiModel: string,
  messages: GroqMessage[],
  res: Response,
  maxCompletionTokens: number,
): Promise<StreamResult> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), CHAT_INIT_TIMEOUT_MS),
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

  return readGroqStream(response, res);
}

async function readGroqStream(response: globalThis.Response, res: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Groq response did not include a readable stream.");
  }

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
        const parsedChunk = parseGroqSseLine(line);
        if (!parsedChunk) continue;

        if (parsedChunk.done) {
          endedByProvider = true;
          fullText += flushThinkTagFilter(thinkTagFilter, res);
          return {
            text: fullText,
            endedByProvider,
            finishReason,
            interrupted: false,
          };
        }

        finishReason = parsedChunk.finishReason || finishReason;
        const text = thinkTagFilter.push(parsedChunk.text);
        if (text) {
          fullText += text;
          writeSseText(res, text);
        }
      }
    }

    fullText += flushThinkTagFilter(thinkTagFilter, res);
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

function parseGroqSseLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return null;

  const data = trimmed.slice(6);
  if (data === "[DONE]") {
    return { done: true, text: "", finishReason: "" };
  }

  const parsed = JSON.parse(data);
  return {
    done: false,
    text: parsed.choices?.[0]?.delta?.content || "",
    finishReason: parsed.choices?.[0]?.finish_reason || "",
  };
}

function flushThinkTagFilter(
  thinkTagFilter: ReturnType<typeof createThinkTagFilter>,
  res: Response,
) {
  const trailingText = thinkTagFilter.flush();
  writeSseText(res, trailingText);
  return trailingText;
}

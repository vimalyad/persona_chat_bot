import { Response } from "express";
import { ChatMessage } from "../../../types";
import {
  CHAT_INIT_TIMEOUT_MS,
  MODEL_FAILURE_MESSAGE,
  NO_REASONING_OUTPUT_INSTRUCTION,
} from "../../../constants";
import { getGeminiClient } from "./geminiModelProvider";
import {
  writeSseError,
  writeSseText,
} from "../streaming/serverSentEvents";

export async function streamGeminiChatResponse(
  modelId: string,
  systemPrompt: string,
  messageHistory: ChatMessage[],
  userMessage: string,
  res: Response,
  markModelUnavailable: (modelId: string) => void,
) {
  const client = getGeminiClient();
  const contents = buildContents(messageHistory, userMessage);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), CHAT_INIT_TIMEOUT_MS),
  );
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
  } catch {
    markModelUnavailable(modelId);
    writeSseError(res, MODEL_FAILURE_MESSAGE);
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
          writeSseText(res, text);
        }
      }
    }
  } catch {
    markModelUnavailable(modelId);
    if (!fullText) {
      writeSseError(res, MODEL_FAILURE_MESSAGE);
    }
  }

  return fullText.trim();
}

function buildContents(messageHistory: ChatMessage[], userMessage: string) {
  const contents = messageHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

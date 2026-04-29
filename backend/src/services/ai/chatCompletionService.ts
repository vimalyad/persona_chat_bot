import { Response } from "express";
import { prompts } from "../../prompts";
import { ChatMessage, Persona } from "../../types";
import { isBlockedModel } from "./blockedModelPolicy";
import { parseSelectedModel } from "./modelIdentifier";
import { UnavailableModelTracker } from "./unavailableModelTracker";
import { AvailableModelRegistry } from "./availableModelRegistry";
import { streamGeminiChatResponse } from "./providers/geminiChatStreamer";
import { streamGroqChatResponse } from "./providers/groqChatStreamer";
import {
  endSseResponse,
  prepareSseResponse,
} from "./streaming/serverSentEvents";

export class ChatCompletionService {
  private readonly unavailableModelTracker = new UnavailableModelTracker();
  private readonly availableModelRegistry = new AvailableModelRegistry(
    this.unavailableModelTracker,
  );

  getAvailableModels() {
    return this.availableModelRegistry.getAvailableModels();
  }

  refreshAvailableModels() {
    return this.availableModelRegistry.refreshAvailableModels();
  }

  async streamChatResponse(
    persona: Persona,
    messageHistory: ChatMessage[],
    userMessage: string,
    res: Response,
    modelId = "gemini-2.5-flash",
  ) {
    const selectedModel = parseSelectedModel(modelId);
    const systemPrompt = prompts[persona];

    if (isBlockedModel(modelId)) {
      throw new Error("This model is not available in this app.");
    }

    if (!systemPrompt) {
      throw new Error(`Persona '${persona}' not found.`);
    }

    prepareSseResponse(res);

    const fullText =
      selectedModel.provider === "groq"
        ? await streamGroqChatResponse(
            selectedModel.apiModel,
            systemPrompt,
            messageHistory,
            userMessage,
            res,
            (unavailableModelId) =>
              this.availableModelRegistry.markUnavailable(unavailableModelId),
          )
        : await streamGeminiChatResponse(
            modelId,
            systemPrompt,
            messageHistory,
            userMessage,
            res,
            (unavailableModelId) =>
              this.availableModelRegistry.markUnavailable(unavailableModelId),
          );

    endSseResponse(res);
    return fullText;
  }
}

export const chatCompletionService = new ChatCompletionService();

import { Response } from "express";
import { ChatMessage, Persona } from "../types";
import { chatCompletionService } from "./ai/chatCompletionService";
export { isBlockedModel } from "./ai/blockedModelPolicy";

export function getAvailableModels() {
  return chatCompletionService.getAvailableModels();
}

export function refreshAvailableModels() {
  return chatCompletionService.refreshAvailableModels();
}

export function streamChatResponse(
  persona: Persona,
  messageHistory: ChatMessage[],
  userMessage: string,
  res: Response,
  modelId?: string,
) {
  return chatCompletionService.streamChatResponse(
    persona,
    messageHistory,
    userMessage,
    res,
    modelId,
  );
}

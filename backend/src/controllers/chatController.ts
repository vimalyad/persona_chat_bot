import { Request, Response } from "express";
import { isBlockedModel, streamChatResponse } from "../services/geminiService";
import {
  getMessageHistoryForResponse,
  saveAssistantMessage,
  saveUserMessage,
} from "../services/sessionService";
import { Persona } from "../types";

export async function postChatController(req: Request, res: Response) {
  const { sessionId, persona, message, model, saveUserMessage: shouldSaveUserMessage = true } =
    req.body;

  if (!sessionId || !persona || !message) {
    return res
      .status(400)
      .json({ error: "Missing sessionId, persona, or message" });
  }

  if (model && isBlockedModel(model)) {
    return res.status(400).json({
      error:
        "This model is not available in this app. Please choose a different model.",
    });
  }

  try {
    await saveUserMessage(sessionId, message, shouldSaveUserMessage !== false);
    const messageHistory = await getMessageHistoryForResponse(sessionId);
    const fullResponse = await streamChatResponse(
      persona as Persona,
      messageHistory,
      message,
      res,
      model,
    );

    await saveAssistantMessage(sessionId, fullResponse);
  } catch (error: any) {
    console.error("Error generating chat response:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || "An error occurred during response generation",
      });
    }
  }
}


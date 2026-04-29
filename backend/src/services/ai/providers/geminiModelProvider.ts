import { GoogleGenAI } from "@google/genai";
import { MODEL_PING_TIMEOUT_MS } from "../../../constants";
import { toGeminiModelId } from "../modelIdentifier";
import { AvailableModel } from "../aiTypes";

let ai: GoogleGenAI | null = null;

export function getGeminiClient() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

export function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function listGeminiCandidateModels(client: GoogleGenAI) {
  const models: AvailableModel[] = [];
  const response = await client.models.list();

  for await (const model of response) {
    if (!supportsGenerateContent(model.supportedActions)) continue;

    const apiModel = toGeminiModelId(model.name || "");
    models.push({
      id: apiModel,
      name: model.displayName || model.name || "",
      provider: "gemini",
      apiModel,
    });
  }

  return models;
}

export async function canGenerateWithGeminiModel(
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
    return true;
  } catch (error: any) {
    console.warn(
      `Model unavailable for this API key: ${modelId}`,
      error?.message || error,
    );
    return false;
  }
}

function supportsGenerateContent(actions: string[] = []) {
  return (
    actions.length === 0 ||
    actions.some((action) => action.toLowerCase() === "generatecontent")
  );
}

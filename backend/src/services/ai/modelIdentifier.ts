import { SelectedModel } from "./aiTypes";

export function toGeminiModelId(apiModel: string) {
  return apiModel.startsWith("models/") ? apiModel : `models/${apiModel}`;
}

export function toGroqModelId(apiModel: string) {
  return `groq:${apiModel}`;
}

export function parseSelectedModel(modelId: string): SelectedModel {
  if (modelId.startsWith("groq:")) {
    return { provider: "groq", apiModel: modelId.slice("groq:".length) };
  }

  return { provider: "gemini", apiModel: modelId };
}

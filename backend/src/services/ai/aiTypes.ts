export type ModelProvider = "gemini" | "groq";

export type AvailableModel = {
  id: string;
  name: string;
  provider: ModelProvider;
  apiModel: string;
};

export type SelectedModel = {
  provider: ModelProvider;
  apiModel: string;
};

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamResult = {
  text: string;
  endedByProvider: boolean;
  finishReason: string;
  interrupted: boolean;
};

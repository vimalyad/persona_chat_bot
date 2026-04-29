import { GROQ_BASE_URL, MODEL_PING_TIMEOUT_MS } from "../../../constants";
import { toGroqModelId } from "../modelIdentifier";
import { AvailableModel } from "../aiTypes";

export function hasGroqApiKey() {
  return Boolean(getGroqApiKey());
}

export async function groqFetch(path: string, init?: RequestInit) {
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

export async function listGroqCandidateModels() {
  if (!hasGroqApiKey()) {
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
      .map(
        (model): AvailableModel => ({
          id: toGroqModelId(model.id || ""),
          name: `Groq - ${model.id}`,
          provider: "groq",
          apiModel: model.id || "",
        }),
      );
  } catch (error) {
    console.error("Failed to list Groq models:", error);
    return [];
  }
}

export async function canGenerateWithGroqModel(modelId: string) {
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

function getGroqApiKey() {
  return process.env.GROQ_API_KEY || "";
}

export const CACHE_TTL_MS = 5 * 60 * 1000;
export const CHAT_FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
export const MODEL_PING_TIMEOUT_MS = 5_000;
export const MODEL_PING_CONCURRENCY = 4;
export const CHAT_INIT_TIMEOUT_MS = 10_000;
export const CHAT_MAX_COMPLETION_TOKENS = 4096;
export const CHAT_CONTINUATION_TOKENS = 1024;
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export const MODEL_FAILURE_MESSAGE =
  "That model is currently unavailable or rate limited. Please try a different model while I refresh the available model list.";

export const RESPONSE_INCOMPLETE_MESSAGE =
  "The model stopped before finishing the response. Please retry or choose a model with a larger output limit.";

export const NO_REASONING_OUTPUT_INSTRUCTION =
  "Do not reveal hidden reasoning, analysis, chain-of-thought, scratchpad text, or <think> blocks. Provide only the final answer in the requested persona style.";

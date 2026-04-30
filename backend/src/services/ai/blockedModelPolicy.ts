const BLOCKED_MODEL_PATTERNS = [
  "allam-2-7b",
  "gemma-3-1b-it",
  "gemma-3-12b-it",
  "gemma-3-27b-it",
  "gemma-3-4b-it",
  "gemma-3n-e2b-it",
  "gemma-3n-e4b-it",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
  "gemini-robotics-er-1.5-preview",
  "gemini-robotics-er-1.6-preview",
  "prompt-guard",
  "safeguard",
];

export function isBlockedModel(modelIdOrName: string) {
  const normalized = normalize(modelIdOrName);
  return BLOCKED_MODEL_PATTERNS.some((pattern) =>
    normalized.includes(normalize(pattern)),
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

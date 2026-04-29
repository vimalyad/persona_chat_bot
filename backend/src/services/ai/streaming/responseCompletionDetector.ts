export function isLikelyIncompleteResponse(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const lastChar = trimmed.at(-1) || "";
  if (/[.!?।…)"'\]]/.test(lastChar)) return false;

  const lastLine = trimmed.split(/\r?\n/).at(-1)?.trim() || "";
  if (/^[-*]\s+\S+/.test(lastLine)) return true;

  const words = trimmed.split(/\s+/);
  const lastWord = words.at(-1) || "";
  if (lastWord.length <= 4 && /^[A-Za-z]+$/.test(lastWord)) return true;

  return trimmed.length > 80;
}


import { useCallback, useState } from "react";

export function useClipboardFeedback(timeoutMs = 1500) {
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );

  const copyMessage = useCallback(
    async (content: string, index: number) => {
      if (!content) return;

      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageIndex(index);
        window.setTimeout(
          () =>
            setCopiedMessageIndex((current) =>
              current === index ? null : current,
            ),
          timeoutMs,
        );
      } catch (error) {
        console.error("Failed to copy message:", error);
      }
    },
    [timeoutMs],
  );

  return { copiedMessageIndex, copyMessage };
}


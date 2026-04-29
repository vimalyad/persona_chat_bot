import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sendChatMessageStream } from "../api";
import type { Persona, UiMessage } from "../types";

type StreamingChatOptions = {
  activePersona: Persona;
  sessionId: string | null;
  selectedModel: string;
  setMessages: Dispatch<SetStateAction<UiMessage[]>>;
  refreshAvailableModels: (forceRefresh?: boolean) => Promise<void>;
};

export function useStreamingChat({
  activePersona,
  sessionId,
  selectedModel,
  setMessages,
  refreshAvailableModels,
}: StreamingChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const fullTextRef = useRef("");
  const displayedLenRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const startTypewriter = useCallback(() => {
    if (animFrameRef.current) return;

    let lastTime = 0;
    const tick = (timestamp: number) => {
      const backlog = fullTextRef.current.length - displayedLenRef.current;
      if (backlog <= 0) {
        animFrameRef.current = null;
        return;
      }

      const { delay, charsPerTick } = getTypewriterSpeed(backlog);
      if (timestamp - lastTime >= delay) {
        lastTime = timestamp;
        const newLen = Math.min(
          displayedLenRef.current + charsPerTick,
          fullTextRef.current.length,
        );
        displayedLenRef.current = newLen;
        const shown = fullTextRef.current.slice(0, newLen);
        setMessages((prev) => updateMessageAt(prev, prev.length - 1, shown));
      }

      if (displayedLenRef.current < fullTextRef.current.length) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, [setMessages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !sessionId || isStreaming || !selectedModel) return;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "" },
      ]);

      await streamMessage(text, true, (error) => {
        setMessages((prev) =>
          replaceLastMessage(prev, {
            role: "assistant",
            content: error,
            isError: true,
            retryText: text,
          }),
        );
      });
    },
    [isStreaming, selectedModel, sessionId, setMessages],
  );

  const retryMessage = useCallback(
    async (failedIndex: number, text: string) => {
      if (!text.trim() || !sessionId || isStreaming || !selectedModel) return;

      setMessages((prev) => {
        const updated = [...prev];
        updated[failedIndex] = { role: "assistant", content: "" };
        return updated;
      });

      await streamMessage(text, false, (error) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[failedIndex] = {
            role: "assistant",
            content: error,
            isError: true,
            retryText: text,
          };
          return updated;
        });
      });
    },
    [isStreaming, selectedModel, sessionId, setMessages],
  );

  const streamMessage = async (
    text: string,
    saveUserMessage: boolean,
    showError: (error: string) => void,
  ) => {
    setIsStreaming(true);
    fullTextRef.current = "";
    displayedLenRef.current = 0;

    await sendChatMessageStream(
      sessionId || "",
      activePersona,
      text,
      selectedModel,
      (chunk) => {
        fullTextRef.current += chunk;
        startTypewriter();
      },
      () => {
        const waitForFlush = () => {
          if (displayedLenRef.current >= fullTextRef.current.length) {
            setIsStreaming(false);
          } else {
            startTypewriter();
            requestAnimationFrame(waitForFlush);
          }
        };
        waitForFlush();
      },
      (error) => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        showError(error);
        setIsStreaming(false);
        void refreshAvailableModels(true);
      },
      saveUserMessage,
    );
  };

  return { isStreaming, sendMessage, retryMessage };
}

function getTypewriterSpeed(backlog: number) {
  if (backlog < 10) return { delay: 25, charsPerTick: 1 };
  if (backlog < 50) return { delay: 12, charsPerTick: 2 };
  if (backlog < 150) return { delay: 5, charsPerTick: 3 };
  return { delay: 2, charsPerTick: 5 };
}

function updateMessageAt(messages: UiMessage[], index: number, content: string) {
  const updated = [...messages];
  updated[index] = {
    ...updated[index],
    content,
  };
  return updated;
}

function replaceLastMessage(messages: UiMessage[], message: UiMessage) {
  const updated = [...messages];
  updated[updated.length - 1] = message;
  return updated;
}

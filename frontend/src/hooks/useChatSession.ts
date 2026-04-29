import { useEffect, useState } from "react";
import { getSession, resetSession } from "../api";
import type { Persona, UiMessage } from "../types";

export function useChatSession(activePersona: Persona) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      try {
        const data = await getSession(activePersona);
        setSessionId(data.session.id);
        setMessages(data.messages);
      } catch (e) {
        console.error("Failed to load session:", e);
      } finally {
        setIsLoading(false);
      }
    };
    void loadSession();
  }, [activePersona]);

  const resetCurrentSession = async () => {
    setIsLoading(true);
    try {
      const data = await resetSession(activePersona);
      setSessionId(data.session.id);
      setMessages(data.messages);
    } catch (e) {
      console.error("Failed to reset session:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    setMessages,
    sessionId,
    isLoading,
    resetCurrentSession,
  };
}


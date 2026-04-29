import type { ChatMessage, Persona, Session } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const getSession = async (persona: Persona): Promise<{ session: Session; messages: ChatMessage[] }> => {
  const response = await fetch(`${API_URL}/sessions/${persona}`);
  return response.json();
};

export const resetSession = async (persona: Persona): Promise<{ session: Session; messages: ChatMessage[] }> => {
  const response = await fetch(`${API_URL}/sessions/${persona}/reset`, { method: 'POST' });
  return response.json();
};

export const sendChatMessageStream = async (
  sessionId: string,
  persona: Persona,
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) => {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, persona, message }),
    });

    if (!response.ok) {
      const err = await response.json();
      onError(err.error || 'Something went wrong.');
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('Streaming not supported.');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages from the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              onError(parsed.error);
              return;
            }
            if (parsed.text) {
              onChunk(parsed.text);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    onDone();
  } catch {
    onError('Failed to connect to the server.');
  }
};
